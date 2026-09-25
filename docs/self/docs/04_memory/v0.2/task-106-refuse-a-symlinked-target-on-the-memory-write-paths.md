---
id: "task-106-refuse-a-symlinked-target-on-the-memory-write-paths"
type: task
title: "Refuse a symlinked target on the Memory write paths, so `writeFileSync` cannot follow a link the confinement check deliberately does not resolve — and so nothing commits for an element that was never written"
status: in-review
release: "v0.2"
priority: "high"
tags: ["v0.2", "memory", "storage", "security"]
ref: "bug-120-a-symlinked-document-leaf-is-followed-by-the-write"
bug: ["bug-120-a-symlinked-document-leaf-is-followed-by-the-write", "bug-117-memory-add-writes-outside-the-project-root-through-a-symlinked-store"]
depends_on: ["task-105-confine-the-memory-store-to-the-project-root"]
tmpl_version: 260703
---

## Description

`task-105` closed the symlinked **store directory**. A symlinked **document** is a different
mechanism and is still open: `unlink` acts on a link, `writeFileSync` **follows** it — so the
parent-resolved, leaf-unresolved asymmetry that is correct for a delete is a hole for a write.

Two reproductions, both measured on the **fixed** build by `task-105`'s reviewer (see `bug-120`):

- `memory submit` through a committed symlinked document **rewrote the outside file** and then failed
  with raw git text;
- `memory add` through a **dangling** symlink wrote a 273-byte element outside the root **and
  committed** — `requireAbsentTarget`'s `existsSync` is false for a dangling link, so history gained
  `wf(task): add task-002-escape-probe` for an element the repository does not contain.

**This closes `bug-120` and, with it, `bug-117`**, which the approver extended rather than closed
because its Expected Behavior is REQ-SEC-06's property and that property does not distinguish the two
mechanisms.

## Acceptance Criteria

**AC1 — reproduce both, on a build from `task-105`'s merged state.** Record exit codes from `$?`
directly, what appears outside the root, and — for the `memory add` case — **whether a commit was
created**, with `git log --oneline -1` and `git show --stat HEAD`. That commit is the worst fact in
this bug and it must be the thing your test pins.

**AC2 — a symlinked target is refused before any write.** `lstat`-shaped: refuse when the target
*itself* is a symlink, on every Memory write path. Not a wider boundary —
**do not real-resolve the leaf.** `bug-044` verified the case that would break: `unlink` on a
symlinked directive file is correct and must stay correct.

**AC3 — the dangling case is covered by the same check.** `existsSync` is false for a dangling link
and `lstat` is not. This is why `requireAbsentTarget` let it through, and it must not be the reason a
second guard lets it through too.

**AC4 — nothing commits when the write is refused.** Pin `git log` unchanged, not only the exit code.
The reviewer's mutation discipline applies: move your check after the write and confirm the
*filesystem and history* assertions red while the message assertion stays green.

**AC5 — the refusal is a mapped `CoreError` at exit 1** (`spec-005` §1), naming the path and that it
is a symlink. No raw git text — `bug-093`'s family.

**AC6 — every Memory write path, and say how you enumerated them.** `task-105` established that the
four transition verbs are write paths but were not callers of the confined resolver; do not assume
its list is complete for *this* check, since the question is different.

**AC7 — the ordinary path is unchanged**, including a genuine file at a genuine path, and including a
symlinked *directory* on the way, which `task-105` already refuses. Characterize both first.

**AC8 — two sentences are now false and one of them is yours to fix.**
`requireConfinedTarget`'s "A path that leaves the project is refused, never written to and never
deleted" is untrue on the write paths. Correct it, and check `src/storage/confinement.ts` for the
justification `task-105`'s review flagged.

## Implementation Notes

- **Cannot start before `task-105` lands.** Same files. Read its Execution Notes (`dl-015`) and its
  review before designing.
- AC1 is measurement; AC2/AC3/AC4 are **red-first**; AC7 is **characterization**.
- **`dl-086` is `in-discussion` and this work is its evidence.** `task-105` proposed there that the
  parent/leaf asymmetry is **verb-dependent** — resolve the parent for a delete, refuse a symlinked
  leaf for a write. Implement that shape and cite the DL; do not amend it, and do not argue a general
  rule in a TSDoc.
