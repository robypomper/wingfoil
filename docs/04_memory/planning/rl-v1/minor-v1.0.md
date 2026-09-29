---
id: "minor-v1.0"
type: release
title: "WingFoil v1.0 - MVP Complete"
status: planning
version: "v1.0"
pillar: "P4"
features: [P4.10, P4.12, P4.17]
requirements: "docs/03_backlog/04_backlog/by-release/v1.0.json"
release-line: "v1"
tmpl_version: 260703
---

## Scope

v1.0 hardens and completes the Workflow pillar with atomic step execution (P4.10), comprehensive pre/post execution checks (P4.12), and refined built-in workflow templates for Task and Release patterns (P4.17). This final MVP release integrates all five pillars (Memory, DNA, Directives, Workflow, Interaction Layer) into a production-ready system, validates the Determinism Index (two independent runs from the same specs + config produce equivalent outputs), and publishes to npm. End-to-end testing covers all 8 user journeys; comprehensive documentation and troubleshooting guides enable early adopter onboarding.

## Pillar Focus

**v1.0 is the MVP completion milestone**, not a single pillar focus. The riskier execution and validation machinery — atomic step execution and workflow checks — is hardened after v0.3's command surface stabilizes. Workflow steps can now execute memory operations, git commands (branch, worktree, merge, commit), and agent tasks; pre/post checks validate file existence, frontmatter completeness, git history, and test coverage. This release transforms WingFoil from a configuration tool into an execution engine while maintaining the determinism guarantee that sits at the project's north star.

## Success Criteria

Per `docs/01_vision/07_sequencer.md` (Week 5 Definition of Done) and `08_mvp-canvas.md` (MVP Success Criteria):

- All v0.4 features stable (no regressions)
- All 8 user journeys (0a, 0b, 1–6) executable and tested
- Workflow checks (pre/post execution validation) working
- Atomic workflow steps executing correctly (memory, agent, git operations)
- Built-in workflow templates (Task, Release) functional and refined
- Comprehensive documentation (API guide, workflow examples, troubleshooting)
- Integration testing (end-to-end for all journeys) passing
- Determinism validation: two independent runs from same specs produce equivalent outputs
- Audit trail verified (all changes tracked to author + timestamp)
- npm package v1.0.0 published with release notes
- Security review completed (no secrets in repo, audit trail works)
- Ready for early adopter onboarding

## Execution Notes

### Planning (release-planning)

<!-- identify-specs: artefacts discovered late or missed; build-backlog: scope/estimation
     surprises, bugs selected for this release and their derived fix tasks. -->

### Implementation (dev-loop, per task)

<!-- Recurring blockers across tasks, tech-specs revised mid-release, review rejections and why,
     anything that deviated from the plan in Scope/Pillar Focus above. -->

### Submit & Publishing

<!-- pre-release-checks failures and fixes, approve-release rejections, publishing issues. -->
