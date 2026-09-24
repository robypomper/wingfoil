---
id: "task-102-directive-remove-confines-its-deletion-to-the-project-root"
type: task
title: "Refuse before unlinking when a directive resolves outside the project root, so a symlinked `directives/custom` cannot cost someone a file they never pointed the tool at"
status: in-review
release: "v0.2"
priority: "high"
tags: ["v0.2", "directives", "security"]
ref: "bug-044-symlinked-directives-custom-escapes-confinement"
bug: ["bug-044-symlinked-directives-custom-escapes-confinement"]
depends_on: []
tmpl_version: 260703
---

## Description

When `.wingfoil/directives/custom` is a **symlink to a directory outside the project root**,
`wingfoil directive remove <name>` unlinks the outside file **for real**, and only then fails — with a
raw `Command failed: git … add -- …` that is not a `CoreError`, so the operator gets a leaked git
message instead of a mapped refusal, and nothing records that a file was deleted.

REQ-SEC-06 places the confinement boundary at the **project root**
(`resolveConfinedMemoryPath`, `src/storage`, from `task-017`). This crosses it, and it destroys.

It is not a default path — it needs a symlink, which is a deliberate act. But sharing a directive set
between projects is a reasonable thing to try, and the cost of trying it is a file gone from
somewhere the user never aimed the tool.

## Acceptance Criteria

**AC1 — reproduce first, and record the damage.** Build the CLI, create a scratch project whose
`.wingfoil/directives/custom` is a symlink to a directory outside it, put a directive file in that
outside directory, and run `directive remove`. Record: the exit code from `$?` directly, the stderr
verbatim, **and whether the outside file still exists**. That last one is the AC; the others are
context.

**AC2 — the check happens before the unlink, not after.** The order is the whole defect. Resolve the
target's real path, compare it against the project root, and refuse **before** any filesystem
mutation. A fix that deletes and then reports is not a fix.

**AC3 — the refusal is a mapped `CoreError` at exit 1**, per `spec-005` §1, with a message naming the
path and saying it resolves outside the project. No raw git text reaches the operator —
`bug-071`/`bug-093` are the same family and `bug-093` records the durable remedy.

**AC4 — use the existing primitive.** `resolveConfinedMemoryPath` (`src/storage`, `task-017`) already
computes this boundary. If it does not fit, say precisely why in the Execution Notes rather than
writing a second boundary check — two places deciding confinement is how a guarantee becomes a
suggestion.

**AC5 — symlink resolution, not string comparison.** The path must be resolved (`realpath`) before
comparing. A prefix check on the un-resolved path passes for exactly the input this bug is about.

**AC6 — the ordinary path is unchanged.** A directive genuinely inside the project still removes,
still commits, still exits 0. Characterize this before you touch anything.

**AC7 — the whole verb, not just this entry.** `directive remove` is one caller; check whether
`directive create` and `directive assign` resolve paths the same way and can be pointed outside by
the same symlink. If they can, say so and file it — do not widen this task silently.

## Implementation Notes

- AC1 is a **measurement**, AC2/AC3/AC5 are **red-first** under `dl-014`/T1, AC6 is
  **characterization**. Record the classification per AC.
- The fixture is the delicate part: a test that symlinks outside its own temp directory and then
  deletes is a test that can damage a developer's machine if the boundary logic is wrong. Build the
  outside directory **inside** a second `mkdtemp` so the blast radius is bounded, and assert the file
  survives rather than asserting an error string alone.
- `command-baseline` is now a `custom/` directive bound to `developer` and `reviewer` — read it. The
  read that decides whether to refuse here gates, so it resolves at `HEAD`; the working tree may be
  read to *explain* the refusal, never to decide it.

## Execution Notes

Branch `task/task-102-directive-remove-confines-its-deletion-to-the-project-root`, dedicated
worktree, from `main` at `5017555c`. `main` did not move during the run
(`git merge-base --is-ancestor main HEAD` → already merged), so `dl-035`'s merge-before-submit was a
no-op rather than a merge commit. Plan: `docs/05_plans/rl-v1/rel-v0.2/dev-loop-rel-v0.2-plan.md`.

