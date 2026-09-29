---
id: "task-124-the-service-memory-type"
type: task
title: "A `service` Memory type records the state WingFoil depends on outside the repository, with its ingest workflow and the first services registered"
status: approved
release: "v0.2.2"
priority: "medium"
tags: ["v0.2.2", "memory", "config", "service", "operations"]
ref: "dl-088-a-memory-type-for-state-that-lives-outside-the-repository"
bug: ["bug-159-storage-layout-spec-tree-omits-three-configuration-files"]
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here can never leave `triaged`. A single string is still accepted for documents predating dl-045.
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-111-configuration-moves-to-the-repository-root", "task-123-template-paths-are-relative-to-the-config-root", "task-114-bug-decline-edges-from-triaged-and-planned"]
tmpl_version: 260703   # Orignal template version
---

## Description

`dl-088` (`ready`, `release: v0.2.2`) adds a Memory type, `service`: one unit of state outside the
git repository that the project owns, depends on, or presents itself through. Examples are an
account, a credential held by reference, a registry listing, a platform setting, a domain or a
handle. Its ratification (`e6074c94`) chose state machine (a) `draft → pending → active`, edits to an
`active` service as `docs(self)` commits until `dl-079` settles, and implementation route (a), out of
flow.

**Why a task.** On 2026-09-29 the approver replaced route (a) with a task in the v0.2.2 dev-loop, so
the change goes through the review gate like the rest of the patch. It is §6.8 step 4 of the
retrospective's order. It runs after `task-114`, because both edit `.wingfoil/memory.yaml` and its
`version`.

The shape is `dl-088` §Decision: the `memory.yaml` entry, the frontmatter table, the four body
sections and the security rule.

## Acceptance Criteria

1. `.wingfoil/memory.yaml` gains the `service` type as `dl-088` declares it, annotated `[AUTHORING]`
   citing `dl-088`, with a `version` bump. The machine is `sequence: [draft, pending, active]` with
   `gates.pending.reject: draft`. **Deviation from the text of `dl-088`:** `template.file` is
   `memory/templates/service.md`, relative to the configuration root (`spec-001`, `bug-156`), not the
   `.wingfoil/…` path `dl-088` quotes. *Configuration.*
2. `.wingfoil/memory/templates/service.md` carries the frontmatter of `dl-088`'s table (required
   `title, provider, kind, owner_role, verify`; optional `url, account, renews, repo_refs, decision,
   release`) and the four body sections (Purpose, Configuration, Verification, Management). Its
   comments state the security rule: a `service` never holds a secret value.
3. A `service-ingest` main (`.wingfoil/workflows/custom/service-ingest.yaml`) with `capture`
   (`memory.add` + `memory.submit`, and the `spec-007` scan among `checks.post`), then `approve` by
   the `approver`. It is registered in `.wingfoil/workflows.yaml`, and `workflow list` shows it.
4. Tests on the real, committed configuration. *Red-first:* `service` resolves its scaffold (the
   `task-123` test covers every type), and its machine is `draft → pending → active`, with `reject`
   from `pending` landing on `draft` and `approve` from `active` illegal. On a throwaway clone,
   `memory add --type service` with the pinned build (`npm run -s wingfoil -- …`) creates
   `svc-001-…` under `docs/04_memory/services/`.
5. The type lists are updated wherever they enumerate the Memory types, each with its
   `doc-versioning` bump where it has a version:
   - `.wingfoil/README.md`;
   - `spec-001-memory-yaml-schema` (a dated revision note; the approver signs it at review);
   - `spec-011-storage-layout`'s tree, for the two new files;
   - `CLAUDE.md` §3 and the §5 type table;
   - `docs/user-guide.md` / `docs/cli-reference.md` if they list the types.
   The list is re-derived with `grep -rn "decision-log, tech-spec\|release-line, release" --include=*.md`
   when the task runs, not taken from this AC.
