---
id: "task-124-the-service-memory-type"
type: task
title: "A `service` Memory type records the state WingFoil depends on outside the repository, with its ingest workflow and the first services registered"
status: in-progress
release: "v0.2.2"
priority: "medium"
tags: ["v0.2.2", "memory", "config", "service", "operations"]
ref: "dl-088-a-memory-type-for-state-that-lives-outside-the-repository"
bug: []                # optional — LIST of bug ids this task closes (dl-045). Two cases: a fix task derived from a bug
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

### red (developer)

### green (developer)

### refactor (developer)

### services (AC 6)

### review (reviewer)