### T1 acceptance-criterion classification (`dl-014`/T1, `testing` directive)

| AC | Classification | Why |
|----|----------------|-----|
| AC1 | **measurement** | Reproduce the shipped behaviour and record the damage; no test. |
| AC2 (refuse before the unlink) | **red-first** | `does not delete the outside file` failed on the shipped code with the outside file already destroyed. |
| AC3 (mapped `CoreError`, exit 1) | **red-first** | `refuses with a mapped CoreError …` threw `Command failed: git … add` out of `commitPaths` instead of returning a `CoreResult`. |
| AC4 (use the existing primitive) | design constraint, not a test | Discharged by extracting the boundary rather than duplicating it — see below. |
| AC5 (realpath, not string compare) | **red-first** | `resolveRealPathInRoot` asserts that the *textual* resolution is inside the root while the real one is not — the two disagreeing is the property, and it did not compile before the module existed. |
| AC6 (ordinary path unchanged) | **characterization** | Both AC6 tests — an ordinary in-project directive, and bug-044's benign symlinked `.md` *file* — passed on their first run, before any source change (`2 passed` in the red run below). |
| AC7 (the whole verb) | **measurement** | Probed `directive create` and `directive assign` first-hand; findings under "Proposed elements", not fixed here. |

### AC1 — reproduction on the shipped code, and the damage

Built `dist/` from this worktree at `5ca639b7` (`npm run build`, i.e. `tsc -p tsconfig.build.json`;
the source is byte-identical to `main` — the two commits before it are Memory frontmatter only) and
ran the scratch-project sequence from `bug-044`'s Steps to Reproduce:

```
$ node <wt>/dist/cli.js directive remove legacy-rule
fatal: pathspec '.wingfoil/directives/custom/legacy-rule.md' is beyond a symbolic link
error: Command failed: git -C /tmp/tmp.LTE57PWLoj/proj add -- .wingfoil/directives/custom/legacy-rule.md
fatal: pathspec '.wingfoil/directives/custom/legacy-rule.md' is beyond a symbolic link

$ echo $?
1
$ ls -la /tmp/tmp.LTE57PWLoj/outside
total 8
drwxrwxr-x 2 … .
drwx------ 4 … ..                 # <-- the outside file is GONE
$ git status --short               # (empty — nothing records the deletion)
```

**Whether the outside file survived: it did not.** That is the AC. Exit code `1` and the leaked
`Command failed: git …` are context, and they confirm `bug-044`'s own correction: the process does
not crash, it bypasses `exitCodeForError` and reports git's child-process text verbatim.

After the fix, the same script against a rebuilt `dist/`:

```
$ node <wt>/dist/cli.js directive remove legacy-rule
error: cannot remove '.wingfoil/directives/custom/legacy-rule.md': it resolves to
'/tmp/tmp.PktPNGoDVk/outside/legacy-rule.md', outside the project root. A path that leaves the
project is refused, never written to and never deleted; check whether a directory on the way to it
is a symlink.

$ echo $?
1
$ ls -l /tmp/tmp.PktPNGoDVk/outside
-rw-rw-r-- 1 … 106 … legacy-rule.md   # <-- survives
$ git log --oneline -1
58e0b99 plant symlinked custom dir     # <-- no commit was made
```

Note what `requireUnmodifiedTarget` (task-092) does **not** do here: `git status --porcelain -- <path>`
returns empty for a path beyond a symbolic link, so the `dl-080` write guard sees a clean target and
passes. The write half of `dl-080` and REQ-SEC-06 are answering different questions; neither
substitutes for the other.

### AC4 — the existing primitive, and why it needed extracting rather than calling

