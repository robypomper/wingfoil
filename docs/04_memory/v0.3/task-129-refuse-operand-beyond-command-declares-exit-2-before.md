---
id: "task-129-refuse-operand-beyond-command-declares-exit-2-before"
type: task
title: "Refuse every operand beyond the one a command declares, with exit 2 and before any write"
status: backlog
release: "v0.3"
kind: "fix"
priority: "high"
tags: ["v0.3", "core", "cli", "grammar"]
ref: "dl-082"
bug: ["bug-131", "bug-171"]
depends_on: []
tmpl_version: 260703
---

## Description

`memory submit|approve|reject|deprecate|history` and `dna show` act on the first operand and silently drop the rest with exit 0 (`bug-171`); commands with no positional accept any (`allowExcessArguments(true)`, `src/cli/program.ts:192`; `bug-131`). Per `dl-082` each command takes at most one positional; only `dna set` refuses today. One registration-level refusal covers all commands, including the workflow and agent commands A and B add.

## Acceptance Criteria

- (red-first) `memory approve a b --reason x` exits 2, writes no commit, and names the command and the count; the same for every command in `CORE_MODULES` with a positional (table-driven test over the registry, so new commands are covered without editing the test).
- (red-first) `workflow list x` and `directives list developer` exit 2 (`bug-131`).
- (characterization) `dna set`'s migration message is unchanged.
- (characterization) `spec-008` §1 states "one id per call" and that the multi-id subject form `{id1}, {id2}` is historical only; carried to the agent-facing docs through `dl-025`'s `align-agent-docs` phase.

## Implementation Notes

- **Size:** S · **wave:** 0 · **kind:** fix (`dl-133` Q1 (b)).
- **Implements:** dl-082 (one positional per command); spec-008 §1; spec-005 §1 (REQ-INT-04).
- **Features:** P5.1.4, P1.7.
- **Notes:** Proposal key: C04.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
