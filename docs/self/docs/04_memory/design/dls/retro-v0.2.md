---
id: "retro-v0.2"
type: decision-log
title: "Retrospective v0.2"
status: in-discussion
context: "retrospective"
release: "v0.2"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`minor-v0.2` reached `released` at `d2ad1f3f` (`wf(release): mark-released minor-v0.2 [releasing →
released]`). It was published as `wingfoil@0.2.1`: `npm view wingfoil version` → `0.2.1`. `v0.2.0`
was tagged and never published (`bug-135`). This retrospective closes `minor-v0.2`'s
`release-cycle`. It ran under `retrospective-rel-v0.2-plan` (`docs/05_plans/rl-v1/rel-v0.2/`), whose
revisions record every method decision taken along the way.

**How it was conducted.** The era is `20e8271..a20b346c`:
- `20e8271` is `wf(decision-log): approve retro-v0.1`;
- `a20b346c` is `main` after `minor-v0.2` was released;
- `git rev-list --count 20e8271..a20b346c` → 1,654 commits.

- **Nine read-only mining slices** produced 290 source-cited items. The slices covered:
  - reject bodies (29 rejects);
  - approve bodies (181 approves);
  - `docs(self)` corrections (275 commits);
  - Execution Notes of all 75 v0.2 tasks, in two parts;
  - the unscheduled population and the audit of v0.1's dispositions;
  - git-tree metrics per phase window;
  - the provenance of all 129 v0.2 bugs;
  - compliance with each directive, one by one.
- **The synthesis grouped them into eight themes**, T1–T8 below. Of the shas the miners cited, 130
  of 132 resolve. The two that do not are the speculative shas described in T1, correctly
  nonexistent.
- **External evidence** was each item reproduced on `wingfoil@0.2.1`, installed from npm into a
  throw-away project:
  - a list of defects met while using WingFoil on another project: 23 of 34 reproduce;
  - a diff between the templates `init` generates and a real project's configuration.
- **An agent-error inventory** was compiled separately, and then reviewed by a dedicated agent whose
  mandate was to reject entries.
- **A completeness pass** covered a parallel set of notes kept during the release (plan §4.10). Every
  proposal in it received an explicit disposition. None is cited here: its content is restated from
  versioned ground.
- **The approver's `additional-points` gate** approved the Dispositions table below on 2026-09-28.

## Decision

v0.2 is closed. The table in *Dispositions* is the approved scope for v0.2.2, v0.3 and later. Each
new element named there was filed by this retrospective, with the target release in its frontmatter.
The approver fixed that target at the gate, and v0.2.2's and v0.3's `release-planning` take the
elements from there.

### What went well

- **retro-v0.1's dispositions landed.** All eleven decision-log vehicles (`dl-013` … `dl-024`) are
  `ready`, and each mechanism is present in the workflow configuration. `bug-004`, `bug-006` and
  `bug-007` are `closed`. The deferred theme T12 was honoured.
- **Evidence is thin for one of them.** `dl-022`'s spec-review gate appears in only three commits
  (`git log --oneline 20e8271..a20b346c -i --grep=spec-review | wc -l` → 3).
- **Dependency notes worked** (`dl-015`). Every task with `depends_on` acknowledges reading its
  dependencies' notes. A measurement pitfall found in `task-086` was cited and avoided by seven later
  tasks.
- **Acceptance-criteria classification held** (`dl-014`, `testing`). All 75 v0.2 tasks classify their
  ACs as red-first or characterization, which answers v0.1's T1.
- **Verification caught real defects before merge.** About 70 of 76 task review approvals name a
  concrete verification. Mutation testing was the check that caught something most often. Before
  merge, review stopped:
  - silent corruption of Memory documents by the shared frontmatter helper, now `bug-027` and
    `bug-041`, both `closed`;
  - a CLI-reachable data-loss path, found worse than reported (`task-092`);
  - an approval routed to an AI agent (first reject of `task-034`, `8b65f796`).
- **Findings became elements rather than notes.** Corrections were appended, never rewritten. Tasks
  caught errors in their own acceptance criteria and in the approver's notes.
- **The lint gate** went in as hard-reject from its first day and held (`task-066`).
- **Carried over, not re-measured by this retrospective:**
  - per-window commit discipline (median commit size, share of commits with a body);
  - the complexity and duplication figures;
  - the count of bugs found by independent review.

  They are recorded as carried over from the release-health analysis now formalised in `dl-089`.

### What didn't go well — themes (each cites its source)

