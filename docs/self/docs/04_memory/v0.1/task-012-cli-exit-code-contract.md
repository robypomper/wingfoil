---
id: "task-012-cli-exit-code-contract"
type: task
title: "Infrastructure: REQ-INT-04 — CLI exit-code contract"
status: approved
release: "v0.1"
priority: "Medium"
tags: ["v0.1", "architecture"]
ref: "REQ-INT-04"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

Implement the single, shared exit-code layer (`src/cli/exit.ts`) that every `wingfoil` command routes
through, so process termination is a deterministic three-code contract rather than each command
inventing its own convention: `0` success, `1` user/logic error (well-formed invocation that fails on
business logic — element not found, illegal state transition, validation failure, git operation
failure), `2` usage/argument error (malformed invocation — unknown command/flag, missing required
argument, invalid `--format` value). Exactly one exit call per invocation, all routed through one
`exitWith` function so no code path can bypass the mapping. As Casey (a developer scripting WingFoil
into CI), I want every command's exit code to mean the same thing every time so that pipelines can
branch on it without special-casing individual commands.

## Acceptance Criteria

Per REQ-INT-04's fit criterion: "An automated matrix asserts the documented exit code for each
command on success, logic-error, and missing-argument inputs (e.g., missing `--reason` → `2`, unknown
document → `1`)."

Testable breakdown:
- `0`: command completes successfully, including any requested Memory/DNA/Directives/Workflow
  mutation being applied.
- `1`: valid invocation that fails on business logic — e.g. `wingfoil memory approve task/task-999
  --reason "..."` → `error: element not found: task/task-999`, exit `1`.
- `2`: malformed invocation — e.g. omitting `--reason` on `memory approve`/`memory reject` →
  `error: missing required argument: --reason`, exit `2`; an invalid `--format` value → exit `2`.
- `--help`/`--version` always exit `0`, even alongside otherwise-invalid arguments on the same
  invocation (they short-circuit parsing).
- Read-only query commands (`memory search`, `dna show`, `workflow status`, `paths`, …) only ever
  exit `0` or `1` — never `2` once argument parsing has succeeded.
- Every non-zero exit is accompanied by an `error: <reason>` (or structured-format equivalent)
  message on stderr — a bare non-zero exit with no message is a contract violation.
- See BDD `p1-memory/P1.3-memory-add.feature`, `p1-memory/P1.6-memory-submit.feature`,
  `p1-memory/P1.7-memory-approve.feature`, `p5-interaction/P5.1.4-cli-ux.feature`.

## Implementation Notes

- Full contract: `docs/self/docs/04_memory/design/specs/spec-005-cli-command-contract.md` §1
  (exit-code table + rules) and §3 (consistent error format, REQ-INT-08, shares the same
  `exitWith`/`emitError` plumbing).
- Grammar-level restatement and the exit-code table cross-check: `docs/self/docs/04_memory/design/specs/spec-008-cli-grammar.md` §5.
- `src/core` owns exit-code *selection* and error-message formatting (shared with `src/mcp-server`
  per REQ-SYS-05); `src/cli` only maps `core` results onto stdout/stderr + `process.exit` — do not
  duplicate the mapping logic in the CLI layer.
- This task is a cross-cutting foundation with no single dependent feature story in `related_stories`
  (backlog `TASK-010`) — every command-implementing task depends on it implicitly.

## Execution Notes

Worked on branch `task/task-012-cli-exit-code-contract` (dedicated worktree), in parallel with the
task-agent on task-011 (MCP Resources). Plan: `docs/05_plans/X_task-012-plan.md`.

- **design (scope finding):** the AC's headline examples are not exercisable today — `CORE_MODULES`
  (`src/core/index.ts`) registers only three read-only ops (`dnaShow`, `directivesList`,
  `workflowList`); there is no mutating op, no `--reason`/argument-bearing command, and unknown-command
  → `2` is deferred to spec-008 grammar (per `program.integration.test.ts`'s own note). Approver
  (Roberto) chose **"foundation + defer"**: deliver the REQ-INT-04 exit-code selection layer now, defer
  the argument/grammar-dependent AC cases to their owning tasks (see **Deferred** below).
- **green:** added `src/core/exit-code.ts` — `ExitCode` (canonical home) + `exitCodeForError`
  (`Record<CoreErrorCode, ExitCode>`; all five domain codes are logic errors → `1`; the `Record`
  forces exhaustiveness so a new code won't compile until its exit code is chosen) + `exitCodeForResult`
  (`0`/`1`). Exported via `src/core/index.ts`. `src/cli/registrar.ts` now terminates via
  `exitWith(exitCodeForResult(result))` instead of hardcoding `exitWith(0)`/`exitWith(1)`; `src/cli/exit.ts`
  re-exports `ExitCode` from core and keeps `exitWith` (the process-exit mechanism). `2` (usage) stays
  CLI-owned (invalid `--format`, pre-core).
- **tests:** `test/core/exit-code.test.ts` (every `CoreErrorCode` → 1; success → 0) and a
  `test/cli/registrar.test.ts` exit-code matrix (success → 0, each `CoreError` → 1 through dispatch,
  invalid `--format` → 2). Integration coverage of the 0/1/2 matrix already exists from prior work
  (`program.integration.test.ts` success→0 / invalid-format→2; `npm-distribution.test.ts` logic-error→1).
- **checks:** full suite green (282 tests), `exit-code.ts` + `registrar.ts` 100% covered, overall
  coverage 98.9% (> 80%), `tsc -p tsconfig.build.json` clean, eslint clean. Did NOT touch `src/mcp`
  (task-011's area) — no cross-agent conflict expected beyond a possible trivial `src/core/index.ts`
  export-line union at rebase.

**Deferred (out of scope, traced):**
- unknown-command → `2` + closest-command `hint:` (spec-005 §3.1 / spec-008 grammar) → a CLI-grammar task.
- missing-required-argument → `2` (e.g. `--reason`) → arrives with the argument-bearing commands
  (task-018+); the exit-code layer already returns `2` for the surface-detected usage-error class, so
  those commands only need to route their arg-validation through `exitWith(2, …)`.
