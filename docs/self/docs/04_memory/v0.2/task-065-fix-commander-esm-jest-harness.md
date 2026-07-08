---
id: "task-065-fix-commander-esm-jest-harness"
type: task
title: "Fix bug-007: make CLI entry-point wiring testable under Jest (commander ESM)"
status: backlog
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "cli"]
ref: "P5.1"
bug: "bug-007-commander-esm-jest-untestable"
depends_on: []
tmpl_version: 260703
---

## Description

Fix **bug-007**: `commander` v15 is ESM-only, so `src/cli/program.ts` / `src/cli.ts` cannot be loaded by the CommonJS Jest runtime — the CLI wiring is excluded from tests and coverage. Establish an ESM/Jest harness (or equivalent) so the wiring is exercised automatically.

## Acceptance Criteria

From `bug-007`:
- A test can import/exercise `src/cli/program.ts` under the project test runner.
- `tsc --noEmit` clean (no `TS1479` on the ESM `commander`).
- CLI entry-point wiring appears in the coverage report.
- Options: Jest ESM/`ts-jest` ESM preset, a bundling step, or pinning a CommonJS-compatible commander.

## Implementation Notes

Source: `bug-007` (triaged). Root cause: `commander@^15` ESM-only (chosen in task-001). Unblocks automated coverage of the CLI surface for all v0.2 CLI verbs. dev-loop syncs via `bug: bug-007`.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
