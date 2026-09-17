---
id: "dl-045-absorbed-bug-back-reference"
type: decision-log
title: "A bug absorbed into an existing task's Acceptance Criteria has no closure path — make the task's `bug` field a list"
status: ready
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`bug.sync_state` is the only mechanism that moves a bug through its state machine. It is invoked at
three points in `dev-loop.yaml` — `start` (:29), the `review` submit (:82) and `done` (:96) — always
as `bug.sync_state(where: { id: task.bug })`. It therefore keys on the **fix task's `bug:`
frontmatter field**, which the template documents as a single "source bug id, when this task is a fix
derived from a bug".

In v0.2 four bugs were scheduled **without** a dedicated fix task. Each was folded into the
Acceptance Criteria of a task that already owned the ground:

| bug | absorbed into | why that task |
|---|---|---|
| `bug-018` | `task-054-project-directives` | task-054 **creates** the precondition — its `scaffoldFiles()` change is what makes the unguarded write path reachable |
| `bug-016` | `task-045-memory-submit` | already owns dl-032's realignment in the same call path |
| `bug-017` | `task-046` | wires `requireApprovalAuthority`; the missing characterization test belongs there |
| `bug-015` | `task-061` | already cites spec-007 and the scanner |

Those were the right calls: forcing a separate task would have split one coherent change across two
tasks, and the independent reviews endorsed the placement. But each host task serves a **feature** and
carries `bug: ""`, so `bug.sync_state` is a genuine no-op and the bug never moves.

**There is no legal shortcut.** The `bug` machine's `sequence` is
`draft → open → triaged → planned → in-progress → in-review → resolved → closed`; `triaged` and
`planned` are `waiting` states (advanced only by an engine action, no CLI verb); and the only
`reject` edge reaching `closed` starts from `open`. So a bug stuck at `triaged` cannot be closed
without walking five transitions that never happened.

**This is live, not hypothetical.** `bug-018` is fixed, reviewed, merged into `main` — and still
`triaged`. The other three will reproduce it exactly when `task-045`, `task-046` and `task-061` land.

## Decision

**The task's `bug:` frontmatter field becomes a list.** A task may carry its own feature work plus
zero or more absorbed bugs; `bug.sync_state` iterates over the list instead of reading a single id.

Three sub-questions, answered:

**1 — When may a bug be absorbed?** At **assignment**, and ideally before the host task starts, so
every subsequent transition is driven by the host task's own dev-loop run at the moment it really
happens.

When a bug is absorbed into a task that has **already started** — which is what happened to
`bug-018`, assigned while `task-054` was in flight — the bug enters at the host task's **current**
state, and the skipped states are named explicitly in the sync commit body. A declared jump is
acceptable; a silent one is not.

**2 — Is `planned` required?** **Yes, with no exception.** The commit that assigns the bug and stamps
its `release:` **is** the scheduling act, so `triaged → planned` has a real event behind it and must
be recorded. This is deliberately *narrower* than `dl-034` point 6, which accepted skipping `planned`
for bugs authorised out of band: there, no scheduling act had occurred, so there was nothing to stamp.
Here there is.

**3 — What happens to `bug-018`, already fixed and merged?** Its chain is reconstructed after the
fact, in a single sync commit whose body states plainly that it is retroactive and why: the states
were really passed through — `planned` at the assignment commit, `in-progress`/`in-review`/`resolved`
as `task-054` moved — but no back-reference existed at the time to record them. Reconstructing the
record is honest; pretending the commits existed all along would not be.

## Rationale

Two alternatives were weighed and rejected.

**(a) Require every scheduled bug to get its own fix task.** This restores `sync_state` with no schema
change, and every bug gains a traceable owner. Rejected because it is wrong in principle for exactly
the cases that motivated this decision: `bug-018`'s fix belongs *inside* `task-054` because
`task-054` creates the condition that makes it reachable. Splitting it would put one change in two
tasks and hand the second one a precondition it does not control. It would also contradict four
placements that independent reviews endorsed on the merits.

**(b) Add a `resolved_by:` field to the bug plus a new `triaged → closed` edge.** Cheaper, and it
records who fixed the bug. Rejected because it weakens the property that makes the history readable:
that every state in the sequence was actually passed through. It also puts the pointer on the
document nothing scans — no workflow reads bugs looking for owners, whereas `dev-loop` already reads
the task's frontmatter at three points.

**The list keeps the machinery mechanical.** The back-reference is what `sync_state` binds to, so
restoring it restores the whole existing mechanism — the states advance at the right moments, driven
by the task doing the work, rather than being stamped retroactively. That is the same reason
`depends_on` is already a list: a task can legitimately have more than one of a thing.

## Actions

The surface was **measured, not assumed**:

1. **`docs/self/.wingfoil/memory/templates/task.md:10`** — `bug: ""` becomes a list, with the comment
   rewritten to describe absorption as well as derivation.
2. **`docs/self/.wingfoil/workflows/custom/dev-loop.yaml`** — three call sites (`:29`, `:82`, `:96`)
   change from `where: { id: task.bug }` to an iteration over the list. The header comment at `:6-11`
   already describes the aggregate rule ("the bug only advances once every one of its fix tasks has
   reached the matching state") and needs widening to cover hosts as well as derived fix tasks.
3. **`src/core/relevance.ts` — a REAL code consequence, and a silent one if missed.**
   `LINK_FRONTMATTER_FIELDS` (`:114`) includes `bug`, and `collectLinkedIds` (`:156-159`) reads each
   field with `asString(...)`. **`asString` returns `undefined` for an array**, so the moment `bug:`
   becomes a list the document silently stops counting as a spec-012 §6 **Tier-1 explicit link**
   (weight 1000) in context assembly — no error, no warning, just a bug that drops out of its own
   task's assembled context. `asStringArray` already exists and is used for `depends_on` on the very
   next line, so the fix is mechanical; it should tolerate **both** forms so existing single-id
   documents keep working through the migration.
4. **`spec-012` §6** describes these as "explicit **single-id** links" (and `relevance.ts:113` quotes
   that wording). Amend in place via a `docs(self): implement dl-045` commit, per the `spec-001`
   precedent.
5. **The v0.2 dev-loop plan file** under `docs/05_plans/rl-v1/rel-v0.2/` — per the `dl-034` lesson:
   under the no-engine interim regime agents execute against the **plan**, not the YAML, and
   `task-066`'s review caught exactly this omission once already.
6. **Apply to `bug-018`** retroactively per sub-question 3, and to `bug-015` / `bug-016` / `bug-017`
   at the start of `task-061` / `task-045` / `task-046` respectively — where, per sub-question 1, the
   absorption is recorded *before* the host task runs, so no reconstruction is needed.

A note for whoever implements this: `dl-015`'s `read_related` covers `depends_on` tasks, not
decision-logs, so this outcome must be handed to `task-045`, `task-046` and `task-061` explicitly at
their design step.

Related: `dl-034` (point 6, the narrower `planned`-skip), `dl-016` (release-planning stamps `release`
on included elements), `dl-015`, `spec-012` §6, `bug-015`, `bug-016`, `bug-017`, `bug-018`,
`task-054`.
