---
id: "task-088-fix-gated-verbs-commit-only-the-status-change"
type: task
title: "Make `approve`, `reject` and `deprecate` commit the status change and nothing else, and assert it against HEAD rather than against the file on disk"
status: approved
release: "v0.2"
priority: "high"
tags: ["v0.2", "memory", "security", "audit-trail"]
ref: "bug-076-approve-commits-whatever-is-on-disk"
bug: ["bug-076-approve-commits-whatever-is-on-disk"]
depends_on: ["task-086-fix-reason-control-chars-history-forgery"]
tmpl_version: 260703
---

## Description

`memory approve` stages and commits the element file as it stands in the working tree. Uncommitted
edits to the body, or to frontmatter fields other than `status`, are absorbed into the commit under a
subject that declares only a state transition and a body that attests an approver's identity. The
postcondition compares the file on disk rather than the committed tree, so it cannot see the
difference.

The rule being broken is explicit for the gated verbs: change **only** the `status` field, and do not
modify any other frontmatter field or the body. `submit` is different by design — it is defined as
filling content *and* moving state — and that asymmetry is part of what this task must encode rather
than flatten.

This is a release blocker for `minor-v0.2`: the release exists to deliver these verbs, and the defect
lets an approval commit carry undeclared content while every recorded fact about it stays true.

## Acceptance Criteria

- **AC1** — Reproduce the defect first, end to end, on a scratch project, and record the commands and
  the resulting commit diff. `bug-076` gives the recipe; re-derive it rather than pasting it. A
  scratch project is required because the verbs cannot be pointed at this repository's own Memory
  (`bug-075`).
- **AC2** — After the fix, running a gated verb against an element file carrying unrelated
  modifications either (a) commits only the `status` change, leaving the other modifications in the
  working tree, or (b) refuses with an explicit error at exit `2` naming what is modified. **Choose
  one and justify it in the design notes** — they are not equivalent: (a) silently defers the user's
  other edits, (b) stops a workflow mid-transition. Say which failure you prefer and why.
- **AC3** — The postcondition compares the **committed tree against `HEAD~1`**, not the file on
  disk, and fails when the commit contains anything beyond the declared change. This is the half that
  makes AC2 checkable rather than hopeful; `task-080`'s lockfile guard is the in-repo precedent for
  asserting a diff rather than an end state.
- **AC4** — `submit` keeps carrying body and frontmatter content, because that is its contract. A
  test pins the asymmetry explicitly, so a later reader cannot conclude the verbs were meant to
  behave alike.
- **AC5** — `reject` is covered as well as `approve`, including its `rejection_reason` frontmatter
  write — which is a legitimate non-`status` change the verb itself makes, and must not be caught by
  its own guard. `deprecate` likewise.
- **AC6** — A test pins the defect itself: it must fail against the current code. State the command
  that shows it red before and green after.
- **AC7** — Nothing in this repository's own history is rewritten or re-verified against the new rule.
  Every transition here was made by hand and predates the guard; `dl-035` forbids rewriting merged
  `wf` commits regardless.
- **AC8** — All six gates green; the full `tsc --noEmit -p tsconfig.json` silent.

## Implementation Notes

- Read `task-086`'s Execution Notes first (`dl-015` read_related): it is the most recent work in this
  area, it established how to exercise the verbs from a scratch project, and it closed the other way
  the audit trail could be made to lie.
- The write path is shared across the Memory verbs; find it rather than assuming which module owns
  it, and say in the design notes which verbs route through it.
- Consider what a partial stage means for the git index if the user already staged something else.
  The safe reading is that the verb must not disturb what the user staged; establish what it does
  today before choosing.
- Classify every AC per `dl-014`/T1. AC1, AC2, AC3 and AC6 are red-first by construction.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). -->

### start — role: developer

`status: backlog → in-progress` (`d087018`). `bug:` is non-empty, so `bug.sync_state` ran as its own
commit: `bug-076` `planned → in-progress` (`def8b20`).

Worktree `/home/robypomper/Workspaces/.wf2-wt/task-088`, branch
`task/task-088-fix-gated-verbs-commit-only-the-status-change`, from `main` at `3967190`.
`npm ci --prefer-offline --no-audit --no-fund` → `added 498 packages`, exit 0.

### design — role: architect

Directives loaded: architecture, determinism, traceability (architect); code-quality, testing,
determinism (developer); doc-versioning, documentation, security-secrets (global).

#### `read_related` (`dl-015`, HARD gate)

