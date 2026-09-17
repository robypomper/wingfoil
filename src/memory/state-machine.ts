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
 * transition throws the shared `ValidationError` (exit code `1` — a business-rule failure, not an
 * integrity one, per spec-009 §3 as rewritten under `dl-032-illegal-transition-message-contract`)
 * and — critically — throws *before* returning any target, so a caller can never reach
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
 * task-036-frontmatter-lifecycle-validation adds {@link validateFrontmatterState} — a distinct check
 * from the transition engine above: REQ-STATE-01's "document state derived from frontmatter" half,
 * independent of any transition attempt. `resolveTransitionTarget` only answers "is verb `op` legal
 * FROM `currentState`"; it never asserts that an arbitrary `status` string read off a document's
 * frontmatter is itself a member of the type's declared state set at all — the check
 * spec-010-memory-frontmatter-schema's "Validation rules" table names ("`status` must be a value in
 * the type's `states.values`" → failure "invalid state for type") and BDD
 * `P4.11-deliverables.feature`/`P4.13-state-deduction.feature` both exercise (`"invalid state
 * 'shipped' for type 'task'"`). A state is legal for a type iff it belongs to that machine's full
 * reachable set — `sequence` ∪ every `gates.<state>.reject` target (spec-001 permits those to be
 * off-chain, and `resolveTransitionTarget` returns them verbatim) ∪ the reserved implicit
 * `"deprecated"` state (never declared in `sequence` itself, per the `StateMachine` schema's own
 * `.superRefine()`, but always a legal transition target via `memory.deprecate` — see
 * `resolveTransitionTarget`'s `deprecate` case above).
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

/**
 * `E_INVALID_<X>` field-level code (spec-009 §3, spec-010-memory-frontmatter-schema "Validation
 * rules") for a document frontmatter `status` value that is not a legal state for its declared type
 * at all — as opposed to {@link E_INVALID_TRANSITION}, which flags an illegal *transition attempt*
 * (verb + current state), not the current state's bare legality. See {@link validateFrontmatterState}.
 */
export const E_INVALID_STATE = 'E_INVALID_STATE';

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

/**
 * Build one `E_INVALID_TRANSITION` `ValidationError` and throw it. Exits `1`: an illegal transition is
 * understood input that a rule refused, not a parse/integrity failure (spec-009 §3, `dl-032`) — so the
 * plain constructor, not `ValidationError.semantic(...)`. The message here is the type-agnostic
 * diagnostic; {@link resolveTypeTransition} turns it into the pinned contract message.
 */
function illegal(currentState: string, op: TransitionOp, message: string, filePath: string): never {
  throw new ValidationError([
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

/** What the contract message prints for `<to>` when a verb has no legal edge anywhere in the machine. */
const NO_TARGET = '(none)';

/**
 * The `<to>` of the illegal-transition contract message: the verb's **canonical edge** for this type —
 * the target `op` reaches from the first state, in `sequence` order, from which `op` is legal (for
 * `submit` on `task` or on the default machine: `pending`; on `release`: `planning`). A verb names no
 * target of its own, so the message needs a rule; this one reproduces the string BDD `P1.6` sc.2 and
 * `P5.2.3` sc.2 pin (`approved -> pending` for `task`) on both the default machine and the real `task`
 * machine, where the literal forward edge out of `approved` is `done`. Two refinements keep the message
 * honest: when that canonical target IS `currentState` it would print a self-loop, so the next state in
 * `sequence` is named instead; when the machine has no legal edge for `op` at all, `(none)`.
 * A pure function of `(machine, currentState, op)` walked in `sequence` order (REQ-SYS-07).
 */
function contractTarget(machine: StateMachine, currentState: string, op: TransitionOp): string {
  let canonical: string | undefined;
  for (const state of machine.sequence) {
    try {
      canonical = resolveTransitionTarget(machine, state, op);
      break;
    } catch {
      // not legal from this state — keep walking the chain
    }
  }
  if (canonical !== currentState) return canonical ?? NO_TARGET;
  const index = machine.sequence.indexOf(currentState);
  return machine.sequence[index + 1] ?? NO_TARGET;
}

/**
 * Resolve the legal target of verb `op` for a document of type `typeName` currently in `currentState`
 * — the entry point every Memory transition verb (`submit`, and `approve`/`reject`/`deprecate` after
 * it) uses. It resolves the type's machine ({@link resolveStateMachine}, REQ-STATE-08) and delegates
 * legality to {@link resolveTransitionTarget}, adding only the user-facing contract:
 *
 * An illegal transition is rethrown as the `E_INVALID_TRANSITION` issue ratified by
 * `dl-032-illegal-transition-message-contract` (option (c)) — `message` is the pinned
 * `` illegal transition <from> -> <to> for type '<type>' `` (REQ-STATE-01 Fit Criterion; BDD `P1.6`
 * sc.2, `P5.2.3` sc.2), `detail` carries the engine's explanation of *why* the edge is illegal, and the
 * exit code is `1`. `<to>` is computed by {@link contractTarget}.
 *
 * @throws {@link ../validation.ValidationError} `E_INVALID_TRANSITION` (exit `1`) as above.
 * @throws `Error` when `typeName` is not registered or no machine applies (see {@link resolveStateMachine}).
 */
export function resolveTypeTransition(
  memoryYaml: MemoryYaml,
  typeName: string,
  currentState: string,
  op: TransitionOp,
  filePath = '',
): string {
  const machine = resolveStateMachine(memoryYaml, typeName);
  try {
    return resolveTransitionTarget(machine, currentState, op, filePath);
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    const detail = error.issues.map((issue) => issue.message).join('; ');
    throw new ValidationError([
      {
        code: E_INVALID_TRANSITION,
        path: 'status',
        file: filePath,
        message: `illegal transition ${currentState} -> ${contractTarget(machine, currentState, op)} for type '${typeName}'`,
        detail,
      },
    ]);
  }
}

/**
 * True when `status` is a state a document of this type may legitimately carry — the **full**
 * reachable state set of `machine`, which is the union of three sources:
 *
 * 1. **`machine.sequence`** — every state on the forward chain.
 * 2. **Every `machine.gates.<state>.reject` target** — `resolveTransitionTarget` returns these
 *    *verbatim* and spec-001-memory-yaml-schema's "Semantic validation (post-parse)" is explicit that
 *    such a target "need **not** be a member of `sequence`: it may revert into the chain (e.g.
 *    `pending: { reject: draft }`) or name an **off-chain decline state reached by no forward edge**".
 *    Only the gate *keys* (and `waiting` entries) are constrained to `sequence`; the reject targets
 *    are not. Omitting this arm is what task-036's first pass got wrong: the `reject` verb would write
 *    a status that this very function then declared invalid, leaving the document unmovable —
 *    a REQ-SYS-04 violation for a config shape spec-001 names by example. No type registered in
 *    `docs/self/.wingfoil/memory.yaml` currently exercises it (all three of its reject targets —
 *    `draft`, `closed`, `in-progress` — happen to be `sequence` members), so it is covered by a
 *    synthetic fixture machine in `test/memory/state-machine.test.ts`.
 * 3. **{@link DEPRECATED_STATE}** — the reserved implicit wildcard target every type reaches via
 *    `memory.deprecate` (see {@link resolveTransitionTarget}'s `deprecate` case), never declared in
 *    any `sequence` (the `StateMachine` schema's own `.superRefine()` forbids declaring it).
 *
 * `machine.waiting` contributes nothing: every `waiting` entry is required to be a `sequence` member
 * already, so it is covered by (1).
 *
 * Iteration over `gates` is sorted (REQ-SYS-07 — no unordered iteration in any output-affecting path);
 * the predicate's boolean result is order-independent, but keeping the traversal deterministic keeps
 * it so under any future change that reports *which* source matched.
 */
function isDeclaredState(machine: StateMachine, status: string): boolean {
  if (status === DEPRECATED_STATE || machine.sequence.includes(status)) {
    return true;
  }
  const gates = machine.gates ?? {};
  return Object.keys(gates)
    .sort()
    .some((gateState) => gates[gateState]?.reject === status);
}

/**
 * Assert that `status` — a value read straight off a document's frontmatter — is a legal state for
 * `typeName` under `machine` (REQ-STATE-01: state is derived from frontmatter; spec-010's "Validation
 * rules": *"`status` must be a value in the type's `states.values`"*). The legal set is exactly
 * {@link isDeclaredState}'s: `sequence` ∪ every `gates.<state>.reject` target ∪ `deprecated`.
 *
 * This is a distinct check from {@link resolveTransitionTarget}: that function asks "is verb `op`
 * legal FROM `currentState`", assuming `currentState` is already known-legal; this function asks
 * whether an arbitrary `status` string is itself a legal state for the type at all — independent of
 * any transition attempt, e.g. when validating a document's frontmatter as read (BDD
 * `P4.11-deliverables.feature` scenario 3, `P4.13-state-deduction.feature` scenario 3). The two must
 * agree: any state `resolveTransitionTarget` can return must validate here, or the tool would refuse
 * a document it wrote itself.
 *
 * @throws {@link ../validation.ValidationError} `E_INVALID_STATE` with the message
 *   `` invalid state '<status>' for type '<typeName>' `` when `status` is not a legal state for
 *   `typeName`. **Exit code `1`**, per spec-009-validation-strategy §3 as rewritten under
 *   `dl-032-illegal-transition-message-contract`: the code keys on the *nature* of the failure, not
 *   the pass that detected it — `2` is reserved for parse and system-integrity failures, while "every
 *   other validation failure ... including business-rule failures detected in Pass 2" exits `1`. An
 *   unrecognised `status` is understood input that a rule refused, so it is a `1`; that is why this
 *   throws the `ValidationError` constructor directly rather than `ValidationError.semantic(...)`,
 *   which hard-codes `2` for the genuine integrity checks (`loaders`, `id`, `query`). No BDD scenario
 *   pins an exit code for this message — `P4.11` sc.3 and `P4.13` sc.3 pin the text only — so the spec
 *   rule governs unopposed. (The separate `E_INVALID_TRANSITION` message/exit-code realignment that
 *   `dl-032` ratified lives in {@link resolveTypeTransition}, added by `task-045-memory-submit`.)
 *
 *   `filePath` is only used to enrich the thrown error's `file` field (optional — defaults to `''`
 *   when no document is on hand, e.g. in pure unit tests), mirroring {@link resolveTransitionTarget}'s
 *   own `filePath` parameter.
 */
export function validateFrontmatterState(
  machine: StateMachine,
  typeName: string,
  status: string,
  filePath = '',
): void {
  if (isDeclaredState(machine, status)) {
    return;
  }
  throw new ValidationError([
    {
      code: E_INVALID_STATE,
      path: 'status',
      file: filePath,
      message: `invalid state '${status}' for type '${typeName}'`,
    },
  ]);
}
