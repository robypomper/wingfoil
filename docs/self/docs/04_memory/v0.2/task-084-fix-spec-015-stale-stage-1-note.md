---
id: "task-084-fix-spec-015-stale-stage-1-note"
type: task
title: "Correct spec-015's §3 Revision note, which now states two repaired defects as current fact, and cite the element ids for what genuinely remains"
status: in-review
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

### design (role: architect)

**Branch / worktree.** `task/task-084-fix-spec-015-stale-stage-1-note`, worktree
`/home/robypomper/Workspaces/.wf2-wt/task-084`, based on `main` at **`307a62a`**
(`wf(task): approve task-084-fix-spec-015-stale-stage-1-note [pending → backlog]`). All evidence
below was taken in this worktree at that base.

**`agent.read_related` (dl-015).** `depends_on: []` — no upstream task's Execution Notes to load.
Nothing to acknowledge; the hard gate is satisfied vacuously.

**`agent.verify_specs`.** The artefact this task amends is itself an existing, `approved` tech-spec
(`spec-015-packaging-publishing`); no new `tech-spec` is scaffolded, so `design` passes through
without an approver gate (dev-loop plan §3.2). `tech-spec.approved` holds:

```
$ grep -n '^status:' docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md
5:status: approved
```

**`agent.classify_acs` (T1, dl-014 + `testing` directive).** All seven ACs are
**characterization**; **none is red-first**, and **no test is added by this task**.

| AC | Class | Why |
|---|---|---|
| AC1 | characterization | A property of document text. Settled by `grep`, which runs against the file as it stands before and after — nothing new to make fail. |
| AC2 | characterization | Same: the surviving sentence plus a `bug-059` citation, checked by `grep`. The branch of AC2 taken is decided from `bug-059`'s frontmatter, not from code. |
| AC3 | characterization | The AC states its own check (`grep -n 'bug-05' …` returns none before, hits after). That "none before" is a *measurement of the starting state*, not a fabricated red: no artefact was created to produce it. |
| AC4 | characterization | `dl-047` in-place amendment — asserted by diffing frontmatter, which is unchanged by construction. |
| AC5 | characterization | `dl-075` citation shape in the edited paragraphs — a reading of the new text. |
| AC6 | characterization | Scope of the diff — `git diff --stat`. |
| AC7 | characterization | Requires commands to be *run and recorded*; it is satisfied by this section, not by a test. |

This is a documentation task, so the honest statement is the plain one: there is no behaviour to
drive red. `red` adds no test and manufactures no failure — per `dl-014`/T1 and the `testing`
directive, fabricating a red or adding dead code to force one is prohibited, and the AC3 "returns
none before" grep is a baseline reading of the untouched document, not a red. `refactor`'s
`tests.passing` / `tests.coverage` / `docs.api.*` / `lint.clean` gates are satisfied by the diff
touching no file those gates read (AC6); they are re-run, not skipped.

**AC7 — every claim re-verified at execution time. The task's own Description was not taken on
trust.** Commands and their output, all at `main` `307a62a`:

```
$ grep -H '^status:' docs/self/docs/04_memory/bugs/bug-056-npm-ci-fails-under-pinned-npm-10-9.md \
                     docs/self/docs/04_memory/bugs/bug-057-timestamp-assertions-reject-zulu-offset.md \
                     docs/self/docs/04_memory/bugs/bug-059-sigint-leaks-staging-registry-and-token.md
…bug-056-npm-ci-fails-under-pinned-npm-10-9.md:status: closed
…bug-057-timestamp-assertions-reject-zulu-offset.md:status: closed
…bug-059-sigint-leaks-staging-registry-and-token.md:status: planned

$ grep -H '^status:' docs/self/docs/04_memory/v0.2/task-080-fix-npm-ci-under-pinned-npm.md \
                     docs/self/docs/04_memory/v0.2/task-081-fix-timestamp-offset-assertions.md \
                     docs/self/docs/04_memory/v0.2/task-083-fix-staging-interrupt-teardown.md
…task-080-fix-npm-ci-under-pinned-npm.md:status: done
…task-081-fix-timestamp-offset-assertions.md:status: done
…task-083-fix-staging-interrupt-teardown.md:status: backlog

$ for c in fdee8cb 65021c2 ce48681 d1aa785; do git merge-base --is-ancestor $c main && echo "$c on main"; done
fdee8cb on main   # wf(bug): sync bug-056… [in-review → resolved → closed]
65021c2 on main   # wf(bug): sync bug-057… [in-review → resolved → closed]
ce48681 on main   # Merge branch 'task/task-080-fix-npm-ci-under-pinned-npm'
d1aa785 on main   # Merge branch 'task/task-081-fix-timestamp-offset-assertions'
```