6. **First services registered** through `service-ingest` (`add → submit`, to `pending`; the
   approver runs each `verify` and approves after the review). The candidates are the ones in
   `release-planning-rel-v0.2.2-plan` §"Visibility session outcome" B.1–B.4 and `dl-088`'s backfill
   list. They include the GitHub organisation `wingfoil`, the npm organisation `wingfoilhq`, the
   repository and its settings, the npm package `wingfoil`, and the `npm-publish` environment.
   `NPM_TOKEN` is registered only if it still exists (`adr-011` removes it; `task-113` dropped its use).
   None holds a secret value, and the `spec-007` scan runs on each. The ids are the ones the CLI
   returns.
7. `npm test` green; coverage not regressing; `workflow list` and `check:mcp` exit 0.

## Implementation Notes

- The ids come from `memory add` at commit time (agreement with the parallel viewer session,
  2026-09-29). `services/` is a new directory, so the `{n}` counter starts clean (`bug-087` needs a
  gap to fire).
- The `retrospective` check on `renews` is `dl-088`'s non-blocking follow-up, and it is not in this
  task.
- Registering the benchmark repository is v0.3 (`dl-089`).

## Execution Notes

Branch `task/task-124-the-service-memory-type`, worktree `../.wf2-wt/task-124`, cut from `main` at
`fa3e80b6`. Start: `c311391f` (task `[backlog → in-progress]`). `bug:` is empty, so there is no
`bug.sync_state`. Build for Memory operations: the pinned one (`npm run -s wingfoil -- --version` →
`0.2.1`, after `npm ci`).

### design (architect)

**`depends_on` read (dl-015).** All three are `done` (`grep -m1 '^status:'` on each file →
`status: done`). What this task takes from their Execution Notes:
- `task-111`: the configuration is `.wingfoil/` at the repository root and Memory is
  `docs/04_memory/`, so `memory add --type service` run at the root files the element under
  `docs/04_memory/services/`. Its ruling (item 7) bumps no config `version:` for path-only comment
  edits; this task changes values in `memory.yaml`, so it bumps. Its note on `spec-011` records a
  pre-existing gap (the tree omits `memory/templates/plan.md`, `workflows/custom/user-docs.yaml`,
  `workflows/custom/e2e-smoke.yaml`); this task edits that same tree for its two new files, so it
  closes the gap in the same pass (same class: the tree enumerates the files).
- `task-123`: `template.file` is relative to the configuration root (`resolveAddType` joins it to
  `.wingfoil/`), so `service`'s is `memory/templates/service.md` (AC 1's deviation from `dl-088`'s
  text). Its `test/core/memory-add-scaffold-paths.test.ts` reads the type list from the committed
  `memory.yaml` (`committedTypes`), so it covers `service` without an edit once the type is
  committed; the red test below pins `service` by name, because the generic one cannot go red for a
  type that is not there yet. Its AC 4 finding 1 (`nextSequenceNumber` = count + 1, `bug-087`) does
  not bite here: `docs/04_memory/services/` does not exist (`ls docs/04_memory` → `bugs design
  planning v0.1 v0.2 v0.2.2`), so the counter starts clean and stays gap-free as long as ids are
  taken in order.
- `task-114`: it took `memory.yaml` `1.4 → 1.5` in `f0ba189a` (`git log --format='%h %s' -2 --
  .wingfoil/memory.yaml`), so this task takes it `1.5 → 1.6`. Its test pattern (the committed
  machine read at `HEAD` through `loadMemoryYamlAtHead` / `resolveTypeTransition`, never a copy) is
  reused for the `service` edge table.

