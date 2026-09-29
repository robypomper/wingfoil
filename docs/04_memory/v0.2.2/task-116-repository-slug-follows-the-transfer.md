---
id: "task-116-repository-slug-follows-the-transfer"
type: task
title: "After the transfer to `wingfoil/wingfoil`, the repository slug is swept and the external wiring is re-checked, before the v0.2.2 publish"
status: in-review
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



### red / green (developer)

- **Red**: `REPO_SLUG` in `test/cli/publish-metadata.test.ts` set to
  `wingfoil/wingfoil`. Then `npx jest test/cli/publish-metadata.test.ts` → 5 failed, 63 passed: the
  four `package.json` attribution cases and the `server.json` repository case.
- **Green:** `package.json` (`repository.url`, `homepage`, `bugs.url`) and `server.json`
  (`repository.url`) name `github.com/wingfoil/wingfoil`. Then `npx jest
  test/cli/publish-metadata.test.ts test/cli/check-release-tag.test.ts` → 75 passed. `npm pack
  --dry-run --json` → 339 files, unchanged.
- **Services:** `svc-003`, `svc-004`, `svc-006`, `svc-007` updated (`verify`, `url`, `account`, and a
  post-transfer reading in each Verification). `scanText` on each → 0 blocking, 0 warnings. They stay
  `pending`.
- **Full checks:** `npx tsc --noEmit` clean; `npx jest` → 160 suites, 2624 tests passed; `npm run
  lint` exit 0.

### post-transfer verification (AC 3, 2026-09-29)

| Check | Command | Result |
|---|---|---|
| repository | `gh api repos/wingfoil/wingfoil --jq '{full_name,visibility,license:.license.spdx_id}'` | `wingfoil/wingfoil`, public, MIT; `robypomper/wingfoil` redirects |
| tags | `git ls-remote --tags origin` | `v0.2.0`, `v0.2.1` carried over |
| `npm-publish` environment | `gh api repos/wingfoil/wingfoil/environments --jq …` | present; `branch_policy` (`v*` tags) and `required_reviewers` (`robypomper`) carried over |
| secrets | `gh api …/environments/npm-publish/secrets`; `gh api …/actions/secrets` | environment `NPM_TOKEN` still present (updated 2026-09-28T09:25:34Z); no repository-level secret. `adr-011` removes it after the trusted publisher exists |
| Claude GitHub App | `gh api orgs/wingfoil/installations --jq '.installations[]…'` | first read: no installation. After the approver installed it (2026-09-29 17:34 +02:00): app `claude`, installation `166199613`, `repository_selection: all` (the organisation's only repository is `wingfoil/wingfoil`). Registered as `svc-008-claude-github-app-on-the-wingfoil-organisation`, `pending` |
| local remote | `git remote set-url origin git@github.com:wingfoil/wingfoil.git`; `git fetch origin` | done; `main` equals `origin/main` after the fetch, except the one local commit `fb715a93` |
| repository settings (§B.3) | `gh api repos/wingfoil/wingfoil --jq '{description,homepage,topics,…}'`; GraphQL `discussionCategories` | description, homepage, 14 topics, Discussions on (Announcements, Ideas, Q&A, Show and tell), Issues on, Wiki and Projects off: all carried over |
| organisation | `gh api orgs/wingfoil --jq '{name,two_factor_requirement_enabled,default_repository_permission}'` | 2FA required, base permission `none`; profile name still `wingFoil` (§B.1 recommends "WingFoil") |

### npm side (AC 4, 2026-09-29)

- The approver configured the **trusted publisher** on npmjs.com for the package `wingfoil`: GitHub
  Actions, `wingfoil`/`wingfoil`/`publish.yml`/`npm-publish`, stage only. The same day they enabled
  account 2FA, set publishing access to "require 2FA and disallow tokens", and revoked the stage-only
  token (the approver's confirmation, "fatto", at this task's review). No public command reads a
  trusted publisher back. The end-to-end proof is the v0.2.2 tag run, in `release-publishing`.
- On the approver's instruction the environment secret was deleted: `gh secret delete NPM_TOKEN --env
  npm-publish -R wingfoil/wingfoil` → exit 0. Then `gh api
  repos/wingfoil/wingfoil/environments/npm-publish/secrets` → `total_count: 0`, and
  `…/actions/secrets` → `0`. The repository holds no publish credential of any kind.
- Services: `svc-007` `deprecated` (`9ad827ad`, pinned `memory deprecate`); `svc-009` registered
  (`85ae6a9a` add, pinned `memory submit` → `pending`); `svc-005` updated; `svc-008` (the Claude
  GitHub App, installed by the approver) registered earlier in this task. All `pending` services wait
  for the approver's `verify` and approval.

### review

- The AC 1 sweep is complete. The remaining `robypomper/wingfoil` hits are historical citations,
  plus `svc-005`'s record of `wingfoil@0.2.1`'s published `repository.url`.
- AC 2 needed no amendment, AC 3 is the table above, and AC 4 the npm section.
- AC 5: `npx tsc --noEmit` clean; `npx jest` → 160 suites, 2624 tests passed; `npm run lint` exit 0 (2026-09-29, after the service edits). `git log HEAD..main` → 0.

**Approver's ruling at the review gate (2026-09-29).** "fatto, cancella il secret e chiudi task-116":
the npm setup is confirmed, the secret deleted on instruction, and the task approved.
