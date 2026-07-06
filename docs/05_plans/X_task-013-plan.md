# Plan — task-013-machine-readable-formats (REQ-INT-05)

> Interim dev-loop plan (CLAUDE.md §6 / golden rule #7). Branch
> `task/task-013-machine-readable-formats`, worktree `.claude/worktrees/task-013-formats`, parallel to
> the task-agent. Role: developer (code-quality, testing, determinism).

## Design-gate finding (scope)

The `--format console|json|yaml` **infrastructure already exists on `main`** (built in task-006, used
by the exit-code work):
- `src/cli/output.ts` — `OutputFormat`, `isValidFormat`, `renderSuccess` (json/yaml/console).
- `src/cli/program.ts` — `--format` registered **once** on the root Commander `Command` (default
  `console`), inherited by every command (REQ-SYS-05 parity).
- `src/cli/registrar.ts` — invalid `--format` → exit `2`; `src/cli/error.ts` writes structured errors
  to stderr under json/yaml.

The AC's literal fit criterion targets `wingfoil paths` and `wingfoil workflow status`, **neither of
which exists** (CORE_MODULES has only `dnaShow`/`directivesList`/`workflowList`; `paths` is task-028).

**Scope decision (approver: "verify + defer"):** no new production code is needed — deliver the
REQ-INT-05 **verification suite** (the fit criterion the requirement asks for) against the currently
existing commands, confirm the envelope is complete, and defer the literal `paths`/`workflow status`
parse checks to those commands' tasks (documented in Execution Notes).

## Deliverable (tests only — infrastructure already present)

- **`test/cli/output.test.ts`** (new, unit — the REQ-INT-05 envelope contract on `src/cli/output.ts`):
  - `isValidFormat`: true for `console`/`json`/`yaml`, false otherwise.
  - `renderSuccess(value, 'json')` → `JSON.parse` round-trips to `value`; single top-level value; ends
    with `\n`; no extra lines.
  - `renderSuccess(value, 'yaml')` → a standard YAML parser (`js-yaml` `load`) round-trips to the same
    structure as the json case.
  - `renderSuccess(value, 'console')` is the default shape (pretty JSON, same structure).
  - json and yaml carry the **same logical structure** (parse both → deep-equal).
- **`test/cli/program.integration.test.ts`** (extend — fit criterion end-to-end against existing
  commands as stand-ins for paths/workflow-status): for `dna show` (representative), assert
  `--format json` → `JSON.parse` and `--format yaml` → `js-yaml load` produce the **same** parsed
  structure, with `stderr` empty (no diagnostics/banners interleaved — envelope rule). Existing tests
  already cover invalid-`--format` → 2 and json parse for dna/directives/workflow list.

## Checks (refactor.checks.post equivalent)

- `npx jest` green (full), coverage > 80% (unchanged production code stays covered).
- `npx tsc -p tsconfig.build.json` clean; eslint clean on changed files.
- Determinism: `renderSuccess` is a pure function of `(value, format)`; no wall-clock/ordering.
- Traceability: task-013 → REQ-INT-05 → spec-005 §2; BDD P2.5-paths / P4.5-workflow-status.

## Coordination

Touches only `src/cli` tests — no production code, not `src/mcp`/`src/core`. `main` already includes
task-011 (merged). Rebase before the approver-gated merge; conflict surface ≈ none (test files only).

## Deferred (out of this task, traced)

- `wingfoil paths --format json|yaml` parse checks → task-028 (`paths` command).
- `wingfoil workflow status --format json|yaml` parse checks → the `workflow status` command task.
  The envelope these will inherit is verified here against the existing commands, so those tasks only
  add their own payload shape.