- Node's `fs` exposes no `O_NOFOLLOW` on a path-based API, so a TOCTOU window remains between the
  check and the write. `dl-086` names the same limit for the delete path. **Say so where you
  implement it**, and do not present the guard as an adversarial defence.
- **Your fixture writes through a symlink.** Bound it: outside directory inside a second `mkdtemp`,
  assert on what appears there and on `git log`, never on an error string alone.

## Execution Notes

Branch `task/task-106-refuse-a-symlinked-target-on-the-memory-write-paths`, dedicated worktree, from
`main` at `417e223f`. Plan: `docs/05_plans/rl-v1/rel-v0.2/dev-loop-rel-v0.2-plan.md`.

**`main` merged (`dl-035`: merge, never rebase).** `git merge main` → `Already up to date`, twice:
once before measuring and once before submitting, with `git log --oneline -1 main` → `417e223f` both
times. `417e223f` is this branch's own base, so there was nothing to merge — which is not the same as
nothing to check. Every gate number below was taken after the second merge, and the **emitting**
`npx tsc -p tsconfig.build.json` was run as the brief requires, not only `--noEmit`.

**`dl-015` — the `depends_on` acknowledgement.** `task-105`'s Execution Notes and its review pass were
read before designing, and they decided three things here. (1) Its AC5 section states the asymmetry it
preserved and records that it found the write-side hole against its own finished work, deliberately
leaving the remedy to this task; so this task does not re-derive whether the leaf may be resolved — it
may not. (2) Its review-pass §1 had already corrected `resolveRealPathInRoot`'s TSDoc in
`src/storage/confinement.ts` to say the asymmetry is "right for the delete path and a known gap on the
write paths", naming `bug-120` and this task — which is the second of AC8's two sentences, and it is
made false again by landing the repair, so it is rewritten here rather than left standing (see AC8).
(3) Its "Files touched, and what a merge should watch" section is the model for the same section
below.

### T1 acceptance-criterion classification (`dl-014`/T1, `testing` directive)

| AC | Classification | Why |
|----|----------------|-----|
| AC1 (reproduce D1 + D2, with the commit evidence) | **measurement** | Shipped behaviour through the built CLI; no test. |
| AC2 (a symlinked target refused before any write) | **red-first** | `writes nothing outside the project root` failed with the leaked element present; `leaves the linked document outside the project root byte-identical` failed on all four transition verbs with `status: draft` → `pending`/`approved`/`deprecated`. |
| AC3 (the dangling case covered by the same check) | **red-first** | The whole `targetIsSymlink` suite failed (the symbol did not exist), and `reports a DANGLING symlink as a symlink, where existsSync reports nothing at all` is the case that names the defect. |
| AC4 (nothing commits when the write is refused) | **red-first** | `creates no commit` failed for `memory add` through a dangling link: `git log` carried `wf(note): add note-002-escape-probe`. Green already for the transition verbs (git refuses to commit an unchanged link blob) — kept and labelled characterization there. |
| AC5 (mapped `CoreError` at exit 1, names path + symlink) | **red-first** | `refuses with a mapped CoreError at exit 1 naming the path and the symlink` failed on every write path: `memory add` returned the post-hoc `commit … carries more than the change it declares`, the transition verbs threw git's own `Command failed: … commit --only`. |
| AC6 (every Memory write path, and how enumerated) | **measurement**, then covered by AC2/AC5's suites | The enumeration is six `grep` commands, pasted below; each path found got a row in a suite. |
| AC7 (the ordinary path unchanged) | **characterization** | `still adds an element at an ordinary path…` and `still submits an ordinary in-project document…` passed on first run, before any source change, and still pass; so do `task-105`'s own two ordinary-path cases and its symlinked-**directory** cases, untouched. |
| AC8 (two false sentences) | **verification** | Read what `task-105` landed in both files before writing; both sentences corrected, neither reintroduced in other words. |

### AC1 — both reproductions on the merged `task-105` state, and the commit that is the finding

`npm ci` + `npm run build` (`tsc -p tsconfig.build.json`) in this worktree at the branch point, then
`bug-120`'s two sequences in throwaway `wingfoil init --template Scrum` repositories, each with its
"outside" directory in a second `mktemp -d`.

**D1 — `memory add` through a dangling leaf writes outside the root and commits.**

