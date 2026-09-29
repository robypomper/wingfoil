---
id: bug-ingest-rel-v0.2.2-publish-gate-findings-plan
type: plan
title: "Bug ingest — v0.2.2 publish-gate findings"
status: active
version: "1.1"
workflow: "bug-ingest"
phase: "rel-v0.2.2-publish-gate-findings"
element: "patch-v0.2.2"
release: "v0.2.2"
tmpl_version: 260703
---

## Context

`release-publishing-rel-v0.2.2-plan` S6: the first `v0.2.2` tag push (run `36621412441`, tag
object `70f79f06` on `a1a2850b`) failed in `publish.yml`'s `gate` job, at the `prepublishOnly` test
step: 5 of 2624 tests failed in `test/cli/help-positional-required.integration.test.ts`. `stage`
and `promote` were skipped; nothing was staged or published (`npm view wingfoil@0.2.2 version` →
`E404`). The same suite passes locally (160/2624 at `b1cd5db2`).

The approver ruled on 2026-09-29: fix it in the product (option 1a — argument validation before the
environment pre-flight), reuse the version `0.2.2` (the tag is deleted and re-created after the fix;
npm never saw the version), and file the bug. This `plan` element is the ingest's plan
(`.wingfoil/workflows/custom/bug-ingest.yaml` v1.0, `dl-019`). It runs on the phase branch
`design/release_publishing_v0.2.2`. Ids come from the pinned build's `memory add` at commit time.

## Phases / Steps

### `capture` — role: developer

- `memory.add(type: bug)`, then `memory.submit` (`draft → open`), each its own commit.
- **Checks (post):** `frontmatter.required: [title, severity]`; the reproduction and a duplicate
  search recorded in the bug.

| Finding | Verdict |
|---|---|
| `memory submit|approve|reject|deprecate` and `directive remove`, run with their required positional missing and no git identity configured, exit `1` ("git identity not configured") instead of the usage exit `2`; the `gate` job has no git identity, so task-120's test fails there only | **bug** `bug-172` (high: it blocks the v0.2.2 publish) |

### `triage` — role: tech-lead, approver gate

`memory.approve [open → triaged]` with `release: "v0.2.2"` stamped first in its own commit (the
`bug-076` guard), or `memory.reject [open → closed]`. The approver's alone. The fix itself is a
`task` for dev-loop, not work of this plan.

## Handoff

- **Agent:** `capture`, and the `release` stamp once the approver rules.
- **Approver:** `triage`.
- **Completion:** `bug-172` `triaged` (or `closed`); this plan then moves `active → done`.

## Execution Notes

- Plan added `e9a747a2` (dev build) and submitted `889e235f` (pinned, `draft → active`).
- `bug-172` added through the pinned build (`78f4d7dc`). No local branch or `origin/main` held a higher
  bug number (`git ls-tree` over every local branch: `bug-171` highest). It was submitted `draft → open`
  (`fec5665a`) with the reproduction table measured on `a1a2850b` and the duplicate search.
- `release: "v0.2.2"` stamped in its own commit (`1890f473`), on the approver's ruling (fix in the
  product, reuse `0.2.2`).
- Triage, 2026-09-29, the approver's instruction in chat: `bug-172` `open → triaged` by the pinned
  `memory approve` (`f5ec8852`). Its fix task is `task-125` (dev-loop). Every bug here is `triaged`, so
  this plan moves `active → done`.
