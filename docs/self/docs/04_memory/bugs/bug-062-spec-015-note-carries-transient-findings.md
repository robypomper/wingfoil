---
id: "bug-062-spec-015-note-carries-transient-findings"
type: bug
title: "spec-015's §3 Revision note states two transient defects as current fact, with no element id and nothing scheduled to remove them once they are fixed"
status: planned
severity: "high"
release-origin: "v0.2"
release: "v0.2"
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

The closing paragraph of `spec-015-packaging-publishing`'s *Revision (2026-09-21) — §3 stage 2* note
states three of `task-077`'s findings as present-tense fact about the repository. Two of them —
`npm ci` failing under the pinned npm, and `prepublishOnly` failing on a UTC runner with git ≥ 2.55 —
are transient defects of the current tree, not properties of the design the spec describes. They are
now `bug-056` and `bug-057`, both `planned` for v0.2 with fix tasks `task-080` and `task-081`; when
those land, the paragraph becomes false and nothing brings a reader back to delete it.

## Steps to Reproduce

1. `grep -n "Out of this revision's scope" docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md`
   — one hit, the opening of the paragraph at fault (cited by its own words rather than by a line
   offset, per `dl-075`'s option A; the offset it sat at when this was written was `:232`).
2. Read it as a future reader will: it says stage 1 is "currently unable to complete on a runner",
   naming two specific failures, and cites no element id for either.
3. `grep -n 'bug-05' docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md` — no
   output. The spec names `task-077` and says its findings "are tracked there", but `task-077` is
   `done`, and nothing revisits a done task's notes.

## Expected Behavior

A tech-spec describes the design and the properties that hold of it. Where a current defect bounds a
property the spec itself asserts, the spec may say so — but it must cite the element that tracks the
defect, so that closing the element leads back to the text that has to change.

## Actual Behavior

Two of the three findings are recorded as un-cited present-tense fact, and both are already scheduled
for repair inside the same release. The third — teardown not running on `SIGINT` — belongs where it
is: §3 stage 2 asserts a throwaway per-run work dir and stage 3 asserts the registry is torn down
afterwards, and the `SIGINT` path falsifies the unqualified reading of both. That sentence bounds a
property the spec asserts; it should stay and should cite `bug-059`.

## Notes

Raised by the reviewer of `task-079-spec-015-staging-and-node-floor-corrections` as a non-blocking
finding; recorded in that task's approve commit body (`9305607`) as an owed follow-up, and filed here
because a commit body is not schedulable. The task itself was correct not to re-file F1/F2/F3 — at the
time it wrote the paragraph the ids did not yet exist; they were created by the `task-077` ingest
(`dcfc638`, merged in `fa65c77`).

The proposed edit is two sentences: cut the `npm ci` and `prepublishOnly` clauses, keep the `SIGINT`
qualification, and cite `bug-059` beside it. `dl-047` applies — a tech-spec is edited in place, with
no state change and no `version:` bump — and the edit belongs in a dated Revision note like the two
already in the document, not as a silent deletion.

This is the same decay family as `bug-053` and `bug-054` (a durable document asserting something that
a later change made false) and **not** the family `dl-075` is about: no line offset is involved, and
no citation convention would have prevented it. What would have prevented it is citing the element id
rather than the finding.

## Triage & Execution Notes

- triage (2026-09-21): **low**. The statement is true today and will stay true until `task-080` and
  `task-081` land, so there is no window in which a reader is misled before the fix. The cost is
  deferred, not immediate. No fix task filed: this is a two-sentence editorial edit to one document,
  and the natural carrier is whichever task next amends `spec-015` — or the `user-docs` release gate,
  which is the only unplanned phase that owns documentation. Named here so the carrier is not
  invented later.
- **re-grade (2026-09-22): low → high, and the reason is that the premise of the first triage
  expired.** That triage rested on "the statement is true today". It is not true any more:
  `task-080` and `task-081` landed on 2026-09-21 (merges `ce48681` and `d1aa785`), and `bug-056` and
  `bug-057` are `closed` on reproduced evidence. So an `approved` tech-spec — the one the
  `release-publishing` phase reads — now asserts in the present tense that `npm ci` and
  `prepublishOnly` fail, days before that pipeline is meant to run for real. The window the first
  triage said did not exist is open now.
- This is worth noting beyond this bug: the first triage was correct when written and became wrong
  without anyone touching it, which is the same decay `dl-075` is about, arriving through a triage
  decision rather than through a citation. Nothing re-reads a severity call when the world it was
  based on changes.
- Fix task filed on the approver's instruction (2026-09-22):
  `task-084-fix-spec-015-stale-stage-1-note`, `release: "v0.2"`.
- Blocked on nothing. It can be done at any time, but doing it **before** `task-080`/`task-081` land
  would make the spec silent about a real current limitation, so the right moment is with or after
  those fixes.
