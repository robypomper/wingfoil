---
id: "minor-v0.3"
type: release
title: "WingFoil v0.3 - Project Workflow"
status: planning
version: "v0.3"
pillar: "P4"
features: [P4.1, P4.2, P4.3, P4.4, P4.5, P4.6, P4.7, P4.8, P4.9, P4.11, P4.13, P4.14, P4.15, P4.16, P4.18, P4.19, P4.20, P5.3.1, P5.3.2, P5.3.3, P5.4.1, P5.4.2, P5.4.3, P5.4.4, X1.1, X1.2]
requirements: "docs/03_backlog/04_backlog/by-release/v0.3.json"
release-line: "v1"
tmpl_version: 260703
---

## Scope

v0.3 delivers the Project Workflow pillar (P4) and agent execution (P5.3), unifying project progress tracking with approval cycles and AI agent integration. This release introduces workflow configuration (main/sub kinds, `include()` composition, `iterate_over`), all workflow commands (`start`, `end`, `next`, `status`, `list`, `show`, `create`, `remove`), per-type state machine validation, and the `wingfoil agent execute` wrapper that auto-loads role-based directives and Memory context. Reference workflow templates (Scrum, Kanban, Lean Inception, Trunk-Based) enable fast onboarding. Notification system (CLI + git hooks) alerts when approvals are required.

## Pillar Focus

**Pillar 4 (Project Workflow)** is the synchronization layer that keeps humans and agents aligned on project state. It tracks deliverables (releases, tasks, ADRs, specs, bugs) through explicit state machines, routes approvals by role, and recovers gracefully from rejections. Combined with Pillar 5.3 (Agent Execution), workflows enable agents to understand "what to do next" and agents to be trusted to execute with loaded directives and context. This is where the previous pillars (Memory, DNA, Directives) converge into actionable work.

## Success Criteria

Per `docs/01_vision/07_sequencer.md` (Week 3 Definition of Done):

- All v0.2 features stable (no regressions)
- Workflow commands functional (start, end, list, show, create, remove, next, status)
- Memory lifecycle verbs (submit/approve/reject) integrated into workflow steps
- State transitions working (per-type state machines; default draft → pending → approved/rejected; reject → fallback step)
- Approval routing by role functional
- Notification system (basic CLI output + git hooks) functional
- Agent execute wrapper (<30 sec context load) working
- >80% test coverage on workflow module
- npm package v0.3.0 published
- Journey 4 (Morgan - enforce) manually tested end-to-end

## Execution Notes

### Planning (release-planning)

<!-- identify-specs: artefacts discovered late or missed; build-backlog: scope/estimation
     surprises, bugs selected for this release and their derived fix tasks. -->

### Implementation (dev-loop, per task)

<!-- Recurring blockers across tasks, tech-specs revised mid-release, review rejections and why,
     anything that deviated from the plan in Scope/Pillar Focus above. -->

### Submit & Publishing

<!-- pre-release-checks failures and fixes, approve-release rejections, publishing issues. -->
