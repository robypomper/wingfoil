---
id: bug-ingest-rel-v0.2.2-viewer-findings-plan
type: plan
title: "Bug ingest — v0.2.2 findings from the roadmap viewer"
status: active
version: "1.0"
workflow: "bug-ingest"
phase: "rel-v0.2.2-viewer-findings"
element: ""
release: "v0.2.2"
tmpl_version: 260703   # Orignal template version
---

## Context

Once task-111 moved `.wingfoil/` and `docs/04_memory/` to the repository root, the installed
`wingfoil` (0.2.1) could read this repository for the first time, and the roadmap viewer
(`tools/roadmap`, branch `design/dashboards`) started building its snapshot through the CLI instead of
from the files. Every disagreement between the CLI's answers and the files on disk is a warning in that
snapshot: 30 appeared at once. The approver asked for them to be verified against the CLI built from
`main` and filed as bugs.

This run is separate from `bug-ingest-rel-v0.2.2-review-findings-plan`, which captures the v0.2.2
dev-loop's review findings; the two share nothing but the workflow. Per the interim
no-workflow-engine rule and `dl-019`, this `plan` element is the run's plan
(`.wingfoil/workflows/custom/bug-ingest.yaml` v1.0). `release-origin` of every bug is `v0.2.2`;
`release` stays `""`, because scheduling is the approver's, at triage.

**Ids are allocated by the CLI at commit time** (`memory add --type bug`), never reserved in this plan:
another session files bugs on `main` concurrently, and that session was told so.

## Phases / Steps

### `capture` — role: developer

For each warning group: reproduce with `node dist/cli.js` built from `main`, find its cause in
`src/`, search `bugs/` and `dls/` for a duplicate, and only then file it.

- `memory.add(type: bug)`: one commit with the skeleton only.
- `memory.submit`: one commit with the body, `draft → open`.
- **Checks (post):** `frontmatter.required: [title, severity]`; the reproduction, the cause and the
  duplicate search recorded in Execution Notes.

| Warning group (viewer snapshot) | Count | Verdict |
|---|---|---|
| `listed by wingfoil memory search outside the directories memory.yaml declares` + `type "undefined" is not declared` | 14 × 2 | **bug** `bug-164-memory-search-returns-non-element-files` (low) — `memory search` returns files with no frontmatter as matches with no `id`, `type` or `status` |
| `adr-005-…: on disk with type "adr", but wingfoil memory search does not list it` | 1 | **not a bug** — `memory search` excludes archived statuses (`deprecated`, `superseded`) by default, as REQ-STATE-06 and `dl-028` require; the viewer read an unfiltered search as the list of documents that exist, and is fixed there |
| `documentation.md: listed as global in roles.yaml but its frontmatter has no scope: global` | 1 | **duplicate** — `bug-148` (which of the two declarations is authoritative, `triaged`, v0.3) and `bug-113` (the `scope` field warned as unknown, `open`); the viewer check takes a side `bug-148` has not settled, and is removed there |

### `triage` — role: tech-lead, approver gate

`memory.approve [open → triaged]`, or `memory.reject [open → closed]`. The approver's alone.

## Handoff

- **Agent:** `capture` and its checks; the viewer-side fixes on `design/dashboards`.
- **Approver:** `triage` of each bug filed here.
- **Completion:** every bug here is `triaged` or `closed`; this plan then moves `active → done`.

## Execution Notes

- **Reproduction (2026-09-29), `node dist/cli.js` built from `main` at `2f0bb682`:**
  `memory search --format json` → 481 matches, 14 with no `id` (8 `docs/05_plans/X_*.md`, 6 under
  `docs/05_plans/rl-v1/`); the installed 0.2.1 gives the same 481/14. `memory search "Execution Plan"`
  → 3 matches, 1 with no `id` (`docs/05_plans/rl-v1/initial-design-rl-v1-plan.md`).
  `memory search --type plan` → 18, none without `id`. `memory search --status superseded` → `adr-005`.
- **Cause:** `searchMemoryDocuments` (`src/memory/query.ts`) pushes every `.md` under the scan roots
  and never asks whether the file is a Memory element; `listMemoryDocumentsByType` in the same file
  keeps only documents whose frontmatter `type` matches. The 14 files are the plans `dl-019`
  grandfathered without frontmatter.
- **Duplicate search:** `grep -rl "memory search" docs/04_memory/bugs | xargs grep -l -i "05_plans\|without frontmatter\|no frontmatter\|grandfather"`
  → only `bug-052`, unrelated (REQ-STATE-08's default machine).
- **bug-164** added by `memory add --type bug` (`a6e4e9f4`, number allocated by the CLI), body written,
  submitted `draft → open` (`ac39ccb4`). Awaits the approver's triage.
- **Viewer side** (branch `design/dashboards`): the archived documents are read with
  `memory search --status deprecated` / `--status superseded` besides the unfiltered search; the
  `scope: global` check is dropped (`bug-148` has not ruled); the 14 id-less matches become one
  warning naming `bug-164`.
