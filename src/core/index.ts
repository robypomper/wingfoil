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
import { ValidationError } from '../validation';
import type { DnaYaml, Paths } from '../dna/schema';

import {
  loadDirectives,
  loadDnaYaml,
  loadWorkflowsYaml,
  type DirectiveFile,
  type WorkflowsLoadResult,
} from './loaders';
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
export { initWingfoilStorage } from './init';
export type { InitStorageValue } from './init';

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
 * `no DNA key named '<section>'`.
 */
const DNA_SHOW_SECTION_ALIASES: Readonly<Record<string, string>> = { tech_stack: 'stacks' };

const dnaShowFn: CoreFn<unknown, unknown> = async (params) => {
  const { root, positional: section } = params as RootParams & { positional?: string };
  const loaded: CoreResult<DnaYaml> = loadOrError(() => loadDnaYaml(root));
  if (!loaded.ok || section === undefined) return loaded;

  const key = DNA_SHOW_SECTION_ALIASES[section] ?? section;
  const dna = loaded.value as Record<string, unknown>;
  if (!(key in dna)) {
    return coreErr({ code: 'NOT_FOUND', message: `no DNA key named '${section}'` });
  }
  return coreOk(dna[key]);
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
 * under a `memoryXxx` name would misrepresent it as the latter. There is intentionally zero
 * mutating operation in production today — none of spec-006 §3's actual mutating functions
 * (`memoryAdd`, `dnaSet`, `directiveCreate`, `workflowStart`, ...) are implemented yet; that is
 * task-018..030's scope, not this task's. The REQ-SYS-05 parity test in `test/core/parity.test.ts`
 * runs against this exact array, so it becomes a real regression guard the moment a mutating
 * operation is added here — today it legitimately reports 0 mutating ops on both surfaces.
 */
export const CORE_MODULES: readonly CoreModule[] = [
  {
    name: 'dna',
    operations: {
      dnaShow: { name: 'dnaShow', mutates: false, fn: dnaShowFn },
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
