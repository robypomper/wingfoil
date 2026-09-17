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
import { DNA_KEY_ALIASES, isValidKeyPath, setDnaValue, setDnaValueInText } from '../dna/set';
import {
  INVALID_DIRECTIVE_NAME_MESSAGE,
  isValidDirectiveName,
  renderCustomDirective,
} from '../directives/create';
import { commitPaths, documentExists, readDocument, StorageError, writeDocument } from '../storage';
import {
  findMemoryDocumentById,
  formatMemoryCommitMessage,
  hasNumericToken,
  isArchivedStatus,
  missingRequiredFields,
  nextSequenceNumber,
  parseTags,
  reconstructMemoryTransitions,
  renderAddDocument,
  REJECTION_REASON_FIELD,
  renderSubmitDocument,
  resolveTypeDirectory,
  searchMemoryDocuments,
  setFrontmatterField,
  slugifyTitle,
  validateSearchQuery,
  writeMemoryEntry,
} from '../memory';

import {
  loadDnaYaml,
  loadMemoryYaml,
  loadWorkflowsYaml,
  type WorkflowsLoadResult,
} from './loaders';
import { loadDirectiveListing, type DirectiveListing } from './directives-list';
import type { MemoryYaml } from '../memory/schema';
import { readGitIdentity, requireGitIdentity } from './git-identity';
import { APPROVER_ROLE, requireApprovalAuthority } from './approval-authority';
import { requireReason } from './require-reason';
import { commitMemoryTransition, prepareMemoryTransition } from './memory-transition';
import { UsageError } from './usage-error';
import type { CoreFn, CoreModule } from './registry';
import { coreErr, coreOk } from './types';
import type { CoreResult } from './types';

/** This module's `dna.yaml` name (`core`) — the stable identifier surfaces and tests key it by. */
export const MODULE_NAME = 'core' as const;

