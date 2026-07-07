/**
 * `core` module — shared domain logic; single behavior behind both the CLI and MCP surfaces
 * (REQ-SYS-05). Exposes one loader per Project pillar (task-004-decoupled-pillars, REQ-SYS-02):
 * `loadMemoryYaml`, `loadDnaYaml`, `loadWorkflowsYaml`, `loadDirectives` — each independently reads
 * and validates only its own pillar's artifact(s), so editing one pillar's config never requires
 * touching another's loader.
 *
 * task-006-dual-interface-shared-core adds the `CoreModule` registry (spec-006-core-domain-api):
 * `CORE_MODULES` below is the single array `src/cli` and `src/mcp` both derive their surfaces
 * from. It is intentionally small today — see the SCOPE note on `CORE_MODULES` — the full
 * memory/dna/directives/workflow domain-operation tables in spec-006 §3 (`memoryAdd`, `dnaSet`,
 * `directiveCreate`, ...) are feature work for task-018..030, not this task.
 */
import { join, relative } from 'path';

import { dump } from 'js-yaml';

import { generateId, parseYaml, toValidationError, ValidationError } from '../validation';
import type { Paths } from '../dna/schema';
import { DnaYaml } from '../dna/schema';
import { DNA_KEY_ALIASES, isValidKeyPath, setDnaValue } from '../dna/set';
import { commitPaths, readDocument, StorageError, writeDocument } from '../storage';
import {
  hasNumericToken,
  nextSequenceNumber,
  parseTags,
  renderAddDocument,
  resolveTypeDirectory,
  slugifyTitle,
  writeMemoryEntry,
} from '../memory';

import {
  loadDirectives,
  loadDnaYaml,
  loadMemoryYaml,
  loadWorkflowsYaml,
  type DirectiveFile,
  type WorkflowsLoadResult,
} from './loaders';
import type { MemoryYaml } from '../memory/schema';
import { requireGitIdentity } from './git-identity';
import { UsageError } from './usage-error';
import type { CoreFn, CoreModule } from './registry';
import { coreErr, coreOk } from './types';
import type { CoreResult } from './types';

export const MODULE_NAME = 'core' as const;

export {
  loadDirectives,
  loadDnaYaml,
  loadMemoryYaml,
  loadWorkflowsYaml,
} from './loaders';
export type { DirectiveFile, WorkflowsLoadResult } from './loaders';
export * from './types';
export * from './registry';
export * from './exit-code';
export * from './git-identity';
export * from './usage-error';
export { initWingfoilStorage, initWingfoilProject, WINGFOIL_ALREADY_INITIALIZED } from './init';
export type { InitStorageValue, InitProjectValue } from './init';

/** Params shared by every operation registered today — all of them are a bare pillar-config read. */
export interface RootParams {
  readonly root: string;
}

/**
 * Run a synchronous, throwing pillar loader (task-004's `load*` functions) and map its expected
 * failures onto a `CoreResult` (spec-006 §2): a `ValidationError` from the shared two-pass pipeline
 * becomes `VALIDATION`, a missing file (Node's `ENOENT`) becomes `NOT_FOUND`; anything else
 * propagates as a genuine thrown exception (a programmer bug, not a domain failure — spec-006 §2's
 * "no function throws for *expected* domain failures" implies unexpected ones still may). Factored
 * out of `wrapReadOnly` so both `dnaShowFn` (task-026) and `pathsFn` (task-028) reuse the exact
 * same mapping for their own richer, argument-aware bodies instead of duplicating it.
 */
function loadOrError<R>(loader: () => R): CoreResult<R> {
  try {
    return coreOk(loader());
  } catch (error) {
    if (error instanceof ValidationError) {
      return coreErr({ code: 'VALIDATION', message: error.message, details: { issues: error.issues } });
    }
    const errno = error as NodeJS.ErrnoException;
    if (errno && errno.code === 'ENOENT') {
      return coreErr({ code: 'NOT_FOUND', message: errno.message });
    }
    throw error;
  }
}