```
$ ln -s "$O/leaked-add.md" docs/memory/task/task-002-escape-probe.md   # dangling, untracked
$ node <wt>/dist/cli.js memory add --type task --title "escape probe"
error: commit 2b52dfd8d58c23360a549a82a8c55077ac82be42 carries more than the change it declares:
  'docs/memory/task/task-002-escape-probe.md' at the commit differs from what this operation wrote
$ echo $?
1
$ ls -lA "$O"
-rw-rw-r-- 1 … 273 … leaked-add.md                  # <-- the element, OUTSIDE the root
$ git log --oneline -1
2b52dfd wf(task): add task-002-escape-probe          # <-- A COMMIT WAS MADE
$ git show --stat HEAD
 docs/memory/task/task-002-escape-probe.md | 1 +     # <-- the symlink blob, not the element
$ git status --short                                 # (empty)
```

That commit is the fact this task exists to kill: the project's own history asserts an element the
project does not contain, in the log `memory history` reads back, and the operator is told only that a
commit "carries more than the change it declares" — neither that anything was written outside the
root, nor where.

**D2 — `memory submit` through a committed leaf rewrites the outside document.**

```
$ git ls-files -s docs/memory/task/
120000 b326521f459eebe656678924e34ff2de14497408 0	docs/memory/task/task-001-leafy.md
$ md5sum "$O2/leafy.md" -> 80abe11a3038f30bf9c7a1f631084b01
$ node <wt>/dist/cli.js memory submit task-001-leafy
error: Command failed: git -C <proj> commit --only --quiet -m wf(task): submit task-001-leafy -- …
$ echo $?
1
$ md5sum "$O2/leafy.md" -> c0c5ebfea63a9abaa3a49ca8d287ecdd     # rewritten OUTSIDE
$ grep '^status:' "$O2/leafy.md" -> status: pending
$ git log --oneline -1 -> 15f4b69 plant a symlinked task document   # no commit
```

**After the fix**, same scripts against a rebuilt `dist/`, in fresh projects:

```
# D1
error: E_TARGET_IS_SYMLINK: cannot create 'docs/memory/task/task-002-escape-probe.md': the target is
itself a symbolic link. A write follows a link where a delete acts on it, so the bytes would land
wherever the link points — not at the path named here, and outside the project entirely when the link
leaves it. Replace the link with a regular file, then retry.
$ echo $? -> 1
$ ls -A "$O3"            # (empty — nothing written)
$ git log --oneline -1   # unchanged: 71c735e chore(wingfoil): initialize .wingfoil/ …

# D2 — `memory submit` and `memory deprecate` on the same planted document
error: cannot write 'docs/memory/task/task-001-leafy.md': the target is itself a symbolic link. …
$ echo $? -> 1
$ md5sum "$O4/leafy.md" -> 80abe11a3038f30bf9c7a1f631084b01   # byte-identical, before and after both verbs
$ grep '^status:' -> status: draft
$ git log --oneline -1   # unchanged
```

### What changed

Six source files, no new module, and **`src/core/index.ts` is not among them** — the file
`task-093`/`095`/`096`/`097` are working in is untouched by this branch, because `src/core/index.ts`
re-exports `./confinement` with `export * from './confinement';` (line 132), so the new core guard
reaches the barrel without an edit there.

- **`src/storage/confinement.ts`** — `targetIsSymlink`, the `lstat`-shaped predicate, and
  `symlinkTargetRefusal`, the one sentence both surfaces return. `escapesRoot` and
  `resolveRealPathInRoot` are **unchanged**: the boundary is not widened and the leaf is never
  real-resolved, which is what keeps `bug-044`'s case working (AC2).
- **`src/storage/errors.ts`** — `E_TARGET_IS_SYMLINK`, distinct from `E_PATH_ESCAPES_ROOT` because it
  reports a different finding: not where the path leads, but that the write would not land on the
  named path at all.
- **`src/storage/memory-path.ts`** — `resolveConfinedMemoryPath` asks the predicate as its third and
  last check, after both boundary checks, and throws. Both `memory add` call sites are covered by
  that one line.
- **`src/core/confinement.ts`** — `requireConfinedWriteTarget`: `requireConfinedTarget` plus the same
  predicate, as a `VALIDATION` `CoreResult`. `requireConfinedTarget` itself is unchanged in behaviour
  and keeps serving `directive remove`.
- **`src/core/memory-transition.ts`** — `commitMemoryTransition`'s check 1 now calls
  `requireConfinedWriteTarget`; one import line and one call line, plus that check's TSDoc paragraph.
