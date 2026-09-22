---
id: "task-089-fix-history-walk-attributes-only-real-commits"
type: task
title: "Stop `memory history` reporting a commit that never contained the element: `--follow` chases the copy from the type's template"
status: in-progress
release: "v0.2"
priority: "high"
tags: ["v0.2", "memory", "audit-trail"]
ref: "bug-077-history-follow-attributes-template-commits"
bug: ["bug-077-history-follow-attributes-template-commits"]
depends_on: ["task-086-fix-reason-control-chars-history-forgery"]
tmpl_version: 260703
---

## Description

`memory history` walks an element's commits with `git log --follow`. Every element is created by
copying its type's template, which the scaffold has already committed, so `--follow` continues past
the element's own first commit into the commit that added the **template** and reports it as a history
entry — with a real sha, author and timestamp, and `operation`, `from`, `to`, `approver` and `reason`
all `null`.

It fires for every element in every project created by `wingfoil init`, because that command commits
the scaffold. A reader asking when an element first appeared would reasonably take the earliest entry,
which is a commit that does not contain it.

This is a release blocker for `minor-v0.2`: `memory history` is the whole of **P1.10**, and this is
the second way this release has found to make it report something that did not happen.

## Acceptance Criteria

- **AC1** — Reproduce first on a scratch project (`bug-075` — the verbs cannot read this repository's
  own Memory), showing the `--follow` walk returning more commits than a plain `git log -- <path>`,
  and showing that the extra commit does not contain the element. Put the commands in the notes.
- **AC2** — After the fix, `memory history` reports exactly the commits that touched the element, and
  no entry whose tree lacks the path. Verified on a fresh scaffold-derived element, which is the case
  that fires today.
- **AC3** — **Renames must keep working.** `--follow` is presumably there so an element renamed on
  disk keeps its history, and that requirement is real. Establish by experiment whether a Memory
  element is ever renamed in practice, then either preserve rename-following or state plainly in the
  design notes that it is being dropped and what that costs. Do not drop it silently.
- **AC4** — The mechanism is chosen and argued, not guessed. At least two shapes are available:
  stopping the walk at the commit that introduced the path, and discarding entries whose tree does
  not contain it. The second is cheap because `readStatusAt` already discovers exactly that and
  currently throws it away as stderr. Weigh them in the design notes.
- **AC5** — No entry is silently dropped where the right answer is an error. If a commit cannot be
  read for a reason other than "this tree does not contain the path", that is a failure and must not
  be folded into the same filter — `bug-072` records the failure mode where an unreadable walk is
  reported as an empty history.
- **AC6** — A test pins the defect: it must fail against the current code, and exercise the real
  scaffold-then-add sequence rather than a synthetic rename.
- **AC7** — `bug-071` is **not** fixed here beyond what falls out naturally. It is downstream of this
  and its own remedy — suppressing git's stderr — would have hidden this defect. If the `fatal:`
  disappears as a consequence of your fix, say so; do not add a stderr suppression to make it
  disappear.
- **AC8** — All six gates green; the full `tsc --noEmit -p tsconfig.json` silent.

## Implementation Notes

- Read `task-086`'s Execution Notes first (`dl-015` read_related): it rewrote this module's framing
  and its record-recovery, and its arity work is the most recent change to the same walk.
- `bug-072` (no `maxBuffer`, `catch` returning an empty array) lives in the same function and is
  **not** in scope — but do not make it worse, and say in the notes whether your change touches that
  `catch`.
- Classify every AC per `dl-014`/T1. AC1, AC2 and AC6 are red-first by construction.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). -->

### start — role: developer

`status: backlog → in-progress` (`ffb69b4`). `bug:` is non-empty, so `bug.sync_state` ran as its own
commit: `bug-077` `planned → in-progress` (`a6e2c74`).

Worktree `/home/robypomper/Workspaces/.wf2-wt/task-089`, branch
`task/task-089-fix-history-walk-attributes-only-real-commits`, from `main` at `3967190`.
`npm ci --prefer-offline --no-audit --no-fund` → exit 0.

### design — role: architect

Directives loaded: architecture, determinism, traceability (architect); code-quality, testing,
determinism (developer); doc-versioning, documentation, security-secrets (global).