export {
  loadDirectives,
  loadDnaYaml,
  loadMemoryYaml,
  loadRolesYaml,
  loadWorkflowsYaml,
} from './loaders';
export type { DirectiveFile, WorkflowsLoadResult } from './loaders';
export { assembleExecutionContext, resolveRoleDirectives, selectDirectivesById } from './context';
export {
  buildDirectiveListing,
  loadDirectiveListing,
  GLOBAL_ASSIGNMENT,
  UNASSIGNED_ASSIGNMENT,
} from './directives-list';
export type { DirectiveListEntry, DirectiveListing } from './directives-list';
export type {
  DirectiveSelection,
  ExecutionContext,
  ExecutionContextElement,
  ExecutionContextInputs,
  RoleDirectiveResolution,
} from './context';
export * from './types';
export * from './registry';
export * from './exit-code';
export * from './git-identity';
export * from './approval-authority';
export * from './require-reason';
export * from './builtin-asset';
export * from './usage-error';
export { initWingfoilStorage, initWingfoilProject, WINGFOIL_ALREADY_INITIALIZED } from './init';
export type { InitStorageValue, InitProjectValue } from './init';
export {
  DEFAULT_CONTEXT_LIMITS,
  filterRelevantMemoryDocuments,
  NO_RELEVANT_MEMORY_NOTE,
} from './relevance';
export type {
  ContextLimits,
  RelevanceElementRef,
  RelevantMemoryDocument,
  RelevantMemoryResult,
} from './relevance';
export { commitMemoryTransition, prepareMemoryTransition } from './memory-transition';
export type { PreparedMemoryTransition } from './memory-transition';
export { verifyBuiltinTemplates } from './builtin-integrity';
export type { BuiltinIntegrityFailure, BuiltinTemplateKind, BuiltinTemplateSource } from './builtin-integrity';

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
 * 3. **Load + apply + produce the new bytes** — load the current `.wingfoil/dna.yaml` through the same
 *    two-pass path `dnaShow` uses (a missing/invalid file → `NOT_FOUND`/`VALIDATION`, exit 1), then
 *    produce the file's new text. The PRIMARY path is `src/dna`'s `setDnaValueInText`: a minimal
 *    **in-place textual edit** — one line rewritten or inserted — so every comment survives, including
 *    the inline `[SPEC]`/`[AUTHORING]` field-provenance annotations a whole-file re-serialization used
 *    to delete (bug-004-dna-set-strips-yaml-comments, task-063). When no provably-minimal edit exists
 *    (see that function's refusal list) it returns `undefined` and this FALLS BACK to the original
 *    `dump(dna, { lineWidth: -1 })` of `setDnaValue`'s in-memory result — correct, but comment-stripping.
 *    Both paths are deterministic (REQ-SYS-07: a pure function of file + key + value; js-yaml preserves
 *    key order, no wall-clock/random; `lineWidth: -1` fixes the wrap width).
 * 4. **Re-validate the written bytes** against `DnaYaml` (spec-002) BEFORE persisting — a schema-invalid
 *    result is a logic error (`VALIDATION` → exit 1) and the file is left untouched (returned, not
 *    thrown). Re-parsing the serialized form (not the in-memory object) is deliberate: it validates the
 *    exact bytes about to be written, honouring YAML's own scalar coercion. The in-place path keeps that
 *    guarantee and strengthens it — `serialized` IS the final file text, and the value token it writes
 *    is rendered by the very same `dump()` call, so e.g. `dna set version 2` still writes `version: '2'`
 *    and still fails `z.number()` on read-back.
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
  const current = readDocument(dnaPath);

  // bug-004: prefer the minimal in-place textual edit, which leaves every comment (and every
  // [SPEC]/[AUTHORING] provenance annotation) byte-for-byte intact; fall back to the whole-file
  // re-serialization only for the shapes it cannot edit minimally and provably.
  const serialized = setDnaValueInText(current, keyPath, value) ?? dump(dna, { lineWidth: -1 });

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
  if (current === serialized) {
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
 * `wingfoil memory search [keyword]` params (P1.5, task-021-implement-memory-search) — reuses
 * task-026's generic bare `ParamsContext.positional` seam for the free-text keyword (mirroring
 * `dna show`'s `section`/`paths`'s `category`) and task-020's value-bearing `ParamsContext.options`
 * seam for the `--tag`/`--status`/`--type` metadata filters (mirroring `memoryAdd`'s `--type`/
 * `--title`/`--tags`). The MCP surface's mechanical zero-argument `wingfoil://memory/search` Resource
 * (spec-006 §3) never populates either field (see `ParamsContext.positional`/`.options`'s own doc
 * comments) — reading it degenerates to the "browse everything, no filter" call {@link memorySearchFn}
 * already treats an omitted keyword as; see this task's Execution Notes for why that is the correct
 * reading of spec-006's already-approved `memorySearch` row, not a workaround.
 */
export interface MemorySearchParams {
  readonly root: string;
  readonly positional?: string;
  readonly options?: Readonly<Record<string, string>>;
}

/**
 * One `wingfoil memory search` result entry — the fields a CLI/MCP consumer needs to identify and
 * open the matched document, without re-reading the file (P1.5; spec-010-memory-frontmatter-schema's
 * base fields). Deliberately drops `searchMemoryDocuments`'s internal `metadataMatch`/`bodyMatch`
 * ranking flags: those exist to DRIVE this task's ordering (REQ-SYS-07), not to be part of its public
 * result shape.
 */
export interface MemorySearchResultItem {
  readonly path: string;
  readonly id?: string;
  readonly title?: string;
  readonly type?: string;
  readonly status?: string;
  readonly tags: readonly string[];
}

/**
 * `memory search` success shape: always the resolved `query` + the ranked `matches`, plus a `message`
 * ONLY when `matches` is empty (P1.5 BDD "Error - query with no matches": zero results is still
 * `coreOk` — exit 0, never a `CoreResult.error` — carrying the exact message "no documents matched the
 * query"). A non-empty result carries no `message` field at all (not an empty string), so a
 * `json`/`yaml` consumer can branch on its mere presence.
 */
export interface MemorySearchResult {
  readonly query: string;
  readonly matches: readonly MemorySearchResultItem[];
  readonly message?: string;
}

const NO_MEMORY_SEARCH_MATCHES_MESSAGE = 'no documents matched the query';

/**
 * `memory search` `CoreOperation.fn` (P1.5, `mutates: false` — the FIRST Memory-document READ
 * operation registered in `CORE_MODULES`; spec-006-core-domain-api §3 memory table pins its MCP
 * exposure to the mechanical zero-argument Resource `wingfoil://memory/search` verbatim, so no gap
 * exists to fill with a richer Resource template — see this task's Execution Notes). Wraps
 * task-008/023's `src/memory/query.ts` primitives — no scan/ranking/validation logic is
 * reimplemented here:
 *
 * 1. **Empty-query guard** ({@link validateSearchQuery}, task-023/P1.12) runs ONLY when the caller
 *    actually supplied a keyword positional (`positional !== undefined`): an explicit empty or
 *    whitespace-only string (e.g. `wingfoil memory search ""`) throws `ValidationError.semantic`
 *    (exit 2, message "empty search query" — `exitCodeForThrow` maps its `exitCode: 2` straight
 *    through, the same throw-path precedent `dnaSetFn`'s `UsageError` set). An OMITTED keyword
 *    (`wingfoil memory search --tag architecture`, P1.5 BDD Scenario "Filter results by metadata
 *    tag") is a DIFFERENT, legitimate case — a tag-only browse, per `searchMemoryDocuments`'s own doc
 *    comment ("browse by tag alone, no keyword" is not an empty query) — so it never reaches the
 *    guard at all, and resolves to `''` below.
 * 2. **Load `memory.yaml`** via the same `loadOrError` + `loadMemoryYaml` path every other read op uses.
 * 3. **Scan + rank** via {@link searchMemoryDocuments} (task-008: deterministic metadata-before-body
 *    ranking, REQ-SYS-07), narrowed by `--tag` through its own `MemorySearchOptions.tag` — the ONE
 *    filter the scan primitive itself understands.
 * 4. **`--type`/`--status` narrow the already-ranked result** — a plain array filter, not a second
 *    scan pass: both are base frontmatter fields every Memory document carries
 *    (spec-010-memory-frontmatter-schema), and `searchMemoryDocuments` already projects both onto
 *    each match (task-021 added `type` alongside the pre-existing `status`), so no extra file read is
 *    needed.
 * 5. **Zero matches is `coreOk`, never `coreErr`** (P1.5 BDD "Error - query with no matches" — the
 *    scenario's own title says "Error" but its assertion is exit `0`, so this is deliberately a
 *    successful, empty result carrying the exact message, per spec-005-cli-command-contract §1: a
 *    read-only command can only exit `0`/`1`).
 *
 * **REQ-STATE-06 (task-038; archived set widened by `dl-028-archived-states-excluded-from-context`):**
 * `searchMemoryDocuments` excludes archived documents — `status: deprecated` or `superseded` — by
 * default (the "default … `memory search` results" half of the Fit Criterion). This function passes
 * `includeArchived: true` through to the scan ONLY when the caller's own `--status` narrow names an
 * archived status (`isArchivedStatus`), so that intentional request still resolves; every other query
 * (no `--status`, or a `--status` naming a live state such as `draft`) stays under the default
 * exclusion.
 */
const memorySearchFn: CoreFn<unknown, MemorySearchResult> = async (params) => {
  const { root, positional, options } = params as MemorySearchParams;

  if (positional !== undefined) validateSearchQuery(positional);
  const query = positional ?? '';

  const loaded: CoreResult<MemoryYaml> = loadOrError(() => loadMemoryYaml(root));
  if (!loaded.ok) return loaded;

  const tag = options?.tag;
  const type = options?.type;
  const status = options?.status;

  const scanned = searchMemoryDocuments(root, loaded.value, query, {
    ...(tag !== undefined ? { tag } : {}),
    ...(isArchivedStatus(status) ? { includeArchived: true } : {}),
  });
  const matches: MemorySearchResultItem[] = scanned
    .filter((match) => (type === undefined || match.type === type) && (status === undefined || match.status === status))
    .map(({ path, id, title, type: docType, status: docStatus, tags }) => ({ path, id, title, type: docType, status: docStatus, tags }));

  return matches.length === 0
    ? coreOk({ query, matches, message: NO_MEMORY_SEARCH_MATCHES_MESSAGE })
    : coreOk({ query, matches });
};

/**
 * `wingfoil memory history <id>` params (P1.10, task-049-memory-history). The document id rides the
 * generic bare `ParamsContext.positional` seam (task-026) — spec-008-cli-grammar §7: a command whose
 * noun already scopes the type takes the **bare `<id>`**, never a `<type>:<id>` element-ref, because
 * ids are globally unique per `memory.yaml`'s `id_pattern`. Optional in the type only because the
 * seam itself is: {@link memoryHistoryFn} rejects an absent id as a usage error (exit 2).
 */
export interface MemoryHistoryParams {
  readonly root: string;
  readonly positional?: string;
}

/**
 * One entry of a document's audit trail as `wingfoil memory history` renders it — exactly the four
 * things `P1.10-memory-history.feature` requires of every entry ("author, ISO-8601 timestamp, state
 * change, and reason"), plus the `sha`/`subject`/`operation` that identify the commit it came from.
 *
 * Every field is derived, never stored: `author`/`timestamp` come from git's own `%an`/`%ae`/`%aI`
 * (ADR-007 / P1.2 — the commit supplies the date, never file content), `from`/`to` from the
 * document's own frontmatter `status:` at each commit, and `approver`/`reason` from the commit body's
 * CLAUDE.md §5.1 trailers. `author` and `approver` are rendered in that same trailer notation
 * (`Name <email>`, `Name <email> (role)`) because P1.10 exists to read exactly that convention back.
 *
 * Two independently-nullable fields, and neither is ever filled in by inference:
 *
 * - `approver` is `null` unless the commit carries a well-formed `Approver:` line — so it is null on
 *   `add`/`submit` (subject-only by convention) and on `deprecate` (not an approval gate).
 * - `reason` is `null` unless the commit carries a `Reason:` line, read independently of `Approver:`
 *   (`parseCommitReason`) so a `deprecate` reason is not lost with the missing approver.
 *
 * `from` is `null` only on the element's creation entry (no prior state to name) — which is what
 * "1 entry describing the creation" in the feature's edge scenario looks like. `to` is `null` only in
 * the documented rename edge case `reconstructMemoryTransitions` describes.
 */
export interface MemoryHistoryEntryView {
  readonly sha: string;
  /** `Name <email>` — git's own author identity for this commit (`%an`/`%ae`). */
  readonly author: string;
  /** ISO-8601 author date (`%aI`), sourced from git, never from the document. */
  readonly timestamp: string;
  /** The CLAUDE.md §5.1 verb this commit's subject declares, or `null` if the subject is not in that shape. */
  readonly operation: string | null;
  /** The state before this commit; `null` on the creation entry. */
  readonly from: string | null;
  /** The state this commit put the document in, read from its frontmatter at that commit. */
  readonly to: string | null;
  /** `Name <email> (role)` from the commit's `Approver:` line, or `null` when it carries none. */
  readonly approver: string | null;
  /** The commit's `Reason:` line, or `null` when it carries none. */
  readonly reason: string | null;
  readonly subject: string;
}

/** `memory history` success shape: the resolved document (`id` + root-relative `path`) and its full
 * audit trail, oldest first ("the output lists N entries in chronological order"). */
export interface MemoryHistoryResult {
  readonly id: string;
  readonly path: string;
  readonly entries: readonly MemoryHistoryEntryView[];
}

/**
 * `memory history` `CoreOperation.fn` (P1.10, `mutates: false`; spec-006-core-domain-api §3 memory
 * table). Composes two existing primitives and reimplements neither — the git walk, the commit-body
 * parse and the per-commit frontmatter read all belong to `src/memory`:
 *
 * 1. **Argument validation** — an absent (or blank) `<id>` is a usage error: `throw new UsageError`
 *    → exit **2** (spec-008-cli-grammar §4/§5, mapped by `exitCodeForThrow`), the same classification
 *    `dna set`'s missing positional gets. Blank is folded in with absent deliberately: `memory
 *    history ""` supplies a positional that names no document, so reporting it as "not found" would
 *    dress a malformed invocation up as a domain outcome (and print an id-less message).
 * 2. **Load `memory.yaml`** through the same `loadOrError` + `loadMemoryYaml` path every read op uses
 *    — it declares the type `path` patterns that bound the id scan (spec-011: no full-repo walk).
 * 3. **Resolve the id to a document** with task-009's {@link findMemoryDocumentById} — an EXACT
 *    frontmatter-`id` match over the deterministically-sorted document set, never a substring (that
 *    is `memory search`'s job). No match is a domain `NOT_FOUND` (exit 1) with the exact P1.10 message
 *    `document not found: <id>`, returned rather than thrown. Archived documents are deliberately NOT
 *    excluded: REQ-STATE-06 scopes its exclusion to default *search* results, and explicitly
 *    guarantees an archived element remains "present on disk and in git history" — which is precisely
 *    what this command reads.
 * 4. **Reconstruct + project the trail** with task-015's `reconstructMemoryTransitions` (`git log
 *    --follow` oldest-first + a `git show` per commit for that commit's frontmatter `status`, plus the
 *    `Approver:`/`Reason:` body parse). This function only renames those fields into
 *    {@link MemoryHistoryEntryView}'s user-facing shape; it derives no state, parses no body, and
 *    reads no clock of its own (REQ-SYS-07 — the whole result is a pure function of the repository).
 *
 * A document that exists on disk but has never been committed yields `entries: []` — correctly, not
 * as an error: per ADR-007 git history IS the audit trail, so an uncommitted document has none yet.
 */
const memoryHistoryFn: CoreFn<unknown, MemoryHistoryResult> = async (params) => {
  const { root, positional: id } = params as MemoryHistoryParams;
  if (id === undefined || id.trim().length === 0) {
    throw new UsageError('missing required argument: memory history <id>');
  }

  const loaded: CoreResult<MemoryYaml> = loadOrError(() => loadMemoryYaml(root));
  if (!loaded.ok) return loaded;

  const found = findMemoryDocumentById(root, loaded.value, id);
  if (!found) {
    return coreErr({ code: 'NOT_FOUND', message: `document not found: ${id}` });
  }

  const entries: MemoryHistoryEntryView[] = reconstructMemoryTransitions(root, found.path).map((transition) => ({
    sha: transition.sha,
    author: `${transition.authorName} <${transition.authorEmail}>`,
    timestamp: transition.date,
    operation: transition.operation,
    from: transition.fromState,
    to: transition.toState,
    approver: transition.approval
      ? `${transition.approval.approverName} <${transition.approval.approverEmail}> (${transition.approval.approverRole})`
      : null,
    reason: transition.reason,
    subject: transition.subject,
  }));

  return coreOk({ id, path: found.path, entries });
};

/**
 * `wingfoil memory submit <id>` params (P1.6, task-045-memory-submit). The document id rides the bare
 * `ParamsContext.positional` seam, per spec-008-cli-grammar §7 (a command whose noun scopes the type
 * takes the bare `<id>`). Optional only because the seam is; an absent id is a usage error.
 */
export interface MemorySubmitParams {
  readonly root: string;
  readonly positional?: string;
}

/** `memory submit` success shape: the document and the transition it went through. */
export interface MemorySubmitResult {
  readonly id: string;
  /** Root-relative path of the submitted document. */
  readonly path: string;
  readonly from: string;
  readonly to: string;
}

/**
 * `memory submit` `CoreOperation.fn` (P1.6, `mutates: true`; spec-006-core-domain-api §3). Submit is
 * "the content is written — move it forward": it commits the document as the author left it, with
 * `status` advanced. Order, every refusal before the single write:
 *
 * 1. **`requireGitIdentity`** (REQ-SEC-01) — exit 1.
 * 2. **`<id>`** absent or blank → `UsageError` (exit 2), as `memory history`.
 * 3. **Load `memory.yaml`** (`loadOrError`).
 * 4. **{@link prepareMemoryTransition}** — not found, unknown type, no machine, invalid state, or an
 *    illegal transition, each a `CoreResult.error` (exit 1); an illegal one carries the pinned
 *    `illegal transition <from> -> <to> for type '<type>'` (`dl-032`, P1.6 sc.2).
 * 5. **Required fields** (spec-010 validation rules) — `title` and every `template.frontmatter.required`
 *    field must be non-empty, else `VALIDATION` `missing required field on submit: <fields>` (exit 1).
 * 6. **Edit + commit** — `status` set to the target and `rejection_reason` removed (spec-010 field-write
 *    ownership; every other byte kept), then one commit scoped to that file, subject
 *    `wf(<type>): submit <id>` with no bracket and no body (spec-004 §4.3). The rendered document is
 *    re-parsed first (`commitMemoryTransition`'s post-condition: `status` is the target, no
 *    `rejection_reason`, nothing else changed); a failure is `VALIDATION` (exit 1) with nothing written. No `--reason`: spec-008 §2
 *    requires it only on the approval gates (`dl-027`).
 */
const memorySubmitFn: CoreFn<unknown, MemorySubmitResult> = async (params) => {
  const { root, positional: id } = params as MemorySubmitParams;

  const identity = requireGitIdentity(root);
  if (!identity.ok) return identity;
  if (id === undefined || id.trim().length === 0) {
    throw new UsageError('missing required argument: memory submit <id>');
  }

  const loaded: CoreResult<MemoryYaml> = loadOrError(() => loadMemoryYaml(root));
  if (!loaded.ok) return loaded;

  const prepared = prepareMemoryTransition(root, loaded.value, id, 'submit');
  if (!prepared.ok) return prepared;
  const { type, path, frontmatter, content, from, to } = prepared.value;

  const required = loaded.value.types[type]?.template?.frontmatter.required ?? [];
  const missing = missingRequiredFields(frontmatter, required);
  if (missing.length > 0) {
    return coreErr({ code: 'VALIDATION', message: `missing required field on submit: ${missing.join(', ')}` });
  }

  const message = formatMemoryCommitMessage({ type, op: 'submit', ids: [id] });
  const rendered = renderSubmitDocument(content, to);
  const committed = commitMemoryTransition(root, prepared.value, rendered, message, { [REJECTION_REASON_FIELD]: undefined });
  if (!committed.ok) return committed;
  return coreOk({ id, path, from, to }, { sha: committed.value, message });
};

/**
 * `wingfoil memory approve <id> --reason <text>` params (P1.7, task-046-memory-approve). The document
 * id rides the bare `ParamsContext.positional` seam (spec-008-cli-grammar §7) and `--reason` the
 * value-bearing `options` seam (`./registry.ts`), the same one `memory add` reads `--type`/`--title`
 * from. Both are optional only because the seams are; {@link memoryApproveFn} refuses either absent.
 */
export interface MemoryApproveParams {
  readonly root: string;
  readonly positional?: string;
  readonly options?: Readonly<Record<string, string>>;
}

/** `memory approve` success shape: the document and the transition it went through. */
export interface MemoryApproveResult {
  readonly id: string;
  /** Root-relative path of the approved document. */
  readonly path: string;
  readonly from: string;
  readonly to: string;
}

/**
 * `memory approve` `CoreOperation.fn` (P1.7, `mutates: true`; spec-006-core-domain-api §3). Approve is
 * the approval gate: it advances `status` across a `gates` edge and records **who** approved, **when**
 * and **why** — identity and reason in the commit body, the ISO-8601 timestamp supplied by git itself
 * (P1.2/P1.10), never written into the message. Order, every refusal before the single write, so
 * "the state is unchanged" (P1.7 sc.2/sc.3) holds by construction:
 *
 * 1. **`requireGitIdentity`** (REQ-SEC-01) — exit 1. It is also the identity the `Approver:` line and
 *    the commit's own author record, so the two can never name different principals.
 * 2. **`<id>`** absent or blank → `UsageError` (exit 2), as `memory submit`/`memory history`.
 * 3. **`requireReason`** (REQ-SEC-04, task-041) → `UsageError` `missing required argument: --reason`
 *    (exit 2, P1.7 sc.2). Placed before any file is read, so an omitted reason touches nothing.
 * 4. **Load `memory.yaml`** (`loadOrError`).
 * 5. **{@link prepareMemoryTransition}** — not found, unknown type, no machine, invalid state, or an
 *    illegal transition, each a `CoreResult.error` (exit 1); an illegal one carries the pinned
 *    `illegal transition <from> -> <to> for type '<type>'` (`dl-032`), whose `<to>` is `approve`'s own
 *    next legal edge (`dl-053`).
 * 6. **`requireApprovalAuthority`** (REQ-SEC-03, task-040) — exit 1 with
 *    `user not authorized to approve type '<type>'` (P1.7 sc.3). It runs after step 5 because its
 *    message interpolates the document's type, which is only knowable once the document is located,
 *    and `findMemoryDocumentById` is a full scan of the registered content roots — resolving the type
 *    twice would double the cost of every approve. Nothing is weakened by the order: the authority
 *    *decision* depends on nothing step 5 computes (adr-006 fixes one uniform `approver` role, keyed
 *    on the git identity), and step 5 writes nothing.
 * 7. **Edit + commit** — `status` set to the target and **nothing else** (spec-010 field-write
 *    ownership: approve changes only `status`; approver and reason live in the commit message). One
 *    commit scoped to that file, subject `wf(<type>): approve <id> [<from> → <to>]` with the mandatory
 *    `Approver:` / `Reason:` body (CLAUDE.md §5.1; `dl-054` confines the bracket to the
 *    approver-gated verbs, which is why `memory submit` has none). `commitMemoryTransition` re-parses
 *    the rendered frontmatter first and refuses (exit 1, nothing written) unless `status` is the
 *    target and no other field's value moved — which is exactly spec-010's "only `status`" rule, so
 *    no extra `expected` entry is needed here.
 */
const memoryApproveFn: CoreFn<unknown, MemoryApproveResult> = async (params) => {
  const { root, positional: id, options } = params as MemoryApproveParams;

  const identity = requireGitIdentity(root);
  if (!identity.ok) return identity;
  if (id === undefined || id.trim().length === 0) {
    throw new UsageError('missing required argument: memory approve <id>');
  }
  const reason = requireReason(options);

  const loaded: CoreResult<MemoryYaml> = loadOrError(() => loadMemoryYaml(root));
  if (!loaded.ok) return loaded;

  const prepared = prepareMemoryTransition(root, loaded.value, id, 'approve');
  if (!prepared.ok) return prepared;
  const { type, path, content, from, to } = prepared.value;

  const dna: CoreResult<DnaYaml> = loadOrError(() => loadDnaYaml(root));
  if (!dna.ok) return dna;
  const authorized = requireApprovalAuthority(root, dna.value, type);
  if (!authorized.ok) return authorized;

  const { name, email } = readGitIdentity(root);
  const message = formatMemoryCommitMessage({
    type,
    op: 'approve',
    ids: [id],
    transition: { from, to },
    approver: { name, email, role: APPROVER_ROLE },
    reason,
  });
  const committed = commitMemoryTransition(root, prepared.value, setFrontmatterField(content, 'status', to), message);
  if (!committed.ok) return committed;
  return coreOk({ id, path, from, to }, { sha: committed.value, message });
};

/**
 * `wingfoil directive create --name <name>` params (P3.1, task-050-directive-create). The name rides
 * task-020's value-bearing `ParamsContext.options` seam (`core/registry.ts`), read as `--name` —
 * NOT the bare positional seam: `X_cli-cmds.md` and the P3.1 BDD both spell the invocation
 * `wingfoil directive create --name <NAME>`. `options` is optional only because the seam itself is;
 * {@link directiveCreateFn} rejects an absent `--name` as a usage error (exit 2).
 */
export interface DirectiveCreateParams {
  readonly root: string;
  readonly options?: Readonly<Record<string, string>>;
}

/**
 * `wingfoil directives list [--role <role>]` params (P3.4, task-053-directives-list). Reuses
 * task-020's value-bearing `ParamsContext.options` seam for the optional `--role` filter, exactly as
 * `memorySearch`'s `--tag`/`--status`/`--type` do. The MCP surface's mechanical zero-argument
 * `wingfoil://directives/list` Resource never populates it (see `ParamsContext.options`), which
 * degenerates to the unfiltered listing — the right default for a Resource that has no per-request
 * parameter.
 */
export interface DirectivesListParams {
  readonly root: string;
  readonly options?: Readonly<Record<string, string>>;
}

/**
 * `directive create` `CoreOperation.fn` (P3.1, `mutates: true` — the FIRST Directives-pillar mutation
 * and the pillar's first CLI verb; spec-006-core-domain-api §3 directives table). Follows `dna set`'s
 * mutating-op template (task-025) exactly, over the Directives pillar instead of `dna.yaml`:
 *
 * 1. **`requireGitIdentity` pre-flight** (REQ-SEC-01, task-014) — refuse before any read/write when
 *    the git identity is unset, returning its `CoreResult.error` unchanged (exit 1).
 * 2. **Argument validation** — both failures are usage errors (`throw new UsageError` → exit **2**,
 *    mapped by `exitCodeForThrow`): an absent `--name` uses spec-008-cli-grammar §4's exact
 *    `missing required argument: --<name>` wording (same as `memoryAdd`), and a non-kebab-case name
 *    uses P3.1's exact `invalid directive name (use kebab-case)` message
 *    ({@link INVALID_DIRECTIVE_NAME_MESSAGE}). Because {@link isValidDirectiveName} runs before any
 *    path is built, a traversal-shaped name (`../x`, `a/b`, `/etc/passwd`) can never reach the write.
 * 3. **Already-exists check** — a file at `.wingfoil/directives/custom/<name>.md` makes this a domain
 *    `CONFLICT` (the input is well-formed; the target is taken), returned NOT thrown, with P3.1's exact
 *    `directive already exists: <name>` message → exit 1 via `exitCodeForError`. Nothing is written, so
 *    the BDD's "no file is overwritten" holds by construction. The check is scoped to `custom/` only,
 *    per `X_cli-cmds.md`'s "Unique within custom directives" — `built-in/` holds package-shipped
 *    templates a user does not author against (spec-011's built-in/custom split).
 * 4. **Render + persist + commit** — {@link renderCustomDirective} produces the whole document as a
 *    pure function of `name` (REQ-SYS-07: no clock, no randomness, so two runs are byte-identical),
 *    satisfying `DirectiveFrontmatter` (spec-013) so the new file loads through `loadDirectives`
 *    alongside the ten `wingfoil init` scaffolds. Then `writeDocument` + `commitPaths` on the ONE
 *    scoped path — exactly one commit, `wf(directive): create <name>` — and the sha rides
 *    `CoreResult.commit`, the same shape `dnaSet` returns for `wf(dna): set <key>`.
 */
const directiveCreateFn: CoreFn<unknown, { name: string; path: string }> = async (params) => {
  const { root, options } = params as DirectiveCreateParams;

  const identity = requireGitIdentity(root);
  if (!identity.ok) return identity;

  const name = options?.name;
  if (name === undefined) throw new UsageError('missing required argument: --name');
  if (!isValidDirectiveName(name)) throw new UsageError(INVALID_DIRECTIVE_NAME_MESSAGE);

  // One spelling of the location, reused for the existence check, the write and the commit scope, so
  // the three can never drift apart. `join` normalizes the separators, so the POSIX form is also the
  // correct absolute path on Windows; the root-relative form is what `commitPaths` stages.
  const relativePath = `.wingfoil/directives/custom/${name}.md`;
  const absolutePath = join(root, relativePath);
  if (documentExists(absolutePath)) {
    return coreErr({ code: 'CONFLICT', message: `directive already exists: ${name}` });
  }

  writeDocument(absolutePath, renderCustomDirective(name));
  const message = `wf(directive): create ${name}`;
  const sha = commitPaths(root, [relativePath], message);
  return coreOk({ name, path: relativePath }, { sha, message });
};

/**
 * `directives list` `CoreOperation.fn` (P3.4, `mutates: false` — spec-006 §3 directives table). Wraps
 * `loadDirectiveListing` (`./directives-list.ts`, which carries the annotation rules and the
 * rationale for not deduplicating shadowed ids) in the same `loadOrError` mapping every read-only
 * pillar query uses, so a schema-invalid directive file or `roles.yaml` is a `VALIDATION` domain
 * failure (exit 1), never a throw.
 *
 * This replaces the bare `wrapReadOnly(loadDirectives)` registration task-006 wired in: the payload
 * keeps every field that registration returned (`path`, `frontmatter`, per entry, unchanged) and adds
 * the role annotation P3.4 requires. Since task-055 (dl-042) the value is `{ entries, warnings }`.
 */
const directivesListFn: CoreFn<unknown, DirectiveListing> = async (params) => {
  const { root, options } = params as DirectivesListParams;
  return loadOrError(() => loadDirectiveListing(root, options?.role));
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
 * (`mutates: true`, P2.1); `memory.memoryAdd` (P1.3, task-020) and `directive.directiveCreate`
 * (P3.1, task-050) have since joined it, and the remaining spec-006 §3 mutating functions
 * (`memorySubmit`, `directiveAssign`, `workflowStart`, ...) are still later tasks' scope. The
 * REQ-SYS-05 parity test in `test/core/parity.test.ts` runs against this exact array, so it is now a
 * live regression guard: each of those mutating ops must appear as both a CLI command and an MCP
 * Tool, or the diff fails.
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
      // P1.10 (task-049-memory-history) — `mutates: false`, so by construction an MCP Resource +
      // CLI command (`wingfoil memory history <id>`). It declares no flags and no value options: the
      // document id rides the generic bare `positional` seam (task-026), per spec-008-cli-grammar §7's
      // bare-`<id>` rule for a command whose noun already scopes the type.
      memoryHistory: { name: 'memoryHistory', mutates: false, fn: memoryHistoryFn },
      // The FIRST Memory-document READ operation (P1.5, spec-006 §3 memory table) — `mutates: false`,
      // so by construction an MCP Resource (`wingfoil://memory/search`, the mechanical zero-argument
      // form spec-006 §3 pins verbatim) + CLI command (`wingfoil memory search`). Its keyword rides the
      // generic bare `positional` seam (task-026); `--tag`/`--status`/`--type` are OPTIONAL value
      // options (task-020's seam) — none is `required`, since the AC/BDD only mandate the bare keyword
      // form and the `--tag` filter (task-021-implement-memory-search's Execution Notes).
      memorySearch: {
        name: 'memorySearch',
        mutates: false,
        options: [{ name: 'tag' }, { name: 'status' }, { name: 'type' }],
        fn: memorySearchFn,
      },
      // P1.6 (task-045-memory-submit) — `mutates: true`: CLI `wingfoil memory submit <id>` + MCP Tool
      // `memory.submit`. The id rides the bare `positional` seam (spec-008 §7); no flags, no options.
      memorySubmit: { name: 'memorySubmit', mutates: true, fn: memorySubmitFn },
      // P1.7 (task-046-memory-approve) — `mutates: true`: CLI `wingfoil memory approve <id> --reason
      // <text>` + MCP Tool `memory.approve`. The id rides the bare `positional` seam (spec-008 §7);
      // `--reason` is the one declared value option, `required` per spec-008 §2 / REQ-SEC-04 (the
      // declaration is metadata — `memoryApproveFn` does the enforcing, via `requireReason`).
      memoryApprove: {
        name: 'memoryApprove',
        mutates: true,
        options: [{ name: 'reason', required: true }],
        fn: memoryApproveFn,
      },
    },
  },
  {
    name: 'directives',
    operations: {
      directivesList: {
        name: 'directivesList',
        mutates: false,
        options: [{ name: 'role' }],
        fn: directivesListFn,
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
  // task-050-directive-create (P3.1). A `directive` (SINGULAR) module, DISTINCT from the `directives`
  // module above, because `CoreModule.name` IS the wire-visible `wingfoil <noun>` segment
  // (`buildCliCommands`, `src/cli/registrar.ts`) and the `{module}.{verb}` MCP Tool name
  // (`deriveMcpToolName`, `src/mcp/registrar.ts`) — and the P3 pillar deliberately exposes TWO nouns:
  // `wingfoil directive create|assign|remove` (BDD P3.1/P3.2/P3.3; spec-008-cli-grammar §1 lists the
  // noun as singular `directive`) alongside `wingfoil directives list` (BDD P3.4). spec-006 §3's own
  // directives table pins both spellings on adjacent rows (`wingfoil directive create` + Tool
  // `directive.create`; `wingfoil directives list` + Resource `wingfoil://directives/list`). Filing
  // `directiveCreate` under the plural module would instead derive `wingfoil directives
  // directive-create` (`deriveVerb` kebab-cases the whole name when it does not start with the module
  // name), contradicting all of the above — so a second module is what realizes the approved contract
  // without touching `deriveVerb` or either registrar. Placed last purely to keep this task's diff off
  // the concurrently-edited `directives` block; `enumerateOperations` sorts, so position is inert.
  {
    name: 'directive',
    operations: {
      // The FIRST Directives-pillar mutation (P3.1) — `mutates: true`, so by construction an MCP Tool
      // (`directive.create`) + CLI command (`wingfoil directive create`), and the third op the
      // REQ-SYS-05 parity test guards (alongside `dna.set` and `memory.add`). `--name` is declared
      // `required` as metadata; `directiveCreateFn` itself enforces it (throwing a `UsageError` →
      // exit 2), matching `memoryAdd`'s `--type`/`--title` precedent.
      directiveCreate: {
        name: 'directiveCreate',
        mutates: true,
        options: [{ name: 'name', required: true }],
        fn: directiveCreateFn,
      },
    },
  },
];
