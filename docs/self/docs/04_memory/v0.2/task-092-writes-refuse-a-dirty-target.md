---
id: "task-092-writes-refuse-a-dirty-target"
type: task
title: "Make the non-transition verbs refuse a target carrying modifications they do not own, per dl-080's ratified write rule"
status: in-progress
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
