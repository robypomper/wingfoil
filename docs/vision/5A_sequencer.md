# Sequencer — WingFoil MVP (v0.1 → v1.0)

**Version:** 1.0
**Date:** 2026-06-21
**Status:** Pending

---

## Timeline Overview

| Week  | Target Release | Focus                         | Deliverables                                                      | Go/No-Go  |
|-------|----------------|-------------------------------|-------------------------------------------------------------------|-----------|
| **1** | v0.1 (Jul 10)  | Core Infrastructure           | Memory, DNA, git integration, workflow schema, core CLI           | Must have |
| **2** | v0.2 (Jul 17)  | CLI + Directives              | Directives, workflow state tracking, directive assignment         | Must have |
| **3** | v0.3 (Jul 24)  | Agent Execution + Workflow    | Agent wrapper, workflow create/submit/approve/reject, MCP Prompts | Must have |
| **4** | v0.4 (Jul 31)  | MCP + Migration               | init --from-existing, audit, infer, import, MCP Resources         | Must have |
| **5** | v1.0 (Aug 7)   | Workflow Completion + Release | Workflow checks, fallback logic, templates, testing, npm publish  | Must have |

---

## Week-by-Week Breakdown

### Week 1 — v0.1: Project Memory + Project DNA (Jul 10)

**Goal:** Deliver Pillar 1 (Memory) + Pillar 2 (DNA). Build the storage, versioning, and structural foundation layers.

| Feature                                             | Effort               | Owner | Status |
|-----------------------------------------------------|----------------------|-------|--------|
| `.wingfoil/` directory structure                    | S                    | Dev   |        |
| Project Memory (file storage + git versioning)      | M                    | Dev   |        |
| Project DNA (YAML schema + validation)              | S                    | Dev   |        |
| Git integration (commit, blame, history)            | M                    | Dev   |        |
| `.gitignore` patterns for WingFoil                  | S                    | Dev   |        |
| `wingfoil init` (basic wizard)                      | M                    | Dev   |        |
| `wingfoil dna set/show`                             | S                    | Dev   |        |
| `wingfoil memory add`                               | M                    | Dev   |        |
| `wingfoil paths [category]` (resource path query)   | M                    | Dev   |        |
| MCP Resources skeleton (DNA + Memory endpoints)     | M                    | Dev   |        |
| `.wingfoil/workflows.yaml` schema (foundation only) | M                    | Dev   |        |
| Reference workflow templates (definition)           | M                    | Dev   |        |
| **Week 1 Total**                                    | **~12 story points** |       |        |

**Outputs:**

- v0.1 released: Project Memory + DNA fully functional
- Solo developers (Alex) can initialize projects and store decisions
- MCP Resources available for agents to query DNA and Memory
- Journey 0a (new project) and Journey 1 (Alex) can begin
- All state versioned in git with audit trail

**Blockers:** None (greenfield infrastructure)
**Risk:** Scope creep on MCP resources — keep read-only, defer writes to v0.2

---

### Week 2 — v0.2: Project Directives (Jul 17)

**Goal:** Deliver Pillar 3 (Directives). Build directive management and role-based binding.

| Feature                                        | Effort               | Owner | Status |
|------------------------------------------------|----------------------|-------|--------|
| `wingfoil memory search` (keyword search)      | M                    | Dev   |        |
| `wingfoil memory history` (audit trail)        | S                    | Dev   |        |
| `wingfoil directive create` (custom directive) | S                    | Dev   |        |
| `wingfoil directive add` (import built-in)     | M                    | Dev   |        |
| `wingfoil directive assign` (bind to role)     | M                    | Dev   |        |
| `wingfoil directive list` (query directives)   | S                    | Dev   |        |
| `wingfoil directive update` (modify existing)  | S                    | Dev   |        |
| Built-in directive templates (6 types)         | M                    | Dev   |        |
| Auto-Load Directives by Role (feature)         | M                    | Dev   |        |
| Role-Based Directive Assignment (feature)      | M                    | Dev   |        |
| MCP Prompts (role-based directive templates)   | M                    | Dev   |        |
| CLI testing + documentation                    | M                    | Dev   |        |
| **Week 2 Total**                               | **~12 story points** |       |        |

**Outputs:**

- v0.2 released: Project Directives fully functional
- Tech leads (Morgan) can define and assign team rules
- Agents auto-load directives by role
- Journey 2 (Sam - reviewer) can use directives in review
- Journey 3 (Jordan - team dev) auto-receives directives

**Blockers:** None (depends only on Week 1)

**Risk:** Directive complexity may overwhelm users — start with 3 built-in templates, add others in v0.3

---

### Week 3 — v0.3: Workflow State Management (Jul 24)

