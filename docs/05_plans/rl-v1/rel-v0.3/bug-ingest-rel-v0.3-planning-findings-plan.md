---
id: bug-ingest-rel-v0.3-planning-findings-plan
type: plan
title: "Bug-ingest — rel-v0.3 planning findings"
status: active
version: "1.0"
workflow: "bug-ingest"
phase: "rel-v0.3-planning-findings"
element: "minor-v0.3"
release: "v0.3"
tmpl_version: 260703
---

## Context

Defects found while running v0.3's `release-planning` (`release-planning-rel-v0.3-plan`,
*Observations*) are captured here through `bug-ingest` (`.wingfoil/workflows/custom/bug-ingest.yaml`
v1.0), started from that phase, so each bug carries `release-origin: "v0.3"` and inherits the
active element `minor-v0.3`. Before each capture the agent searches `docs/04_memory/bugs/` for a
duplicate, and a candidate that turns out to be declared behaviour is dropped with the evidence.

**Preconditions.** The pinned build is `wingfoil 0.2.2`. Next free bug id across every ref
(`dl-101`): `bug-175` (`git ls-tree` over `git for-each-ref refs/heads refs/remotes`, 2026-09-29).

**Candidates.**
- **Captured:** `release-planning.yaml`'s define-scope check requires `kind`, which the immutable
  `minor-*` releases do not carry (`bug-175`).
- **Dropped:** `memory add --set <name>=…` with a name that is no path token exits `1`. That is the
  declared contract: `spec-008` §10 and `src/memory/add.ts:220-223` ("`memory add` refuses them
  (exit 1, `spec-008` §10)"). Not a defect.
- **Dropped:** `wingfoil mcp` answering `tools/list` with `-32601` is already `bug-151` (`triaged`,
  v0.3).

## Phases / Steps

1. **capture** (developer, no gate): `memory add --type bug --title …` → draft; fill severity, the
   reproduction and the evidence; `memory submit` → `open`. One file per commit, checked afterwards.
2. **triage** (tech-lead, ⛔): `memory approve [open → triaged]` on the approver's instruction, or
   `reject [open → closed]`. `release` is stamped at `release-planning`'s build-backlog.

## Handoff

- **Approver:** the triage gate of each captured bug.
- **Agent:** duplicate search, capture, commit hygiene. It never approves.
- **Completion criteria:** every captured bug `triaged` or `closed`. More findings from the same
  phase are added to this plan as they occur, until `release-planning` closes.