#### `read_related` (`dl-015`, HARD gate)

**`task-086-fix-reason-control-chars-history-forgery` (`done`)** — the single entry in `depends_on`;
Execution Notes read in full. Five consequences carried into this task's design:

1. **The walk is one shared primitive with two consumers.** task-086 rewrote
   `walkGitLogFields` (`src/memory/git-log.ts`) to frame `git log` output with the NUL that `%x00`
   expands to and to recover records by **field arity** — fixed groups of `fields.length`, with the
   piece after the final NUL dropped. `getMemoryHistory` (`--follow`, six fields, `%b` last) and
   `auditAttribution` (five fields, **no** `--follow`) are its two callers. Only the first is
   affected by this defect, because only the first passes `--follow`; I confirmed `auditAttribution`
   passes no `extraArgs` by reading `src/memory/audit.ts`'s `auditAttribution` at `a6e2c74`.
2. **Do not put anything through that format string.** The arity recovery is exact only because the
   stream is `<field>NUL…<field>NUL` per commit and nothing else. `--name-status` output would land
   in the piece after a record's last NUL and be read as the *next* record's `%H`. That ruled out
   "add `--name-status` to the existing walk and parse the path per commit" as an implementation
   shape before I weighed the mechanisms at all (see AC4 below, option B2).
3. **task-086's own notes name this defect's stderr and disclaim it.** Its `refactor` step recorded
   `fatal: path '…' exists on disk, but not in '<sha>'` as "the `--follow` noise `bug-050` explicitly
   records as independent of this defect", filed as `bug-071`. That line is the visible symptom of
   *this* bug, which is why AC7 forbids suppressing it here.
