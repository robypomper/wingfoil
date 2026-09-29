---
id: "bug-ingest-rel-v0.2.2-review-findings-plan"
type: plan
title: "Bug ingest — v0.2.2 dev-loop review findings"
status: active
version: "1.0"
workflow: "bug-ingest"
phase: "rel-v0.2.2-review-findings"
element: ""
release: "v0.2.2"
tmpl_version: 260703
---

## Context

The v0.2.2 dev-loop (`dev-loop-rel-v0.2.2-plan`) surfaces findings at each task's review gate that
the task itself does not fix. A finding left only in a task's Execution Notes is never rescheduled
once the task is `done`, so each one the approver rules a bug is captured here through the
`bug-ingest` main (`.wingfoil/workflows/custom/bug-ingest.yaml` v1.0). Per the interim
no-workflow-engine rule and `dl-019`, this `plan` element is that run's plan. It stays `active` for
the whole dev-loop, and each later batch is appended to the table below.

Each bug is raised during a `dev-loop`, so it inherits the active `task` as its origin; the task is
named in the bug's Notes. `release-origin` is `v0.2.2`, the release under development. `release`
stays `""`: scheduling is the approver's, at triage.

**Preconditions (2026-09-29).** The next free bug number is `bug-155`: the highest existing file is
`bug-154-directives-list-succeeds-with-no-configuration.md` (`ls docs/self/docs/04_memory/bugs |
sort -V | tail -1`), and `git log --all --oneline | grep -c bug-155` → 0.

## Phases / Steps

### `capture` — role: developer

- `memory.add(type: bug)`: one commit with the skeleton only.
- `memory.submit`: one commit with the body, `draft → open`.
- **Checks (post):** `frontmatter.required: [title, severity]`, and a duplicate search over `bugs/`
  and `dls/` recorded in Execution Notes.

| Bug | Found at | Defect | Severity |
|---|---|---|---|
| `bug-155-multi-hop-bracket-always-reads-as-drift` | `task-109` review (2026-09-29, approver ruling "apri un bug") | a multi-hop bracket `[a → b → c]` is split at the first arrow, so `to` is `b → c`, which no frontmatter can hold, and every such commit reads as a mismatch | low |

### `triage` — role: tech-lead, approver gate

`memory.approve [open → triaged]`, or `memory.reject [open → closed]`. The approver's alone.

## Handoff

- **Agent:** `capture` and its checks, for every finding the approver rules a bug.
- **Approver:** `triage` of each bug.
- **Completion:** when the dev-loop is `done`, every bug here is `triaged` or `closed`, and this plan
  moves `active → done`.

## Execution Notes

- **bug-155.** Duplicate search: `grep -rli "multi-hop\|multi hop" docs/self/docs/04_memory/bugs
  docs/self/docs/04_memory/design/dls` → no hit. `dl-079` (the `wf()` grammar, `in-discussion`) does
  not mention chained brackets (`grep -n -i "hop\|chain" dl-079-*.md` → nothing). Added in
  `5b280ec2`; submitted in the commit after this plan's submit.
