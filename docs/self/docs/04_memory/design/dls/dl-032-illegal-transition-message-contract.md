---
id: "dl-032-illegal-transition-message-contract"
type: decision-log
title: "The illegal-transition error: REQ-STATE-01 and two BDD features pin a message and exit code the shipped code does not use"
status: ready
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Three authoritative documents pin the same string and the shipped implementation emits a different
one, at a different exit code. This is already merged and on `main` (from
`task-005-per-type-state-machines`, v0.1), so no task under review introduced it — and none can fix
it alone.

**REQ-STATE-01** (`docs/02_requirements/03_sard/03_state-context.md`):

> **Fit Criterion:** A transition not present in the type's `transitions` graph is rejected with
> `"illegal transition <from> -> <to> for type '<type>'"` and leaves the state unchanged.

**BDD `P1.6-memory-submit.feature`** (line 21) pins the string *and* the exit code:

> And the command exits with code **1** and message `"illegal transition approved -> pending for type 'task'"`

**BDD `P5.2.3-mcp-tools.feature`** (line 18) pins the same string for the MCP channel:

> Then the tool returns error `"illegal transition approved -> pending for type 'task'"`

**Shipped** (`src/memory/state-machine.ts` on `main`): the message is built as
`` illegal `${op}` from "${currentState}": ${message} `` — e.g. ``illegal `submit` from "approved": a
`gates` state — its forward edge requires `approve`, not `submit``` — and thrown via
`ValidationError.semantic(...)`, which maps to exit **2**.

So there are three separate divergences: the message text, the exit code (1 vs 2), and a stale
encoding reference — REQ-STATE-01 still speaks of "the type's `transitions` graph", an encoding
`spec-001-memory-yaml-schema` replaced with `sequence`/`gates`/`waiting`.

The exit code question is tangled with a fourth document: `spec-009-validation-strategy` §3 is
self-contradictory here, stating both that Pass-2 semantic failures exit `2` and that mapped
`E_INVALID_*` codes exit `1`. `E_INVALID_TRANSITION` is both.

This surfaced during `task-036`'s review. `task-036` is being returned to `red` for an unrelated
defect; this divergence is **not** part of that fix, and will otherwise surface as a BDD failure when
`task-045-memory-submit` and the MCP memory tools land.

## Decision

*(in-discussion — proposed, not yet ratified)* **Option (c), the hybrid.** Make the pinned string the
message the contracts see, and keep the shipped diagnostic as its detail: emit `illegal transition
<from> -> <to> for type '<type>'` as the message, carrying the current explanatory text ("a `gates`
state — its forward edge requires `approve`, not `submit`") as the issue's detail field. Settle the
exit code by first resolving `spec-009` §3's own contradiction, in the same ratification.

Alternatives:

- **(a) Code wins** — amend REQ-STATE-01, `P1.6` and `P5.2.3` to the shipped message and exit 2.
  Cheapest in code, but it rewrites two acceptance contracts to match an implementation, which
  inverts the project's stated authority order (CLAUDE.md §10.1: specs win).
- **(b) BDD wins outright** — replace the message with the pinned string and move to exit 1, dropping
  the richer diagnostic. Faithful, but it discards genuinely better operator output: the shipped text
  explains *why* the edge is illegal, which the pinned string does not.

Independently of (a)/(b)/(c): REQ-STATE-01's reference to a `transitions` graph must be updated to
`sequence`/`gates`/`waiting` per `spec-001`. That part is not contentious.

## Rationale

- Two independent BDD features pin the same string, for two different channels (CLI and MCP). That is
  a deliberate cross-channel contract, not an incidental wording — which is the strongest argument
  against option (a).
- The shipped message is genuinely more useful, and throwing it away to satisfy a string match would
  be a regression in operator experience. Option (c) keeps both by separating *message* from *detail*,
  a split `ValidationError` already supports.
- The exit code cannot be settled here in isolation: `spec-009` §3 licenses both answers, so whichever
  is chosen, that spec needs the contradiction removed or the next task will re-derive the ambiguity.
- **Cost of deferring:** `task-045-memory-submit` is in the v0.2 backlog and `P1.6` is its acceptance
  contract. If this is unresolved when it runs, its review gate fails on a divergence it did not
  cause, and the fix lands under time pressure inside an unrelated task.

## Actions

- Owner **approver**: ratify (a), (b) or (c); separately decide exit `1` vs `2`.
- Regardless of option: amend REQ-STATE-01's Fit Criterion to reference `sequence`/`gates`/`waiting`
  instead of a `transitions` graph.
- Resolve `spec-009` §3's Pass-2-exits-2 vs `E_INVALID_*`-exits-1 contradiction (new spec version per
  the doc-versioning directive).
- Hard input to `task-045-memory-submit`'s `design` phase, and to the MCP memory tools in v0.4.
