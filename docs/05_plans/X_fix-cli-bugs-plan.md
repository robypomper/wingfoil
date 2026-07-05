# Plan — Resolve task-007 follow-up CLI bugs (bug-001, bug-002)

> Interim workflow-plan (CLAUDE.md §6 / golden rule #7). No workflow engine yet, so this file stands
> in for the `bug`-resolution flow (`dev-loop`-shaped: design gate → TDD red/green/refactor → review →
> resolved/closed), executed by hand and coherent with the `bug` state machine in `memory.yaml`.

## Scope

Two defects surfaced by `task-007-npm-distribution`'s independent review, both rooted in
`task-006-dual-interface-shared-core`, both present on current `main`:

- **bug-002-cli-error-stack-dump** *(severity high — do first)*: a `wingfoil <noun> <verb>` run outside
  a git root stack-dumps a `StorageError` instead of the single `error: <message>` line spec-005 §1/§3
  mandates.
- **bug-001-cli-version-flag** *(severity medium)*: `wingfoil --version` errors with `unknown option`
  and exits 1 instead of printing the version and exiting 0 (spec-008 §1).

## Git strategy (parallel with the task-agent)

- **Isolation**: all work happens in the dedicated worktree `.claude/worktrees/fix-cli-bugs`
  (branched from `main`). The main folder stays the neutral integration tree; `main` is checked out
  only there. Aligns with `dl-014` (worktree isolation, `git.merge(ff:false)`), applied with a `fix/`
  prefix instead of `task/`.
- **One branch per bug**: `fix/bug-002`, then `fix/bug-001` (each `git checkout -b fix/bug-00N main`
  from the current `main` ref — never checking out `main` itself in this worktree).
- **Sync direction**: before merging, rebase the fix branch onto the latest `main` (shared object DB —
  no fetch) to absorb whatever the task-agent has landed. Never merge this worktree's work *into* the
  main folder while developing; only `main` → fix branch.
- **Merge gate (approver-serialized)**: a fix branch merges to `main` only once its bug is
  `resolved`/`closed`. The merge itself (`git merge --no-ff fix/bug-00N` in the main folder) is
  executed/authorized by the `approver` role (Roberto), one branch at a time — agents never merge to
  `main` autonomously (CLAUDE.md §4/§8). This is the single serialization point between the two agents.

## Bug state sequence (per `memory.yaml` `bug` machine)

`open → triaged → planned → in-progress → in-review → resolved → closed`

| Transition | Kind | Actor |
|---|---|---|
| `open → triaged` | approve (gate) | **approver (Roberto)** — triage already written in each bug body |
| `triaged → planned` | waiting (workflow action) | agent |
| `planned → in-progress` | waiting (fix start) | agent |
| *fix: red → green → refactor* | code commits | agent (developer) |
| `in-progress → in-review` | submit | agent |
| `in-review → resolved` | approve (gate) | **approver (Roberto)** — after review passes |
| `resolved → closed` | approve (gate) | **approver (Roberto)** |
| merge `fix/bug-00N → main` | manual gate | **approver (Roberto)** |

Each transition is exactly one git commit in the `wf(bug): …` format (CLAUDE.md §5.1), scoped to the
one bug file, committed on that bug's fix branch.

## bug-002 fix design (do first)

- **Root cause 1** — `src/cli/registrar.ts`: `options.resolveRoot()` is invoked at `buildParams(...)`
  time (~L59-63) *before* the `try` (L66), so a `resolveRoot` throw escapes the CLI error path.
  **Fix**: move `options.buildParams({… root: options.resolveRoot() …})` inside the `try`, so a thrown
  `StorageError` is rendered via `emitError(...)` + `exitWith(1)` (spec-005 §1 single-exit guarantee).
- **Root cause 2 (defense in depth)** — `src/cli.ts` top-level `.catch` dumps `error.stack`.
  **Fix**: emit only `error: <message>` (no stack, no absolute paths) and exit 1, so even a truly
  unexpected escape can't leak internal structure.
- **Tests (test-first)**:
  - `test/cli/registrar.test.ts` (unit, Commander-independent): a `resolveRoot` that throws a
    `StorageError` results in `emitError` + exit 1 — not a propagated throw.
  - `test/cli/npm-distribution.test.ts` (integration, real `dist/cli.js`): spawn `dna show` with
    `cwd` outside any git root → exit 1, stderr is a single `error: …` line, **no** `at …` stack frame
    and no absolute path.

## bug-001 fix design

- **Root cause** — `src/cli/program.ts` `buildProgram` never calls `.version()`.
  **Fix**: read the version from `package.json` deterministically (no wall-clock) and call
  `program.version(version)` so `--version` (and `-V`) print it and exit 0.
- **Secondary (committed false claim)** — correct `src/cli.ts`'s module-doc line stating
  "`--help`/`--version` are handled by commander itself" (only `--help` was); align the wording with
  the fix.
- **Tests (test-first)**:
  - `test/cli/program.integration.test.ts`: `--version` → exit 0, stdout contains the `package.json`
    version, stderr empty.
  - `test/cli/npm-distribution.test.ts`: same assertion against the real spawned `dist/cli.js`.

## Checks (dev-loop `refactor.checks.post` equivalent)

- `npx jest` green (new tests included); coverage stays > 80% (testing directive).
- `npx tsc -p tsconfig.build.json` clean.
- Determinism: version sourced from declared `package.json`, no wall-clock/randomness (REQ-SYS-07).
- Traceability: bug-002 → spec-005 §1/§3; bug-001 → spec-008 §1.

## Out of scope

Full spec-008 grammar (unknown-command closest-match suggestion, exit-2 precedence) — deferred to a
dedicated CLI-grammar task, per each bug's own scope note.
