---
id: release-planning-rel-v0.3-plan
type: plan
title: "Release-planning — rel-v0.3"
status: active
version: "1.4"
workflow: "release-planning"
phase: "rel-v0.3"
element: "minor-v0.3"
release: "v0.3"
tmpl_version: 260703
---

## Context

`minor-v0.3` (`docs/04_memory/planning/rl-v1/minor-v0.3.md`, "WingFoil v0.3 - Project Workflow") is
the next minor of release-line `rl-v1`. The approver set the order on 2026-09-29: all of `patch-v0.2.2`
first (planning, implementation, publish), then this planning. This plan executes
`release-planning` (`.wingfoil/workflows/custom/release-planning.yaml` v1.3) per `dl-019`, on
branch `design/release_planning_v0.3` (worktree `.wf2-wt/release-planning-v0.3`, `dl-024`
branch-per-phase), merged into `main` with `--no-ff` at the end.

**Preconditions (verified 2026-09-29 on this branch, cut from `main` at `9f95f47e`).**
- `patch-v0.2.2` is `released`: `awk '/^status:/{print $2;exit}' docs/04_memory/planning/rl-v1/patch-v0.2.2.md`
  → `released`. `npm view wingfoil versions` → `0.2.1, 0.2.2`; `git ls-remote --tags origin v0.2.2`
  → `3b628557`, peeled to `12537b62`. The tag exists, so `dl-092`'s parallel-release rule (a) no
  longer applies.
- `main` equals `origin/main`: `git rev-list --left-right --count origin/main...main` → `0 0`.
- Identity: `git config --local user.email` → `robypomper@gmail.com` (`dl-094`).
- The configuration is at the repository root (`task-111`, merge `582ec08a`), so the Memory verbs of
  the pinned build act on this repository. Every Memory operation in this plan uses
  `npm run -s wingfoil -- memory …` where the verb exists, and is checked against its declared effect
  afterwards (commit, diff, exit code). Operations the verbs cannot do are done by hand in the
  `CLAUDE.md` §5.1 format and say so.
- Next free ids, allocated across every local and remote ref (`dl-101`): `task-126`, `adr-012`,
  `spec-016`, `bug-175`, `dl-131`, `svc-010`. Command: for each ref in
  `git for-each-ref refs/heads refs/remotes`, `git ls-tree -r --name-only <ref> -- docs/04_memory`,
  highest number + 1. Re-run before each `add`.
- No task of any earlier release is left undone: every `docs/04_memory/v0.*/task-*.md` is `done`.

**Population in scope of the selection filter** (`release` empty or `v0.3`, `dl-016`), counted on
this branch with `awk '/^status:/'` and `awk -F'"' '/^release:/'` on each file:

| Type | Assigned to v0.3 | Unscheduled (`release: ""`) |
|---|---|---|
| bug | 33 `triaged`, 2 `open` (`bug-087`, `bug-088`) | 66 `open`, 4 `triaged` (`bug-019`, `bug-132`, `bug-133`, `bug-134`) |
| decision-log | 34 `ready`, 2 `in-discussion` (`dl-039`, `dl-040`) | 26 `in-discussion`, 40 `ready` |
| adr / tech-spec | none | 7 `accepted` / 14 `approved` (reference, nothing pending) |

The 40 unscheduled `ready` decision-logs predate `dl-016`'s `release` field. build-backlog reads each
one against the code before it decides whether a task is still owed; it does not assume either way.

**Approver rulings received before this plan (2026-09-29, planning conversation).** They fix the
shape of the scope and are cited by the steps below:
- R1. The Determinism Index becomes composite: **I**nput (WingFoil, guaranteed, `REQ-SYS-07`),
  **P**rocess conformance (WingFoil + agent, measured on every run), **O**utcome equivalence (the
  customer's agent and model, measured, never promised). Code similarity is out of scope. **O is a
  reported metric, not a release objective.** To be filed as a decision-log, coordinated with
  `dl-112`, which already rewrites the brief's determinism sentence.
- R2. `wingfoil agent execute` launches **the agent's own CLI** through a declared per-agent adapter,
  not an SDK. This replaces `REQ-INT-07`'s "wraps the AI Agent SDK" and matches `bug-138` (the SDK
  was removed in 0.2.2).
- R3. Roadmap: **P4.18–P4.20 move from v0.3 to v0.4**; **workflow checks (P4.12) stay in v1.0**;
  **agent execution (P5.3.1) stays in v0.3**, as originally planned.
- R4. dev-loop gains separation of duties: `red` by `qa`, `green`/`refactor` by `developer`, `review`
  by `reviewer`, each phase run by an independent agent. The rules land in v0.3; the checks that
  enforce them (`tests.unchanged`, distinct executors) land with P4.12 in v1.0.
- R5. Agent tracking is split: v0.3 records each run (`dl-114`'s record plus the agent's session id)
  and ships `agent list --past/--waiting` and `agent show`, with `fresh` as the default execution
  mode; v0.4 adds the live-run registry, `--resume` / `--ref` and an MCP Resource for a UI.
- R6. End of each release: the results of every test suite (unit, integration, BDD, smoke) and the
  coverage are published.
- R7. `glama.json` goes to v0.3 (v0.2.2 was already in release).
- R8. The three `service` candidates collected during v0.2.2 are registered during this planning,
  not before.
- R9. A new decision-log amends `dl-089`, `dl-099` and `dl-100` for the fix-task tail measured at
  the end of v0.2 (proposal approved; options chosen at ratification).
- R10. At the opening of the planning, every unresolved bug is reviewed for inclusion in v0.3.

## Phases / Steps

Every Memory operation is one scoped `wf({type}): {verb} {ids}` commit (§5.1). Approver gates (⛔)
run only on the approver's explicit instruction, with `Approver:` and `Reason:` in the commit body.
Ingest workflows started from a step (`bug-ingest`, `decision-log-ingest`, `service-ingest`) get
their own plan under `docs/05_plans/rl-v1/rel-v0.3/`, as v0.2.2 did.

0. **advance-pinned-build** (tech-lead, no gate). **Done 2026-09-29.**
   - pre: `npm run -s wingfoil -- --version` → `0.2.1`, the pinned version.
   - `npm install --save-dev --save-exact wingfoil-released@npm:wingfoil@0.2.2`; commit `2daa0a21`,
     which changes only `package.json` and `package-lock.json`. The lock drops `@anthropic-ai/sdk` and
     its six-package subtree, which 0.2.2 no longer depends on (`bug-138`).
   - post: `npm run -s wingfoil -- --version` → `0.2.2`; `npm run check:lockfile` → exit 0;
     `npm run check:mcp` → exit 0 (prompts: 8, resources: 2).
   - This plan was then added with the pinned build:
     `memory add --type plan --title "Release-planning — rel-v0.3" --set workflow=release-planning --set phase=rel-v0.3 --set scope=rl-v1/rel-v0.3`
     → `fad3f2ca wf(plan): add release-planning-rel-v0.3-plan`, one file, subject only.

1. **define-scope** (product-owner, no gate). `minor-v0.3` is already `planning` (`initial-design`),
   so `memory.submit` is a no-op. The step rewrites the release's content and the roadmap around it:
   - `minor-v0.3` `features:` loses P4.18, P4.19, P4.20 (R3); Scope and Pillar Focus are rewritten
     for what v0.3 is: WingFoil **says what to do and tracks it** (workflow commands, state deduction,
     approval routing, fallback, `include`, agent execution), while **executing steps and checks** is
     v1.0 (P4.10, P4.12).
   - Success Criteria: "Memory lifecycle verbs integrated into workflow steps" needs P4.10, which is
     v1.0. Proposed wording: "`workflow next` names the step's verb and role; `agent execute --next`
     launches the agent on it". The determinism line of `minor-v1.0` becomes "Determinism Index
     reported (I, P, O)" once R1's decision-log is `ready`.
   - `minor-v0.4` `features:` gains P4.18–P4.20; its Success Criteria already list the reference
     templates.
   - Vision documents, each with a `doc-versioning` bump: `07_sequencer.md` (v0.3 deliverables lose
     "reference templates"); `06_features.md` (P4.18–P4.20 move from the v1.0 extras to v0.4; P4.12,
     P4.14, P4.15 and P4.5 gain the synonyms *gate/verifier*, *remediation loop*, *human + agent
     verification* and *pending gates*, at near-zero cost and with no new feature ids). The
     determinism and `REQ-INT-07` wording wait for their decision-log and ADR (steps 3–4).
   - Register the three `service` candidates (R8) through `service-ingest` (own plan), `add → submit`;
     the approver approves after running each `verify`:
     `svc-010` GitHub Release v0.2.1, `svc-011` AlternativeTo listing, `svc-012` mcp.so listing. The
     mcp.so element stays `pending` until the listing is published. Its field values are the ones the
     approver supplied during the planning conversation, carried verbatim into the ingest plan.
   - Budget: `dl-096` Q1 (a) keeps budgets in the vision documents; at build-backlog it is computed as
     *tasks ÷ 6.5 per active day* and recorded in `minor-v0.3`'s Planning notes.
   **Done 2026-09-29.**
   - `c05bb757`: `minor-v0.3` (features without P4.18–P4.20, Scope, Pillar Focus, Success Criteria,
     Planning notes) and `minor-v0.4` (features with P4.18–P4.20, Planning notes). Both stay
     `planning`.
   - `2a7ee7e7`: `06_features.md` v1.5 (rows moved, synonyms), `07_sequencer.md` v1.5 (a *Scope changes
     since the original plan* subsection; proxy budgets v0.3 ≈ 20, v0.4 ≈ 9, total unchanged; the
     original week tables untouched), `08_mvp-canvas.md` v1.3 (its reference table carries the new
     versions).
   - Services, through `service-ingest-rel-v0.3-listings-plan` (`bf05de0d` add, `9cec4ea1` submit):
     `svc-010` (`05816fdf` add, `e284968b` submit), `svc-011` (`b24e00ce`, `d3f91fd1`), `svc-012`
     (`32a4e97f`, `53bb8100`), all `pending`. The `spec-007` scan (`scanText` from the `main` build)
     reported no finding on the three files. Every commit changed exactly one file. Next: the approver's
     `verify` and approval; `svc-012` waits for mcp.so to publish the listing.

2. **triage-bugs** (tech-lead, ⛔; R10). Candidates: the 66 `open` unscheduled bugs, the 2 `open` v0.3
   bugs, and one candidate observed on 2026-09-29: `wingfoil mcp` answers `tools/list` with
   `-32601 Method not found` (stdio probe on the `main` build: `prompts/list` → 8, `tools/list` →
   -32601). The survey found it is **already `bug-151`** (`triaged`, v0.3), so nothing new is filed;
   its evidence (the production server never runs `registrar.ts:74`, and that line would not install a
   `tools/list` handler anyway) goes to `bug-151`'s task at build-backlog. The agent prepares a disposition table
   grouped by area (CLI grammar, Memory, workflow, MCP, docs, publish, tests), each row with a
   proposed `approve [open → triaged]` for v0.3, `reject [open → closed]` with a reason, or *not
   selected* (left `open`, named for a later release). The approver rules per group. The four
   `triaged` unscheduled bugs are carried into build-backlog's selection.
   Housekeeping found while counting: two v0.3 bugs keep the template comment after the value on
   their `release:` line; fixed in the build-backlog stamping commit.
   **Done 2026-09-29**, approver ruling: **option A**, the whole Appendix A proposal.
   - 48 `memory approve [open → triaged]`, one commit each (the pinned build takes one id per call,
     `bug-171`), from `61b2c1db` (`bug-028`) to `b0dc6ce8` (`bug-154`); each `Reason:` names the gate, the ruling and the
     bug's own line from Appendix A. Afterwards all 52 selected bugs read `triaged`
     (`awk '/^status:/'` on each). The four already-`triaged` ones (`bug-019`, `bug-132`, `bug-133`,
     `bug-134`) get `release: v0.3` at build-backlog with the rest.
   - 5 `memory reject [open → closed]` with `rejection_reason` set: `bug-024`, `bug-032`, `bug-048`,
     `bug-068`, `bug-127`. Before `bug-127` was closed, its reproduction cases were folded into
     `bug-165` (`66cf5920`).
   - The 15 bugs proposed for v0.4 are untouched (`open`, no `release`).
   - New finding captured through `bug-ingest-rel-v0.3-planning-findings-plan`: `bug-175` (the
     define-scope `kind` check), `open`, awaiting its triage gate.