**Governing decision and specs.** `dl-088` is `ready` (`grep -m1 '^status:'` → `status: ready`),
ratified in `e6074c94` ("state machine (a) draft, pending, active; edits to an active service as
docs(self) until dl-079 settles; implementation route (a)"); route (a) was replaced by this task on
2026-09-29 (`dev-loop-rel-v0.2.2-plan` §2). `spec-001-memory-yaml-schema` is `approved`, and its
*Revision (2026-09-29)* already specifies `service` (Context type list; worked example `service:`
with `path`, `id_pattern`, `sequence: [ draft, pending, active ]`, `gates.pending.reject: draft`,
`waiting: [ ]`). `spec-007-secret-hygiene-patterns` is `approved`; `spec-011-storage-layout` is
`approved`. No spec is missing, so none is scaffolded. **`spec-001` needs a revision note** (AC 5),
because two of its sentences become false when the type lands: the worked-examples caveat "until
then the file has no `service` type" and "with the `dl-088` caveat above", and the Revision bullet
names route (a) out of flow, which the approver replaced with this task. Written as a dated
revision note in place — **pending the approver's sign-off at this task's review**.

**Design.**
- `memory.yaml`: a `service:` block after `plan:`, `dl-088` §Decision verbatim except `template.file`
  (`memory/templates/service.md`), each field annotated `[AUTHORING] dl-088`; the header's
  provenance-policy list gains `service`; `version: 1.5 → 1.6`. No `src/` change is expected: the
  schema already accepts any type key and any `sequence`/`gates`/`waiting` machine.
- Template `.wingfoil/memory/templates/service.md`: required `title, provider, kind, owner_role,
  verify`; optional `url, account, renews, repo_refs, decision, release`; body Purpose,
  Configuration, Verification, Management; the security rule stated in the frontmatter comment and
  in each body section where a secret could slip in. The scaffold itself must pass `scanText` clean.
- `service-ingest` (`kind: main`): `capture` (role `developer`, as `bug-ingest`: whoever records it;
  `memory.add(type: service)` + `memory.submit`; `checks.post` = the P4.12 `frontmatter.required`
  list + a spec-007 scan check) → `approve` (role `approver`, `memory.approve`, `pending → active`,
  `fallback: capture`). Check expressions are free-form strings (`spec-003` *Check expressions*), so
  the scan check is written as one.

**AC classification (T1).**

| AC | Class | Why |
|---|---|---|
| 1 — `service` in `memory.yaml`, `[AUTHORING]` `dl-088`, `version` bump | configuration | the green change, proven by AC 4's tests |
| 2 — `service.md` template: fields, four sections, security rule | **red-first** | the file does not exist (`ls .wingfoil/memory/templates` → 8 files, no `service.md`); a test pins its required/optional fields, sections and a clean scan |
| 3 — `service-ingest` main, registered, `workflow list` shows it | **red-first** | the file does not exist; a test loads the committed Workflow pillar and asserts the main, its phases and checks |
| 4 — scaffold resolves; machine `draft → pending → active`, reject → `draft`, approve from `active` illegal; e2e `memory add` on a clone | **red-first** (unit) + characterization (manual e2e) | `resolveAddType(root, 'service')` refuses today (unknown type); the e2e runs the pinned build after green |
| 5 — type lists updated | documentation | no behaviour; list re-derived by grep below |
| 6 — first services registered | operations (Memory) | `memory add` → `memory submit` with the pinned build, each command's effect verified |
| 7 — `npm test`, coverage, `workflow list`, `check:mcp` | verification | gates below |

**Baseline** (this worktree at `c311391f`, before any change):
`npx jest --coverage --coverageReporters=text-summary --coverageReporters=json-summary` →
157 suites / 2577 tests passed; stmts 98.62 (3875/3929), branches 94.18 (1993/2116),
funcs 93.79 (650/693), lines 99.47 (3399/3417).

### red (developer) — `f1aca724`

`test/core/service-memory-type.test.ts`, 11 tests, all on this repository's own configuration: the
`memory.yaml` and scaffold committed at `HEAD` (`loadMemoryYamlAtHead`, `resolveAddType`) and the
Workflow pillar through `loadWorkflowsYaml` (the loader `workflow list` uses). No copy of the machine
is written into the test.
- AC 4: `resolveAddType(root, 'service')` → path `docs/04_memory/services/{id}.md`, id pattern
  `svc-{n}-{slug}`, scaffold `.wingfoil/memory/templates/service.md`, required
  `[title, provider, kind, owner_role, verify]`; the edge table for `draft`/`pending`/`active`
  (`submit`/`approve`/`reject`, `deprecate` everywhere), `sequence`, `gates` keys, empty `waiting`.
- AC 2: the scaffold's fields (required ones commented `# REQUIRED`, optional ones `# optional`), its
  four `##` sections in order, the security-rule sentence, and `scanText` → no blocking, no warning.
- AC 3: `workflows.yaml` includes `workflows/custom/service-ingest.yaml`; it loads as `kind: main` with
  phases `capture` (actions, `produces`, the P4.12 check and a `spec-007` check) and `approve`
  (`approver`, `memory.approve`, `fallback: capture`).

`npx jest test/core/service-memory-type.test.ts` → **11 failed**, each for the absence of the type or
the file: "unknown memory type 'service' (not defined in memory.yaml)", the include list without
`service-ingest.yaml`, `Object.keys(types)` without `service`. `npx eslint` on the file → exit 0.

### green (developer) — `d7a15803`, `9a202437`

- `.wingfoil/memory.yaml` `1.5 → 1.6`: the `service` block, `dl-088` §Decision except `template.file:
  "memory/templates/service.md"`, every field `[AUTHORING] dl-088`, `states` citing the ratification
  `e6074c94`. The header's provenance-policy list gains `service` and `plan` (the latter was missing
  from it: same class, fixed in the same edit).
