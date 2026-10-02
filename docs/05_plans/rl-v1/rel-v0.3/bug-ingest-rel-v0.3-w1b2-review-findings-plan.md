---
id: bug-ingest-rel-v0.3-w1b2-review-findings-plan
type: plan
title: "Bug-ingest — rel-v0.3 wave 1 B2 review findings"
status: active
version: "1.0"
workflow: "bug-ingest"
phase: "rel-v0.3-w1b2-review-findings"
element: "minor-v0.3"
release: "v0.3"
tmpl_version: 260703   # Orignal template version
---

## Context

The independent reviews of wave 1 batch B2 (`dev-loop-rel-v0.3-plan`, 2026-10-01/02) left findings
outside each task's scope. They are captured here through `bug-ingest`, with `release-origin: "v0.3"`,
using the code version on `main` after the B2 merges. Each claim was re-run on `main` before submit,
or rests on the named reviewer's reproduction.

## Phases / Steps

1. **capture**, done 2026-10-02:
   - bugs `bug-187` … `bug-193`, each `add` + `submit` → `open`;
   - `dl-139` (`in-discussion`);
   - one `memory amend` on `bug-193`, correcting its reproduction step (`8ca8ff5a`);
   - handover notes, by `memory amend`, on `task-206` (`a798494e`), `task-208` (`3bb46732`) and
     `task-222` (`88fee410`).
2. **triage** (⛔ approver). Proposals:

   | Element | Severity | Proposal |
   |---|---|---|
   | `bug-187` submit decides on the working tree | high | v0.3: a new fix task, or absorbed into `task-171` (Memory scan primitives) |
   | `bug-188` history exits 2 on bad YAML | medium | v0.3, absorbed into `task-171` (tolerant of unreadable files) |
   | `bug-189` symlink/gitlink baselines differ | low | v0.3, absorbed into `task-171` |
   | `bug-190` dotenv false negatives | low | v0.3, absorbed into `task-182` (scanner claim) |
   | `bug-191` five paths categories | low | v0.3, absorbed into `task-188` (spec-011 stale text) |
   | `bug-192` verb/edge pairing in the governance check | medium | v0.3, absorbed into `task-208` |
   | `bug-193` RFC 2606 second-level domains | low | v0.4, or `reject → closed` |
   | `dl-139` status changes outside `wf()` | — | ratify (a) and fold into `task-208` |

## Handoff

- **Approver:** the triage, and the ruling on `dl-139`.
- **Agent:** capture, the checks, triage mechanics once ruled.
- **Completion criteria:** every captured bug `triaged` or `closed`, `dl-139` ruled; this plan `active → done`.

## Execution Notes