/** Adapt a synchronous, throwing pillar loader into a `CoreFn` taking just `{ root }` (spec-006 §2). */
function wrapReadOnly<R>(loader: (root: string) => R): CoreFn<unknown, R> {
  return async (params) => {
    const { root } = params as RootParams;
    return loadOrError(() => loader(root));
  };
}

/**
 * `wingfoil paths [category]` params (task-028-implement-paths-category) — the same generic seam
 * `dnaShowFn` reads: `positional` is the bare CLI positional (`ParamsContext.positional`,
 * `core/registry.ts` — task-026's single source of truth), interpreted here as the resource-path
 * **category**; `list` is the parsed `--list` flag (`ParamsContext.flags.list`, spread into params by
 * `buildParams`). `category`/`--list` are optional: an omitted category returns the whole `paths`
 * node (what the MCP surface's mechanical zero-argument `wingfoil://paths` Resource gets — it has no
 * per-request parameter, the same limitation `src/mcp/dna-resource.ts` documents for `dnaShow`).
 * `--list` is accepted (spec-008/X_cli-cmds.md's "drill-down") but currently a no-op on the returned
 * value: a DNA `paths` category is already a flat `string[]` with nothing coarser to collapse to, and
 * spec-005-cli-command-contract §4's own worked example (`paths sources --format json` ->
 * `{"category":"sources","paths":[...]}`) shows the full list without `--list` either — so there is
 * no approved "collapsed" shape to switch away from. */
export interface PathsParams {
  readonly root: string;
  readonly positional?: string;
  readonly list?: boolean;
}

/** `wingfoil paths <category>` success shape — spec-005-cli-command-contract §4's worked example,
 * verbatim (`{"category":"sources","paths":["src/cli","src/core"]}`). */
export interface PathsShowResult {
  readonly category: string;
  readonly paths: readonly string[];
}

/**
 * `paths` `CoreOperation.fn` (P2.5, spec-002-dna-yaml-schema's `Paths` node) —
 * task-028-implement-paths-category. Loads `.wingfoil/dna.yaml` via the same `loadOrError` +
 * `loadDnaYaml` path `dnaShowFn` uses, then narrows to one category (the bare positional):
 *
 * - category given and mapped (a non-empty array) -> `coreOk({category, paths})` (spec-005 §4 shape).
 * - category given but absent/empty in `paths:` -> `coreErr(NOT_FOUND, "no paths mapped for
 *   category '<category>'")` — the exact BDD `P2.5-paths.feature` "Error - querying an undefined
 *   category" wording (exit `1` via `exit-code.ts`, never a throw, never exit `2` — a read-only
 *   command, spec-005 §1; symmetric with `dnaShowFn`'s own unknown-section `NOT_FOUND`).
 * - category omitted -> `coreOk(<whole paths node>)` (see {@link PathsParams}'s doc comment on why;
 *   symmetric with `dna show` returning the whole DNA when no section is given).
 *
 * `dna.paths` is `.passthrough()` (spec-002), so an entry beyond the five named categories is still a
 * plain object property here, not necessarily an array — `Array.isArray` guards that case rather than
 * assuming the shape.
 */
const pathsFn: CoreFn<unknown, PathsShowResult | Paths> = async (params) => {
  const { root, positional: category } = params as PathsParams;
  const loaded: CoreResult<DnaYaml> = loadOrError(() => loadDnaYaml(root));
  if (!loaded.ok) return loaded;
  if (category === undefined) return coreOk(loaded.value.paths);

  const raw = (loaded.value.paths as Record<string, unknown>)[category];
  const entries = Array.isArray(raw) ? (raw as string[]) : undefined;
  if (!entries || entries.length === 0) {
    return coreErr({ code: 'NOT_FOUND', message: `no paths mapped for category '${category}'` });
  }
  return coreOk({ category, paths: entries });
};