4. **`history.ts`'s `as [string, string, string, string, string, string]` cast** is sound only
   because `walkGitLogFields` emits whole groups or none (task-086's "what a reviewer should look at
   deliberately", item 2). My change adds no field and does not touch that destructuring.
5. **The `catch` in `walkGitLogFields` that returns `[]`** is `bug-072`'s, explicitly out of scope.
   task-086 left it; so do I — see "`bug-072` untouched" below.

#### `verify_specs`

`memory history` is specified by `spec-006-core-domain-api` §3 (the `memory` operation table) and
`spec-008-cli-grammar`; the behaviour under repair is the BDD contract of
`docs/02_requirements/02_bdd/features/p1-memory/P1.10-memory-history.feature`, whose main scenario
reads "the output lists 3 entries in chronological order" and whose edge scenario reads "the output
lists exactly 1 entry describing the creation". Both are *literally* violated today in any project
created by `wingfoil init` — a three-transition document reports four entries, a just-created one
reports two. This task restores an existing contract; it defines no new surface, so **no new
`tech-spec` is scaffolded** and `design` passes through.

#### AC1 — reproduction, before any repair

`bug-075` means the verbs cannot be pointed at this repository's own Memory, so a throwaway project
is required. Built from this branch at `a6e2c74` (`npm run build` → `dist/cli.js`); every line below
is that session's real output.

```
$ git init -q . && git config user.name "Test User" && git config user.email test@example.test
$ node …/dist/cli.js init --template scrum          # commits the scaffold, templates included
$ node …/dist/cli.js memory add --type adr --title "T one"
$ node …/dist/cli.js memory submit adr-001-t-one
$ node …/dist/cli.js memory approve adr-001-t-one --reason "because it is fine"
$ git log --oneline
c4cbaca wf(adr): approve adr-001-t-one [pending → approved]
3b508dc chore: grant approver role
6aef7f4 wf(adr): submit adr-001-t-one
cc9f040 wf(adr): add adr-001-t-one
a79a301 chore(wingfoil): initialize .wingfoil/ with the Scrum template (P5.1.1)
```

(`3b508dc` adds a `team.members[]` entry holding `approver` to the scaffolded `dna.yaml`; the
scaffold ships `members: []`, so `memory approve` refuses at REQ-SEC-03 without it. It touches
`.wingfoil/dna.yaml` only and is not part of the element's history either way.)

The walk returns **one more commit than the commits that touched the file**:

```
$ git log --follow --format='%h %s' -- docs/memory/adr/adr-001-t-one.md
c4cbaca wf(adr): approve adr-001-t-one [pending → approved]
6aef7f4 wf(adr): submit adr-001-t-one
cc9f040 wf(adr): add adr-001-t-one
a79a301 chore(wingfoil): initialize .wingfoil/ with the Scrum template (P5.1.1)

$ git log --format='%h %s' -- docs/memory/adr/adr-001-t-one.md      # no --follow
c4cbaca …approve…    6aef7f4 …submit…    cc9f040 …add…
```

and the extra commit demonstrably does not contain the element:

```
$ git show --stat a79a301 | grep -c 'adr-001'
0
```

`wingfoil memory history` reports it as a fourth entry with a real sha, author and timestamp and
every derived field null, and leaks the `fatal:` as a side effect:

```
$ node …/dist/cli.js memory history adr-001-t-one --format json
{"id":"adr-001-t-one","path":"docs/memory/adr/adr-001-t-one.md","entries":[
 {"sha":"a79a301…","author":"Test User <test@example.test>","timestamp":"2026-09-22T17:47:55+02:00",
  "operation":null,"from":null,"to":null,"approver":null,"reason":null,
  "subject":"chore(wingfoil): initialize .wingfoil/ with the Scrum template (P5.1.1)"}, …]}
$ node …/dist/cli.js memory history adr-001-t-one --format json 2>&1 >/dev/null
fatal: path 'docs/memory/adr/adr-001-t-one.md' exists on disk, but not in 'a79a301…'
```

**Why `--follow` crosses into the template at all**, which is the fact the whole design turns on.
`--follow` does not merely follow renames: git's `try_to_follow_renames` runs the path search with
**copy** detection enabled, so when the element's path is absent from the parent commit git looks for
a *source that still exists* and takes it. `--name-status` shows the edge it took and labels it:

```
$ git log --follow --name-status --format='COMMIT %h %s' -- docs/memory/adr/adr-001-t-one.md
COMMIT cc9f040 wf(adr): add adr-001-t-one
C087	.wingfoil/memory/templates/adr.md	docs/memory/adr/adr-001-t-one.md
COMMIT a79a301 chore(wingfoil): initialize .wingfoil/ with the Scrum template (P5.1.1)
A	.wingfoil/memory/templates/adr.md
```

`C087` — a **copy**, 87% similar, source still present. Everything older than that edge is the
template's history, not the element's.

#### AC3 — are Memory elements ever renamed? Yes. Measured, in this repository.

The question is not rhetorical, because the answer decides whether `--follow` can simply be dropped.
Run against this worktree at `a6e2c74`:

```
$ git log --all --diff-filter=R -M --name-status --format='%h %s' -- docs/self/docs/04_memory/
a353c12 config: B12 close-out — stamp release:v0.2 on the 10 bootstrap DLs + T11 rename
R100	docs/self/docs/04_memory/planning/v1/minor-v0.1.md	docs/self/docs/04_memory/planning/rl-v1/minor-v0.1.md
R100	…/planning/v1/minor-v0.2.md	…/planning/rl-v1/minor-v0.2.md
R100	…/planning/v1/minor-v0.3.md	…/planning/rl-v1/minor-v0.3.md
R100	…/planning/v1/minor-v0.4.md	…/planning/rl-v1/minor-v0.4.md
R100	…/planning/v1/minor-v1.0.md	…/planning/rl-v1/minor-v1.0.md
```

Five Memory elements, renamed in one commit. The cause is structural, not clerical: the `release`
type's `path` is `docs/04_memory/planning/{release-line}/{id}.md` (`memory.yaml`, the `release`
type's `path:` key), so renaming the release-line `v1 → rl-v1` moves every release underneath it.
Any change to a type's `path` pattern, or to an id that a path interpolates, renames documents.

What rename-following is worth, measured on one of those five:

```
$ git log --format='%h' -- docs/self/docs/04_memory/planning/rl-v1/minor-v0.1.md | wc -l
1
$ git log --follow --format='%h' -- docs/self/docs/04_memory/planning/rl-v1/minor-v0.1.md | wc -l
7
```

**So: rename-following is preserved, not dropped.** Dropping `--follow` would reduce this element's
audit trail from six real commits to one — it would delete its `add`, both `submit`s and both
`approve`s from `memory history`, which for an audit trail is a worse failure than the phantom entry
this task removes. That element is also the case that shows both edges in a single walk, and it is
what makes the mechanism below verifiable rather than merely plausible:

```
$ git log --follow --name-status --format='COMMIT %h %s' -- …/planning/rl-v1/minor-v0.1.md
COMMIT a353c12 config: B12 close-out …
R100	…/planning/v1/minor-v0.1.md	…/planning/rl-v1/minor-v0.1.md     <- legitimate, keep following
COMMIT 5b16ab6 wf(release): approve minor-v0.1 [releasing → released]
COMMIT 715b327 wf(release): submit minor-v0.1
COMMIT 05f9ff3 wf(release): approve minor-v0.1 [planning → in-development]
COMMIT e88de04 wf(release): submit minor-v0.1, …
COMMIT 48ce076 wf(release): add minor-v0.1, …
C079	docs/self/.wingfoil/memory/templates/release.md	…/planning/v1/minor-v0.1.md   <- creation
COMMIT 3431dbe feat(self): Memory schema, state machines & templates (P1.13)     <- PHANTOM
A	docs/self/.wingfoil/memory/templates/release.md
```

Seven entries; six are the element's; `3431dbe` is the template's own add commit. The correct answer
for this element is **six**.

#### AC4 — the mechanism, weighed against that evidence

The discriminator is the status letter on the edge where `--follow` changes path: **`R` (rename) is
the element continuing under a new name; `C` (copy) is the element being born from a file that still
exists.** Everything strictly older than a `C` edge belongs to the source file.

| # | Shape | Verdict against the two measured cases |
|---|---|---|
| A1 | **Drop `--follow`** (plain `git log -- <path>`) | Removes the phantom, and removes five of `minor-v0.1`'s six entries with it. Rejected — AC3. |
| B1 | **Discard entries whose tree lacks the CURRENT path** (AC4's "cheap" option, the failure `readStatusAt` already discovers) | Correct on the scaffold case and **destructive** on the rename case: no commit before `a353c12` contains `…/rl-v1/minor-v0.1.md`, so all five pre-rename entries are discarded. This is A1 wearing a filter — it drops rename-following *silently*, which is exactly what AC3 forbids. Rejected. |
| B2 | **Discard entries whose tree lacks the HISTORICAL path** (thread each commit's path out of `--follow --name-status`) | Does not fix the bug at all: at `a79a301` the historical path is `.wingfoil/memory/templates/adr.md`, which **does** exist there, so the phantom survives. It also requires `--name-status` inside the NUL-framed walk, which read_related item 2 rules out. Rejected on correctness first. |
| A2 | **Stop the walk at the commit that introduced the element** — the newest commit on the followed chain whose edge for this path is a **copy** — keeping that commit and discarding its ancestry | Correct on both: scaffold case 4 → 3, rename case 7 → 6, and a document with no copy edge is untouched. **Chosen.** |

A2 is AC4's first option ("stopping the walk at the commit that introduced the path") with the one
refinement the evidence forces: *introduced the element*, not *introduced the path*. Read literally,
"the commit that introduced the current path" is `a353c12`, the rename — and stopping there is B1.
The element is introduced where its content first appears from a source that outlives it, which is
the `C` edge.

Locating it needs no parsing: `git log --follow --diff-filter=C --format=%H -- <path>` is the same
walk, filtered by git to its copy edges, newest first. Probed on all four cases (every line is real
output):

| Case | `--follow` | `--diff-filter=C` boundary | after truncation |
|---|---|---|---|
| scaffold-derived ADR (scratch) | 4 | `cc9f040` (the `add`) | **3** = plain `git log` |
| `minor-v0.1` (this repo, renamed) | 7 | `48ce076` (the `add`) | **6** (plain walk gives 1) |
| file authored from scratch, never copied (scratch matrix) | 2 | *(none)* | **2**, untouched |
| copy **then** rename (scratch matrix) | 5 | the `add` | **4** (plain walk gives 2) |

Two shapes I tried and rejected as accidents rather than mechanisms: `--follow -M100%` and
`--follow --find-copies=100%` both happen to drop the phantom in the scratch case — but only because
that particular copy scored 87%. They key on content similarity, so a template copied with a smaller
edit stays followed and a rename made in the same commit as an edit stops being followed. Both were
measured: `--follow --no-find-copies-harder` and `--follow --no-renames` change nothing at all, and
`--follow -M100%` returns 3. Content-thresholded luck is not a fix.

#### AC5 — what is filtered, and what must stay an error

A2 filters on **structure** (position on the followed chain relative to the element's creation), not
on a failed read, so no per-commit read result is consulted and there is nothing to confuse with a
genuine failure. That is the point of preferring it over B1: B1's filter *is* `readStatusAt`'s
failure, and that failure has at least three causes — "the tree genuinely lacks the path", "the path
existed under another name", and "git failed" — which B1 collapses into one.

Two failure modes the implementation must therefore surface rather than swallow:

1. **The boundary probe itself fails.** It must not reuse `walkGitLogFields`, whose `catch` returns
   `[]` (`bug-072`) — that would render a git failure as "no copy edge, no truncation" and restore
   the phantom silently. It runs `execFileSync` directly and wraps a failure in an `Error`
   (`exitCodeForThrow` → exit 1 with the message), and it only runs at all when the main walk already
   returned entries, so at that point git and the path are both known good.
2. **The two walks disagree** — the boundary sha is absent from the walk it was filtered from. That
   is impossible by construction and therefore an invariant, not a case: it throws rather than
   defaulting to "no truncation".

**`bug-072` untouched.** My change adds no argument to `walkGitLogFields`, does not enlarge the
output it must buffer, and **does not touch its `catch`** — verified in the `green` diff below.

#### AC7 — `bug-071` is not fixed here

No stderr redirection, no `stdio` option, no suppression of any kind is added. The `fatal:` in the
AC1 transcript disappears in the scaffold case purely *as fallout*, because the commit that provoked
it is no longer in the history that `readStatusAt` is asked about. It does **not** disappear for a
renamed element: `readStatusAt` still asks for the current path at pre-rename commits, which is the
documented limitation in `reconstructMemoryTransitions`'s TSDoc, and `bug-071` still has something to
fix. Both halves are re-measured at `refactor`.

#### T1 acceptance-criterion classification (`dl-014`, `testing` directive)

| AC | Class | Evidence / test |
|---|---|---|
| AC1 — reproduce on a scratch project | **red-first** (evidence) | The transcript above, taken before any source edit, against this branch's build at `a6e2c74`. Pinned in code by AC6's test. |
| AC2 — history reports exactly the commits that touched the element | **red-first** | Behaviour does not exist: the walk has never filtered anything. `test/memory/history-scaffold-copy.test.ts` "reports only the commits that touched the element, not the commit that added the template it was copied from". |
| AC3 — renames keep working | **characterization** | `--follow` preserves renames today and must keep doing so; the test passes on first run against the pre-fix code and is there to catch the regression A1/B1 would cause. Same file, "keeps a renamed element's pre-rename history". |
| AC4 — mechanism chosen and argued | **characterization** (design) | No behaviour of its own; its evidence is the four-case probe table above, taken from real command output, not the implementation. |
| AC5 — a real failure is not folded into the filter | **red-first** | Neither the boundary probe nor its error path exists on `main`. `test/memory/history-scaffold-copy.test.ts` "surfaces a disagreement between the two walks as an error rather than silently skipping the truncation" (over the exported pure helper, so the invariant is exercised without mocking git). |
| AC6 — a test pins the defect, failing against current code, via the real scaffold-then-add sequence | **red-first** | AC2's test builds its fixture by committing a template, then copying it into place — the sequence `wingfoil init` + `memory add` performs — rather than by staging a synthetic rename. Failing run recorded at `red`. |
| AC7 — `bug-071` not fixed beyond fallout | **characterization** | Verified by the `green`/`refactor` diff (no stderr handling added) plus the re-run transcript showing the scaffold-case `fatal:` gone and the rename-case `fatal:` still present. |
| AC8 — six gates green, full `tsc --noEmit` silent | **characterization** | Gate transcripts at `refactor`. |
