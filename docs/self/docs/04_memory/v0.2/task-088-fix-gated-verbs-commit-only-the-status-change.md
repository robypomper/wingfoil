---
id: "task-088-fix-gated-verbs-commit-only-the-status-change"
type: task
title: "Make `approve`, `reject` and `deprecate` commit the status change and nothing else, and assert it against HEAD rather than against the file on disk"
status: in-progress
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
