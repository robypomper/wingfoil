---
id: "dl-100-governance-debt-resweep-and-capacity"
type: decision-log
title: "The unscheduled population grew from 14 to 144 after release-planning ran; unscheduled work is re-swept during the release, with a re-plan checkpoint, a scope-growth threshold, a bug capacity rule and a WIP limit on open decision-logs"
status: ready
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`), from its finding that governance debt grew faster
than the product. On 2026-09-28 the approver ruled on the parts, and all of them are carried here:

- a recurring re-sweep at every `dev-loop` wave boundary, on top of a one-off clean-up at the
  start of v0.3;
- a mid-release re-plan checkpoint, whose scope delta is recorded in the release element;
- a growth threshold per release that forces that checkpoint;
- a capacity rule for bugs;
- a WIP limit on `in-discussion` decision-logs.

### The population

An element is **unscheduled** when its frontmatter `release:` is the empty string, whatever its
status. It is counted with the awk scan below, run over `docs/04_memory/bugs/*.md` and
`design/dls/*.md` in a `git archive <sha> docs/self/docs/04_memory` extract:

```sh
awk 'FNR==1{n=0;st="";rel=""} /^---$/{n++} n==1&&/^status:/{st=$2} n==1&&/^release:/{rel=$2} \
     n==2&&st!=""{if(rel=="\"\"") print st; st=""}' <files> | sort | uniq -c
```

| Measured at | Unscheduled bugs | Unscheduled decision-logs | Total |
|---|---|---|---|
| `20e8271` (`retro-v0.1` approved, v0.2 era starts) | 0 | 14 (12 `ready`, 2 `in-discussion`) | 14 |
| `21754959` (v0.2 release-planning closes: `minor-v0.2` `planning → in-development`) | 0 | 12 (`ready`) | 12 |
| `a20b346c` (v0.2 released) | 76 (70 `open`, 5 `triaged`, 1 `closed`) | 68 (41 `ready`, 27 `in-discussion`) | 144 |

The awk has a positive case at every measured point: it finds the `ready` decision-logs even where
it finds no bug.

Over the same era, the number of v0.2 task files went from 32, committed at `21754959`, to 75 at
`a20b346c`. Both counts come from `git ls-tree --name-only <sha> docs/self/docs/04_memory/v0.2/ | grep -c task-`.
The era filed 129 bugs and 63 decision-logs (the `wf(bug): add` and `wf(decision-log): add`
subjects, ids deduplicated). At `a20b346c`, 55 of the 136 bug files are `closed`.
`in-discussion` decision-logs went from 11 at `20e8271` to 29 at `a20b346c`, counting all of them,
scheduled or not.

### Why the planning sweeps did not catch it

`release-planning.yaml`'s `triage-bugs` and `reconcile-governance` phases (`dl-016`) did what they
declare. At `21754959` there was nothing untagged for `triage-bugs` to take. The 12 `ready`
decision-logs lay outside `reconcile-governance`'s `where:` filter, which selects `in-discussion`
and `pending` only, by design. The 144 accrued **after** planning, during a release that never ran
a second planning pass:

- **The scope grew without passing back through planning.** Of 75 tasks, 43 entered after
  `release-planning` closed. Each was governed as an element, but the release's scope was never
  re-planned, and the release-planning plan was never revised.
- **Deferrals land on elements with no release.** Work was pushed to `dl-062`, `dl-044`, `dl-078`,
  `bug-024`, `bug-072` and `bug-118`, and every one of them carries `release: ""` at `a20b346c`.
  At least one deferral went to no element at all: the preamble duplication across four memory
  verbs, now `bug-142`.
- **No step says how much debt a release may add, or how many open questions may stand.**

### The one-off clean-up is already defined

The retrospective plan defines the clean-up that opens v0.3 (`retrospective-rel-v0.2-plan` §6.3
(a)): size re-measured at execution, the approver decides, `bug-094` (retyped by
`dl-123-a-bug-ruled-wontfix-has-a-legal-exit`) first, and `build-backlog` as the venue, run by hand
until `element.set_release` has a binding. `git grep -c set_release a20b346c -- src/` prints
nothing, while the same grep over `.wingfoil/workflows/custom/` finds
`release-planning.yaml`. This decision covers what keeps the population from growing back.

## Decision

### 1. A re-sweep runs during the release, not only at its start

At every `dev-loop` wave boundary, a **governance re-sweep** runs. It is `triage-bugs` plus
`reconcile-governance` with the filter widened to `ready` decision-logs. Every element that is
unscheduled at that moment is proposed for this release, for a named later release, or for an exit
(`deprecate`, or the legal close `dl-123` decides). The approver rules in blocks. An agent proposes
and never stamps a release alone.

A **wave** is today a planning convention, declared only in the dev-loop phase plan
(`dev-loop-rel-v0.2-plan`, *Wave 1*, *Wave 2*, *Wave 3*, grouped by `depends_on`). The approver
chooses the trigger:

- **(a) A declared wave.** `release-cycle.yaml` names the wave as the unit of `implementation`, and
  the re-sweep is a phase at its boundary.
- **(b) A count.** The re-sweep runs every N completed tasks.
- **(c) A recurring phase.** Once `dl-105-recurring-and-schedulable-phases` exists, the re-sweep
  runs on a cadence.

**Recommendation: (a)**, because v0.2's plan already grouped work that way, with (c) replacing it
when recurring phases ship.

### 2. A re-plan checkpoint, with the scope delta recorded in the release element

Each re-sweep is also a **re-plan checkpoint**. The release element gains a `## Scope changes`
section. Every task added after `commit-backlog` is listed there, with the element it came from and
the checkpoint that admitted it. A `backlog_committed:` frontmatter count is fixed at
`commit-backlog`. The release-planning phase plan is revised at the checkpoint, not left `active`
and stale.

### 3. A growth threshold forces the checkpoint early

When the release's task count exceeds `backlog_committed` by a threshold, the next task cannot be
started until a re-plan checkpoint has run. The approver chooses the threshold: **(a) +25%**,
**(b) +50%**, **(c) any fixed number of tasks**. v0.2 grew by 134% (32 to 75) with no trigger.
**Recommendation: (a).** It would have fired at the 41st task.

### 4. A bug capacity rule

The approver chooses one or more:

- **(a) Net flow.** Over a release, bugs moved to a terminal state are at least the bugs filed.
  This is measured by `dl-089`'s backlog-trend analysis and reported at the retrospective.
- **(b) A reserved share.** Planning reserves a fixed share of the release's task budget, for
  example 20%, for bug fixes and governance debt.
- **(c) A severity rule.** No `high` or `critical` bug stays `open` or `triaged` without a release.
  v0.2 already met this at `a20b346c`, since every `high` and `critical` bug is `closed`, so this
  mostly records existing practice.

**Recommendation: (a) as the measure and (b) as the planning rule.** (a) says whether debt is
growing, and (b) says what planning does about it.

### 5. A WIP limit on open decision-logs

At `release-planning` and at every re-sweep, the number of `in-discussion` decision-logs is capped.
Anything over the cap must be ruled, scheduled or deprecated before new decision-logs are
discussed. The approver chooses: **(a) a count**, for example 15; **(b) an age**, where a decision-log
`in-discussion` across a whole release is ruled at the next planning. **Recommendation: (b), with
(a) as a backstop.** Age targets the ones that are actually stuck. A count alone would rush the
fresh ones.

## Rationale

- The planning sweeps worked on what existed at planning time. The debt came afterwards, so a sweep
  that runs only once cannot catch it, however good its filter. The fix is *when* it runs, not
  *what* it selects. The one filter change, adding `ready` decision-logs, is needed because 41 of
  the 68 unscheduled decision-logs are `ready` rules that no release carries.
- A scope that more than doubled without a checkpoint is the same failure seen from the backlog
  side. The recorded scope delta is what lets the next retrospective measure it without
  reconstructing it from `git log`.
- Capacity and WIP limits turn "the debt is growing" from a retrospective finding into a
  planning-time constraint, while the numbers are still small enough to act on.

## Actions

1. **Ratify, choosing the options in §1, §3, §4 and §5.** Owner: approver. The choices go in the
   approve commit's `Reason:`.
2. **Amend `.wingfoil/workflows/custom/release-planning.yaml`**: the `reconcile-governance`
   filter includes `ready` decision-logs, and a growth-threshold check is added. **Amend
   `release-cycle.yaml`** and **`dev-loop.yaml`**: the wave and the re-sweep phase at its boundary,
   under §1 (a). All get version bumps.
3. **Amend `.wingfoil/memory/templates/release.md`** (the `## Scope changes` section) and
   **`memory.yaml`**'s `release` type (the `backlog_committed` field, `[AUTHORING]`).
4. **Add the capacity and WIP measures to `dl-089`'s catalogue**, if both are ratified.
5. **Run the one-off clean-up** at the start of v0.3 per `retrospective-rel-v0.2-plan` §6.3 (a).
6. **Tasks are derived by v0.3 `release-planning` (`build-backlog`)**, not created here.

## Relations

- **Origin:** `retro-v0.2`, the finding on governance debt, together with its scope-growth and
  capacity sub-findings.
- **Amends, on ratification:** `release-planning.yaml`, `release-cycle.yaml`, `dev-loop.yaml`, the
  `release` template and type.
- **Builds on:** `dl-016-release-planning-governance-reconcile` (the sweeps, now made recurring).
- **Related:** `dl-123-a-bug-ruled-wontfix-has-a-legal-exit` (the legal exit the clean-up needs);
  `dl-105-recurring-and-schedulable-phases`; `dl-089-release-health-analyses-before-retrospective`
  (the backlog-trend measure); `dl-090-which-command-each-workflow-token-binds`
  (`element.set_release`); `bug-142` (the deferral that reached no element).
- **Traceability:** P1.13 (the `release` type's fields in `memory.yaml`), P4.17 (the release
  workflow templates), REQ-STATE-01 (per-type lifecycle in frontmatter).
