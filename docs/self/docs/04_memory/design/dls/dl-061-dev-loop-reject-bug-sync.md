---
id: "dl-061-dev-loop-reject-bug-sync"
type: decision-log
title: "dev-loop's review-reject fallback drives the task back but not its absorbed bug, so every reject desynchronizes the pair"
status: in-discussion
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`dl-045-absorbed-bug-back-reference` made the task's `bug:` field a list so that a bug absorbed into
an existing task's Acceptance Criteria has a closure path: `bug.sync_state(for_each: task.bug)`
recomputes each named bug's state from its host task's progress. `dl-045`'s own Actions enumerate the
surface it changed — "three call sites (`:29`, `:82`, `:96`)" — and
`docs/self/.wingfoil/workflows/custom/dev-loop.yaml` (v1.3) has exactly those three today:

- `start` (`:37`) — `planned → in-progress`, at branch/worktree creation.
- `review` (`:90`) — `in-progress → in-review`, next to the `memory.submit` at `:89`.
- `done` (`:104`) — `in-review → resolved → closed`, after the merge.

**The reject path has none.** `review`'s fallback is `fallback: { step: red, set_state: in-progress }`
(`:94`): it declares a `set_state` for the *iterated element* — the task — and no action at all, so no
`bug.sync_state` runs. Nor does one run on the way back in: the fallback re-enters the loop at `red`
(`:59`), not at `start`, so `start`'s sync at `:37` is skipped as well. The result is mechanical and
unavoidable: **on every review rejection the task returns to `in-progress` while every bug it absorbed
stays at `in-review`.**

Nothing else closes the gap. The edge itself exists — `memory.yaml`'s `bug` block (`:170`) declares
`gates: { in-review: { reject: in-progress } }`, commented "reject: reopen ->in-progress" — so the
transition is legal; there is simply no declared step that drives it. And the desync is not
self-healing: the next `review` pass runs `:90` again, which would move the bug `in-review →
in-review`, a no-transition that the state machine has no edge for.

