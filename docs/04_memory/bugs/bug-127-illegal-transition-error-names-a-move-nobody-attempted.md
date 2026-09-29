---
id: "bug-127-illegal-transition-error-names-a-move-nobody-attempted"
type: bug
title: "`illegal transition <from> -> <to>` names a target the user never asked for — `approved -> pending`, `done -> ready`, `approved -> draft`"
status: closed
severity: "low"
release-origin: "v0.2"
release: ""
feature: "P1.6"
contributor: ""
credit: ""
tmpl_version: 260703
rejection_reason: "Closed at v0.3's release-planning triage-bugs (gate 2), approver ruling 2026-09-29, option A (release-planning-rel-v0.3-plan Appendix A). Duplicate of bug-165 (triaged, v0.3): the same canonical-edge rule names a target nobody attempted. Its extra reproduction cases (end of chain, a gate, a custom machine) were folded into bug-165 in 66cf5920, so nothing is lost."
---

## Summary

When a transition verb is refused, the error line names a destination state that is not the move the
verb attempted and, in two cases, is a state *behind* the current one — so the message reads as if the
tool tried to move the document backwards.

## Steps to Reproduce

1. A throwaway repository: `git init`, a git identity, then `wingfoil init --template Scrum`, with
`wingfoil` = `node dist/cli.js` built from branch `docs/user-docs-v0.2` at `79a76d6e`.
2. `wingfoil dna add team.members --value A --entry-email <your git email> --entry-roles approver`
3. `wingfoil memory add --type task --title T`, `memory submit task-001-t`, `memory approve task-001-t --reason ok` → `approved`.
4. `wingfoil memory submit task-001-t` → `error: illegal transition approved -> pending for type 'task'`.
5. `wingfoil memory reject task-001-t --reason r` → `error: illegal transition approved -> draft for type 'task'`.
6. On `pending` (a gate), `memory submit` → `error: illegal transition pending -> (none) for type 'task'`.
7. With a custom type `sequence: [draft, ready, in-progress, done]`, `gates: {ready: {reject: draft}}`:
   `submit` on `ready` → `illegal transition ready -> done`; `submit` on `done` → `illegal transition done -> ready`.

## Expected Behavior

The error says what was refused in the user's terms — e.g. `cannot submit task-001-t: 'approved' is the
last state of 'task'`, or `'pending' is a gate: use memory approve` — or at least names the verb and no
invented target.

## Actual Behavior

The target appears to be computed by wrapping around or skipping along the sequence: `approved -> pending`
at the end of the default chain, `done -> ready` at the end of a custom one, `ready -> done` (skipping
`in-progress`) on a gate. Exit code `1` is correct in every case.

## Notes

- Related, not the same: `bug-032-spec-004-stale-illegal-transition-example` (`open`) is about
  `spec-004`'s documented example, not the runtime message.
- `docs/agents.md` §6 tells agents to read this line; a misleading target is worse for an agent than for
  a human.

## Triage & Execution Notes

- capture (bug-ingest, `bug-ingest-rel-v0.2-user-docs-findings-plan`): found during the v0.2
  `user-docs` phase probe (`user-docs-rel-v0.2-plan`, *Execution Notes → Findings*); proposed severity
  **low**. `release: ""` — scheduling belongs to `release-planning`.
