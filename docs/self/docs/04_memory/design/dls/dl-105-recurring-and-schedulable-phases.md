---
id: "dl-105-recurring-and-schedulable-phases"
type: decision-log
title: "No workflow phase can recur or be scheduled: a phase declares a cadence, records its last run, and is triggered by a scheduled CI job until the workflow engine takes over"
status: ready
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

The v0.2 retrospective (`retro-v0.2`) files this decision-log. The approver added it at the
retrospective's `additional-points` gate on 2026-09-28, under the disposition "no recurring or
schedulable phase exists". The request came from two directions: use of WingFoil outside this
repository, and a future UI that must show what is due. `dl-104` covers phase scope and evidence;
this decision was split out of it.

**Nothing in WingFoil can run on a cadence.** Measured at `a20b346c`:
- `grep -rniE "cadence|recurring|cron" docs/self/.wingfoil/ src/workflow/` finds seven lines, all
  prose. Five are about release cadence, e.g. `release-cycle.yaml`'s header comment ("per-pillar
  cadence") and the `traceability` directive's "planned release cadence". Two are template prompts
  about "recurring blockers". So the pattern works, and no workflow field uses those words.
- The `Phase` schema in `src/workflow/schema.ts` has no field for timing, and spec-003 Layer 2
  declares none.
- `grep -rn "schedule:" .github/workflows/` finds nothing. The only CI workflow, `publish.yml`,
  triggers on `push: tags: ['v[0-9]+.[0-9]+.[0-9]+']`.
- `grep -rliE "recurring phase|cadence:|on: schedule|schedule:|cron" docs/self/docs/04_memory/`
  matches one file, `task-036`, where "schedule:" is prose. No element proposes a recurring phase.

**What ought to recur, in this repository alone.**
- **Dependency and lockfile health.** `dl-069` (`ready`) records that lockfile drift was caught
  only by the tag-triggered gate. `npm run check:lockfile` (`scripts/check-lockfile-pins.cjs`,
  task-104) exists, but it runs only when someone runs it. Drift that arrives from the registry,
  with no push to this repository, is never seen.
- **Release-health analyses.** `dl-089` (`in-discussion`) runs them once per release. That is
  recurring on an event, not a clock.
- **The re-sweep of unscheduled governance at every dev-loop wave boundary** (`dl-100`), also
  recurring on an event.
- **External state.** `dl-088` gives a `service` element a `verify` command and an optional
  `renews` date. Nothing would run `verify`, or notice a renewal coming due.

## Decision

**What the approver ruled on 2026-09-28:**
1. **A phase field `cadence: once | recurring`.** A recurring phase declares either an interval or
   the event that triggers it. `once` is the default, so existing phases are unchanged.
2. **The evidence of a recurring phase is the timestamp and the outcome of its last run.**
3. **The trigger is provisional first.** A GitHub Actions `schedule` job triggers the phase until
   the workflow engine exists, and the engine then takes the trigger over.
4. **An intermediate step lands in v0.3 as a task:** a scheduled CI workflow that runs the
   dependency check. The DL and that task target v0.3. Execution through the engine lands in v0.3
   or v0.4, according to that release's scope.

**Open, with recommendations:**

**R1 — How an interval is written.**
- **(a)** A cron expression, the same string GitHub Actions `schedule` takes.
- **(b)** An ISO-8601 duration (`P7D`).
- **(c)** A named set: `daily`, `weekly`, `per-release`, `per-wave`.

*Recommendation: (a) for clock cadences and (c)'s event names for event cadences,* e.g.
`cadence: { recurring: { cron: "0 6 * * 1" } }` or `cadence: { recurring: { on: release-released } }`.
A cron string carries over unchanged from the provisional trigger to the engine.

**R2 — Where the last run's evidence lives.**
- **(a)** In the repository, as a run-record commit with a trailer, e.g. `WingFoil-Run:
  <workflow>.<phase> <outcome>`. This is `dl-104` D1's run record.
- **(b)** Outside it, in the CI run history, reached through a `service` element's `verify`
  (`dl-088`).
- **(c)** (b) while the trigger is provisional, (a) once the engine runs the phase.

*Recommendation: (c).* REQ-STATE-02 wants state that can be recomputed from the repository, which
favours (a). But a scheduled job that commits to `main` needs a push credential and an identity for
an unattended run. Those are `dl-094`'s identity rule and `dl-103`'s approval policy for unattended
runs, both undecided. Until they are decided, the provisional job should only read and report.

**R3 — What an overdue run means.**
- **(a)** A warning in `workflow status` (P4.5).
- **(b)** A `checks.pre` failure on a named later gate. For example, `release-submit.yaml`'s
  `pre-release-checks` could refuse while the dependency check is older than its interval.

*Recommendation: (a), and (b) only where a phase declares it.* "Overdue" needs the current time.
The `determinism` directive and REQ-STATE-09 keep the clock out of context-building paths, so
overdue must be computed only where status is displayed or a gate is evaluated, never while an
agent's context is assembled.

**R4 — What the command of a recurring phase is.** It is a bound token, under `dl-090`. The
intermediate job binds the dependency check to `npm ci` plus `npm run check:lockfile`, keyed on exit
status alone, as `dl-069` S1 recommends.

## Rationale

- **Checks that run only at a release see drift weeks late.** The retrospective's data shows the
  same thing for grammar drift: `dl-089` records that the ASCII-arrow bracket drift began on one day
  and was measured only at the end, 198 occurrences later. A cheap check on a cadence would have
  caught it on the day it began.
- **Cron is the smallest commitment that the engine can inherit.** A GitHub Actions `schedule` job
  with the same cron string that the phase declares keeps one source of timing, so the step from the
  provisional trigger to the engine changes who fires the phase, not when.
- **A separate scheduled workflow leaves `publish.yml` alone.** `dl-069` option (a) already argued
  that widening `publish.yml`'s trigger weakens `adr-009` clause 1, the rule that no publish runs from
  a phase branch. A separate workflow file does not touch that trigger.

## Actions

On ratification, with R1–R4 chosen in the approve commit's `Reason:`:
1. Amend `spec-003-workflows-yaml-schema` Layer 2 with `cadence`, and the `Phase` schema in
   `src/workflow/schema.ts` to accept it.
2. Add a new GitHub Actions workflow under `.github/workflows/` with an `on: schedule` trigger,
   running the dependency check read-only. This is the intermediate task, v0.3.
3. Declare `cadence` on the recurring candidates above once the engine exists (v0.3 or v0.4):
   `dl-089`'s `release-health`, `dl-100`'s re-sweep, and `dl-088`'s `service` verify sweep.

v0.3 `release-planning` (`build-backlog`) derives the tasks, including the intermediate scheduled-CI
task. None are created here.

## Relations

- **Filed by:** `retro-v0.2` (approver addition of 2026-09-28, "no recurring or schedulable phase
  exists").
- **Split from:** `dl-104` (phase scope, evidence and entry points).
- **Links:** `dl-090` (the command a recurring phase runs), `dl-069` (lockfile drift, the first
  recurring check), `dl-088` (`verify` and `renews` on `service` elements), `dl-089` (release-health,
  an event cadence).
- **Depends on, for R2 (a):** `dl-094` (identity), `dl-103` (unattended-run approval policy).
- **Traceability:** P4.5, P4.12, P4.13; REQ-STATE-02, REQ-STATE-09; `adr-009`.