- **`task-086-fix-reason-control-chars-history-forgery` (`done`) — Execution Notes read in full**,
  the only entry in this task's `depends_on`. What I took from it:
  1. **How to exercise the verbs at all.** Its AC1 section is the scratch-project recipe
     (`git init` → identity → `node dist/cli.js init --template scrum` → seed the identity into
     `dna.yaml`'s `team.members` with the `approver` role → `memory add` → `memory submit`). It also
     records that `bug-030`'s fix means the `init` scaffold now ships `defaults.states`, so the
     **only** hand-edit still needed is the identity. Confirmed here: one `python3` edit to
     `team.members`, nothing else. Re-derived rather than pasted (AC1).
  2. **The precedent that decides my AC2 exit code.** task-086 weighed four options and rejected
     bug-050's own candidate 1 specifically because it would have widened a **ratified** contract
     (`dl-067` clause 4) without the approver, filing `dl-078` instead. That is the same shape as
     the exit-code question below, and I follow it to the same conclusion rather than to a
     different one.
  3. **It closed the *other* way the audit trail could lie.** `bug-076`'s Notes name `bug-050` as
     "the same class ... reached without any trick". task-086 fixed the read side (framing);
     this task fixes the write side (scope). They do not overlap in code: task-086 touched
     `src/memory/git-log.ts` and `src/memory/history.ts` only, and this task touches neither
     (`task-089` is live on both — see the "files not touched" note below).
  4. **A measurement gotcha I reused.** task-086's `red` notes record that `execFileSync` + `catch`
     surfaces `stderr` only on the error path, so a command exiting `0` while printing to fd 2 reads
     back as `stderr: ''`. My CLI-level test therefore uses `spawnSync` from the start.
- **`bug-076-approve-commits-whatever-is-on-disk` (source bug, `in-progress`) — read in full.** Its
  "Expected Behavior" states the two shapes AC2 offers and, like `bug-050`, declines to choose
  between them; its "Notes" flag the postcondition as "the deeper half" and name `task-080`'s
  lockfile guard as the precedent. Both are taken up below.
- **`task-089-fix-history-walk-attributes-only-real-commits`** is running in parallel on
  `src/memory/git-log.ts` and `src/memory/history.ts`. Neither file is touched here, and neither is
  `src/memory/audit.ts`, which imports both — this task deliberately puts its new git reads in
  `src/storage/commit.ts` (the module that already owns the commit path's git plumbing) rather than
  reusing `audit.ts`'s `readStatusAt`, so the two branches cannot collide.

#### `verify_specs`

No new `tech-spec` and no amendment to an approved one. Every rule this task enforces is already
written down; the defect is that nothing enforced it:

- `spec-010-memory-frontmatter-schema` § "Field-write ownership" already declares the exact scope of
  each verb, and states in prose: "`memory.approve` changes **only** the `status` field and no other
  frontmatter field. `memory.reject` changes `status` plus `rejection_reason` — the one exception to
  'status only' among the transition verbs". That table *is* the contract this task makes checkable;
  it needs no change. (Read at `3967190`.)
- `spec-004-mcp-surface-contract` §4.3 (exactly one commit per operation) — unchanged.
- `spec-005-cli-command-contract` § "1. Exit-code contract (REQ-INT-04)" — **not** amended, and that
  is itself the decision recorded under "AC2's exit code" below.

#### The write path — which verbs share it (Implementation Notes ask: find it, do not assume)

```
$ grep -rn "= commitMemoryTransition(" src/
src/core/index.ts:718   (memorySubmitFn)
src/core/index.ts:808   (memoryApproveFn)
src/core/index.ts:900   (memoryRejectFn)
src/core/index.ts:994   (memoryDeprecateFn)
```

So **all four** Memory transition verbs — `submit`, `approve`, `reject`, `deprecate` — reach git
through one function, `commitMemoryTransition` (`src/core/memory-transition.ts`), which calls
`commitPaths` (`src/storage/commit.ts`). `memory add` does **not**: it goes through
`addMemoryEntry` (`src/memory/entry.ts`) → `commitPaths`, and is out of scope — its contract is to
commit a whole new file.

`commitPaths` has other callers (`grep -rn "commitPaths" src/`): `dna set` (`src/core/index.ts:333`),
`directive create` (`:1071`), the directive delete op (`:1242`), `directive assign`
(`src/core/directive-assign.ts:237`), `wingfoil init`'s scaffold (`src/storage/layout.ts:99`) and
`memory add` (above). Each commits its own target path as it stands on disk, so each is potentially
the same class of defect on a different artefact. **Not touched here** — this task is scoped to the
Memory transition verbs, and a `dna set` that sweeps in an unrelated hand-edit to `dna.yaml` is a
different blast radius with a different argument. Raised as a proposed element instead.

The defect is a **baseline** error, one level above the staging call. `prepareMemoryTransition`
reads the document from the working tree and returns it as `PreparedMemoryTransition.content`; the
verb renders `status` onto *that*; and `commitMemoryTransition`'s existing post-condition
(`verifyFrontmatterEdit(prepared.content, content, …)`) compares the rendering against the same
working-tree text. Every comparison in the chain uses the dirty file as its zero point, so a
modification that is already on disk is invisible at every step — and `commitPaths` then does
exactly what it promises: `git add -- <path>` (the whole file) followed by
`git commit --only -- <path>`.

`commitPaths` itself is **not** the bug and is not changed. Its own contract — "stages exactly
`paths` ... Other changes already staged in the index are neither committed nor unstaged
(`bug-027`)" — is upheld, and I re-measured it rather than trusting the TSDoc (M1 below).

#### AC1 — the defect, reproduced end to end before anything was changed

Re-derived from `bug-076`'s recipe rather than pasted. Built this branch's base with `npm run build`
(exit 0) at `def8b20` (`main` `3967190` + the two `start` commits, no `src/` change), then a
throwaway project under the session scratchpad. `wingfoil init --template scrum` commits its own
scaffold; the one hand-edit is the git identity into `team.members` as `approver`.

```
$ git init -q . && git config user.name 'Test User' && git config user.email 'test@example.test'
$ node dist/cli.js init --template scrum            # exit 0, 27 files
# .wingfoil/dna.yaml: team.members: [] -> [{name: Test User, email: test@example.test,
#                                           roles: [developer, approver]}]
$ git add .wingfoil/dna.yaml && git commit -q -m 'chore: seed approver identity'
$ node dist/cli.js memory add --type adr --title 'Repro target'   -> adr-001-repro-target
$ node dist/cli.js memory submit adr-001-repro-target             -> draft → pending
$ git status --porcelain
(clean)
```

Then the dirty edit — one frontmatter field that is not `status`, one body paragraph — plus an
unrelated file the user has already staged, so M1 below is measured in the same run:

```
$ # append   tags: ["INJECTED-BY-A-DIRTY-TREE"]   after the status line, and a body paragraph
$ echo 'user work in progress' > unrelated.txt && git add unrelated.txt
$ git status --porcelain
 M docs/memory/adr/adr-001-repro-target.md
A  unrelated.txt
$ node dist/cli.js memory approve adr-001-repro-target --reason 'state change only, allegedly'
{ "id": "adr-001-repro-target", "path": "…", "from": "pending", "to": "approved" }
$ echo $?
0
```

The commit declares one thing and contains four:

```
$ git log -1 --format='%B'
wf(adr): approve adr-001-repro-target [pending → approved]

Approver: Test User <test@example.test> (approver)
Reason: state change only, allegedly

$ git diff HEAD~1 HEAD
-status: pending
+status: approved
+tags: ["INJECTED-BY-A-DIRTY-TREE"]
+
+INJECTED BODY PARAGRAPH — never mentioned by any commit subject.
```

`1 file changed, 4 insertions(+), 1 deletion(-)`. Confirmed on every count `bug-076` reports, and
every recorded fact in the commit is still true — which is what makes it hard to see.

#### M1 — what the verb does to the git index today (Implementation Notes ask: measure, do not assume)

Two cases, both measured on the same build. The answers point in opposite directions, which is why
guessing would have been wrong.

| Case | Measured behaviour | Verdict |
|---|---|---|
| The user has staged an **unrelated** path (`unrelated.txt`) | `git status --porcelain` after the approve still reports `A  unrelated.txt`, and the commit's `--name-only` is the document alone. It is neither committed nor unstaged. | **Correct already** — `commitPaths`'s `git commit --only -- <paths>` (`bug-027`). Nothing to fix, and the fix must not regress it. |
| The user has staged a **different version of the target document itself** (index ≠ worktree, `git status` → `MM`) | The staged version is silently **discarded**: `git add -- <path>` overwrites the index entry with the worktree blob, and the commit carries the worktree text. Both the staged-only line and the worktree-only line rode into the approval. | **Also the bug**, and a second reason (a) cannot work: there are *two* candidate baselines on disk, and the verb currently picks the one that is not the user's declared intent. |

So "the verb must not disturb what the user staged" is confirmed as the safe reading for the first
case and already holds; the second case is inside this task's scope and is closed by the guard
below, which refuses when the index or the worktree differs from `HEAD` for that path.

#### M2 — the second face of the same defect, and the measurement that settles AC2

Not in `bug-076`, found while establishing the baseline. Because `prepareMemoryTransition` reads
`status` from the **working tree**, a `status` that was hand-edited but never committed drives the
declared transition:

```
$ node dist/cli.js memory add --type adr --title 'Third'     -> adr-003-third   (status: draft at HEAD)
$ sed -i 's/^status: draft$/status: pending/' docs/memory/adr/adr-003-third.md   # never committed
$ node dist/cli.js memory approve adr-003-third --reason 'the from-state came from the worktree'
{ …, "from": "pending", "to": "approved" }    exit 0
$ git log -1 --format='%s'
wf(adr): approve adr-003-third [pending → approved]
$ git diff HEAD~1 HEAD -- docs/memory/adr/adr-003-third.md | grep '^[-+]status'
-status: draft
+status: approved
```

The subject attests a transition **out of `pending`** on a document that history says was `draft`,
and no `submit` commit exists anywhere. `memory history` (P1.10) reads that bracket, so the forged
edge is not merely cosmetic. Same root cause — the working tree used as the baseline — and the same
fix closes it.

#### AC2 — the decision: (b), refuse. Argued from what each failure costs.

**Chosen: (b) — refuse before writing anything, naming exactly what is modified.**

Both options were weighed on cost to a user, not on implementation effort; (a) is in fact the
*easier* of the two to reach for and is still wrong.

**What (a) would have been better at, stated plainly.** (a) never blocks. A user who fixed a typo in
the body and then approved gets their approval *and* keeps the typo fix safe in the worktree; an
automated runner never stops. (b) buys its guarantee by making that user do two steps, and by
turning "someone is mid-edit" into a hard stop at a release gate. That is a real cost and it is the
honest argument for (a).

**Why it loses anyway — three findings, each measured above, not reasoned from taste.**

1. **(a) cannot state what it would commit.** M1 shows there are two candidate baselines on disk —
   the index and the worktree — and they can disagree. "Commit only the status hunk" is only
   well-defined once you say *onto which of the three texts* (`HEAD`, index, worktree), and every
   answer silently discards one of the user's two declarations.
2. **(a) does not fix M2; it entrenches it.** Under (a) the verb computes `from` from the worktree
   (`pending`) and writes onto `HEAD` (`draft`), so the commit would record `draft → approved` under
   a subject declaring `pending → approved` — the audit trail asserting something that did not
   happen, which is the defect this task exists to close. To avoid that, (a) must refuse when
   `status` differs from `HEAD` — i.e. (a) collapses into a partial (b), with two rules instead of
   one.
3. **(a)'s cost is invisible, deferred, and paid by the wrong person.** After (a) the document on
   disk says `approved` *and* still carries uncommitted edits, with nothing said about it. Those
   edits then ride into whatever commits next — plausibly the next `wf(...)` commit, possibly
   another approval. So (a) does not remove the failure mode; it moves it downstream, where it is
   harder to attribute because the edits are no longer fresh. (b)'s cost is paid immediately, by the
   person who caused it, on a document that is provably untouched — `git status`, `git stash`,
   retry.

**The deciding principle.** This is an audit-trail feature. Between a verb that quietly does
*almost* the right thing and one that stops and says what is in the way, an audit trail must take the
second: a reviewer reading history months later cannot detect (a)'s residue, and (b) makes the
condition impossible to reach. (b) also keeps **one** rule for every case — tracked, untracked,
`status` already hand-edited, index disagreeing with worktree — where (a) needs a different answer
for each.

**(b) fits the shape these verbs already have.** Every refusal in `memoryApproveFn` /
`memoryRejectFn` / `memoryDeprecateFn` happens *before* the single write, so "the state is
unchanged" (P1.7 sc.2/sc.3, REQ-STATE-01) holds by construction. The guard is one more such
refusal, placed with the others; it does not introduce a new failure mode into the verb's shape.

**Scope of the guard, per `spec-010`'s ownership table.** It runs on `approve`, `reject` and
`deprecate` and **not** on `submit` (AC4). `reject`'s own `rejection_reason` write and `deprecate`'s
`status` write happen *after* the guard, on text the guard has just certified equal to `HEAD`, so
neither verb is caught by its own guard (AC5) — the guard's question is "was anything already
modified before this verb ran", never "did this verb change anything".

#### AC2's exit code — the one deviation from the literal AC, and why

AC2 and `bug-076`'s "Expected Behavior" both say the refusal is "an explicit error at exit `2`".
**This implementation returns exit `1`**, and this is the only place it departs from the AC's words.

`spec-005-cli-command-contract` § "1. Exit-code contract (REQ-INT-04)" (an `approved` tech-spec, read
at `3967190`) partitions the two codes by *what* is wrong, not by severity:

- exit `2` — "The invocation itself is malformed: unknown command/pillar/verb, unknown flag, missing
  required argument, invalid flag value".
- exit `1` — "The invocation was well-formed but failed on business logic: element not found,
  illegal state transition, validation failure, git operation failure, missing/invalid credentials".

A dirty working tree is not a malformed invocation: the command line is perfect and re-typing it
cannot help. It is a repository-state precondition — the exit-`1` row names both "validation
failure" and "git operation failure". Emitting `2` here would silently redefine what exit `2` means
for every script that keys on it (REQ-INT-04's whole purpose), which is a change to a ratified
contract, and `task-086` set the precedent that such a change is the approver's to make, not the
implementer's — it refused to widen `dl-067` and filed `dl-078` instead.

Everything else AC2 asks for is delivered literally: an **explicit** error, **naming what is
modified**, **before** anything is written, never a silent inclusion. Only the numeral differs.
Raised for the approver in the review summary and as a proposed decision-log in the final report; if
the ruling is `2`, it is a one-line change (`coreErr` → `UsageError`) plus a `spec-005` amendment.

#### AC3 — the postcondition, and why it is a second check rather than a replacement

`task-080`'s precedent (`test/cli/lockfile-peer-overrides.test.ts`) is "assert the *diff*, not the
end state". Applied here, the committed tree is compared against its own parent:

- exactly one path changed between the new commit and its parent, and it is the document;
- the document's frontmatter at the new commit differs from the parent **only** in the fields the
  verb declares it owns (`status`, plus `rejection_reason` for `reject`);
- for the gated verbs the body is byte-identical; for `submit` it may differ (AC4).

The existing `verifyFrontmatterEdit` post-condition stays. The two check different things and both
are needed: the old one catches a defect in the *editor* (`setFrontmatterField` corrupting a
neighbouring field — the `bug-041` class), the new one catches a wrong *baseline*, which is this
bug. Neither subsumes the other.

The parent is resolved as `<sha>^`, falling back to git's empty-tree object when the commit is a root
commit, so the check is total rather than conditional.

**The postcondition is an alarm, not a rollback.** It can only run after the commit exists. When it
fires it returns a `VALIDATION` error naming the sha and the leak; it does **not** rewrite history —
amending or resetting behind the user's back is a worse failure than reporting one, and `dl-035`'s
rule against rewriting `wf` commits points the same way. With the guard in place it should be
unreachable, which is the point: it is the thing that makes AC2 checkable rather than hopeful.

#### T1 — AC classification (`dl-014`, `testing` directive)

| AC | Class | Evidence for the class |
|---|---|---|
| **AC1** — reproduce first | **process gate, not testable** | Satisfied by the AC1 section above, run against the base build before any `src/` edit. AC6's test is its durable form. |
| **AC2** — a gated verb against a modified file refuses, naming what is modified, nothing written | **red-first** | Measured red above: today it exits `0` and commits four insertions. `grep -rn "uncommitted\|working tree" src/core src/memory src/storage` → 4 hits, **none of them a refusal**: `relevance.ts:29,31` (a determinism caveat about reading the live tree), `storage/commit.ts:58` (`bug-027`'s index comment) and `core/index.ts:622` (`memory history` returning `entries: []` for a never-committed document). No verb anywhere refuses on a modified file. |
| **AC3** — the postcondition compares the committed tree against the parent commit | **red-first** | `grep -n "HEAD~\|\\^" src/core/memory-transition.ts` → 0 hits; the only post-condition there is `verifyFrontmatterEdit(prepared.content, …)`, i.e. against the file on disk. A test that commits a leak and expects the verb to refuse fails today. |
| **AC4** — `submit` keeps carrying body + frontmatter content | **characterization** | `spec-010`'s ownership row for `memory.submit` already grants it "body content", and `memorySubmitFn` already renders it; the test pins behaviour that pre-exists and passes on first run. Fabricating a red for it would mean asserting `submit` is broken, which the `testing` directive forbids. |
| **AC5** — `reject`'s `rejection_reason` and `deprecate` are covered and not caught by their own guard | **red-first for the guard's scope, characterization for the field write** | The guard is new, so "reject still succeeds on a clean file and still writes `rejection_reason`" is only a *regression* pin (characterization — it passes on `main`); "reject refuses on a dirty file" fails today exactly as AC2 does. |
| **AC6** — a test pins the defect itself, red before / green after | **red-first** | Same evidence as AC2/AC3. The command that shows it is recorded under `red` below. |
| **AC7** — nothing in this repository's history is rewritten or re-verified | **process gate** | Negative obligation. Checked by `git log --oneline main..HEAD` touching no historical commit, and by the fact that the guard runs only inside the verbs, which `bug-075` means cannot be pointed at this repository's Memory. |
| **AC8** — six gates green | **process** | Run at `refactor`/`review`. |

**Gate state:** `frontmatter.required` (`title`, `release`) present; `depends_on.acknowledged`
satisfied (task-086 above); `tech-spec.approved` — no new or amended spec, so nothing pending.
`design` passes through with no approver gate (no spec was scaffolded).

### red — role: developer

Commit `4f27867`. Two new suites, no change to any existing one:

- **`test/core/memory-transition-commit-scope.test.ts`** — the guard on every gated verb (AC2/AC5),
  the `submit` asymmetry (AC4), and **every happy path asserted against the parent commit** rather
  than against the file on disk (AC3's observable).
- **`test/cli/dirty-document-refusal.integration.test.ts`** — the two things only the process
  boundary shows: the exit code a script keys on and the stderr a human reads, driven through the
  real compiled `dist/cli.js` in a real `wingfoil init` project. `spawnSync`, not `execFileSync` +
  `catch`, per task-086's measurement gotcha; the reason is recorded in the file's TSDoc so the next
  reader does not "simplify" it back.

Observed red — AC6's command, before any `src/` change:

```
$ npx jest test/core/memory-transition-commit-scope.test.ts test/cli/dirty-document-refusal.integration.test.ts
Test Suites: 2 failed, 2 total
Tests:       9 failed, 6 passed, 15 total
```

The 9 failures are the defect, not missing imports — every one reads `expect(result.ok).toBe(false)`
/ `expect(run.status).toBe(1)` receiving the success the current code returns. The 6 passes are
exactly the cases the T1 table classifies as characterization: the three clean happy paths, the
`bug-027` staged-path regression, `submit` carrying content, and the CLI's clean-approve diff.

**A correction to the T1 table's AC3 row, made here rather than left standing.** AC3 has two halves
and they classify differently. Its *observable* on a clean tree — "the commit differs from its parent
by the status line alone" — already holds today, so those three cases passed on first run and are
**characterization**. What is **red-first** is the same assertion on a tree that is *not* clean: the
M2 case commits `draft → approved` under a subject declaring `pending → approved`, and the body/field
cases commit four insertions where one was declared. The row said "red-first" without that split; the
split is what the run measured.

### green — role: developer

Commit `d3eaca5`. Three source files, one existing test line.

| Change | Where |
|---|---|
| `readPathAtRev` (a sha, `HEAD`, or the index stage `:0`), `pathPorcelainStatus`, `commitParent` (parent sha, or git's empty tree for a root commit), `changedPathsBetween` | `src/storage/commit.ts` |
| `probeGit` — `stdio[2]: 'ignore'` for invocations whose failure is an expected answer, so `git show HEAD:<untracked>`'s `fatal:` does not land in the user's terminal next to the message the CLI meant to emit | same |
| `DocumentScope`, `verifyDocumentEdit` (the frontmatter rules **plus the body**), `describeDocumentChanges` (what is in the way, in words a user can act on); `verifyFrontmatterEdit` recomposed from the two shared halves, behaviour unchanged | `src/memory/frontmatter-edit.ts` |
| `requireUnmodifiedDocument` (AC2's refusal, before any write) and `verifyCommittedScope` (AC3's committed-tree check), wired into `commitMemoryTransition` with a `scope` parameter defaulting to the strict value | `src/core/memory-transition.ts` |
| `memory submit` opts out with `'carries-content'` — the one call site that changes | `src/core/index.ts` |

Design points worth naming:

- **The `scope` parameter defaults to `declared-fields-only`.** A verb added later is guarded unless
  it deliberately opts out, rather than the other way round.
- **The pre-write post-condition is strict for all four verbs, `submit` included.** `submit`'s
  baseline is `prepared.content` — the author's file, content already in it — and
  `renderSubmitDocument` owns `status` and `rejection_reason` alone. So the content `submit` carries
  is *already on the before side of that comparison*, and tightening the check to cover the body
  costs `submit` nothing while closing the `bug-041` class one step further. Only the **guard** and
  the **committed-tree check** vary by scope.
- **Why `git status` decides "is it modified" and this code only decides "what to call it".** git
  owns index refresh, `core.autocrlf` and `.gitattributes` filters; an answer re-derived from bytes
  would disagree with `git status` on exactly the machines where that matters.
- **Both of the user's declarations are inspected** — the index (`:0`) and the working tree — because
  M1 measured that they can disagree and that `git add` silently replaces the former with the latter.
- **One existing expected message changed**: `refusing to write …: the rendered frontmatter failed
  its post-condition` → `the rendered document`. The check now covers the body, so naming only the
  frontmatter would mislabel a body problem. `test/core/memory-submit.test.ts` pins that string; it
  is updated with a comment saying why.

Full suite after green: `npx jest` → `111 passed, 1771 tests`, exit 0.

### refactor — role: developer

Commit `cf7b955`. No behaviour added; the coverage the green step owed.

- **`verifyCommittedScope` is exported** from `src/core`. It is the assertion AC3 names, so it is
  tested directly — a hand-made commit carrying a body leak, an unowned field, an extra path, an
  absent path, a root commit, and the `carries-content` relaxation — rather than only through the
  verbs it guards.
- **The alarm is reachable, and the test that reaches it is realistic rather than contrived.** With
  the guard in place, no *argument* to a verb can make the committed tree exceed the declared change.
  One thing still can: a repository-local **`pre-commit` hook** — a formatter, or a linter run with
  `--fix` — that rewrites the element file and re-stages it. It runs after `requireUnmodifiedDocument`
  (the tree *was* clean), after the rendering post-condition, and inside `git commit` itself, so
  nothing before the commit can see it. Measured first in a scratch repo (`git commit --only -- a.md`
  with a hook appending to `a.md` → the appended line is in the commit), then pinned as a test. It
  also documents the "alarm, not rollback" semantics: the commit exists, the error names its sha, and
  history is left alone.
- `test/memory/document-scope.test.ts` — `verifyDocumentEdit` and `describeDocumentChanges` on text,
  no git, including the CRLF-delimiter case that reaches the `'the file content'` fallback.
- `test/storage/commit.test.ts` — the four read primitives, including the `:0` index stage, the
  empty-tree parent fallback, and the `options.env` override (`GIT_CONFIG_*`, which git honours only
  from the environment, so it proves the override reaches the child — the task-014 gotcha).

**Coverage, measured on both sides rather than quoted.** Baseline taken by running
`npx jest --coverage` in a detached worktree at this branch's base (`3967190`), since removed:

| | Stmts | Branch | Funcs | Lines | Tests |
|---|---|---|---|---|---|
| base `3967190` | 98.59 | 92.97 | 98.80 | 99.18 | 1754 |
| this branch | **98.63** | **93.17** | **98.85** | **99.21** | 1799 |

Every metric up; no file regressed. The two lines still uncovered in the changed files are
`src/storage/commit.ts:118` (a `?? ''` on `split('\n')[0]`, which `noUncheckedIndexedAccess` requires
and which cannot be empty) and `src/core/memory-transition.ts:101` (a pre-existing branch of
`prepareMemoryTransition`'s catch, untouched here).

#### Sync with `main` before submit (`dl-035` — merge, never rebase)

```
$ git merge main            # main at 0c88631
Merge made by the 'ort' strategy.  3 files changed, 95 insertions(+), 3 deletions(-)
$ git diff --stat HEAD~1 HEAD -- src/ test/
(empty)
```

The merge brought three `docs/05_plans/rl-v1/rel-v0.2/` plan files (release-publishing,
release-submit, retrospective) — no `src/`, no `test/`. None of the documents these notes cite
(`spec-005`, `spec-010`, `bug-076`, `task-086`'s Execution Notes) is among them, so no sentence above
is stale. The merged `release-submit` plan's new §2.3 independently records the approver's
blocker declaration and the same `bug-075` constraint these notes rest on — consistent, nothing to
correct. All gates below are post-merge.

#### Gates (post-merge, run in this worktree)

| Gate | Command | Result |
|---|---|---|
| Full suite | `npx jest` | **112 suites, 1799 tests passed**, exit 0 |
| Coverage ≥ 80, non-regressing | `npx jest --coverage` | **98.63 / 93.17 / 98.85 / 99.21** — up on all four vs base |
| Build typecheck | `npx tsc -p tsconfig.build.json --noEmit` | exit **0**, no output |
| Full typecheck | `npx tsc --noEmit -p tsconfig.json` | exit **0**, **no output** (bug-026 stays closed) |
| Lint | `npm run lint` | exit **0**, no output |
| API docs | `npm run docs:api` | exit **0** |

BDD acceptance suites for the four verbs, run unchanged:
`npx jest test/core/memory-approve.test.ts test/core/memory-reject.test.ts
test/core/memory-deprecate.test.ts test/core/memory-submit.test.ts` → **4 suites, 68 tests passed**.

| BDD scenario | Test that covers it |
|---|---|
| P1.7 sc.1 *Approve a pending document with a reason* | `test/core/memory-approve.test.ts` "P1.7 sc.1: approves a pending document with a reason…" — and, for the commit's **scope**, `memory-transition-commit-scope.test.ts` "AC3: a clean `approve` commits exactly one line changed…" |
| P1.7 sc.2 *Error — approving without a reason* | `test/core/memory-approve.test.ts` (unchanged, still green) |
| P1.7 sc.3 *Error — approver lacks authority for the type* | `test/core/memory-approve.test.ts` (unchanged, still green) |
| P1.8 sc.1 *Reject a pending document with feedback* | `test/core/memory-reject.test.ts`; scope pinned by "AC5/AC3: a clean `reject` commits exactly its two owned fields…" |
| P1.9 sc.1 *Deprecate an approved document* | `test/core/memory-deprecate.test.ts`; scope pinned by "AC5/AC3: a clean `deprecate` commits the status line alone…" |
| P1.6 sc.1 *Submit a draft document for approval* | `test/core/memory-submit.test.ts`; the asymmetry pinned by "AC4: `submit` DOES carry uncommitted body and frontmatter content…" |

### review-ready summary — role: reviewer

**What changed, in one sentence.** All four Memory transition verbs share one write path, and every
comparison in it used the working tree as its zero point; `approve`, `reject` and `deprecate` now
refuse before writing anything when the element file already carries modifications they do not own,
and every transition commit is checked against its own parent rather than against the file on disk.

**AC coverage**

| AC | Status | Where |
|---|---|---|
| AC1 reproduce first | done | `design` § "AC1", run against the base build before any `src/` edit; commands and the resulting commit diff recorded |
| AC2 refuse, naming what is modified | done, option **(b)** | `requireUnmodifiedDocument`; argued in `design` § "AC2 — the decision" from M1/M2, with what (a) would have been better at stated plainly. **One deviation: exit `1`, not `2` — see below.** |
| AC3 postcondition vs the parent commit | done | `verifyCommittedScope`; every happy-path test asserts `git diff HEAD~1 HEAD`, and the check itself is tested directly on hand-made commits |
| AC4 `submit` keeps carrying content | done | `'carries-content'` scope; two tests, one of them stating the asymmetry as a single assertion (the same edit `submit` carries makes `approve` refuse) |
| AC5 `reject` + `deprecate`, not caught by their own guards | done | the guard runs *before* each verb's own write, on text it has just certified equal to `HEAD`; `reject`'s `rejection_reason` is pinned as an owned field in the committed diff |
| AC6 a test pins the defect, red before / green after | done | `red` § above: 9 failed / 6 passed before, 15 passed after, command recorded |
| AC7 nothing in this repository is rewritten or re-verified | done | `git log --oneline main..HEAD` touches no historical commit; no test reads this repository's Memory; the verbs cannot be pointed at it (`bug-075`) |
| AC8 six gates | done | table above, all green post-merge |

**The one thing the approver must rule on: AC2's exit code.** AC2 and `bug-076` both say "exit `2`";
this returns exit **1**. `spec-005-cli-command-contract` § "1. Exit-code contract (REQ-INT-04)" — an
`approved` spec — reserves `2` for a malformed *invocation* and puts "validation failure, git
operation failure" under `1`. A dirty working tree is not a malformed invocation; re-typing the
command cannot help. Emitting `2` would redefine what exit `2` means for every script keying on
REQ-INT-04, which is a change to a ratified contract, and `task-086` set the precedent that such a
change belongs to the approver (it refused to widen `dl-067` and filed `dl-078` instead). Everything
else AC2 asks for is delivered literally. If the ruling is `2`, it is a one-line change (`coreErr` →
`UsageError`) plus a `spec-005` amendment; a decision-log is proposed for it.

**Weak spots a reviewer should check**

1. **The guard is per-path, deliberately.** A dirty `dna.yaml` or an unrelated dirty document does not
   block a transition — only the element being transitioned does. That is the narrowest rule that
   closes `bug-076`, but it is a choice.
2. **The committed-tree check cannot roll back.** It runs after the commit exists, reports a
   `VALIDATION` error naming the sha, and leaves history alone (`dl-035`). With the guard in place it
   is unreachable through any argument to a verb; the one realistic trigger is a `pre-commit` hook
   that rewrites the file, which is exactly what its test uses.
3. **`verifyCommittedScope` is exported.** Justified as a genuine capability an audit command would
   want, not only for testability — but it is a new public surface on `src/core`, and that is a
   reviewer's call as much as mine.
4. **`verifyFrontmatterEdit` was recomposed**, not rewritten: its two halves are now shared with
   `verifyDocumentEdit`. Behaviour is unchanged and its existing tests pass untouched; worth a glance
   because it is the one edit to code this task did not otherwise need to touch.
5. **`probeGit` silences stderr** for `git show`/`rev-parse` probes whose failure is an expected
   answer. It is scoped to those two call sites; a caller that needs git's diagnostic must use
   `runGit`.

**Out of scope, raised rather than fixed (`dl-014`/rule 2 — no elements created here; parallel
worktrees would collide on ids):** `commitPaths`'s other callers — `dna set`, `directive
create`/`delete`/`assign`, `wingfoil init`'s scaffold and `memory add` — each commit their own target
path as it stands on disk, which is the same class of defect on a different artefact. `dna set`
sweeping in an unrelated hand-edit to `dna.yaml` has a different blast radius and a different
argument, so it is not touched here. Listed in this run's final report as a proposed bug.
