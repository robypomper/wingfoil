---
id: bug-ingest-rel-v0.2.2-user-docs-findings-plan
type: plan
title: "Bug ingest — v0.2.2 user-docs findings"
status: active
version: "1.0"
workflow: "bug-ingest"
phase: "rel-v0.2.2-user-docs-findings"
element: "patch-v0.2.2"
release: "v0.2.2"
tmpl_version: 260703
---

## Context

`user-docs-rel-v0.2.2-plan` S2 found stale claims in files outside its phases' `produces:`. Per that
plan's rule (findings outside `produces:` become elements) and the approver's standing rule, they
are filed as bugs rather than edited in passing. This `plan` element is the run's plan
(`.wingfoil/workflows/custom/bug-ingest.yaml` v1.0, `dl-019`). `release-origin` is `v0.2.2`, and
`release` stays `""`: scheduling is the approver's, at triage.

Ids are allocated by the CLI at commit time (`npm run -s wingfoil -- memory add --type bug`), on the
phase branch `docs/user_docs_v0.2.2`.

## Phases / Steps

### `capture` — role: developer

- `memory.add(type: bug)`: one commit with the skeleton only.
- `memory.submit`: one commit with the body, `draft → open`.
- **Checks (post):** `frontmatter.required: [title, severity]`; the reproduction and the duplicate
  search recorded in the bug.

| Finding | Verdict |
|---|---|
| `initial-design.yaml` and `wingfoil-init.yaml` header comments: "WingFoil's CLI/MCP is not yet usable" | **bug** `bug-169-two-workflow-files-still-say-wingfoil-s-cli-and-mcp-are-not-yet-usable` (low) |
| `.wingfoil/WORKFLOW.md` release-cycle / release-planning diagrams predate dl-013, dl-016, dl-023, dl-095 (found at S10) | **bug** `bug-170-workflow-md-draws-a-release-cycle-without-user-docs-e2e-smoke-and-three-release-planning-phases` (low) |
| `memory approve <id1> <id2>` approved only `<id1>`, exit 0 (found while triaging bug-169/170) | **bug** `bug-171-transition-verbs-and-read-commands-silently-ignore-every-operand-after-the-first` (medium) |

### `triage` — role: tech-lead, approver gate

`memory.approve [open → triaged]`, or `memory.reject [open → closed]`. The approver's alone.

## Handoff

- **Agent:** `capture` and its checks.
- **Approver:** `triage` of each bug filed here.
- **Completion:** every bug here is `triaged` or `closed`; this plan then moves `active → done`.

## Execution Notes

- `bug-169` added through the pinned build (`59fb0e06`). No other branch held that number when it
  was allocated: `git ls-tree` checked every local branch plus `origin/main`, and `bug-168` was the
  highest. The number is only safe once this branch merges, because another session may allocate
  `bug-169` on `main` first. At merge, check with
  `git ls-tree --name-only main docs/04_memory/bugs/ | grep bug-169`.
- `bug-169` submitted `draft → open` (`1250e905`).
- `bug-170` added (`b01432d9`) and submitted `draft → open` (`32cba723`) through the pinned build; each verb commit contains only the bug file (`git show --stat`), with the S10 edits still uncommitted in the tree.
- **Triage, 2026-09-29, the approver's ruling in chat:** `bug-169` and `bug-170` go into v0.3.
  - `release: "v0.3"` was stamped in its own commit (`ae994094`). The pinned `memory approve` refuses
    to commit a field the transition does not own (the `bug-076` guard).
  - `bug-169` → `triaged` (`4fa3cee0`) and `bug-170` → `triaged` (`266a5f43`), each by the pinned
    `memory approve`.
  - The first call named both ids, approved only `bug-169`, and exited `0`. That is `bug-171`, added
    (`49001ddc`) and submitted `draft → open` (`8ea13a58`). It awaits triage, so this plan stays
    `active`.
- `bug-171`: `release: "v0.3"` stamped in its own commit (`f0f25b1a`), then `open → triaged` by the
  pinned `memory approve` (`fe2613f6`), on the approver's ruling of 2026-09-29. Every bug here is
  now `triaged`, so this plan moves `active → done`.
