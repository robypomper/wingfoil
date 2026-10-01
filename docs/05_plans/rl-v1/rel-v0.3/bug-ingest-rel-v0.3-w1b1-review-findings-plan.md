---
id: bug-ingest-rel-v0.3-w1b1-review-findings-plan
type: plan
title: "Bug-ingest — rel-v0.3 wave 1 B1 review findings"
status: active
version: "1.0"
workflow: "bug-ingest"
phase: "rel-v0.3-w1b1-review-findings"
element: "minor-v0.3"            # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.3"            # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

The independent reviews of wave 1 batch B1 (`dev-loop-rel-v0.3-plan`, 2026-10-01: `task-130`,
`task-131`, `task-133`, `task-136`, `task-139`, `task-140`, `task-166`, `task-170`) left findings
outside each task's scope. They are captured here through `bug-ingest` (`.wingfoil/workflows/custom/bug-ingest.yaml`
v1.0), with `release-origin: "v0.3"`. Before each capture the agent searched
`docs/04_memory/bugs/`, the decision-logs and the v0.3 backlog for an element that already owns it.
The Memory verbs run with the code version (`node dist/cli.js`) on `main` after the B1 merges.

## Phases / Steps

1. **capture** (developer), done 2026-10-01. Each claim was re-checked on `main` before submit.

   | Bug | Severity | Finding |
   |---|---|---|
   | `bug-183` | low | built-in workflow integrity uses the schema only (`task-136` review) |
   | `bug-184` | medium | the production MCP server's Resources give no `error.data` (`task-130`) |
   | `bug-185` | low | DEL, C1 and U+2028 accepted in a `Reason:` (`task-166`) |
   | `bug-186` | low | a plan's `release` means its target release; amend keeps it reserved (`task-170`) |

   For `bug-186`, the amend refusal was reproduced on a scratch clone.

   **Not captured, owned elsewhere; recorded by `memory amend`:**
   - The policy on removing a custom shadow of a bound built-in joins `dl-058` (`fd0b263c`).
   - The stale stand-in note now loaded for every role joins `bug-040` (`5d8d2fe2`).
2. **triage** (tech-lead, ⛔ approver). Proposals:

   | Bug | Proposal |
   |---|---|
   | `bug-183` | `triaged`, v0.3, absorbed into `task-196` (same integrity pre-flight) |
   | `bug-184` | `triaged`, v0.3, absorbed into `task-174` (the production server's pre-flight, `src/mcp/server.ts`) |
   | `bug-185` | the approver rules whether the refusal extends past C0 (`dl-078` amendment). If it does: `triaged`, v0.3, absorbed into `task-173` (control-character gate). If not: `reject → closed` |
   | `bug-186` | `triaged`, v0.3, absorbed into `task-197` (traceability directive): it states what a plan's `release` means. Renaming the field is the alternative, like `task-170` |

## Handoff

- **Approver:** the triage of the four bugs, and the ruling on `bug-185`.
- **Agent:** search, capture, submit, and the two `memory amend` records.
- **Completion criteria:** every captured bug `triaged` or `closed`; this plan `active → done`.

## Execution Notes
