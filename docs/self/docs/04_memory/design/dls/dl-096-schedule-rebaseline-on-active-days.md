---
id: "dl-096-schedule-rebaseline-on-active-days"
type: decision-log
title: "The vision's calendar predates a 67-day pause and 2.3x scope growth; release budgets move to active days with a forecast that states its cadence"
status: ready
context: "retrospective"
release: "v0.2.2"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`). The approver asked on 2026-09-28 whether the roadmap
still holds, and approved re-baselining the vision's calendar as a documentation change in v0.2.2
(`retrospective-rel-v0.2-plan` §6.9).

### Where the calendar lives

- **`docs/01_vision/07_sequencer.md`** (v1.3, dated 2026-06-24) plans five weekly releases: v0.1
  Jul 10, v0.2 Jul 17, v0.3 Jul 24, v0.4 Jul 31, v1.0 Aug 7 (*Timeline Overview*).
- **`docs/01_vision/01_product-brief.md`** (*Investment & Timeline*) states "roughly one release per
  week" and a 5-week timeline.
- **`docs/01_vision/08_mvp-canvas.md`** places milestones relative to the Aug 7 release.
- **Memory carries no dates.** The `release` elements under `planning/rl-v1/` have no date field
  (their frontmatter keys are `id, type, title, status, version, pillar, features, requirements,
  release-line, tmpl_version`).

### What happened, measured at `a20b346c`

Definitions. An **active day** is a calendar date on which at least one commit reachable from
`a20b346c` has its committer date (`git log a20b346c --format=%cd --date=short | sort -u` → 26 dates).
A **gap** is the difference between consecutive active dates. **Tasks** are the files under
`docs/self/docs/04_memory/v0.{1,2}/` (`ls … | wc -l` → 33 and 75). **Features** are the length of each
release element's `features` list.

| | Planned (sequencer) | Actual | Active days | Tasks planned → shipped | Features |
|---|---|---|---|---|---|
| Inception + specification | — | 2026-06-14 → 07-03 | 9 | — | — |
| v0.1 | Jul 10 | released 2026-07-08 | 5 (07-04 → 07-08) | 33 → 33 | 13 |
| v0.2 | Jul 17 | released 2026-09-28 (`d2ad1f3f`) | ~12 (07-08 after v0.1's release, 07-09, then 11 days 09-14 → 09-28) | 32 → 75 | 14 |
| Pause | — | 2026-07-09 → 09-14 | **0 (67 calendar days)** | — | — |

- **v0.2's plan was 32 tasks**: `task-034` … `task-065` at the end of its `release-planning`
  (`release-planning-rel-v0.2-plan`); 75 shipped, a growth of 2.3×.
- **Bugs.** 129 bugs were added between `retro-v0.1`'s approval (`20e8271`) and `a20b346c`
  (`bug-008` … `bug-136`), against 7 before it:
  `git log --format=%s <range> --grep="^wf(bug): add" | sed -E 's/^wf\(bug\): add //' | tr ',' '\n' | sed 's/ //g' | sort -u | wc -l`
  with `<range>` = `20e8271..a20b346c` → `129`, and = `20e8271` → `7`.
- **The pause is the only long gap.** Apart from a 7-day gap during inception (06-14 → 06-21), the
  largest gap is 07-09 → 09-14, 67 days.
- **Velocity held.** v0.1 shipped 33 tasks in 5 active days (≈ 6.6 a day); v0.2 shipped 75 in about
  12 (≈ 6.3 a day).
- **Cadence when working.** After work resumed, 11 of the 15 calendar days from 09-14 to 09-28 were
  active: about 5 active days a week.

So v0.2's calendar delay is the pause, and its active-day overrun (about 12 days against a planned
5) is scope, not speed. The sequencer's weekly model assumed neither a pause nor scope growth.

## Decision

The vision's calendar is re-baselined. Fixed release dates are replaced by **active-day budgets** per
release, and by a **calendar forecast that states its cadence assumption**. Actuals are recorded next
to the original plan, which is kept for comparison.

**The first forecast** (a proxy, scaled by feature count from v0.2's ~12 active days for 14
features; to be replaced by each release's own `release-planning`):

| Release | Features | Active-day budget |
|---|---|---|
| v0.2.2 | — | ≈ 4 (the configuration move to the root dominates) |
| v0.3 | 26 | ≈ 22 |
| v0.4 | 8 | ≈ 7 |
| v1.0 | 3 | ≈ 5 (the plan's estimate; the proportional figure is ≈ 3) |

The budgets sum to ≈ 38 active days, ≈ 40 with a retrospective per release: about 8 weeks at the observed 5
active days a week. **If work runs continuously from October, the MVP lands around late November
2026**, against the sequencer's 2026-08-07. This is a projection, not a commitment.

Two questions are open for the approver.

**Q1 — where the budget lives:**
- **(a) the vision documents only**: `07_sequencer.md` gains the actuals table, active-day budgets
  and the forecast; the brief and the canvas point at it.
- **(b) also each `release` element**, as an `[AUTHORING]` frontmatter field (e.g.
  `budget_active_days`) that `release-planning` sets and the retrospective compares against.

**Q2 — when the forecast is refreshed:**
- **(i) at every retrospective**, as part of the release-health analyses (`dl-089`);
- **(ii) only when a release's actuals exceed its budget by a threshold** (the scope-growth rule
  `dl-100` proposes).

**Recommendation:** Q1 (a) now, with (b) weighed by v0.3's `release-planning`; Q2 (i).
- **Q1 (a):** v0.2.2 is a documentation change with no configuration scope; (b) changes
  `memory.yaml` and belongs with the planning phase that would use it.
- **Q2 (i):** the retrospective already measures the release; the forecast then never goes a release
  without being checked.

## Rationale

- **Active days separate speed from availability.** A calendar date mixes the two; the pause alone
  explains v0.2's slip, and an active-day budget would have shown velocity steady throughout.
- **A forecast without its cadence is a promise.** Stating "5 active days a week, from October" lets
  anyone recompute the date when the assumption changes.
- **Keeping the original plan** preserves the comparison the retrospective just used.
- **Out of scope here:** the scope-growth threshold (`dl-100`) and whether v0.3 is split (a decision
  for v0.3's `release-planning`, per the retrospective's dispositions).

## Actions

- [ ] Ratify, choosing Q1 and Q2 (owner: approver).
- [ ] On `ready`, edit the vision documents (version bump and date per `doc-versioning`):
      `docs/01_vision/07_sequencer.md` (*Timeline Overview*, *Week-by-Week Breakdown*: actuals, active-day
      budgets, forecast and its cadence), `docs/01_vision/01_product-brief.md` (*Investment &
      Timeline*), `docs/01_vision/08_mvp-canvas.md` (the milestones relative to Aug 7).
- [ ] Under Q2 (i), add the forecast refresh to `dl-089`'s release-health analyses and to
      `retrospective.yaml`.
- [ ] Tasks are derived by v0.2.2 `release-planning` (`build-backlog`), not created here.

## Relations

- **Origin:** `retro-v0.2`; `retrospective-rel-v0.2-plan` §6.9 (schedule re-baseline).
- **Related:** `dl-089` (release-health analyses), `dl-100` (scope growth and capacity),
  `dl-125` (approving documents that are not Memory elements, which the vision edit needs).
- **Traceability:** the vision package (`docs/01_vision/`), whose sequencer is the source of the
  release waves.
