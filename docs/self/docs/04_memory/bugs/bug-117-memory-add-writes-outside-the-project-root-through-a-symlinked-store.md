---
id: "bug-117-memory-add-writes-outside-the-project-root-through-a-symlinked-store"
type: bug
title: "`memory add` writes an element outside the project root when a Memory directory is a symlink — `bug-044`'s crossing, in the store REQ-SEC-06 is actually about"
status: closed
rejection_reason: "Reopened on 2026-09-25 rather than resolved, because what task-105 repaired is the crossing this bug reports and not the behaviour it specifies. Its Expected Behavior is REQ-SEC-06's own property - a write whose destination resolves outside the project root is refused before any file is created - and that property does not distinguish a symlinked store directory from a symlinked document. The directory half holds, verified independently on both memory add and the four transition verbs; the document half does not, because writeFileSync follows a symlinked leaf where unlink acts on it. bug-120 carries that half and task-106 repairs it, and this bug closes when it does. The state is in-progress rather than planned because the work genuinely spans two tasks, one landed and one queued behind it. Nothing here is a fault in task-105, which found the remaining hole against its own finished work and was forbidden by its own acceptance criteria from the remedy that would have closed it."
severity: "high"
release-origin: "v0.2"
release: "v0.2"
feature: "P1.6"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`resolveConfinedMemoryPath` compares **textually**. When a Memory type's directory is a symlink to a
location outside the project root, `memory add` writes the new element there, then fails on `git add`
with a raw, unmapped git message, and records nothing.

Measured by `task-102`'s reviewer:

```
$ ln -s "$OUT" docs/memory/task && git commit -m 'symlink the task store'
$ wingfoil memory add --type task --title "escape probe"
error: Command failed: git … add -- …/docs/memory/task/task-001-escape-probe.md
$ ls "$OUT"     ->  task-001-escape-probe.md          # written OUTSIDE the root
$ git status --short  ->  (empty)                     # nothing records it
```

## Steps to Reproduce

As above, in a throwaway `wingfoil init --template Scrum` repository.

## Expected Behavior

REQ-SEC-06 places the confinement boundary at the project root. A write whose resolved destination is
outside it is refused before any file is created, with a mapped `CoreError` at exit 1 naming the path.

## Actual Behavior

The file is created outside the root, the failure is a leaked git message, and the operator is given
no indication that anything was written anywhere.

## Notes

**This is the same crossing as `bug-044`, in the pillar the requirement names.** `bug-044` was
`directive remove` deleting outside the root; this is `memory add` writing outside it. `task-102`
fixed the first and, in the same pass, extracted the boundary predicate `escapesRoot` that makes the
second cheap.

**The fix is known and the primitive already exists.** `task-102` built `resolveRealPathInRoot`, which
real-resolves a target's **parent** — deliberately not the leaf, so a symlinked file inside a real
directory still behaves — and `escapesRoot`, the single containment predicate.
`resolveConfinedMemoryPath` calls `escapesRoot` today but still compares an **unresolved** path, which
is exactly the comparison that passes for this input.

**A false sentence points the next reader away from the repair**, and is corrected with this filing:
`memory-path.ts`'s TSDoc justifies the textual comparison with "no filesystem answer exists for a path
that does not exist yet". `realpathOfDirectory` was written precisely to answer for a non-existent
tail, and `test/storage/confinement.test.ts` pins it.

**Severity `high`, matching `bug-044` after its re-grade.** It writes rather than deletes, so the loss
is a stray file rather than a lost one — but it crosses the same boundary, in the Memory store, which
is the pillar `REQ-SEC-06` was written for, and `memory add` is a far more ordinary command than
`directive remove`.

**Scheduled into `v0.2` by the approver on 2026-09-25**, which makes it a release blocker: the
release-submit gate's C2 check selects bugs by their `release:` field. The argument is `bug-044`'s
verbatim — publishing puts it in front of people who did not write it — and it applies with more
force here, because `memory add` is the first mutating command most users run. Fix tasks: `task-105` (the store-directory half, complete) and the successor to `bug-120` (the
document-leaf half, outstanding). **This bug does not close until both land** — see the Extension
below.

## Triage & Execution Notes

- triage (2026-09-25): **high**. No default path reaches it — a symlinked Memory directory is a
  deliberate act — but symlinking a store to shared or external storage is a reasonable thing to try,
  and the outcome is a committed-looking operation that wrote somewhere the user never aimed the tool.
- Found by `task-102`'s reviewer while checking whether that task's boundary extraction left its other
  entry point safe. It did not.

## Extension (2026-09-25) — this bug is the requirement, not one of its two mechanisms

The approver ruled on 2026-09-25 that this bug is **not closed** by `task-105`, and is extended
rather than superseded.

**What `task-105` repaired**, verified independently by its reviewer on a build from that branch: a
symlinked store **directory** no longer lets `memory add` write outside the project root, and the
same guard now covers the four Memory **transition verbs** — which were not callers of the confined
resolver at all, and which measurement showed rewriting a planted document in place outside the root
twice before failing. Post-fix each refuses with a mapped `CoreError` at exit 1 and leaves the outside
file byte-identical.

**What remains**, and why it is a different mechanism rather than a gap in that work: `unlink` acts on
a symlink, but `writeFileSync` **follows** it. So the parent-resolved, leaf-unresolved asymmetry that
is correct for a delete is a hole for a write. `bug-120` carries it, with two reproductions measured
on the **fixed** build — including one in which `memory add` through a dangling link writes outside
the root **and commits**, leaving a `wf(task): add` subject in history for an element the repository
does not contain.

**Why the bug stays open rather than closing and reopening as its successor.** What is written above
in *Expected Behavior* is REQ-SEC-06's own property: a write whose destination resolves outside the
project root is refused before any file is created. That property does not distinguish a symlinked
directory from a symlinked document, and it does not hold yet. Closing this on the strength of the
reported reproduction would leave `resolved` meaning "the case someone happened to report is fixed"
in a record that a reader will take to mean "the requirement holds" — which one command falsifies.

**`task-105` is nonetheless complete and is approved on its own terms.** It did what this bug
described and more, found the remaining hole against its own work, and was forbidden by its own AC5
from reaching for the wrong remedy — resolving the leaf, which would refuse the case `bug-044`
verified as safe. The usual `bug.sync_state` close is overridden here deliberately, by the approver,
and this paragraph is the record of that override.

**This bug closes when `bug-120` closes.**
