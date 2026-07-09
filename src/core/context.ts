/**
 * Agent execution context assembly (task-037-role-task-scoped-context, REQ-STATE-05) — the
 * `directive-loader` + a minimal `context-builder` slice of
 * `spec-012-context-loader-relevance-filtering` (§1 "placement & responsibilities", §5 "Directive
 * resolution"). Satisfies REQ-STATE-05's Fit Criterion, verbatim: "The assembled context object
 * exposes separate `dna`, `memory`, `directives` sections; it contains 100% of the role's assigned
 * directives and 0 directives of other roles."
 *
 * Deliberately NOT the full spec-012 pipeline: no `ContextRequest`/`stateRef` pinning, no tiered
 * (T1–T4) Memory relevance ranking, no bounding caps, and no canonical byte-for-byte Markdown
 * serialization (spec-012 §2–§9). Those are split across sibling Wave-1 v0.2 tasks
 * (task-035-bounded-context-relevance REQ-PERF-05, task-038-deprecated-excluded-from-context
 * REQ-STATE-06) and v0.3 (`REQ-SYS-07`, `REQ-PERF-01`, `REQ-STATE-09`, the real `agent execute`
 * CLI/MCP surface) — see this task's Execution Notes for the full scope decision. This module wraps
 * only existing, already-shipped primitives: `loadDirectives`/`loadRolesYaml` (`./loaders`) and
 * `findMemoryDocumentByTypeAndId` (`../memory`, task-011) — no scan/parse logic is reimplemented here.
 */
import { findMemoryDocumentByTypeAndId, type MemoryDocumentSummary } from '../memory';
import type { MemoryYaml } from '../memory/schema';
import type { RolesYaml } from '../directives/schema';
import type { DnaYaml } from '../dna/schema';

import type { DirectiveFile } from './loaders';

/**
 * Resolve the directives bound to `role` — its own `roles.yaml` `assignments[role]` entries plus every
 * `global` directive (spec-012 §5) — deduplicated by directive id and returned **sorted ascending by
 * id** (spec-012 §5: "never rely on `roles.yaml` listing order or file-system enumeration order",
 * REQ-SYS-07). A role absent from `assignments` (e.g. a typo, or a role with no bindings yet) resolves
 * to exactly the global directives, never an error — mirrors P3.6's "role with no directives assigned"
 * edge case (`p3-directives/P3.6-auto-load-by-role.feature`). Directive ids named in `roles.yaml` that
 * do not correspond to any file `directiveFiles` actually loaded are silently skipped, not an error:
 * a dangling binding is a config-hygiene concern for the pillar that authors `roles.yaml`, not this
 * resolver's.
 *
 * This is REQ-STATE-05's Fit Criterion made concrete: for any two distinct roles with disjoint
 * `assignments`, the resolved sets are disjoint too (100% of one role's directives, 0% of the other's).
 */
export function resolveRoleDirectives(
  directiveFiles: readonly DirectiveFile[],
  rolesYaml: RolesYaml,
  role: string,
): DirectiveFile[] {
  const allowedIds = new Set<string>([...(rolesYaml.assignments[role] ?? []), ...rolesYaml.global]);
  // `.filter` already returns a fresh array, so the subsequent in-place `.sort` never mutates the
  // caller's `directiveFiles`. Sort ascending by directive id (spec-012 §5 / REQ-SYS-07): the output
  // order must not depend on `roles.yaml` listing order or file-system enumeration order.
  return directiveFiles
    .filter((file) => allowedIds.has(file.frontmatter.id))
    .sort((a, b) => (a.frontmatter.id < b.frontmatter.id ? -1 : a.frontmatter.id > b.frontmatter.id ? 1 : 0));
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
  /** Memory relevant to `element` — today, exactly the element's own document (0 or 1 entries); the
   * full T1–T4 tiered relevance expansion is task-035/038/v0.3's scope (see the module doc comment). */
  readonly memory: readonly MemoryDocumentSummary[];
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
 * config — a pure function of its inputs: no wall-clock, no randomness, no unordered iteration
 * (REQ-SYS-07's discipline, applied to this narrower slice per REQ-STATE-05's own rationale "crisp,
 * low-noise context; determinism"). Calling this twice with the same inputs and unchanged on-disk
 * Memory content yields deep-equal output (`directives` is sorted by
 * {@link resolveRoleDirectives}; `memory` is a single deterministic lookup, never a scan).
 *
 * `memory` resolves `element` via `findMemoryDocumentByTypeAndId` (task-011-mcp-resources-read-only) —
 * an element that does not exist on disk yields an empty `memory` array, never a thrown error (an
 * unresolvable element is the caller's concern to surface, mirroring that primitive's own
 * never-throws contract).
 */
export function assembleExecutionContext(inputs: ExecutionContextInputs): ExecutionContext {
  const directives = resolveRoleDirectives(inputs.directiveFiles, inputs.rolesYaml, inputs.role);
  const doc = findMemoryDocumentByTypeAndId(inputs.root, inputs.memoryYaml, inputs.element.type, inputs.element.id);
  const memory = doc ? [doc] : [];
  return { dna: inputs.dna, directives, memory };
}
