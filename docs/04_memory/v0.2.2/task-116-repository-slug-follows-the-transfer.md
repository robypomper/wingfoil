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

### design (architect)

- **depends_on acknowledged** (`dl-015`): `task-113` (`done`, merge `83f6fd1b`) left the trusted
  publisher to be configured after the transfer, against `wingfoil`/`wingfoil`/`publish.yml`/
  `npm-publish`. `task-115` (`done`, merge `ebfccee5`) put the current slug into `server.json` and
  named `task-116` for the switch. `task-124` (`done`, `a9523820`) registered `svc-003`, `svc-004`,
  `svc-006` and `svc-007` with the old slug and asked for a `docs(self)` update after the transfer.
- **Precondition met:** `gh api repos/wingfoil/wingfoil --jq .full_name` → `wingfoil/wingfoil`, and
  `gh api repos/robypomper/wingfoil --jq .full_name` → `wingfoil/wingfoil` (the redirect), on
  2026-09-29.
- **Spec:** `spec-015` §1 already fixes `<owner>` as `wingfoil` (lines 37–43, amended `0a4f7a9c`).
  `grep -n robypomper spec-015-packaging-publishing.md` finds only the `author` e-mail, so AC 2 needs
  no amendment.
- **AC classification (T1):**
  1. The slug sweep: *red-first* for the metadata (`test/cli/publish-metadata.test.ts` `REPO_SLUG`
     drives the `package.json` and `server.json` assertions), *configuration* for the files.
  2. `spec-015` check: *verification*, nothing to amend.
  3. Post-transfer re-checks: *verification*, each with its command below.
  4. Trusted publisher: *the approver's*, recorded when confirmed.
  5. `npm test`.
- **Sweep scope** (`grep -rln "robypomper/wingfoil" --exclude-dir={node_modules,dist,.git,coverage} .`
  → 27 files on `main` at `fb715a93`):
  - changed: `package.json`, `server.json`, `test/cli/publish-metadata.test.ts`, and the
    services `svc-003`, `svc-004`, `svc-006`, `svc-007`, whose `verify`, `url` and `account` name
    the live repository;
  - left as written: the DLs, bugs, plans and done tasks (historical citations, which GitHub
    redirects), `svc-001` (it states the transfer itself), and `svc-005`, which records the
    `repository.url` that the **published** `wingfoil@0.2.1` carries, still true on the registry.


