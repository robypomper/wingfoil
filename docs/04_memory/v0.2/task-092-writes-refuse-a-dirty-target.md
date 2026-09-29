---
id: "task-092-writes-refuse-a-dirty-target"
type: task
title: "Make the non-transition verbs refuse a target carrying modifications they do not own, per dl-080's ratified write rule"
status: done
release: "v0.2"
priority: "medium"
tags: ["v0.2", "core", "audit-trail"]
ref: "dl-080-which-baseline-each-command-reads"
bug: ["bug-078-commitpaths-callers-commit-whatever-is-on-disk"]
depends_on: ["task-088-fix-gated-verbs-commit-only-the-status-change"]
tmpl_version: 260703
---

## Description

`dl-080` is ratified as option **(B)**: reads resolve at `HEAD`, and **a write refuses while its
target carries modifications the command does not own**. `task-088` landed that half for the four
gated Memory verbs. `commitPaths` has six other callers that were deliberately left alone —
`dna set`, `directive create`, `directive assign`, `directive remove`, `init` and `memory add` — and
each still commits its target as it stands in the working tree, so an unrelated uncommitted edit rides
into a `wf(...)` commit whose subject describes only the operation performed.

Reproduced: an uncommitted comment appended to `.wingfoil/dna.yaml` was committed by
`wf(dna): set name`.

Declared a release blocker for `minor-v0.2` alongside the rest of the class, though it is the mildest
of the five: no audit record is corrupted and no authority fabricated — the commit says what it did,
it just also says something it did not.

## Acceptance Criteria

- **AC1** — Reproduce first, on a scratch project against current `main`, with the commands in the
  notes. `bug-078` gives the shape; re-derive it (`bug-075` — a scratch project is required).
- **AC2** — Each of the six callers refuses when its target carries modifications it does not own,
  exiting **`1`** per `spec-005` §1 and naming what is modified. `task-088` added
  `requireUnmodifiedDocument` and the committed-tree postcondition `verifyCommittedScope`, both
  exported from `src/core`; reuse them rather than writing a second mechanism.
- **AC3** — **Two callers are not like the others and must be argued, not assumed.**
  - `memory add` writes a **new** file, so "modifications the command does not own" is a narrower
    notion — establish what it can actually absorb before applying the guard.
  - `init` runs when there may be **nothing committed at all**, and may legitimately write into a
    tree that is dirty by construction. If the uniform rule breaks it, say so and scope it out with
    the reason recorded.
- **AC4** — The ordinary flows still work, pinned by tests: `dna set` on a clean tree, `directive
  create`/`assign`/`remove` on a clean tree, `init` in a fresh repository, `memory add` after another
  element was edited but not committed.
- **AC5** — A test pins the defect for at least `dna set` and one `directive` verb, failing against
  the current code.
- **AC6** — All six gates green; the full `tsc --noEmit -p tsconfig.json` silent.

## Implementation Notes

- Read `task-088`'s Execution Notes first (`dl-015` read_related): it established the guard, the
  refuse-versus-partial-stage argument, and the reason it stayed **per-path** — an unrelated dirty
  file cannot ride in anyway, because `commitPaths` uses `git commit --only -- <path>` (`bug-027`).
  That is why this task is about the *target* being dirty, not the tree.
- `task-091` runs in parallel on the **read** half. It touches the Memory state-machine load and the
  directive role-catalogue check; this task touches the commit path. Do not enter its worktree and do
  not fix its bugs.
- Classify every AC per `dl-014`/T1. AC1, AC2 and AC5 are red-first by construction.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). -->

### start — role: developer

`status: backlog → in-progress` (`36beb24`). `bug:` is non-empty, so `bug.sync_state` ran as its own
commit: `bug-078` `planned → in-progress` (`5b7d51e`).

Worktree `/home/robypomper/Workspaces/.wf2-wt/task-092`, branch
`task/task-092-writes-refuse-a-dirty-target`, from `main` at `eca728e`.
`npm ci --prefer-offline --no-audit --no-fund` → exit 0.

### design — role: architect

Directives loaded: architecture, determinism, traceability (architect); code-quality, testing,
determinism (developer); doc-versioning, documentation, security-secrets (global).

#### `read_related` (`dl-015`, HARD gate)