- `.wingfoil/memory/templates/service.md`: `dl-088`'s frontmatter table, the four sections, the
  security rule in an HTML comment. `tmpl_version: 260929` (a new scaffold's `YYMMDD` stamp, per
  `spec-010`'s `tmpl_version` row).
- `.wingfoil/workflows/custom/service-ingest.yaml` v1.0 and its `include` line in `workflows.yaml`
  (`1.1 → 1.2`; last bump committed before this task: `git log -- .wingfoil/workflows.yaml` → only the
  `task-111` rename).
- The tests read `HEAD`, so they ran after the commit: 10 passed, 1 failed — the security-rule
  sentence wrapped across two comment lines, so the regex missed it. `9a202437` puts the sentence on
  one line (template only); then `npx jest test/core/service-memory-type.test.ts
  test/core/memory-add-scaffold-paths.test.ts` → **14 passed**. `task-123`'s generic scaffold test
  now covers `service` too, unedited (it reads the committed type list).
- Full suite after green: `npx jest` → 158 suites / 2589 tests passed (baseline 157 / 2577: the 11
  new tests plus one `it.each` row in `test/core/latency-budget-placement.test.ts`, which scans every
  test file). No `src/` change (`git diff fa3e80b6 HEAD --stat -- src` → nothing).

**AC 4 end to end, on a throwaway clone** (`git clone --branch task/task-124-… <worktree>
$(mktemp -d <session scratchpad>/e2e-124-XXXX)/wf` at `9a202437`, `node_modules` symlinked from the
worktree; `wingfoil` = the pinned build, `npm run -s wingfoil --` → 0.2.1; the clone's git identity is
the approver's; deleted afterwards, nothing reached this repository):

| command | output | commit |
|---|---|---|
| `memory add --type service --title "AC4 probe service" --format json` | `{"id":"svc-001-ac4-probe-service","path":"docs/04_memory/services/svc-001-ac4-probe-service.md"}` exit 0 | `wf(service): add svc-001-ac4-probe-service`, 1 file, author Roberto Pompermaier |
| `memory submit svc-002-ac4-probe-two` (required fields empty) | `error: missing required field on submit: provider, kind, owner_role, verify` exit 1 | none |
| `memory submit svc-001-…` (fields filled) | `from: draft, to: pending` exit 0 | `wf(service): submit svc-001-ac4-probe-service` |
| `memory reject svc-001-… --reason "probe reject"` | `from: pending, to: draft` exit 0 | `wf(service): reject … [pending → draft]`; `rejection_reason: "probe reject"` |
| `memory approve svc-001-… --reason "probe approve"` (after a resubmit) | `from: pending, to: active` exit 0 | `wf(service): approve … [pending → active]` |
| `memory approve svc-001-… --reason "again"` (`active`) | `error: illegal transition active -> (none) for type 'service'` exit 1 | none |
| `memory deprecate svc-001-… --reason "probe retire"` | `from: active, to: deprecated` exit 0 | `wf(service): deprecate … [active → deprecated]` |

### refactor (developer) — `12477e03`, `27c2cc50`

No code to refactor; the service scaffold's security comment was reflowed to ≤ 100 columns
(`12477e03`). The pass fixed the type lists (AC 5), re-derived with the AC's own command
`grep -rn "decision-log, tech-spec\|release-line, release" --include=*.md` plus
`git grep -n -E "tech-spec" | grep -E "bug|plan"` and
`git grep -n -iE "three ingest|3 ingest|ingest mains|adr-ingest"` over everything outside the v0.1/v0.2
task files, the plans and the vision/requirements documents:

| Document | What was stale | Version |
|---|---|---|
| `.wingfoil/README.md` | layout table (types not listed; "4 `main` (… + 3 ingest)"), "three small ingest mains", the ingest list, "the three ingest mains"; **also** "`memory add` still cannot add an element here … (`bug-156`)", false since `task-123` | no version field |
| `.wingfoil/WORKFLOW.md` | "three independent ingest mains", "Three lightweight `kind: main` workflows", the ingest diagram and table; the state-machine section drew no `plan` and no `service`; the roles summary | no version field |
| `.wingfoil/memory.yaml` header | the provenance-policy list named neither `plan` nor `service` | bumped with the value change (1.6) |
| `CLAUDE.md` §3 | the pinned build's no-token type list (`service` qualifies: `svc-{n}-{slug}`, no path token); the file table's type list and "three ingest mains"; §5 type table (new `service` row); §6 ingest list | no version field |
| `spec-001-memory-yaml-schema` | Context ("specified here ahead of the configuration change"), the worked-examples caveat "until then the file has no `service` type", "with the `dl-088` caveat above"; the Revision bullet naming route (a) | dated revision note, **pending the approver's sign-off** |
| `spec-004-mcp-surface-contract` | `{type}` enumeration had seven types (no `plan`, no `service`) | dated revision note, pending sign-off |
| `spec-010-memory-frontmatter-schema` | `type` row "and `service` once `dl-088`'s configuration change lands" | dated revision note, pending sign-off |
| `spec-011-storage-layout` | tree and both paragraphs lacked `service.md` and `service-ingest.yaml` ("All 4 startable mains"); **also** closed the gap `task-111` recorded (`plan.md`, `user-docs.yaml`, `e2e-smoke.yaml`): every file of `find .wingfoil -maxdepth 4 -type f` is now listed (checked with a loop over `ls` of both directories → no `MISSING`) | dated revision note, pending sign-off |

Tech-specs carry no `version:` (`dl-047`), so each revision is a dated note. Kept as written, on
purpose: `adr-007` and `adr-008` (accepted decisions enumerating the types of their time), `dl-019`,
`task-010` (v0.1 records), `spec-003` "the three ingest mains" (a consequence stated about the files
that existed when it was approved). Not type lists of this repository, so untouched:
`docs/user-guide.md` lines on `memory/templates/` and `workflows/custom/` (they describe what `init`
scaffolds, `MEMORY_TYPES` in `src/storage/templates.ts`), `docs/cli-reference.md` (enumerates no type:
`grep -n "tech-spec\|decision-log" docs/cli-reference.md` → one JSON path example only), `README.md`
and `docs/agents.md` (open lists ending in "…"), `COLLABORATION.md` (contribution kinds).

### services (AC 6)

**Candidates** (`release-planning-rel-v0.2.2-plan` §"External identities registered", §B.1–B.4;
`dl-088` Actions backfill). **`NPM_TOKEN` still exists:** `gh secret list --env npm-publish` →
`NPM_TOKEN  2026-09-28T09:25:34Z`; `gh secret list` (repository level) → nothing; so it is registered,
as a `credential` by reference, marked for retirement by `adr-011` point 2. Registered with the pinned
build from the worktree root, on this branch, in order; every command exit 0, every commit one file
under `docs/04_memory/services/`, author `Roberto Pompermaier <robypomper@gmail.com>`
(`git show --name-only`, `git log -1 --format='%an <%ae>'` after each):

| id (as the CLI returned it) | provider · kind | `verify` | add | submit | state |
|---|---|---|---|---|---|
| `svc-001-github-organisation-wingfoil` | GitHub · account | `gh api orgs/wingfoil --jq .login` | `09ec6923` | `9317e391` | pending |
| `svc-002-npm-organisation-wingfoilhq` | npmjs.com · account | `curl -s -o /dev/null -w '%{http_code}' https://registry.npmjs.org/-/org/wingfoilhq/package` | `1d3d1307` | `a532d641` | pending |
| `svc-003-github-repository-wingfoil-and-its-public-visibility` | GitHub · setting | `gh api repos/robypomper/wingfoil --jq '{full_name,visibility,private,license:.license.spdx_id}'` | `21431c38` | `3b75ec68` | pending |
| `svc-004-github-repository-settings` | GitHub · setting | `gh api repos/robypomper/wingfoil --jq '{description,homepage,topics,has_discussions,has_issues,has_wiki,has_projects}'` | `db246fb8` | `24b588bc` | pending |
| `svc-005-npm-package-wingfoil` | npmjs.com · listing | `npm view wingfoil name version dist-tags maintainers repository.url --json` | `7dd856d0` | `e8a11e53` | pending |
| `svc-006-github-environment-npm-publish` | GitHub · setting | `gh api repos/robypomper/wingfoil/environments/npm-publish --jq …` (+ `…/deployment-branch-policies`) | `64488474` | `ae715911` | pending |
| `svc-007-github-actions-secret-npm-token` | GitHub · credential | `gh secret list --env npm-publish` | `d16c6d09` | `892fe4a7` | pending |

Commands used: `npm run -s wingfoil -- memory add --type service --title "<short>" --format json`,
then the body and frontmatter filled on disk, then `npm run -s wingfoil -- memory submit <id> --format
json` (→ `"from":"draft","to":"pending"`), which committed content and status together
(`git show --stat 892fe4a7` → 1 file, 44+/28−). Every `verify` was run read-only on 2026-09-29 and its
output is quoted in the element; facts come from the cited documents, and where a document gives none
the element says so rather than supply one.

**Secret scan** (`spec-007`): a node script over the built `dist/validation/secret-scan.js`
(`src/validation/secret-scan.ts` unchanged since `3513ecc5`) ran `scanText` on each file before
submit and again on the committed files → all seven `blocking: 0, warnings: 0, info: 0`, and all five
required fields non-empty. The full suite's REQ-SEC-08 surface scan also covers `docs/04_memory`.

**Not registered:** the npm trusted publisher (`adr-011` point 2) — not configured yet, and a
`service` records what has been set up (`dl-088`); `wingfoil.dev`, `wingfoilhq.dev`, Bluesky and the
social handles (after v0.3, §"External identities registered", §E); the benchmark repository (v0.3,
`dl-089`); the Claude GitHub App installation, named in §C only as a post-transfer check.

**For the approver, before approving each service:**
1. `svc-001`: `gh api orgs/wingfoil` returns `name: "wingFoil"`; §B.1 recommended "WingFoil". Confirm
   or correct the profile name, and the category line (not read).
2. `svc-005`: account 2FA was disabled on 2026-09-29 (§"Approver inputs received"); its current state
   is not readable without credentials.
3. `svc-007`: the link between the secret's value and the stage-only token expiring 2026-12-27 is an
   inference (the only token recorded); confirm on npmjs.com → Access Tokens.
4. `svc-004`: the Discussions categories and the absent social preview are the approver's report; no
   command read them.
5. After the transfer to `wingfoil/wingfoil`, `svc-003/004/006/007`'s `url`/`account`/`verify` name
   the old slug and are edited as `docs(self)` (`dl-088` option 2).

### review (reviewer)

- **`main` moved during the task** (`git log --oneline HEAD..main` → 5 commits, to `ab5a361d`:
  `bug-165` filed and triaged, `bug-092` closed, a plan update). `git merge main` → `934f9622`, no
  conflict. `bug-165` (the illegal-transition message names the canonical edge) is the class of the
  e2e's `illegal transition active -> (none)` above: the pinned 0.2.1 names no target from a terminal
  state; nothing to do here.
- **Checks, at `934f9622`:**

| Check | Command | Result |
|---|---|---|
| unit + BDD | `npx jest --coverage --coverageReporters=text-summary --coverageReporters=json-summary` | 158 suites / 2589 tests passed (baseline 157 / 2577) |
| coverage before → after | same | stmts 98.62 (3875/3929) → 98.62 (3875/3929); branches 94.18 (1993/2116) → 94.18; funcs 93.79 (650/693) → 93.79; lines 99.47 (3399/3417) → 99.47 — no `src/` change |
| `lint.clean` | `npm run lint` | exit 0 |
| `docs.api.*` | `npm run docs:api` | exit 0 |
| types | `npx tsc --noEmit` | exit 0 |
| `workflow list` | `npm run -s wingfoil -- workflow list --format json` | exit 0; mains `sw-life-cycle, bug-ingest, decision-log-ingest, adr-ingest, service-ingest` |
| MCP registration | `npm run check:mcp` | exit 0 (pinned 0.2.1, prompts 8, resources 2) |

- **Needs the approver's sign-off at this review:** the dated revision notes in `spec-001`,
  `spec-004`, `spec-010`, `spec-011`; and each service's `approve [pending → active]` after running its
  `verify` (items 1–5 above).
- **Findings, not fixed here:**
  - the `traceability` directive gives `release` on "every base document (adr, decision-log,
    tech-spec, bug)" one uniform meaning — the release the element's implementation is assigned to;
    `dl-088` gives `service.release` another — the release in which it was set up. `service` is not in
    that list, so nothing is violated today, but `build-backlog`'s `element.set_release` must not stamp
    services. Not filed: the approver decides whether it needs an element.
- **Fixed in-task at review (`4a06e7c5`):** `WORKFLOW.md`'s ADR, tech-spec and decision-log
  diagrams drew the retired `rejected` state and the decision-log's old default machine (`spec-001`
  Consequences, `dl-017`), and the `seed-dls` and `decision-log-ingest` boxes gave a decision-log
  `draft → pending`. Found while adding the `plan`/`service` diagrams to the same section; redrawn from
  `memory.yaml` (`grep -n "rejected\|pending → approved" .wingfoil/WORKFLOW.md` afterwards → only
  `seed-specs`' tech-spec `draft → pending → approved`, which is correct). Not a type list, so recorded
  here rather than in the refactor table.

**Approver's ruling at the review gate (2026-09-29).** Approved, with the revisions of `spec-001`,
`spec-004`, `spec-010` and `spec-011` signed off. `bug-159` (`spec-011`'s tree omitted three files,
`triaged`, v0.3) is **absorbed** into this task (`dl-045`), because this task's `spec-011` revision
lists every file under `.wingfoil/`. Checked with `find .wingfoil -maxdepth 4 -type f -printf '%f\n'`
against the file names in the tree block: no file is missing. Its `release` moves to v0.2.2 and it closes
with this task. The double meaning of `release` on a `service` (finding 6) is filed as a bug on
`main`.
