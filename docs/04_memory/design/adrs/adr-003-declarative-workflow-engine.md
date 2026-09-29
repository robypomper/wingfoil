---
id: adr-003-declarative-workflow-engine
type: adr
title: "Declarative workflow engine: phases -> steps -> actions, composed via include()"
status: accepted
sard_ref: REQ-SYS-06
supersedes: ""
tmpl_version: 260703   # Orignal template version
---

## Context

WingFoil's Project Workflow pillar (P4) has to express an entire software lifecycle — from inception
through specification, initial design, per-release delivery, to sunset — in a form that both an AI
agent and a human can execute deterministically and that stays legible as the process grows. A single
monolithic workflow file covering that whole lifecycle in one flat sequence would be unreadable, hard
to review, and impossible to reuse: the "approve a release" pattern or the "deliver one release-cycle"
pattern recur at multiple points in the lifecycle (once per release-line, once per release, once per
task), and a flat definition would force copy-pasting the same phases wherever they recur, with every
future edit needing to be repeated at each copy. It would also make it impossible to run a narrow
process (e.g. "capture a bug") on its own, without dragging along the entire lifecycle it happens to be
nested inside during normal delivery. Without a decision to structure workflows compositionally, the
project would either accept that duplication-and-drift risk or invent an ad hoc reuse mechanism for
every new workflow file, defeating the goal of a single deterministic engine.

A related force is per-element repetition: several phases don't run once, they run once per matching
Memory element — one `release-cycle` per `release` under a `release-line`, one `dev-loop` iteration per
`task` in a release's backlog. Without a first-class notion of "run this sub-process once per element
matching a query," workflow authors would have to hand-roll loops or, worse, encode a fixed list of
elements at authoring time — which breaks the moment new releases or tasks are added after the workflow
is defined, undermining the state-derivation model where element existence and status are the only
source of truth (REQ-SYS-03).

## Decision

WingFoil workflows are declarative YAML documents, not imperative code. Each workflow decomposes into
**phases**, each phase into **steps**, each step into **atomic actions** (e.g. `element.set_state(...)`,
`memory.add(...)`, `memory.submit`, `bug.sync_state`) — small, named operations the engine can execute
and verify without interpreting arbitrary logic. Workflows compose via `include()`: a phase can
`include:` another workflow by name instead of inlining its phases, so a reusable process (e.g.
`release-cycle`, `dev-loop`) is defined once and referenced everywhere it recurs.

Every workflow declares a `kind`, and there are exactly two: `kind: main` workflows are independently
**startable** by a human or agent (e.g. via `wingfoil workflow start <name>`); `kind: sub` workflows are
**include-only** and can never be started directly — an attempt to start one is rejected. `workflows.yaml`
is the root config: it does not inline every workflow but `include()`s each workflow file (built-in
templates from `workflows/built-in/`, project-specific ones from `workflows/custom/`), and lists which
of those are the startable mains (REQ-STATE-03 explicitly allows several mains to be open at once —
today `sw-life-cycle` plus the `bug-ingest`, `decision-log-ingest`, and `adr-ingest` capture workflows).

A phase that needs to repeat per matching element declares `iterate_over: <element-type>` with an
optional `where:` filter; the engine runs that phase's (or included sub-workflow's) steps exactly once
per element the filter currently matches. Per REQ-SYS-03, this is always a **live query** against
current Memory state, never a snapshot fixed at authoring or start time — `release-line-cycle`'s
`delivery` phase, for example, does `include: release-cycle` with
`iterate_over: release` and `where: { release-line: "{release-line.version}", status: [draft, planning, in-development] }`,
so a release added to that release-line after the workflow started is still picked up. This live-query
semantic is also what allows a phase to legitimately *produce* more elements of the type it iterates —
`plan-next-release-line` self-seeds the next `release-line`, which the outer `sw-life-cycle`'s own
`iterate_over: release-line` will then pick up in its own right; no extra engine mechanism is needed
for that, it falls directly out of "iteration is always a live query."

## Consequences

- **Positive:**
  - Reusable process building blocks: `release-cycle`, `dev-loop`, `initial-design`, etc. are each
    defined once in `workflows/custom/` and referenced by `include()` wherever the lifecycle needs
    them, instead of being copy-pasted per call site.
  - Per-element repetition (one `release-cycle` per `release`, one `dev-loop` per `task`) is expressed
    declaratively with `iterate_over`/`where` rather than hand-rolled loops, and stays correct as new
    elements appear because the query is live (REQ-SYS-03).
  - The `main`/`sub` distinction gives a clean, engine-enforced boundary between "processes a human or
    agent can kick off directly" and "processes that only make sense nested inside a larger flow" —
    `sub` workflows can't be started out of context by mistake.
  - Multiple `main` workflows can be open concurrently (REQ-STATE-03), so a narrow capture flow like
    `bug-ingest` can run alongside the long-running `sw-life-cycle` without either blocking the other;
    when started while another workflow has an active element, the new one can inherit that element
    (e.g. a bug raised during `dev-loop` inherits the active `task`).
  - Because actions are atomic and named (not arbitrary code), the engine can validate and execute a
    workflow without interpreting a general-purpose scripting language, keeping execution auditable and
    deterministic (REQ-SYS-07).
- **Negative:**
  - The `include()` graph must stay acyclic and every `include:` must resolve to a `name:` defined
    somewhere in `workflows.yaml`'s `includes:` list; a broken or cyclic reference is an authoring
    error the engine must catch rather than silently mis-execute.
  - Because `iterate_over`/`where` is a live query, a workflow's total scope of work is not fixed at
    start time — elements matching the filter can appear (or, if statuses change, disappear) mid-run;
    workflow authors must design phases so that reasonable set changes during execution don't leave the
    workflow in an inconsistent state.
  - The declarative phases/steps/actions vocabulary must stay closed and versioned: adding a genuinely
    new action type is a schema change to the engine, not something a workflow author can improvise
    inline.
- **Neutral:**
  - Phase completion is deduced, not stored: Memory-backed phases derive completion from element
    `status:`, spec/design phases from the existence of their declared `produces:` artifacts on disk —
    this ADR only decides the composition/iteration mechanism, not the state-derivation mechanism,
    which is covered separately (adr-007).
  - `workflow list` shows only what is currently executable (startable mains, plus a `sub` when it is
    the next step reachable from an open main); `workflow list --all` additionally shows every defined
    workflow regardless of reachability.

## Process Notes

Grounded in `docs/02_requirements/03_sard/01_architecture.md` (REQ-SYS-06) and the project's own
running configuration, `docs/self/.wingfoil/workflows.yaml` and
`docs/self/.wingfoil/workflows/custom/release-line-cycle.yaml`, which supplied the concrete
`include()`/`iterate_over`/`where` example cited above. This version's phases -> steps ->
atomic-actions decomposition and self-seeding / live-query behavior are added directly from the
current workflow files.