/**
 * `dna show [section]` (P2.2-implement-dna-show, task-026): resolves `ParamsContext.positional`
 * (`core/registry.ts` — the generic CLI-positional seam this task adds) as an optional DNA section
 * name. No `positional` -> the whole parsed `DnaYaml` (unchanged behavior, what the MCP
 * `wingfoil://dna/show` Resource still gets, since the MCP surface never sets this field — see
 * `ParamsContext.positional`'s own doc comment). `tech_stack` resolves as a BDD-compatibility alias
 * for `stacks` (spec-002-dna-yaml-schema Consequences: the schema renamed the BDD's `tech_stack`
 * wording). An unknown section is a domain `NOT_FOUND` (`CoreResult.error`, exit `1` via
 * `exit-code.ts` — never a thrown exception and never exit `2`, since a read-only command can only
 * exit `0`/`1` per spec-005-cli-command-contract §1), with the exact P2.2 message
 * `no DNA key named '<section>'`. The `tech_stack`→`stacks` alias is the shared `DNA_KEY_ALIASES`
 * (`src/dna/set.ts`) — the single source of truth `dna set` uses too, so read and write stay symmetric.
 */
const dnaShowFn: CoreFn<unknown, unknown> = async (params) => {
  const { root, positional: section } = params as RootParams & { positional?: string };
  const loaded: CoreResult<DnaYaml> = loadOrError(() => loadDnaYaml(root));
  if (!loaded.ok || section === undefined) return loaded;

  const key = DNA_KEY_ALIASES[section] ?? section;
  const dna = loaded.value as Record<string, unknown>;
  if (!(key in dna)) {
    return coreErr({ code: 'NOT_FOUND', message: `no DNA key named '${section}'` });
  }
  return coreOk(dna[key]);
};

/**
 * `dna set <key> <value>` params (P2.1, task-025-implement-dna-set) — the first mutating operation.
 * `positionals` is the full CLI positional list (`ParamsContext.positionals`, `core/registry.ts`'s
 * additive seam this task adds): `positionals[0]` is the dotted key path, `positionals[1]` the value.
 */
export interface DnaSetParams {
  readonly root: string;
  readonly positionals?: readonly string[];
}

/**
 * `dna set` `CoreOperation.fn` (P2.1, `mutates: true` — the FIRST mutating op in the whole system,
 * spec-006-core-domain-api §3 dna table). The mutating-op template every later mutation follows:
 *
 * 1. **`requireGitIdentity` pre-flight** (REQ-SEC-01, task-014) — refuse before any read/write when
 *    `user.name`/`user.email` are unset, returning its `CoreResult.error` unchanged (exit 1).
 * 2. **Argument validation** — a missing `<key>`/`<value>`, or a malformed dotted key path (e.g. the
 *    BDD's `..language`), is a usage error: `throw new UsageError(...)` → exit **2** with a clean
 *    message (mapped by `exitCodeForThrow`, `./exit-code.ts`), per spec-005-cli-command-contract §1.
 * 3. **Load + apply + re-serialize** — load the current `.wingfoil/dna.yaml` through the same two-pass
 *    path `dnaShow` uses (a missing/invalid file → `NOT_FOUND`/`VALIDATION`, exit 1), set the value
 *    (`src/dna`'s pure `setDnaValue`, incl. the `tech_stack`→`stacks` alias), and re-serialize
 *    deterministically (REQ-SYS-07: js-yaml preserves key order, no wall-clock/random; `lineWidth: -1`
 *    fixes the wrap width so the same input yields byte-identical output).
 * 4. **Re-validate the written bytes** against `DnaYaml` (spec-002) BEFORE persisting — a schema-invalid
 *    result is a logic error (`VALIDATION` → exit 1) and the file is left untouched (returned, not
 *    thrown). Re-parsing the serialized form (not the in-memory object) is deliberate: it validates the
 *    exact bytes about to be written, honouring YAML's own scalar coercion.
 * 5. **Persist + commit** through the single storage primitives (task-018) — `writeDocument` then
 *    `commitPaths` on the ONE scoped path `.wingfoil/dna.yaml`; the returned sha rides `CoreResult.commit`.
 */
