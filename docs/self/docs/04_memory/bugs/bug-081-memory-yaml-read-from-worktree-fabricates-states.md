---
id: "bug-081-memory-yaml-read-from-worktree-fabricates-states"
type: bug
title: "An uncommitted `memory.yaml` edit makes an ungated verb commit a state no committed machine defines, and strands the element in it"
status: triaged
severity: "critical"
release-origin: "v0.2"
release: ""
feature: "P1.13"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

The state machine is read from `memory.yaml` in the **working tree**. An uncommitted edit to a type's
`sequence` therefore decides what transition a verb performs and what status it writes into the
document — while the committed `memory.yaml` defines no such state.

The element is then **stranded**: with the committed machine restored, no verb can move it, because
its own status is not a member of any sequence the machine declares.

## Steps to Reproduce

Reproduced three times on 2026-09-22/23 — by the implementer of `task-090`, by that task's reviewer,
and independently here — on throwaway projects, which is the only way to exercise it (`bug-075`).

1. `git init`, `wingfoil init --template scrum` (it commits the scaffold), `memory add --type adr`.
2. Edit `.wingfoil/memory.yaml`, **without committing**: `defaults.states.sequence` from
   `[ draft, pending, approved ]` to `[ draft, FABRICATED-BY-SUBMIT, approved ]`, and the `gates` key
   `pending` to match (the schema rejects a `gates` key absent from `sequence`, so a naive edit fails
   validation and a consistent one passes).
3. `wingfoil memory submit adr-001-probe` → **exit 0**, `{"from":"draft","to":"FABRICATED-BY-SUBMIT"}`.

Result:

```
$ git log -1 --format='%s'          →  wf(adr): submit adr-001-probe
$ grep -m1 '^status:' <element>     →  status: FABRICATED-BY-SUBMIT
$ git show HEAD:.wingfoil/memory.yaml | grep 'sequence: \[ draft'
                                    →  sequence: [ draft, pending, approved ]
$ git checkout .wingfoil/memory.yaml && wingfoil memory approve <id> --reason t
                                    →  error: invalid state 'FABRICATED-BY-SUBMIT' for type 'adr'
```

The project used for this had `team.members: []` — **nobody is an approver, and none is needed.**

## Expected Behavior

A transition is decided by the state machine the repository records. Either the machine is read from
the committed `memory.yaml`, or a verb refuses while that file carries uncommitted modifications.

## Actual Behavior

A working-tree edit decides what the audit trail says happened, through a verb that requires no
authority at all, and leaves a document no verb can move.

## Notes

**Same root cause as `bug-079`, and worse on three counts.** `bug-079` let an uncommitted `dna.yaml`
fabricate *who authorised*; this lets an uncommitted `memory.yaml` fabricate *what the state machine
is*. It is reachable through `memory submit`, which is **ungated** — `bug-079` at least required the
gated verbs and a git identity that could plausibly be an approver. And it is not merely a false
record: the element is left in a status the committed machine rejects, so the damage persists after
the working tree is restored.

**`task-090` does not close it.** That task fixed the authority read specifically —
`requireApprovalAuthority` now resolves `dna.yaml` at `HEAD` — and deliberately did not generalise,
because the general rule was left to be decided rather than improvised. This is that rule's first
casualty.

**What is not claimed**, on the same terms as `bug-079`: the actor must already be able to write the
file and could commit the change instead. The defect is that committing leaves a record and not
committing leaves none, so the trail attests a transition no committed machine sanctions. Accidental
reach is real here in a way it is not for `dna.yaml` — `memory.yaml` is the file an author edits while
designing a new type or machine, and a half-finished edit is an ordinary state to be in.

Related: `bug-079` (authority, `planned` v0.2, closing through `task-090`), `bug-082` (the role
catalogue, same class), `bug-078` (the write side). The general question they share is
`dl-080-which-baseline-each-command-reads`, and this bug should be fixed under whatever that decides
rather than patched on its own.

## Triage & Execution Notes

- triage (2026-09-23): **critical**. Reachable with no privilege, corrupts the record and strands the
  artefact, in a release whose subject is a git-backed Memory with validated transitions.
- No fix task filed yet: `dl-080` is being written to settle the baseline rule, and fixing this
  read-by-read before that is decided is what produced four bugs of one root cause.
