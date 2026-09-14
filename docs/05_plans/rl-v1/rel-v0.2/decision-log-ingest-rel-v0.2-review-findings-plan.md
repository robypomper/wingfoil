---
id: "decision-log-ingest-rel-v0.2-review-findings-plan"
type: plan
title: "Decision-log ingest — v0.2 dev-loop review findings (spec-level conflicts)"
status: active
version: "1.0"
workflow: "decision-log-ingest"
phase: "rel-v0.2-review-findings"
element: ""
release: "v0.2"
tmpl_version: 260703
---

## Context

The `review` gate of `dev-loop` (`.wingfoil/workflows/custom/dev-loop.yaml` v1.1) ran over the first
ten v0.2 tasks to reach `in-review` (`task-034`..`task-038`, `task-040`..`task-044`). Beyond the
per-task defects — which route back through the gate's own `fallback: { step: red }` — the reviews
surfaced a class of findings **no task can resolve on its own**: places where two authoritative
documents contradict each other, or where a requirement's Fit Criterion has a half that no element
owns. Left in a task's Execution Notes these findings are unreachable: a `done` task's notes are
re-read only by a downstream task's `agent.read_related` (dl-015), and that gate mandates *reading*,
not *acting*. Capturing them as `decision-log` elements is what makes them schedulable.

Per CLAUDE.md §6-interim + §10.7 and `dl-019`, starting the `decision-log-ingest` main requires a
coherent plan first; this `plan` element is it. It covers **one batch run of the `capture` phase**
producing seven DLs (`dl-027`..`dl-033`). `bug`-shaped findings from the same reviews are out of
scope here — see `bug-ingest-rel-v0.2-review-findings-plan`.

**Preconditions:** ten v0.2 tasks in `in-review`; `minor-v0.2` `in-development`; next free DL number
is `dl-027` (`dl-021` was dropped during the v0.1 retrospective and never reused — see
`retrospective-and-config-bootstrap-plan.md`).

**Produces:** `docs/04_memory/design/dls/dl-0{27..33}.md`, all at `status: in-discussion`.

## Phases / Steps

Mirrors `decision-log-ingest.yaml` v1.0 exactly. Started standalone (no active `element` context), so
the created DLs are top-level and inherit nothing.

### `capture` — role: product-owner

- `memory.add(type: decision-log)` — one commit, all seven skeletons, frontmatter only.
- `memory.submit` — one commit, full body content, `draft → in-discussion`.
- **Checks (post):** `frontmatter.required: [title]`.

Every DL states the conflict with both sides quoted from source, lists the options, and records a
recommendation — it does **not** pre-decide. Each was verified against the primary documents, not
transcribed from the review reports.

| DL | Conflict | Sources |
|---|---|---|
| `dl-027-req-sec-04-deprecate-reason-scope` | Is `--reason` mandatory on `memory deprecate`? | REQ-SEC-04 vs `spec-008` §2 / BDD P1.9 |
| `dl-028-archived-states-excluded-from-context` | Which statuses are "archived" for context exclusion? | REQ-STATE-06 Rationale vs Fit Criterion; `spec-012` §6 |
| `dl-029-role-with-no-directive-assignments` | Globals-only, or zero directives plus a warning? | `spec-012` §5 vs BDD P3.6 edge scenario |
| `dl-030-req-sec-07-referenced-asset-ownership` | Who owns the "still-referenced" half of REQ-SEC-07? | REQ-SEC-07 Fit Criterion clause (b); BDD P4.9 |
| `dl-031-req-sec-10-integrity-depth` | Schema validation only, or digest/tamper-evidence? | REQ-SEC-10 title/Description vs Fit Criterion |
| `dl-032-illegal-transition-message-contract` | Which illegal-transition message and exit code binds? | REQ-STATE-01 / BDD P1.6 / BDD P5.2.3 vs shipped code |
| `dl-033-canonical-role-resolver` | One role resolver or two, and do agents hold roles? | `task-034` vs `task-040` (both unmerged) |

### `approve` — role: approver

- `memory.approve` — `in-discussion → ready`, per DL, on Roberto's explicit instruction only.
- **Approval:** `by_role: approver`. **Fallback:** reject → `capture`.

Not part of this plan's execution: the agent stops at `in-discussion`.

## Handoff

**Agent:** the whole `capture` phase (two commits, per CLAUDE.md §5.1).

**Approver (Roberto):** every `approve`/`reject`. Three DLs gate work that is already queued and
should be settled first:

- `dl-033` determines whether `task-034` keeps `resolveApprover` at all — it must be decided
  **before** `task-034` is sent back to `red`, or the fix will be rewritten twice.
- `dl-032` bears on `task-036`'s rejection: the reject fixes the membership predicate, but the
  message/exit-code divergence it sits next to belongs to already-merged `task-005`.
- `dl-028` bears on `task-035`'s `EXCLUDED_STATUSES` and on `task-038`'s deliberate non-exclusion of
  `superseded`; both are consistent with today's specs, so only a spec change moves them.

**Completion:** the plan reaches `done` when all seven DLs are `ready` (or rejected/deprecated) —
i.e. after the approver gate, not at the end of `capture`.