- **`src/memory/entry.ts`** — `writeMemoryEntry`'s `@throws` list gains the new code.

**Why the check sits where it does, rather than in one place.** The two Memory write paths reach
their target differently: `memory add` *resolves* a path that does not exist yet, so its guard belongs
in the resolver every caller of that family goes through; the transition verbs *locate* an existing
document and never ask the resolver anything (`task-105` established this), so theirs belongs in the
one write they share. One predicate and one message string are shared between them, so the two
surfaces cannot drift on what the rule is or how it is worded — the same shape `task-105` used for
`escapesRoot`.

### AC2 — refused, not resolved, and the `bug-044` case still works

`targetIsSymlink` calls `lstatSync(...).isSymbolicLink()` and nothing else: where the link points is
never asked, so the refusal cannot widen the boundary. Verified rather than argued, on three levels:

- `test/storage/confinement.test.ts` — `refuses a path reached through a symlinked DIRECTORY that
  leaves the root — bug-044` and `accepts a symlinked FILE whose target is outside — unlink removes
  the link, not the target` both **untouched and green**; `resolveRealPathInRoot` was not modified.
- `test/core/directive-remove-confinement.test.ts` — `still removes a symlinked directive FILE inside
  a real custom/ directory, leaving its target intact`, untouched and green.
- through the built CLI, on the fixed build:

```
$ ln -s "$O5/legacy-rule.md" .wingfoil/directives/custom/legacy-rule.md && git commit …
$ node <wt>/dist/cli.js directive remove legacy-rule
{ "name": "legacy-rule", "path": ".wingfoil/directives/custom/legacy-rule.md" }   exit 0
link gone? yes      target survives? yes      git log -1 -> wf(directive): remove legacy-rule
```

The one pinned expectation that had to be **inverted** is `task-105`'s own, in
`test/storage/memory-path-confinement.test.ts`: `accepts a target whose own name is a symlink, inside
a real in-project directory` is now `refuses a target whose own name is a symlink, because every
caller of this resolver writes`. That test mirrored a *deletion's* asymmetry onto a resolver with only
write callers — which is exactly what D1 walked through — and the inversion is scoped to that
resolver, with the reasoning and the pointer to where the delete-side case stays pinned written beside
it.

### AC3 — the dangling case, and why one guard was not enough

`requireAbsentTarget` (`src/core/write-guard.ts`) asks `existsSync`, which **follows** links and is
therefore `false` for a dangling one; the path reads as free and the unconditional write behind it
follows the link. `lstatSync` inspects the link itself. The difference is pinned directly, in
`test/storage/symlink-target.test.ts`:

```
expect(existsSync(link)).toBe(false);
expect(targetIsSymlink(link)).toBe(true);
```

and end-to-end by the D1 suite, whose fixture asserts `existsSync(join(repo, TARGET_PATH))` is `false`
in its own `beforeEach` — so a future guard that reached for `existsSync` again would not quietly pass
this suite. `requireAbsentTarget` itself is unchanged: it answers a different question (is this path
occupied), and the answer it gives for a live link — refuse — is right, just for the wrong reason;
after this change the symlink guard runs first and says why.

### AC4 — the commit is the assertion, and the mutation proves it is

`creates no commit` compares `git rev-parse HEAD` before and after and additionally asserts
`git log --oneline` does not contain `add note-002-escape-probe`, so a commit made and amended away
would still fail it.

**Mutation, run rather than reasoned about** (`task-105`'s reviewer's discipline): the storage-level
check was removed and re-inserted in `memoryAddFn` *after* `writeMemoryEntry` — which writes **and**
commits — and in `commitMemoryTransition` after `writeDocument` + `commitPaths`. `npx jest
test/core/memory-add-symlink-target.test.ts test/core/memory-transition-symlink-target.test.ts` then
gave **11 failed / 8 passed**, and which ones failed is the point:

| Assertion | Under the mutation |
|---|---|
| `memory add` › dangling › `creates no commit` | **FAILED** |
| `memory add` › dangling › `writes nothing outside the project root` | **FAILED** |
| `memory add` › dangling › `refuses with a mapped CoreError … naming the path and the symlink` | **passed** |
| transition verbs › ×4 › `leaves the linked document … byte-identical` | **FAILED** |

