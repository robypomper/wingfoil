---
id: "dl-015-inter-task-dependency-notes"
type: decision-log
title: "Make inter-task dependency notes deterministic in dev-loop (structured depends_on + design-phase read)"
status: ready
context: "process"
release: "v0.1"
tmpl_version: 260703
---

## Context

During v0.1 delivery, a completed task routinely records **forward-references / deferrals** to
not-yet-implemented sibling tasks. The authoritative record is each task's own **Execution Notes**
section (`task.template`); the same facts are also mirrored, redundantly, in the session-level
orchestration log (`docs/05_plans/rl-v1/rel-v0.1/release-implementation-rel-v0.1-plan.md` §8).
Concrete Wave 2 examples:

- **task-011** established `test/mcp/helpers/channel-enumeration.ts` "for **task-016** to share".
- **task-008** deferred registry/CLI/MCP wiring to **task-021** (memory search) / **task-026** (dna
  show), with the binding constraint "must **wrap**, not reimplement" and "re-point the perf test".
- **task-009** requires **task-030** to "**replace, not extend**" its Resource URI; **task-011**
  leaves production stdio wiring to **task-030**.
- **task-007** gates the real `npm publish` on **task-032**.

These are binding obligations on the *downstream* task, but nothing in the process guarantees the
downstream agent ever reads them:

- `dev-loop.yaml`'s `design` phase (`agent.verify_specs`) checks only **tech-spec** elements — not
  sibling tasks' notes.
- `dev-loop-rel-v0.1-plan.md` §1.2 obliges the agent to open **its own** task file, not the
  referenced siblings'.
- The only *enforced* backstop is the `traceability` directive at the `review` gate ("a reviewer
  rejects work that breaks or omits a required cross-reference") — post-hoc, human, and scoped to the
  feature→US→BDD→REQ→spec chain, not to sibling Execution Notes.
- The `task` frontmatter carries **no structured dependency field**, so dependencies are prose-only:
  discoverable, but not deterministic.

This is a determinism gap: it contradicts the declared-over-inferred principle (REQ-SYS-07 /
REQ-STATE-09) and the derive-from-state model of P1.13.

## Decision

*(in-discussion — proposed, not yet ratified)* Make inter-task dependency notes **deterministic**
rather than convention-based, via three coordinated changes:

1. Add a structured `depends_on:` (and/or `related_tasks:`) list field to the `task` Memory template
   frontmatter (`memory.yaml` → `task.template`), listing the ids of tasks whose Execution Notes
   constrain this task.
2. Add a `dev-loop` `design`-phase action (e.g. `agent.read_related`) that loads the **Execution
   Notes** of every `depends_on` task and blocks `red` until they are acknowledged — extending the
   existing "no code until relevant tech-specs are approved" safety net to cover sibling obligations.
3. Make the `traceability` directive's cross-reference check explicit about `depends_on`, so the
   `review` gate rejects a task that ignored a declared upstream obligation.

**Open questions to resolve before `ready`:** (a) is the design-phase read a **hard gate** (blocks
`red`) or an advisory load? (b) is `depends_on` authored at planning time (`release-planning`) or
discovered during `design`?

## Rationale

- The dependency data already exists and is authoritative in each task's Execution Notes — the gap is
  purely that **no step routes it to the consumer**. A structured field + a `design`-phase read closes
  it with the least new machinery, reusing the phase that already guards "don't start coding until
  upstream artefacts are ready."
- Alternatives considered:
  - **Status quo (prose cross-references only)** — rejected: relies on agent diligence plus a
    post-hoc reviewer catch; not deterministic — the exact failure this DL documents.
  - **Rely solely on the orchestration log (§8)** — rejected: that log is a *session* artifact the
    `dev-loop` never reads; the per-task Execution Notes are the real source of truth.
  - **A separate per-task plan file per dependency** — rejected: duplicates content across two
    sources of truth, the same anti-pattern `dev-loop-rel-v0.1-plan.md` §1 already rejected for
    per-task plan copies.
- Cost is config-only (a `task` template/schema change, one new `dev-loop` action, one directive
  edit) — no product code — and traces back to REQ-SYS-07 / REQ-STATE-09 (determinism) and P1.13.

## Actions

- [ ] Ratify the hard-gate-vs-advisory and authoring-time-vs-design-time questions (owner: approver).
- [ ] On `ready`: `release-planning` converts this DL into task(s) to (a) add `depends_on` to
  `task.template` in `memory.yaml`, (b) add `agent.read_related` to `dev-loop.yaml`'s `design` phase,
  (c) extend the `traceability` directive.
- [ ] Backfill `depends_on` for the known v0.1 forward-references: task-016→task-011;
  task-021→task-008; task-026→task-008; task-030→task-009, task-011; task-032→task-007.