const dnaSetFn: CoreFn<unknown, { key: string; value: string }> = async (params) => {
  const { root, positionals } = params as DnaSetParams;

  const identity = requireGitIdentity(root);
  if (!identity.ok) return identity;

  const keyPath = positionals?.[0];
  const value = positionals?.[1];
  if (keyPath === undefined || value === undefined) {
    throw new UsageError('missing required argument: dna set <key> <value>');
  }
  if (!isValidKeyPath(keyPath)) {
    throw new UsageError(`invalid key path: '${keyPath}'`);
  }

  const loaded: CoreResult<DnaYaml> = loadOrError(() => loadDnaYaml(root));
  if (!loaded.ok) return loaded;

  const dna = loaded.value as Record<string, unknown>;
  setDnaValue(dna, keyPath, value);
  const dnaPath = join(root, '.wingfoil', 'dna.yaml');
  const serialized = dump(dna, { lineWidth: -1 });

  // Re-validate the exact bytes about to be written against DnaYaml (spec-002), via a SILENT
  // `safeParse` — the unknown-field warning (spec-009 §2) belongs to the load path (`dna show`), not
  // the write path, and re-parsing the serialized YAML (not the in-memory object) honours YAML's own
  // scalar coercion. A schema failure is a logic error (VALIDATION → exit 1), returned NOT thrown, so
  // nothing is written.
  const parsed = DnaYaml.safeParse(parseYaml(serialized, dnaPath));
  if (!parsed.success) {
    const validationError = toValidationError(parsed.error, dnaPath);
    return coreErr({ code: 'VALIDATION', message: validationError.message, details: { issues: validationError.issues } });
  }

  // Idempotent no-op: if the (normalized) bytes already match what is on disk, the value is unchanged —
  // there is nothing to write or commit, so this succeeds without an empty commit (a set to the current
  // value is idempotent success, not an error). REQ-SYS-07: `serialized` is a deterministic function of
  // the input, so this comparison is stable across runs.
  if (readDocument(dnaPath) === serialized) {
    return coreOk({ key: keyPath, value });
  }

  writeDocument(dnaPath, serialized);
  const message = `wf(dna): set ${keyPath}`;
  const sha = commitPaths(root, ['.wingfoil/dna.yaml'], message);
  return coreOk({ key: keyPath, value }, { sha, message });
};

/**
 * `wingfoil memory add` params (P1.3, task-020-implement-memory-add) — the FIRST Memory-document
 * mutation. `options` is the value-bearing-option seam this task establishes
 * (`ParamsContext.options`, `core/registry.ts`), read as `--type`/`--title`/`--tags`. The MCP surface
 * never populates it (task-030 wires the Tool input schema); a call with no options simply has all
 * three absent, which the required checks below reject as usage errors.
 */
export interface MemoryAddParams {
  readonly root: string;
  readonly options?: Readonly<Record<string, string>>;
}

