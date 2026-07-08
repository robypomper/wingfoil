---
id: "dl-017-decision-log-remove-delivery-states"
type: decision-log
title: "Remove the delivery states (in-develop, done) from decision-log; DL returns to draft → in-discussion → ready (→ deprecated)"
status: ready
context: "process"
release: "v0.1"
tmpl_version: 260703
---

## Context

`dl-012-decision-log-state-machine` gave `decision-log` a custom machine
`draft → in-discussion → ready → in-develop → done (· → deprecated)`, where the last two states model
"being built" and "all derived tasks done". Its own Rationale states this "lets a task's frontmatter
back-reference the DL that spawned it", and `memory.yaml`'s `waiting` note says `in-develop → done`
"fires once every derived task back-referencing this DL is itself `done`".

**That back-reference was never implemented.** The `task` template carries a `bug:` field (source bug
id, kept in sync by `dev-loop`'s `bug.sync_state`) but **no `dl:` field**, and no task in the repo
references a DL. So there is no mechanism to identify a DL's derived tasks and therefore no way to
compute `ready → in-develop` or `in-develop → done`. A DL that spawns tasks would simply be stuck at
`ready` forever.

This surfaced while designing `dl-016-release-planning-governance-reconcile` (where `build-backlog`
converts `ready` DLs into tasks): dl-016 originally proposed advancing the DL `ready → in-develop`,
which is exactly the unimplementable transition.

## Decision

*(in-discussion — proposed, not yet ratified)* Adopt **Option B**: reduce the `decision-log` machine
to

```
draft → in-discussion → ready   (· → deprecated)
```

i.e. remove `in-develop` and `done`. `ready` becomes the terminal resting state (a decision, once
accepted, is settled); `deprecated` remains reachable from any state via `memory.deprecate`. This
mirrors `adr` (`draft → pending → accepted → superseded`) and `tech-spec`
(`draft → pending → approved → superseded`): a DL **records a decision**, it is not a delivery
container. **bug remains the only delivery-coupled type** (via `task.bug` + `bug.sync_state`).

Concretely:
- `memory.yaml` `decision-log.states`: `sequence: [ draft, in-discussion, ready ]`,
  `gates: { in-discussion: { reject: draft } }`, `waiting: [ ]` (the `ready → in-develop` /
  `in-develop → done` engine transitions are dropped); `deprecated` stays a `memory.deprecate` target.
- **Amend `dl-012`**: strike the `in-develop`/`done` rows from its state table and the sentence "lets a
  task's frontmatter back-reference the DL that spawned it"; note it as partially superseded here
  (the custom-machine decision stands; only the delivery lifecycle is removed).
- Under this decision, `dl-016`'s `build-backlog` still creates task(s) from a `ready` DL but the DL
  **stays `ready`** — no `ready → in-develop`.

**Alternative — Option A (rejected for now):** implement the coupling instead of removing it — add a
`dl:` field to the `task` template and a `dl.sync_state` step in `dev-loop` (symmetric to `bug`), so
`in-develop`/`done` become computable. Rejected as more machinery than the current value justifies;
kept as future work (see `dl-016` note on coupling DL/tech-spec/ADR to tasks, and
`dl-015-inter-task-dependency-notes`).

## Rationale

- **Honest machine over aspirational machine.** A state that no workflow can reach or advance is dead
  config; removing it keeps every declared transition validatable (REQ-STATE-01) and derivable from
  real frontmatter (P1.13), instead of promising a lifecycle the tooling cannot deliver.
- **Consistency.** DL joins `adr`/`tech-spec` as a record-with-approval type; `bug` stays the single
  task-coupled type. Fewer special cases.
- **Low regret.** `dl-012` already acknowledged that "DLs that never spawn tasks simply remain at
  `ready` — a valid terminal resting state"; Option B just makes that the rule for *all* DLs, which is
  what the missing back-reference forces anyway.
- **Determinism.** Prefer explicit declared states that match implemented behaviour over inferred ones
  (REQ-SYS-07 / REQ-STATE-09).

## Actions

- [ ] Ratify Option B vs Option A (owner: approver).
- [ ] On `ready` (as config task(s)): (1) reduce `decision-log.states` in `memory.yaml`; (2) update
  `spec-001` (memory.yaml schema) to document the reduced DL machine; (3) amend `dl-012` body
  (state table + back-reference sentence) and mark it partially superseded by this DL; (4) update the
  `decision-log` row in `CLAUDE.md` §5.
- [ ] Coordinate with `dl-016-release-planning-governance-reconcile`: its `build-backlog` conversion
  leaves the DL at `ready` (no `ready → in-develop`).
- [ ] Partially supersedes `dl-012-decision-log-state-machine` (keeps the custom machine, removes the
  delivery lifecycle).
