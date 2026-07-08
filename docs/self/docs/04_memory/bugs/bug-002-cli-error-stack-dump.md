---
id: "bug-002-cli-error-stack-dump"
type: bug
title: "CLI stack-dumps StorageError outside a git root, bypassing the spec-005 exit/error contract"
status: closed
severity: high
release-origin: "v0.1"
release: "v0.1"
feature: ""
tmpl_version: 260703
---

## Summary

Running any real `wingfoil <noun> <verb>` command from a directory that is not inside a git/WingFoil
project prints a raw `StorageError` with a full stack trace and absolute paths, instead of the single
`error: <message>` line that `spec-005-cli-command-contract` mandates — bypassing the contract's
single-exit-function guarantee (`spec-005` §1) and structured error format (`spec-005` §3).

## Steps to Reproduce

1. Build the CLI: `npm run build`.
2. From a directory with no `.wingfoil/` and no git root (e.g. `/tmp`), run
   `node /abs/path/dist/cli.js dna show`.

## Expected Behavior

Per `spec-005-cli-command-contract` §1 ("all exits route through a single exit function so the mapping
cannot be bypassed by an uncaught code path") and §3 (the `error: <message>` output format): the CLI
emits a single, clean diagnostic line (e.g. `error: not inside a WingFoil project (no .wingfoil/ found)`)
to stderr and exits with the mapped exit code — no stack trace, no absolute internal paths.

## Actual Behavior

stderr shows:

```
wingfoil: unexpected error: StorageError: E_NO_GIT_ROOT: <message>
    at <function> (/home/.../src/storage/git-root.ts:NN:NN)
    at ... (full stack trace with absolute paths)
```

The process exits `1` (the code happens to be correct), but the message is produced by `src/cli.ts`'s
top-level `catch` dumping `error.stack`, never routed through the CLI's `exitWith`/`emitError` path.

## Notes

- **Root cause (two layers):**
  1. `src/cli/registrar.ts` (`task-006-dual-interface-shared-core`) calls `options.resolveRoot()`
     **outside** its per-command `try/catch`, so a `resolveRoot` failure (no git root) escapes as an
     uncaught throw rather than a `CoreResult.error` rendered via the surface's error path.
  2. `src/cli.ts` (`task-007-npm-distribution`) has a top-level `catch` that writes
     `error.stack`, i.e. it stack-dumps instead of mapping the error through the spec-005 exit contract.
- **Why it matters:** running the CLI from the wrong directory is one of the most common first-use
  mistakes for a published CLI; a stack trace with absolute paths is poor UX and leaks internal
  structure. `task-007`'s reviewer called this the most substantive defect found (though outside
  `task-007`'s AC, which only required `--help` to exit 0).
- **Suggested fix:** move `resolveRoot()` inside the registrar's error handling so a missing root
  returns a `CoreResult.error` (code `NOT_FOUND`/`IO`), and/or have `src/cli.ts` map any escaped
  `StorageError` to the `spec-005` `error: <message>` format + mapped exit code instead of dumping
  `error.stack`. Add a spawn-based integration assertion (command run outside a git root → single
  `error:` line, no stack trace, correct exit code).
- Surfaced by `task-007-npm-distribution`'s independent review; rooted in `task-006`'s registrar.

## Triage & Execution Notes

- triage (bug-ingest, 2026-07-05): severity **high** — a user-facing contract violation
  (`spec-005` §1/§3) on a very common path (wrong working directory), leaking stack traces and
  absolute paths from a published CLI. Exit code is already correct, so not critical, but it should be
  fixed before any real `npm publish`. Awaiting scheduling into a fix task.

## Resolution

Fixed on branch `fix/bug-002` (bug-centric flow, no separate fix task — see
`docs/05_plans/X_fix-cli-bugs-plan.md`).

- **`src/cli/registrar.ts`** — moved `options.buildParams({… root: options.resolveRoot() …})`
  **inside** the per-command `try`, so a `StorageError` from `resolveRoot()` (e.g. `E_NO_GIT_ROOT`
  outside a WingFoil project) is rendered via `emitError` + `exitWith(1)` — the single spec-005 §1
  exit path — instead of escaping as an uncaught throw.
- **`src/cli.ts`** — the last-resort top-level `.catch` now emits only `error: <message>` (no
  `error.stack`), so a stack trace and absolute internal paths can never leak from the published CLI
  (spec-005 §3).
- **Tests** (test-first): `test/cli/registrar.test.ts` — a throwing `resolveRoot()` routes through
  `emitError`/`exitWith(1)`, not an escaped throw; `test/cli/npm-distribution.test.ts` — a real
  command spawned outside a git root emits a single `error:` line (no `at …` frame, no absolute
  path) and exits 1. Full suite green (216 tests), coverage > 80%, `tsc -p tsconfig.build.json` clean.
- Full spec-008 grammar (unknown-command suggestions, exit-2 precedence) remains out of scope.
