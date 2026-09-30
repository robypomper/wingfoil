---
id: "minor-v0.4"
type: release
title: "WingFoil v0.4 - Interaction Layer + Polish"
status: planning
version: "v0.4"
pillar: "P5"
features: [P1.4, P2.3, P4.18, P4.19, P4.20, P5.1.1, P5.1.2, P5.1.3, P5.1.4, P5.2.3, P5.4.5]
requirements: "docs/03_backlog/04_backlog/by-release/v0.4.json"
release-line: "v1"
tmpl_version: 260703
---

## Scope

v0.4 completes the Interaction Layer (P5) with full MCP server support, migration tooling for existing projects, and CLI polish. This release delivers `wingfoil init --mode infer` for adoption by teams already in development, `wingfoil audit` to scan and summarize project state, `wingfoil dna infer` to auto-propose project structure, `wingfoil memory import` to ingest existing documentation, and MCP Tools for agents to submit deliverables and update workflow state. The reference workflow templates (P4.18–P4.20: Scrum, Kanban, Lean Inception, Trunk-Based, with template expansion and customization) move here from v0.3, so a team adopting WingFoil can pick a methodology at `init` time. CLI help, error messages, and formatting are refined for intuitive user experience. The MCP server now exposes full Resources, Prompts, and Tools endpoints, completing the agent integration surface.

## Pillar Focus

**Pillar 5 (Interaction Layer)** provides the dual interface — CLI for humans, MCP for agents — that makes WingFoil accessible and deterministic. v0.4 shifts focus from greenfield project setup (v0.1) to migration and adoption of existing projects. By inferring DNA from codebase structure, auto-importing scattered documentation, and exposing state mutations via MCP Tools, v0.4 removes friction from the onboarding journey. Polish to help text and error messages ensures the tool stays intuitive as feature surface grows.

## Success Criteria

Per `docs/01_vision/07_sequencer.md` (Week 4 Definition of Done):

- All v0.3 features stable (no regressions)
- `wingfoil init --mode infer` functional
- `wingfoil audit` functional
- `wingfoil dna infer` functional (or simplified fallback)
- `wingfoil memory import` functional
- MCP server stable (Resources + Tools + Prompts all working)
- Reference workflow templates (Scrum, Kanban, Lean, Trunk-Based) functional
- CLI help + error messages polished
- >80% test coverage on all modules
- npm package v0.4.0 published
- Journey 5 (Casey - PM) and Journey 6 (Morgan - evolution) manually tested

## Execution Notes

### Planning (release-planning)

<!-- identify-specs: artefacts discovered late or missed; build-backlog: scope/estimation
     surprises, bugs selected for this release and their derived fix tasks. -->

**Scope change recorded during v0.3's define-scope (2026-09-29).** P4.18, P4.19 and P4.20 moved
here from `minor-v0.3` on the approver's ruling (`release-planning-rel-v0.3-plan` R3). The Success
Criteria already listed the reference templates. Carried with them for this release's planning: the
idea of composable **methodology packs** (directives + workflows + configuration per methodology,
selectable at `init` and addable afterwards, the first packs extracted from WingFoil's own workflows),
which the planning conversation proposed for this release. `bug-144` (the Kanban template includes a
workflow by path) stays in v0.3: the Kanban template already ships with `init --template`.
Also moved here from v0.3 (2026-09-30, plan R13): the git-hook half of the notification system
(X1.1); v0.3 notifies through the CLI output only.

### Implementation (dev-loop, per task)

<!-- Recurring blockers across tasks, tech-specs revised mid-release, review rejections and why,
     anything that deviated from the plan in Scope/Pillar Focus above. -->

### Submit & Publishing

<!-- pre-release-checks failures and fixes, approve-release rejections, publishing issues. -->
