---
id: "dl-030-req-sec-07-referenced-asset-ownership"
type: decision-log
title: "REQ-SEC-07's second clause (still-referenced custom assets) has no owner for the workflow half"
status: ready
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

**REQ-SEC-07** (`docs/02_requirements/03_sard/05_security-compliance.md`) carries a two-clause Fit
Criterion:

> `directive remove` / `workflow remove` on a built-in is rejected ("built-in … cannot be removed");
> **removal of a still-referenced custom asset is rejected naming the referrer.**
> **Traceability:** Feature P3.3 (US-6-07, BDD `p3-directives/P3.3-directive-remove.feature`);
> Feature P4.9 (US-6-11, BDD `p4-workflow/P4.9-workflow-remove.feature`).

Clause (a) — built-in immutability — is implemented by `task-042-immutable-builtin-assets`, at the
primitive level. Clause (b) — reference checking — is implemented nowhere, and its ownership is
uneven:

- The **directive** half (P3.3, message `cannot remove 'legacy-rule': still assigned to role
  'developer'`) plausibly falls to `task-052-directive-remove` (`ref: P3.3`), which already declares
  `depends_on: ["task-042-immutable-builtin-assets"]`. Its task file does not mention clause (b)
  explicitly, so the obligation is implicit rather than written.
- The **workflow** half (P4.9, message `cannot remove 'arch-review': included by 'release-cycle'`) has
  **no owner at all**. Verified across the full v0.2 backlog: no task carries `ref: "P4.9"`, and no
  task file mentions `workflow remove`.

The practical effect is that REQ-SEC-07 will read as satisfied once `task-042` and `task-052` are
done, while half of its Fit Criterion remains unimplemented and untracked.

## Decision

**Option (b): record REQ-SEC-07 as partially satisfied
and route P4.9 through release-planning rather than widening v0.2 mid-flight.** Concretely: write
clause (b) explicitly into `task-052-directive-remove`'s acceptance criteria for the directive half,
and register the workflow half as an unscheduled obligation for the next `release-planning` run to
place.

Alternatives:

- **(a) Add a P4.9 task to v0.2 now.** Adding a task to a release already `in-development` is a
  `release-planning`/`build-backlog` action, not something a review gate may do; and P4.9 has
  prerequisites (a workflow-registry read path) whose v0.2 presence has not been checked. Available,
  but it should be a planning decision, not a side effect of this review.
- **(c) Split REQ-SEC-07 into two requirements** — one for immutability, one for referential
  integrity — so that partial satisfaction becomes expressible rather than needing a note. Cleanest
  for traceability; costs a SARD renumbering and invalidates existing `ref:` citations.

## Rationale

- The defect here is one of *bookkeeping*, not of code: nothing shipped is wrong, but the project's
  traceability chain would report a green requirement over a half-built one. That is precisely the
  failure mode the `traceability` directive exists to prevent.
- Option (b) keeps the release boundary intact. v0.2 is `in-development` with 32 tasks; widening its
  scope from a review gate would break the release-planning contract that defined it.
- Option (c) is the most correct long-term shape and worth considering at the next release-line
  boundary rather than now — a mid-release SARD renumbering would invalidate `ref:` fields across the
  backlog, which is a high-cost, low-urgency change.
- **Note for the approver:** whichever option is chosen, `task-042`'s Execution Notes currently assert
  it "satisfies the Fit Criterion for REQ-SEC-07" without recording that clause (b) is out of scope.
  That claim should be corrected when the task returns through `red`, independently of this decision.

## Actions

- Owner **approver**: ratify (a), (b) or (c).
- If (b): add clause (b) to `task-052-directive-remove`'s Acceptance Criteria; carry the P4.9
  obligation into the next `release-planning` run for scheduling.
- Regardless of option: correct `task-042`'s Execution Notes to state that clause (b) is not delivered
  and where it is owned.