So the message assertion carries neither AC2 nor AC4 — it is perfectly happy with a refusal issued
after the bytes have landed outside the root and the commit has been made. Only the filesystem and
`git log` assertions can see the difference. (The transition verbs' message assertions also failed
under the mutation, for a different reason: `commitPaths` throws git's own text before the relocated
check is reached.) `git checkout -- src/` restored the tree; `git status --short` is empty against the
committed state and the two suites are green again.

### AC5 — the refusal

One sentence, built by `symlinkTargetRefusal` and shared by both surfaces, naming the path as the
operation named it and saying the target is a symbolic link. `memory add` raises it as a
`StorageError`, which `memoryAddFn` already maps to `coreErr({code: 'IO'})` → exit **1**
(`EXIT_CODE_BY_ERROR.IO`, `src/core/exit-code.ts`); the transition verbs return `VALIDATION` → exit
**1**. Both are `spec-005` §1 refusals of a well-formed invocation, never `2`. The suites assert the
message does **not** contain `Command failed` (the `bug-071`/`bug-093` leak) nor `carries more than
the change it declares` (the post-hoc alarm, which can only speak once the commit exists).

The message deliberately does not name where the link points: the guard refuses without resolving,
and a message quoting a destination would imply it had judged one.

### AC6 — every Memory write path, and how they were enumerated

The question is not `task-105`'s ("who calls the confined resolver") but "whose syscall would follow a
link", so the enumeration starts at the syscall and walks outwards. Six commands, all run in this
worktree at `052be3e2`:

```
$ grep -rnE "writeFileSync|appendFileSync|renameSync|copyFileSync|cpSync|createWriteStream|truncateSync|openSync|fs\.promises" src/ --include=*.ts
src/storage/document.ts:9, :28        # writeFileSync — the ONLY write syscall in src/
$ grep -rn "writeDocument(" src/ --include=*.ts
src/storage/layout.ts:97 · src/core/index.ts:391 · src/core/index.ts:1332 ·
src/core/directive-assign.ts:370 · src/core/memory-transition.ts:305 · src/memory/entry.ts:68
$ grep -rn "writeMemoryEntry(" src/ --include=*.ts      -> src/core/index.ts:665 (memoryAddFn)
$ grep -rn "commitMemoryTransition(" src/ --include=*.ts -> src/core/index.ts:980, 1068, 1159, 1251
$ grep -rn "removeDocument(" src/ --include=*.ts         -> src/core/index.ts:1533 (directive remove)
$ grep -rn "resolveConfinedMemoryPath(" src/ --include=*.ts -> src/memory/entry.ts:67, src/core/index.ts:661
```

