---
id: bug-ingest-rel-v0.2.2-mcp-registry-findings-plan
type: plan
title: "Bug ingest — v0.2.2 MCP Registry publish findings"
status: active
version: "1.1"
workflow: "bug-ingest"
phase: "rel-v0.2.2-mcp-registry-findings"
element: "patch-v0.2.2"
release: "v0.2.2"
tmpl_version: 260703
---

## Context

`release-publishing-rel-v0.2.2-plan` S8: after `wingfoil@0.2.2` went live on npm, the approver ran the
first MCP Registry publish (`dl-093` point 6, `dl-130` Action 4) with `mcp-publisher`. The registry
refused it with a 403, twice, including after a fresh `logout`/`login github`. The approver ruled on
2026-09-29: pause the registry listing, file the bug, and go on with `mark-released`. This `plan`
element is the ingest's plan (`.wingfoil/workflows/custom/bug-ingest.yaml` v1.0, `dl-019`), on the
phase branch `design/release_publishing_v0.2.2`. `release` stays `""`: scheduling is the approver's,
at triage.

## Phases / Steps

### `capture` — role: developer

- `memory.add(type: bug)`, then `memory.submit` (`draft → open`), each its own commit.
- **Checks (post):** `frontmatter.required: [title, severity]`; the evidence and a duplicate search
  recorded in the bug.

| Finding | Verdict |
|---|---|
| `publish.yml` runbook step 6 names neither where npm's Staged Packages tab is nor the "automated review" state | **bug** `bug-174` (low) |
| `mcp-publisher publish` of `io.github.wingfoil/wingfoil` → 403 "You have permission to publish: io.github.robypomper/*", although the approver is an active owner of `wingfoil` with public membership | **bug** (medium: a `dl-093` deliverable of v0.2.2 is not delivered) |

### `triage` — role: tech-lead, approver gate

`memory.approve [open → triaged]` or `memory.reject [open → closed]`. The approver's alone.

## Handoff

- **Agent:** `capture`.
- **Approver:** `triage`.
- **Completion:** the bug `triaged` or `closed`; this plan then moves `active → done`.

## Execution Notes

- Plan added `9f7dd317` (dev build), submitted `04097426` (pinned, `draft → active`).
- `bug-173` added by the pinned build (`9e175125`); `bug-172` was the highest number on every local and
  remote branch. It was then submitted `draft → open`, with the 403 text, the membership evidence, the
  suspected cause and the duplicate search.
- **Misunderstanding, recorded.** The approver's "apri il bug" meant the runbook gap proposed in
  `release-publishing-rel-v0.2.2-plan` S8, not the registry 403. The approver corrected it right after.
  `bug-173` stays `open` for the approver's triage: kept, or rejected to `closed`. It was not retired
  by the agent.
- `bug-174` (the runbook gap) added (`3cb4d624`) and submitted `draft → open` (`153f9b44`) by the
  pinned build. It is low severity; the location of the Staged Packages tab is to come from the
  approver. Its body was corrected afterwards, in its own commit: `release-publishing.yaml` line 31
  says only "or Approve on npmjs.com".
- Awaiting the approver's triage of `bug-173` and `bug-174`.
