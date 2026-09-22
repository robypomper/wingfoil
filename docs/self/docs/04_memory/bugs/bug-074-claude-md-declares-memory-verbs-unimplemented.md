---
id: "bug-074-claude-md-declares-memory-verbs-unimplemented"
type: bug
title: "CLAUDE.md states in three places that the Memory transition verbs have no CLI verb and that task-045..048 are still `backlog`; all seven verbs ship and all four tasks are `done`"
status: open
severity: "high"
release-origin: "v0.2"
release: ""
feature: "P1.6"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`CLAUDE.md` is the entry point every AI agent reads first, and it describes the Memory transition
verbs as unbuilt. §1 lists "**no Memory state-transition verb**" among what is not built; §5's
state-machine paragraph says "no CLI verb drives it yet"; §5.1's block quote says `submit`, `approve`,
`reject` and `deprecate` "have **no CLI verb**", names `task-045`, `task-046`, `task-047` and
`task-048` as "all still `backlog`", and instructs the reader that hand-editing frontmatter is "the
**current** procedure".

All of it is false as of this release. The verbs are registered and shipped.

## Steps to Reproduce

```
$ node dist/cli.js memory --help
Commands:
  add · approve · deprecate · history · reject · search · submit
```

and from the registry itself — `enumerateOperations(CORE_MODULES)` lists `memoryAdd`,
`memoryHistory`, `memorySearch`, `memorySubmit`, `memoryApprove`, `memoryReject`, `memoryDeprecate`,
the last four being exactly the ones §5.1 says do not exist. The four cited tasks:

```
task-045: status: done
task-046: status: done
task-047: status: done
task-048: status: done
```

Read on `main` at `4865a23`. The three stale passages are identified by section — §1's status
block quote, §5's state-machine paragraph, and §5.1's "Performed by hand today" block quote.

## Expected Behavior

The document an agent reads first describes the tool as it is, or says plainly when it was last
reconciled and against what.

## Actual Behavior

An agent starting work today is told to hand-edit frontmatter and hand-write commits for operations
the CLI performs, and is pointed at four tasks as pending work that shipped weeks ago. The instruction
is not merely stale — it is an instruction to do by hand what the tool now does, which is the opposite
of this project's purpose.

## Notes

**This is the successor of `bug-008`, which is `closed`.** That bug was about §1 declaring the project
pre-implementation; this is the same document going stale again, one claim further along, for the same
structural reason: `dl-025-claude-md-ownership` (`in-discussion`) records that **no workflow gate owns
`CLAUDE.md`**. Until something does, every release will leave a new false sentence in it. Filing this
as a fresh bug rather than reopening `bug-008` is deliberate — `bug-008` is closed and the `bug`
machine has no edge out of `closed` — but the pair is the evidence that the general problem is
unowned rather than unlucky.

Graded **high** rather than medium, which is a departure from how the other documentation-staleness
bugs in this release were graded. The reason is the audience: `spec-015` misdescribing the pipeline
misleads a reader consulting it, while this misdirects an agent's *method* on first contact, before
it has any other source to check against. Its cost is paid by every agent, on every task, silently.

The `user-docs` release gate (`dl-013`) owns `README.md`, not this file, so that phase is not the
carrier unless the approver widens it. That is exactly `dl-025`'s open question.

Adjacent: `bug-075-memory-verbs-cannot-read-this-repos-own-memory` — a reader might reasonably
conclude from that bug that the verbs "do not work here" and therefore that CLAUDE.md is right after
all. It is not: the verbs exist and run, they simply cannot be pointed at this repository's own
hand-authored configuration. The two must not be conflated in whatever fixes this.

## Triage & Execution Notes

- triage (2026-09-22): **high**. No gate, test or release step depends on it, so nothing breaks — but
  the failure mode is an agent correctly following an instruction that is wrong, which is the most
  expensive kind of documentation defect this project can have.
- No fix task filed: the text edit is small and well understood, but the question of *who owns this
  file* is `dl-025`'s and should be settled first, or the same sentence will be stale again by v0.3.
