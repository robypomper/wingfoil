---
id: "bug-082-directive-assign-validates-role-against-worktree"
type: bug
title: "`directive assign` validates `--role` against the working-tree role catalogue, so it commits a binding to a role the committed `dna.yaml` does not define"
status: open
severity: "high"
release-origin: "v0.2"
release: ""
feature: "P3.7"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`directive assign` checks that the target role exists by reading `team.roles` from the **working
tree**. An uncommitted role added there is accepted, and the command commits `roles.yaml` carrying a
binding to a role no committed `dna.yaml` defines.

## Steps to Reproduce

Reproduced by `task-090`'s implementer and independently by its reviewer, on throwaway projects
(`bug-075`).

1. `wingfoil init --template scrum`, commit.
2. Add `FABRICATED-ROLE` to `team.roles` in `.wingfoil/dna.yaml`. **Do not commit it.**
3. `wingfoil directive assign <directive> --role FABRICATED-ROLE` → exits 0 and commits
   `wf(directive): assign … to FABRICATED-ROLE`.
4. `git show HEAD:.wingfoil/dna.yaml | grep -c FABRICATED` → `0`.

The committed `roles.yaml` now binds a directive to a role the committed DNA does not contain.

## Expected Behavior

Referential integrity between `roles.yaml` and the role catalogue holds against the **committed**
state, which is the state any other clone of the repository will see. **REQ-SYS-08** binds directives
by role; a binding to a role that does not exist in the recorded DNA is a dangling reference by
construction.

## Actual Behavior

The check passes against a catalogue that exists only on one machine, and the resulting dangling
binding is committed.

## Notes

Same root cause as `bug-079` and `bug-081` — the working tree used as the baseline for a read that
decides whether an operation is legal — on the directives pillar rather than on Memory.

**Graded below the other two, and the reason matters.** Nothing false is attested about authority or
about a transition: the commit says exactly what it did. The damage is referential and **recoverable**
— committing the role, or removing the binding, repairs it, and `dl-042`'s warnings channel for
unassigned or dangling roles in `directives list` is the surface that would surface it. Compare
`bug-081`, which strands an element, and `bug-079`, which fabricates an approval.

Worth noting for whoever fixes it: the natural remedy is not necessarily "read the committed
`dna.yaml`". A role catalogue is a thing an author legitimately extends *while* assigning directives
to it, so a committed-baseline read may make an ordinary flow impossible in a way it does not for
authority. That asymmetry is exactly what `dl-080-which-baseline-each-command-reads` has to decide,
and this bug is the best argument in the record for why one uniform answer may be wrong.

## Triage & Execution Notes

- triage (2026-09-23): **high**. Real, reproduced twice, and it breaks a requirement rather than a
  convention — but it attests nothing false and is recoverable, so it is not a release blocker and
  was not proposed as one.
- No fix task filed: it should be fixed under `dl-080`'s rule, and it is the case most likely to
  argue that rule out of uniformity.
