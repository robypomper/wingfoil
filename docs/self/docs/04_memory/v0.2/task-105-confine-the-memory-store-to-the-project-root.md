---
id: "task-105-confine-the-memory-store-to-the-project-root"
type: task
title: "Make `resolveConfinedMemoryPath` resolve before it compares, so a symlinked Memory directory cannot put an element outside the project root"
status: in-review
release: "v0.2"
priority: "high"
tags: ["v0.2", "storage", "memory", "security"]
ref: "bug-117-memory-add-writes-outside-the-project-root-through-a-symlinked-store"
bug: ["bug-117-memory-add-writes-outside-the-project-root-through-a-symlinked-store"]
depends_on: ["task-102-directive-remove-confines-its-deletion-to-the-project-root"]
tmpl_version: 260703
---

## Description

`resolveConfinedMemoryPath` (`src/storage/memory-path.ts`) compares **textually**. When a Memory
type's directory is a symlink pointing outside the project root, `memory add` writes the element
there, fails on `git add` with a raw unmapped git message, and records nothing — leaving a file
outside the user's project and no trace that anything was written.

REQ-SEC-06 places the confinement boundary at the project root. This is `bug-044`'s crossing, in the
pillar the requirement was written for, on a far more ordinary command.

**`task-102` has already built the repair**; this task uses it. That task extracted `escapesRoot`
(the single containment predicate) and `resolveRealPathInRoot`, which real-resolves a target's
**parent** and deliberately leaves the leaf alone. `resolveConfinedMemoryPath` calls `escapesRoot`
today but hands it an **unresolved** path — exactly the comparison that passes for this input.

## Acceptance Criteria

**AC1 — reproduce first, and record what was written where.** Build the CLI, make a throwaway
project whose `docs/memory/<type>` is a symlink to a directory outside it, commit, run `memory add`.
Record the exit code from `$?` directly, the stderr verbatim, and **whether a file appeared outside
the root**. That last one is the AC.

**AC2 — the check precedes the write.** Resolve, compare, refuse — before any file is created. A fix
that writes and then reports is not a fix; `task-102`'s reviewer proved this by mutation, finding the
error-message and no-commit assertions still passing while the outside file was destroyed.

**AC3 — the refusal is a mapped `CoreError` at exit 1** (`spec-005` §1), naming the path and saying
it resolves outside the project root. No raw git text reaches the operator.

**AC4 — reuse `task-102`'s primitives; do not write a second boundary.** `escapesRoot` and
`resolveRealPathInRoot` exist. If either does not fit, say precisely why rather than adding a third
definition of "inside the project root" — two places deciding confinement is how a guarantee becomes
a suggestion.

**AC5 — the leaf stays unresolved, and you must understand why before you touch it.** `task-102`
resolves the **parent** only, so a symlinked **file** inside a real directory still behaves —
`unlink` removes the link, and that case is verified safe in `bug-044`. Real-resolving the leaf reds
two of its tests. Preserve the asymmetry and pin it on this path too.

**AC6 — the TSDoc sentence is already false and `task-102` is correcting it.** Check what landed
before writing your own: it claimed "no filesystem answer exists for a path that does not exist yet",
which `realpathOfDirectory` refutes. Do not reintroduce it in different words.

**AC7 — every Memory write path, not only `memory add`.** `resolveConfinedMemoryPath` serves the
whole pillar. Enumerate its callers and check each; if one is unreachable or already guarded, say
which and how you established it.

**AC8 — the ordinary path is unchanged.** A Memory directory genuinely inside the project still
writes, still commits, still exits 0. Characterize before touching anything.

## Implementation Notes

- **This task cannot start before `task-102` lands.** Both change `src/storage/memory-path.ts`, and
  `task-102`'s correction is in flight in that file. Read its Execution Notes first (`dl-015`) —
  especially its argument about why a guard over a physical filesystem effect resolves on the
  filesystem rather than at `HEAD`, which applies here unchanged.
- AC1 is measurement, AC2/AC3 are **red-first**, AC5 and AC8 are **characterization**.
- **Your fixture can damage the machine it runs on.** It symlinks outside a temp directory and then
  writes. Build the outside directory inside a *second* `mkdtemp`, and assert on what appears there
  rather than on an error string alone.