3. **reconcile-governance** (product-owner, ⛔). In scope and not `ready`: `dl-039`, `dl-040` (v0.3),
   and the 26 unscheduled `in-discussion` decision-logs, for which the agent proposes select /
   not-select. Before this gate, the new decision-logs from the planning conversation are filed
   through `decision-log-ingest` (own plan) at `in-discussion`, `release: "v0.3"`, and ratified here:
   - **DL determinism-index-scope** (R1). Consequences on the vision are listed, not applied; the
     approver's pick for the open question is already R1 (reported metric).
   - **DL vision-change process** (idea 2): a process to change the vision and ingest a new feature,
     which the project lacks; `lean-inception`, `user-story-mapping` and `specification-*` run once.
     One process, with a feature ingest as its special case, descending the documentary chain for the
     delta only and ending with the feature assigned to a release.
   - **DL fix-task tail** (R9), "Amends: `dl-089`, `dl-099`, `dl-100`", with the v0.2 measurement
     (29 feature / 46 fix tasks; 37 of the 43 tasks added after planning were fixes) and its command.
   - **DL dev-loop separation of duties** (R4), including the `executor` independence attribute and
     the "tests written in `red` are not edited in `green`" rule.
   - **DL agent run tracking** (R5), amending `dl-114`'s Q2 with the session id and declaring the
     `fresh` / `resume` / `reference` modes per phase.
   - **DL test-results publication** (R6): what is published (JUnit-style results, coverage summary
     and lcov, API-docs coverage, `lint.clean`), from which build (the CI run on the tag), where (the
     GitHub Release of `dl-130` step 1, and/or the repository) and which phase owns it
     (`release-submit` produces, `release-publishing` attaches). Depends on `bug-141` (coverage omits
     unrequired files) being fixed first.
   `dl-108` (amending an approved element) is `ready` for v0.3 and is scheduled first in the backlog,
   so later amendments use the verb rather than "Amends:" decision-logs.
   **Prepared 2026-09-29 (gate pending).**
   - The six new decision-logs are filed through `decision-log-ingest-rel-v0.3-planning-decisions-plan`
     (`b8c86339` add, `c06b883b` submit) and are `in-discussion`: `dl-131-determinism-index-scope`,
     `dl-132-vision-change-and-feature-ingest`, `dl-133-fix-task-tail`,
     `dl-134-dev-loop-separation-of-duties`, `dl-135-agent-run-tracking`,
     `dl-136-test-results-publication` (added by hand in `8c13bb4a`, one `submit` commit each).
     The pinned build's `memory add` had returned `dl-130` for the first of them, an id already in use
     (`bug-087`, reproduced and recorded in `6c06b695`); its six commits were undone with
     `git reset --keep c06b883b` before anything was pushed. Their slugs are short on purpose: the
     full titles are sentences, and `{slug}` derives from the title given to `add`.
   - The proposal for the 28 `in-discussion` decision-logs in the selection filter, and the options
     each new one leaves open, are in Appendix B.
   **Gate passed 2026-09-29**, approver ruling: every recommendation of Appendix B.
   - 29 `memory approve [in-discussion → ready]`, one commit each, from `dl-039` to `dl-136`
     (`3262ad92` is `dl-079`'s); each `Reason:` names the options chosen and restates the stale text
     Appendix B lists. A cosmetic slip: some reasons end in a doubled full stop, where the option text
     already ended in one.
   - Not selected: `dl-040`, `dl-043`, `dl-058`, `dl-071`, `dl-077` stay `in-discussion`; `dl-040` is
     re-stamped `release: "v0.4"` (`82fc2f8a`).
   - `82fc2f8a` also adds the dated *Amended by* lines to `dl-089`, `dl-099`, `dl-100` (by `dl-133`),
     `dl-114` (by `dl-135`) and a *Refined by* line to `dl-112` (by `dl-131`); their status is
     unchanged.
   - The ingest plans are closed: `decision-log-ingest-rel-v0.3-planning-decisions-plan` (`51c7ac94`)
     and `bug-ingest-rel-v0.3-planning-findings-plan` (`d9e40fcf`). `service-ingest-rel-v0.3-listings-plan`
     stays `active` until `svc-012` is approved.

4. **record-adrs** (architect, `dl-022` spec-review, ⛔). `adr-012` — agent execution launches the
   agent's own CLI through a declared adapter (R2). Context via MCP stays as `adr-004` decided. The
   ADR carries the `REQ-INT-07` amendment and the `dna.yaml` stack line that still names the
   Anthropic SDK. Interactive mode in v0.3; headless mode with a structured result reported through an
   MCP Tool (`gate.report`) in v1.0 with P4.12, so the adapter is designed for both now.

5. **identify-specs** (architect, `dl-022` spec-review, ⛔). Survey, at least:
   - `spec-003-workflows-yaml-schema`: the per-phase role changes (R4), the `executor` attribute, and
     any token `dl-090` binds;
   - a new `spec-016` for the agent adapter and the `agent execute` contract (modes, adapter manifest,
     session id, failure policy, the fake adapter for tests), together with `dl-114`'s run-record
     format;
   - `spec-005` / `spec-008` for the new `workflow` and `agent` commands;
   - `spec-004` for `dl-039` and `dl-040` if ratified.

6. **build-backlog** (product-owner, no gate). Tasks `task-126…` under `docs/04_memory/v0.3/`, tagged
   `v0.3`, `add → submit [draft → pending]`, ordered with `depends_on` (`dl-015`). First in order:
   `dl-108` (amend verb), `bug-162` (the task counter restarts per release, which every v0.3
   `memory add --type task` would hit) and `bug-171` (one id per call). Then the feature tasks for
   P4 and P5.3/P5.4, the tasks of the 34 `ready` v0.3 decision-logs, the fix tasks of the selected
   bugs, and:
   - idea 7: align `.wingfoil/workflows/custom/` with the workflow commands (`dl-079` verbs, `dl-090`
     tokens, phases without `produces:` such as `bug-134`, `agent.*` actions reduced to
     `agent execute`), with a characterization task that loads every workflow through the new loader
     with zero errors;
   - R7: `glama.json` at the root under `dl-093` (AC: valid against the schema; absent from the npm
     tarball per `npm publish --dry-run`; after merge the approver claims the Glama listing, recorded
     as a `service`). Whether `smithery.yaml` is in scope is decided here;
   - `dl-130` step 2 with `bug-173`: publish to the MCP Registry from GitHub Actions with
     `mcp-publisher login github-oidc` in a job after `promote`, `id-token: write` scoped to it
     (AC: `mcp-publisher validate` passes; the job runs only after `promote`; the listing is found by
     `curl "https://registry.modelcontextprotocol.io/v0/servers?search=io.github.wingfoil/wingfoil"`;
     the listing then becomes a `service`); and `bug-174` (runbook for npm's Staged Packages tab);
   - the v0.2.2 carry-over: keep a full `npx jest` with no git identity among the pre-tag checks (it
     reproduces the CI gate job), inside `dl-099`'s task.
   Selected bugs go `[triaged → planned]`; `release: "v0.3"` is stamped on every included element.

7. **commit-backlog** (tech-lead, ⛔). `memory.approve` every task `[pending → backlog]`; `minor-v0.3`
   `[planning → in-development]`. The branch merges into `main` with `--no-ff`; pushing is the
   approver's call.

## Observations

### On the configuration and the agent-facing documents

- `release-planning.yaml`'s define-scope check requires `kind` on the release, while `memory.yaml`
  declares the `minor-*` ids added before `dl-092` immutable and without `kind:` (`memory.yaml:94`).
  The check cannot pass on `minor-v0.3`. Filed as `bug-175`.
- `CLAUDE.md` §1, §3, §5 and §5.1 still describe the configuration under `docs/self/` and the verbs as
  unable to act on this repository (`bug-075`, now `closed` in v0.2.2). This planning runs them on the
  repository. `CLAUDE.md` is owned by `user-docs`' `align-agent-docs` phase (`dl-025`); recorded here
  for v0.3's run of it, not edited by this phase.
- `docs/01_vision/00_index.md` lists `06_features.md` at 1.2 and `07_sequencer.md` at 1.3, two
  versions behind before this phase's edits. Carried to `user-docs` with the item above.

- `bug-087` fires on this repository: `memory add` numbers by counting files, and `dl-021` is a gap,
  so the next decision-log came out as `dl-130`, already in use. `bug-162` makes the task counter
  restart per release directory (`ls docs/04_memory/v0.2 | wc -l` → 75 files, highest `task-108`),
  so build-backlog adds tasks **by hand** from `task-126`, checked against every ref, until those two
  fixes ship.
- `adr-005` was moved `accepted → superseded` by hand under a `wf(adr): deprecate` subject
  (`a7d783aa`), against the rule that retirement writes `deprecated` and that `superseded` is reached
  only by a later element's `supersedes:`. History is not rewritten (`dl-035`); `dl-065`'s ratification
  says how the state is treated.

### On the pinned build (wingfoil 0.2.2)

Recorded as they occur, per the rule that every command's real effect is checked against its
contract. Each becomes a bug through `bug-ingest` at step 2 if it reproduces.
- `memory add --type plan … --set element=minor-v0.3 --set release=v0.3` → exit 1, "memory type
  'plan' has no token {element} in its id_pattern or path". **Not a defect**, corrected in v1.2: exit 1
  is the declared contract (`spec-008` §10; `src/memory/add.ts:220-223`). `--set` fills path tokens
  only, so `element:` and `release:` are written before submit.

## Appendix A — triage-bugs proposal (for gate 2)

Prepared on 2026-09-29 by four read-only survey agents, one per batch of 18, on this branch at
`fad3f2ca` (code equal to `main` `9f95f47e`). No `dist/` existed in the worktree, so every verdict
rests on a file read or a grep, cited in the table. Nothing was run through the CLI.

**Totals (72 bugs + the `tools/list` candidate).**
- **v0.3: 52.** 47 `open → triaged`, plus the stamp of v0.3 on `bug-019`, `bug-132`, `bug-133`,
  `bug-134` (`triaged`, no release) and the approve of `bug-087`, `bug-088` (`open`, already v0.3).
  Effort: mostly S; M for `bug-031`, `bug-070`, `bug-087`, `bug-099`, `bug-114`, `bug-118`, `bug-126`.
- **Not selected, proposed for v0.4: 15.** `bug-025`, `bug-034`, `bug-039`, `bug-061`, `bug-066`,
  `bug-067`, `bug-101`, `bug-102`, `bug-108`, `bug-110`, `bug-111`, `bug-115`, `bug-116`, `bug-119`,
  `bug-130`. They stay `open`; `release` is stamped only when v0.4 plans.
- **`reject [open → closed]`: 5.** `bug-024` (fixed by `task-101`, `62f13b2f`; twin of the closed
  `bug-098`), `bug-032` (fixed by `af91cf84`, which cites it), `bug-048` (the false comment was
  rewritten in `659b42e8`; the remaining warning is deliberate and `dl-076`'s question), `bug-068`
  (fixed by `9fec695c`), `bug-127` (duplicate of `bug-165`). The `tools/list` candidate is `bug-151`.

**Clusters, one task each at build-backlog** (so 52 bugs are about 30 tasks, not 52):
- Stale text: `bug-028` + `bug-040` + `bug-045`; `bug-052` + `bug-053`; `bug-054` + `bug-069`;
  `bug-105` + `bug-106` + `bug-107`; `bug-099` + `bug-100` (with the new v0.3 command rows and
  `bug-160`); `bug-096`; `bug-109` with `bug-113` and `bug-148` (the directive schema has no `scope`).
- Security and confinement: `bug-118` + `bug-124` + `bug-122`; `bug-121`; `bug-123` + `bug-114` (the
  error surface); `bug-125` + `bug-154` (`src/core/loaders.ts`); `bug-037` + `bug-038` (one `spec-007`
  amendment and the missing `init` caller); `bug-055` with `dl-122`; `bug-035`.
- Memory: `bug-031` (with `dl-055`, `in-discussion`, if ratified at gate 3); `bug-033`; `bug-051`;
  `bug-072`; `bug-087` + `bug-162` (implementing `dl-101`); `bug-088`; `bug-093` + `bug-097` (one git
  helper that captures stderr).
- Tests: `bug-036`, `bug-046` + `bug-047` (named instances of `dl-121`); `bug-064` + `bug-065`;
  `bug-070` (the empty-stderr helper is now in 7 files under `test/cli/`, and new workflow tests would
  copy it); `bug-073`; `bug-095` (and `bug-066` if moved back from v0.4: same `test/global-setup.cjs`);
  `bug-112`.
- CLI: `bug-104` (with `bug-115` in v0.4: one decision on the suggestion wording); `bug-131` into
  `bug-171`'s task.
- Comment-stripping fallback: `bug-019` + `bug-126` (+ `dl-062`, `ready`, no release).
- Smoke gate: `bug-132` + `bug-133` + `bug-134`.
- Publish/CI: `bug-060`.

**Load, for the approver's ruling.** v0.3 already holds 33 `triaged` bugs and 34 `ready`
decision-logs besides its 23 features. The proposal adds about 30 tasks (≈ 4.6 active days at 6.5 a
day). `dl-100`'s capacity rule and R9's stop-the-line threshold are the reason to see this number
before approving it: the approver may approve the whole proposal, or keep only the security, Memory,
test-harness and first-use clusters and move the stale-text clusters to v0.4.

**Full table** (evidence per bug, as the survey agents wrote it):

| Bug | Area | Summary | Still holds? + evidence | Proposal | Effort | Reason |
|---|---|---|---|---|---|---|
| `bug-019` | dna | `dna set` whole-file dump fallback silently erases all comments/provenance markers | **Yes.** `src/core/index.ts:386` `applyDnaEditInText(...) ?? dump(...)` has no warning. `src/dna/set.ts:317` still returns `undefined` for `>`/`\|` block scalars (`project.north_star`/`description` in `.wingfoil/dna.yaml:16,25`) | v0.3 (already `triaged`: stamp v0.3) | S | Silently loses governance-relevant data (medium). The minimum fix (warning when falling back) is cheap. Cluster with bug-126. |
| `bug-024` | cli-grammar | Commander parse errors exit 1 instead of spec-008's 2 | **No, fixed.** `src/cli/program.ts:101` `exitOverride` → `src/core/exit-code.ts:91-101` maps `commander.unknownOption`/`optionMissingArgument`/… to 2. Pinned by `test/cli/commander-parse-exit-codes.integration.test.ts:248`. Fixed by `62f13b2f` (task-101, for bug-098 `closed`) | close | – | Already fixed by task-101 (`62f13b2f`). Duplicate of bug-098 (closed). |
| `bug-025` | directives | Missing directive `name` gives Zod text, not P3.5's required message | **Yes.** `grep -rn "invalid directive: missing required field" src test` → 0 hits. The only hit is `P3.5-project-directives.feature:23` | later:v0.4 | S | Message only; nothing is corrupted. Fits v0.4's "error messages refined" scope. Unrelated to workflow work. |
| `bug-028` | docs-specs | `wingfoil mcp` absent from spec-005/006/008 command-surface lists | **Yes.** `spec-008-cli-grammar.md:32,36` and `spec-005…:14` list only `init, paths, audit`. `spec-006` has no `wingfoil mcp` row | v0.3 | S | spec-008 §1 gets edited anyway when the workflow nouns are added. One-word edits. The spec-006 half waits on dl-046 (in-discussion). |
| `bug-031` | memory | One malformed frontmatter breaks search/history repo-wide, and the error doesn't name the file | **Yes.** `src/memory/query.ts:138` `parseYaml` throws uncaught, even though the TSDoc at `:126-129` promises a tolerant read. `src/validation/errors.ts:77-81` puts the path only in `issues`. `src/cli/error.ts:14-22` prints only `reason` | v0.3 | M | Workflow state deduction scans every Memory frontmatter. One hand-edited doc would break `workflow status/next`. The filename half overlaps dl-055. |
| `bug-032` | docs-specs | spec-004 §4.3 example uses pre-dl-032 illegal-transition wording | **No, fixed.** `spec-004…:219-221` now reads `illegal transition draft -> backlog for type 'task'`, and the Revision note at `:262-275` names bug-032. Fixed by `af91cf84` (implement dl-053) | close | – | Already fixed at `af91cf84`. The spec-004 §4.3 example now carries the ratified message. |
| `bug-033` | memory | `memory add` setter matches indented keys and strips inline comments | **Yes.** The private `setFrontmatterField` is still in `src/memory/add.ts:121-127` (regex `^([ \t]*)key:.*$`, whole line replaced). `src/memory/frontmatter-edit.ts` exists but `add.ts` does not use it | v0.3 | S | Workflow phases `memory.add` plan/task elements. This repo's templates carry inline comments, and dogfooding is now possible since task-111. |
| `bug-034` | mcp | SDK McpError bakes the "MCP error <code>:" prefix into the wire message; clients double it | **Partly.** Prompts are fixed: `src/mcp/prompt.ts:63-71,197` throws a plain `Error` with a code. The unknown-Resource-URI path is still the SDK's: no custom ReadResource handler in `src/mcp`, and `McpError` is still in `node_modules/@modelcontextprotocol/sdk/dist/cjs/types.js:2067-2069` (sdk 1.29.0) | later:v0.4 | S | Affects MCP message text only; the codes are correct. MCP polish and full Tools/Resources are v0.4 scope. |
| `bug-035` | security | In an uninitialised git root, `mcp` starts and commands leak raw ENOENT with an absolute path | **Yes.** `src/cli/mcp-command.ts:43-50` checks only `resolveRoot()` (git root), with no `.wingfoil/` check. `src/core/index.ts:190-191` returns `errno.message` verbatim as `NOT_FOUND` | v0.3 | S | Harms a new user's first use: any command before `init`, including the new workflow commands. The raw path leak is also a confinement/hygiene issue. |
| `bug-036` | tests-infra | The REQ-SEC-05 no-persistence helper only re-reads listed files; creates/commits go unseen | **Yes.** `test/mcp/helpers/channel-enumeration.ts:63-79` only snapshots and compares the listed paths. `grep porcelain\|rev-parse\|HEAD` in that file → nothing | v0.3 | S | Security evidence (REQ-SEC-05). Named instance of dl-121 (ready, v0.3). v0.3 adds mutating workflow ops that this guard must cover. |
| `bug-037` | security | dotenv secret regex is anchored at col 0; misses indented/`export`/list-item short secrets | **Yes.** `src/validation/secret-scan.ts:116` `/^[A-Z0-9_]*(SECRET\|TOKEN…)…/i` (severity `block`, `:112`). `spec-007…:99-102` has the same anchored regex. The stale "warn patterns are heuristic" note is still at `spec-007…:109` | v0.3 | S | Security false negative on a blocking check. Needs a spec-007 amendment plus a mirrored regex and tests. Cluster with bug-038. |
| `bug-038` | security | `init` never secret-scans built-in templates before writing (spec-007 §4 step 5) | **Yes.** `grep -rn "scanText\|scanProjectSurface\|secret-scan" src/core src/storage` → no output. `src/core/init.ts:108` runs only `verifyBuiltinTemplates` (schema). The scanner has no production caller outside `src/validation` | v0.3 | S | Spec requirement with no owner, protecting REQ-SEC-08. Isolated to init's pre-write pass. Ship together with bug-037. |
| `bug-039` | docs-specs | P3.8 BDD scenario selects "Trunk-Based", which is not a registered init template | **Yes.** `P3.8-builtin-directive-templates.feature:15` names "Trunk-Based". `src/storage/templates.ts:36,44` registers only Scrum and Kanban. P4.18 moved to `minor-v0.4.md:8` | later:v0.4 | S | Becomes executable once P4.18 (v0.4) registers Trunk-Based. Fixing it now would mean a requirements edit, which is the approver's call. |
| `bug-040` | docs-specs | Docs still say P3.8 built-in templates are "not yet implemented" | **Yes.** `grep "not yet implemented"` → `.wingfoil/roles.yaml:3`, the six `.wingfoil/directives/custom/*.md:15` stand-ins, `spec-011-storage-layout.md:45-46,122`. `src/core/builtin-asset.ts:8` still says "empty today" | v0.3 | S | Doc staleness fixable in minutes. spec-011 §`workflows/built-in` is adjacent to v0.3 workflow layout work. Text only; stand-in reconciliation stays separate. |
| `bug-045` | tests-infra | Registry/parity/agent-channel test prose names outdated mutating-op counts | **Partly.** The `it`/`describe` titles are now current (`parity.test.ts:132`, `read-only-agent-channel.test.ts:81-82` say "twelve"). The module docs are still wrong: `production-registry.test.ts:5-8` ("zero mutating operation"), `parity.test.ts:16-20`, `read-only-agent-channel.test.ts:12-14` ("CORE_MODULES is read-only today") | v0.3 | S | v0.3 adds workflow mutating ops and must edit these three files anyway. Same "prose overclaims" family as dl-120/dl-121. |
| `bug-046` | publish-ci | Nothing asserts that package-lock root `engines` equals package.json's | **Yes (latent).** Both are `>=22.12.0` today (`node -e` on both files). `test/cli/publish-metadata.test.ts` has no lockfile engines assertion (the only `package-lock` mention is the comment at `:362`) | v0.3 | S | Named instance of dl-121 (ready, v0.3). A one-assertion guard in the same test file as bug-047. |
| `bug-047` | publish-ci | Engines guard checks only one direction; spec now claims equality is enforced | **Yes, and worse.** `spec-015…:71-77` now says the floor "must equal" the closure maximum and is "enforced by an assertion". `publish-metadata.test.ts:602-609` asserts only `rangeAllows` (satisfies) | v0.3 | S | Spec overclaims its guard, which is exactly dl-121's T1 pattern (a named instance). Add the equality assertion alongside bug-046. |
| `bug-048` | publish-ci | CI's Node 22.12.0 pin doesn't satisfy eslint 10 (EBADENGINE warnings) | **Fixed on the claim; warning remains by design.** `publish.yml:71-87` now says 22.12.0 is the *production* floor and states that eslint@10 emits EBADENGINE, accepted as deliberate. Rewritten in `659b42e8` (task-074). eslint engines are still `^22.13.0` (checked in `node_modules`) | close | – | The false comment was corrected by `659b42e8`. The residual warning is deliberate; the engine-strict/toolchain policy belongs to dl-076 (in-discussion). |
| `bug-051` | memory | `commitPaths` never passes `--cleanup`; the commit-body normal form depends on ambient git config | **Yes.** `src/storage/commit.ts:80` runs `['commit','--only','--quiet','-m',message,…]`. `grep -rn cleanup src/` only matches comments (`commit-message.ts:92`, `audit.ts:175`) | v0.3 | S | One-argument fix plus a four-mode characterization test. v0.3 workflow/agent-run commits all go through `commitPaths`, and today the audit trail can silently lose lines. |
| `bug-052` | docs-specs | REQ-STATE-08, the P1.13 BDD and memory.yaml still name the retired `rejected` default | **Yes.** `03_state-context.md:96`, `P1.13-memory-element-schema.feature:17`, `.wingfoil/memory.yaml:56` all read `approved/rejected` | v0.3 | S | Three edits to authoritative SARD/BDD text that v0.3's state-deduction work will read. Pair with bug-053 (same spec-001 reconciliation). |
| `bug-053` | docs-specs | spec-011's memory.yaml row names the retired `values/initial/transitions` encoding and omits `defaults` | **Yes.** `spec-011-storage-layout.md:112` and `.wingfoil/memory.yaml:14,72` still say `values/initial/transitions`. The dna.yaml row `:111` and `:40` still list `conventions` | v0.3 | S | Cheap doc staleness in a layout spec that v0.3 will likely extend for workflow storage. Fold into bug-052's pass. |
| `bug-054` | docs-specs | adr-001 says "Node.js 18+ … per dna.yaml" in the present tense; dna.yaml now says 22.12+ | **Yes.** `adr-001-git-backed-storage.md:32` still reads `Node.js 18+`, and `grep -n Correction` finds no correction note | v0.3 | S | A dated correction block (the dl-001 precedent) takes minutes. Do it together with bug-069, the other stale adr-010 cascade leaf. |
| `bug-055` | security | Secret-scan test fixtures are secret-shaped literals; GitHub push protection blocked the push | **Yes.** `test/validation/secret-scan.test.ts:68` still has the 40-char `fAkEsEcReT…` literal | v0.3 | S | Security. `dl-122` (`ready`, release v0.3) explicitly keeps this as the bug whose fix rewrites the fixtures. Cheap and isolated. |
| `bug-060` | publish-ci | The `act` recipe in publish.yml fails from a git worktree and doesn't say so | **Yes.** `.github/workflows/publish.yml:109-119` recipe has no worktree caveat (`grep -n worktree` finds nothing) | v0.3 | S | A one-line doc caveat. `publish.yml` is likely touched by the v0.3 stage-publish migration (dl-087) anyway. |
| `bug-061` | publish-ci | A passing `publish:staging` log is flooded with Verdaccio password-verify lines and a ConflictError | **Mechanism unchanged:** `scripts/publish-staging.cjs:111` `level: warn`, `:382` Verdaccio spawned `stdio: 'inherit'`. Line count not re-measured (needs network + npm) | later:v0.4 | M | Cosmetic, doesn't affect the pipeline outcome. Unrelated to workflow/agent work. Revisit when dl-087 settles the future of the staging script. |
| `bug-064` | tests-infra | `cloneTempRepo` leaks two mkdtemp dirs per call; nothing counts leftover fixture dirs | **Yes.** `test/storage/helpers/git-fixture.ts:73-74` has two `mkdtempSync` calls with no removal. `jest.config.js` has no `globalTeardown` (grep empty) | v0.3 | S | One-helper fix plus an optional teardown sweep. v0.3 adds many git-fixture suites that will pile onto the leak. One task with bug-065. |
| `bug-065` | tests-infra | Cloned fixture repos keep default gc.auto; the test name overclaims "every fixture repo" | **Yes.** `git-fixture.ts:31` sets `gc.auto 0` only in `makeTempGitRepo`. `cloneTempRepo` (`:72-74`) configures nothing | v0.3 | S | Same helper and same pass as bug-064. Adds a one-line `git config` plus retry-budget test and TSDoc fixes. |
| `bug-066` | tests-infra | globalSetup's unguarded `rmSync(dist)` fails with a raw EACCES after root-container runs | **Yes.** `test/global-setup.cjs:22` is a bare `rmSync(join(repoRoot,'dist'),…)` with no try/catch | later:v0.4 | S | Developer-only ergonomics. Its companion half (container `--user` recipe) waits on `dl-076` (`in-discussion`). Schedule the two together. |
| `bug-067` | publish-ci | Script-only SIGINT/SIGTERM to `publish:staging` waits for a blocking spawnSync step to finish | **Yes.** `scripts/publish-staging.cjs:309-310` `run` uses `spawnSync(…,{stdio:'inherit'})` with no signal forwarding | later:v0.4 | M | Latency only: teardown is correct and Ctrl-C and CI signal the whole group. It changes `run`'s contract. Not on the workflow/agent path. |
| `bug-068` | docs-specs | spec-015 cites `README.md:115` as a bare line offset in durable prose | **No, fixed.** The only remaining `README.md:115` (`spec-015…:465`) is the Revision note recording its removal. Fixed by `9fec695c` "spec-015 — … drop its README.md:115 offsets" (`git log -S`) | close | – | Already fixed at 9fec695c (the 2026-09-25 Revision note replaced all three offsets with the *Installation* heading). |
| `bug-069` | docs-specs | adr-010 Consequences still say `@types/node` is pinned `^18` | **Yes.** `adr-010-node-22-runtime-floor.md:195-196,236` say `^18.19.130` / "still `^18`". `package.json:70` is `"@types/node": "^22.20.4"` | v0.3 | S | Minutes-long in-place amendment with a Revision note. Same pass as bug-054. The general convention question is a separate DL, not this bug. |
| `bug-070` | tests-infra | CLI test helpers return a literal `stderr: ''` on success, so quiet-stderr assertions can't fail | **Yes, and wider than filed.** The same `return { status: 0, …stderr: '' }` literal is in `fresh-init-transitions:65`, `journey-0a:56`, `missing-verb-exit-code:75`, `npm-distribution:74`, `program.integration:91`, `help-positional-required:41`, `commander-parse-exit-codes:55` | v0.3 | M | v0.3 adds ~8 workflow commands plus `agent execute` CLI suites that will copy this helper. Fix the pattern (spawnSync) before it spreads further. |
| `bug-072` | memory | `walkGitLogFields` has no maxBuffer; ENOBUFS is swallowed into "no history" | **Yes.** `src/memory/git-log.ts:89-90` `catch { return []; }`. `grep -rn maxBuffer src/` → only `secret-scan.ts:362` | v0.3 | S | v0.3 state deduction and agent-run records read git history more, and a silent empty history is a wrong answer. Fixed with one option or a discriminating catch. |
| `bug-073` | tests-infra | No gate detects raw NUL/control characters in tracked source files | **Yes.** `test/lint/` has only `coverage-scope`, `lint-clean`, `pack-ignore-scripts`, and none checks bytes | v0.3 | S | Cheap, isolated `test/lint/` meta-gate in an established shape. Security-adjacent (invisible characters, bug-050 class). Narrow NUL-only scope is enough. |
| `bug-087` | memory | `nextSequenceNumber` counts worktree files; sequence gaps reuse ids or refuse legitimate adds | **Yes.** `src/memory/add.ts:85-93` still returns `count + 1` over `readdirSync(dir)`. Reproduced on this repo 2026-09-29 (dl-130 number reuse, per its notes) | v0.3 (approve open→triaged; release already v0.3) | M | `dl-101` (`ready`, v0.3) defines id allocation. One task with bug-162 (triaged v0.3, same counter). v0.3 agent runs create elements in parallel. |
| `bug-088` | memory | `initWingfoilStorage` lacks `initWingfoilProject`'s already-initialized check; overwrites clean config | **Yes.** `src/core/init.ts:92-135` has no `detectInitState` call (only `:178`, in `initWingfoilProject`). The Guard-4 comment at `:114-121` names the gap | v0.3 (approve open→triaged; release already v0.3) | S | Already stamped v0.3. Cheap. Pairs with `dl-062` (`ready`) `--force` discussion. Exported from `src/core` but unreachable from CLI/MCP. |
| bug-093 | memory | Two Memory git calls still inherit the operator's stderr (no `stdio` option) | Yes. `src/memory/history.ts:107-109` (`findElementCreationSha`) and `src/memory/git-log.ts:84-88` (`walkGitLogFields`) pass only `{ encoding: 'utf-8' }`. The rename probe at `history.ts:205` has `stdio` | v0.3 | S | Workflow state deduction will lean on the Memory git reads. One shared `git` exec helper fixes it once. Pair with bug-097 |
| bug-095 | tests-infra | Concurrent jest runs in one worktree delete each other's `dist/` | Yes. `test/global-setup.cjs:22` does an unguarded `rmSync(dist)` then rebuilds, with no lock (`grep lock` finds nothing) | v0.3 | S–M | v0.3 runs agents in parallel across worktrees, and a false red gives false evidence. Fix together with bug-066 (same file) |
| bug-096 | docs-specs | False `--version` comment in namespace test; present-tense retired `dna set` grammar | Yes. `test/cli/derived-option-namespace.test.ts:217-220` still claims `--version` is absent and adds it by hand. `src/core/index.ts:342` still reads `dna set version 2`. `test/core/dna-set.test.ts:194` title unchanged | v0.3 | S | Cheap and isolated comment/test-title fix. `src/core/index.ts` changes in v0.3 anyway |
| bug-097 | tests-infra | `core.quotePath=false` and history probe `stdio` unpinned; `readStatusAt` TSDoc overstates | Yes. `history.ts:165` sets `PATH_PROBE_ARGS`, but no memory/cli test uses a non-ASCII path. The AC4 harness in `test/memory/history-rename-path.test.ts:205+` drives only `readStatusAt`. `src/memory/audit.ts:244` still makes the "distinguishable" claim | v0.3 | S | Same subject as bug-093. Pin the new helper with the existing out-of-process AC4 harness in one task |
| bug-099 | docs-specs | `X_cli-cmds.md` declares `--dry-run`, retired `tech-stack` sync, false "interactive" claims | Yes. `docs/01_vision/X_cli-cmds.md:236` has `--dry-run`, and `grep -rn dry-run src` finds nothing. Lines 106/190 say `tech-stack`. Lines 114/169 say "(interactive or flag-based)" | v0.3 | M | v0.3 rewrites the Pillar-4 workflow rows (`workflow create/start/…`) anyway. Correct the reference while it is being edited |
| bug-100 | docs-specs | `X_cli-cmds.md` mixes `<ANGLE>` and `[BRACKET]` notation for required positionals | Yes. `X_cli-cmds.md:29` has `memory approve [document-id]`, and line 251 records the unconverted pillars | v0.3 | S–M | Same document and pass as bug-099. New v0.3 workflow rows need one notation from the start |
| bug-101 | dna | All-digit entry names unaddressable even quoted; index guard sees stripped segment | Yes. `src/dna/path.ts:291` checks `/^\d+$/` on the bare segment, and no per-segment "quoted" flag exists | later:v0.4 | S (doc) / M (code) | No real data is affected. Belongs with the DNA path-grammar work (bug-111/102), not the workflow release |
| bug-102 | tests-infra | Nothing enforces `splitDnaPath` as the only DNA path splitter | Yes, as a missing guard. `grep -rn "split('\.')" src/` finds only the doc comment `src/dna/set.ts:42` plus unrelated `src/validation/id.ts:155`. No test asserts the invariant | later:v0.4 | S | No defect today. Build the guard when bug-111 extends the parser to the read side |
| bug-104 | cli-grammar | Unknown-command suggestion is Commander's `(Did you mean …)`, not the spec-005 `hint:` line | Yes. `src/cli/program.ts:294` names it as bug-104's. `test/cli/commander-parse-exit-codes.integration.test.ts:174` pins Commander's wording. `src/cli/error.ts` has the unused `hint:` emitter | v0.3 | S (spec amend) / M (re-emit) | This is the error path a new user hits first. Decide Commander-vs-own format together with bug-115; v0.3 adds many new verbs |
| bug-105 | docs-specs | Retired `conventions` in narrative of US-0A-05/08 and P2.1/P2.3/P2.4 features | Yes, and wider than filed. `01_init-migrate.md:23,33,92,99`, `P2.1-dna-set.feature:2`, `P2.3-dna-infer.feature:3`, `P2.4-project-dna-config.feature:2` | v0.3 | S | Minutes of doc staleness. One pass with bug-106/107 keeps the US→BDD chain aligned |
| bug-106 | docs-specs | Two BDD steps assert a `conventions` DNA section that the schema lacks | Yes. `P2.4-project-dna-config.feature:11` and `P2.2-dna-show.feature:9` | v0.3 | S | These are acceptance contracts that would fail once a BDD runner exists. Cheap, same pass as bug-105. Leave the `tech_stack` alias at P2.2:13-14 alone |
| bug-107 | docs-specs | v0.1 backlog JSON quotes rewritten P2.1/P2.4 scenarios and a retired DNA shape | Yes. `backlog.json:482,502` quote `conventions`/`tech_stack`. `git log -- backlog.json` shows only `b9c4df0b` | v0.3 | S | The fix is a header saying the file is a frozen archive. v0.3 build-backlog reads these files, so clarify them now |
| bug-108 | directives | `directive remove` resolves its target on the working tree, not HEAD | Yes. `src/core/index.ts:1547` does `loadOrError(() => loadDirectives(root))`, then `NOT_FOUND` "unknown directive" at `:1551` | later:v0.4 | S–M | Message quality only; `requireUnmodifiedTarget` prevents data loss. Fits the v0.4 directives/templates work. Not on the workflow path |
| bug-109 | docs-specs | `src/directives/schema.ts` TSDoc calls approved spec-013 a "candidate" | Yes. `src/directives/schema.ts:6-16`; spec-013 frontmatter says `status: approved` | v0.3 | S | Paragraph rewrite in minutes. Do it with bug-113/bug-148, which change the same file |
| bug-110 | directives | `loadDirectivesAtHead` spawns one `git show` per directive file | Yes. `src/core/loaders.ts:320-330`: one `listPathsAtRev` then `readPathAtRev` per `.md` | later:v0.4 | M | Not measurable today and no perf budget is hit. Revisit only if `agent execute` or a hot read moves onto this loader |
| bug-111 | dna | `dna show` accepts only a top-level key; no dotted path grammar | Yes. `src/core/index.ts:280-285` does an alias lookup then `key in dna` with no split, and fails with "no DNA key named '<section>'" | later:v0.4 | M | New read surface that needs its own BDD scenario. `--format json` workaround exists. Pair with bug-101/102 as one DNA-grammar task |
| bug-112 | tests-infra | Tests pin the live `roles.yaml` developer bindings by exact array | Yes. `test/directives/schema.test.ts:141` and `test/core/loaders.test.ts:197` use `toEqual([...])` on the live bindings | v0.3 | S | v0.3's reconcile-governance and dl-119 (git-conventions directive) will change bindings. That produces a false red on the very next edit |
| bug-113 | directives | `directives list` warns "unknown field(s) ignored: scope" on every global directive | Yes. `DirectiveFrontmatter` (`src/directives/schema.ts:36-44`) has no `scope` and is `.passthrough()`. The repo's `.wingfoil/directives/custom/{claim-evidence,doc-versioning,security-secrets}.md` carry `scope:`. Warning text is at `src/validation/warning.ts:109` | v0.3 | S | Symptom of bug-148 (already triaged v0.3). Fold into its task. `agent execute` loading role directives would print the noise on every run |
| bug-114 | cli-grammar | Parse-path errors ignore `--format json/yaml`; stderr shape depends on which layer refused | Yes. `src/cli/program.ts:103` and `:144` hard-code `emitError(..., { format: 'console' })`; Commander's own messages are untouched (comment at `:86`) | v0.3 | M | Agents in `agent execute` and workflow scripts parse `--format json`, so stderr must have one shape. Do it in one task with bug-123. Needs a ruling on usage text |
| bug-115 | cli-grammar | `help <typo>` gives no "did you mean", the direct typo does | Yes. `program.ts:305` returns the literal `unknown command '${second}'`, with no suggestion logic | later:v0.4 | S | A convenience, and low severity. It belongs with bug-104 (open, no release), which decides the suggestion format. One CLI-polish pass in v0.4 |
| bug-116 | cli-grammar | `wingfoil help help` says `unknown command 'help'` | Yes. `program.ts:305` fires for any `help <x>` that reaches the incomplete path, `help` included | later:v0.4 | S | Nobody types this by accident and the exit code is right. Fix together with bug-104/115 in the same `incompleteInvocationReason` pass |
| bug-118 | security | Dirty-target guard reads "no porcelain output" as clean, so it is blind beyond symlinks | Yes. `src/core/write-guard.ts:124` has `if (porcelain === '') return coreOk(undefined);`, and there are 6 call sites (`grep -rn "requireUnmodifiedTarget(" src/`) | v0.3 | M | The guard fails open on 7 write paths, and v0.3 adds more writers (agent-run records, workflow state). Fix the guard before new callers use it |
| bug-119 | publish-ci | npm 10.9 (CI) and npm 11 (dev) disagree on 12 `"peer": true` lock entries | Yes. `grep -c '"peer": true' package-lock.json` → 12 (the npm-11 author); CI pins `NODE_VERSION: '22.12.0'` (`.github/workflows/publish.yml:139`) | later:v0.4 | S | Metadata-only noise, and `npm ci` is unaffected. It is the residue named in dl-076 (`in-discussion`), so decide it with that ruling |
| bug-121 | security | `dna set`, `directive create/assign`, `init` write through symlinked config outside the root | Yes. Confinement exists only at `src/core/index.ts:1566` (remove) and `memory-transition.ts:291`. `writeDocument` at `index.ts:397` (dna) and `:1377` (directive create) is unguarded, and `directive-assign.ts` / `storage/layout.ts` have no `requireConfined*` | v0.3 | S–M | REQ-SEC-06 crossing (writes outside the root). The fix is wiring the existing `requireConfinedWriteTarget`; `init`'s scaffold case needs a short ruling |
| bug-122 | security | Unconfined `resolveMemoryPath` exported from storage barrel, no caller | Yes. `src/storage/index.ts:14` exports it; `grep -rln "resolveMemoryPath\b" src/ test/` → only memory-path.ts, index.ts and its test | v0.3 | S | A ready-made confinement bypass. It takes minutes to stop exporting it, and v0.3 adds new Memory writers that might reach for it |
| bug-123 | cli-grammar | Same confinement refusal returns `IO` (memory add) vs `VALIDATION` (transitions) | Yes. `src/core/index.ts:704-705` maps `StorageError` → `IO`; `src/core/confinement.ts:70,112` return `VALIDATION` | v0.3 | S | Same task as bug-114 (JSON error surface for machine consumers). A one-line mapping change once the code is chosen |
| bug-124 | security | In-root symlinked `directives/custom`: `directive remove` unlinks, then git fails | Yes. `index.ts:1566` confinement passes in-root; `:1576` `requireUnmodifiedTarget` is blind (bug-118); `:1579` `removeDocument` runs before `:1581` `commitPaths` fails | v0.3 | S | Same root cause as bug-118. Once the guard refuses an uninspectable target, this refuses before the unlink. One task, with a regression test |
| bug-125 | directives | One dangling symlink under `directives/` makes every directive read throw raw ENOENT | Yes. `src/core/loaders.ts:35` calls `statSync(full)` (follows links) with no `lstat`/try | v0.3 | S | `agent execute` loads role directives through this loader. A raw ENOENT that takes down the pillar harms first use and agent runs. Cheap `lstat` fix |
| bug-126 | dna | `dna add` of a first `team.agents` entry strips every `dna.yaml` comment | Yes. `src/dna/edit.ts:433` `insertMissingScalarPath` handles only `set-scalar`, so an `add` into an absent collection → `undefined` → `dump()` fallback at `src/core/index.ts:386` | v0.3 | M | v0.3 agent adapters need `team.agents` declared, which is exactly the path that strips comments. Merge with bug-019 (`triaged`, release "") |
| bug-127 | memory | Illegal-transition error names a target nobody attempted (`approved -> pending`) | Yes (code). `src/memory/state-machine.ts:326` `contractTarget` / `:374` message; `NO_TARGET='(none)'` at `:305` | close | — | Duplicate of bug-165 (`triaged`, v0.3): same canonical-edge message. Before rejecting, add bug-127's extra cases (task end, gate `(none)`, custom machine) to bug-165 |
| bug-130 | directives | No `directive unassign` verb; retiring an assigned directive needs a hand edit | Yes. `grep -rn "unassign" src/` finds only the `UNASSIGNED_ASSIGNMENT` label (`src/core/directives-list.ts:51`); no operation | later:v0.4 | M | A missing feature, not a defect. It needs a DL on the directive command surface (P3.2/spec-006 §3), and v0.3 is Workflow-focused. A documented workaround exists |
| bug-131 | cli-grammar | Extra positionals silently ignored (`workflow list x`, `directives list developer`) | Yes. `program.ts:199` `allowExcessArguments(true)` for commands with no positional; `:196` variadic for the rest; `src/core/exit-code.ts:88` documents `dna show project extra` accepted | v0.3 | S | Fold into bug-171 (`triaged`, v0.3): the same registration fix. v0.3 adds eight workflow commands that must refuse extras from day one |
| bug-132 | tests-infra | e2e smoke asserts only exit 0, never 1 or 2 | Yes. `scripts/e2e-smoke.cjs:74` `if (run.status !== 0)`; steps at `:44-55` are all happy paths | v0.3 (stamp) | S | The gate flips to hard-reject in v0.3 (dl-023). Add an `exit:` field plus one exit-1 and one exit-2 step. One task with 133/134 |
| bug-133 | tests-infra | e2e smoke never re-loads written artifacts through their loaders | Yes. The only final assertion is `git status --porcelain` (`scripts/e2e-smoke.cjs:141`); `memory submit` (`:49`) is followed by no Memory read | v0.3 (stamp) | S–M | Same hard-reject flip, same file. Add reader steps after the last writers; this also widens the publish-staging gate (H1) |
| bug-134 | workflow | `e2e-smoke.yaml` declares no `produces:` | Yes. `grep -n produces .wingfoil/workflows/custom/e2e-smoke.yaml` → nothing; `:9-10,52-56` still say "staged: warn" | v0.3 (stamp) | S | Already a declared v0.3 blocker (triage follow-up 2026-09-28): it must land before v0.3's e2e-smoke phase, together with the hard-reject restatement |
| bug-154 | directives | `directives list` exits 0 with empty listing when no `.wingfoil/` exists | Yes. `src/core/loaders.ts:29` returns `[]` for a missing dir; `src/core/directives-list.ts:191` reads `roles.yaml` only if present | v0.3 | S | An agent told "no directives for your role" in an unreadable project is the failure mode that `agent execute` / role prompts (`src/mcp/prompt.ts`) will hit |
| (candidate) `tools/list` | mcp | `wingfoil mcp` answers `tools/list` with -32601 Method not found | Yes, but **already filed as bug-151** (`triaged`, release v0.3). See Notes for the root cause | close (do not file) | S | Duplicate of bug-151. Instead, add the registrar-comment finding and the two tests that pin the error to bug-151 |

**Survey notes** (duplicates, clusters and surprises, per batch):

**Batch 00**

- **Duplicates / already fixed:** bug-024 is bug-098's twin (both fixed by task-101 `62f13b2f`). bug-032 was fixed by `af91cf84`, which even cites it in spec-004's Revision note, but the bug was never closed. bug-048's false claim was rewritten by task-074 (`659b42e8`).
- **Suggested clusters (one task each):**
  - **Engines guards:** bug-046 + bug-047. Both are in `test/cli/publish-metadata.test.ts`, and both are named instances of `dl-121-testing-directive-extensions` (ready, v0.3).
  - **Secret-scan:** bug-037 + bug-038. One spec-007 amendment plus the init caller. dl-073 (in-discussion) calls both "adjacent".
  - **Silent comment-stripping fallback:** bug-019 + `bug-126` (dna add, open, not in this batch). `dl-062` (ready, release empty) is the same class for `roles.yaml`. One "warning on whole-file dump fallback" task could cover all three.
  - **Stale prose in tests/docs:** bug-045 + bug-040 + bug-028. All are cheap text edits, and bug-045's files are touched by any new mutating op.
  - **Operator-facing errors:** bug-031 (filename half) and bug-035 both lose useful context in `loadOrError` (`src/core/index.ts:181-193`). That overlaps `dl-055` (in-discussion, release empty); consider ratifying dl-055 into v0.3 with them.
- **dl-121 lists bug-036/046/047 as instances** and says they "stay bugs". Scheduling them in v0.3 keeps them aligned with the directive landing in the same release.
- **Surprising:**
  - bug-047 got worse since it was filed. spec-015 §1 now claims an equality rule "enforced by an assertion" that does not exist.
  - The secret scanner (`src/validation/secret-scan.ts`) has **no production caller at all**. Only tests use it, so bug-037's false negative currently affects only the test gates.
  - bug-019 is already `triaged` with an empty `release`, so it needs only the v0.3 stamp.

**Batch 01**

- **Close (fixed):** bug-068 was fixed by `9fec695c` (spec-015 Revision 2026-09-25, which cites bug-068 by name), so propose `reject [open → closed]` with that commit as the reason.
- **Clusters to fold into one task each:**
  - **spec-001 reconciliation:** bug-052 + bug-053 (SARD REQ-STATE-08, P1.13 BDD, spec-011 row, `memory.yaml` `[SPEC]` comments at `:14,56,72`). Per the §9 convention, edit the SARD before the `memory.yaml` annotations. Also check `dl-072` (init per-type machines), which cites the same stale row.
  - **adr-010 Node-floor leaves:** bug-054 + bug-069. Both are dated in-place correction notes on accepted ADRs (the dl-047 shape).
  - **Storage test fixture:** bug-064 + bug-065 (same `test/storage/helpers/git-fixture.ts`, same review origin).
  - **Id allocation:** bug-087 + bug-162 (triaged v0.3, per-release variant of the same counter), implementing `dl-101` (`ready`, v0.3) under `dl-080`'s baseline rule.
  - **Publish-staging script:** bug-061 + bug-067 (later), best scheduled with `dl-087`'s outcome. bug-060 could ride the same `publish.yml` edit if that migration lands in v0.3.
- **Governing DLs already decided:** bug-055 is the fix half of `dl-122` (`ready`, release v0.3); implement them together. bug-051 is referenced by `dl-070` (`in-discussion`), but the fix (pin `--cleanup=whitespace`) does not depend on that ruling.
- **Surprising:** bug-070 has spread since filing. The vacuous `stderr: ''` literal is now in **7** helpers under `test/cli/`, not 2. Meanwhile several newer suites (`approval-authority-baseline`, `dirty-document-refusal`, `reads-resolve-at-head`, …) document the trap in their headers and avoid it. The fix scope should be the 7 helpers, ideally with a shared `spawnSync` helper.
- bug-087 and bug-088 are `status: open` but already carry `release: "v0.3"` from their 2026-09-23 triage notes. The missing step is the `[open → triaged]` approve, not the stamp.
- bug-066's second half (the container `--user` recipe) is deliberately owned by `dl-076` (`in-discussion`, no release). If dl-076 is pulled into v0.3, bring bug-066 along.

**Batch 02**

- **Cluster: Memory git subprocess hygiene.** bug-093 and bug-097 should become one task: a single `git` exec helper with `stdio: ['ignore','pipe','pipe']`, pinned by the out-of-process AC4 harness already in `test/memory/history-rename-path.test.ts`, plus the `audit.ts:244` TSDoc trim.
- **Cluster: jest globalSetup.** bug-095 and bug-066 (open, other batch; unguarded `rmSync` of a root-owned `dist/`) change the same file, `test/global-setup.cjs`. Make them one task.
- **Cluster: CLI reference.** bug-099 and bug-100 are one pass over `docs/01_vision/X_cli-cmds.md`. Coordinate with bug-160 (triaged v0.3, stale vision index that cites this file) and with the v0.3 workflow-command rows.
- **Cluster: `conventions` doc staleness.** bug-105, bug-106 and bug-107 are one cheap docs task. bug-105 is wider than filed: it also covers `P2.3-dna-infer.feature:3` and `01_init-migrate.md:92,99` (US for P2.3), which the bug text does not list.
- **Cluster: directives pillar.** bug-113 is practically a symptom-duplicate of **bug-148** (triaged v0.3, "scope declared twice"). Close bug-113 as a duplicate or merge them into one task. bug-109 rides along (same `schema.ts`). dl-119 (line 107) explicitly waits on bug-148.
- **Cluster: unknown-command suggestion.** bug-104 and bug-115 (open, other batch; "closest-match suggestion never fires on the help path") are one decision. Delegate to Commander and amend spec-005 §3.1 / spec-008 §1, or re-emit through `src/cli/error.ts`.
- **Cluster: DNA path grammar (deferred).** bug-101, bug-102 and bug-111 are one v0.4 task.
- **Surprising 1: bug-075's premise has changed.** This worktree has a root `.wingfoil/` (latest commit `ef97b938`). The "cannot fire here" reasoning in several bug triage notes may be stale, and CLAUDE.md §3 describes the old layout.
- **Surprising 2: bug-113 overstates its reach.** It says the warning shows "in any project scaffolded from a template carrying global directives". The shipped built-in templates carry no `scope` key (`src/storage/builtin-directives.ts:13-16`), so a fresh `wingfoil init` user does not see it. Only this repository's own custom directives trigger it.

**Batch 03**

- **NEW-tools-list: why the capability is missing on the production path.** `wingfoil mcp` → `src/cli/program.ts` (`mcp` command) → `runMcp` (`src/cli/mcp-command.ts:51`) → `startMcpServer` → `createMcpServer` (`src/mcp/server.ts:55-63`). That function registers only `registerReadOnlyResources` and `registerRolePrompts`, and on purpose never calls `registerCoreModules` (module doc, `server.ts:23-26`), because Tools are P5.2.3 / v0.4. So the `server.server.registerCapabilities({ tools: {}, resources: {} })` at `src/mcp/registrar.ts:74` **never runs in production**. It only runs in tests that construct a server through `registerCoreModules`.
  - **The registrar's comment is also wrong on its own terms.** In the SDK, `registerCapabilities` only *declares* a capability. The `tools/list` handler is installed by `McpServer.setToolRequestHandlers()` (`node_modules/@modelcontextprotocol/sdk/dist/cjs/server/mcp.js:59-70`), which is called only from `registerTool` (`:653`). A server with zero Tools that ran that line would advertise `tools` and still answer -32601.
  - The comment's "0 mutating ops" is also stale: the production registry now has many mutating ops.
  - **The current behaviour is pinned by tests.** `test/mcp/read-only-agent-channel.test.ts:185` and `test/mcp/role-prompts.test.ts:262` both expect `listTools()` to reject with `/method not found/`, and `:184` expects `caps.tools` to be undefined. The bug-151 fix (an explicit empty `ListTools` handler) must change those tests and the registrar comment.
  - Real bug: yes. Release: v0.3 as bug-151 already says; a v0.4 slot next to P5.2.3 would also be defensible. No new document is needed.
- **Clusters that should become one task each:**
  - **JSON error surface:** bug-114 + bug-123.
  - **Symlink / guard (security):** bug-118 + bug-124, plus bug-122 (trivial and same theme). bug-121 can ride along or stay separate, since it is wiring `requireConfinedWriteTarget` into 4 config writers.
  - **Directive loader robustness:** bug-125 + bug-154, same file `src/core/loaders.ts`: `lstat` for entries, and fail when the config root is missing.
  - **DNA comment-preserving fallback:** bug-126 + bug-019 (`triaged`, release "", same `dump()` fallback at `src/core/index.ts:386`). Stamp bug-019 v0.3 too.
  - **Extra operands:** bug-131 → merge into bug-171 (v0.3).
  - **Smoke gate widening:** bug-132 + bug-133 + bug-134 (one edit to `scripts/e2e-smoke.cjs` + `e2e-smoke.yaml`; it also changes the publish-staging gate, spec-015 §3).
  - **CLI help polish (v0.4):** bug-104 + bug-115 + bug-116.
- **Duplicates:**
  - bug-127 ≈ bug-165. bug-165 already names the dl-053 revisit and the BDD P1.6 sc.2 pin.
  - bug-131 is a subset-plus of bug-171. bug-171 covers commands that have a positional; bug-131 adds the no-positional ones (`workflow list`, `directives list`) via `allowExcessArguments(true)`.
  - NEW-tools-list = bug-151.
- **Surprising:**
  - bug-154's text says `task-111` moved this repo's config to the root (merge `582ec08a`), and bug-075 is `closed` (v0.2.2). The "no verb can target this repo's Memory" caveat in CLAUDE.md §3/§5.1 looks stale. This should be checked; it is not part of this batch.
  - bug-124's raw git error also belongs to the bug-093 family (open, no release).

## Appendix B — reconcile-governance proposal (for gate 3)

Prepared on 2026-09-29 by two read-only survey agents on this branch (code equal to `main`), each
verdict backed by a file:line or a command.

**The 28 `in-discussion` decision-logs in the selection filter.**
- **Select → `ready` for v0.3: 23.** dl-039, dl-044, dl-046, dl-047, dl-048, dl-049, dl-050, dl-055,
  dl-059, dl-060, dl-061, dl-064, dl-065, dl-066, dl-070, dl-072, dl-073, dl-076 (its (D) half only),
  dl-078, dl-079, dl-084, dl-085, dl-086. The option each should be ratified with is in the table.
- **Not selected, proposed for v0.4: 5.** dl-040 (goes live with P5.2.3 Tools; it carries
  `release: "v0.3"` today, so it is re-stamped `"v0.4"` or it stays in v0.3's filter), dl-043
  (`console` rendering, P5.1.4), dl-058 (directives, out of v0.3's scope), dl-071 (`init` seeding an
  approver, P5.1.1), dl-077 (its own required measurement was never taken; goes with dl-076's (A)).
- **Obsolete or incomplete: 0.** dl-073 and dl-084 are partly delivered (dl-073 (B) by `dl-122`,
  dl-084 (D) by `task-095`); their ratification records that part as delivered.
- **Where the proposal departs from a decision-log's own recommendation:** dl-070 (A) instead of (B),
  because `dl-111`'s `WingFoil-Version:` trailer breaks (B)'s premise; dl-076 only (D), a separate
  `ci.yml` on push and pull request, with (A) left for v0.4 with `bug-119`.
- **Stale text is corrected in the approve `Reason:`, not by editing the decision-logs:** dl-044 and
  dl-061 name `dev-loop.yaml` v1.3/v1.4 (the file is at v1.4, so the target is v1.5); dl-079's commit
  counts have roughly doubled (`start` 197, `finalize` 130, `sync` 116); dl-085 still calls `task-057`
  `backlog`; every decision-log in the batch cites the pre-`task-111` `docs/self/` paths.
- **Ratify before identify-specs:** dl-065, dl-066 and dl-079 are inputs of `spec-003` and of the
  agent-execution spec.

**The six new decision-logs and the options each leaves open** (recommendation first):
- `dl-131` Determinism Index scope: Q1 **(b) reported metric** (already ruled, R1) / (a) release
  objective.
- `dl-132` Vision change and feature ingest: Q1 **(a) a new `change-proposal` type** / (b)
  `feature-request` / (c) a decision-log kind; Q2 **(ii) downcast only the layers the impact analysis
  names** / (i) every layer; Q3 **(x) type and workflow configuration in v0.3** / (y) later.
- `dl-133` Fix-task tail (amends dl-089, dl-099, dl-100): Q1 **(b) a declared task `kind`** / (a) the
  name-and-`bug:` heuristic (six of the nine "planned fixes" of v0.2 were feature tasks that absorbed
  a bug); Q2 **(a) smoke and user-doc checks at every wave end** / (b) only waves that change a command
  or a user document — (a) reverses the cadence chosen when `dl-099` was ratified, which the
  decision-log says openly; Q3 **30 %** of open in-scope tasks (needs Q1 (b)) / 50 % / a count; Q4
  **(i) block the pick-up** of new feature tasks / `pending → backlog` / both.
- `dl-134` dev-loop separation of duties: Q1 **(a) `qa` writes characterization tests black-box** /
  (b) the developer in `green`; Q2 **(a) the freeze covers the files `red` touched** / (b) the whole
  test tree; §4 **(c) both `mode: fresh` and `distinct_from`** / (a) / (b).
- `dl-135` Agent run tracking (amends dl-114): Q1 **(a) a git-ignored `.wingfoil/run/` registry**,
  with `REQ-SYS-03`'s fit criterion read as "no *committed* state index" / (b) per-user directory /
  (c) probe processes; Q2 **(c) the run record points to Execution Notes** / (a) a record field / (b)
  Execution Notes only; Q3 **(a) run id `<element>/<phase>/<n>`** / (b) session id / (c) closing
  commit.
- `dl-136` Test results publication: Q1 **(c) summary in the repository, full reports as Release
  assets** / (a) / (b); Q2 **(a) Jest's own JSON** (JUnit needs a new dependency, `dl-010`) / (b)
  `jest-junit`; Q3 **(a) the CI run on the tag** (today `gate` runs `npm test` without coverage) / (b)
  local; Q4 **(a) `release-submit` produces, `release-publishing` attaches** / (b) publishing only.

**Full table of the 28** (evidence per decision-log, as the survey agents wrote it):

| DL | Question | Still live? + evidence | Proposal | Options to choose | Reason |
|---|---|---|---|---|---|
| dl-039 | spec-004 §3.2 example: `role:"system"` is impossible, "order" overreaches, heading levels invert | **Live.** `spec-004-mcp-surface-contract.md:119` `role: "system"`; `:132` "Directive resolution order"; `src/mcp/prompt.ts:120` embeds each body verbatim under `## Directive:` (H1 inside H2) | **select → ready** (already `release: v0.3`) | role **1** (example → `"user"`); ordering **1** ("resolution set", id-ascending per spec-012 §5); headings **1** (demote body headings by two levels) | Editorial except the heading demotion, a small code change in prompt.ts. Land it as one spec-004 §3 amendment with dl-048/dl-049. |
| dl-040 | Core-op Resource URIs diverge from spec-006 §3; CoreOperation lacks parameter metadata | **Live but dormant.** `spec-006:147` `memory/history/{id}` vs `test/core/parity.test.ts:181` `memory/history`; `spec-006:159` `dna/paths` vs parity `:183` `wingfoil://paths`. `src/mcp/server.ts:23`: the production server does not call `registerCoreModules`. bug-151's fix is an empty `tools/list` and does not touch the registrar | **not selected → v0.4** (restamp `release: "v0.4"`) | (at v0.4) decide 1 vs 2 against P5.2.3, and state `pathsQuery`'s outcome | No running surface is affected. The URIs go live when P5.2.3 Tools (v0.4, `minor-v0.4.md:8`) wires `registerCoreModules`. v0.3 is heavy. |
| dl-043 | `--format console` prints JSON, against spec-008 §2's human rendering | **Live.** `src/cli/output.ts:19-25` falls back to `JSON.stringify(value, null, 2)`; `spec-008:58` promises colour and `✓/⚠/✗` | **not selected → v0.4** | (at v0.4) (a) with a generic renderer, or (b) | Owned by P5.1.4 CLI UX, which is `minor-v0.4` scope (`minor-v0.4.md:8`). The new `workflow status/next` output is its first big consumer; note that for v0.4. |
| dl-044 | Add `typecheck.clean` (`tsc --noEmit`, full project) as a declared gate | **Live.** No `tsc --noEmit` in `package.json` scripts, `.github/workflows/publish.yml` or `dev-loop.yaml` checks (grep → none). Run by hand only: `release-submit-rel-v0.2.2-plan.md:109` G4. `tsconfig.test.json:26` `ignoreDeprecations: "6.0"` | **select → ready** | Main: **recommended** (`typecheck.clean` in `refactor.checks.post` + a `test/lint/` suite). Scope: **also repo-level** (CI / release-submit). Pin: **accept until TS 7** | retro-v0.2 disposition #5 already assigns it to v0.3. Update the DL's stale targets: `dev-loop.yaml` is now v1.4, so v1.5, plus the **v0.3** dev-loop plan. |
| dl-046 | spec-006 bootstrap rows: `project.init` underivable, `audit` naming, `{module}{Verb}` rule | **Live.** `spec-006:189` Tool `project.init`, `:190` `wingfoil://project/audit`; `01_architecture.md:57` REQ-SYS-05 Fit "every state-mutating operation … reachable via an MCP tool" | **select → ready** | **A(a)** bootstrap exempt (amend REQ-SYS-05); **B(a)** flat `audit`; **C** relax the naming rule | Spec and requirement text only. It unblocks bug-028's spec-006 half (v0.3), and C also covers the flat ops v0.3 adds. B's answer goes to P5.1.3 (v0.4). |
| dl-047 | doc-versioning assumes a `version:` that no tech-spec/ADR/DL/task carries | **Live.** `.wingfoil/directives/custom/doc-versioning.md:16` "A document carries a `version:`"; `grep -c '^version:' .wingfoil/memory/templates/*` → only release-line/plan/release = 1 | **select → ready** | **1** (scope the bump to versioned docs; dated Revision note for approved/accepted elements) | Prerequisite: dl-120 (ready v0.3) was ratified with Q2(a), "V1 … as dl-047 is ratified" (`a2690231`). Every spec amendment in this batch uses the Revision note. |
| dl-048 | spec-004 §3 lacks the undefined-role Prompt refusal BDD P5.2.2 requires | **Live.** `grep -n 'undefined\|wizard' spec-004` → none; the code already does it: `src/mcp/prompt.ts:71` (InvalidParams), `:79` exact message | **select → ready** | **1** (§3.4 Refusals: `-32602`, both messages, the session=`prompts/get` mapping) | Ratifies shipped behaviour. Same edit as dl-039/049, and it gives v0.4 Tools a precedent. bug-034 (v0.4) is avoided on this path (plain `Error`). |
| dl-049 | When the MCP Prompt role set is read; `listChanged` | **Live.** `spec-004:107` "derived from DNA at server start" vs `prompt.ts:189,201` `loadRoleNames` per request; `prompt.ts:187` `prompts: {}`; `spec-014:63,79` still say "v0.1 channel" | **select → ready** | **(b)** read in `runMcp` pre-flight, pass the set into `createMcpServer`; `listChanged`: **no**; editorial spec-014 §2/§3 fix | bug-035 (v0.3) already adds the pre-flight refusal. (b) puts the role read there too. Fallback if too costly: (a), which needs no code. |
| dl-050 | Directive-resolution warnings are computed but shown to no operator | **Live.** `grep -rn 'assembleExecutionContext(' src` → definition only (`src/core/context.ts:267`); `prompt.ts:128-132` keeps warnings out of the prompt | **select → ready** | **1 + 4** (`directives list --role` check in a sweep; `agent execute` prints `ExecutionContext.warnings` on stderr) | `agent execute` (P5.3.1, v0.3) is the first caller of assembleExecutionContext. Option 4 becomes one of its ACs. Option 1's sweep lands with P4.12 or audit if not declared now. |
| dl-055 | `CoreError.details` (issue file/detail) dropped by CLI and MCP | **Live.** `src/cli/error.ts:14-20` `emitError(reason, {hint})` has no details; `src/mcp/registrar.ts:86` keeps only `error.message` | **select → ready** | **1** (detail lines after the contract line; additive `details` array in json/yaml; MCP `error.data`) | Closes bug-031's filename half (v0.3) and overlaps bug-035 (v0.3), as plan Notes `:381` suggests. State-deduction errors in v0.3 need file names. |
| dl-058 | May `directive create` take a built-in id (a silent shadowing override)? | **Live.** `src/core/index.ts:1365-1368` checks only `.wingfoil/directives/custom/${name}.md`; task-057 (done) moved the P3.8 six into `built-in/` | **not selected → v0.4** | (at v0.4) **1** (allow, plus a shadow hint and a P3.1 scenario) | Directives are not in v0.3 scope and the release is heavy. The only harm is an unannounced override, which `directives list` already reports. Fits v0.4 CLI polish. |
| dl-059 | Built-in `security` directive bound to no role, so REQ-SEC-08 is inert | **Live.** `src/storage/templates.ts:337-340` `global:` holds `security-secrets` only; `.wingfoil/roles.yaml:5` leaves `security` unassigned on purpose | **select → ready** | **1** (bind `security` globally in the scaffold); dogfood: also bind it (resolution deduplicates) | v0.3 ships P5.4.2 auto-load and `agent execute` contexts. An unloaded security directive is then a real gap. Coordinate with bug-112 (tests pin roles bindings). |
| dl-060 | roles.yaml binds by directive id, not name: correct spec-011 | **Live.** `spec-011-storage-layout.md:113` "list of directive names", `:126` "binds by directive **name**"; code binds by id (`src/directives/schema.ts` TSDoc) | **select → ready** | Ratify the recommendation (amend spec-011 to ids, dated Revision note) | Doc-only, and the same spec-011 passage as bug-040 and bug-053 (both v0.3). One edit settles all three. |
| dl-061 | dev-loop review-reject fallback leaves the absorbed bug at `in-review` | **Live.** `.wingfoil/workflows/custom/dev-loop.yaml:95` `fallback: { step: red, set_state: in-progress }` with no `bug.sync_state` (the syncs are at `:38,:91,:105` only); `:106` is the same for `done` | **select → ready** | **A.1** (fourth sync on the review fallback; `done` fallback deferred to dl-053's edge question); **B.1** (cite the approver's sha); **C.1** (the reject procedure emits both commits) | The v0.3 engine implements fallback (P4.15) and approval routing, and R4 rewrites dev-loop. Name task-061 as the precedent. It needs its own task (addendum). |
| `dl-064` | Is "legality before authority" declared, and should `requireGitIdentity` return the identity? | **Live.** `src/core/git-identity.ts:71` still returns `CoreResult<void>`. Identity is re-read at `src/core/approval-authority.ts:113` and `src/core/index.ts:1097,1189`. `grep -n "pre-flight\|dl-064" docs/04_memory/design/specs/spec-006*` finds nothing, so A is undeclared. The order in the code addendum (`a422a4e3`, task-125) is current. | **select → ready** | **A.1**: write the post-task-125 order (usage checks, identity, transition, authority) into spec-006, scoped to `approve`/`reject` by name (Review addendum pt. 1). **B.1**: give it to **bug-149**'s fix task (v0.3). | bug-149 (v0.3, triaged) rewrites the same identity read so the authority check and the commit author agree. B.1 is the same change. A.1 only edits a spec. |
| `dl-065` | How is `superseded` ever reached? spec-010 still says deprecate writes it. | **Live, and it has gone wrong once already.** `grep -rn supersedes src/` finds only TSDoc. `spec-010:~125` still has the "deprecate-adjacent … superseded" row. `spec-004:197,256` still say "approver-gated". `state-machine.ts:79` still names `approve`. **`a7d783aa` moved adr-005 `accepted → superseded` by hand, with a `deprecate` subject**, the first `superseded` document (`grep -rl "^status: superseded" docs/04_memory` → adr-005). | **select → ready** | **Q1.1**: a `supersedes:` engine trigger. Sub-question: fire it on the superseding element's `approve` (its `pending → accepted/approved`). **Q2**: the reworded spec-010 row. **Q3**: `superseded → deprecated` stays legal, and spec-004 says "state-transition verbs". | v0.3 builds the workflow/engine side of state changes. This is the one `waiting` edge with no producer, and the only existing instance was done by hand against CLAUDE.md §5.1. |
| `dl-066` | Can a workflow step reference a directive directly, or only through its role? | **Live.** `grep -in directive src/workflow/schema.ts` → no hit. `P3.3-directive-remove.feature:9` still reads "not assigned to any role or workflow step". **P4.9 (`workflow remove`) is in `minor-v0.3` `features:`**, the feature this DL says must receive the outcome. | **select → ready** | **Option 1**: role-transitive only. Amend P3.3:9 and REQ-SEC-07. Rescope P4.19 sc.2, now in v0.4. | P4.9 is in v0.3 and its clause-(b) message depends on this. R4's per-phase roles and `executor` make the role the binding point. No code changes. |
| `dl-070` | Does the `Reason:` block end at any `Key: value` paragraph, or only known trailers? | **Live.** `src/memory/commit-message.ts:158` `trailerParagraphStart` (shape rule) and `:193` (`start + 1` floor). The refusal text is at `:74`. **dl-111 (`ready`, v0.3)** adds a project-owned trailer, `WingFoil-Version:`. | **select → ready** | **(A)**: keep the shape rule, **against the DL's (B)**. Add **S3** (write the rule into spec-008 §2) and **S4** (add the remedy to the refusal message). | dl-111 falsifies (B)'s premise that "only Co-Authored-By ends commits". Under (B), every new trailer means editing the key list. Under (A) nothing changes, and CLAUDE.md §5.1 already states (A). |
| `dl-071` | Should `init` seed the initialising user as approver, or keep a signposted refusal? | **Live.** `src/storage/templates.ts:245` `members: []`. The refusal (`approval-authority.ts:146`) still gives no hint when no member holds `approver`. The **appended-hint mechanism already exists** (`uncommittedGrant` suffix, `a647c225` task-090), so (B)/S3 is feasible without touching REQ-SEC-03. `docs/user-guide.md` §4.2 documents the manual step. | **not selected**: v0.4 | For v0.4: **(B) + S3** (a hint appended when no member holds `approver`) **+ S4** (the smoke gate adds the member explicitly). | This is an `init`/CLI polish item; P5.1.1 is in `minor-v0.4` `features:`. The user guide already covers the step. Low urgency in a heavy release. |
| `dl-072` | Should `init` scaffold one shared `defaults` machine or per-type `states:`? | **Live, and (A) has already shipped.** `src/storage/templates.ts:300` has the `defaults:` block. There is no commented override (`grep -n "#\s*states:" src/storage/templates.ts` → none). Its dependencies **bug-052/bug-053 are selected for v0.3** (plan Appendix A rows 316–317, 392). | **select → ready** | **(A) + S1** (a commented `states:` example on `bug`) **+ S3/S4** (after bug-052/053). | This ratifies the shipped code. S1 is about 4 template lines and can go into the bug-052/053 spec-001 reconciliation task already planned for v0.3. |
| `dl-073` | Does a clean secret scan claim anything about what may be published/pushed? | **Partly settled.** Option (B) was taken by **dl-122** (`ready`, v0.3, "Takes, by citation: dl-073 option (B)"). bug-055 is selected for v0.3. Still open: (C) and S1/S3. `SCAN_SURFACE_ROOTS` is now `['.wingfoil','docs/04_memory']` (`secret-scan.ts:308`), but spec-007 §1 still names `docs/self/` roots (`spec-007:205`). No service element records the GitHub push-protection exception (`grep -rli "push.protection" docs/04_memory/services/` → none). | **select → ready** | **(C) + S1** (narrow claim: "0 findings on the configuration store"), (B) recorded as delivered by dl-122, **S2** (REQ-SEC-08 unchanged), **S3** (a `service` element for the exception, per dl-122 action 4). **(A) declined** until S4 is measured. | Doc-only. It rides the bug-055/dl-122 task. It also fixes spec-007 §1's stale roots after the task-111 move. |
| `dl-076` | Local and release toolchains differ, and nothing exercises the difference before a tag. | **Live.** `.github/workflows/` holds only `publish.yml`, with `on: push: tags` only (`publish.yml:127-129`). `package.json` has no `packageManager`. There is no `.nvmrc` or `.npmrc`. Local `npm --version` → 11.6.2. **bug-119** is `open`, and the plan's Appendix A (line 355) defers it to "decide with dl-076". bug-066's second half is owned by dl-076 (plan :400). **dl-069 (`ready`) explicitly left its push gate (a) to dl-076** (`41112fe5` Reason). bug-056 is closed (`fdee8cb4`), which removes (A)'s ordering trap. | **select → ready** (the (D) half only) | **Q1**: one decision, two tasks. **(D) now**: a separate `ci.yml` on push/PR (`npm ci` + `prepublishOnly` on ubuntu-24.04 at `NODE_VERSION`), with no adr-009 amendment (Q4). **Q2**: a CI failure on the branch. **(A)** and **Q3** go to v0.4 with bug-119. | dl-069's deferred gate lands here. v0.3 already edits CI (dl-087 migration, R6 test-results publication), and a push gate is where results are produced. |
| `dl-077` | `@types/node` tracks the Node major, so types overshoot the `>=22.12.0` floor. | **Live but unmeasured.** `package.json:70` `"@types/node": "^22.20.4"`, installed as 22.20.4. Its own Action 2 asks for a measurement first ("does any `src/` use a post-22.12 API?"), and that was never done. | **not selected**: v0.4 (with dl-076's (A)/Q3 half) | For v0.4: **(A)** accept and document next to `engines.node`, once Action 2's measurement is recorded. (C) folds into dl-076 if a runner at the floor version appears. | No failure has been observed. The DL requires a measurement before ratification. It is the same toolchain question as dl-076's deferred half. |
| `dl-078` | Should `--reason` refuse C0 control characters that render invisibly in `git log`? | **Live.** The read side was fixed by task-086 (bug-050 closed, `1269e6b9`). Nothing refuses C0 in `commit-message.ts`. **Action 2's measurement was done here:** 0 of 1471 `wf(` commit bodies contain a C0 character other than `\t`/`\n` (python scan of `git log --grep='^wf('` over `[\x02-\x08\x0b-\x1f\x7f]`). So (A) invalidates no history. | **select → ready** | **(A)**: refuse C0 except `\t` and `\n` at exit 2, naming the character. Amend **dl-067 clause 4** in the same pass as dl-070's S3. | The measured cost is zero. It closes a forged-`Approver:` presentation attack, and `deprecate` is the sharpest path. It pairs with bug-073 (v0.3) and dl-070's spec-008 edit. |
| `dl-079` | Should the practised `wf()` verbs `start`/`finalize`/`sync` be ratified in the grammar? | **Live, and it has grown.** `git log --format=%s` verb counts: sync 197, finalize 130, start 116, against approve 378, submit 364, add 206, reject 36, deprecate 2. **Action 2 is answered by the code:** `src/memory/audit.ts:195` `OPERATION_RE` accepts only the five, so `memory history` reports `operation: null` for the others. State still comes from frontmatter, so nothing is mis-attributed. dl-108 (`amend`) and dl-110 (park), both `ready`/v0.3, need new verbs and defer to this DL. retro-v0.2 row 10 schedules it for v0.3. | **select → ready** | **(A)**, a closed and declared list: the five CLI verbs plus `start`, `finalize`, `sync` and the verbs dl-108/dl-110 add, each with its bracket rule and emitter. Extend `OPERATION_RE`. | v0.3's workflow commands will emit `start`/`finalize`/`sync` themselves. The grammar has to be fixed before the engine writes it (plan idea 7). |
| `dl-084` | `memory add` (HEAD) and `memory search` (working tree) disagree about a type. | **Partly settled.** (D) is already shipped: the refusal says "the working tree's memory.yaml defines it, but that change is not committed … (dl-080)" (`src/core/memory-add-type.ts:136-142`, `27d8346f` task-095). Still open: **`docs/cli-reference.md:66-68` says every command reads config "as committed at HEAD"**, which is false for `memory search` and the MCP Resource (`src/mcp/memory-resource.ts:73,111` `loadMemoryYaml`). | **select → ready** | **(A) + (D)**: record (D) as delivered by task-095. Fix cli-reference and spec-008 to list which verbs read HEAD and which read the working tree. E3 (MCP Tool) goes to v0.4 with MCP Tools. | Doc-only. It corrects a false sentence in the user reference. The MCP half has no mutating Tool until v0.4. |
| `dl-085` | `command-baseline`/`claim-evidence` reach only agents bound by this repository's roles. | **Live, but E2 is stale.** task-057 is `done` (`grep ^status docs/04_memory/v0.2/task-057*`). `.wingfoil/directives/built-in/` holds only `.gitkeep`. (B) is effectively in place: spec-006 §6 (`:241`) carries the rule and `command-baseline.md:15` cites spec-006. `COLLABORATION.md` names neither directive. | **select → ready** | **(A) + (B)**: spec-006 §6 is normative and the directive points to it. State the audience inside both directives. (C) is declined for `command-baseline`. | Nearly free. v0.3's `agent execute` auto-loads role directives (P5.4.x), so the audience of each directive needs stating now. |
| `dl-086` | May a guard predicting an imminent syscall's target read the filesystem instead of HEAD? | **Live, and the code already relies on it.** `src/core/confinement.ts:87`, `src/storage/confinement.ts:101,135`, `src/core/memory-transition.ts:275` and `src/storage/memory-path.ts:90` all cite dl-086 as `in-discussion`. `.wingfoil/directives/custom/command-baseline.md:39` "There is no third category of read" contradicts them. bug-108 (the adjacent read that keeps HEAD) is proposed for v0.4. | **select → ready** | **Adopt as proposed**: filesystem-effect prediction reads the filesystem, and every other gating read uses HEAD. Amend command-baseline:39. State that bug-108 stays owed to HEAD. Name the TOCTOU residual as a limit, not a defence. | Shipped code (task-102/105/106) cites an unratified DL. A ratified directive contradicts it. v0.3's run records add more filesystem writes. |

**Survey notes:**

**Batch A**

- **Counts:** select → ready **11** (dl-039, 044, 046, 047, 048, 049, 050, 055, 059, 060, 061); not selected **3** (dl-040 → v0.4, dl-043 → v0.4, dl-058 → v0.4); obsolete **0**; reject → draft **0**. Each DL was still live when checked against the current code (evidence column). None is settled by a later commit: `git log --all --grep=<id>` shows only add/submit/addenda and citations.
- **Cluster: spec-004 §3 (MCP Prompts): dl-039, dl-048, dl-049.** One amendment, one dated Revision note (dl-047). Only dl-039's heading demotion and dl-049(b) change code. dl-049(b) shares the `runMcp` pre-flight with **bug-035** (v0.3), so that task should carry both.
- **Cluster: spec-006 §3 (the operation table): dl-046 (select), dl-040 (defer).** dl-046 does not depend on dl-040. dl-040's addendum (b) (`pathsQuery` → `wingfoil://dna/paths` vs `wingfoil://paths`) is the same naming family as dl-046 C. If C relaxes the rule for flat self-named ops, the natural answer for `pathsQuery` at v0.4 is to amend §3 to `wingfoil://paths`. **bug-028**'s spec-006 half waits on dl-046.
- **Cluster: spec-011 (bindings and the stale built-in wording): dl-060 + bug-040 + bug-053.** One edit.
- **Cluster: operator diagnostics: dl-055 + dl-050 + bug-031 + bug-035.** They share the error/warning surface. dl-050 option 4 and dl-055's renderer should use one stderr convention in `agent execute`.
- **Cluster: directives: dl-059 (select), dl-058 (defer).** dl-059 changes `rolesYaml()` and the dogfood `roles.yaml`. Those are the bindings **bug-112** pins by exact array, so schedule bug-112 first or in the same task.
- **Dependency: dl-047 before dl-120.** dl-120 (ready v0.3) was approved with Q2(a) ("V1 … as dl-047 is ratified", commit `a2690231`), so dl-047 must reach `ready` for dl-120's V1 to be writable. Every spec amendment above also uses dl-047's Revision-note form.
- **dl-061 ties into the new v0.3 work:** R4's dev-loop separation of duties rewrites the same `review`/`done` steps. **dl-098** (ready v0.3, re-review checks the previous reject class) touches the same `review` fallback. B's sub-question (the undeclared `sync` verb, many commits on `main`) is **dl-079**'s territory, so ratify them together or have dl-061 B.1 cite dl-079. Its Actions still say "v0.2 dev-loop plan" and "dev-loop.yaml v1.4". The file is already v1.4 (`dev-loop.yaml:27`, dl-123), so the bump is v1.5 and the plan to amend is the **v0.3** dev-loop plan. The same staleness appears in dl-044 ("makes dev-loop.yaml v1.3", "v0.2 plan file"). This is not a reason to reject either one: the decision content is complete, and the Reason can restate the targets.
- **dl-044 vs P4.12:** declaring a `typecheck.clean` check in `dev-loop.yaml` is config, like `lint.clean` (dl-034). The checks runner is v1.0, so in v0.3 the gate runs through the phase plan and its `test/lint/` suite, and at release-submit (G4 already does this by hand).
- **dl-040 is stamped `release: "v0.3"`.** "Not selected" alone would leave it in v0.3's filter, so restamp it to `"v0.4"` (a field edit with no verb; do it by hand in §5.1 style, or in build-backlog's stamping commit) so the v0.4 planning sweeps it. dl-043 and dl-058 have `release: ""`, which v0.4 already picks up, but stamping `"v0.4"` makes the deferral explicit.
- **Surprise:** every DL in this batch still cites the pre-`task-111` `docs/self/...` paths, so a reader following them hits missing files. A citation sweep is not proposed here. dl-075 (bare offsets) already covers the class, and the ratification Reasons can cite the root paths.
- **Surprise:** dl-040's Context overstates its count: its own addendum corrects `memorySearch` (no divergence) and adds `pathsQuery`. The v0.4 ratification should read the addendum, not the Context.

**Batch B**

- **Cluster: the reason/commit grammar (dl-067 amendments).** dl-070 (terminator), dl-078 (C0 refusal) and dl-079 (verbs), plus dl-111 (`ready`, v0.3, the `WingFoil-Version` trailer), all touch `src/memory/commit-message.ts` / `audit.ts` and the spec-008 §2 `--reason` row. Propose **one task, one spec-008 amendment, one dl-067 revision note**. dl-111's new trailer is why this proposal inverts dl-070's recommendation from (B) to (A).
- **Cluster: the dl-080 baseline family.** dl-084 (read-only verbs), dl-085 (who reads the rule) and dl-086 (filesystem exception) all end in edits to `.wingfoil/directives/custom/command-baseline.md` and spec-006 §6 / spec-008. Make **one directive revision** (with a version bump, per doc-versioning). bug-108 (v0.4 per Appendix A) is dl-086's counterpart that stays owed to HEAD.
- **Cluster: identity and authority.** dl-064 B.1 and **bug-149** (v0.3, triaged) both rewrite `src/core/git-identity.ts`. One read of the identity should feed the authority check, the `Approver:` line and the commit author. Hand dl-064 to bug-149's task through `depends_on`/Relations, because dl-015's `read_related` does not follow decision-logs.
- **Cluster: init scaffold.** dl-071 and dl-072 were filed together and are deliberately split. dl-072 rides the bug-052/053 spec-001 reconciliation (v0.3). dl-071 waits for P5.1.1 (v0.4). dl-064's pre-flight order no longer masks dl-071: bug-030 is closed (`9002cd48`), so the `not authorized` refusal is reachable on a fresh init today.
- **Cluster: toolchain.** dl-076 (D) takes over the gate dl-069 deferred. Leave its (A)/Q3 half, dl-077, bug-119 and the second half of bug-066 together for v0.4. If (D) lands, schedule it with the dl-087 publish.yml migration and R6 (test results come from CI), so CI is edited once.
- **Cluster: workflow engine inputs.** dl-065 (the `supersedes:` trigger or `set_state`), dl-066 (P4.9 `workflow remove` referrers) and dl-079 (the verbs the engine emits) are prerequisites for spec-003/spec-008 work at identify-specs (step 5). Ratify them before spec-016 and the spec-003 revision are written.
- **Surprise 1: a hand-made `superseded` exists.** `a7d783aa` (2026-09-21, author "Probe") moved **adr-005 `accepted → superseded`** under a `wf(adr): deprecate` subject. That breaks CLAUDE.md §5.1 ("no element should be moved to `superseded` by hand … retire the replaced one with `deprecate`" to `deprecated`), and it does so under a subject that `memory history` parses as `deprecate`. dl-065's approval should say whether adr-005 is left as it is (history is not rewritten, dl-035) or recorded as the first instance the trigger would have produced.
- **Surprise 2: cli-reference makes a false claim.** `docs/cli-reference.md:66-68` says every command reads configuration as committed at HEAD. `memory search` and the MCP Resources read the working tree. This is dl-084's remaining work, and a user-docs defect the `user-docs` gate will meet.
- **Surprise 3: shipped code cites a DL that is still in discussion.** Five source sites cite dl-086 as `in-discussion`. After ratification those TSDoc citations should drop the status word, or be left alone, because the status goes stale.
- **Stale statements inside the DLs, to correct in the approve Reasons, not by editing the DLs:** dl-085 E2 (task-057 is done). dl-079's table (counts have roughly doubled: sync 197 / finalize 130 / start 116). dl-064 Context (i), which its own code addendum already corrects. dl-073 E1, where the roots moved with task-111.
- **Nothing is proposed for deprecate.** Every DL still has at least one live clause: a spec, directive or doc that is still false, or code that cites the DL. The partly settled ones (dl-073 via dl-122, dl-084 via task-095) are ratified with the delivered half recorded as delivered, rather than deprecated. Deprecating them would drop their remaining clauses (dl-073's (C) and S3, dl-084's doc fix).

## Handoff

- **Approver:** gates 2–5 and 7; the ratification of the new decision-logs at gate 3; the `verify`
  and approval of the three services; the go-ahead to merge into `main` and to push. Also a ruling on
  the stale worktrees `.wf2-wt/task-093` … `task-106`, `design-dashboards` and
  `retrospective-v0.2`, which this phase does not touch.
- **Agent:** all authoring (this plan, `minor-v0.3`/`minor-v0.4` and the vision edits, the ingest
  plans and their elements, ADR and specs, the tasks), the non-gated steps, the triage and
  reconcile proposals, spec-review preparation, commit hygiene. It never approves.
- **Completion criteria:** `minor-v0.3` `in-development`; every selected bug `planned` with
  `release: v0.3`; every in-scope decision-log `ready`; `adr-012` `accepted`; the specs the scope
  needs `approved`; every task `backlog`. **Stop at commit-backlog**: the dev-loop is the next phase.
