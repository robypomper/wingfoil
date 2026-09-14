---
id: "bug-ingest-rel-v0.2-review-findings-plan"
type: plan
title: "Bug ingest — v0.2 dev-loop review findings (defects on main)"
status: active
version: "1.0"
workflow: "bug-ingest"
phase: "rel-v0.2-review-findings"
element: ""
release: "v0.2"
tmpl_version: 260703
---

## Context

Companion to `decision-log-ingest-rel-v0.2-review-findings-plan`, same trigger: the `dev-loop`
`review` gate over the first ten v0.2 tasks (`task-034`..`task-038`, `task-040`..`task-044`). That
sweep turned up two findings that are **defects against `main` as it stands today**, not spec
conflicts and not any single task's responsibility — so neither the review gate's `fallback: { step:
red }` nor a DL is the right container. They are `bug` elements.

Both were reproduced directly against `main` in this repository before being written up; neither is
inferred from a task branch.

Per CLAUDE.md §6-interim + §10.7 and `dl-019`, starting the `bug-ingest` main requires a coherent
plan first; this `plan` element is it. It covers **one batch run of the `capture` phase** producing
`bug-009` and `bug-010`.

**Preconditions:** next free bug number is `bug-009` (`bug-001`..`bug-003` closed, `bug-004`/`006`/
`007` planned into v0.2, `bug-005` closed, `bug-008` open).

**Produces:** `docs/04_memory/bugs/bug-009.md`, `bug-010.md`, both at `status: open`.

## Phases / Steps

Mirrors `bug-ingest.yaml` v1.0 exactly. Started standalone (no active `element` context), so both
bugs are top-level and inherit nothing — in particular they are **not** attributed to any of the ten
tasks under review.

### `capture` — role: developer

- `memory.add(type: bug)` — one commit, both skeletons, frontmatter only.
- `memory.submit` — one commit, full body content, `draft → open`.
- **Checks (post):** `frontmatter.required: [title, severity]`.

| Bug | Defect | Reproduced |
|---|---|---|
| `bug-009-eslint-baseline-require-imports` | `npm run lint` fails on `main`; every branch inherits a red gate, which masks newly-introduced lint errors | `npx eslint .` on `main` → 1 error |
| `bug-010-deprecated-reaches-agent-context` | REQ-STATE-06's "never appears in an assembled agent context" is unmet: the MCP collection Resource returns deprecated documents | `src/mcp/memory-resource.ts` calls `listMemoryDocumentsByType` unfiltered |

### `triage` — role: tech-lead, approval gate

- `memory.approve` — `open → triaged`, per bug, on Roberto's explicit instruction only.
- **Approval:** `by_role: approver`. **Fallback:** reject → `capture` (i.e. `open → closed` for
  wontfix/duplicate, per `memory.yaml`'s `gates.open.reject`).

Not part of this plan's execution: the agent stops at `open`.

## Handoff

**Agent:** the whole `capture` phase (two commits, per CLAUDE.md §5.1).

**Approver (Roberto):** both triage decisions. Note the scheduling asymmetry:

- `bug-009` is cheap and its value is mostly *preventive* — it was a red baseline that let
  `task-043` add four new lint errors without the gate reading as newly-broken. Fixing it before the
  four pending rejects re-enter `red` makes those rejects verifiable.
- `bug-010` is the surviving half of REQ-STATE-06 after `task-038` merges, and it will grow a second
  surface when `task-037`'s `assembleExecutionContext` lands unfiltered. Triaging it now lets
  `release-planning` schedule one fix covering both surfaces instead of two.

**Completion:** the plan reaches `done` when both bugs are `triaged` (or `closed` as wontfix) — i.e.
after the approver gate, not at the end of `capture`.
