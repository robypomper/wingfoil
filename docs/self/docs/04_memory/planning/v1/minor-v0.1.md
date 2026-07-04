---
id: "minor-v0.1"
type: release
title: "WingFoil v0.1 - Project Memory + DNA"
status: in-development
version: "v0.1"
pillar: "P1"
features: [P1.1, P1.2, P1.3, P1.5, P1.11, P1.12, P1.13, P2.1, P2.2, P2.4, P2.5, P5.1.1, P5.2.1]
requirements: "docs/03_backlog/04_backlog/by-release/v0.1.json"
release-line: "v1"
tmpl_version: 260703
---

## Scope

v0.1 delivers the foundational infrastructure for Project Memory and Project DNA pillars. This release establishes git-backed storage (`.wingfoil/` directory), implements core Memory CRUD commands (`add`, `search`), and defines the DNA schema for structural project mapping. All state is versioned in git with full audit trail, enabling subsequent pillars (Directives, Workflow, Interaction Layer) to build upon these foundations.

## Pillar Focus

**Pillar 1 (Project Memory)** and **Pillar 2 (Project DNA)** provide the essential shared infrastructure for all other pillars. Memory stores versioned decisions and project artifacts; DNA maps the project's structure (modules, tech stack, conventions, team). Together they form the single source of truth that humans and agents reference throughout the software development lifecycle. v0.1 focuses on storage durability and queryability — the bedrock upon which governance and workflow state will be tracked in later releases.

## Success Criteria

Per `docs/01_vision/07_sequencer.md` (Week 1 Definition of Done):

- Git storage layer functional (`.wingfoil/` structure, commit tracking)
- Memory commands work (add, search)
- DNA YAML schema defined and validated
- CLI commands tested locally (`init`, `dna set/show`, `memory add/search`, `paths`)
- MCP Resources endpoint (DNA + Memory) functional
- >80% test coverage on core modules (storage, validation)
- README + quickstart guide documented
- npm package published with v0.1.0 tag
- Journey 0a (new project) and Journey 1 (Alex) manually tested end-to-end

## Execution Notes

### Planning (release-planning)

<!-- identify-specs: artefacts discovered late or missed; build-backlog: scope/estimation
     surprises, bugs selected for this release and their derived fix tasks. -->

### Implementation (dev-loop, per task)

<!-- Recurring blockers across tasks, tech-specs revised mid-release, review rejections and why,
     anything that deviated from the plan in Scope/Pillar Focus above. -->

### Submit & Publishing

<!-- pre-release-checks failures and fixes, approve-release rejections, publishing issues. -->
