/**
 * State-machine transition-legality engine (REQ-SYS-04, task-005-per-type-state-machines).
 *
 * task-004-decoupled-pillars already shipped the *structural* `StateMachine` Zod schema in
 * `./schema.ts` — the `sequence`/`gates`/`waiting` shape plus a `.superRefine()` enforcing
 * spec-001-memory-yaml-schema's "Semantic validation (post-parse)" rules (gates/waiting keys must be
 * members of `sequence`, `"deprecated"` is reserved, etc.). This module does NOT re-validate any of
 * that — it takes an already-parsed, already-structurally-valid `StateMachine` and answers a
 * different question: **given a document's current `status` and a requested CLI verb
 * (`submit`/`approve`/`reject`/`deprecate`), what is the legal target state, if any?**
 *
 * This is spec-009-validation-strategy §1's Pass 2 (semantic / cross-file): the transition rule
 * needs the type's registered machine (loaded from `memory.yaml`) plus the document's own `status`
 * field — neither is decidable from the document's frontmatter schema alone, matching spec-009's own
 * worked example ("`wingfoil.status` must be a member of that type's `states.values`"). An illegal
 * transition throws the shared `ValidationError` via `ValidationError.semantic(...)` (exit code 2,
 * spec-009 §3) and — critically — throws *before* returning any target, so a caller can never reach
 * the frontmatter-write step on an illegal transition (REQ-STATE-01: rejected before any file write).
 * This module never touches a document or the filesystem itself; it is a pure function of
 * (`machine`, `currentState`, `op`) → target-or-throw, and it is the caller's job to gate any actual
 * write on this function returning normally.
 *
 * Rules implemented below (spec-001-memory-yaml-schema, "Sub-schema: StateMachine" +
 * "Which verb drives each forward edge — fully determined by the schema" + "`deprecated` is
 * implicit"):
 *
 * - `submit`: legal only from a state that is in `sequence`, is NOT a `gates` key, and is NOT in
 *   `waiting`, and that has a next state in `sequence`. Target: the next state in `sequence`.
 * - `approve`: legal only from a state that IS a `gates` key and is NOT also in `waiting` (a state
 *   that is both is spec-001's explicit "verb-less" case: "its forward edge is verb-less (picked up
 *   automatically)" — the manual `approve` verb does not apply, only the manual `reject` does).
 *   Target: the next state in `sequence`.
 * - `reject`: legal only from a state that IS a `gates` key (regardless of `waiting` membership —
 *   spec-001: a gate+waiting state "still exposes a manual `reject`/decline path"). Target:
 *   `gates[<state>].reject`, always taken verbatim (it need not be a `sequence` member).
 * - `deprecate`: the implicit wildcard edge — always legal from any current state, target is the
 *   reserved `"deprecated"` state. Never declared in `sequence`/`gates`/`waiting` (enforced
 *   structurally by task-004's `.superRefine()`; this engine does not need to re-check it).
 * - Anything else (state not a member of `sequence` at all, wrong verb for the state's category, or
 *   a `sequence`-terminal state with no next entry) is illegal.
 *
 * **Type resolution (REQ-STATE-08):** `resolveStateMachine` resolves a type's machine as
 * `types.<name>.states ?? defaults.states`. task-005's own tests exercise only the real 7 types
 * registered in `docs/self/.wingfoil/memory.yaml`, every one of which declares its own `states`
 * block — so the fallback (`?? defaults.states`) and the "neither declares a machine" throw below
 * were left genuinely uncovered by that task. task-010-default-state-machine-fallback closes that
 * gap with a throwaway fixture type (declared with no `states:` key) in
 * `test/memory/state-machine.test.ts`, proving the fallback end-to-end without any change needed
 * here — the resolution logic below already implemented REQ-STATE-08 correctly.
 */
import { ValidationError } from '../validation';

import type { MemoryYaml, StateMachine } from './schema';

/** The reserved implicit-wildcard target state (spec-001) — never declared explicitly anywhere. */
export const DEPRECATED_STATE = 'deprecated';

/**
 * The terminal state of the `adr` and `tech-spec` machines (`memory.yaml`): reached along the forward
 * `sequence` by `approve`, never by `memory deprecate`. A superseded decision is archived content — a
 * later element explicitly replaced it — which is why `dl-028-archived-states-excluded-from-context`
 * puts it in {@link ARCHIVED_STATUSES} alongside {@link DEPRECATED_STATE}.
 */
export const SUPERSEDED_STATE = 'superseded';

/**
 * The canonical **archived** status set, ratified by `dl-028-archived-states-excluded-from-context`:
 * exactly `{deprecated, superseded}`, in this fixed order (REQ-SYS-07 — no unordered iteration in any
 * output-affecting path).
 *
 * REQ-STATE-06's Rationale ("distinguish active from archived decisions") always named the archived
 * set, but its Description and Fit Criterion named only `deprecated`; dl-028 closes that gap and the
 * SARD entry now names both. The previously-specified `rejected` is **not** here: `spec-001-memory-yaml-schema`
 * removed that status from every type's machine (a `reject` transition lands back on `draft`), so it
 * can never appear in a document's frontmatter.
 */
export const ARCHIVED_STATUSES: readonly string[] = Object.freeze([DEPRECATED_STATE, SUPERSEDED_STATE]);