**Goal:** Deliver Pillar 4 (Workflow State Management). Build workflow commands and approval cycle.

| Feature                                                | Effort               | Owner | Status |
|--------------------------------------------------------|----------------------|-------|--------|
| `wingfoil workflow create {ELEMENT}` (draft)           | M                    | Dev   |        |
| `wingfoil workflow submit {ELEMENT}` (pending)         | M                    | Dev   |        |
| `wingfoil workflow approve {ELEMENT}`                  | M                    | Dev   |        |
| `wingfoil workflow reject {ELEMENT}`                   | M                    | Dev   |        |
| `wingfoil workflow next` (show next step + directives) | M                    | Dev   |        |
| `wingfoil workflow status` (show all workflows)        | S                    | Dev   |        |
| `wingfoil workflow start {workflow}`                   | S                    | Dev   |        |
| `wingfoil workflow end {workflow}`                     | S                    | Dev   |        |
| Deliverable state transitions (frontmatter + tracking) | M                    | Dev   |        |
| Workflow state deduction from Memory (feature)         | M                    | Dev   |        |
| Approval routing (role-based from DNA)                 | M                    | Dev   |        |
| Fallback on rejection (jump to previous step)          | M                    | Dev   |        |
| `wingfoil agent execute [--next]` wrapper              | M                    | Dev   |        |
| Agent role selection per workflow step                 | M                    | Dev   |        |
| Notification system (basic: CLI output + git hooks)    | M                    | Dev   |        |
| **Week 3 Total**                                       | **~15 story points** |       |        |

**Outputs:**

- v0.3 released: Workflow State Management fully functional
- Agents can be launched with full workflow context
- Workflow approval cycle complete (draft → pending → approved/rejected → fallback)
- Journey 1 (Alex) fully functional with workflow integration
- Journey 2 (Sam - reviewer) approval workflow functional
- Journey 3 (Jordan) task execution with auto-loaded directives functional
- Journey 4 (Morgan - enforce) governance through directives functional

**Blockers:**

- Agent wrapper must integrate cleanly with MCP (dependency: Weeks 1–2)
- Fallback logic is complex; start simple

**Risk:** Workflow state machine and fallback logic complexity. Fallback: simpler state machine (no fallback in MVP)

---

### Week 4 — v0.4: Interaction Layer + Polish (Jul 31)

**Goal:** Deliver Pillar 5 (Interaction Layer). Support existing projects and polish all features.

| Feature                                         | Effort               | Owner | Status |
|-------------------------------------------------|----------------------|-------|--------|
| `wingfoil audit` (scan project state)           | M                    | Dev   |        |
| `wingfoil init --from-existing`                 | M                    | Dev   |        |
| `wingfoil dna infer` (propose DNA from code)    | L                    | Dev   |        |
| `wingfoil dna show` enhancements                | S                    | Dev   |        |
| `wingfoil memory import` (import existing docs) | M                    | Dev   |        |
| MCP server (Node.js, stable)                    | M                    | Dev   |        |
| MCP Resources (DNA + Memory endpoints)          | M                    | Dev   |        |
| MCP Tools (workflow state management)           | M                    | Dev   |        |
| Reference workflow templates (Scrum, Kanban)    | M                    | Dev   |        |
| Template expansion + customization              | M                    | Dev   |        |
| CLI UX improvements (help, formatting, errors)  | M                    | Dev   |        |
| **Week 4 Total**                                | **~12 story points** |       |        |

**Outputs:**

- v0.4 released: Full Interaction Layer + Polish
- Existing projects can adopt WingFoil via `init --from-existing` (Journey 0b)
- Agents can query and update state via full MCP integration
- Journey 5 (Casey - PM visibility) fully functional
- Journey 6 (Morgan - workflow evolution) fully functional
- Built-in workflow templates reduce setup friction
- All CLI commands documented and user-friendly

**Blockers:**

- `dna infer` is highest complexity — if it slips, fallback to manual guidance
- MCP requires stable v0.1–v0.3 features

**Risk:** Scope creep on `dna infer`. Fallback: simpler heuristics or defer to v1.0

---

### Week 5 — v1.0: MVP Complete (Aug 7)

**Goal:** Complete workflow features, integration testing, and release as MVP.

