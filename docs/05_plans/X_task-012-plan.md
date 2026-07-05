# Plan — task-012-cli-exit-code-contract (REQ-INT-04)

> Interim dev-loop plan (CLAUDE.md §6 / golden rule #7). Executed by hand on branch
> `task/task-012-cli-exit-code-contract` (worktree `.claude/worktrees/task-012-cli-exit-code`), in
> parallel with the task-agent on task-011 (MCP Resources). Role: developer (code-quality, testing,
> determinism).

## Design-gate finding (scope)

task-012's AC lists examples that are **not exercisable today**: `memory approve … --reason`,
missing-`--reason` → `2`, and unknown-command → `2`. The current `CORE_MODULES`
(`src/core/index.ts`) registers only three read-only ops (`dnaShow`, `directivesList`,
`workflowList`); no mutating op, no `--reason`, no argument-bearing command exists, and unknown-command
handling (exit `2`) is deferred to spec-008 grammar (documented in `program.integration.test.ts`).

**Scope decision (approved by Roberto — "Fondazione + rimando"):** deliver the REQ-INT-04 *foundation*
now and defer the argument/grammar-dependent AC examples to their owning tasks (task-018+ command
implementations; spec-008 grammar task). Documented in the task's Execution Notes.

## Deliverable

Move exit-code **selection** into `src/core` (so both surfaces share one mapping, REQ-SYS-05), and make
`src/cli` a pure applier.

- **`src/core/exit-code.ts`** (new):
  - `export type ExitCode = 0 | 1 | 2;` — canonical home for the selection type.
  - `exitCodeForError(error: CoreError): ExitCode` — maps `CoreError.code` via a
    `Record<CoreErrorCode, ExitCode>`; all five domain codes (`NOT_FOUND`, `INVALID_TRANSITION`,
    `VALIDATION`, `CONFLICT`, `IO`) are logic errors → `1`. The `Record` forces exhaustiveness: a new
    `CoreErrorCode` won't compile until its exit code is chosen here.
  - `exitCodeForResult(result: CoreResult<unknown>): ExitCode` — `0` on success, else
    `exitCodeForError(result.error)`.
  - `2` (usage error) is intentionally NOT produced here: usage errors are parse-level failures the
    surface detects before any core call — the surface's own concern (spec-005 §1).
- **`src/core/index.ts`** — `export * from './exit-code'`.
- **`src/cli/exit.ts`** — import `ExitCode` from `../core` (re-export for existing consumers); keep
  `exitWith` (the process-exit mechanism, spec-005 §1) unchanged.
- **`src/cli/registrar.ts`** — replace the hardcoded `exitWith(0)`/`exitWith(1)` on the `CoreResult`
  path with `exitWith(exitCodeForResult(result))`. The `--format`-invalid → `exitWith(2)` and the
  unexpected-throw → `exitWith(1)` stay in the CLI (both are surface-level, not per-CoreError-code
  mappings).

## Tests (test-first)

- **`test/core/exit-code.test.ts`** (new, unit): `exitCodeForError` returns `1` for every
  `CoreErrorCode`; `exitCodeForResult(coreOk(...))` → `0`, `exitCodeForResult(coreErr({code}))` → `1`
  for each code.
- **`test/cli/registrar.test.ts`** (extend): an explicit exit-code matrix (REQ-INT-04) — success → `0`,
  a `CoreResult.error` (representative `NOT_FOUND`) → `1`, invalid `--format` → `2` — asserting the CLI
  now routes the `0/1` decision through core's `exitCodeForResult`.
- Integration coverage for the 0/1/2 matrix already exists from prior work
  (`program.integration.test.ts`: success → 0, invalid `--format` → 2; `npm-distribution.test.ts`:
  logic error outside a git root → 1) — no new spawn test needed.

## Checks (refactor.checks.post equivalent)

- `npx jest` green (full), coverage > 80%.
- `npx tsc -p tsconfig.build.json` clean; eslint clean on changed files.
- Determinism: static `Record` mapping, no wall-clock/ordering (REQ-SYS-07).
- Traceability: task-012 → REQ-INT-04 → spec-005 §1; BDD P5.1.4-cli-ux.

## Coordination

Touches only `src/core` (+ one export line) and `src/cli` + tests — **not** `src/mcp` (task-011's area).
Rebase onto `main` before the (approver-gated) merge; the only plausible overlap is `src/core/index.ts`'s
export list, a trivial union if it occurs.

## Deferred (out of this task, traced)

- unknown-command → `2` + closest-command `hint:` (spec-005 §3.1 / spec-008 grammar) — owning: a
  CLI-grammar task.
- missing-required-argument → `2` (e.g. `--reason`) — arrives with the argument-bearing commands
  (task-018+ command implementations); the exit-code layer here already returns `2` for the
  surface-detected usage-error class, so those commands only need to route their arg-validation
  through `exitWith(2, …)`.
