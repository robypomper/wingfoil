---
id: "task-033-manual-e2e-journey-validation"
type: task
title: "Manual E2E validation of Journey 0a + Journey 1"
status: backlog
release: "v0.1"
priority: "Critical"
tags: ["v0.1", "qa"]
ref: "docs/self/docs/04_memory/planning/v1/minor-v0.1.md"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

`docs/self/docs/04_memory/planning/v1/minor-v0.1.md`'s Success Criteria explicitly requires "Journey
0a (new project) and Journey 1 (Alex) manually tested end-to-end" before v0.1 can be considered done —
no BDD scenario or unit test substitutes for actually walking a human through the real CLI. This task
performs that manual walkthrough once every other v0.1 task is implemented, against **Journey 0a —
"Initialize WingFoil on a New Project"** and **Journey 1 — "Alex: Start a New AI Session with Full
Context"** as described in `docs/01_vision/05_journeys.md`:

- **Journey 0a** steps: (1) create a new repo/project files; (2) run `wingfoil init` (interactive
  wizard) and confirm it guides through DNA, directives, Memory docs, workflow config, including
  reference-workflow selection (Scrum/Kanban/Lean Inception/Trunk-Based/Custom) and both wizard mode
  and agent-assisted mode; (3) start the kickoff workflow phase via `wingfoil workflow start --name
  [workflow]`; (4) verify project structure paths via `wingfoil paths` / `wingfoil paths sources
  --list`. Success bar: "Within minutes, WingFoil is initialized with sensible defaults ... No manual
  YAML editing required."
- **Journey 1** steps: (1) review the next task via `wingfoil workflow next`; (2) launch the agent via
  `wingfoil agent execute --next`; (3) confirm the agent auto-loads role-based directives + prompt via
  MCP Prompts; (4) confirm the agent queries project DNA + Memory via MCP Resources; (5) confirm the
  agent executes the task with full context and Alex can review/approve. Success bar: "Task begins
  within 30 seconds of session start ... No context window exhaustion."

v0.1 only ships a subset of each journey's tooling (Memory `add`/`search`, DNA schema + `show`/`set`,
`init`, `paths`, MCP Resources for DNA+Memory — see `minor-v0.1.md` Scope); this task validates exactly
the v0.1-scoped slice of each journey's steps end-to-end, and explicitly notes which later-pillar steps
(`workflow start`, `workflow next`, `agent execute`, MCP Prompts) are out of v0.1's scope and therefore
smoke-tested only as far as v0.1's implemented surface allows, or flagged as a known gap rather than a
release blocker.

## Acceptance Criteria

- Journey 0a, steps 1–2 and 4 above are executed manually against the actual v0.1 CLI on a fresh
  throwaway project: `wingfoil init` runs to completion, produces a valid `dna.yaml` (schema-valid per
  `spec-002-dna-yaml-schema`) plus initial Memory scaffolding, with no manual YAML editing required;
  `wingfoil paths` / `wingfoil paths sources --list` correctly reports the mapped resource paths
  afterward.
- Journey 0a step 3 (`wingfoil workflow start`) and Journey 1 steps 2–4 (`wingfoil agent execute
  --next`, MCP Prompts/Resources auto-load) are attempted; since `workflow`/`agent`/MCP Prompts are not
  in v0.1's Scope (`minor-v0.1.md` Pillar Focus: P1 Memory + P2 DNA only), any failure here is recorded
  as an explicit **known gap** (not a release blocker) rather than silently skipped.
- Journey 1 step 1 (`wingfoil workflow next`) is smoke-tested to the extent the v0.1 MCP Resources
  endpoint (DNA + Memory) supports it; findings recorded either way.
- A written record of the walkthrough (pass/fail per step, screenshots or terminal transcript, gaps
  found) is attached to this task's Execution Notes before the release moves to `release-submit`.
- Any defect found during the walkthrough that blocks the journeys' v0.1-scoped success bar is filed as
  a `bug` (per the `bug-ingest` workflow) and linked back here via `ref`, and this task does not close
  until that bug is resolved or explicitly deferred by the approver.

## Implementation Notes

- This is a **gating/closing task**: it validates the release as a whole and therefore must run last,
  after all other v0.1 tasks (`task-001` through `task-030`, plus `task-031`/`task-032`) are
  implemented — there is nothing meaningful to walk through before then.
- Scope the pass/fail judgment to what v0.1 actually promises (per `minor-v0.1.md` Scope/Success
  Criteria) — do not fail this task over journey steps that belong to pillars (Directives, Workflow,
  Interaction Layer's `agent execute`) not yet built in v0.1; document them as gaps instead.
- Coordinate with `task-032` (README/quick-start): the Journey 0a walkthrough is also the practical
  check that the new README is followable by a real user.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