`writeDocument` is the single door to the single write syscall, so its six call sites are the complete
set of write paths in the system. Two of them are **Memory** write paths and both are guarded here:
`src/memory/entry.ts:68` (`writeMemoryEntry` ← `memoryAddFn`, guarded through
`resolveConfinedMemoryPath`, which its own line 67 and `memoryAddFn`'s line 661 both call) and
`src/core/memory-transition.ts:305` (`commitMemoryTransition` ← `memorySubmitFn`/`Approve`/`Reject`/
`Deprecate`, guarded by `requireConfinedWriteTarget`; all four are driven as rows of one suite, so a
fifth verb that stopped routing through that function would show as a missing row).

The other four write **DNA/Directives configuration**, not Memory documents: `layout.ts:97`
(`scaffoldFiles`, `wingfoil init`), `core/index.ts:391` (`dna set`), `core/index.ts:1332`
(`directive create`), `directive-assign.ts:370` (`directive assign`). They are outside this task's
scope and are **not** guarded — measured, not assumed; see "Proposed elements" in the hand-off report,
where `dna set` through a symlinked `dna.yaml` is reproduced. `removeDocument`'s single call site is a
delete and must keep following none of this (AC2).

### AC7 — the ordinary path, characterized before anything was touched

Both new suites carry an ordinary-path case that passed on first run and still passes, and
`task-105`'s cases — ordinary and symlinked-**directory**, for `memory add` and for the transition
verbs — are untouched and green. Through the built CLI, on the fixed build:

```
$ node <wt>/dist/cli.js memory add --type task --title "ordinary probe"      -> exit 0
$ node <wt>/dist/cli.js memory submit task-001-ordinary-probe                -> exit 0, draft -> pending
$ git log --oneline -2
d6a11d3 wf(task): submit task-001-ordinary-probe
92251b3 wf(task): add task-001-ordinary-probe
$ git show --stat --format= HEAD -> docs/memory/task/task-001-ordinary-probe.md | 2 +-

$ rm -rf docs/memory/adr && ln -s "$O5" docs/memory/adr      # task-105's case, still refused
$ node <wt>/dist/cli.js memory add --type adr --title "dir probe"
error: E_PATH_ESCAPES_ROOT: Memory entries must reside within the project root: … outside the project
root — a directory on the way to it is a symlink leaving the project.     exit 1, "$O5" empty
```

The last one also shows the **check order**: confinement first, the leaf second, so a path that leaves
the project is reported as leaving the project rather than as a link, whatever its leaf happens to be.

### AC8 — the two sentences

1. **`requireConfinedTarget`'s user-facing claim** (`src/core/confinement.ts`): "A path that leaves the
   project is refused, never written to and never deleted" was a general statement about every path
   that leaves the project, and D1/D2 falsify it on the write paths. It now reads "Nothing has been
   written or deleted — this check runs before the operation touches the filesystem", which is a claim
   about *this* refusal and is the one the function can keep. Its TSDoc additionally says what it does
   not answer, and points a write at `requireConfinedWriteTarget`.
2. **`resolveRealPathInRoot`'s asymmetry paragraph** (`src/storage/confinement.ts`), which
   `task-105`'s review pass had corrected to "right for the delete path and a **known gap on the write
   paths** … filed as `bug-120`, owned by `task-106`". Landing this closes the gap, so the sentence is
   false in its turn; it now says the write paths ask `targetIsSymlink` **beside** this function, that
   the function itself is unchanged and therefore the delete path is too, and that a wider boundary
   here would have red the `bug-044` case the paragraph exists to keep working.

Two further sentences were made stale by this pass and corrected with it, on the same standard:
`resolveConfinedMemoryPath`'s "The target's parent is resolved; its own name is not" (true, but no
longer the whole story — "unresolved is not the same as unexamined" now follows it, with the reason),
and `commitMemoryTransition`'s check-1 paragraph, which described one shape of wrong *place* and now
describes both.

### Baseline — `dl-086`, cited and not amended

Both new reads resolve against the **working tree**, which departs from `command-baseline`'s rule for
a gating read. The argument is `task-102`'s, recorded in
`dl-086-a-guard-over-a-filesystem-effect-resolves-on-the-filesystem` (`in-discussion`, not ratified),
and it is cited at both call sites rather than re-made: a read that predicts the target of an imminent
filesystem mutation resolves on the filesystem, because the syscall follows the symlinks on disk and
not the ones a commit records.

What this task adds to that document is **evidence, not an amendment**. `task-105` proposed there that
the asymmetry is verb-dependent — resolve the parent for a delete, refuse a symlinked leaf for a
write — and that is the shape implemented here: `resolveRealPathInRoot` untouched, a separate
`lstat`-shaped predicate asked only by writes, and the delete path demonstrably unchanged (AC2).
`dl-086` is not edited by this task; the ruling on it is the approver's.

**TOCTOU, named where it is implemented and not oversold.** Node's `fs` exposes no `O_NOFOLLOW` on a
path-based API, so nothing closes the window between `lstatSync` and `writeFileSync`; only
file-descriptor primitives (`openat`) would. `targetIsSymlink`'s own TSDoc says so, and says what this
guard actually converts: a routine, self-inflicted loss — a store aliased into shared space, a
document linked into a folder — into a refusal. It is **not** an adversarial defence and must not be
cited as one. `dl-086` names the same limit for the delete path.

### Fixture safety

Each of the three new suites keeps its "outside" directory in a **second** `mkdtemp` under `tmpdir()`,
removed in `afterEach` through `removeTempDir` whichever way the test goes. The load-bearing
assertions are what that directory holds (`readdirSync(outside)` empty for `memory add`, byte-equality
of the planted document for the transition verbs) and `git log`/`git rev-parse HEAD` — never an error
string, which passes just as happily after the damage. `test/storage/symlink-target.test.ts` inspects
paths and never opens one.

### Files touched, and what a merge should watch

- `src/storage/confinement.ts` — **one import line** rewritten (`realpathSync` →
  `lstatSync, realpathSync`), two new exported functions appended after `resolveRealPathInRoot`, and
  two TSDoc paragraphs (the module header and the asymmetry paragraph). No existing function's body
  changed.
