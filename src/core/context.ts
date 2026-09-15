/**
 * Agent execution context assembly (task-037-role-task-scoped-context, REQ-STATE-05) — the
 * `directive-loader` + a minimal `context-builder` slice of
 * `spec-012-context-loader-relevance-filtering` (§1 "placement & responsibilities", §5 "Directive
 * resolution"). Satisfies REQ-STATE-05's Fit Criterion, verbatim: "The assembled context object
 * exposes separate `dna`, `memory`, `directives` sections; it contains 100% of the role's assigned
 * directives and 0 directives of other roles."
 *
 * **Archived elements are excluded** (REQ-STATE-06, the `{deprecated, superseded}` set ratified by
 * `dl-028-archived-states-excluded-from-context`): {@link assembleExecutionContext} drops a resolved
 * element whose `status` is archived, through the shared `isArchivedStatus` primitive rather than any
 * local notion of "archived". This closed `bug-010-deprecated-reaches-agent-context` — which this
 * header previously recorded as an open gap — together with the `wingfoil://memory/{type}` collection
 * Resource, the other surface that bug covered (`task-069-fix-archived-excluded-from-agent-context`).
 *
 * Still deliberately NOT the full spec-012 pipeline: no `ContextRequest`/`stateRef` pinning, no tiered
 * (T1–T4) Memory relevance ranking, no bounding caps, and no canonical byte-for-byte Markdown
 * serialization (§7). Those are split across sibling Wave-1 v0.2 tasks
 * (task-035-bounded-context-relevance REQ-PERF-05, task-038-deprecated-excluded-from-context
 * REQ-STATE-06) and v0.3 (`REQ-SYS-07`, `REQ-PERF-01`, `REQ-STATE-09`, the real `agent execute`
 * CLI/MCP surface) — see this task's Execution Notes for the full scope decision. This module wraps
 * only existing, already-shipped primitives: `loadDirectives`/`loadRolesYaml` (`./loaders`),
 * `findMemoryDocumentByTypeAndId` and `isArchivedStatus` (`../memory`, task-011/task-035) — no
 * scan/parse logic and no second status predicate is reimplemented here.
 */
import { findMemoryDocumentByTypeAndId, isArchivedStatus, type MemoryDocumentSummary } from '../memory';
import type { MemoryYaml } from '../memory/schema';
import type { RolesYaml } from '../directives/schema';
import type { DnaYaml } from '../dna/schema';

import type { DirectiveFile } from './loaders';

/**
 * The outcome of {@link resolveRoleDirectives}: the resolved directive files **and** any operator
 * diagnostics produced while resolving them.
 *
 * `warnings` is returned rather than written to `stderr` (or to a logger) on purpose: this is a
 * context-building path, where REQ-SYS-07 requires the output to be a pure function of the inputs.
 * A returned array keeps the diagnostic deterministic, unit-testable without capturing process
 * streams, and free for the eventual CLI/MCP surface (`task-055-auto-load-directives-by-role`) to
 * render however that surface renders warnings.
 */
export interface RoleDirectiveResolution {
  /** Deduplicated by directive id and sorted ascending by id — see {@link resolveRoleDirectives}. */
  readonly directives: readonly DirectiveFile[];
  /** Operator diagnostics, in a fixed order. Empty when the role's bindings are unremarkable. */
  readonly warnings: readonly string[];
}

/** `assignments` is a plain object parsed from YAML, so a role named `toString`, `constructor`,
 * `valueOf`, `hasOwnProperty` or `__proto__` would otherwise resolve to an inherited
 * `Object.prototype` member instead of `undefined`. Read own properties only. */
function ownAssignments(rolesYaml: RolesYaml, role: string): readonly string[] | undefined {
  return Object.prototype.hasOwnProperty.call(rolesYaml.assignments, role)
    ? rolesYaml.assignments[role]
    : undefined;
}

