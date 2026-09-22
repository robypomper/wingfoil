---
id: "task-084-fix-spec-015-stale-stage-1-note"
type: task
title: "Correct spec-015's §3 Revision note, which now states two repaired defects as current fact, and cite the element ids for what genuinely remains"
status: in-progress
release: "v0.2"
priority: "high"
tags: ["v0.2", "documentation", "release", "distribution"]
ref: "bug-062-spec-015-note-carries-transient-findings"
bug: ["bug-062-spec-015-note-carries-transient-findings"]
depends_on: []
tmpl_version: 260703
---

## Description

`spec-015-packaging-publishing` is `approved` and is the document the `release-publishing` phase reads
to know what the pipeline does. The closing paragraph of its *Revision (2026-09-21) — §3 stage 2* note
asserts, in the present tense, that stage 1 is "currently unable to complete on a runner", naming two
specific failures: `npm ci` failing under the npm the workflow's own Node pin installs, and
`prepublishOnly` failing on a UTC runner with git ≥ 2.55.

**Both statements are now false.** They were true when written; `task-080` and `task-081` repaired
them, and `bug-056` and `bug-057` are closed on reproduced evidence. What remains true in that
paragraph is the third statement — that the staging teardown does not run on `SIGINT` — and it
belongs where it is, because §3 stage 2 asserts a throwaway per-run work dir and stage 3 asserts the
registry is torn down afterwards, so the `SIGINT` path bounds a property the spec itself claims.

This is not a deferred tidy-up. A release-relevant, `approved` tech-spec currently misdescribes the
pipeline it governs, days before that pipeline is meant to run for real.

## Acceptance Criteria

- **AC1** — The two repaired clauses are removed from the §3 note. After the change, the spec makes no
  present-tense claim that `npm ci` or `prepublishOnly` fails, anywhere in the document.
- **AC2** — The `SIGINT` teardown statement survives, and cites `bug-059` by id. If `task-083` has
  landed by the time this runs and `bug-059` is closed, the statement must instead be re-tensed to
  describe what was fixed and when, rather than deleted: §3's "throwaway" claim needs the reader to
  know that guarantee once had a hole. Decide from the bug's actual state at execution time, and
  record which case applied.
- **AC3** — Wherever the removed clauses are replaced by a reference, it names element ids
  (`bug-056`, `bug-057`, and their fix tasks), so that a future reader can reach the evidence without
  the prose having to carry it. `grep -n 'bug-05' docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md` must return hits after the change and returns none before it.
- **AC4** — The edit is an in-place amendment per `dl-047`: `status: approved` and every other
  frontmatter field unchanged, no supersede, no `version:` bump (tech-specs carry no `version:`
  field), and the superseded wording survives only as a quotation inside a dated Revision note — the
  shape `task-079` established and the two existing notes in this document already use.
- **AC5** — `dl-075` is respected: any location the new text cites is named by a symbol, heading or
  verbatim quotation plus the commit read at, never a bare `path:line`. Under `dl-075`'s fix-on-touch
  disposition, bare offsets already present **in the paragraphs this task edits** are converted in the
  same change; offsets elsewhere in the document are left alone.
- **AC6** — No source, test, workflow or configuration file is touched. The diff is this task's own
  Memory file, `spec-015`, and `bug-062`.
- **AC7** — Every claim the amended text makes about the current state of the repository is verified
  by a command at execution time, and that command appears in the Execution Notes. In particular, do
  not take this task's own Description on trust: re-read `bug-056` and `bug-057`'s frontmatter and
  confirm they are `closed` before writing that they are.

## Implementation Notes

- The paragraph is found with `grep -n "Out of this revision's scope" docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md` — one hit. Cited by its own words rather than by a line
  offset, per `dl-075`.
- The two existing Revision notes in this document are the model for shape and tone, including how
  each quotes the wording it replaced.
- `bug-062` records the reasoning that produced this task, including why the `SIGINT` sentence is
  treated differently from the other two. Read it before designing.
- This defect is the reason `task-079`'s approve commit (`9305607`) carries an owed follow-up: a
  commit body is not schedulable, which is why the bug and then this task exist.
- Classify each AC per `dl-014`/T1 before writing anything. A documentation task is overwhelmingly
  characterization; do not fabricate a red, and say so plainly.

## Execution Notes

<!-- filled in per phase -->