- **T1 — claims without evidence.** This is the largest single cause of rejection, but not the
  majority. Of 28 task rejects, 14 fall primarily on an unverified or false claim, 12 on defective
  code and 2 on a weak test (a first count said 13, and re-derivation corrected it). A false or stale claim contributes to about 22 of the 28.
  - About 50 of the 275 `docs(self)` commits correct an element already filed.
  - The extremes: a claim written beside the output that refuted it (`d49f2679`); an extrapolated
    figure inside an approval `Reason:` (`a2e3586f`); shas cited before their commits existed; an
    empty grep that could not have matched, used as evidence (`e693a289`).
  - The orchestrator put the rule in front of agents from 2026-09-22 (its briefs are not versioned,
    so that date is the orchestrator's record), and the class recurred anyway
    (`task-083`, `task-086`, and `task-093` twice). The `claim-evidence` directive followed on
    2026-09-24 (`617d64a8`).
  - **The conclusion:** a point where the rule is enforced is missing, not another rule.
- **T2 — the second reject repeats the first.** Four tasks were rejected twice. In three of them the
  second reject is the same class as the first, although the first reason was in front of the agent
  through `rejection_reason`.
- **T3 — where the gates sit.** Of the 129 v0.2 bugs, the per-task review found about 47.
  - The once-per-release gates found real defects the one time each ran: the staging rehearsal 6,
    `user-docs` 7, `e2e-smoke` 3, publishing 2. The counts by class are ±2, from a class table that
    double-counts two bugs.
  - About 47 bugs surfaced outside any gate.
  - The two release blockers, `bug-076` and `bug-077`, came from using WingFoil elsewhere. v0.2's
    gates exercised WingFoil only on its own configuration, which the verbs cannot even reach
    (`bug-075`).
  - The gates have blind spots of their own: the coverage report omits source files no test
    requires; `tsc` does not run on test sources (`dl-044`); and one fix without a regression guard
    regressed (`task-080` → `task-104`).
- **T4 — governance debt grows faster than the product.**
  - Elements with no `release`, counting `release: ""` regardless of status, grew from 14 at
    `20e8271` to 144 at `a20b346c`: 76 bugs and 68 decision-logs. Tasks grew from 33 to 75.
  - At the close of release-planning (`21754959`) the untagged population was 0 bugs and 12 `ready`
    decision-logs, so the sweeps worked on what existed. The debt accrued afterwards, and no step
    re-sweeps.
  - Release-planning committed to 32 tasks, and 75 shipped. The release-planning and dev-loop plans
    were never closed.
- **T5 — this repository's own audit trail.**
  - An approve with a blank `Reason:` (`1ce90aea`), repaired by a later commit (`47f8e3c6`).
  - `BRACKET_RE` in `src/memory/audit.ts` accepts only `→`. 198 ASCII `->` brackets written from
    2026-09-22 are silently skipped by the consistency check. This is format drift in hand-written
    commits, not bypass.
  - 36% of `wf()` commits use verbs outside the five declared (`dl-079`).
  - The approval author differs from the `Approver:` line on 116 of 181 approvals since 2026-09-17.
  - Memory ids were allocated twice across branches, three times.
- **T6 — what reached the agent.** Nothing loads directives automatically
  (`grep -c agentExecute src/core/index.ts` → 0). Two orchestrator-written acceptance criteria
  contradicted the standing brief. The agent-facing documentation stated falsehoods twice in one
  release.
- **T7 — statements that were true when written decay.** A severity grade stopped being true once the
  fix it warned about landed (`bug-062`). A decision-log conclusion held only under the npm version
  that ran it (`dl-069`). A bug's guidance named a symbol that had been removed (`bug-010`). Most of a
  task's cited line offsets had shifted within hours (`dl-075`).
- **T8 — directive compliance where a proxy exists.** Of the 10 era edits to the four versioned
  configuration YAMLs, 9 changed content without a `version:` bump. There are 9 distinct commits,
  because one commit edits two files: `git log --format=%h 20e8271..a20b346c --` over the four
  files, deduplicated, gives 9. The only edit that bumped is `617d64a8` on `roles.yaml`.

### Agent-error inventory (summary)

The inventory's entries are kept outside the repository, by the approver's ruling. Only this summary
enters.
- **Entries.** 12 were compiled. A dedicated reviewer, mandated to reject, kept 11 and reclassified 7.
- **Attribution:**

  | Class | Meaning | Count |
  |---|---|---|
  | (1) | the rule did not exist | 3 |
  | (3) | the rule existed but never reached the agent | **0** |
  | (4) | the rule was in context and ignored | 5 |
  | (5) | not preventable by WingFoil | 1 |
  | — | undetermined | 2 |

- **What it disproves.** The starting hypothesis, that errors came from rules that existed but never
  reached the agent, does not hold. Where a rule existed, it was usually cited in the task's own
  design notes.
- **Replay.** The replayable entries must be re-anchored to each task's `start` commit before any
  replay. Every current anchor is a reject or correction commit, so it already contains the error.

### Dispositions (approved at the `additional-points` gate, 2026-09-28)

`+` marks an element filed by this retrospective. Existing elements are cited as they are.

| # | Finding | Disposition | Vehicle | Release |
|---|---|---|---|---|
| 1 | T1 claims without evidence | Falsifiability clause + an enforcement point | + `dl-097` | v0.3 |
| 2 | T2 repeated reject class | Re-review checks the previous reject's class | + `dl-098` | v0.3 |
| 3 | T3 gates run once, on WingFoil's own config | Staging and e2e-smoke on every candidate, on a fresh project | + `dl-099` (with `bug-132/133/134`) | v0.3 |
| 4 | T3 coverage omits unrequired files | Bug | + `bug-141` | v0.3 |
| 5 | T3 `tsc` on test sources ungated | Existing | `dl-044` | v0.3 |
| 6 | T4 debt, re-sweep, capacity, scope growth, WIP on open DLs | One decision-log | + `dl-100` | v0.3 |
| 7 | T4 deferral to no element (verb preamble duplication) | Bug | + `bug-142` | v0.3 |
| 8 | T4 six v0.2 plans never closed | Closed at this retrospective's close-out | close-out | v0.2 |
| 9 | T5 ASCII brackets skipped | Bug, prerequisite of the root move | + `bug-137` | v0.2.2 |
| 10 | T5 undeclared `wf()` verbs, subject length | Existing | `dl-079` | v0.3 |
| 11 | T5 author identity vs approver | Remedy decided (un-parked). The shared git identity was cleared by the approver on 2026-09-28; the rest is in `dl-094` | + `dl-094` | v0.2.2 |
| 12 | T5 ids allocated twice | Allocation across every ref | + `dl-101` | v0.3 |
| 13 | T6 directives not loaded | Existing scope (P5.3.1, P5.4.2) | `minor-v0.3` | v0.3 |
| 14 | T6 criteria contradicting the brief | Check before assignment | + `dl-102` | v0.3 |
| 15 | T6 agent docs stale | Per-wave refresh | `dl-025` (amend) | v0.3 |
| 16 | T7 decay; T8 versioning | Directive extension; lint | + `dl-120`, + `bug-143` | v0.3 |
| 17 | Governance enforced outside the agent; approval policy for unattended runs | One decision-log | + `dl-103` | v0.3 |
| 18 | Determinism Index: where and how it is measured | Benchmark registered as a service; metric D01; criterion inside `dl-089`; major and minor releases only; after publishing | `dl-089` (amended), a service after `dl-088` | v0.3 |
| 19 | External defects without an element | Bugs and decision-logs | + `bug-139`, `bug-140` (v0.2.2); + `bug-144`–`bug-152`, `dl-106`, `dl-108`–`dl-110` (v0.3); + `dl-107` (**v0.2.2**, approver 2026-09-28: version dots in ids break the moved config) | v0.2.2 / v0.3 |
| 20 | Template includes its sub-workflow by path | Bug | + `bug-144` | v0.3 |
| 21 | Tool signature (version and build commit) in commits | Decision-log | + `dl-111` | v0.3 |
| 22 | Workflow token bindings (six questions) | Promoted to Memory in this phase | + `dl-090` | v0.3 |
| 23 | Phase scope and evidence; recurring phases | Two decision-logs | + `dl-104`, + `dl-105` | v0.3 |
| 24 | Configuration at the root, released build, MCP registered | First structural steps of v0.2.2 | `bug-075`, `dl-026`, + `dl-095` | v0.2.2 |
| 25 | Unused runtime dependency | Bug | + `bug-138` | v0.2.2 |
| 26 | First-use fixes | Existing bugs, pulled into v0.2.2 | `bug-128`, `bug-129`, `bug-136` | v0.2.2 |
| 27 | Closures with no code | `bug-021` downgraded; `bug-092` closed once `dl-123` gives a legal exit, both in v0.2.2 | existing | v0.2.2 |
| 28 | External state has no Memory type | Decision-log (re-filed) | + `dl-088` | v0.2.2 |
| 29 | Name, namespace, patch tracking, package metadata | Decision-logs | + `dl-091`, `dl-092`, `dl-093` | v0.2.2 |
| 30 | Community files, presentation, trust signals, visibility steps | Decision-logs | + `dl-127`–`dl-130` | v0.3 |
| 31 | Staged publishing blocks the next publish | Existing, retargeted | `dl-087` → v0.2.2 | v0.2.2 |
| 32 | Vision dates obsolete (67-day pause; velocity steady, scope 2.3×) | Re-baseline on active days | + `dl-096` | v0.2.2 |
| 33 | Positioning; personas | Vision-edit decision-logs | + `dl-112`, `dl-113` | v0.3 |
| 34 | `06_features` P2.1 names one DNA verb of four | Edited in this phase | vision edit | v0.2 |
| 35 | Token consumption; retrospective notes during the release; parity tests; AI attribution; N/A for required fields | Decision-logs | + `dl-114`–`dl-117`, + `dl-124` | v0.3 |
| 36 | Approving non-Memory documents; Memory volume | Decision-logs | + `dl-125`, `dl-126` | v0.4 |
| 37 | Filing rule; git conventions; testing and secrets directives | Decision-logs toward directives | + `dl-118`, `dl-119`, `dl-121`, `dl-122` | v0.3 |
| 38 | Won't-fix exit for bugs | Decision-log retyping `bug-094`; a configuration-only edge, pulled into v0.2.2 so `bug-092` can close there (approver 2026-09-28) | + `dl-123` | **v0.2.2** |
| 39 | Authority vs author identity; reserved-domain authors; directive scope declared twice; unknown types accepted; MCP tools/list; JSON default; empty list as missing; templates promise `submit` fills | Bugs | + `bug-149`, `bug-153`, `bug-148`, `bug-150`, `bug-151`, `bug-152`, `bug-147`, `bug-146` | v0.3 |
| 40 | Release-health analyses | Existing | `dl-089` | v0.3 |
| 41 | Clean-up of the unscheduled population | Plan output, `bug-094`/`dl-123` first | v0.3 start | v0.3 |
| 42 | v0.2.2 and v0.3 in parallel | On `main`, trunk-based (`dl-002`). v0.3 starts after v0.2.2's root move; until the `v0.2.2` tag it merges only Memory and process documents | `dl-092` | v0.2.2 / v0.3 |
| 43 | Superseded proposals | Version `0.1.0`, npm name, `history --follow`, `dna set` scalar-only, verbs missing | none (proof in plan §4.10) | — |
| 44 | Withdrawn branches | Deleted at close-out, after the approver confirms | close-out | — |

## Rationale

- **The scope is set here, not in release-planning, on purpose.** The approver asked this
  retrospective to define and approve the elements for v0.2.2, v0.3 and later. The `release` field
  *is* the schedule in this project, and an element with none is filed but unplanned (T4). So every
  element filed here carries the release fixed at the gate.
- **Decision-logs over bugs where there is a real choice.** This is the rule `dl-118` proposes, and
  this retrospective already follows it: mechanical, uncontested fixes are bugs; anything with
  options is a decision-log.
- **Directives stay the target, decision-logs stay citable.** DLs that become directives stay
  `ready` and are cited, as `task-094` did with `dl-080`. Nothing is deprecated for being absorbed.
- **Left out on purpose:**
  - one proposal that concerned the external project's own type configuration, not WingFoil's;
  - the agent-error entries, which stay outside the repository by the approver's ruling;
  - the 86 elements the DL/bug/directive triage found already correctly typed (five were
    spot-checked, and all hold).

## Actions

- [ ] Ratify this retrospective (owner: approver).
- [ ] Ratify or amend each decision-log filed here; triage each bug filed here (owner: approver).
- [ ] Close-out (owner: facilitator):
  - close the six v0.2 plans still `active`, and this retrospective's plan;
  - delete the two withdrawn branches, after the approver confirms;
  - re-check ids across every ref, then merge with `--no-ff` and push.
- [ ] v0.2.2, in the order of plan §6.8:
  - identity (`dl-094`: shared git config already cleared by the approver), `bug-137`, `dl-092`;
  - configuration at the root (`bug-075`), the pinned build and the MCP (`dl-095`, `dl-026`);
  - `dl-087` with `bug-136`;
  - `dl-088` and the backfilled services;
  - `dl-091`: public identity. The approver proposes "WingFoil Harness", with package and command
    staying `wingfoil`. The repository is renamed inside v0.2.2 (approver, 2026-09-28): the
    approver renames it on GitHub, then the `package.json` URLs and every link are swept before
    publish, because provenance checks `repository.url`.
  - `dl-093` with `bug-138`–`bug-140`, `bug-128`, `bug-129`, the `bug-021` downgrade and
    the `dl-096` date re-baseline;
  - staging, then tag, then publish.
- [ ] v0.3, starting after v0.2.2's root move:
  - `release-planning` takes every `ready` element with `release: "v0.3"`;
  - the unscheduled clean-up starts with `dl-123`;
  - release-planning considers splitting v0.3, which carries 26 features.
- [ ] Audit these Actions at the v0.3 retrospective.