/**
 * True when a document's frontmatter `status` is an archived state ({@link ARCHIVED_STATUSES}).
 *
 * This is the **single shared predicate** dl-028 mandates: both the default-search path
 * (`searchMemoryDocuments`, REQ-STATE-06) and the agent-context path (`src/core/relevance.ts`'s
 * relevance filter, spec-012 §6) consume it, so "archived" has exactly one definition. It supersedes
 * `task-038`'s `isDeprecatedStatus`.
 *
 * It takes the **already-parsed status string**, not the raw frontmatter record: every call site
 * projects `status` out of frontmatter anyway (for its own result shape), and a frontmatter-shaped
 * predicate forced those callers either to re-parse or to hand back a record they had already
 * destructured — the composition problem `task-038`'s reviewer flagged. Non-string / absent `status`
 * values are normalised to `undefined` by the caller's own frontmatter projection and are never
 * archived.
 *
 * Note the deliberate asymmetry with the *context* filter: `src/core/relevance.ts` excludes
 * `draft` **in addition to** this archived set (spec-012 §6 — only "stable, decided and still-current"
 * content enters an execution context), while default `memory search` keeps drafts visible.
 * `draft` is therefore NOT part of the archived set.
 */
export function isArchivedStatus(status: string | undefined): boolean {
  return status !== undefined && ARCHIVED_STATUSES.includes(status);
}

/** `E_INVALID_<X>` field-level code (spec-009 §3) for an illegal state transition. */
export const E_INVALID_TRANSITION = 'E_INVALID_TRANSITION';

/** The four CLI verbs a transition can be requested for (`memory.add` assigns `sequence[0]` directly, no verb). */
export type TransitionOp = 'submit' | 'approve' | 'reject' | 'deprecate';

/**
 * Resolve the state machine that governs `typeName`, per REQ-STATE-08: the type's own `states`
 * block if declared, else `defaults.states`. Throws a plain `Error` (not `ValidationError` — this is
 * a caller-programming-error / config-integrity condition, not a document-transition failure) if the
 * type is not registered at all, or if neither the type nor `defaults` declares a machine.
 */
export function resolveStateMachine(memoryYaml: MemoryYaml, typeName: string): StateMachine {
  const typeEntry = memoryYaml.types[typeName];
  if (!typeEntry) {
    throw new Error(`memory.yaml has no type "${typeName}" registered`);
  }
  const resolved = typeEntry.states ?? memoryYaml.defaults?.states;
  if (!resolved) {
    throw new Error(
      `type "${typeName}" declares no \`states\` block and \`defaults.states\` is not set (REQ-STATE-08)`,
    );
  }
  return resolved;
}

/** Build one `E_INVALID_TRANSITION` `ValidationError` (Pass 2, spec-009 §3 — exits 2) and throw it. */
function illegal(currentState: string, op: TransitionOp, message: string, filePath: string): never {
  throw ValidationError.semantic([
    {
      code: E_INVALID_TRANSITION,
      path: 'status',
      file: filePath,
      message: `illegal \`${op}\` from "${currentState}": ${message}`,
    },
  ]);
}

/**
 * Compute the legal target state for `op` applied to `currentState` under `machine`. Returns the
 * target state on success; throws `ValidationError` (never returns a target) when the transition is
 * illegal, per REQ-STATE-01 — a caller must never write a document's `status` unless this function
 * returns normally. `filePath` is only used to enrich the thrown error's `file` field (optional —
 * defaults to `''` when no document is on hand, e.g. in pure unit tests).
 */
export function resolveTransitionTarget(
  machine: StateMachine,
  currentState: string,
  op: TransitionOp,
  filePath = '',
): string {
  if (op === 'deprecate') {
    // Implicit wildcard edge from any state (spec-001) — always legal, never declared explicitly.
    return DEPRECATED_STATE;
  }

  const index = machine.sequence.indexOf(currentState);
  const gate = (machine.gates ?? {})[currentState];
  const isWaiting = (machine.waiting ?? []).includes(currentState);

  switch (op) {
    case 'submit': {
      if (index === -1) {
        return illegal(currentState, op, "not a member of this type's `sequence`", filePath);
      }
      if (gate) {
        return illegal(currentState, op, 'a `gates` state — its forward edge requires `approve`, not `submit`', filePath);
      }
      if (isWaiting) {
        return illegal(
          currentState,
          op,
          'a `waiting` state — its forward edge fires only via a Workflow action, not `submit`',
          filePath,
        );
      }
      const next = machine.sequence[index + 1];
      if (next === undefined) {
        return illegal(currentState, op, 'the last state in `sequence` — there is no forward edge', filePath);
      }
      return next;
    }
    case 'approve': {
      if (!gate) {
        return illegal(currentState, op, 'not a `gates` state — `approve` is only legal from a gate', filePath);
      }
      if (isWaiting) {
        return illegal(
          currentState,
          op,
          'both a `gates` and `waiting` state — its forward edge is verb-less (fires only via a Workflow action), not `approve`',
          filePath,
        );
      }
      const next = machine.sequence[index + 1];
      if (next === undefined) {
        return illegal(currentState, op, 'a `gates` state with no next `sequence` entry to approve into', filePath);
      }
      return next;
    }
    case 'reject': {
      if (!gate) {
        return illegal(currentState, op, 'not a `gates` state — `reject` is only legal from a gate', filePath);
      }
      // `reject` target is taken verbatim — need not be a `sequence` member (spec-001).
      return gate.reject;
    }
    default: {
      const exhaustive: never = op;
      return illegal(currentState, exhaustive, 'unknown operation', filePath);
    }
  }
}