/**
 * Resolve the directives bound to `role` — its own `roles.yaml` `assignments[role]` entries plus every
 * `global` directive — per `spec-012-context-loader-relevance-filtering` §5 and
 * `dl-029-role-with-no-directive-assignments` (`ready`, option (c)).
 *
 * Behaviour, point by point:
 *
 * - **Globals are unconditional** (spec-012 §5). Every role gets them, including a role with no
 *   bindings of its own — globals exist precisely so that no role can be configured out of
 *   `security-secrets` (dl-029, Rationale).
 * - **A role that contributes no assignments of its own** — absent from `assignments`, or bound to an
 *   explicitly empty list — resolves to exactly the globals **and** produces the warning
 *   `no directives assigned to role '<role>'`. This is dl-029's ratified hybrid, and it is the
 *   behaviour the edge scenario of `p3-directives/P3.6-auto-load-by-role.feature` now specifies
 *   ("the agent context contains only the global directives" + that warning). Never an error.
 *   Role-name lookup reads **own** properties only, so a role named after an `Object.prototype`
 *   member (`toString`, `constructor`, …) is treated as unbound like any other unknown role.
 * - **Deduplicated by directive id** (spec-012 §5): if two loaded files carry the same
 *   `frontmatter.id` — the built-in/custom overlap the P3.8 stand-ins will produce — exactly one is
 *   returned. The tie-break keeps the file with the lexicographically smallest `path`, which makes
 *   the choice a total, input-order-independent function of the loaded set. spec-012 defines no
 *   built-in-vs-custom *override* precedence, so none is invented here; a duplicated id is a
 *   config-hygiene problem for whoever authors the directives tree.
 * - **Sorted ascending by directive id** (spec-012 §5: "never rely on `roles.yaml` listing order or
 *   file-system enumeration order", REQ-SYS-07).
 * - Directive ids named in `roles.yaml` with no corresponding file in `directiveFiles` are silently
 *   skipped, not an error: a dangling binding is a config-hygiene concern for the pillar that authors
 *   `roles.yaml`, not this resolver's.
 *
 * This is REQ-STATE-05's Fit Criterion made concrete: for any two distinct roles with disjoint
 * `assignments`, the resolved sets are disjoint too (100% of one role's directives, 0% of the other's).
 */
export function resolveRoleDirectives(
  directiveFiles: readonly DirectiveFile[],
  rolesYaml: RolesYaml,
  role: string,
): RoleDirectiveResolution {
  const assigned = ownAssignments(rolesYaml, role);
  const warnings = assigned === undefined || assigned.length === 0
    ? [`no directives assigned to role '${role}'`]
    : [];

  const allowedIds = new Set<string>([...(assigned ?? []), ...rolesYaml.global]);

  // Deduplicate by directive id (spec-012 §5), keeping the smallest `path` so the winner does not
  // depend on the order `directiveFiles` happens to arrive in.
  const byId = new Map<string, DirectiveFile>();
  for (const file of directiveFiles) {
    const id = file.frontmatter.id;
    if (!allowedIds.has(id)) continue;
    const incumbent = byId.get(id);
    if (incumbent === undefined || file.path < incumbent.path) byId.set(id, file);
  }

  // Sort ascending by directive id (spec-012 §5 / REQ-SYS-07): the output order must not depend on
  // `roles.yaml` listing order or file-system enumeration order. `byId` is keyed by directive id, so
  // the comparator never sees two equal keys and a strict two-way compare is total here.
  const directives = [...byId].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, file]) => file);

  return { directives, warnings };
}

/** The active Memory element an execution context is scoped to (spec-012 §2 `ContextRequest.element`,
 * narrowed here to just `type`/`id` — this task does not implement the full `ContextRequest` shape). */
export interface ExecutionContextElement {
  readonly type: string;
  readonly id: string;
}

/**
 * The assembled execution context (REQ-STATE-05 Fit Criterion, P5.4.4 "a context object containing
 * distinct DNA, Memory, and Directives sections", "each section is individually addressable"): three
 * plain, independently-readable properties — `context.dna`, `context.memory`,
 * `context.directives` — never merged into one flat structure.
 */
export interface ExecutionContext {
  /** The full parsed `dna.yaml` (P5.4.4: DNA section — this task does not sub-select DNA sections by
   * scope, unlike spec-012 §4's full `dna-loader`; that selection logic is out of this task's scope). */
  readonly dna: DnaYaml;
  /** This role's assigned directives + global, resolved by {@link resolveRoleDirectives}. */
  readonly directives: readonly DirectiveFile[];
  /** Memory relevant to `element` — today, exactly the element's own document (0 or 1 entries), and
   * empty when that document is archived (REQ-STATE-06; see {@link assembleExecutionContext}); the
   * full T1–T4 tiered relevance expansion is task-035/038/v0.3's scope (see the module doc comment). */
  readonly memory: readonly MemoryDocumentSummary[];
  /** Operator diagnostics gathered during assembly — currently only
   * {@link RoleDirectiveResolution.warnings} (dl-029). Diagnostics *about* the context, not content
   * *of* it: spec-012 §7's canonical envelope has no warnings section, so this never enters the
   * serialized payload. */
  readonly warnings: readonly string[];
}