So both clauses AC1 names are stale on reproduced evidence, and the ids AC3 requires exist and are
reachable.

**AC2 — which case applied, and why. Case one: `bug-059` is NOT closed, so the sentence stays and
cites `bug-059` by id.** Measured, not assumed:

```
$ grep -n '^status:' docs/self/docs/04_memory/bugs/bug-059-sigint-leaks-staging-registry-and-token.md
5:status: planned
$ git merge-base --is-ancestor task/task-083-fix-staging-interrupt-teardown main \
    && echo "on main" || echo "NOT an ancestor of main"
NOT an ancestor of main
$ git show task/task-083-fix-staging-interrupt-teardown:docs/self/docs/04_memory/bugs/bug-059-sigint-leaks-staging-registry-and-token.md | grep -n '^status:'
5:status: in-review
```

`task-083-fix-staging-interrupt-teardown` is in review on its own unmerged branch, and `bug-059`
reads `in-review` there — but `planned` on `main`, and `in-review` is not `closed` on either. Under
**both** readings the AC2 re-tense branch is not reached. The spec is therefore amended to say the
`SIGINT` hole is **still open**, citing `bug-059`, with the commit the reading was taken at, so the
claim carries its own expiry rather than decaying silently (the failure mode `dl-075` describes and
`bug-062`'s own re-grade note demonstrates).

Deliberately **not** written into the spec: anything about what `task-083` changed. Its fix exists
only on an unmerged branch; describing it in an `approved` spec as if it were on `main` would
reintroduce exactly the defect this task removes, in the opposite direction. When `task-083` merges,
`bug-059` closes and whatever carries that close is free to re-tense this sentence — which is the
point of citing the id instead of the symptom.

**AC5 — `dl-075` fix-on-touch boundary.** The paragraph this task rewrites is located by its own
words, per its own Implementation Notes:

```
$ grep -n "Out of this revision's scope" docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md
232:*Out of this revision's scope, recorded so §3 is not read as a statement that the pipeline runs
```

That paragraph contains **no** `path:line` citation of any kind, so fix-on-touch has nothing to
convert in it; the new text it is replaced by, and the new Revision note, cite element ids, headings
(`spec-015` §3 stage 1 / stage 2), a symbol (`runStaging`'s `finally`) and commit hashes — never a
bare offset. Left alone on purpose, because they sit outside the paragraphs this task edits: the
offsets elsewhere in the document — `README.md:115` (§1 bullet and the *§1 Node floor* note) and
`dl-001:37-42` / `dl-001`'s `:19`, `:35` (also the *§1 Node floor* note). Converting those would turn
a two-sentence correction into a document-wide rewrite of an approved spec, which AC5 and this task's
approve commit both forbid.

**Design conclusion.** One paragraph rewritten in place, one dated Revision note appended in the
shape the document's two existing notes use (quoting the wording it replaces), `dl-047` mechanics —
`status: approved` and every other frontmatter field untouched, no supersede, no `version:` bump.
Diff limited to this file, `spec-015` and `bug-062` (AC6).

### red (role: developer) — no test written, and that is the classification, not a shortcut

Every AC is characterization (T1 table above), so `red`'s `tests.failing(for: red-first ACs)` check
is vacuous: the set of red-first ACs is empty. **No test file is created and no failure is
manufactured** — there is no behaviour here, only the text of one document, and a test asserting the
absence of a sentence in a prose document would be dead weight the moment the sentence is reworded.

What `red` does instead is take the **baseline measurement** the ACs are stated against, on the
untouched document, so that the after-state in `green` is a comparison rather than an assertion
(this is the guard against the release's top rejection cause — claiming a file's state without
running the command that settles it):

```
$ S=docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md
$ grep -n 'bug-05' $S ; echo "exit=$?"
exit=1                                   # AC3 baseline: no element id in the document

$ grep -nE 'currently unable to complete' $S
233:today:* `task-077`'s first real execution found §3 **stage 1** currently unable to complete on a
                                         # AC1 baseline: the stale claim, one hit

$ grep -c 'Revision (2026-' $S
6                                        # AC4 baseline: the existing note headers to match in shape
```

### green (role: developer) — the amendment

Two edits to `spec-015-packaging-publishing.md`, both inside the *Process Notes* section, plus the
two Memory state commits recorded elsewhere in this log.

**1. The closing paragraph of the *Revision (2026-09-21) — §3 stage 2* note, rewritten in place.**
It keeps the `SIGINT` clause and drops the two repaired ones. It now names
`bug-059-sigint-leaks-staging-registry-and-token` explicitly, states the commit the bug's state was
read at (`main` `307a62a`), and forward-references the new note — the same forward-reference shape §1
already uses for the *§1 Node floor* note. `runStaging`'s `finally` gains its file
(`scripts/publish-staging.cjs`) so the symbol is findable without a path guess; it is still a symbol
citation, not an offset.

**2. A new `**Revision (2026-09-22) — §3 stage 1:**` note appended after the *§1 Node floor* note**,
in the shape the document's existing notes use: a bold dated header naming the section and the reason,
the superseded wording quoted **in full** as a blockquote, then what replaced it and why, then the
`dl-047` mechanics sentence. It cites `bug-056`/`bug-057` with their close commits (`fdee8cb`,
`65021c2`) and `task-080`/`task-081` with their merges (`ce48681`, `d1aa785`).

**AC1 vs AC4 — the one apparent conflict, and why there is none.** AC1 asks that no present-tense
claim of `npm ci`/`prepublishOnly` failure survive; AC4 *requires* the superseded wording to survive
as a quotation. The quotation is the one place both are satisfiable at once: it is a blockquote,
introduced by "That paragraph previously read, in full:", inside a note whose header says the
failures "have been repaired". The document no longer asserts those failures in its own voice. The
remaining `npm ci` / `prepublishOnly` hits outside the quotation are checked one by one:

```
$ grep -n -E 'npm ci|prepublishOnly' docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md
 26  … no `prepublishOnly`, no `--dry-run` gate           → §Context, what main LACKED before task-059
 86  - `prepublishOnly`: `npm run build && npm test …`    → §2, the script's definition
 96  1. **build + gate** — `npm ci`, then `prepublishOnly` → §3 stage 1, the pipeline's own design
150  (`prepublishOnly`, `publish:staging`, …)             → §Consequences, a list of contracted names
280  > runner — `npm ci` fails under the npm …            → the AC4 blockquote (superseded wording)
281  > `prepublishOnly` fails on a UTC runner …           → the AC4 blockquote (superseded wording)
291  - **`npm ci` failing under the pinned npm** … now `closed`   → the bug's name, marked closed
295  - **`prepublishOnly` failing on a UTC runner …** … now `closed` → the bug's name, marked closed
```

Nothing outside the blockquote asserts a failure. The two bullet labels were deliberately reworded
from "`npm ci` under the pinned npm" to the gerund "`npm ci` **failing** under the pinned npm" so each
reads as the name of a past defect rather than as a claim, and each is closed by "now `closed`" in the
same clause.

**AC3 after the change:**

```
$ grep -n 'bug-05' docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md | wc -l
7        # was 0 before (red baseline above); bug-056, bug-057 and bug-059 all reachable by id
```

### refactor (role: developer) — gates run, not waived

No refactor step applies to prose, so `refactor` here is purely the quality gates. They were **run**,
not assumed away on the grounds that the diff is documentation: a doc-only claim is exactly the kind
this release keeps rejecting. `npm ci --no-audit --no-fund` first (the worktree starts without
`node_modules`), then, in this worktree at `148cb4c`:

| Gate | Command | Result |
|---|---|---|
| `tests.passing` | `npm test` | exit 0 — **106 suites / 1714 tests passed** |
| `tests.coverage(min: 80)` | `npm run test:coverage` | exit 0 — `All files 98.58 % stmts / 92.58 % branch / 98.81 % funcs / 99.18 % lines` |
| `docs.api.build` | `npm run docs:api` | exit 0 (TypeDoc, no warnings emitted) |
| `docs.api.public-complete` | covered by `test/docs/` inside `npm test` | passed with the suite |
| `lint.clean` (`dl-034`) | `npm run lint` | exit 0 |
| (extra) full typecheck | `npx tsc --noEmit` | exit 0 — the `bug-026` surface is still clean |

Coverage is non-regressing by construction: no file under `src/` is in the diff.

**AC6 — diff scope, measured:**

```
$ git diff --name-only main...HEAD | grep -v '^docs/self/docs/04_memory/'   # exit 1: no hits
$ git diff --stat main...HEAD
 …/bugs/bug-062-spec-015-note-carries-transient-findings.md |   2 +-
 …/design/specs/spec-015-packaging-publishing.md            |  72 ++++++-
 …/v0.2/task-084-fix-spec-015-stale-stage-1-note.md         | … ++++++-
```

Three Memory files. No source, test, workflow or configuration file — the `bug-062` line is its
`status:` sync, which `dev-loop`'s `bug.sync_state` owns.

### review (role: reviewer) — AC-by-AC close-out

`tests.bdd.run`: this task has no BDD `.feature` of its own — it amends a tech-spec, and no scenario
under `docs/02_requirements/02_bdd/features/` describes the text of `spec-015`. The repository's
acceptance suites are run as part of `npm test` (the `refactor` table above: 106 suites / 1714 tests,
exit 0), so the gate is satisfied and nothing was skipped; there is simply no task-specific scenario
to add, and inventing one to have something to point at would be the fabricated red `dl-014`/T1
forbids.

| AC | Status | Evidence |
|---|---|---|
| AC1 | met | The §3 note's closing paragraph no longer names either failure. The full `grep` audit of every surviving `npm ci` / `prepublishOnly` hit is in the `green` section: four are the pipeline's own design text, two are the AC4 blockquote, two are bug names marked `closed`. |
| AC2 | met — **case one** | `bug-059` is `planned` on `main` and `in-review` on the unmerged `task/task-083-fix-staging-interrupt-teardown`; not `closed` under either reading, so the sentence stays and cites the bug by id. Commands in the `design` section. `task-083`'s fix is deliberately not described. |
| AC3 | met | `grep -n 'bug-05' …` → 0 hits before, **7** after, covering `bug-056`, `bug-057`, `bug-059`, each with its fix task and the commit that carries it. |
| AC4 | met | `git diff` shows no frontmatter line changed: `status: approved`, `supersedes: ""` and the rest are untouched; tech-specs carry no `version:` field; the superseded wording survives only as the blockquote in the dated note. |
| AC5 | met | New text cites ids, headings and `runStaging`'s `finally`; the edited paragraph carried no offsets to convert. `README.md:115` and the `dl-001` offsets elsewhere in the document are left standing on purpose — the boundary the AC and the approve commit both draw. |
| AC6 | met | Three Memory files, nothing else (`git diff --name-only main...HEAD` audit above). |
| AC7 | met | Every state claim re-derived from frontmatter and `git merge-base` in this worktree at `main` `307a62a`, commands and outputs inline. The task's own Description was re-checked, not trusted, and it held. |

**Nothing is left in these notes for a later reader to action.** The one judgement this run made that
a future change must revisit — the `SIGINT` sentence's tense — is not parked here: it is written into
`spec-015` itself, beside the `bug-059` id that will carry it, because a `done` task's Execution Notes
are not a schedule.