- `src/storage/memory-path.ts` — **two import lines** rewritten (both are `./confinement` and
  `./errors`), three lines added to `resolveConfinedMemoryPath`, its TSDoc extended.
- `src/storage/errors.ts` — one new exported constant, appended.
- `src/core/confinement.ts` — **one import line** rewritten and one added (`node:path`'s `join`), one
  new exported function, one message string changed inside `requireConfinedTarget`.
- `src/core/memory-transition.ts` — **one import line** rewritten
  (`requireConfinedTarget` → `requireConfinedWriteTarget`) and the one call that used it; its check-1
  TSDoc paragraph.
- `src/memory/entry.ts` — a `@throws` tag only.
- `test/core/memory-add-symlink-target.test.ts`, `test/core/memory-transition-symlink-target.test.ts`,
  `test/storage/symlink-target.test.ts` — new files, so they cannot conflict.
- `test/storage/memory-path-confinement.test.ts` — one existing case inverted, one import line, one
  header paragraph. This is the only edit to an existing test file.
- **`src/core/index.ts` is NOT touched**, nor is any `src/*/index.ts` barrel: `src/core/index.ts:132`
  is `export * from './confinement';`, so `requireConfinedWriteTarget` is exported without an edit,
  and `src/storage/confinement.ts`'s new functions are imported by module path (as
  `src/core/confinement.ts` already imported `resolveRealPathInRoot`), so `src/storage/index.ts` needs
  no change either.

### Gates (run in this worktree at `052be3e2` + these notes, after `git merge main`)

| Gate | Result |
|------|--------|
| `npx jest` | **148 suites / 2410 tests passed**, 0 failed |
| `npx jest --coverage` | **98.58 %** statements / **94.03 %** branches / 98.94 % functions / **99.41 %** lines (≥ 80) |
| `npx tsc -p tsconfig.build.json --noEmit` | 0 errors |
| `npx tsc -p tsconfig.build.json` (emitting) | 0 errors |
| `npx tsc --noEmit -p tsconfig.json` (full, `test/**` included) | **0 errors, no exception** (`bug-026` stays closed) |
| `npm run lint` | clean, no output |
| `npm run docs:api` | clean, no output |

`task-105` left `main` at 145 suites / 2383 tests and 98.58 / 94.01 / 99.41; this branch adds 3 suites
and 27 tests, and branch coverage moves 94.01 → 94.03, so the non-regression claim is measured rather
than assumed on the aggregate. Per file this task touched, measured with
`npx jest --coverage --collectCoverageFrom=…` over the six of them: `src/storage/memory-path.ts`,
`src/core/confinement.ts` and `src/memory/entry.ts` at **100 %** on every axis;
`src/storage/confinement.ts` 96.15 % statements / 100 % lines, its one uncovered statement being
`realpathOfDirectory`'s documented fixed-point terminator, which `task-102` wrote and this task did not
touch; `src/core/memory-transition.ts` 98.52 % statements / 100 % lines, its one uncovered statement
being `prepareMemoryTransition`'s non-`ValidationError` rethrow, likewise untouched.

### Findings outside this task

Two, neither fixed here and neither filed by me (parallel worktrees collide on ids):

1. The **configuration** write paths — `dna set`, `directive create`, `directive assign`,
   `wingfoil init`'s scaffold — have no confinement pre-flight at all, let alone this one.
   Reproduced, not inferred: with `.wingfoil/dna.yaml` a committed symlink to a file outside the
   project, `dna set project.name --value probe` **rewrote the outside file** (md5 `93740c55…` →
   `d723afcc…`) and failed with `error: Command failed: git -C … commit --only …`, exit 1, no
   commit. That is `bug-044`'s crossing and `bug-120`'s mechanism, in the DNA store.
2. `resolveMemoryPath` — the **unconfined** sibling of `resolveConfinedMemoryPath` — is exported
   from `src/storage/index.ts` and has no caller in `src/`. `task-105` raised it under its own
   Proposed elements; `grep -rln "resolveMemoryPath" docs/self/docs/04_memory/` returns only task
   documents, no `bug` and no `decision-log`, so nothing appears to have been registered for it.

Both are written up under **Proposed elements** in the hand-off report for the orchestrator to
register.
