---
id: "task-085-retense-spec-015-sigint-sentence"
type: task
title: "Re-tense spec-015's SIGINT teardown sentence once task-083 lands, so the spec stops describing a gap that has been closed"
status: in-review
release: "v0.2"
priority: "medium"
tags: ["v0.2", "documentation", "release", "distribution"]
ref: "bug-062-spec-015-note-carries-transient-findings"
bug: []
depends_on: ["task-083-fix-staging-interrupt-teardown", "task-084-fix-spec-015-stale-stage-1-note"]
tmpl_version: 260703
---

## Description

`spec-015-packaging-publishing` §3 currently states that the staging run's teardown "executes on the
success and failure paths (`runStaging`'s `finally`) but **not** on `SIGINT`". That is true today and
was deliberately kept by `task-084`, which verified that no signal handler is registered anywhere
under `scripts/` and that `bug-059` is not closed.

`task-083-fix-staging-interrupt-teardown` closes exactly that gap. **The moment it merges, the
sentence becomes false** — and the spec will be stale again in the opposite direction from the one
`bug-062` was filed about: it will describe a hole that no longer exists, in the document the
`release-publishing` phase reads.

This task exists because that outcome was foreseen and, on its own, would not have been scheduled.
`task-083`'s Execution Notes identified it and parked it as a *proposed element*; nothing reschedules
a proposal living in a task's notes, which is the precise failure `bug-062` was opened about. Filing
it as a task rather than leaving it in a report is the point.

## Acceptance Criteria

- **AC1** — Run only after `task-083` is `done` and merged into `main`. Verify with
  `git merge-base --is-ancestor` rather than by reading a status field, and record the command. If
  `task-083` has not landed, stop and report — do not describe an unmerged branch as shipped, which
  is the defect `bug-062` covered.
- **AC2** — The sentence is **re-tensed, not deleted**. §3 stage 2 asserts a throwaway per-run work
  dir and stage 3 asserts the registry is torn down afterwards; a reader of those claims needs to
  know the guarantee once had a hole, when it was closed and by what. Deleting it would erase that.
- **AC3** — The new text cites `bug-059` and `task-083` by id, with the commit that closed the bug
  and the merge that landed the task, each verified to be an ancestor of `main` at execution time.
- **AC4** — Describe what the fix actually does, read from `scripts/publish-staging.cjs` as merged —
  not from `task-083`'s notes, not from this task's Description. Whatever signals are handled at that
  point are what the spec says; do not assume the set.
- **AC5** — In-place amendment per `dl-047`: `status: approved` and every other frontmatter field
  unchanged, no supersede, no `version:` bump, and the superseded wording surviving only as a
  quotation inside a dated Revision note — the shape `task-079` established and `task-084` followed.
- **AC6** — `dl-075` respected, with the same boundary `task-084` was given: cite by symbol, heading
  or verbatim quotation plus the commit read at; convert bare offsets only inside the paragraphs this
  task edits, and leave the rest of the document alone. `task-084`'s reviewer noted that the §3 note
  now *names* `README.md:115` when listing what it declined to convert — if that line falls inside an
  edited paragraph, phrase it symbolically instead.
- **AC7** — The diff is this task's own Memory file and `spec-015`. No source, test, workflow or
  configuration file, and no other Memory document.

## Implementation Notes

- Read `task-084`'s Execution Notes first (`dl-015` read_related): it made the same class of edit on
  the same paragraph days earlier, and its approve commit records the AC1-versus-AC4 reasoning about
  keeping superseded wording as a quotation.
- The paragraph is found with `grep -n "Out of this revision's scope"` on the spec — cited by its own
  words rather than by an offset, per `dl-075`.
- `task-084`'s reviewer recorded the two locations that go stale when `task-083` lands. Re-derive them
  yourself rather than trusting that pair; they were read at `307a62a` and the file has changed since.
- Classify each AC per `dl-014`/T1. This is a documentation task: expect characterization throughout,
  and do not fabricate a red.
- `bug:` is deliberately empty. This task closes no bug — `bug-062` is already `closed`, and closing
  it did not depend on this work. It is a successor, not a fix.

## Execution Notes

### design (role: architect)

**Branch / worktree.** `task/task-085-retense-spec-015-sigint-sentence`, worktree
`/home/robypomper/Workspaces/.wf2-wt/task-085`, based on `main` at **`c69a836`**
(`wf(bug): sync bug-059-sigint-leaks-staging-registry-and-token [in-review → resolved → closed]`, the
tip of `main` at start). Every command below was run in this worktree at that base.

**`agent.read_related` (dl-015, HARD gate).** `depends_on: [task-083-fix-staging-interrupt-teardown,
task-084-fix-spec-015-stale-stage-1-note]` — both read in full, plus `task-084`'s approve commit
`225aa26`, before anything was written.

- **`task-084`** (`done`) made the same class of edit on the same paragraph. What it hands over:
  (a) the *shape* — one paragraph corrected in place inside an earlier dated note, plus a new
  `**Revision (YYYY-MM-DD) — §N …:**` note that quotes the superseded wording **in full** as a
  blockquote, `dl-047` mechanics stated at the end; (b) the settled resolution of "no present-tense
  stale claim" versus "the superseded wording must survive" — the blockquote is the one place both
  hold, because it is introduced as what the paragraph *previously read* under a header saying the
  finding has been repaired; (c) the reason this task exists at all: `task-084` deliberately did
  **not** describe `task-083`'s fix, because at the time it lived only on an unmerged branch, and
  described-as-shipped would have been `bug-062`'s defect pointed the other way. Its approve commit
  `225aa26` records both the AC1-versus-AC4 reasoning and the two carry-overs: the `README.md:115`
  meta-mention (flagged, explicitly *not* an AC5 breach) and the filing of this task.
- **`task-083`** (`done`) is the change this task describes. Its Execution Notes were read — and are
  deliberately **not** the source for AC4. Per this task's AC4 the fix is described from
  `scripts/publish-staging.cjs` **as merged**; the notes were read only to know where to look and to
  learn that the task was rejected once (`8937a51`) and resubmitted, so its first-submission shape is
  not the shipped one. See the AC4 read-out below, which contradicts the task's own AC list on the
  signal set.

**`agent.verify_specs`.** The artefact amended is itself an existing, `approved` tech-spec; no new
`tech-spec` is scaffolded, so `design` passes through without an approver gate (dev-loop plan §3.2).

```
$ grep -H '^status:' docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md
…/spec-015-packaging-publishing.md:status: approved
```

**AC1 — the precondition, verified by ancestry and not by a status read.** Run first, before any
other work:

```
$ for c in de92e2b e58b758 c69a836; do \
    git merge-base --is-ancestor $c main && echo "$c on main: $(git log -1 --format=%s $c)"; done
de92e2b on main: Merge branch 'task/task-083-fix-staging-interrupt-teardown'
e58b758 on main: wf(task): finalize task-083-fix-staging-interrupt-teardown [approved → done]
c69a836 on main: wf(bug): sync bug-059-sigint-leaks-staging-registry-and-token [in-review → resolved → closed]

$ grep -H '^status:' docs/self/docs/04_memory/v0.2/task-083-fix-staging-interrupt-teardown.md \
                     docs/self/docs/04_memory/bugs/bug-059-sigint-leaks-staging-registry-and-token.md
…/task-083-fix-staging-interrupt-teardown.md:status: done
…/bug-059-sigint-leaks-staging-registry-and-token.md:status: closed
```

All three commits are ancestors of `main`; `task-083` is `done` and `bug-059` is `closed`. The
briefing that scheduled this run asserted the same thing, and the assertion held — but the ancestry
check is what the spec text is written against, because a `status:` field is a claim in a file while
`merge-base --is-ancestor` is a property of the history the reader can re-run.

**AC4 — the signal set, read from the source and not from any summary.** The set is a named constant
in the merged script, so it is quotable rather than inferable:

```
$ grep -n 'TEARDOWN_SIGNALS = ' scripts/publish-staging.cjs     # at main c69a836
69:const TEARDOWN_SIGNALS = Object.freeze(['SIGINT', 'SIGTERM', 'SIGHUP']);
```

**Three signals, not the two `task-083` was asked for.** Its own acceptance criteria name `SIGINT`
(AC1) and `SIGTERM` (AC2) and never mention `SIGHUP`:

```
$ sed -n '/## Acceptance Criteria/,/## Implementation Notes/p' \
    docs/self/docs/04_memory/v0.2/task-083-fix-staging-interrupt-teardown.md | grep -c 'SIGHUP'
0
```

So `SIGHUP` is coverage the implementer added beyond the task, and the constant's own doc comment
gives its reason (a closed terminal or dropped SSH session leaks identically, with nobody present to
notice). Had this task described the set from `task-083`'s Description or ACs — or from the briefing
— it would have shipped a spec that under-states what the code guarantees. The same comment records
what is deliberately **out**: `SIGKILL` (POSIX forbids catching it), `SIGQUIT` (its contract is
terminate-and-dump-core, so a non-graceful exit is correct rather than a gap) and `SIGUSR1` (reserved
by node for the inspector).

The rest of the mechanism, read at the same commit: `installTeardownHandlers` puts one handler per
signal on `process`; the handler awaits the **same memoised `teardown`** that `runStaging`'s `finally`
awaits (`teardownRun ??=`), absorbs a second signal instead of racing a second stop-and-delete, and
then calls `raiseSignal`, which removes the handler and re-sends the signal to the process so the run
dies **by** the signal (`128 + N`; 130 for `SIGINT`) rather than reporting a normal exit carrying that
number. Teardown itself removes the token, stops the registry, removes the work dir — in that order,
so the credential is the shortest-lived artefact of a run.

**What of that belongs in an approved spec, and what does not.** Two candidate facts were weighed
against §3's altitude — §3 states a *pipeline contract*, not an implementation:

- **In.** That coverage now has **no window in time**: a signal arriving while the registry is still
  coming up tears that registry down too. This is a statement about the guarantee, and §3 is the
  document that claims a throwaway work dir (stage 2) and a registry torn down afterwards (stage 3);
  an orphan on `:4873` falsifies stage 3's claim for every later run. Written as the guarantee, not
  as the mechanism — the `onSpawn` callback that closes the window structurally (rather than by
  widening a timeout) is named in the script's own comment and stays there.
- **Out.** That the teardown's completion line is now derived from the steps it actually performed
  instead of asserting a fixed sentence. This is a real improvement and it is why `task-083` was
  rejected once — the fixed sentence claimed "registry stopped" in the one case where no registry had
  been stopped — but §3 makes no claim whatsoever about what a staging run **prints**. Putting an
  operator-facing log format into an approved pipeline spec would invent a contract the spec does not
  have and freeze a message that is free to change. It stays in the script and in `task-083`'s notes.

**Where the edit goes — re-derived, not taken from `task-084`'s reviewer.** The document has changed
since that reading (`307a62a`); exactly one commit touched it, `task-084`'s own:

```
$ git log --oneline 307a62a..main -- docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md
148cb4c docs(self): task-084 — spec-015 §3: drop the two repaired stage-1 claims, keep the SIGINT bound citing bug-059, add the dated Revision note

$ grep -n 'bug-059' docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md
237:…read as **not closed** at `main` `307a62a`; this          → L1, live prose (§3 stage 2 note)
306:…read as **not closed** at `main` `307a62a`.                → L2, live prose (§3 stage 1 note)
309:…Whatever commit closes `bug-059` is free to re-tense       → L2, same paragraph
```

Two live locations, plus a third occurrence that must **not** be touched — the superseded wording
`task-084` preserved as a blockquote. Note the Implementation Notes' locator now matches twice:

```
$ grep -n "Out of this revision's scope" docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md
232:*Out of this revision's scope, recorded so §3 is not read as a statement that the pipeline runs
278:> *Out of this revision's scope, recorded so §3 is not read as a statement that the pipeline runs
```

The live paragraph is the one **without** the `> ` blockquote prefix. The second is history and is
left byte-identical: re-tensing a quotation of what a document used to say would destroy the record
the dated-revision convention exists to keep.

L2 is edited only by **appending one sentence** to its "The third clause **stays**" paragraph. Its
existing statements are dated readings that carry their own expiry ("read as **not closed** at `main`
`307a62a`", "at the time of writing exists only on the unmerged branch"), so they do not become false
— but that paragraph is the one that explicitly delegates the future work ("Whatever commit closes
`bug-059` is free to re-tense the sentence into history"), and this run is that commit. A reader who
reaches the delegation and finds no answer would have to search. Nothing of `task-084`'s reasoning is
rewritten.

**`dl-075` boundary.** Cite by symbol, heading or verbatim quotation plus the commit read at; convert
bare offsets **only** inside the paragraphs this task edits. The three paragraphs touched (L1, L2's
one appended sentence, and the new note) contain **no** `path:line` offsets to convert — the new text
cites element ids, note headings, and the symbols `TEARDOWN_SIGNALS`, `installTeardownHandlers`,
`raiseSignal` and `runStaging`'s `finally` with their file and the commit read at. The offsets
standing elsewhere are deliberately left alone, including the `README.md:115` meta-mention
`task-084`'s reviewer flagged: it sits in the **closing** paragraph of the *§3 stage 1* note, not in
the "The third clause **stays**" paragraph this task appends to, so under AC6's own boundary ("if
that line falls inside an edited paragraph, phrase it symbolically instead") it is out of scope. It is
reported as a proposed element instead of being fixed silently.

**`agent.classify_acs` (T1, dl-014 + `testing` directive).** All seven ACs are **characterization**;
**none is red-first**, and **no test is added by this task**.

| AC | Class | Why |
|---|---|---|
| AC1 | characterization | A precondition on repository history, settled by `git merge-base --is-ancestor` against a tree this task does not change. There is nothing to make fail. |
| AC2 | characterization | A property of the document's text after the edit — the sentence survives, re-tensed — read by `grep`/diff. |
| AC3 | characterization | Same: the ids and commits appear in the text, and each commit's ancestry is re-checked by command. |
| AC4 | characterization | A reading of `scripts/publish-staging.cjs` as merged, transcribed into prose. No behaviour is added, so nothing can be driven red. |
| AC5 | characterization | `dl-047` in-place amendment — asserted by the absence of a frontmatter hunk in the diff. |
| AC6 | characterization | `dl-075` citation shape in the edited paragraphs — a reading of the new text. |
| AC7 | characterization | Scope of the diff — `git diff --name-only`. |

There is no behaviour here to drive red: this task changes prose in one Memory document and its own
Memory file. Per `dl-014`/T1 and the `testing` directive, fabricating a red or adding dead code to
force one is prohibited, and a unit test asserting the presence of a sentence in an approved spec
would be dead weight the moment the sentence is legitimately reworded — the same conclusion
`task-084` reached on the same document. `refactor`'s `tests.passing` / coverage / `docs.api.*` /
`lint.clean` gates are satisfied by a diff touching no file those gates read; they are **re-run**,
not skipped, and their output is recorded below.

**Design conclusion.** One paragraph re-tensed in place (L1), one sentence appended to L2, one new
dated Revision note appended to *Process Notes* quoting the superseded wording in full; `dl-047`
mechanics — `status: approved` and every other frontmatter field untouched, no supersede, no
`version:` bump. Diff limited to `spec-015` and this task's own Memory file (AC7); `bug:` is empty, so
no `bug.sync_state` commit is emitted.

### red (role: developer) — no test written; that is the T1 classification, not a shortcut

Every AC is characterization (table above), so `red`'s `tests.failing(for: red-first ACs)` check is
vacuous: the set of red-first ACs is empty. **No test file is created and no failure is
manufactured.** The subject of this task is the wording of one approved document; there is no
behaviour to drive, and `task-083` already carries the tests for the behaviour being described
(`test/cli/publish-staging.test.ts`, run below as part of the suite).

What `red` does instead is take the **baseline measurement** on the untouched spec, so the after-state
in `green` is a comparison rather than an assertion — the guard against this release's top rejection
cause, a claim about a file's state made without running the command that settles it. At `main`
`c69a836`, `S=docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md`:

```
$ grep -n 'not closed' $S
237:…`bug-059-…`, read as **not closed** at `main` `307a62a`; this   # L1 — the stale claim
306:…`bug-059-…`, read as **not closed** at `main` `307a62a`.        # L2 — the stale claim

$ grep -c 'task-083' $S
1                          # one mention, and it says "the unmerged branch of task-083"

$ grep -n 'SIGTERM\|SIGHUP\|SIGKILL' $S ; echo "exit=$?"
exit=1                     # the document knows only about SIGINT; it under-states the guarantee

$ grep -c 'Revision (2026-' $S
8                          # existing dated note headers, the shape the new note must match
```

### green (role: developer) — the amendment

Three edits to `spec-015-packaging-publishing.md`, all inside *Process Notes*. Nothing else in the
document is touched; §3's normative body (stages 1–4) is left byte-identical, because the hole was
never in what §3 *contracts* — stage 2 always meant a throwaway work dir and stage 3 always meant the
registry comes down — it was in whether the implementation delivered that on every path. The notes
carry the history; the contract stayed the contract.

**1. L1 — the closing paragraph of the *Revision (2026-09-21) — §3 stage 2* note, re-tensed in
place.** The `SIGINT` sentence **survives** (AC2), moved to the past ("executed … but **not** on
`SIGINT`, which left …"), and the clause that followed it now says the bug is `closed`, names
`task-083-fix-staging-interrupt-teardown` as what closed it, and forward-references the new note —
the same forward-reference shape the note's stage-1 clause already uses. The italic lead-in changed
from "recorded so §3 is not read as a statement that the pipeline runs today" to "recorded so §3's
'throwaway' claim keeps the history of how it came to hold", because the original lead-in was itself
a present-tense caveat about a pipeline that no longer has the defect.

**2. L2 — one sentence appended** to the "The third clause **stays**" paragraph of the
*Revision (2026-09-22) — §3 stage 1* note, answering the succession that paragraph delegates
("Whatever commit closes `bug-059` is free to re-tense the sentence into history"): it names the merge
`de92e2b` and the close `c69a836` and points at the new note. Nothing else in that paragraph is
rewritten — its two dated readings ("read as **not closed** at `main` `307a62a`", "at the time of
writing exists only on the unmerged branch") are honest statements about a named commit and stay as
`task-084` wrote them, now immediately followed by what happened next.

**3. A new `**Revision (2026-09-22) — §3 interrupt teardown:**` note appended** after the *§3 stage 1*
note, in the shape the document's existing notes use: bold dated header naming the section and the
reason with its element ids; the superseded wording quoted **in full** as a blockquote; what closed
the gap with the commits and how that was checked; what the pipeline now guarantees; what was
deliberately left out; why re-tensed rather than deleted; the `dl-075` boundary; the `dl-047`
mechanics sentence.

The blockquote is verbatim, verified mechanically rather than by eye — the quoted block, with line
wrapping normalised, is a substring of the paragraph as it stood at `HEAD` before the edit:

```
$ python3 - <<'EOF'   # (full script in the green commit's diff review; result only here)
… flat(blockquote) in flat(old paragraph) …
EOF
quote flat in old-para flat: True
```

**AC4 — what the new note says the fix does, and where each claim was read.** Every bullet is a
reading of `scripts/publish-staging.cjs` at `main` `c69a836`, cited in the note by symbol rather than
offset: `TEARDOWN_SIGNALS` (the set: `SIGINT`, `SIGTERM`, `SIGHUP`, plus the stated exclusions
`SIGKILL`/`SIGQUIT`/`SIGUSR1`), `installTeardownHandlers` (one handler per signal, awaiting the same
memoised teardown as `runStaging`'s `finally`), `raiseSignal` (the run dies *by* the signal, `128 + N`,
130 for `SIGINT`), and teardown's own ordering (token first, then registry, then work dir). The
no-window property — an interrupt during registry startup still tears that registry down instead of
orphaning `:4873` — is stated as a **guarantee**, which is §3's altitude; the `onSpawn` callback that
achieves it structurally is not named, and neither is the change that makes the completion line report
the steps actually performed. The note says in its own text that both were left out and why, so a
later reader does not mistake the omission for ignorance of them.

**AC7 — the two pieces of evidence that the edit is in-place (`dl-047`), measured:**

```
$ git diff -U0 -- docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md \
    | grep -E '^[+-](id|type|title|status|scope|supersedes|release|contributor|credit|tmpl_version):'
exit=1                         # no frontmatter line added or removed: status: approved untouched,
                               # supersedes: "" untouched; tech-specs carry no version: field
$ git diff -U0 -- …spec-015… | grep '^+' | grep -nE '[A-Za-z0-9_./-]+\.(md|cjs|ts|json|yaml|yml):[0-9]+'
exit=1                         # dl-075: no bare path:line offset in any added line
```

**After-state, against the `red` baseline:**

```
$ grep -n 'not closed' $S
309:…read as **not closed** at `main` `307a62a`.      # L2's dated reading, kept, now answered 3 lines on
346:> …read as **not closed** at `main` `307a62a`; this  # the blockquote — history, must not be re-tensed

$ grep -c 'task-083' $S
8                              # was 1 ("the unmerged branch of task-083")

$ grep -n 'SIGTERM\|SIGHUP\|SIGKILL' $S
361,364,376,383                # was 0 hits: the document now states the whole covered set and the
                               # one case that is not covered, instead of only SIGINT

$ grep -c 'Revision (2026-' $S
12                             # was 8
```

### refactor (role: developer) — gates run, not waived

Nothing to refactor in prose, so `refactor` here is the quality gates. They were **run** in this
worktree at `7cf21be`, not waived on the grounds that the diff is documentation:

| Gate | Command | Result |
|---|---|---|
| `tests.passing` | `npx jest` | exit 0 — **106 suites / 1726 tests passed** |
| `tests.coverage(min: 80)` | `npx jest --coverage` | exit 0 — `All files 98.58 % stmts / 92.58 % branch / 98.81 % funcs / 99.18 % lines` |
| typecheck (build) | `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| typecheck (full, `bug-026` surface) | `npx tsc --noEmit -p tsconfig.json` | exit 0 — no output |
| `lint.clean` (`dl-034`) | `npm run lint` | exit 0 |
| `docs.api.build` | `npm run docs:api` | exit 0 (TypeDoc, no warnings) |
| `docs.api.public-complete` | `test/docs/` inside the suite above | passed with the suite |

Coverage is non-regressing by construction: no file under `src/` is in the diff.

**Sync with `main` before submit (`dl-035` — merge, never rebase):**

```
$ git log --oneline -1 main
c69a836 wf(bug): sync bug-059-sigint-leaks-staging-registry-and-token [in-review → resolved → closed]
$ git merge main
Already up to date.
```

`main` has not moved since this branch was cut, so no cited sentence could have gone stale between
the reading and the submit; the gates above were already run against that tree.

### review (role: reviewer) — AC-by-AC close-out

`tests.bdd.run`: this task has no BDD `.feature` of its own — it amends the prose of a tech-spec, and
no scenario under `docs/02_requirements/02_bdd/features/` describes the text of `spec-015`. The
repository's acceptance suites run as part of `npx jest` above (106 suites / 1726 tests, exit 0), so
the gate is satisfied and nothing was skipped; inventing a scenario to have something to point at
would be the fabricated red `dl-014`/T1 forbids.

| AC | Status | Evidence |
|---|---|---|
| AC1 | met | `git merge-base --is-ancestor` on `de92e2b`, `e58b758` and `c69a836` — all ancestors of `main`; commands and output in the `design` section. `task-083` `done` and `bug-059` `closed` were read too, but as corroboration, not as the check. Nothing had changed, so the run proceeded. |
| AC2 | met | The `SIGINT` sentence survives in L1, in the past tense, with what closed the gap named beside it; the superseded present-tense wording survives in full as the new note's blockquote, verified a substring of the pre-edit paragraph. Nothing was deleted. |
| AC3 | met | The new note cites `bug-059-sigint-leaks-staging-registry-and-token` with its close commit `c69a836` and `task-083-fix-staging-interrupt-teardown` with its merge `de92e2b`, and states in its own text that both were confirmed ancestors of `main` before it was written. L1 and L2 carry the same two ids. |
| AC4 | met | Signals read from `TEARDOWN_SIGNALS` in `scripts/publish-staging.cjs` at `main` `c69a836` — `SIGINT`, `SIGTERM`, `SIGHUP`. **This contradicts `task-083`'s own ACs**, which name only the first two; `SIGHUP` was added by the implementer. Had the set been taken from the task, the briefing or this task's Description, the spec would now under-state the guarantee. The mechanism bullets likewise come from `installTeardownHandlers`, `raiseSignal` and `runStaging`'s teardown, not from `task-083`'s notes. |
| AC5 | met | `git diff -U0` carries no frontmatter line at all for the spec (`grep` above, exit 1): `status: approved` and `supersedes: ""` untouched, no supersede, and tech-specs carry no `version:` field. The superseded wording exists only inside the dated note's blockquote. |
| AC6 | met | No added line contains a `path:line` offset (`grep` above, exit 1); citations are element ids, note headings and four symbols with their file and the commit read at. The pre-existing `README.md` and `dl-001` offsets are byte-identical — the `README.md` meta-mention sits in the *§3 stage 1* note's **closing** paragraph, not in the one this task appends to, so it is outside AC6's boundary and is reported as a proposed element instead of fixed silently. |
| AC7 | met | Two files in the diff: `spec-015-packaging-publishing.md` and this task's Memory file. No source, test, workflow or configuration file, and no other Memory document; `bug:` is empty, so no `bug.sync_state` commit exists. |

**Judgement calls a reviewer should look at first.** (a) The decision to state the *no-window*
property (an interrupt during registry startup) in the spec while leaving out both the `onSpawn`
mechanism that delivers it and the steps-derived completion message: the line drawn is
guarantee-versus-implementation, and §3 makes no claim about the script's call shape or its output.
(b) The one-sentence append to L2 rather than leaving that paragraph wholly untouched: its statements
were dated readings that do not become false, but the paragraph explicitly delegates this succession,
and an unanswered delegation makes a reader search. (c) L2 still reads "`bug-059` … **not closed** at
`main` `307a62a`" three lines above the appended sentence saying it has since closed — deliberate,
because that is what the *§3 stage 1* revision recorded at the commit it recorded it at, and rewriting
it would edit history rather than extend it.

**Nothing is left in these notes for a later reader to action.** The single out-of-scope finding
(the `README.md` offset carried in prose by the *§3 stage 1* note) is in the final report as a
proposed element, not parked here — a `done` task's Execution Notes are not a schedule, which is the
whole reason this task exists.

### review-ready summary

`spec-015-packaging-publishing` no longer describes the staging teardown's `SIGINT` hole as open. The
sentence was **re-tensed, not deleted**: it survives in the past tense in the *§3 stage 2* note beside
the ids that closed it (`bug-059`, `closed` at `c69a836`; `task-083`, merged at `de92e2b`, both
verified ancestors of `main`), its superseded present-tense wording survives verbatim inside a new
dated *Revision (2026-09-22) — §3 interrupt teardown* note, and that note states what the shipped
script actually guarantees — teardown on `SIGINT`, `SIGTERM` and `SIGHUP` as read from
`TEARDOWN_SIGNALS`, the same memoised teardown the `finally` runs, death *by* the signal at `128 + N`,
no window during registry startup, and `SIGKILL` as the one uncoverable case with the token removed
first because of it. `SIGHUP` is in that list because the code says so and `task-083`'s acceptance
criteria do not. `dl-047` in-place mechanics hold by diff (no frontmatter hunk), `dl-075` holds in
both directions (no offset added, none elsewhere disturbed), and the diff is two Memory files. All
gates green at `7cf21be`: 106 suites / 1726 tests, coverage 98.58 % statements, both typechecks, lint
and TypeDoc all exit 0.
