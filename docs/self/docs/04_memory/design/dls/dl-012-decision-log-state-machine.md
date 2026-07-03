---
id: dl-012-decision-log-state-machine
type: decision-log
title: "Give decision-log its own state machine (discussion -> delivery lifecycle)"
status: in-discussion
context: planning
release: ""
tmpl_version: 260703   # Orignal template version
---

## Context

`docs/self/.wingfoil/memory.yaml` currently declares **no `states` block** for the `decision-log`
type, so it falls back to the shared default machine (REQ-STATE-08):
`draft → pending → approved/rejected → deprecated`. Every other type that carries real downstream
consequences (`task`, `adr`, `release`, `release-line`, `tech-spec`, `bug`) already declares its own
`states` block — REQ-STATE-04 explicitly allows and expects per-type machines, structure `[SPEC]`
(P1.13 / REQ-SYS-04), vocabulary `[AUTHORING]`.

The default machine models a flat approval and stops at `approved`. It cannot express how a
decision-log (DL) is actually used in this project: a DL is discussed, accepted, then
**`release-planning` converts it into one or more backlog tasks for a release**, and the DL is only
truly finished once every task derived from it reaches `done`. `spec-001` (the `memory.yaml` schema
tech-spec, part of this `initial-design` phase) needs to document `decision-log`'s state machine
before its own content is finalized, so this decision must be ratified now, not left open.

## Decision

**Adopt a custom state machine for `decision-log`**, replacing the `# no states -> default machine`
fallback with the following:

| State           | Meaning                                                                   | Allowed next                          |
|-----------------|----------------------------------------------------------------------------|----------------------------------------|
| `draft`         | just created — bare scaffold                                              | `in-discussion`                        |
| `in-discussion` | filled in and under discussion                                            | `ready` (accepted) · `draft` (rework)   |
| `ready`         | accepted; **holds here** until `release-planning` converts it into task(s) of a release | `in-develop`                            |
| `in-develop`    | held here while all tasks derived from this DL are implemented             | `done`                                  |
| `done`          | reached once **all** derived tasks are `done`                            | — (terminal)                            |
| `deprecated`    | rejected or superseded, from any state                                    | — (terminal)                            |

Proposed `memory.yaml` block for the `decision-log` type (replacing the current
`# no states -> default machine (REQ-STATE-08)` comment):

```yaml
  decision-log:
    # …existing path / id_pattern / name / description / tags / template…
    states: # [SPEC] structure (P1.13 / REQ-SYS-04); [AUTHORING] vocabulary (discussion -> delivery lifecycle)
      values: [ draft, in-discussion, ready, in-develop, done, deprecated ]
      initial: draft
      transitions:
        draft: [ in-discussion ]
        in-discussion: [ ready, draft ]     # ready = accepted · draft = needs rework
        ready: [ in-develop ]
        in-develop: [ done ]
        "*": [ deprecated ]                 # rejected (from in-discussion) / superseded (from any state)
```

`ready → in-develop` is driven by `release-planning` (its `build-backlog`/conversion step), not by a
plain `memory.approve`; `in-develop → done` is driven by a completion check once every task that
back-references this DL is itself `done`. DLs that never spawn tasks (settled, record-only decisions)
simply remain at `ready` — that is a valid terminal resting state for this machine, not an error.

If this DL is **not** adopted, `decision-log` keeps the shared default machine
(`draft → pending → approved/rejected → deprecated`) and `spec-001` documents it that way instead.

## Rationale

- **Models the real DL lifecycle.** A DL drives downstream delivery; `ready → in-develop → done`
  expresses "accepted → being built → its derived tasks are complete", which the flat `approved`
  state of the default machine cannot.
- **Consistent with the rest of the schema.** `task`, `adr`, `release`, `release-line`, `tech-spec`
  and `bug` all already declare custom machines under REQ-STATE-04; opting `decision-log` out of the
  default fallback follows the same, already-established pattern rather than special-casing it.
- **Determinism / traceability.** Encoding the lifecycle as declared config (not convention) keeps
  every transition validated (REQ-STATE-01) and lets a task's frontmatter back-reference the DL that
  spawned it.
- **Alternative considered.** Keep the default machine — rejected: it cannot express "accepted, then
  converted into a release's backlog tasks, then done once those tasks are done", which is the actual
  usage pattern this project needs `spec-001` to document now.

## Actions

- [ ] Update `docs/self/.wingfoil/memory.yaml` — add the `states` block above to the `decision-log`
  type, replacing the `# no states -> default machine (REQ-STATE-08)` comment — owner: tech-lead.
- [ ] `spec-001` (memory.yaml schema tech-spec) documents `decision-log`'s custom sequence, gates, and
  the `ready` waiting block, conditional on this DL's approval — owner: architect.
- [ ] Update `docs/self/.wingfoil/workflows/custom/decision-log-ingest.yaml`, `retrospective.yaml`,
  and `end-of-life.yaml` so their `decision-log` transitions use the new vocabulary
  (`submit`: `draft → in-discussion`; `approve`: `in-discussion → ready`) — owner: architect.
- [ ] Define the `ready → in-develop` trigger inside `release-planning` and the `in-develop → done`
  completion check (all back-referencing tasks `done`), including the task↔DL back-reference field —
  owner: tech-lead/architect.
- [ ] Update any documentation that mirrors `memory.yaml`'s per-type state-machine table — move the
  `decision-log` row from the shared default machine to the new custom machine once this DL is
  approved — owner: tech-lead.
