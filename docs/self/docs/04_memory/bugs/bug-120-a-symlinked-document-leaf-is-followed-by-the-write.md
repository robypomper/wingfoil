---
id: "bug-120-a-symlinked-document-leaf-is-followed-by-the-write"
type: bug
title: "A symlinked document *leaf* is followed by `writeFileSync`, so Memory writes still land outside the project root — and through a dangling link `memory add` commits a subject for an element the repository does not contain"
status: in-progress
severity: "high"
release-origin: "v0.2"
release: "v0.2"
feature: "P1.6"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`task-105` closed `bug-117` for a symlinked store **directory**. A symlinked **document** is a
different mechanism and is not closed: `unlink` acts on a link, but `writeFileSync` **follows** it.
So the parent/leaf asymmetry that is correct for a delete is a hole for a write.

Two reproductions, both measured by `task-105`'s reviewer on a `dist/` built from the **fixed**
branch, in bounded fixtures.

### D1 — `memory add` through a dangling leaf writes outside the root **and commits**

```
$ ln -s "$O/leaked-add.md" docs/memory/task/task-002-escape-probe.md   # dangling, untracked
$ wingfoil memory add --type task --title "escape probe"
error: commit a3095dfb… carries more than the change it declares:
  'docs/memory/task/task-002-escape-probe.md' at the commit differs from what this operation wrote
exit 1

$ ls -lA "$O"            -> -rw-rw-r-- 273 leaked-add.md          # the element, OUTSIDE the root
$ git log --oneline -1   -> a3095df wf(task): add task-002-escape-probe    # A COMMIT WAS MADE
$ git show --stat HEAD   -> docs/memory/task/task-002-escape-probe.md | 1 +    # the symlink blob
```

`requireAbsentTarget` uses `existsSync`, which is **false** for a dangling link; confinement accepts
because the leaf is deliberately unresolved; `writeFileSync` follows it. History now carries
`wf(task): add task-002-escape-probe` for an element the repository does not contain, and the message
the operator sees names neither the boundary nor the fact that anything was written outside.

### D2 — `memory submit` through a committed leaf rewrites the outside document

```
$ git ls-files -s docs/memory/task/  -> 120000 8ea2857f… task-001-leafy.md
md5 before: 999900380bee4a7d3ef4886e0486d67a
$ wingfoil memory submit task-001-leafy
error: Command failed: git -C … commit --only --quiet -m …
exit 1
md5 after:  c1b5433440371de390e7bd5894646a54     status: draft -> pending   # rewritten OUTSIDE
```

No commit here, and the operator gets raw child-process text — the `bug-071`/`bug-093` leak.

## Steps to Reproduce

As above, in a throwaway `wingfoil init --template Scrum` repository.

## Expected Behavior

REQ-SEC-06: a write whose destination resolves outside the project root is refused **before any file
is created**. That property does not distinguish a symlinked directory from a symlinked document.

## Actual Behavior

It holds for the directory and not for the document.

## Notes

**D1 is worse than `bug-117`, which is why this is `high`.** `bug-117` wrote outside the root and
then failed *before* committing. D1 commits: the repository's own history gains a `wf(task): add`
subject for an element that is not there, which is a durable false record in the pillar whose whole
purpose is a truthful one. `committedScopeError` catches the mismatch — **after** the commit exists.

**Not a regression, and not a defect in `task-105`.** The post-fix check is the pre-fix check plus a
condition, so nothing accepted now was refused before. `task-105` found this against its own work and
was explicitly forbidden by its own AC5 from reaching for the obvious wrong remedy.

**The remedy is a different mechanism, not a wider boundary.** Resolving the leaf would refuse the
case `bug-044` verified as safe, where `unlink` correctly removes a link. What writes need is an
`lstat`-shaped refusal of a symlinked target — or `O_NOFOLLOW` semantics, which Node's `fs` does not
expose on a path-based API. So the asymmetry becomes **verb-dependent**: resolve the parent for a
delete, refuse a symlinked leaf for a write. That is `dl-086`'s ground and `task-105` proposed it
there rather than settling it in a TSDoc.

**D2 needs nothing contrived.** Symlinking a single document into a shared folder is an ordinary thing
to try.

**One sentence is now false because of the widening.** `requireConfinedTarget`'s user-facing claim,
"A path that leaves the project is refused, never written to and never deleted", is untrue as a
general statement on the Memory write paths `task-105` added it to.

## Triage & Execution Notes

- triage (2026-09-25): **high**, on D1. A refusal that leaves a file outside the root is bad; a
  refusal that also writes a commit claiming an element exists is worse, because the failure is now
  recorded as a success in the log `memory history` reads back.
- **Scheduled into `v0.2` by the approver on 2026-09-25**, which makes it a release blocker. The
  question it turned on was put explicitly: `bug-117` **as reported** — a symlinked store directory —
  is repaired; `bug-117` **as specified**, its Expected Behavior and REQ-SEC-06's property, is not.
  The ruling is that the gate selects on the requirement, so `bug-117` stays open and extended, and
  this bug carries the remaining mechanism. `bug-117` closes when this one does.
