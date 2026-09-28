---
id: "bug-ingest-rel-v0.2-publish-run-findings-plan"
type: plan
title: "Bug ingest — v0.2 first real publish run (promote's relative tarball path; actions targeting Node 20)"
status: active
version: "1.1"
workflow: "bug-ingest"
phase: "rel-v0.2-publish-run-findings"
element: ""
release: "v0.2"
tmpl_version: 260703
---

## Context

The first real run of `publish.yml` was run `36399049170`, triggered on 2026-09-28 by the annotated
tag `v0.2.0` on `a66f0e0c`. `gate` and `stage` passed. `promote` waited on the `npm-publish`
environment, which was the first time that gate had ever been exercised, and it held. After the
approver approved, `promote` failed with exit 128 before anything was published: `npm view wingfoil
version` → `E404`. The run also carried a Node 20 deprecation annotation on every job.

The approver ordered both findings captured on 2026-09-28. The first is fixed in v0.2 and shipped as
**v0.2.1**; the `v0.2.0` tag stays on the remote, documented as tagged and never published. The
second is scheduled for v0.3.

Per the interim no-workflow-engine rule and `dl-019`, starting the `bug-ingest` main requires a
coherent plan first; this `plan` element is that plan. It covers **one batch run of the `capture`
phase**. `triage` is the approver's.

**Preconditions:** the next free bug number is `bug-135`. The last existing file is
`bug-134-e2e-smoke-yaml-declares-no-produces.md` (`ls docs/self/docs/04_memory/bugs | sort -V | tail
-1`), and `git log --all --oneline | grep -c bug-135` → 0.

**Produces:** `bug-135-*.md` and `bug-136-*.md` at `status: open`.

## Phases / Steps

### `capture` — role: developer

- `memory.add(type: bug)` — one commit holding both skeletons.
- `memory.submit` — one commit with the bodies, `draft → open`, `release-origin: "v0.2"`,
  `release: ""`. The approver's scheduling (v0.2 for `bug-135`, v0.3 for `bug-136`) is applied at
  triage, not here.
- **Checks (post):**
  - `frontmatter.required: [title, severity]`;
  - `js-yaml` load;
  - `spec-007` scan.

| Bug | Defect | Severity | Target (approver, 2026-09-28) |
|---|---|---|---|
| `bug-135-promote-publishes-a-relative-tarball-path-npm-reads-as-a-git-repo` | `npm publish dist-pack/*.tgz` under npm 10.9 is parsed as a GitHub shorthand; nothing is published | high | v0.2 (v0.2.1) |
| `bug-136-publish-workflow-pins-actions-that-target-node-20` | the four pinned `actions/*` v4 SHAs target Node 20, which the runners removed on 2026-09-23; they are force-run on Node 24 | low | v0.3 |

Duplicate search: `grep -rli "dist-pack\|ls-remote\|node.js 20\|node20" docs/self/docs/04_memory/bugs
docs/self/docs/04_memory/design/dls`. The results are in Execution Notes.

## Handoff

- **Agent:** `capture` and its checks.
- **Approver:**
  - `triage` of both bugs;
  - approving the fix task for `bug-135` into the backlog (`task-108`, filed separately on its own
    task branch).
- **Completion:** both bugs `triaged`. The plan moves `active → done`.

## Execution Notes

- Duplicate search: `grep -rli "dist-pack\|ls-remote\|node.js 20\|node20"` over `bugs/` and `dls/` hits
  `dl-052`, `dl-056`, `dl-068` and `dl-087`. Each only quotes `dist-pack` or `ls-remote` in another
  context (the staging command, the remote-tag check, the promote step's text); none carries either
  defect.
- `memory.add` → the commit before `04461e02`; `memory.submit` → `04461e02`.
- Checks: `js-yaml` load gives `open`/`high` and `open`/`low`, each with a title; `scanText` →
  `{"b":0,"w":0}` for both.
- `triage` is pending with the approver.
