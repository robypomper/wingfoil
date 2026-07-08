---
id: "minor-v0.2"
type: release
title: "WingFoil v0.2 - Project Directives"
status: in-development
version: "v0.2"
pillar: "P3"
features: [P1.6, P1.7, P1.8, P1.9, P1.10, P3.1, P3.2, P3.3, P3.4, P3.5, P3.6, P3.7, P3.8, P5.2.2]
requirements: "docs/03_backlog/04_backlog/by-release/v0.2.json"
release-line: "v1"
tmpl_version: 260703
---

## Scope

v0.2 delivers the Project Directives pillar (P3), enabling teams to encode and enforce "how we work" rules that both humans and AI agents respect automatically. This release introduces custom and built-in directive templates (Code Quality, Testing, Code Review, Architecture, Security, Documentation), role-based directive assignment, and auto-load functionality. Alongside, Memory's approval workflow matures with `submit`, `approve`, `reject`, `deprecate`, and `history` commands, completing the governance infrastructure needed for workflow integration in v0.3.

## Pillar Focus

**Pillar 3 (Project Directives)** is the governance layer that enforces consistency and quality across development. By binding directives to roles, WingFoil ensures that every developer, reviewer, and agent operates under the same rules without re-explaining expectations. This release makes explicit what was previously implicit, shifting from manual compliance checking to automated rule application. Directives are the difference between "hope people follow conventions" and "conventions are loaded automatically."

## Success Criteria

Per `docs/01_vision/07_sequencer.md` (Week 2 Definition of Done):

- All v0.1 features stable (no regressions)
- `wingfoil memory history` (audit trail) functional
- Directive commands work (`create`, `assign`, `remove`, `list`)
- Built-in directive templates (6 types: Code Quality, Testing, Code Review, Architecture, Security, Documentation)
- Role-based directive auto-loading functional
- MCP Prompts endpoint functional
- >80% test coverage on directive module
- Directive documentation + examples included
- npm package v0.2.0 published
- Journey 2 (Sam - review) and Journey 3 (Jordan - team dev) manually tested

## Execution Notes

### Planning (release-planning)

<!-- identify-specs: artefacts discovered late or missed; build-backlog: scope/estimation
     surprises, bugs selected for this release and their derived fix tasks. -->

### Implementation (dev-loop, per task)

<!-- Recurring blockers across tasks, tech-specs revised mid-release, review rejections and why,
     anything that deviated from the plan in Scope/Pillar Focus above. -->

### Submit & Publishing

<!-- pre-release-checks failures and fixes, approve-release rejections, publishing issues. -->