/**
 * `memory add` `CoreOperation.fn` (P1.3, `mutates: true` — the first Memory-document mutation and the
 * pattern for all Memory CRUD; spec-006-core-domain-api §3 memory table). Follows `dna set`'s
 * mutating-op template (task-025) exactly, over the Memory store instead of `dna.yaml`:
 *
 * 1. **`requireGitIdentity` pre-flight** (REQ-SEC-01, task-014) — refuse before any read/write when
 *    the git identity is unset, returning its `CoreResult.error` unchanged (exit 1).
 * 2. **Argument validation** — a missing `--type`/`--title` is a usage error: `throw new UsageError`
 *    → exit **2** with the exact `missing required argument: --<name>` message
 *    (spec-008-cli-grammar §5, mapped by `exitCodeForThrow`), same classification as `dna set`'s
 *    missing positional.
 * 3. **Resolve `--type` against the `memory.yaml` type registry** (spec-001-memory-yaml-schema) via
 *    `loadMemoryYaml` — an unknown type is a domain `NOT_FOUND` (exit 1) with the exact P1.3 message
 *    `unknown memory type '<t>' (not defined in memory.yaml)`, returned BEFORE any write.
 * 4. **Generate the id** deterministically from the type's `id_pattern` (task-002's `generateId`,
 *    REQ-SYS-07): the `{slug}` from the title, and — only for a `{n}`-token pattern — a sequence
 *    counter derived from the committed on-disk siblings (`src/memory/add.ts`; no wall-clock/random).
 * 5. **Copy the type's `template.file` scaffold verbatim** (`.wingfoil/<file>`) and fill only the
 *    `id`/`status: draft`/`--title`/`--tags` skeleton (P1.3; spec-010-memory-frontmatter-schema),
 *    then **write + commit** through task-022's confined `writeMemoryEntry` (REQ-SEC-06 refuse-before-write
 *    + one scoped commit `wf(<type>): add <id>`); the returned sha rides `CoreResult.commit`.
 *
 * A thrown `StorageError` (e.g. a confinement violation, an unresolved path placeholder for a
 * workflow-seeded type) or a `ValidationError` (a malformed `id_pattern`) is a logic error mapped to a
 * `CoreResult.error` (exit 1) so nothing escapes as an uncaught throw — the usage errors above are the
 * only exit-2 path and are thrown before this try.
 */
const memoryAddFn: CoreFn<unknown, { id: string; path: string }> = async (params) => {
  const { root, options } = params as MemoryAddParams;

  const identity = requireGitIdentity(root);
  if (!identity.ok) return identity;

  const type = options?.type;
  if (type === undefined) throw new UsageError('missing required argument: --type');
  const title = options?.title;
  if (title === undefined) throw new UsageError('missing required argument: --title');
  const tags = parseTags(options?.tags);

  const loaded: CoreResult<MemoryYaml> = loadOrError(() => loadMemoryYaml(root));
  if (!loaded.ok) return loaded;

  const entry = loaded.value.types[type];
  if (!entry) {
    return coreErr({ code: 'NOT_FOUND', message: `unknown memory type '${type}' (not defined in memory.yaml)` });
  }
  const { path: pathPattern, id_pattern: idPattern, template } = entry;
  if (idPattern === undefined || template === undefined) {
    return coreErr({ code: 'VALIDATION', message: `memory type '${type}' has no id_pattern/template in memory.yaml` });
  }

  try {
    const sequence = hasNumericToken(idPattern)
      ? nextSequenceNumber(resolveTypeDirectory(root, pathPattern), idPattern)
      : 0;
    const id = generateId(idPattern, { slug: slugifyTitle(title), n: sequence });
    const scaffold = readDocument(join(root, '.wingfoil', template.file));
    const content = renderAddDocument(scaffold, { id, title, tags });
    const message = `wf(${type}): add ${id}`;
    const { path, sha } = writeMemoryEntry(root, pathPattern, { id }, content, message);
    return coreOk({ id, path: relative(root, path) }, { sha, message });
  } catch (error) {
    if (error instanceof StorageError) {
      return coreErr({ code: 'IO', message: error.message });
    }
    if (error instanceof ValidationError) {
      const reason = error.issues.length > 0 ? error.issues.map((issue) => issue.message).join('; ') : error.message;
      return coreErr({ code: 'VALIDATION', message: reason });
    }
    throw error;
  }
};

