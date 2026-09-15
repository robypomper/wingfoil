---
id: "task-068-fix-claude-md-project-status"
type: task
title: "Fix: CLAUDE.md §1 still tells every agent the project has no source code"
status: in-progress
release: "v0.2"
priority: "High"
tags: ["v0.2", "documentation"]
ref: "bug-008-claude-md-stale-project-status"
bug: "bug-008-claude-md-stale-project-status"
depends_on: []
tmpl_version: 260703
---

## Description

`CLAUDE.md` §1 carries a *"Project status: specification & design phase"* callout asserting there is
**no source code yet**, that the `wingfoil` CLI/MCP is **not implemented**, and instructing agents to
*"not assume runtime behaviour exists"*. All three have been false since `minor-v0.1` was released;
`main` now carries 69 test suites and 866 tests, a packaged CLI, and an MCP server.

This is the agent entry point — the first thing read in every session. Its opening section currently
misdirects anyone who does not have contradicting instructions.

## Acceptance Criteria

1. §1's status callout describes the project as it is: implementation exists and is under active
   extension, with the specs still authoritative for *what* to build. Replace the three false claims;
   do not simply delete the callout, since the "specs win" guidance around it is still correct and
   load-bearing (§10.1).
2. Sweep the rest of `CLAUDE.md` for the same staleness rather than fixing only §1 — §3's "it will
   move to the repository-root `.wingfoil/` once the tool can manage it" and §6's "Interim — no
   workflow engine yet" are the obvious neighbours. Correct what is false; **leave what is still
   true**, including the interim plan-first rule, which still holds.
