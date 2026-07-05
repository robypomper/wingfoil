---
id: "bug-001-cli-version-flag"
type: bug
title: "wingfoil --version errors instead of printing the version and exiting 0"
status: planned
severity: medium
release: "v0.1"
feature: ""
tmpl_version: 260703
---

## Summary

`wingfoil --version` errors with `unknown option '--version'` and exits `1` instead of printing the
CLI version and exiting `0`, violating `spec-008-cli-grammar` (`--version` → print version, exit 0).

## Steps to Reproduce

1. Build the CLI: `npm run build` (produces `dist/cli.js`).
2. Run `node dist/cli.js --version` (equivalently `wingfoil --version` once globally installed).

## Expected Behavior

Per `spec-008-cli-grammar` §1 ("`--version` — Print CLI version and exit 0"): the command prints the
package version (from `package.json`) to stdout and exits with code `0`.

## Actual Behavior

Commander reports `error: unknown option '--version'` on stderr and the process exits `1`. `--version`
is not registered at all: `src/cli/program.ts`'s `buildProgram` never calls Commander's `.version()`.

## Notes

- **Root cause:** `buildProgram` (introduced in `task-006-dual-interface-shared-core`) registers global
  flags and per-`{noun,verb}` subcommands but never wires `.version(<pkg version>)`. The `wingfoil` bin
  entrypoint `src/cli.ts` (`task-007-npm-distribution`) inherits this.
- **Secondary defect (fix together):** `src/cli.ts`'s module doc comment AND `task-007`'s Execution
  Notes both **falsely state** that "`--help`/`--version` are handled by commander itself" — only
  `--help` is. Correct these inaccurate committed claims as part of the fix.
- **Suggested fix:** call `.version()` inside `buildProgram` reading the version from `package.json`
  (deterministically, no wall-clock), add a spawn-based assertion (`node dist/cli.js --version` → exit
  0 + version string) to the CLI integration test, and correct the two false claims.
- **Scope note:** the `--help` path already works and exits 0 (`task-007`'s AC), so this is a targeted
  gap, not a broad CLI-grammar failure. Full `spec-008` grammar (unknown-command suggestions, exit-2,
  precedence) is separately out of scope until a dedicated CLI-grammar task.
- Surfaced by `task-007-npm-distribution`'s independent review; rooted in `task-006`'s `buildProgram`.

## Triage & Execution Notes

- triage (bug-ingest, 2026-07-05): severity **medium** — a published-CLI convention (`--version`) is
  broken and committed code carries a false claim about it, but it is not on any acceptance-criteria
  path and has an obvious, low-risk fix. Awaiting triage/scheduling into a fix task.
