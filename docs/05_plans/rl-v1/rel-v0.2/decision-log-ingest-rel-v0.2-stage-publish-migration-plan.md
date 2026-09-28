---
id: "decision-log-ingest-rel-v0.2-stage-publish-migration-plan"
type: plan
title: "Decision-log ingest — v0.2: migrate the publish pipeline to npm staged publishing"
status: active
version: "1.1"
workflow: "decision-log-ingest"
phase: "rel-v0.2-stage-publish-migration"
element: ""
release: "v0.2"
tmpl_version: 260703
---

## Context

During v0.2's `release-publishing` phase the approver reported the label npm shows for the existing
`NPM_TOKEN`: *"read and write (stage only) access to all the packages"*. That token type was
introduced on 2026-09-18, and npm rejects a direct `npm publish` made with it. `publish.yml`'s
`promote` job runs exactly that command.

For v0.2.0 the approver chose to publish with a direct-publish token, so the pipeline stays unchanged
(`release-publishing-rel-v0.2-plan`, *Approver decision — 2026-09-28: the token for v0.2.0*). That
choice has a deadline: npm plans to remove direct publishing through bypass-2FA tokens in January
2027. The pipeline therefore has to move to `npm stage publish`, and that change touches an accepted
ADR, an approved spec and the CI Node pin. It is a decision, not a bug. The approver ordered it
captured on 2026-09-28.

Per the interim no-workflow-engine rule and `dl-019`, starting the `decision-log-ingest` main requires a
coherent plan first; this `plan` element is that plan. It covers **one run of the `capture` phase**
for a single decision-log. `approve` is the approver's.

**Preconditions:** the next free DL number is `dl-087`. The last numbered file is
`dl-086-a-guard-over-a-filesystem-effect-resolves-on-the-filesystem.md`
(`ls docs/self/docs/04_memory/design/dls | sort -V`), and `git log --all --oneline | grep -c dl-087` → 0.

**Produces:** `docs/04_memory/design/dls/dl-087-publish-through-npm-staged-publishing.md` at
`status: in-discussion`.

## Phases / Steps

Mirrors `decision-log-ingest.yaml` v1.0. The run is started during `release-publishing`, whose
element is the release `minor-v0.2`. The DL records that origin in its Context rather than through a
`release:` stamp: `release: ""`, because release-planning schedules it (the target is v0.3, ahead of
the January 2027 deadline).

### `capture` — role: product-owner

- `memory.add(type: decision-log)` — one commit holding the skeleton: `id` and `status: draft`.
- `memory.submit` — one commit with the full body, `draft → in-discussion`, and
  `context: "release-publishing"`.
- **Checks (post):**
  - `frontmatter.required: [title]`;
  - the frontmatter parses with `js-yaml`;
  - the file scans clean under the `spec-007` patterns.

The DL lays out options and a recommendation, and does not pre-decide. Every external fact cites its
source and the date it was read. Facts not yet verified are marked as such.

## Handoff

- **Agent:** `capture`, and the checks recorded in Execution Notes.
- **Approver:** `approve` (`in-discussion → ready`) or reject, choosing an option in the `Reason:`.
- **Completion:** `dl-087` at `in-discussion`. The plan moves `active → done` once the approve phase
  has run.

## Execution Notes

- `memory.add` → `a567a987`; `memory.submit` → `38d77a2a` (`draft → in-discussion`).
- Checks: the `js-yaml` load returns `in-discussion` with a non-empty `title`; `scanText` returns
  `{"b":0,"w":0,"i":0}`.
- The first check run failed because the worktree has no `node_modules`, and the submit commit went
  ahead anyway. The check was then re-run with `NODE_PATH` set to the main checkout's modules, with the
  result above.
- `approve` is pending with the approver.