**What happened in practice, in `task-061-publish-secrets`** (host of the absorbed
`bug-015-scan-reads-worktree-not-index`, per the v0.2 dev-loop plan's absorbed-bug table):

1. `8b53313` — `wf(task): reject task-061-publish-secrets [in-review → in-progress]`, the approver's
   reject over a stale count in the Execution Notes. It touches **one** file, the task's own document.
   `bug-015` is left at `in-review`.
2. `8203f4a` — `wf(bug): sync bug-015-scan-reads-worktree-not-index [in-review → in-progress]`, emitted
   by hand by the implementer, body: "bug.sync_state trailing the approver's reject of
   task-061-publish-secrets (`8b53313`), which reset the host task to in-progress but did not touch
   the absorbed bug (dl-045)".
3. `83c6509` — `wf(bug): sync bug-015-… [in-progress → in-review]` at the second-pass review submit,
   i.e. `:90` firing normally again.

Without step 2 the resubmit at step 3 would have been `in-review → in-review`. The second-pass
reviewer endorsed the hand-made back-edge on the merits.

**This is an implementation gap in `dl-045`, not a defect in `task-061`.** `dl-045` specified the
forward path across the three points where the host task advances and did not consider the one point
where it goes backwards; `task-061` was the first host task to be rejected after `dl-045` landed, so
it is where the omission became visible. Nothing `task-061` did was wrong — the hand-made sync is the
behaviour a declared reject-side sync would have produced.

**The same shape appears once more, unexercised so far.** `done`'s fallback (`:105`) is also
`{ step: red, set_state: in-progress }` with no sync — the `dl-014` G4 conflicted-merge route. It is
reached *after* `memory.approve` has moved the task to `approved` and *before* `:104` runs, so a
failed merge would leave any absorbed bug at `in-review` in the same way. (Whether that fallback's own
task edge is legal is a separate question: `task`'s `gates` declare a reject edge only from
`in-review`, and `approved` is a `waiting` state — out of scope here, and adjacent to `dl-053`.)

## Decision

*Approver to choose. Three questions, each with the options and the recommendation.*

### A — Does the reject path get a declared `bug.sync_state`?

1. **Add a fourth call site on `review`'s reject fallback** (recommended): the fallback gains a
   `bug.sync_state(for_each: task.bug)` alongside its `set_state: in-progress`, driving each absorbed
   bug `in-review → in-progress` over the `gates` edge `memory.yaml` already declares. The four call
   sites then cover every point at which the host task changes state, forward or backward, and the
   property `dl-045` was defending — that the bug's recorded chain is exactly the states it really
   passed through — survives a reject instead of needing a hand-made repair. Scope question for the
   approver: whether `done`'s fallback (`:105`) gets the same treatment in the same change, or is left
   to whatever settles its task-edge legality.
2. **Leave the reject side implicit**, accepting a discontinuous record: the bug stays at `in-review`
   while its host task is back at `in-progress`, and the next submit's `:90` is a no-transition that
   each implementer works around by hand, as `task-061` did. Cheapest in edits and honest about the
   no-engine regime, but it makes correctness depend on every implementer noticing, and it leaves a
   state pair in the record that no legal edge explains.

### B — What must a `sync` commit carry when it crosses a `gates` reject edge?

**P1.7** requires approver identity, ISO-8601 timestamp and reason for an approval-gated transition,
and CLAUDE.md §5.1 puts the identity and reason in the commit body. A `bug.sync_state` crossing a
reject edge crosses such a gate — but the decision was the approver's, and is already recorded on the
host task's own commit.

1. **Cite the approver's commit hash** (recommended): the sync commit's body names the transition it
   trails and the sha that carries the `Approver:`/`Reason:` lines, as both existing precedents already
   do — `8203f4a` cites `8b53313` (a reject edge) and `905b005` cites `9781453` (the approve edge, for
   `bug-016`/`bug-027` at `task-045`'s `done`); neither inlines an `Approver:` line. This keeps one
   copy of the decision, so the two records cannot drift, and keeps the sync commit what it is — a
   derived, mechanical consequence rather than a second act of approval by an agent that has no
   approval authority (CLAUDE.md §4/§8).
2. **Inline the `Approver:`/`Reason:` lines** on the sync commit too. Makes each element's history
   self-contained for `memory history` (P1.10) without following a cross-reference, at the cost of
   duplicating the approver's words onto a commit the approver did not write, and of an agent-authored
   commit that *looks* like an approval.

A sub-question the approver may want to settle alongside it: `wf({type}): sync …` is a **sixth**
subject verb — 23 such commits on `main` — while CLAUDE.md §5.1 and `spec-004` §4.3 enumerate only
`add|submit|approve|reject|deprecate`. It is a real convention with no specification home, and B is
the first question that turns on its body format.

### C — Does the orchestrator's own reject procedure emit the back-edge?

Today it does not, which is exactly how this surfaced: `8b53313` changed only the task document. Note
that "in the same act" cannot mean "in the same commit": CLAUDE.md §5.1 scopes each operation to one
element type, so this is one reject commit plus one sync commit, emitted together and cross-referenced.

1. **The reject procedure emits both commits, in order** (recommended): whoever performs
   `memory.reject` on a task whose `bug:` list is non-empty follows it immediately with the
   `bug.sync_state` commit, the same way `done` already pairs `memory.approve` with `:104`. Under the
   no-engine regime (CLAUDE.md §6) the orchestrator *is* the workflow engine, so a declared action with
   no human counterpart is a rule that never runs.
2. **Leave it to the implementer on resubmit**, as happened here — the back-edge is emitted when the
   task is picked back up rather than when it is rejected. Records the same two states, but leaves a
   window in which the pair is knowingly inconsistent, and only if the implementer notices.

The documentation half travels with whichever option wins:
`docs/05_plans/rl-v1/rel-v0.2/dev-loop-rel-v0.2-plan.md` §3.6 states the fallback as "reject → `red`,
task reset to `in-progress`" with no bug sync, and its `bug.sync_state` section lists the same three
points as `dev-loop.yaml`. If A.1 is chosen, both need the fourth point; if A.2 is chosen, the plan
should say so explicitly, so the next implementer meets a documented gap rather than an undocumented
one.

## Rationale

- **The gap is structural, not incidental.** It follows from two individually reasonable facts: the
  fallback declares `set_state` for the iterated element only, and it re-enters at `red` rather than
  `start`. Neither is wrong alone; together they leave the one state change that has no declared sync.
- **The cost is paid every time, not once.** Every rejected host task with a non-empty `bug:` list
  reproduces it, and each occurrence needs the same manual repair before the next submit is legal.
  `task-061` is the first only because it is the first host task rejected after `dl-045` landed.
- **A declared edge nothing drives is the worst of both worlds.** `memory.yaml` already sanctions
  `in-review → in-progress` for `bug`. Option A.2 keeps a legal edge that only ad-hoc practice
  exercises — the same "one configuration fact, two rules" failure `dl-051` rejected in another pillar.
- **B is about who owns a decision, not about paperwork.** The approver's reason exists once, on the
  approver's own commit; a sync commit is derived from it. Copying it onto an agent-authored commit
  makes two records of one decision, and gives an agent's commit the shape of an approval it has no
  authority to make.
- **C follows from the no-engine regime.** `dl-019` made phase plans the executable stand-in for the
  missing engine; an action that only a future engine would emit is not a rule today, it is a hope.

## Actions

- Owner **approver**: choose A, B and C. A is the blocking one — it decides whether `dev-loop.yaml`
  gains a fourth `bug.sync_state`, and whether `done`'s fallback is in the same change.
- If **A.1**: bump `dev-loop.yaml` to v1.4 (its `version:` comment records each such change, as v1.3
  records `dl-045`), add the call site to `review`'s fallback, widen the header comment at `:6-20`
  (which describes the forward aggregate rule only), and update the v0.2 dev-loop plan's §3.6 and its
  `bug.sync_state` section. If **A.2**: record the gap in both, so it is documented rather than
  rediscovered.
- If **C.1**: the reject procedure's two-commit pairing belongs wherever the agent-facing operating
  conventions live — today CLAUDE.md §5.1, which `bug-008`/`dl-025` have already flagged as owned by no
  workflow gate.
- Either way: `task-045-memory-submit`, `task-046-memory-approve` and `task-047-memory-reject` are the
  verbs that will one day emit these commits, so B's outcome is a constraint on `task-047` in
  particular. `dl-015`'s `read_related` covers `depends_on` tasks and **not** decision-logs, so this
  outcome must be handed to them explicitly at their design step. *(All three are now `done` and merged —
  see the Scheduling addendum (2026-09-21) below; the handoff is no longer available.)*
- No back-fill is needed for `bug-015`: `8203f4a` already records the back-edge and `83c6509` the
  return. This decision is about making the next one automatic.

Related: `dl-045-absorbed-bug-back-reference` (the decision this gap is in), `dl-014` (G4, the `done`
fallback), `dl-019` (plans as the engine stand-in), `dl-053` (verbless edges — adjacent to the `done`
fallback's own legality), `task-061-publish-secrets`, `task-045-memory-submit`,
`task-047-memory-reject`, `bug-015-scan-reads-worktree-not-index`, `dev-loop.yaml` v1.3 (`:37`, `:90`,
`:94`, `:104`, `:105`), `memory.yaml` (`:170`, the `bug` `gates` block), P1.7, P1.10.

## Scheduling addendum (2026-09-21) — unscheduled obligation for v0.3

All three verbs this decision-log names as future emitters of these commits are now `done` and
merged: `task-045-memory-submit` (`cf4ce8f`), `task-046-memory-approve` (`1914195`) and
`task-047-memory-reject` (`57c412f`) — as is `task-061-publish-secrets`, the run whose hand-made
workaround prompted this. Clause B's outcome was described as "a constraint on `task-047` in
particular"; `task-047` closed on 2026-09-18, so that constraint has nowhere to land.

Clause A was never a task in the first place: it amends `dev-loop.yaml` (the fourth `bug.sync_state`
call site on `review`'s reject fallback), which under the no-engine interim regime also means amending
the v0.2 dev-loop plan under `docs/05_plans/rl-v1/rel-v0.2/`.

This document is therefore left `in-discussion` with `release: ""` on purpose. That pair is exactly what
`release-planning`'s `reconcile-governance` selection filter picks up
(`where: { type: [decision-log, adr], status: [in-discussion, pending], release: ["", "{release.version}"] }`,
`release-planning.yaml:45`), so the next run sweeps it, approves it, and `build-backlog` places the work
it implies. It is an **unscheduled obligation** in the shape `dl-030` established for REQ-SEC-07's P4.9
half: recorded here, placed by the next `release-planning`, never added to a release already
`in-development` (`dl-034` point 4 bounds that exception to bugs blocking work in flight, which this is
not).

**Consequence for whoever ratifies it:** the hand-it-to-the-inheritor instruction in Actions above can no
longer be executed — there is no task left to hand it to. The outcome needs **its own task** out of
`build-backlog`. This addendum exists because nothing else would have said so: `dl-015`'s `read_related`
covers `depends_on` tasks and not decision-logs, and nothing re-opens a `done` task's notes.
