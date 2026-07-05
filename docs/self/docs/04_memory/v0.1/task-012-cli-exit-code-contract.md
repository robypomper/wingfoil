---
id: "task-012-cli-exit-code-contract"
type: task
title: "Infrastructure: REQ-INT-04 — CLI exit-code contract"
status: in-progress
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

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