- **`task-088-fix-gated-verbs-commit-only-the-status-change` (`done`) — Execution Notes read in
  full**, the only entry in `depends_on`. What I took from it, and what I therefore did **not**
  re-litigate:
  1. **The refuse-versus-partial-stage argument is settled and is not reopened here.** task-088's
     `design` § "AC2 — the decision" rejects partial staging on three measured grounds: there are
     two candidate baselines on disk (index and worktree) and "commit only the hunk" does not say
     onto which; a partial commit leaves the residue invisible and deferred; and a refusal is paid
     immediately by the person who caused it. `dl-080` has since ratified exactly that as option
     (B). I inherit the conclusion.
  2. **Why the guard is per-path and not per-tree.** `commitPaths` commits with
     `git commit --only -- <paths>` (`bug-027`), so an unrelated dirty file cannot ride in anyway —
     re-measured here as R6a, where `wingfoil init` in a repository with two untracked user files
     left both untracked. The defect is therefore about the *target*, never the tree, and the same
     narrowness is what keeps AC4's "`memory add` after another element was edited but not
     committed" working.
  3. **The exit code is `1`, and it is already ruled.** task-088 § "AC2's exit code" reads
     `spec-005-cli-command-contract` § "1. Exit-code contract (REQ-INT-04)": `2` is a malformed
     *invocation*, `1` covers "validation failure, git operation failure". A dirty target is a
     repository-state precondition, not a mistyped command line. `bug-076` closed on that ruling.
     Every refusal added here is a `CoreResult.error` with `code: 'VALIDATION'`, which
     `exitCodeForError` maps to `1`.
  4. **The shared mechanism, and its shape.** `requireUnmodifiedDocument` (private,
     `src/core/memory-transition.ts`) and `verifyCommittedScope` (exported from `src/core`) are
     composed from five primitives that are already shared: `pathPorcelainStatus`, `readPathAtRev`,
     `commitParent`, `changedPathsBetween` (`src/storage/commit.ts`) and `describeDocumentChanges`
     (`src/memory/frontmatter-edit.ts`). How this task reuses them is argued under "Reuse" below.
  5. **A measurement gotcha reused.** task-088 records that `execFileSync` + `catch` reads back
     `stderr: ''` for a command that exits `0` while printing to fd 2, so its CLI-level test uses
     `spawnSync`. The CLI integration test here does the same.
- **`bug-078-commitpaths-callers-commit-whatever-is-on-disk` (source bug, `in-progress`) — read in
  full.** Its "Notes" pre-flag both AC3 cases (`memory add`'s target is new; `init` may run with
  nothing committed) and decline to settle them, which is what AC3 hands to this task.
- **`dl-080-which-baseline-each-command-reads` (`ready`) — read in full, including the `Reason:` of
  its approve commit `333a3c0`.** The ratified sentence is: "a read that gates an operation resolves
  against the repository as committed at HEAD, and **a write refuses while its target carries
  modifications the command does not own**". The `Reason:` also states what this ratification does
  **not** do — it does not reopen `bug-076` or `bug-079` — and that the three open instances are to
  be "fixed UNDER this rule rather than one at a time". This task is the `bug-078` instance; it
  touches neither of the fixed ones.
- **`task-091` (read half) and `task-093` (`src/dna/`) run in parallel.** Neither worktree was
  entered. Files not touched here: `src/core/loaders.ts`, `src/memory/loaders.ts`,
  `src/memory/state-machine.ts`, `src/dna/**`, `src/memory/entry.ts`. The one shared file is
  `src/core/index.ts` (brief rule 7); additions there are five one-line guard calls plus one export
  line. See "Merge contention" below.

#### `verify_specs`

No new `tech-spec` and no amendment to an approved one. The rule this task enforces is already
written down — `dl-080`'s ratified (B), recorded in that document's approve commit — and
`spec-005-cli-command-contract` § "1. Exit-code contract (REQ-INT-04)" already fixes the exit code
this refusal uses. Nothing here widens a ratified contract.

> `dl-080` Action 4 asks that the ruling be "written where an implementer meets it — a directive, or
> `spec-002`/`spec-008` — not only here". That is a governance artefact, not a code change, and no AC
> of this task carries it. Raised as a proposed element rather than performed, per brief rule 2.

#### AC1 — the defect, reproduced end to end before anything was changed

`bug-075` — the verbs cannot be pointed at this repository's own Memory — so every run below is on a
throwaway project under the session scratchpad, against `dist/` built from this branch's base
(`npm run build`, exit 0, at `5b7d51e` = `main` `eca728e` + the two `start` commits, no `src/`
change). Re-derived from `bug-078`'s recipe rather than pasted.

