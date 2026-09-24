---
id: "bug-086-directive-inventory-read-from-the-worktree"
type: bug
title: "The directive inventory and its references are read from the working tree: `assign` binds a file present in no commit, and `remove` deletes an asset the committed `roles.yaml` still binds"
status: in-progress
severity: "high"
release-origin: "v0.2"
release: "v0.2"
feature: "P3.7"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

Two directive verbs decide against the working tree rather than the committed repository, and they are
filed together because they are one read seen from two sides — **which directive files exist, and what
references them**.

- **`directive assign`** checks `--directive` against the directives **present on disk**, so an
  untracked file can be bound: the committed `roles.yaml` then names a directive that exists in no
  commit.
- **`directive remove`** checks REQ-SEC-07 clause (b) — "may this asset be deleted?" — against the
  working tree's `roles.yaml`, so an uncommitted deletion of the reference is enough: the file is
  **destroyed** while the committed `roles.yaml` still binds it.

## Steps to Reproduce

Both reproduced by `task-091` and independently by its reviewer, against the build that already
contains `task-091`'s fix — so neither is closed by it. Scratch projects (`bug-075`).

**`remove` (the serious half):**

```
$ wingfoil directive remove determinism
error: cannot remove 'determinism': still assigned to role 'architect'   # exit 1 — correct
$ # delete the two "- determinism" lines from .wingfoil/roles.yaml, DO NOT COMMIT
$ wingfoil directive remove determinism
→ exit 0, commits wf(directive): remove determinism, deleting
  .wingfoil/directives/custom/determinism.md
$ git show HEAD:.wingfoil/roles.yaml | grep -c determinism
2
```

**`assign`:**

```
$ # create .wingfoil/directives/custom/ghost.md, leave it untracked
$ wingfoil directive assign --directive ghost --role developer
→ exit 0; git show HEAD:.wingfoil/roles.yaml contains "- ghost"
$ git cat-file -e HEAD:.wingfoil/directives/custom/ghost.md
→ exit 1 (the file is in no commit)
```

## Expected Behavior

Per `dl-080`(B), both reads resolve at `HEAD`: a directive may be bound if the committed tree contains
it, and may be removed if the committed `roles.yaml` no longer references it.

## Actual Behavior

`roles.yaml` can be committed binding a file no clone will have, and a committed, still-referenced
asset can be deleted — the only WingFoil verb that destroys an artefact.

## Notes

**Why one element rather than two.** `task-091` offered a boundary for leaving `--directive` on the
working tree while moving `--role` to `HEAD`: the role catalogue is *governance*, the directive file
is the *asset being operated on*. Its reviewer showed that boundary does not hold — `directive
remove`'s REQ-SEC-07(b) check reads `roles.yaml`, which is governance by that same definition, and is
still on the working tree. What actually separates the two is **cost**: reading the directive
inventory at a revision needs a directory listing at that revision, a `git ls-tree`-shaped primitive
`src/storage` does not have. Cost is a scheduling reason, not a rule — so the two sides are decided
together or the boundary is arbitrary.

**`remove` is the sharper half** and was graded above `bug-082` by both the implementer who found it
and the reviewer who reproduced it: every other instance of this class produces a wrong record, while
this one destroys a file. `assign` is recoverable — `dl-042`'s warnings channel already reports a
directive bound to a role with no directive file.

Declared a release blocker by the approver on 2026-09-23, together with `bug-085`.

## Triage & Execution Notes

- triage (2026-09-23): **high**, and a **release blocker**. Not `critical` only because nothing is
  attested falsely about authority and the damage is repairable from git — but it is the one verb
  that deletes, and REQ-SEC-07(b) exists precisely to stop it.
- No fix task filed yet. Whoever takes it needs the missing `src/storage` primitive first: listing a
  directory at a revision. That is the prerequisite, and it is why `task-091` scoped both halves out
  rather than doing one.
