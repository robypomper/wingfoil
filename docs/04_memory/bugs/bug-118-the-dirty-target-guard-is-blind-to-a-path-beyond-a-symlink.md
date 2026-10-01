---
id: "bug-118-the-dirty-target-guard-is-blind-to-a-path-beyond-a-symlink"
type: bug
title: "`requireUnmodifiedTarget` passes any path beyond a symlink, modified or not, because `git status --porcelain` reports nothing for it and the guard treats empty as clean"
status: in-review
severity: "medium"
release-origin: "v0.2"
release: "v0.3"
feature: "P5.1"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`dl-080`'s write guard refuses an operation whose target carries modifications it does not own. It
decides that from `git status --porcelain -- <path>`, and short-circuits on
`if (porcelain === '') return coreOk(undefined)`.

For a path that lies **beyond a symlink**, git reports nothing at all — `git ls-files` carries only
the symlink blob, never what it points at. So the guard sees an empty string and reads it as *clean*,
when it means *invisible*.

Measured by `task-102`'s reviewer:

```
$ git status --porcelain -- .wingfoil/directives/custom/legacy-rule.md
[empty]
$ printf 'modified\n' > "$OUT/legacy-rule.md"
$ git status --porcelain -- .wingfoil/directives/custom/legacy-rule.md
[empty]
```

Modified and unmodified are indistinguishable, and both pass.

## Steps to Reproduce

As above, with `.wingfoil/directives/custom` a symlink to a directory outside the repository.

## Expected Behavior

A guard that cannot see a target refuses, or says it cannot see it. "No output" and "no modifications"
are different answers and must not collapse into one.

## Actual Behavior

They collapse into `coreOk`.

## Notes

**This outlives `task-102`'s fix, which is why it is filed rather than absorbed.** That task added a
confinement check to `directive remove`, and the guard has **six other call sites**. None of them is
protected by the new check, and any target reachable through a symlink is invisible to all of them.

**The two rules answer different questions and neither substitutes for the other** — `task-102`
recorded that correctly, as a justification for adding its own check. What it did not do is note that
the guard's own blind spot is a defect in the guard.

**The fix is a distinction, not a stricter rule.** `pathPorcelainStatus` must be able to say "I have
nothing to report about this path" separately from "this path is clean" — the first should refuse, or
at minimum route to a message saying the target cannot be inspected. A blanket refusal on empty output
would break every clean-target case, which is the common one.

**`dl-080` is `ready` and does not contemplate this.** Its write half assumes the target is a path git
can see. Whether the decision needs amending, or only the implementation, is worth settling when this
is scheduled.

## Triage & Execution Notes

- triage (2026-09-25): **medium**. No shipped path is known to be exploited by it today, and
  `bug-117`/`bug-044` are the crossings that actually caused harm. It is not `low` because it is a
  *guard* that reports safe when it is blind, across seven call sites, and a guard that fails open is
  worth more attention than one that fails closed.
- Found by `task-102`, recorded there as a justification; filed here at its reviewer's insistence,
  because a justification is not an owner.