```
$ git init -q . && git config user.name 'Test User' && git config user.email 'test@example.test'
$ node dist/cli.js init --template scrum        # exit 0; git status --porcelain -> clean
```

**R1 — `dna set` (the shape `bug-078` reports).**

```
$ printf '\n# UNRELATED UNCOMMITTED COMMENT — never mentioned by any commit subject\n' >> .wingfoil/dna.yaml
$ git status --porcelain -- .wingfoil/dna.yaml
 M .wingfoil/dna.yaml
$ node dist/cli.js dna set project.name 'Renamed'      # exit 0
$ git log -1 --format='%s'
wf(dna): set project.name
$ git diff HEAD~1 HEAD -- .wingfoil/dna.yaml
-  name: ""                        # your project name
+  name: Renamed                   # your project name
+
+# UNRELATED UNCOMMITTED COMMENT — never mentioned by any commit subject
```

**R2 — `directive assign` (the same shape on `roles.yaml`).**

```
$ printf '\n# UNRELATED UNCOMMITTED COMMENT in roles.yaml\n' >> .wingfoil/roles.yaml
$ node dist/cli.js directive create --name beta       # exit 0
$ node dist/cli.js directive assign --directive beta --role developer   # exit 0
$ git diff HEAD~1 HEAD -- .wingfoil/roles.yaml
+    - beta
+
+# UNRELATED UNCOMMITTED COMMENT in roles.yaml
```

**R3 — `directive remove` destroys uncommitted work instead of absorbing it.** A different harm from
the same root cause, and worth naming because the commit itself is *accurate*:

```
$ node dist/cli.js directive create --name gamma
$ printf '\nIMPORTANT UNCOMMITTED PARAGRAPH the author has not saved anywhere else.\n' \
    >> .wingfoil/directives/custom/gamma.md
$ node dist/cli.js directive remove gamma             # exit 0
$ git log --all -S 'IMPORTANT UNCOMMITTED PARAGRAPH' --oneline
(no output — the paragraph reached no commit anywhere)
```

Staging a deletion discards the working-tree blob, so nothing *rides in*; the author's edit is simply
gone. The ratified rule covers it either way — the target carried modifications the command did not
own — and refusing is what preserves the edit.

**R4 — `directive create` produces a commit whose diff contradicts its subject.** `documentExists`
refuses a target that is present, so the reachable case is a target deleted in the working tree but
still at `HEAD`:

```
$ node dist/cli.js directive create --name delta
$ printf '\nHAND-WRITTEN BODY the author added to delta.\n' >> .wingfoil/directives/custom/delta.md
$ git add … && git commit -q -m 'chore: author delta body'
$ rm .wingfoil/directives/custom/delta.md            # uncommitted deletion
$ node dist/cli.js directive create --name delta      # exit 0
$ git log -1 --format='%s'; git diff --stat HEAD~1 HEAD
wf(directive): create delta
 .wingfoil/directives/custom/delta.md | 2 --
 1 file changed, 2 deletions(-)
```

A commit that says **create** and records **two deletions**.

