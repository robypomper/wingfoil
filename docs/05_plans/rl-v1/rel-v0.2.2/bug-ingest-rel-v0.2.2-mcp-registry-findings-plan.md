---
id: bug-ingest-rel-v0.2.2-mcp-registry-findings-plan
type: plan
title: "Bug ingest — v0.2.2 MCP Registry publish findings"
status: active
version: "1.0"
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
| `mcp-publisher publish` of `io.github.wingfoil/wingfoil` → 403 "You have permission to publish: io.github.robypomper/*", although the approver is an active owner of `wingfoil` with public membership | **bug** (medium: a `dl-093` deliverable of v0.2.2 is not delivered) |

### `triage` — role: tech-lead, approver gate

`memory.approve [open → triaged]` or `memory.reject [open → closed]`. The approver's alone.

## Handoff

- **Agent:** `capture`.
- **Approver:** `triage`.
- **Completion:** the bug `triaged` or `closed`; this plan then moves `active → done`.

## Execution Notes

<!-- Filled during the run. -->