| Feature                                                     | Effort               | Owner | Status |
|-------------------------------------------------------------|----------------------|-------|--------|
| Workflow checks (pre/post execution validation)             | M                    | Dev   |        |
| Checks: file.exists, frontmatter.required, git rules, tests | M                    | Dev   |        |
| Workflow steps with atomic actions (feature)                | M                    | Dev   |        |
| Element types + custom states configuration                 | M                    | Dev   |        |
| Workflow YAML validation + error handling                   | M                    | Dev   |        |
| Built-in workflow templates refinement & completion         | M                    | Dev   |        |
| Integration testing (all 6 journeys)                        | L                    | Dev   |        |
| Documentation (README, API guide, workflow examples)        | L                    | Dev   |        |
| Release testing + edge cases                                | M                    | Dev   |        |
| npm package setup + publish                                 | S                    | Dev   |        |
| Release notes + announcement                                | S                    | PM    |        |
| **Week 5 Total**                                            | **~13 story points** |       |        |

**Outputs:**

- v1.0 released: WingFoil MVP complete with all 5 pillars integrated
- All 6 journeys (0a, 0b, 1, 2, 3, 4) fully functional end-to-end
- All features from v0.1–v0.4 stable and polished
- Journey 5 (Casey) and Journey 6 (Morgan - workflow evolution) complete
- Comprehensive documentation and examples provided
- Published to npm with semantic versioning
- Ready for early adopter validation and feedback

**Blockers:** None (depends on Weeks 1–4)

**Risk:** Integration testing complexity. Mitigate with automated end-to-end tests and async AI code review

---

## Critical Path

```
Week 1 (v0.1: Memory + DNA) → Release July 10
    ↓
Week 2 (v0.2: Directives) ← depends on Week 1 → Release July 17
    ↓
Week 3 (v0.3: Workflow State) ← depends on Weeks 1-2 → Release July 24
    ↓
Week 4 (v0.4: Interaction Layer) ← depends on Weeks 1-3 → Release July 31
    ↓
Week 5 (v1.0: MVP Complete) ← depends on Weeks 1-4 → Release Aug 7
```

**No parallelization possible** — each pillar release depends on the previous. All features (Memory, DNA, Directives,
Workflow, Interaction) are integrated progressively across 5 weeks, with weekly releases on target dates.

---

## Risk Mitigation

| Risk                                                | Likelihood | Impact       | Mitigation                                                                 |
|-----------------------------------------------------|------------|--------------|----------------------------------------------------------------------------|
| Workflow state machine logic too complex            | High       | **Critical** | Start simple: draft → pending → approved only; no advanced fallback in MVP |
| `dna infer` complexity balloons                     | Medium     | High         | Simplify heuristics; fallback to manual guidance                           |
| Workflow checks validation (git, tests, etc.) slips | Medium     | High         | Move advanced checks to v0.2; MVP: basic file + frontmatter checks only    |
| Agent wrapper integration with MCP fails            | Medium     | High         | Prototype agent wrapper early in Week 2; test with MCP skeleton            |
| MCP spec changes or integration issues              | Low        | Medium       | Start MCP early in Week 3; test aggressively                               |
| Documentation lag                                   | Medium     | Low          | Keep docs minimal; focus on API examples + workflow-config.md              |
| Scope creep on directives validation                | High       | High         | Push automated CI/CD validation to post-MVP                                |
| Team velocity lower than estimated                  | Medium     | Medium       | Cut Week 5 if needed; push workflow checks + polish to v0.2                |

---

## Success Criteria (v1.0 MVP)

- ✓ All 6 user journeys executable and tested (0a, 0b, 1, 2, 3, 4)
    - ✓ Journey 0a: New project setup with template
    - ✓ Journey 0b: Existing project migration
    - ✓ Journey 1: Alex (solo dev) with auto-loaded context
    - ✓ Journey 2: Sam (reviewer) with review workflow
    - ✓ Journey 3: Jordan (team dev) with directives
    - ✓ Journey 4: Morgan (tech lead) with governance
- ✓ Journey 5 (Casey - PM visibility) and Journey 6 (Morgan - workflow evolution) functional
- ✓ Workflow state transitions work correctly (draft → pending → approved/rejected → fallback)
- ✓ Agent wrapper loads directives + context correctly in <30 seconds
- ✓ No data loss or corruption from git integration
- ✓ CLI is intuitive and self-documenting (`--help` works)
- ✓ MCP server is stable and responds under 1 second
- ✓ All 5 pillars integrated: Memory, DNA, Directives, Workflow, Interaction Layer
- ✓ Full integration testing (end-to-end) for all journeys
- ✓ Workflow YAML validation catches syntax errors
- ✓ Released to npm with correct metadata and documentation

---

## Capacity & Assignments

| Role          | Capacity       | MVP Assignments                   |
|---------------|----------------|-----------------------------------|
| Dev (Roberto) | 100%           | All feature development + testing |
| PM            | 20% (advisory) | Release notes, stakeholder comms  |
| UX            | Advisory       | CLI ergonomics review (async)     |

**Note:** Single developer — must be pragmatic about scope. Async code reviews with AI agents to unblock.
