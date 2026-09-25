---
id: "task-106-refuse-a-symlinked-target-on-the-memory-write-paths"
type: task
title: "Refuse a symlinked target on the Memory write paths, so `writeFileSync` cannot follow a link the confinement check deliberately does not resolve — and so nothing commits for an element that was never written"
status: backlog
release: "v0.2"
priority: "high"
tags: ["v0.2", "memory", "storage", "security"]
ref: "bug-120-a-symlinked-document-leaf-is-followed-by-the-write"
bug: ["bug-120-a-symlinked-document-leaf-is-followed-by-the-write", "bug-117-memory-add-writes-outside-the-project-root-through-a-symlinked-store"]
depends_on: ["task-105-confine-the-memory-store-to-the-project-root"]
tmpl_version: 260703
---

## Description

`task-105` closed the symlinked **store directory**. A symlinked **document** is a different
mechanism and is still open: `unlink` acts on a link, `writeFileSync` **follows** it — so the
parent-resolved, leaf-unresolved asymmetry that is correct for a delete is a hole for a write.

Two reproductions, both measured on the **fixed** build by `task-105`'s reviewer (see `bug-120`):

- `memory submit` through a committed symlinked document **rewrote the outside file** and then failed
  with raw git text;
- `memory add` through a **dangling** symlink wrote a 273-byte element outside the root **and
  committed** — `requireAbsentTarget`'s `existsSync` is false for a dangling link, so history gained
  `wf(task): add task-002-escape-probe` for an element the repository does not contain.

**This closes `bug-120` and, with it, `bug-117`**, which the approver extended rather than closed
because its Expected Behavior is REQ-SEC-06's property and that property does not distinguish the two
mechanisms.

## Acceptance Criteria

**AC1 — reproduce both, on a build from `task-105`'s merged state.** Record exit codes from `$?`
directly, what appears outside the root, and — for the `memory add` case — **whether a commit was
created**, with `git log --oneline -1` and `git show --stat HEAD`. That commit is the worst fact in
this bug and it must be the thing your test pins.

**AC2 — a symlinked target is refused before any write.** `lstat`-shaped: refuse when the target
*itself* is a symlink, on every Memory write path. Not a wider boundary —
**do not real-resolve the leaf.** `bug-044` verified the case that would break: `unlink` on a
symlinked directive file is correct and must stay correct.

**AC3 — the dangling case is covered by the same check.** `existsSync` is false for a dangling link
and `lstat` is not. This is why `requireAbsentTarget` let it through, and it must not be the reason a
second guard lets it through too.

**AC4 — nothing commits when the write is refused.** Pin `git log` unchanged, not only the exit code.
The reviewer's mutation discipline applies: move your check after the write and confirm the
*filesystem and history* assertions red while the message assertion stays green.

**AC5 — the refusal is a mapped `CoreError` at exit 1** (`spec-005` §1), naming the path and that it
is a symlink. No raw git text — `bug-093`'s family.

**AC6 — every Memory write path, and say how you enumerated them.** `task-105` established that the
four transition verbs are write paths but were not callers of the confined resolver; do not assume
its list is complete for *this* check, since the question is different.

**AC7 — the ordinary path is unchanged**, including a genuine file at a genuine path, and including a
symlinked *directory* on the way, which `task-105` already refuses. Characterize both first.

**AC8 — two sentences are now false and one of them is yours to fix.**
`requireConfinedTarget`'s "A path that leaves the project is refused, never written to and never
deleted" is untrue on the write paths. Correct it, and check `src/storage/confinement.ts` for the
justification `task-105`'s review flagged.

## Implementation Notes

- **Cannot start before `task-105` lands.** Same files. Read its Execution Notes (`dl-015`) and its
  review before designing.
- AC1 is measurement; AC2/AC3/AC4 are **red-first**; AC7 is **characterization**.
- **`dl-086` is `in-discussion` and this work is its evidence.** `task-105` proposed there that the
  parent/leaf asymmetry is **verb-dependent** — resolve the parent for a delete, refuse a symlinked
  leaf for a write. Implement that shape and cite the DL; do not amend it, and do not argue a general
  rule in a TSDoc.
- Node's `fs` exposes no `O_NOFOLLOW` on a path-based API, so a TOCTOU window remains between the
  check and the write. `dl-086` names the same limit for the delete path. **Say so where you
  implement it**, and do not present the guard as an adversarial defence.
- **Your fixture writes through a symlink.** Bound it: outside directory inside a second `mkdtemp`,
  assert on what appears there and on `git log`, never on an error string alone.
