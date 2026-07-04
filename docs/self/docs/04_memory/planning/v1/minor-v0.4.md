---
id: "minor-v0.4"
type: release
title: "WingFoil v0.4 - Interaction Layer + Polish"
status: planning
version: "v0.4"
pillar: "P5"
features: [P1.4, P2.3, P5.1.1, P5.1.2, P5.1.3, P5.1.4, P5.2.3, P5.4.5]
requirements: "docs/03_backlog/04_backlog/by-release/v0.4.json"
release-line: "v1"
tmpl_version: 260703
---

## Scope

v0.4 completes the Interaction Layer (P5) with full MCP server support, migration tooling for existing projects, and CLI polish. This release delivers `wingfoil init --mode infer` for adoption by teams already in development, `wingfoil audit` to scan and summarize project state, `wingfoil dna infer` to auto-propose project structure, `wingfoil memory import` to ingest existing documentation, and MCP Tools for agents to submit deliverables and update workflow state. CLI help, error messages, and formatting are refined for intuitive user experience. The MCP server now exposes full Resources, Prompts, and Tools endpoints, completing the agent integration surface.

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

### Implementation (dev-loop, per task)

<!-- Recurring blockers across tasks, tech-specs revised mid-release, review rejections and why,
     anything that deviated from the plan in Scope/Pillar Focus above. -->

### Submit & Publishing

<!-- pre-release-checks failures and fixes, approve-release rejections, publishing issues. -->