- `bug-118` is adjacent and **not in scope**: the dirty-target guard is blind to any path beyond a
  symlink, which is why it did not catch this. Do not widen into it; if your work makes it cheaper to
  fix, say so.

## Execution Notes

Branch `task/task-105-confine-the-memory-store-to-the-project-root`, dedicated worktree, from `main`
at `98871b8d`. Plan: `docs/05_plans/rl-v1/rel-v0.2/dev-loop-rel-v0.2-plan.md`.

**`main` merged, twice (`dl-035`: merge, never rebase).** Before measuring: `git merge main` →
`Already up to date`, `main` still at `98871b8d`. `task-102` and `task-103` are already *in* that
base — `src/storage/confinement.ts` and `src/core/confinement.ts` exist at the branch point, and
`exit-code.ts` carries `task-103`'s `classifyParseOutcome` note — so there was nothing to merge,
which is not the same as nothing to check. Before submitting, `main` had moved to `5eb60d47`
(`task-104`'s merge `3fc8f5a4`, plus `bug-119`), which `git merge-base --is-ancestor main HEAD`
reported as `NO`; merged as `df2f8132`, textually clean, and `npm ci` re-run because `task-104`
rewrites `package-lock.json`. **Every gate number below was taken after that merge**, and the
emitting `tsc -p tsconfig.build.json` was run as the brief requires, not only `--noEmit`.

**The run was interrupted by a machine shutdown** between the red step and its commit. Every number
below was re-taken afterwards; nothing pre-dating the interruption is reported. The scratch project
used for the CLI-level measurements had been wiped with `/tmp`, so it was rebuilt and both
reproductions (before and after the fix) re-run against freshly built `dist/` trees.

### T1 acceptance-criterion classification (`dl-014`/T1, `testing` directive)

| AC | Classification | Why |
|----|----------------|-----|
| AC1 (reproduce, record what appeared outside) | **measurement** | Shipped behaviour, run through the built CLI; no test. |
| AC2 (the check precedes the write) | **red-first** | `writes nothing outside the project root` failed with `Array ["note-001-escape-probe.md"]` — the outside file, named by the assertion. |
| AC3 (mapped `CoreError`, exit 1, names the path) | **red-first** | `refuses with a mapped CoreError …` failed: the verb returned no `CoreResult` at all, throwing `Command failed: git … beyond a symbolic link` out of `commitPaths`. |
| AC4 (reuse `task-102`'s primitives) | design constraint, not a test | Discharged by calling `resolveRealPathInRoot`/`requireConfinedTarget`; no third boundary exists — see below. |
| AC5 (the leaf stays unresolved) | **characterization** | `accepts a target whose own name is a symlink, inside a real in-project directory` passed on its first run, before any source change, and still passes. |
| AC6 (the TSDoc sentence) | **verification** | Read what `task-102` landed before writing; the false sentence is gone and is not reintroduced. |
| AC7 (every write path, not only `memory add`) | **measurement**, then **red-first** | The caller enumeration is a measurement; the transition verbs it found unguarded got their own failing suite first (8 failed / 5 passed). |
| AC8 (the ordinary path unchanged) | **characterization** | Both ordinary-path tests, and `test/storage/memory-path.test.ts` untouched, passed before and after. |

### AC1 — reproduction on the shipped code, and what appeared outside the root

Built `dist/` from this worktree with `src/storage/memory-path.ts` restored to its committed state
(`git checkout src/storage/memory-path.ts`, `npm run build` → `tsc -p tsconfig.build.json`), then
ran `bug-117`'s sequence in a throwaway `wingfoil init --template Scrum` repository whose
`docs/memory/task` is a symlink to a directory outside it:

```
$ node <wt>/dist/cli.js memory add --type task --title "escape probe"
fatal: pathspec '<proj>/docs/memory/task/task-001-escape-probe.md' is beyond a symbolic link
error: Command failed: git -C <proj> add -- <proj>/docs/memory/task/task-001-escape-probe.md
fatal: pathspec '<proj>/docs/memory/task/task-001-escape-probe.md' is beyond a symbolic link

$ echo $?
1
$ ls -lA <outside>
-rw-rw-r-- 1 … 273 … task-001-escape-probe.md      # <-- WRITTEN OUTSIDE THE ROOT
$ git status --short                               # (empty — nothing records it)
$ git log --oneline -1
4f2f62b symlink the task store                     # <-- no commit was made
```

**What appeared outside the root: the element itself** — a 273-byte
`task-001-escape-probe.md` whose frontmatter is the real scaffold, `id: task-001-escape-probe`,
`status: draft`. Exit `1` and the leaked `Command failed` are context; the file is the AC.

After the fix, the same script against a rebuilt `dist/`:

```
$ node <wt>/dist/cli.js memory add --type task --title "escape probe"
error: E_PATH_ESCAPES_ROOT: Memory entries must reside within the project root:
'docs/memory/task/task-001-escape-probe.md' resolves to
'<outside>/task-001-escape-probe.md', outside the project root — a directory on the way to it is a
symlink leaving the project.

$ echo $?
1
$ ls -A <outside>                                  # (empty — nothing was written)
$ git status --short                               # (empty)
$ git log --oneline -1
4f2f62b symlink the task store                     # (unchanged)
```

### What changed

Two source files, and no new module:

- **`src/storage/memory-path.ts`** — `resolveConfinedMemoryPath` now asks the **same** predicate
  about **two resolutions of the same path**: the rendered string (`task-017`'s textual check, kept
  verbatim — it is the only one that can catch `../` smuggled through a placeholder value, and a
  filesystem that happens to link such a path back inside the project must not launder it), and
  `resolveRealPathInRoot`'s filesystem answer (the only one that can catch a symlinked directory).
  Either escape throws `StorageError` `E_PATH_ESCAPES_ROOT` **before a path is returned**, so no
  caller ever holds one to write to.
- **`src/core/memory-transition.ts`** — `requireConfinedTarget(root, prepared.path, 'write')` as the
  first of `commitMemoryTransition`'s checks (AC7; see below).

**The message.** The canonical REQ-SEC-06 sentence is carried verbatim as the first clause and then
names *both* spellings of the path, because the two differing is the whole finding. `memoryAddFn`
already maps a `StorageError` to `coreErr({code: 'IO'})`, and `EXIT_CODE_BY_ERROR.IO` is `1`
(`src/core/exit-code.ts`), so AC3's exit code needed no change — what it needed was for the refusal
to *exist* before `commitPaths` ran. The existing assertions in `test/storage/memory-path.test.ts`
and `test/memory/entry.test.ts` are `toContain`/`toThrow` substring checks on that sentence, so they
pass untouched; I did not modify either file.

**What the function returns is unchanged**: the absolute path spelled under `root` *as the caller
gave it*, not re-spelled under the real root. `commitPaths` runs `git -C <root>` and `memoryAddFn`
takes `relative(root, …)`, so a project reached through a symlinked path must keep its own
vocabulary. Pinned by `accepts a root reached through a symlink, and returns the path under the
spelling it was given`.

### AC4 — the primitives were reused; there is still one definition of "inside the project root"

`escapesRoot` remains the only containment decision in `src/`. `resolveConfinedMemoryPath` reaches
it twice, once directly (textual) and once through `resolveRealPathInRoot` (filesystem);
`commitMemoryTransition` reaches it through `requireConfinedTarget`, which is `task-102`'s
`CoreResult` mapping of the same call. Nothing new was written that decides confinement:
`grep -rn "relative(" src/storage/confinement.ts src/storage/memory-path.ts src/core/confinement.ts`
shows the comparison only inside `escapesRoot`.

### AC5 — the leaf stays unresolved, and why that had to be understood first

`resolveRealPathInRoot` real-resolves the target's **parent** and keeps its own basename. The case
that asymmetry protects is `bug-044`'s "benign case, verified safe": a symlinked **file** inside a
real directory, where `unlink` acts on the link and the target survives. Real-resolving the leaf
would refuse it and red `task-102`'s two tests. It is pinned on this path too, by `accepts a target
whose own name is a symlink, inside a real in-project directory` — which passed before and after,
and would fail the moment someone "simplified" the parent/leaf split away.

**This is also where I found a case `dl-086` does not cover, and did not extend it.** The asymmetry
is argued from `unlink`, which acts on the link. `writeFileSync` **follows** it. So a symlinked leaf
is safe to *delete* and is not safe to *write*, and both Memory write paths still write through one.
Measured, on the fixed build — see "Proposed elements" in the hand-off report; not fixed here,
because AC5 instructs the leaf to stay unresolved and the remedy is a different mechanism
(`O_NOFOLLOW`/`lstat`-shaped), not a wider boundary.

### AC6 — the TSDoc

`task-102` had already retracted "no filesystem answer exists for a path that does not exist yet"
(`docs(storage): task-102 — retract the false 'no filesystem answer exists' note …`), leaving a
paragraph that declared the entry point textual and named this task as the owner of the repair. That
paragraph is now false in its turn — the entry point is no longer textual — so it was rewritten
rather than left standing: it states what the two checks are, why each exists, and which one only a
filesystem can answer. No sentence claims a filesystem answer is unavailable.

### AC7 — every caller, and the write paths that are not callers

`grep -rn "resolveConfinedMemoryPath" src/` gives exactly two call sites:

1. **`src/memory/entry.ts:58`, `writeMemoryEntry`** — repaired by the primitive. Its own callers:
   `grep -rn "writeMemoryEntry(" src/` → one, `src/core/index.ts:665` (`memoryAddFn`).
2. **`src/core/index.ts:661`, `memoryAddFn`** — repaired by the primitive. It resolves the path a
   second time on purpose (`bug-078`'s absent-target guard needs it before the write); both
   resolutions now refuse, and the first one is reached first, so the refusal still precedes
   everything.

`resolveMemoryPath` — the *unconfined* sibling — is exported from `src/storage/index.ts` and has
**no caller in `src/` at all**: `grep -rln "resolveMemoryPath" src/ test/` gives only
`src/storage/index.ts`, `src/storage/memory-path.ts` and `test/storage/memory-path.test.ts`. It is
raised under "Proposed elements" rather than removed here.

**The transition verbs are Memory write paths and are not callers.** `memory submit`, `approve`,
`reject` and `deprecate` locate an existing document by id and write it through
`commitMemoryTransition` (`src/core/memory-transition.ts`), which never asks the resolver anything.
Repairing only the resolver would have left the pillar's guarantee partial, so they are repaired in
this task — deliberately and not silently. Measured on the shipped build before the change:

```
$ md5sum <outside>/task-002-planted.md
b3707f1e171d121f3d4df9d823e143f9 …
$ node <wt>/dist/cli.js memory submit task-002-planted     # (pre-fix build)
error: Command failed: git -C <proj> add -- docs/memory/task/task-002-planted.md
$ node <wt>/dist/cli.js memory deprecate task-002-planted --reason probe
error: Command failed: git -C <proj> add -- docs/memory/task/task-002-planted.md
$ grep '^status:' <outside>/task-002-planted.md
status: deprecated          # <-- the outside document was REWRITTEN, twice
```

and after:

```
$ node <wt>/dist/cli.js memory submit task-002-planted
error: cannot write 'docs/memory/task/task-002-planted.md': it resolves to
'<outside>/task-002-planted.md', outside the project root. A path that leaves the project is
refused, never written to and never deleted; check whether a directory on the way to it is a
symlink.
$ echo $?
1
$ md5sum <outside>/task-002-planted.md
b3707f1e171d121f3d4df9d823e143f9 …          # <-- byte-identical
```

The guard runs **first** in `commitMemoryTransition`, ahead of the `dl-080` write guard and the
in-scope check, for the reason `task-102` established for `directive remove`: the question "is this
file the project's to write" precedes every question about its content. The write guard cannot stand
in for it — `git status --porcelain` reports a path beyond a symbolic link as clean, which is
`bug-118`, out of scope and untouched. My change does make `bug-118` cheaper on this surface, in the
narrow sense that the Memory verbs no longer depend on that guard to notice this class of path; it
does not address the guard's blindness itself.

### AC8 — the ordinary path

`wingfoil memory add --type task --title "ordinary probe"` in a scratch project with a real
`docs/memory/task`: exit `0`, `{"id": "task-001-ordinary-probe", "path":
"docs/memory/task/task-001-ordinary-probe.md"}`, and `git show --name-only --format= HEAD` →
`docs/memory/task/task-001-ordinary-probe.md`, one file, commit `wf(task): add
task-001-ordinary-probe`. Both suites carry the same case, and
`test/storage/memory-path.test.ts`/`test/memory/entry.test.ts`/`test/core/memory-add.test.ts` pass
unmodified.

### Baseline — `dl-086`, cited and not re-argued

Both new reads resolve against the **working tree**, which departs from `command-baseline`'s rule
for a gating read. That is `task-102`'s argument, recorded in
`dl-086-a-guard-over-a-filesystem-effect-resolves-on-the-filesystem` (`in-discussion`, not
ratified): a read that predicts the target of an imminent filesystem mutation resolves on the
filesystem, because the syscall follows the symlinks on disk and not the ones a commit records. The
mutation here is `writeFileSync` rather than `unlinkSync`, which is the same shape. The TSDoc on
both call sites points at `dl-086` and makes no argument of its own.

### Fixture safety

Every suite keeps its "outside" directory in a **second** `mkdtemp` under `tmpdir()`, removed in
`afterEach` through `removeTempDir` whichever way the test goes, and the load-bearing assertion is
what that directory holds — `readdirSync(outside)` empty for `memory add`, byte-equality of the
planted file for the transition verbs — never an error string, which would pass just as happily
after the outside file had been written. The one test that resolves a symlinked leaf never writes
through it.

### Files touched, and what a merge should watch

- `src/storage/memory-path.ts` — **one import line** rewritten (`escapesRoot` →
  `escapesRoot, resolveRealPathInRoot`), the `resolveConfinedMemoryPath` body (+13/−4) and its
  TSDoc. No other function in the file is touched.
- `src/core/memory-transition.ts` — **one import line** added (`import { requireConfinedTarget }
  from './confinement';`, immediately before the `./loaders` import), two lines inside
  `commitMemoryTransition`, and its TSDoc renumbered 1–4 to carry the new first check.
- `test/core/memory-add-confinement.test.ts`, `test/core/memory-transition-confinement.test.ts`,
  `test/storage/memory-path-confinement.test.ts` — new files, so they cannot conflict.
- **`src/core/index.ts` is NOT touched by this branch**, which is where `task-093`/`095`/`096`/`097`
  are working. Nothing in `src/*/index.ts` is touched either except that no barrel needed changing:
  `escapesRoot`/`resolveRealPathInRoot` were already exported by `src/storage/index.ts` and
  `requireConfinedTarget` by `src/core/index.ts`, both from `task-102`.

### Gates (run in this worktree, at `df2f8132` — `main` merged — plus these notes)

| Gate | Result |
|------|--------|
| `npx jest` | **145 suites / 2382 tests passed**, 0 failed |
| `npx jest --coverage` | **98.58 %** statements / 94.01 % branches / 99.41 % lines overall (≥ 80) |
| `npx tsc -p tsconfig.build.json --noEmit` | 0 errors |
| `npx tsc -p tsconfig.build.json` (emitting) | 0 errors |
| `npx tsc --noEmit -p tsconfig.json` (full, `test/**` included) | **0 errors, no exception** (`bug-026` stays closed) |
| `npm run lint` | clean, no output |
| `npm run docs:api` | clean, no output |

Coverage of what this task touched: `src/storage/memory-path.ts` **100 %** on every axis;
`src/core/confinement.ts` 100 %; `src/core/memory-transition.ts` 98.52 % statements / 100 % lines,
its single uncovered statement being line 163 — `prepareMemoryTransition`'s
`if (!(error instanceof ValidationError)) throw error;` rethrow, which this change does not touch.
`src/storage/confinement.ts` stays at 95 % with `task-102`'s documented fixed-point terminator as the
one uncovered statement. I did not measure `main`'s own coverage from this worktree, so the
non-regression claim I can support is the narrow one: no existing line left coverage, and every line
this branch adds to `src/` is covered.
