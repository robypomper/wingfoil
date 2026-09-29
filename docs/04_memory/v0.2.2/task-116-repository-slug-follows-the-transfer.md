---
id: "task-116-repository-slug-follows-the-transfer"
type: task
title: "After the transfer to `wingfoil/wingfoil`, the repository slug is swept and the external wiring is re-checked, before the v0.2.2 publish"
status: in-progress
release: "v0.2.2"
priority: "high"
tags: ["v0.2.2", "publishing", "identity"]
ref: "dl-091-package-name-and-mcp-namespace"
bug: []
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here can never leave `triaged`. A single string is still accepted for documents predating dl-045.
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-113-promote-stages-through-an-oidc-trusted-publisher", "task-115-package-discovery-metadata-and-server-json"]
tmpl_version: 260703
---

## Description

`dl-091` Q3 moves the repository from `robypomper/wingfoil` to `wingfoil/wingfoil`. The approver
does the transfer, as the last identity step. npm provenance checks `repository.url` against the
repository that builds the package, so the slug must change **before** the v0.2.2 publish. The plan
is `release-planning-rel-v0.2.2-plan`, *Visibility session outcome* §C.

**Blocked on the approver's transfer.** The task starts only once `gh api repos/wingfoil/wingfoil`
answers.

## Acceptance Criteria

1. The slug is swept in `package.json` (`repository.url`, `homepage`, `bugs.url`), in
   `test/cli/publish-metadata.test.ts` (`REPO_SLUG`) and in `server.json` if it names the repository.
   The task re-runs `grep -rln "robypomper/wingfoil" --exclude-dir={node_modules,dist,.git} .` rather
   than trusting this list. Every remaining hit is either a historical Memory citation, left as
   written because GitHub redirects, or is fixed.
2. `spec-015` §1 is checked against the result. Its 2026-09-29 amendment already fixes `<owner>` as
   `wingfoil`. Anything in `spec-015` still naming the old slug is amended under the approver's
   sign-off, in this task.
3. After the transfer, the following are re-checked on `wingfoil/wingfoil`, and each result is
   recorded in Execution Notes with its command:
   - the `npm-publish` environment and its required reviewer;
   - the Actions secrets, where no `NPM_TOKEN` is expected (`adr-011`);
   - the Claude GitHub App installation on the `wingfoil` organisation;
   - the local remote (`git remote set-url origin https://github.com/wingfoil/wingfoil.git`);
   - the repository settings of the plan's §B.3.
4. The trusted publisher is configured by the approver on npmjs.com for `wingfoil`/`wingfoil`/
   `publish.yml`/`npm-publish`, stage only (`adr-011` point 2). Its presence is confirmed by the
   approver and noted.
5. `npm test` green.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