`resolveConfinedMemoryPath` (`src/storage/memory-path.ts`, task-017) could not be called as it
stands, for the two reasons `bug-044` already names: its signature is a Memory **path pattern** plus
placeholder `values`, and its comparison is **textual** (`resolve` + `relative`, no `realpath`
anywhere in `src/` before this change). `directive remove` holds neither a pattern nor a
placeholder set — it holds a concrete file it just read off disk — and the textual comparison is
exactly the one that passes for this input.

So rather than write a second boundary check next to it, the **decision** was extracted:
`escapesRoot(resolvedRoot, target)` now lives in `src/storage/confinement.ts` and
`resolveConfinedMemoryPath` calls it, unchanged in behaviour (`test/storage/memory-path.test.ts`
passes untouched). There is one definition of "inside the project root" in the codebase, with two
entry points onto it — the textual one for a path being *rendered*, and `resolveRealPathInRoot` for
a path that exists on disk. `workflow remove` (P4.9, unowned per `dl-030`) inherits the second
without re-deriving anything, which is what `bug-044`'s suggested fix asked for.

### AC5 — parent resolved, leaf deliberately not

`resolveRealPathInRoot` real-resolves the target's **parent directory** and keeps the target's own
basename. Resolving the leaf as well would refuse `bug-044`'s "benign case, verified safe" — a
symlinked `.md` *file* inside a real `custom/`, which removes correctly today because `unlink`
removes the link and git stages a symlink as an ordinary blob. It is reaching *through* a symlinked
**directory** that leaves the project. That asymmetry is pinned by two tests (one at the primitive,
one end-to-end through the registered `CoreFn`), because it is the kind of thing a later "simplify"
would undo.

The root is real-resolved too, so a project that itself lives under a symlinked path (`/tmp` →
`/private/tmp` on macOS; the jest fixtures all live under `tmpdir()`) does not read as its own escape.

### Order of operations

`requireConfinedTarget` sits immediately after `requireCustomAsset` — its string-level sibling — and
before `checkUnreferenced`, the `dl-080` write guard, `removeDocument` and `commitPaths`. The step
list in `directiveRemoveFn`'s TSDoc was renumbered 1–7 to carry it, and step 3's back-reference to
"step 6's write guard" was corrected to step 7 in the same pass.

### Files touched, and what a merge should watch

- `src/storage/confinement.ts` (new) — `escapesRoot`, `resolveRealPathInRoot`.
- `src/storage/memory-path.ts` — import line rewritten (`isAbsolute, relative, sep` dropped,
  `escapesRoot` added) and the inline escape computation replaced by the call.
- `src/storage/index.ts` — two export lines added after the `memory-path` export.
- `src/core/confinement.ts` (new) — `requireConfinedTarget`, the `CoreResult` mapping.
- `src/core/index.ts` — **one import line** added after `import { requireCustomAsset } from
  './builtin-asset';`, **one export line** after `export * from './builtin-asset';`, and a 6-line
  insert inside `directiveRemoveFn` (plus its TSDoc). `task-093`/`095`/`096`/`097` also touch this
  file: the import block and the barrel export block are the two regions where this branch's lines
  are adjacent to theirs, and `directiveRemoveFn` is otherwise untouched by them.
- `test/core/directive-remove-confinement.test.ts`, `test/storage/confinement.test.ts` (new) — new
  files, so they cannot conflict; the existing `test/core/directive-remove.test.ts` is untouched.

### Fixture safety

Both suites keep the "outside" directory in a **second** `mkdtemp` under `tmpdir()`, removed in
`afterEach` through `removeTempDir` whichever way the test goes, and the load-bearing assertion is
`existsSync(outsideFile) === true` plus byte-equality of its content — not an error string, which
would pass just as happily after the file had been destroyed.

### Gates (run in this worktree, at `ad302e84` + these notes)