/**
 * The production `CoreModule` registry (spec-006 §2, §4). `src/cli`'s command registrar and
 * `src/mcp`'s Tool/Resource registrar both import this exact array — see spec-006 §4.1: "no
 * duplicated or hand-copied operation list in either surface module".
 *
 * SCOPE (task-006-dual-interface-shared-core, see the task's Execution Notes for the full
 * rationale): only the core functions that already legitimately exist are wired in here today —
 * task-004's three read-only per-pillar loaders that have a natural spec-006 §3 counterpart
 * (`dnaShow`, `directivesList`, `workflowList` — all `mutates: false`), plus
 * task-028-implement-paths-category's `paths` (P2.5, `wingfoil paths [category]`) — the first FLAT,
 * no-verb command (`deriveVerb('paths', 'paths') === ''`, spec-008-cli-grammar §1) and the first to
 * declare a `--list` flag (`CoreOperation.flags`, `./registry.ts`); its `category` rides the same
 * generic bare-positional seam `dna show`'s `section` does (task-026's `ParamsContext.positional`),
 * so no per-operation positional metadata is needed here. `loadMemoryYaml`
 * is deliberately NOT registered as a `memory` module operation: it loads the Memory *pillar's own
 * config* (`memory.yaml`'s types/state-machines), a different concept from spec-006 §3's `memory`
 * module (which operates on Memory *documents* — `memoryAdd`, `memorySearch`, ...); registering it
 * under a `memoryXxx` name would misrepresent it as the latter. As of
 * task-025-implement-dna-set the registry has its FIRST mutating operation — `dna.dnaSet`
 * (`mutates: true`, P2.1); the remaining spec-006 §3 mutating functions (`memoryAdd`,
 * `directiveCreate`, `workflowStart`, ...) are still task-020..030's scope. The REQ-SYS-05 parity
 * test in `test/core/parity.test.ts` runs against this exact array, so it is now a live regression
 * guard: `dna set` must appear as both a CLI command and an MCP Tool, or the diff fails.
 */
export const CORE_MODULES: readonly CoreModule[] = [
  {
    name: 'dna',
    operations: {
      // The FIRST `mutates: true` operation in production (spec-006 §3 dna table) — by construction an
      // MCP Tool (`dna.set`) + CLI command (`wingfoil dna set`), and the op the REQ-SYS-05 parity test
      // now actually guards (task-025-implement-dna-set).
      dnaSet: { name: 'dnaSet', mutates: true, fn: dnaSetFn },
      dnaShow: { name: 'dnaShow', mutates: false, fn: dnaShowFn },
    },
  },
  {
    name: 'memory',
    operations: {
      // The FIRST Memory-document mutation (P1.3, spec-006 §3 memory table) — `mutates: true`, so by
      // construction an MCP Tool (`memory.add`) + CLI command (`wingfoil memory add`), and the second
      // op the REQ-SYS-05 parity test now guards (alongside `dna.set`). It declares the value-bearing
      // `--type`/`--title`/`--tags` options (task-020's `CoreOperation.options` seam, reused by
      // task-021). `loadMemoryYaml` (the Memory *pillar config* loader) is deliberately NOT registered
      // here — it is a different concept from this `memory` module, which operates on Memory *documents*.
      memoryAdd: {
        name: 'memoryAdd',
        mutates: true,
        options: [
          { name: 'type', required: true },
          { name: 'title', required: true },
          { name: 'tags' },
        ],
        fn: memoryAddFn,
      },
    },
  },
  {
    name: 'directives',
    operations: {
      directivesList: {
        name: 'directivesList',
        mutates: false,
        fn: wrapReadOnly<DirectiveFile[]>(loadDirectives),
      },
    },
  },
  {
    name: 'paths',
    operations: {
      // Self-named (operation name === module name) — the flat/no-verb `wingfoil paths [category]`
      // form (see `deriveVerb`, `./registry.ts`), not `wingfoil paths paths`. `category` rides the
      // generic bare positional (task-026's seam); only `--list` is declared here.
      paths: { name: 'paths', mutates: false, flags: ['list'], fn: pathsFn },
    },
  },
  {
    name: 'workflow',
    operations: {
      workflowList: {
        name: 'workflowList',
        mutates: false,
        fn: wrapReadOnly<WorkflowsLoadResult>(loadWorkflowsYaml),
      },
    },
  },
];