**R5b — `memory add`, the narrow case (AC3's first half; see the argument below).**

```
$ node dist/cli.js memory add --type adr --title 'X'          # -> adr-001-x
$ printf '\n## Decision\n\nHAND-WRITTEN content the author spent an hour on.\n' >> docs/memory/adr/adr-001-x.md
$ git add … && git commit -q -m 'chore: author adr-001 content'
$ rm docs/memory/adr/adr-001-x.md                    # uncommitted deletion
$ node dist/cli.js memory add --type adr --title 'X'  # exit 0, id adr-001-x again
$ git diff HEAD~1 HEAD -- docs/memory/adr/adr-001-x.md
-## Decision
-
-HAND-WRITTEN content the author spent an hour on.
```

`wf(adr): add adr-001-x` is a commit that *removes* three lines of an existing document.

**R6 — `init` (AC3's second half; the three measurements that decide it).**

```
# R6a — nothing committed at all, tree dirty by construction
$ git init -q .; echo 'work in progress' > README.md; mkdir src; echo 'const x = 1;' > src/app.ts
$ git status --porcelain
?? README.md
?? src/
$ node dist/cli.js init --template scrum              # exit 0, creates the ROOT commit
$ git status --porcelain
?? README.md
?? src/                                               # user work untouched (bug-027's --only)

# R6b — .wingfoil/ already holds a hand-written file
$ mkdir .wingfoil && echo '# hand-written' > .wingfoil/dna.yaml
$ node dist/cli.js init --template scrum
error: WingFoil already initialized (use a migration command to change config)   # exit 1

# R6c — do any scaffold paths lie outside .wingfoil/ ?
$ git show --name-only --format='' HEAD | grep -cv '^\.wingfoil/'
0
```

#### AC3 — the two callers that are not like the others

**`memory add` — what it can actually absorb, established rather than assumed.**

Its target is a *new* file, so "modifications the command does not own" is not "the target is dirty";
the target is normally absent. Tracing `memoryAddFn` (`src/core/index.ts`) shows the only way an
unowned change can reach its commit: the id is `generateId(id_pattern, {slug, n})` where `n` comes
from `nextSequenceNumber` (`src/memory/add.ts`), which is `readdirSync(dir)` counting entries that
match the id pattern, **plus one**. That counter is derived from the working tree, so whenever the
working tree disagrees with `HEAD` about how many elements exist, a freshly generated id can land on
a path that already holds content. There is no existence check before `writeMemoryEntry` — the write
is unconditional — so the commit's diff becomes `HEAD` → scaffold rather than absent → scaffold.
R5b is that path, walked end to end.

So the notion that fits `memory add` is **absence, not cleanliness**: the guard is that the target
path must not exist at `HEAD`, in the index, or in the working tree. It is strictly stronger than
"unmodified" and strictly narrower in what it forbids — it says nothing about any other element,
which is precisely AC4's "`memory add` after another element was edited but not committed".

Two consequences stated rather than smuggled:

- The rule also refuses the case where the colliding path is **clean and tracked** (a gap in the
  sequence — `adr-001-x.md` and `adr-003-y.md` present, `adr-002-*` absent, so the next id is
  `adr-003-…`). That is the same rule, not a second fix, and refusing is right: `memory add`
  overwriting a committed element is never correct. But the *root* cause there is the sequence
  counter, which this task does not repair. Raised as a proposed element.
- It also refuses writing over an **untracked** draft at the target path, which today is silently
  clobbered.

**`init` — scoped out for `wingfoil init`, applied to the one init path that is not covered.**

The uniform rule does not break `init`; on the CLI path its condition is **unreachable**, and adding
a guard there would be code no test can reach through the command. Two measured facts make it so:
`detectInitState` (`src/storage/init-state.ts`) returns `'initialized'` when `.wingfoil/` holds any
entry at all, and `initWingfoilProject` refuses on that before any write (R6b); and every path
`templateScaffold` writes is under `.wingfoil/` (R6c). So when the write runs, `.wingfoil/` is empty
or absent and no target path can pre-exist. R6a confirms the other half of the worry — a tree that is
dirty *by construction*, with no commits at all, is not affected, because `commitPaths` bounds the
commit by pathspec (`bug-027`).

`src/storage/layout.ts`'s `initStorage` has a **second** caller, though, and it is not covered by
that argument: `initWingfoilStorage` (`src/core/init.ts`), the library entry point exported from
`src/core`, runs no `detectInitState` check at all and will overwrite an existing
`.wingfoil/dna.yaml`. It is not wired to the CLI or to MCP (`src/cli/init-command.ts` uses
`initWingfoilProject`; `CORE_MODULES` registers neither), but it is public API, so the guard goes
there. What it does *not* repair is the missing already-initialized check that makes
`initWingfoilStorage` asymmetric with `initWingfoilProject` in the first place — a clean, committed
`.wingfoil/dna.yaml` is still overwritten, because the target is clean. That asymmetry is a distinct
defect; raised as a proposed element rather than fixed here (brief rule 3).

#### Reuse — one mechanism, two artefact shapes

`requireUnmodifiedDocument` is private and typed on `PreparedMemoryTransition`; `verifyCommittedScope`
delegates its content half to `verifyDocumentEdit`, which compares *declared frontmatter fields* and a
body. Neither is applicable verbatim to `dna.yaml` or `roles.yaml`, which carry no frontmatter block
at all — measured: `splitFrontmatter('version: 1\n…')` → `{frontmatter: null}`, and
`describeDocumentChanges` then reports `['the body']` for a YAML config file, which reads wrong.

So the reuse is at the level task-088 itself established: a new `src/core/write-guard.ts` composes
the *same five primitives*, and `requireUnmodifiedDocument` is re-expressed as a call into it so
there is one gate rather than two. What varies between the two call sites is the refusal's wording
and the artefact-shaped description, both passed in. `verifyCommittedScope` keeps its signature and
its behaviour; the path half it is built from is factored into `verifyCommittedPaths`, which the
config verbs use with a byte-equality check instead of a frontmatter check.

#### T1 — AC classification (`dl-014`, `testing` directive)

| AC | Class | Evidence for the class |
|---|---|---|
| **AC1** — reproduce first | **process gate, not testable** | The AC1 section above, run against the base build before any `src/` edit. Its durable form is AC5's tests. |
| **AC2** — the callers refuse, exit `1`, naming what is modified | **red-first** | Measured red: R1–R5b all exit `0` today and all commit the unowned content. `grep -rn "pathPorcelainStatus" src/` → 2 hits, both inside `src/core/memory-transition.ts`'s gated-verb guard; no other write path consults git status at all. |
| **AC3** — `memory add` and `init` argued, not assumed | **design obligation + red-first for its outcome** | The argument is the section above. Its testable half: `memory add`'s absence guard is red-first (R5b exits `0` today); `init`'s scope-out is pinned by AC4's characterization test that `wingfoil init` in a fresh dirty repository still succeeds, and by a red-first test on `initWingfoilStorage`, which absorbs today. |
| **AC4** — the ordinary flows still work | **characterization** | Every one of them passes on the current code (R1–R6 all ran the happy path first to set the scene). Fabricating a red for them would mean asserting they are broken, which the `testing` directive forbids. |
| **AC5** — a test pins the defect for `dna set` and one `directive` verb, failing today | **red-first** | Same evidence as AC2. `directive assign` is the chosen `directive` verb: it is the exact analogue of `dna set` (a config file whose unrelated uncommitted edit rides in), where `remove`/`create` show the two other faces (R3, R4) and are covered as well. |
| **AC6** — six gates green, full `tsc` silent | **process** | Run at `refactor`/`review`. |

**Gate state:** `frontmatter.required` (`title`, `release`) present; `depends_on.acknowledged`
satisfied (`task-088` above); `tech-spec.approved` — no new or amended spec, so nothing pending.
`design` passes through with no approver gate.

### red — role: developer

Commit `5ea305c`. Two new suites, no change to any existing one:

- **`test/core/write-guard-dirty-target.test.ts`** — every one of the six callers, driven through the
  REAL registered `CORE_MODULES` operations against throwaway repositories carrying the real
  `wingfoil init` Scrum scaffold. It carries both halves deliberately: the nine refusals, and ten
  characterization cases pinning the ordinary flows **and** the guard's per-path narrowness (an
  unrelated dirty file must never block a write — `dl-080`'s rejected option (D)).
- **`test/cli/dirty-target-refusal.integration.test.ts`** — the two things only the process boundary
  shows: the exit code a script keys on and the stderr a human reads, through the compiled
  `dist/cli.js`. `spawnSync`, per `task-088`'s measurement gotcha, with the reason recorded in the
  file's TSDoc so the next reader does not "simplify" it back.

Observed red, before any `src/` change:

```
$ npx jest test/core/write-guard-dirty-target.test.ts test/cli/dirty-target-refusal.integration.test.ts
Test Suites: 2 failed, 2 total
Tests:       9 failed, 10 passed, 19 total
```

The nine, one per red-first case — and note that all ten characterization cases passed on that same
first run, which is what makes them characterization rather than fabricated reds:

| Red case | Caller |
|---|---|
| `dna set` on a dirty `dna.yaml` exits 1 … (CLI) | `dna set`, process boundary |
| refuses, exits 1, names the file and what is modified | `dna set` |
| refuses, exits 1, names `roles.yaml` | `directive assign` |
| does not turn a "create" into a commit that deletes content | `directive create` |
| refuses, exits 1, leaves the uncommitted paragraph on disk | `directive remove` |
| refuses a target that is clean and tracked | `memory add` |
| refuses a target still at HEAD but deleted in the working tree | `memory add` |
| refuses to clobber an UNTRACKED draft at the target path | `memory add` |
| the one init path with no already-initialized guard refuses | `initWingfoilStorage` |

Two first-draft cases were **fixture** bugs rather than reds and were corrected before the commit, so
the red count above is the honest one: `git status --porcelain` names the untracked *directory*
(`?? docs/`) when nothing under it is tracked, and a `commitAll` with nothing staged makes git exit
non-zero.

### green — role: developer

Commit `4b8428c`. One new module and five call sites.

| What | Where |
|---|---|
| `requireUnmodifiedTarget` (edit-in-place targets), `requireUnmodifiedTargets`, `requireAbsentTarget` (create targets), `undeclaredCommittedPaths`, `verifyCommittedPaths`, `committedScopeError`, `WriteTargetContract` / `CONFIG_WRITE_CONTRACT` | **new** `src/core/write-guard.ts`, exported from `src/core` |
| `requireUnmodifiedDocument` re-expressed as one call into `requireUnmodifiedTarget` with a `TRANSITION_CONTRACT`; `verifyCommittedScope`'s path half taken from `undeclaredCommittedPaths` | `src/core/memory-transition.ts` |
| `dna set` — guard before the load, post-condition after the commit | `src/core/index.ts` |
| `directive create` / `directive remove` — guard + post-condition | `src/core/index.ts` |
| `memory add` — `requireAbsentTarget` on the resolved confined path, + post-condition | `src/core/index.ts` |
| `directive assign` — guard before the read, post-condition after the commit | `src/core/directive-assign.ts` |
| `initWingfoilStorage` — guard 4, over the very scaffold list it is about to write | `src/core/init.ts` |
| `pathPorcelainStatus` switched from `runGit` to `probeGit` | `src/storage/commit.ts` |

Design points worth naming:

- **The gate is shared, the wording is not.** `requireUnmodifiedDocument`'s message is reproduced
  byte-for-byte through a `WriteTargetContract` (`noun`/`owner`/`records`), so `task-088`'s shipped
  refusal is unchanged while there is now one answer in the codebase to "is this target modified".
- **Why a `describeTargetChanges` wrapper exists.** `describeDocumentChanges` reports frontmatter
  fields and the body. `dna.yaml`/`roles.yaml` have no frontmatter block, so `splitFrontmatter` puts
  the whole file in `body` and the reporter says `['the body']` for a YAML config file — measured, not
  assumed (`node -e` against `dist/`). Those get `'the file content'`; directive documents, which do
  carry frontmatter, keep the field-level detail.
- **The guard runs before the *read*, not merely before the write,** in `dna set` and `directive
  assign`. Placing it after the load would leave the refusal's own inputs coming from the dirty copy.
- **`memory add` resolves its target path twice, deliberately.** The guard must run before the write,
  and `writeMemoryEntry` resolves the path internally; `resolveConfinedMemoryPath` is pure, so calling
  it once more in `memoryAddFn` costs nothing and leaves that throwing storage primitive's contract
  untouched. A confinement escape still throws `StorageError` from the same call, so the existing
  `IO` mapping and its ordering are unchanged.
- **One measured side-fix: `pathPorcelainStatus` now uses `probeGit`.** `git status --porcelain --
  <path>` exits **0** and answers correctly, but writes `warning: could not open directory '<dir>/':
  No such file or directory` to stderr when an intermediate directory of the pathspec is absent —
  routine for a guard asking about a file that does not exist yet, and it surfaced immediately in the
  `initWingfoilStorage` run. Reproduced in a scratch repo before changing anything (the warning fires
  when the pathspec's *parent* exists but an intermediate directory does not, and not when the whole
  prefix is absent). `probeGit` is exactly `task-088`'s answer to git diagnostics reaching a user's
  terminal next to the CLI's own message; a non-zero exit still raises through `execFileSync`.

Full suite after green: `npx jest` → **118 suites, 1854 tests passed**, exit 0. No existing test
changed, and none broke.

### refactor — role: developer

Commit `a638775`. No behaviour added; the coverage the green step owed.

- **`test/core/write-guard-committed-paths.test.ts`** exercises `verifyCommittedPaths`,
  `committedScopeError`, `requireUnmodifiedTarget` and `requireAbsentTarget` **directly**, on
  hand-made commits — an extra path, a missing declared path, committed bytes that differ from what
  was written, a removal that did not remove, a root commit against git's empty tree — rather than
  only through the verbs they guard. `task-088`'s precedent, for its reason: with the guard in place
  no argument to a verb can reach the alarm, so an indirect test could only assert that it stays
  silent.
- **The alarm is reachable, and the test that reaches it is realistic.** A repository-local
  `pre-commit` hook that appends to the target and re-stages it runs *inside* `git commit`, after
  `requireUnmodifiedTarget` has certified the tree clean and after the write, so nothing before the
  commit can see it. Driven through the real `dna set` and the real `directive assign`, and it also
  documents the "alarm, not rollback" semantics: the commit exists, the error names its sha, history
  is left alone (`dl-035`).

**Coverage, measured on both sides rather than quoted.** Baseline taken by running `npx jest
--coverage` in a detached worktree at this branch's base (`eca728e`), since removed:

| | Stmts | Branch | Funcs | Lines | Tests |
|---|---|---|---|---|---|
| base `eca728e` | 98.65 | 93.25 | 98.86 | 99.22 | 1833 |
| this branch | **98.69** | **93.45** | **98.89** | **99.24** | 1872 |

Every metric up; no file regressed. `src/core/write-guard.ts` is at **100 / 100 / 100 / 100**.
`directive-assign.ts` dropped to 98.55 on the first coverage run (its post-condition branch
uncovered) and is back at 100 after the second hook test. `memory-transition.ts`'s statement
percentage moved 98.41 → 98.03 with the *same* single uncovered line (a pre-existing branch of
`prepareMemoryTransition`'s catch): the file lost thirty statements to the extraction, so the one
uncovered line is now a larger share of a smaller file.

#### Sync with `main` before submit (`dl-035` — merge, never rebase)

```
$ git -C /home/robypomper/Workspaces/WingFoil2 log --oneline -1
eca728e wf(task): approve task-091…, task-092…, task-093… [pending -> backlog]
$ git merge main
Already up to date.
```

`main` has not moved since this branch's base, so nothing merged and no document these notes cite can
have changed under them. All gates below are from that same state.

#### Gates (run in this worktree)

| Gate | Command | Result |
|---|---|---|
| Full suite | `npx jest` | **119 suites, 1872 tests passed**, exit 0 |
| Coverage ≥ 80, non-regressing | `npx jest --coverage` | **98.69 / 93.45 / 98.89 / 99.24** — up on all four vs base |
| Build typecheck | `npx tsc -p tsconfig.build.json --noEmit` | exit **0**, no output |
| Full typecheck | `npx tsc --noEmit -p tsconfig.json` | exit **0**, **no output** (`bug-026` stays closed) |
| Lint | `npm run lint` | exit **0**, no output |
| API docs | `npm run docs:api` | exit **0** |

The four gated Memory verbs' own suites, run unchanged after the `requireUnmodifiedDocument`
extraction: `npx jest test/core/memory-approve.test.ts test/core/memory-reject.test.ts
test/core/memory-deprecate.test.ts test/core/memory-submit.test.ts
test/core/memory-transition-commit-scope.test.ts` — all green inside the full run above.

| BDD / acceptance scenario | Test that covers it |
|---|---|
| P2.2 `dna set` writes and commits one field | `test/core/dna-set.test.ts` (unchanged, green) + `write-guard-dirty-target.test.ts` "AC4: on a clean tree it still commits, and the commit carries exactly the field it declares" |
| P3.1 `directive create` | `test/core/directive-create.test.ts` (unchanged) + "AC4: on a clean tree it still creates…" |
| P3.2 / P3.7 `directive assign` | `test/core/directive-assign.test.ts` (unchanged) + "AC4: …the commit carries exactly the binding it declares" |
| P3.3 `directive remove` | `test/core/directive-remove.test.ts` (unchanged) + "AC4: on a clean tree it still removes…" |
| P1.3 `memory add` | `test/core/memory-add.test.ts` (unchanged) + "AC4: adding a NEW element still works while ANOTHER element carries uncommitted modifications" |
| P5.1.1 `wingfoil init` | `test/core/init-project.test.ts` (unchanged) + "AC4: `wingfoil init` still works in a repository with NOTHING committed and a dirty tree" |
| P1.7/P1.8/P1.9 the gated verbs, after the shared-gate extraction | `test/core/memory-approve|reject|deprecate.test.ts` and `memory-transition-commit-scope.test.ts`, all unchanged and green |

### review-ready summary — role: reviewer

**What changed, in one sentence.** `dl-080`'s ratified write rule now holds for the non-transition
`commitPaths` callers too: `dna set`, `directive create`, `directive assign` and `directive remove`
refuse before writing when their target carries modifications they do not own, `memory add` refuses
when its target is already occupied at all, and the gate itself is now one shared mechanism rather
than a second copy of `task-088`'s.

**AC coverage**

| AC | Status | Where |
|---|---|---|
| AC1 reproduce first, on a scratch project, commands in the notes | done | `design` § "AC1", six reproductions (R1–R6) run against the base build before any `src/` edit |
| AC2 each caller refuses, exit `1`, naming what is modified | done, with `init` argued under AC3 | `requireUnmodifiedTarget` / `requireAbsentTarget`; every refusal is `VALIDATION` → exit `1` per `spec-005` §1, pinned at the process boundary by the CLI suite |
| AC3 `memory add` and `init` argued, not assumed | done | `design` § "AC3". `memory add` → **absence**, because `nextSequenceNumber` counts the working tree. `init` → the `wingfoil init` path is **provably immune** (`detectInitState` + every scaffold path under `.wingfoil/`) and is scoped out; `initWingfoilStorage`, which has no such check, is guarded |
| AC4 the ordinary flows still work | done | ten characterization cases, all green on the pre-fix run; plus every pre-existing suite for the six verbs, unchanged |
| AC5 a test pins the defect for `dna set` and one `directive` verb | done | `dna set` and `directive assign`, both red before / green after; `directive create` and `directive remove` covered as well |
| AC6 six gates green, full `tsc` silent | done | the table above |

**Reuse, as AC2 asks.** `requireUnmodifiedDocument` is not duplicated — it is now a call into
`requireUnmodifiedTarget` with its own wording. `verifyCommittedScope` keeps its signature and
behaviour and shares `undeclaredCommittedPaths` with `verifyCommittedPaths`, the content-agnostic
sibling the config targets need because they carry no declared frontmatter fields to compare.

**Weak spots a reviewer should check**

1. **`memory add`'s guard also refuses a CLEAN, tracked target** — the id-collision case, where the
   sequence counter produces an id that lands on a committed element. Refusing is right (an "add"
   must never overwrite), but it is a *consequence* of the absence rule rather than a separate fix,
   and the root cause — a sequence counter derived from the working tree — is untouched. Stated in
   `design`, raised as a proposed element.
2. **`initWingfoilStorage` is guarded, `initWingfoilProject` is not.** The asymmetry is argued and
   measured, not assumed, but it is a judgement: a reviewer may prefer the guard on both for
   symmetry, at the cost of code no test can reach through the CLI. The related defect —
   `initWingfoilStorage` still overwrites a *clean* committed `.wingfoil/dna.yaml` because it has no
   already-initialized check — is deliberately left alone and raised.
3. **`pathPorcelainStatus` now silences git's stderr** (`probeGit`). A non-zero exit still raises, but
   a caller that wanted git's diagnostic text on a `git status` failure no longer gets it. Scoped to
   that one function; the reason and the measured warning are in `green` above.
4. **The post-condition adds three git invocations per mutating command** (`rev-parse <sha>^`,
   `diff --name-only`, `show <sha>:<path>`). Deliberate — it is what makes the guard checkable rather
   than hopeful — but it is a real cost on commands that already spawn three git processes, and
   `initWingfoilStorage` deliberately gets only the guard, not the post-condition, because its
   scaffold is ~30 paths.
5. **The guard is per-path, deliberately.** An unrelated dirty file never blocks a write; that is
   `dl-080`'s ratified narrowness (option (D) was rejected precisely for blocking on unrelated
   edits), and it is pinned by two explicit tests so nobody widens it by accident.

**Out of scope, raised rather than fixed (brief rule 2 — no Memory elements created here; parallel
worktrees would collide on ids).** Listed in this run's final report: `memory add`'s working-tree
sequence counter; `initWingfoilStorage`'s missing already-initialized check; and `dl-080` Action 4,
which asks that the ratified rule be written into a directive or `spec-002`/`spec-008` where an
implementer meets it.

**Files touched outside the task file:** `src/core/write-guard.ts` (new), `src/core/index.ts`,
`src/core/init.ts`, `src/core/directive-assign.ts`, `src/core/memory-transition.ts`,
`src/storage/commit.ts`, and three test files. `task-091` (read half) touches the Memory
state-machine load and the directive role-catalogue check; `task-093` touches `src/dna/`. The one
file all three may meet is `src/core/index.ts`, where this task's additions are five one-line guard
calls, one import and one export block.