3. The claim that state changes are performed manually (§6's dogfooding note) is checked against
   reality rather than assumed — the CLI does exist, so state whether the manual procedure is still
   the intended one or merely the current one.
4. No behavioural change; documentation only. Full suite, `tsc`, `docs:api` and `eslint` all green.

## Implementation Notes

Scheduled into `v0.2` under the exception extended in **`dl-034`** point 4. `bug-009` was admitted
because it gated the *verification* of every remaining v0.2 task; this gates their *orientation*.

**This fix will regress unless `dl-025-agent-facing-docs-ownership` is settled.** That decision-log
(`in-discussion`) exists precisely because **no workflow gate owns `CLAUDE.md`**, which is why the
file went stale in the first place and why this is the second time it has been caught by a review
rather than by a check. Fixing the text is this task; assigning the ownership is `dl-025`. Do not
implement a gate here — flag it if `dl-025` is still open when this runs.

`bug-008` is linked, so `dev-loop`'s `bug.sync_state` advances it automatically.

## Execution Notes

### `design` — role: architect

**`depends_on`** is `[]`, so `agent.read_related` (`dl-015`) has nothing to load; the gate is vacuously
satisfied.

**`agent.classify_acs` (T1).** All four ACs are **documentation-correctness** criteria over a single
prose artefact (`CLAUDE.md`). None is red-first, and AC-4 is a pure characterization criterion.

| AC | Classification | Reasoning |
|---|---|---|
| 1 — §1 callout describes reality | **characterization (no new behavior)** | The subject is prose, not a code path. There is no production symbol whose behavior changes; nothing can go from red to green. |
| 2 — sweep the rest of the file | **characterization** | Same: each claim is verified by reading the artefact it projects (`dna.yaml`, `memory.yaml`, `roles.yaml`, `workflows.yaml`, the filesystem). |
| 3 — manual-transition claim checked against reality | **characterization** | Answered by inspecting `CORE_MODULES` and the v0.2 backlog; the deliverable is a corrected statement, not a behavior. |
| 4 — no behavioural change; suite/`tsc`/`docs:api`/`eslint` green | **characterization (regression guard)** | The existing 69 suites are exactly the guard that `src/` was not touched. No new assertion is needed to express "nothing changed". |

**Why no red-first test — and what the honest alternative would have been.** Writing a failing test
here would mean asserting on the prose of `CLAUDE.md` (e.g. "§1 must not contain the string *no source
code yet*"). That is a fabricated red in the sense the `testing` directive prohibits: the assertion
would be authored *from* the fix rather than from a specification, it would pass forever after on a
string that nobody will reintroduce, and it would not catch the next instance of the same defect —
which will be a *different* stale sentence. A genuinely useful mechanical check **does** exist and is
already specified: `dl-025-agent-facing-docs-ownership` (now `ready`, ratified on shape **(B)**) puts
an `align-agent-docs` phase in `user-docs.yaml`, `role: architect`, whose post-check compares §4/§5/§6/§7
against `dna.yaml`/`memory.yaml`/`workflows.yaml`/`roles.yaml` — exactly the four sections this sweep
found stale. `test/docs/api-docs.test.ts` (task-062) is the precedent for how such a gate is made
executable. Building it is **explicitly not this task**: `dl-025`'s own Actions assign the
`user-docs.yaml` amendment to the next `release-planning` → `build-backlog`, this task's Implementation
Notes repeat that instruction, and the task's scope forbids touching `test/` or any workflow YAML.
So: no test is added, and the reason is scope + the no-fabricated-red rule, not absence of a
checkable property.

**`agent.verify_specs`.** No `tech-spec` governs `CLAUDE.md`'s contents, and none needs to be
scaffolded: the document is a *projection* of artefacts that already have approved schema specs —
`spec-001-memory-yaml-schema` (§5), `spec-002-dna-yaml-schema` (§4), `spec-003-workflows-yaml-schema`
(§6), `spec-011-storage-layout` (§3's `.wingfoil/` layout, incl. the `built-in/`-reserved rule) — plus
`roles.yaml` itself for §7. Correctness here means agreeing with those files, not defining a new
contract, so a spec would have no scope of its own. `design` is therefore a pass-through: no
`memory.add(type: tech-spec)`, no approver gate.

**`doc-versioning` (global directive).** Checked before editing: the directive applies to "a document
[that] carries a `**Version:**` / `version:` field". `CLAUDE.md` has **no frontmatter and no version or
date field at all** (verified by reading the file end to end). There is nothing to bump, and adding a
version field would be an unrequested convention change. No bump performed.

### `red` — role: developer

**No commit, no test written.** Every AC classified `characterization` at `design`, so
`tests.failing(for: red-first ACs)` is vacuous and `tests.exist` is satisfied by the pre-existing
suites that guard AC-4. The reasoning is in the `design` notes above — the short version is that the
only non-fabricated mechanical check for this defect class is `dl-025`'s `align-agent-docs` post-check,
which this task is explicitly forbidden to build.

### `green` — role: developer

`CLAUDE.md` swept end to end against the repository. Every claim below was checked against a named
artefact; **corrected** means the old text asserted something the artefact contradicts.

| § | Claim | Verdict |
|---|---|---|
| header | "orients any AI agent … read it first" | true — unchanged |
| 1 | North Star; MIT; npm; TypeScript/Node 18+ | true — matches `dna.yaml` `north_star`/`project.license` and `package.json` `engines.node: ">=18.0.0"`. `Distribution: npm (public)` is the DNA-declared channel (`dna.yaml` `stacks.technologies`, category `distribution`), not a claim of having published; the pipeline is `task-059/060/061`, all `backlog`. Left as-is |
| 1 | *"no source code yet"* / *"CLI/MCP tool is not implemented"* / *"do not assume runtime behaviour exists"* | **corrected — all three false.** `src/` holds nine module directories + `cli.ts`; `package.json` has `bin: { wingfoil: ./dist/cli.js }`; `src/cli/program.ts` registers `init` and `mcp`; the suite runs 69 files / 866 tests green. Replaced with the real status (`rl-v1` `active`, `minor-v0.1` `released`, `minor-v0.2` `in-development`, read from `docs/self/docs/04_memory/planning/`) **plus** an explicit boundary — the surface is exactly `CORE_MODULES`, and no workflow engine or Memory transition verb exists. The "specs win" clause was kept and pointed at §10.1 |
| 1 | test counts | deliberately **not** pinned in the document (they are in these notes instead) — an exact count is the same drift trap the callout just fell into; `npm test` is the durable reference |
| 2 | `docs/self/` row cites `X_initial-design-plan.md` | **corrected — the file is not in the repository.** `git ls-files docs/self` returns only `WORKFLOW.md`, `X_wingfoil-init-plan.md` and `.wingfoil/…`. The real artefact is `docs/05_plans/rl-v1/initial-design-rl-v1-plan.md` (also fixed at its second occurrence in §6) |
| 2 | vision / requirements / SARD / backlog rows | true — every named file exists (`docs/01_vision/` 01,04,05,06,07,08 + both `X_*`; `03_sard/` all five; `by-release/` v0.1,v0.2,v0.3,v0.4,v1.0) |
| 2 | map omits `src/`, `test/`, `docs/05_plans/` | **corrected by addition** — a "where to find what" map that omits the implementation is the same defect as §1's; `docs/05_plans/` is pointed at by §6 and §10.7 and is a Memory type path, yet had no row |
| 3 | *"it will move to the repository-root `.wingfoil/` once the tool can manage it"* | **corrected (half true).** Verified there is no root `.wingfoil/` (`ls -d .wingfoil` → no such file), so the config location claim stands. The *condition* was stale: `wingfoil init` now exists and scaffolds a root `.wingfoil/` (`src/core/init.ts`, `src/cli/program.ts`), so "once the tool can manage it" no longer describes the blocker. Rewritten to state what is actually true — no root config, the move is an open intention, and the verbs that would maintain it do not exist |
| 3 | `memory.yaml` types list | **corrected** — omitted `plan`, which `memory.yaml` declares and §5 already tabulated |
| 3 | P3.8 built-ins not implemented, `built-in/` empty | true — `directives/built-in/` and `workflows/built-in/` contain only `.gitkeep`; `task-057` is `backlog`. Sharpened with the `task-057` reference and spec-011/REQ-SEC-07's reason the split exists |
| 4 | module list | **corrected** — `dna.yaml` declares **nine** modules; the list omitted `validation`. `(under src/, planned)` was false: every module's `path:` exists. Noted that `mcp-server` is at `src/mcp` |
| 4 | *"MCP over stdio + Anthropic SDK"* | **corrected** — `dna.yaml` records that the Anthropic SDK is declared in `package.json` but imported by no `src/` module; the MCP server is built on `@modelcontextprotocol/sdk`. Added `js-yaml` and TypeDoc, both in `stacks.technologies` and both absent from the summary |
| 4 | roles list; agents hold no approval authority; `paths` categories | true — matches `dna.yaml` `team.roles`, `team.agents.approval_authority: false`, `paths:` keys |
| 5 | frontmatter-derived state, no `.wingfoil/state/` | true |
| 5 | *"every transition is validated"* | **qualified, not corrected.** The engine is real (`resolveTransitionTarget`, `validateFrontmatterState` in `src/memory/state-machine.ts`, `task-036` `done`), but nothing calls it on a live transition because no verb exists. Said so, so the sentence cannot be read as a runtime guarantee |
| 5 | `sequence`/`gates`/`waiting` prose, no `rejected` status, dl-012/dl-017 | true — checked line by line against `memory.yaml` |
| 5 | all eight state-machine rows | true — each `sequence` and every `gates.<state>.reject` target re-derived from `memory.yaml`; all eight match exactly, including `bug`'s three gates and `release`'s gate-free chain |
| 5 | table column header *"Path (under `docs/self/`)"* | **corrected** — false for the `plan` row: `docs/05_plans/` is at the repo root (`docs/self/docs/` contains only `04_memory`). Header scoped and the row annotated; §5.1's `memory.add` step 1 carried the same wrong generalization and was fixed too |
| 5.1 | commit formats (`add`/`submit`/`approve`/`reject`/`deprecate`) | true — they match the commits this repository actually produces (e.g. `1f00a00` carries the `Approver:`/`Reason:` body). Left intact; added the AC-3 note below |
| 6 | `sw-life-cycle` / `release-line-cycle` phase chains | true — matches `sw-life-cycle.yaml` and `release-line-cycle.yaml` phase names |
| 6 | `release-cycle` chain | **corrected** — omitted two phases `release-cycle.yaml` v1.1 declares between `dev-loop` and `submit`: `user-docs` (dl-013) and `e2e-smoke` (dl-023). Also added `refactor`'s coverage/API-docs/`lint.clean` checks to the `dev-loop` summary (`dev-loop.yaml` v1.2) |
| 6 | three ingest mains inherit the active element | true — `workflows.yaml` declares exactly four mains |
| 6 | *"Interim — no workflow engine yet"* | **true, and kept** — but reworded, because as written it implied `wingfoil` itself does not exist. `CORE_MODULES`' `workflow` module registers only `workflowList` (read-only): no `workflow start`, no phase execution, no `checks` runner. The plan-first rule stands unchanged |
| 6 | dl-019 plan-as-Memory-element note | true |
| 7 | role → directive table | true — compared row by row with `roles.yaml` `assignments` + `global`; identical, including the deliberate absence of `approver`/`facilitator` rows and of the unassigned generic `security` stand-in |
| 8 | TDD, >80% coverage, determinism, traceability, doc-versioning, secrets, MCP Resources read-only, commits, approvals | true — `jest.config.js` declares the 80% threshold on all four axes; the doc-versioning wording matches the directive verbatim |
| 9 | `[SPEC]`/`[AUTHORING]` provenance | true — both `dna.yaml` and `memory.yaml` carry the legend and annotate inline |
| 10.1–10.5, 10.7–10.9 | golden rules | true — 10.7's plan-first rule holds for the same reason §6's does |
| 10.6 | *"The tool isn't built yet — … don't assume runtime features"* | **corrected** — named by `bug-008` as the place the §1 error is reinforced. Rewritten as a check-don't-assume rule pointing at `CORE_MODULES` |

**AC-3 — is manual transition the intended procedure or merely the current one?** Merely the **current**
one. Evidence: `CORE_MODULES` (`src/core/index.ts`) registers exactly `dnaSet`, `dnaShow`, `memoryAdd`,
`memorySearch`, `directivesList`, `paths`, `workflowList` — of the five §5.1 operations only
`memory.add` exists, and `memorySearch` is read-only. The other four are specified (P1.6 submit, P1.7
approve, P1.8 reject, P1.9 deprecate) and already scheduled in this very release as
`task-045-memory-submit`, `task-046-memory-approve`, `task-047-memory-reject`,
`task-048-memory-deprecate` — all four `status: backlog` today. A backlog task is a commitment to build
the verb, so hand-editing frontmatter is a stand-in with a scheduled end date, not the design. Recorded
as a `5.1` blockquote that says exactly that, and adds the part that does *not* change: the commit
format is the contract either way, because it is what the verbs will emit and what `memory history`
(P1.10) reads back.

**Not changed, deliberately.** No gate, check, or workflow YAML was touched — `dl-025`'s own Actions
assign the `user-docs.yaml` amendment to the next `release-planning` → `build-backlog`. No file outside
`CLAUDE.md` and this task file was modified.
