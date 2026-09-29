---
id: release-planning-rel-v0.3-plan
type: plan
title: "Release-planning — rel-v0.3"
status: active
version: "1.0"
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

2. **triage-bugs** (tech-lead, ⛔; R10). Candidates: the 66 `open` unscheduled bugs, the 2 `open` v0.3
   bugs, and one new candidate to confirm and file first through `bug-ingest`: `wingfoil mcp`
   answers `tools/list` with `-32601 Method not found`, although `src/mcp/registrar.ts:74` declares
   the `tools` capability precisely to avoid that (observed 2026-09-29 on the `main` build by an
   stdio probe: `prompts/list` → 8, `tools/list` → -32601). The agent prepares a disposition table
   grouped by area (CLI grammar, Memory, workflow, MCP, docs, publish, tests), each row with a
   proposed `approve [open → triaged]` for v0.3, `reject [open → closed]` with a reason, or *not
   selected* (left `open`, named for a later release). The approver rules per group. The four
   `triaged` unscheduled bugs are carried into build-backlog's selection.
   Housekeeping found while counting: two v0.3 bugs keep the template comment after the value on
   their `release:` line; fixed in the build-backlog stamping commit.

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

## Observations on the pinned build (wingfoil 0.2.2)

Recorded as they occur, per the rule that every command's real effect is checked against its
contract. Each becomes a bug through `bug-ingest` at step 2 if it reproduces.
- `memory add --type plan … --set element=minor-v0.3 --set release=v0.3` → exit **1**, "memory type
  'plan' has no token {element} in its id_pattern or path". A rejected option value is a command-line
  error, which the exit-code contract maps to **2**. `--set` also cannot fill a template field that is
  not a path token, so `element:` and `release:` are written at submit.

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