/** Inputs to {@link assembleExecutionContext} — every pillar's config, already loaded by its own
 * loader (`./loaders.ts`), plus the `role`/`element` the context is being assembled for. Nothing here
 * reads the filesystem itself beyond resolving `element` via `findMemoryDocumentByTypeAndId`. */
export interface ExecutionContextInputs {
  /** Project root the Memory element lookup resolves against (same root the pillar loaders were
   * called with). */
  readonly root: string;
  readonly dna: DnaYaml;
  readonly memoryYaml: MemoryYaml;
  readonly directiveFiles: readonly DirectiveFile[];
  readonly rolesYaml: RolesYaml;
  readonly role: string;
  readonly element: ExecutionContextElement;
}

/**
 * Assemble a role- and task-scoped {@link ExecutionContext} (REQ-STATE-05) from already-loaded pillar
 * config. Given the same inputs and unchanged on-disk Memory content, the output is deep-equal across
 * calls: the function itself introduces no wall-clock, randomness, or unordered iteration
 * (REQ-SYS-07's discipline, applied to this narrower slice per REQ-STATE-05's own rationale "crisp,
 * low-noise context; determinism"), and `directives` is totally ordered by
 * {@link resolveRoleDirectives}.
 *
 * `memory` resolves `element` via `findMemoryDocumentByTypeAndId`
 * (`task-011-mcp-resources-read-only`). Two properties of that primitive are inherited here and are
 * worth stating plainly:
 *
 * - It is **not** a single addressed read. It walks the Memory document paths derived from
 *   `memoryYaml` in sorted order and YAML-parses each document's frontmatter until one matches
 *   `element.type`/`element.id`, so cost grows with the size of the Memory tree (bounding that is
 *   `task-035-bounded-context-relevance`'s REQ-PERF-05 scope, not this task's).
 * - It therefore **can throw**. An `element` that matches nothing yields an empty `memory` array
 *   rather than an error — an unresolvable element is the caller's concern to surface — but a
 *   `ValidationError` (`E_YAML_PARSE_ERROR`) propagates out of assembly if any document visited
 *   during that walk has unparseable frontmatter. This function adds no `try`/`catch` of its own.
 *
 * `memory` **is** filtered by document status, in one direction only: a resolved element whose
 * `status` is archived — `{deprecated, superseded}`, per the shared {@link isArchivedStatus}
 * (`../memory`, the set ratified by `dl-028-archived-states-excluded-from-context`) — is dropped,
 * leaving `memory` empty. That is REQ-STATE-06's Fit Criterion as amended: "a `deprecated` or
 * `superseded` document never appears in an assembled agent context". The filter is applied to the
 * lookup's *result* rather than pushed into `findMemoryDocumentByTypeAndId`, because that same
 * primitive also serves `wingfoil://memory/{type}/{id}`, where explicit retrieval of archived content
 * must keep working.
 *
 * `draft` is deliberately **not** excluded here, unlike in `./relevance.ts`. That module filters
 * *candidate* documents for relevance (spec-012 §6, which does bar `draft` from a context); this
 * function resolves the **subject** element the context is being assembled for (spec-012 §3's
 * `resolve-element` stage), and blanking the context for a task still in `draft` would defeat the
 * point of assembling it. dl-028 ratified the archived set as `{deprecated, superseded}` and did not
 * put `draft` in it.
 *
 * An archived element produces no warning: {@link ExecutionContext.warnings} carries
 * directive-resolution diagnostics (dl-029), and adding an unratified entry would change a payload
 * REQ-SYS-07 governs. An archived element is therefore indistinguishable here from an unresolvable
 * one — both yield `memory: []`.
 */
export function assembleExecutionContext(inputs: ExecutionContextInputs): ExecutionContext {
  const { directives, warnings } = resolveRoleDirectives(inputs.directiveFiles, inputs.rolesYaml, inputs.role);
  const doc = findMemoryDocumentByTypeAndId(inputs.root, inputs.memoryYaml, inputs.element.type, inputs.element.id);
  // `frontmatter` is untyped (`Record<string, unknown>`), so project `status` to the
  // `string | undefined` shape `isArchivedStatus` takes — a non-string `status` is never archived,
  // exactly as that predicate's contract states.
  const status = typeof doc?.frontmatter.status === 'string' ? doc.frontmatter.status : undefined;
  const memory = doc !== undefined && !isArchivedStatus(status) ? [doc] : [];
  return { dna: inputs.dna, directives, memory, warnings };
}
