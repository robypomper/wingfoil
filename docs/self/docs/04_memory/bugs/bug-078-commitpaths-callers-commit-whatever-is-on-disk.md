---
id: "bug-078-commitpaths-callers-commit-whatever-is-on-disk"
type: bug
title: "`dna set`, the `directive` verbs, `init` and `memory add` commit their target path as it stands on disk, so an unrelated uncommitted edit rides into a `wf(...)` commit"
status: planned
severity: "medium"
release-origin: "v0.2"
release: "v0.2"
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`task-088` made the four **gated Memory verbs** refuse to commit an element carrying uncommitted
modifications they do not own. `commitPaths` has six other callers that were left as they were:
`dna set`, `directive create`, `directive assign`, `directive remove`, `init` and `memory add`. Each
still commits its target path as it stands in the working tree, so an unrelated hand-edit to that
file is absorbed into a commit whose subject describes only the operation performed.

## Steps to Reproduce

Reproduced end to end on a throwaway project on 2026-09-22, against the CLI built from `main` after
`task-088`'s fix.

1. `git init`, `wingfoil init --template scrum`, commit.
2. Append an unrelated comment to `.wingfoil/dna.yaml`. **Do not commit it.**
3. Run `wingfoil dna set name <value>` → exits 0.
4. `git show HEAD` — the commit `wf(dna): set name` contains the appended comment as well as the
   field it set.

The six call sites are `src/core/index.ts` (three), `src/core/directive-assign.ts`,
`src/storage/layout.ts` and `src/memory/entry.ts`; `grep` for `commitPaths` locates them.

## Expected Behavior

The same rule `task-088` established for the gated verbs: a command commits the change it declares,
and either stages only that change or refuses while the target carries modifications it does not own.

## Actual Behavior

Any uncommitted edit to the target file is committed under the command's subject, silently.

## Notes

**Same root cause as `bug-076`, different blast radius — which is why it was filed rather than folded
into `task-088`.** The gated verbs are the ones whose commits are *evidence*: an approval carries an
approver's identity and a reason, and a commit larger than it declares corrupts an audit record.
`dna set` and the `directive` verbs write configuration; a commit larger than it declares there is a
tidiness defect and a confusing diff, not a corrupted attestation. The argument for fixing them is
consistency and the availability of the fix, not equivalence of harm.

`memory add` sits slightly apart from the rest: its target is a new file, so "uncommitted
modifications the command does not own" is a narrower notion there. Establish what it can actually
absorb before assuming the same guard applies.

**The fix pattern already exists and is reusable**: `task-088` added `requireUnmodifiedDocument` and
the committed-tree postcondition `verifyCommittedScope`, both exported from `src/core`. Whoever takes
this should weigh whether applying it uniformly is right, or whether the per-caller answer differs —
`init`, in particular, runs when there may be nothing committed at all.

Not to be conflated with **`bug-079`**, which is the same root cause on the *read* side and is a
release blocker: there an uncommitted `dna.yaml` grants the approval authority a commit then attests
to. This bug is about what a command writes; that one about what it believes.

## Triage & Execution Notes

- triage (2026-09-22): **medium**. No audit record is corrupted, no authority fabricated, and nothing
  in this repository is affected — every configuration change here was made by hand. It is not low
  because the defect is now known, reproduced, and has a ready-made fix sitting in the same codebase.
- No fix task filed. Natural v0.3 work unless the approver wants uniformity before the release.
