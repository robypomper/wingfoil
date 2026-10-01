---
id: "task-130-show-coreerror-details-surface-give-refusal-shape-under"
type: task
title: "Show `CoreError.details` on every surface and give every refusal one shape under `--format`"
status: in-progress
release: "v0.3"
kind: "fix"
priority: "high"
tags: ["v0.3", "core", "cli", "mcp", "errors"]
ref: "dl-055"
bug: ["bug-114", "bug-123"]
depends_on: []
tmpl_version: 260703
---

## Description

`emitError` (`src/cli/error.ts:14-20`) prints only `reason` and `hint`, and the MCP registrar keeps only `error.message`, so `details` (the offending file, `dl-032`'s `detail`) reach no operator (`dl-055`). Parse-path errors hard-code `format: 'console'` (`src/cli/program.ts:103,144`; `bug-114`), and the same confinement refusal is `IO` from `memory add` and `VALIDATION` from the transition verbs (`bug-123`). Agents under `agent execute` parse `--format json`; B's `spec-016` error shape (`{error, hint?, details?}`) builds on this.

## Acceptance Criteria

- (red-first) console: detail lines follow the contract line; json/yaml: an additive `details` array; MCP: `error.data.details` (`dl-055` option 1).
- (red-first) an unknown option, a missing option argument and an unknown command under `--format json` print one JSON object on stderr, same shape as a core refusal; exit codes unchanged.
- (red-first) a path outside the project root is refused with one code from `memory add` and from all four transition verbs (the code chosen in design and stated in `spec-005` §3).
- (characterization) `spec-005` §3 carries the details rule and the chosen confinement code, with a Revision note.

## Implementation Notes

- **Size:** M · **wave:** 1 · **kind:** fix (`dl-133` Q1 (b)).
- **Implements:** dl-055 option 1; spec-005 §3 (REQ-INT-08), §3.2; spec-004 (MCP `error.data`).
- **Features:** P5.1.4, P5.2.1.
- **Notes:** Proposal key: C09.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
