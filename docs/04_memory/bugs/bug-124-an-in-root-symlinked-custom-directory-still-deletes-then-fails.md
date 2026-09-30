---
id: "bug-124-an-in-root-symlinked-custom-directory-still-deletes-then-fails"
type: bug
title: "A `directives/custom` symlinked to somewhere else *inside* the project still unlinks the file first and fails afterwards — `bug-044`'s order of operations, below its confinement boundary"
status: planned
severity: "low"
release-origin: "v0.2"
release: "v0.3"
feature: "P3.5"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`task-102` made `directive remove` refuse when the target resolves **outside** the project root.
`bug-044` bounds itself to that case in its own title and Summary. When `directives/custom` is a
symlink to another directory **inside** the root, the old behaviour is unchanged: the file is
unlinked, and only then does the command fail.

Measured by `task-102` with `custom` → `.wingfoil/elsewhere`:

```
$ wingfoil directive remove legacy-rule
error: Command failed: git … add -- …                     exit 1
$ git status --short
 D .wingfoil/elsewhere/legacy-rule.md                      # deleted, then reported
```

## Steps to Reproduce

As above, in a throwaway `wingfoil init --template Scrum` repository.

## Expected Behavior

A command that cannot complete does not leave the working tree changed — the check precedes the
mutation whether or not the target crosses the confinement boundary.

## Actual Behavior

Inside the root, the unlink still happens first and the failure is git's own raw text.

## Notes

**Milder than `bug-044`, and not the same defect.** The file is tracked, so `git checkout --` recovers
it, and nothing leaves the project. What survives is the *order* — delete, then discover you could not
finish — and the unmapped git error, which is `bug-071`/`bug-093`'s family.

**Widening the confinement check would be the wrong mechanism**, and `task-102` said so: this is not a
boundary crossing, so `requireConfinedTarget` has nothing to refuse. What actually refuses it is git's
own rule that a path beyond a symlink cannot be staged — which the command discovers only after it has
acted.

**Filed late, and the reason is worth recording.** `task-102` proposed it, its reviewer confirmed it
verbatim including the ` D` line afterwards, and it was not registered at the time. The wave brief
directs proposals into an agent's **final report** rather than into its task document, so an
unregistered proposal disappears with the session — which is how this one and `bug-122` were both
nearly lost.

## Triage & Execution Notes

- triage (2026-09-25): **low**. Recoverable with one git command, inside the project, and reachable
  only through a deliberate symlink. Filed because the ordering is the same one `task-102`'s reviewer
  proved is the acceptance criterion rather than the message.
