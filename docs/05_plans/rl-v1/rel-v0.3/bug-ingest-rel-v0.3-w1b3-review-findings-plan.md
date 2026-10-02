---
id: bug-ingest-rel-v0.3-w1b3-review-findings-plan
type: plan
title: "Bug-ingest — rel-v0.3 wave 1 B3 review findings"
status: done
version: "1.0"
workflow: "bug-ingest"
phase: "rel-v0.3-w1b3-review-findings"
element: "minor-v0.3"
release: "v0.3"
tmpl_version: 260703   # Orignal template version
---

## Context

The independent reviews of wave 1 batch B3 (`dev-loop-rel-v0.3-plan`, 2026-10-02) left findings
outside each task's scope. They are captured here through `bug-ingest`, with `release-origin: "v0.3"`,
using the code version on `main` after the B3 merges. Claims were re-run on `main` where marked, or
rest on the named reviewer's reproduction.

## Phases / Steps

1. **capture**, done 2026-10-02:
   - `bug-194` … `bug-202` (`open`);
   - handover notes, by `memory amend`, on `task-188` (`dl-062`'s `spec-011` Action, `662e8ed5`),
     `task-174` (the shared not-initialized refusal, `484a48c1`), `task-221` (`task.stop_the_line`
     and the `dl-133` option (a) ruling, `6f386cde`) and `task-218` (the success-warning channel,
     `45780905`).
2. **triage** (⛔ approver). Proposals:

   | Bug | Severity | Proposal |
   |---|---|---|
   | `bug-194` writes-nothing tests too narrow | medium | v0.3, absorbed into `task-184` (test guard prose that overclaims) |
   | `bug-195` value sets not enforced | low | v0.4 (needs a `spec-001` change) |
   | `bug-196` spec-010 example stale | low | v0.3, absorbed into `task-153` (`spec-001` reconciliation) |
   | `bug-197` local spawn helpers | low | v0.3, absorbed into `task-152` (test fixture helpers) |
   | `bug-198` read commands leak ENOENT | low | v0.3, absorbed into `task-179` (one refusal shape) |
   | `bug-199` empty `.wingfoil` role assertion | low | v0.4 |
   | `bug-200` MCP Resource reads drop warnings | low | v0.4, with the MCP Tools work |
   | `bug-201` `atHeadOr` fallback | low | v0.3, absorbed into `task-171` (fail closed) |
   | `bug-202` unknown-field warning printed | low | v0.3, absorbed into `task-218` (warnings channel) |

## Handoff

- **Approver:** the triage.
- **Agent:** capture, the notes, and triage mechanics once ruled.
- **Completion criteria:** every captured bug `triaged` or `closed`; this plan `active → done`.

## Execution Notes
- **triage done (2026-10-02)**, on the approver's instruction, with the proposals accepted:

  | Bug | Outcome |
  |---|---|
  | `bug-194` | `task-184` |
  | `bug-196` | `task-153` |
  | `bug-197` | `task-152`, already in progress; its agent merges `main` and takes the added scope |
  | `bug-198` | `task-179` |
  | `bug-201` | `task-171` |
  | `bug-202` | `task-218` |
  | `bug-195`, `bug-199`, `bug-200` | `triaged`, v0.4, unabsorbed |

  Each absorbing task names its bug through `memory amend`. Plan complete.