| Gate | Result |
|------|--------|
| `npx jest` | **140 suites / 2313 tests passed**, 0 failed |
| `npx jest --coverage` | **98.54 %** statements / 93.96 % branches / 99.41 % lines overall (≥ 80) |
| `npx tsc -p tsconfig.build.json --noEmit` | 0 errors |
| `npx tsc -p tsconfig.build.json` (emitting) | 0 errors |
| `npx tsc --noEmit -p tsconfig.json` (full, `test/**` included) | **0 errors, no exception** (`bug-026` stays closed) |
| `npm run lint` | clean, no output |
| `npm run docs:api` | clean, no output |

Coverage of what this task added: `src/core/confinement.ts` 100 % on every axis;
`src/storage/confinement.ts` 100 % of lines and functions, 95 % of statements — the **one**
uncovered statement is `confinement.ts:53`, the `if (parent === current)` fixed-point terminator in
`realpathOfDirectory`. It is unreachable on any filesystem whose root real-resolves (`realpathSync('/')`
succeeds), and it is kept because without it a hypothetical failure at the root would be an infinite
loop rather than a bad answer. I did not re-measure `main`'s own coverage from this worktree (the
brief forbids checking `main` out here), so the non-regression claim I can actually support is the
narrow one: every line this branch adds to `src/` is covered except that terminator, and no existing
line was removed from coverage.

### AC7 — `directive create` and `directive assign` under the same symlink

Probed with the same fixed `dist/`, same scratch-project shape (`directives/custom` → a directory
outside the root):

- **`directive create` CAN be pointed outside, and is not fixed here.**
  `node dist/cli.js directive create --name new-rule` → `writeDocument` created
  `/tmp/tmp.whAI4JdOoS/outside/new-rule.md` (confirmed: the outside directory was empty before and
  held `new-rule.md` after), then `commitPaths` failed with the same raw
  `Command failed: git … add -- .wingfoil/directives/custom/new-rule.md`, exit `1`, nothing
  committed. It **creates** rather than destroys, so the loss is a stray file rather than a deleted
  one — but it is the same REQ-SEC-06 crossing and the same unmapped git text. Proposed as an
  element rather than absorbed, per AC7's "do not widen this task silently"; `requireConfinedTarget`
  is written to take the action verb (`'create'`) so the fix is a two-line wiring.
- **`directive assign` CANNOT be pointed outside by this symlink**, for two independent reasons,
  both read in the source rather than inferred: its only write target is the fixed
  `ROLES_YAML_PATH` = `.wingfoil/roles.yaml` (`updateRoleAssignments`, `src/core/directive-assign.ts`),
  which never traverses `directives/custom`; and it validates ids against `loadDirectivesAtHead`
  (`checkAssignable`, same file), so a file beyond a symlinked directory — which git cannot stage,
  and therefore cannot commit — is never in its inventory. Measured: `directive assign --directive
  new-rule --role developer` → `error: unknown directive: new-rule`, exit `1`, `roles.yaml`
  unchanged.

### Two residual findings, measured, not fixed

Both are outside this task's boundary (REQ-SEC-06 is about the **project root**, and both of these
stay inside it), both are proposed as elements in the hand-off report.

1. **An in-root symlinked `custom/` still deletes, then fails.** With `custom` → `.wingfoil/elsewhere`
   (inside the project), `directive remove legacy-rule` unlinks `.wingfoil/elsewhere/legacy-rule.md`
   and then fails on `git add` with the same raw text; `git status` afterwards shows
   ` D .wingfoil/elsewhere/legacy-rule.md`. Strictly milder than `bug-044` — the file is tracked, so
   `git checkout --` recovers it — but the same delete-then-report order and the same leak. It is
   *not* a confinement violation, so widening `requireConfinedTarget` to catch it would be the wrong
   mechanism; git's own rule ("beyond a symbolic link") is.
2. **A dangling symlink anywhere under `.wingfoil/directives/` breaks every directive read** with a
   raw `ENOENT … stat` at exit 1 — `directives list` (read-only) and `directive remove` alike. It
   comes from `collectFiles`' `statSync(full)` in `src/core/loaders.ts`, untouched by this task and
   present before it.
