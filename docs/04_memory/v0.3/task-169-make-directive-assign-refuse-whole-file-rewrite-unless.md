---
id: "task-169-make-directive-assign-refuse-whole-file-rewrite-unless"
type: task
title: "Make `directive assign` refuse the whole-file rewrite unless `--force`, and give successful operations a stderr warning channel"
status: pending
release: "v0.3"
kind: "feature"
priority: "medium"
tags: ["v0.3", "core", "directives", "cli"]
ref: "dl-062"
bug: []
depends_on: ["task-127-add-memory-amend-id-reason-approver-gated-verb"]
tmpl_version: 260703
---

## Description

`updateRoleAssignments` still takes a `#`-gated split: a whole-file `js-yaml` dump when the file has no comment, CONFLICT otherwise. dl-062 ratified CONFLICT whenever `setRoleAssignmentsInText` cannot apply. The whole-file rewrite becomes reachable only with `--force`, plus a stderr warning naming what it normalizes. A missing `roles.yaml` keeps the unflagged dump. The warning needs a channel no success result has today. `CoreResult`'s success arm carries only `value` and `commit`, and the registrar's success path writes only stdout. So this task adds `warnings` to the success arm, and a rendering rule: stderr on every `--format`, never stdout, and a field on the MCP Tool result. It also settles where a command-specific flag is documented in spec-008, since §2 claims universality.

## Acceptance Criteria

- (red-first) A committed `roles.yaml` with no `#`, whose shape `setRoleAssignmentsInText` cannot edit → `wingfoil directive assign` exits `1` with the pinned CONFLICT message; the file and HEAD are unchanged (`git status --porcelain` empty, no new commit).
- (red-first) The same input with `--force` → exit 0, one `wf`-scoped commit containing only `roles.yaml`, and stderr carries a `warning:` line enumerating the normalizations (comments, quoting, key order), per dl-062 Q1 option 3. Under `--format json` and `--format yaml` stdout parses and has the same content as without the warning.
- (characterization) With no `roles.yaml` committed, `directive assign` writes the whole file unflagged and emits no warning (dl-062: "nothing to preserve").
- (red-first) `coreOk` accepts `warnings: string[]`. The CLI registrar writes each to stderr and never to stdout. An MCP Tool result carries them in a declared field. A unit test per surface.
- (red-first) `docs/cli-reference.md` documents `--force` on `directive assign`; `test/docs/cli-reference.test.ts` passes.
- (characterization) spec-008 gets a dated Revision note: `--force` lives in a per-command-flag home (not §2 "Global flags"), and the CONFLICT and `global`-binding refusal strings are pinned beside the §6 error strings. The module TSDoc in `src/core/directive-assign.ts` no longer says "not implemented here".

## Implementation Notes

- **Size:** M · **wave:** 1 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** dl-062 (Q1 option 3, flag `--force`, approve `4cd18767`; addendum "Implementation scheduling (2026-09-21)" §2–§3).
- **Features:** P3.2, P5.1.4.
- **Notes:** Proposal key: E1. files `src/core/directive-assign.ts`, `src/directives/roles-edit.ts`, `src/core/types.ts`, `src/cli/registrar.ts`, the MCP Tool result path (`src/mcp/`), `src/dna/set.ts`, `docs/cli-reference.md`, spec-008. Coordinate with the task implementing dl-050 / spec-016 §"Print `ExecutionContext.warnings` on stderr" (domain B): same stderr convention, one renderer. dl-062 remains `ready`; its `release` stamp is the approver's call. `bug-019` (the same fallback on `dna set`) is task-193's, which depends on this task for the success-warning channel. task-218 prints `ExecutionContext.warnings` through the same renderer.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
