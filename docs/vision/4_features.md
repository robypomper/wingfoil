# Features — WingFoil

**Version:** 1.0  
**Date:** 2026-06-21  
**Status:** Pending

---

## Feature List — Organized by Pillar

Features are organized into **5 Core Pillars** (P1–P5, with P1 including shared infrastructure) + **Extra Features** (
X1, X2).
Each feature includes: ID, Journey references, User personas, Description, and Type.

---

### **Pillar 1: Project Memory (P1)**

Centralized, git-backed storage for decisions, ADRs, RFCs, and project artifacts. **Note:** Features P1.1 and P1.2
provide shared infrastructure (git storage + versioning) used by all pillars (Memory, DNA, Directives, Workflow) to
persist their configuration and state files.

| ID   | Feature                                | Journey            | User                | Description                                                                                            | Type           |
|------|----------------------------------------|--------------------|---------------------|--------------------------------------------------------------------------------------------------------|----------------|
| P1.1 | Git-Backed Storage (foundational)      | 0a, 0b, 1, 2, 3, 4 | All                 | Centralized git repository for all project state (Memory, DNA, Directives, Workflow) in `.wingfoil/`   | Infrastructure |
| P1.2 | Versioning & Audit Trail (all pillars) | 1, 2, 3, 5         | Morgan, Casey       | All changes (Memory, DNA, Directives, Workflow) tracked via git with author, timestamp, commit message | Infrastructure |
| P1.3 | `wingfoil memory add`                  | 0a, 0b, 5          | Morgan, Alex, Casey | Create/add document to Memory in `.wingfoil/memory/`                                                   | Command        |
| P1.4 | `wingfoil memory import`               | 0b                 | Morgan, Alex        | Scan project for existing docs and import into Memory (interactive, with metadata extraction)          | Command        |
| P1.5 | `wingfoil memory search`               | 1, 3, 5            | Casey, Alex         | Query Memory by keyword and metadata                                                                   | Command        |
| P1.6 | `wingfoil memory history`              | 2, 3, 5            | Morgan, Casey       | View audit trail of a decision or document via git blame/log                                           | Command        |
| P1.7 | Memory Entries (git-backed)            | 0a, 0b, 1, 2, 3    | All                 | Store documents, decisions, artifacts in `.wingfoil/memory/` with versioning                           | Infrastructure |
| P1.8 | Keyword Memory Search                  | 1, 3, 5            | Alex, Casey         | Find relevant docs by keyword and metadata                                                             | Feature        |

---

### **Pillar 2: Project DNA (P2)**

Structural map of project (modules, tech stack, conventions, team structure in `.wingfoil/dna.yaml`).

| ID   | Feature                         | Journey         | User         | Description                                                                                     | Type           |
|------|---------------------------------|-----------------|--------------|-------------------------------------------------------------------------------------------------|----------------|
| P2.1 | `wingfoil dna set`              | 0a, 6           | All          | Define/update project DNA                                                                       | Command        |
| P2.2 | `wingfoil dna show`             | 3, 5            | Casey, All   | Query and display project DNA                                                                   | Command        |
| P2.3 | `wingfoil dna infer`            | 0b              | Morgan, Alex | Auto-scan codebase and propose DNA structure (human reviews/approves)                           | Command        |
| P2.4 | Project DNA (structured config) | 0a, 0b, 1, 2, 3 | All          | Define project anatomy (modules, tech stack, team members, conventions) in `.wingfoil/dna.yaml` | Infrastructure |
| P2.5 | `wingfoil paths [category]`     | 0a, 0b, 5       | All          | Query project resource paths by category (sources, tests, docs, config, governance); drill-down support; formats: console, json, yaml | Command        |

---

### **Pillar 3: Project Directives (P3)**

Role-based rules that humans and agents respect automatically (in `.wingfoil/directives/`).

| ID   | Feature                                | Journey      | User         | Description                                                                                         | Type           |
|------|----------------------------------------|--------------|--------------|-----------------------------------------------------------------------------------------------------|----------------|
| P3.1 | `wingfoil directive create`            | 0a           | Morgan, Alex | Create new custom directive file                                                                    | Command        |
| P3.2 | `wingfoil directive add`               | 0a, 0b       | Morgan, Alex | Add built-in directive template from WingFoil package                                               | Command        |
| P3.3 | `wingfoil directive assign`            | 2, 6         | Morgan       | Bind directive to role (defined in DNA)                                                             | Command        |
| P3.4 | `wingfoil directive list`              | All          | All          | List available directives (custom + built-in) and role assignments                                  | Command        |
| P3.5 | `wingfoil directive update`            | 2, 4, 6      | Morgan       | Modify existing directive                                                                           | Command        |
| P3.6 | Project Directives (custom + built-in) | 0a, 0b, 2    | Morgan, Alex | Define "how we work" rules, scoped by role; custom + built-in in `.wingfoil/directives/`            | Infrastructure |
| P3.7 | Auto-Load Directives by Role           | 1, 2, 3      | All          | Directives auto-load when agents/developers execute tasks with that role                            | Feature        |
| P3.8 | Role-Based Directive Assignment        | 0a, 0b, 2, 4 | Morgan       | Bind multiple directives to roles; one-to-many relationships                                        | Feature        |
| P3.9 | Built-in Directive Templates           | 0a, 0b, 0    | All          | Pre-configured templates: Code Quality, Testing, Code Review, Architecture, Security, Documentation | Feature        |

---

### **Pillar 4: Project Workflow (P4)**

Unified tracking of project progress, blockers, and deliverables (config in `.wingfoil/workflows.yaml`, state in
`.wingfoil/memory/` frontmatter).

| ID    | Feature                                     | Journey            | User          | Description                                                                                            | Type           |
|-------|---------------------------------------------|--------------------|---------------|--------------------------------------------------------------------------------------------------------|----------------|
| P4.1  | Project Workflow (configuration)            | 0a, 0b, 2, 3, 4, 6 | Morgan        | Define workflow structure (phases → steps → atomic actions) in `.wingfoil/workflows.yaml`              | Infrastructure |
| P4.2  | `wingfoil workflow start {workflow}`        | 0a, 0b             | Morgan, Alex  | Open workflow phase; initialize first step                                                             | Command        |
| P4.3  | `wingfoil workflow end {workflow}`          | 0a, 0b             | Morgan, Alex  | Close workflow phase; mark as complete                                                                 | Command        |
| P4.4  | `wingfoil workflow create {ELEMENT}`        | 2, 4               | Morgan, Alex  | Create deliverable from template (draft state)                                                         | Command        |
| P4.5  | `wingfoil workflow submit {ELEMENT}`        | 2, 4               | Morgan, Alex  | Submit deliverable for approval (pending state)                                                        | Command        |
| P4.6  | `wingfoil workflow approve {ELEMENT}`       | 2, 4, 5            | Morgan, Casey | Approve deliverable (approved state); records reason                                                   | Command        |
| P4.7  | `wingfoil workflow reject {ELEMENT}`        | 2, 4, 5            | Morgan, Casey | Reject deliverable; trigger fallback to previous step                                                  | Command        |
| P4.8  | `wingfoil workflow next`                    | 1, 4               | Alex, Morgan  | Show next step + directives for current role + task instructions                                       | Command        |
| P4.9  | `wingfoil workflow status`                  | 2, 3, 4, 5, 6      | Morgan, Casey | Show current state of all open workflows and pending approvals                                         | Command        |
| P4.10 | Workflow Steps (atomic actions)             | 0a, 0b, 1, 2, 4    | All           | Steps execute: memory.create, agent.execute, workflow.submit, git operations (branch, worktree, merge) | Feature        |
| P4.11 | Deliverables (Memory + State)               | 0a, 0b, 2, 4       | All           | Memory files with frontmatter state tracking (draft → pending → approved/rejected)                     | Feature        |
| P4.12 | Workflow Checks (pre/post execution)        | 0a, 0b, 1, 2, 4    | All           | Validation rules for steps (file.exists, frontmatter.required, git.commits, tests.coverage)            | Feature        |
| P4.13 | Workflow State Deduction (from Memory)      | 0a, 0b, 1, 2, 3, 4 | All           | State deduced from Memory file existence and frontmatter (no separate state index file needed)         | Infrastructure |
| P4.14 | Approval Routing (role-based from DNA)      | 0a, 0b, 2, 4       | Morgan, Casey | Define approvers by role (team members defined in `.wingfoil/dna.yaml`) or person                      | Feature        |
| P4.15 | Fallback on Rejection                       | 2, 4               | Morgan, Casey | Jump to previous step on rejection; optionally log feedback                                            | Feature        |
| P4.16 | Workflow include() Composition              | 0a, 0b, 4          | Morgan        | Reference sub-workflows and steps from other files via `include()`                                     | Feature        |
| P4.17 | Built-in Workflow Templates (Task, Release) | 0a, 0b, 2, 4       | All           | Pre-built workflows per common patterns                                                                | Feature        |

Pre-built methodology templates for fast onboarding.

| ID    | Feature                                  | Journey | User         | Description                                                                              | Type    |
|-------|------------------------------------------|---------|--------------|------------------------------------------------------------------------------------------|---------|
| P4.18 | `wingfoil workflow template list`        | 0a, 0b  | All          | List available reference workflow templates (Scrum, Kanban, Lean Inception, Trunk-Based) | Command |
| P4.19 | `wingfoil workflow template show {name}` | 0a, 0b  | All          | Display details of a template (phases, directives, Memory structure)                     | Command |
| P4.20 | Reference Workflow Templates             | 0a, 0b  | All          | Pre-built methodology templates: Scrum, Kanban, Lean Inception, Trunk-Based, Custom      | Feature |
| P4.21 | Template Expansion                       | 0a, 0b  | Alex, Morgan | Auto-generate phases, directives, Memory sections from selected template                 | Feature |
| P4.22 | Template Customization                   | 0a, 0b  | Morgan       | Override template defaults to match team style                                           | Feature |

---

### **Pillar 5: Interaction Layer (P5)**

Dual interface (CLI for humans, MCP Server for agents).

#### **5.1 — Project Initialization**

| ID     | Feature                           | Journey                  | User         | Description                                                                 | Type    |
|--------|-----------------------------------|--------------------------|--------------|-----------------------------------------------------------------------------|---------|
| P5.1.1 | `wingfoil init`                   | 0a                       | Alex, Morgan | Initialize WingFoil on new project (interactive wizard)                     | Command |
| P5.1.2 | `wingfoil init --from-existing`   | 0b                       | Morgan, Alex | Initialize WingFoil on existing project without restructuring               | Command |
| P5.1.3 | `wingfoil init --template {name}` | 0a                       | Alex, Morgan | Initialize project with reference workflow template                         | Command |
| P5.1.4 | `wingfoil audit`                  | 0b                       | Morgan, Alex | Scan project and summarize current state (languages, frameworks, structure) | Command |
| P5.1.5 | CLI UX Improvements               | 0a, 0b, 1, 2, 3, 4, 5, 6 | All          | Better help, formatting, error messages, shell integration                  | Feature |

#### **5.2 — Agent Execution**

| ID     | Feature                           | Journey        | User         | Description                                                                          | Type    |
|--------|-----------------------------------|----------------|--------------|--------------------------------------------------------------------------------------|---------|
| P5.3.1 | `wingfoil agent execute [--next]` | 0a, 1, 2, 4, 6 | All          | Wrapper that launches agent with auto-loaded context (directives, Memory, next task) | Command |
| P5.3.2 | Agent Role Selection per Step     | 0a, 1, 2, 4    | All          | Route agent to correct role based on current workflow step                           | Feature |
| P5.3.3 | Relevance Filtering               | 1, 2, 3        | Alex, Agents | Agent loads only relevant Memory docs, avoiding noise                                | Feature |

#### **5.3 — Agent Configurations**

| ID     | Feature                                             | Journey        | User         | Description                                                             | Type    |
|--------|-----------------------------------------------------|----------------|--------------|-------------------------------------------------------------------------|---------|
| P5.4.1 | Agent Role Definition                               | 0a, 1, 2, 3, 4 | Morgan       | Define available agent roles (developer, reviewer, QA, architect, etc.) | Feature |
| P5.4.2 | Agent Role → Directives Binding                     | 1, 2, 3, 4     | Morgan       | Bind directives to agent roles; auto-load at execution                  | Feature |
| P5.4.3 | Agent Context Pre-Loading                           | 1, 2, 3, 4     | Agents       | Auto-fetch DNA, Memory, directives based on role and task               | Feature |
| P5.4.4 | Agent Execution Context (DNA + Memory + Directives) | 1, 2, 3, 4     | Agents       | Structured context passed to agents at task start                       | Feature |
| P5.4.5 | Agent-Assisted Init Wizard                          | 0a, 0b         | Alex, Morgan | Natural conversation with AI agent for project setup                    | Feature |

#### **5.4 — MCP Server**

| ID     | Feature                            | Journey    | User   | Description                                                                   | Type   |
|--------|------------------------------------|------------|--------|-------------------------------------------------------------------------------|--------|
| P5.2.1 | MCP Resources (DNA + Memory)       | 1, 2, 3    | Agents | Agents can efficiently fetch DNA entries and Memory documents (read-only)     | Server |
| P5.2.2 | MCP Prompts (role-based templates) | 1, 2, 3    | Agents | Auto-load role-specific directives and instruction templates at session start | Server |
| P5.2.3 | MCP Tools (state management)       | 1, 2, 3, 4 | Agents | Agents can submit deliverables and update workflow state via MCP tools        | Server |

---

### **Extra 1: Notification System (X1)**

Notifications and alerts across all features.

| ID   | Feature                      | Journey | User          | Description                                  | Type    |
|------|------------------------------|---------|---------------|----------------------------------------------|---------|
| X1.1 | "Human Needed" Notifications | 2, 3    | Morgan, Casey | Notify when approval or decision is required | Feature |
| X1.2 | Notification Routing         | 2, 3    | Morgan, Casey | Route notifications by role/decision type    | Feature |

---

## Features by Release

### **v0.1 — Project Memory + DNA**

**Target Date:** July 10, 2026

| Feature ID | Feature                           | Complexity | Dependencies      | MVP Risk | Priority | Why                                       | Notes                                    |
|------------|-----------------------------------|------------|-------------------|----------|----------|-------------------------------------------|------------------------------------------|
| P1.1       | Git-Backed Storage (foundational) | Low        | Git               | Low      | Critical | Foundation for all pillars                | Stores all project state in `.wingfoil/` |
| P1.2       | Versioning & Audit Trail          | Low        | Git               | Low      | Critical | Enables change tracking and audit         | Via git commits automatically            |
| P1.3       | `wingfoil memory add`             | Low        | Git               | Low      | Critical | Core user workflow                        | Essential for all personas               |
| P1.5       | `wingfoil memory search`          | Medium     | Memory, file I/O  | Medium   | Critical | Find decisions quickly                    | Keyword search MVP; semantic post-MVP    |
| P1.7       | Memory Entries (git-backed)       | Low        | Git               | Low      | Critical | Storage layer for Memory pillar           | Shared infrastructure for all pillars    |
| P1.8       | Keyword Memory Search             | Medium     | Memory, file I/O  | Medium   | Critical | Query Memory by topic                     | Basic keyword matching                   |
| P2.1       | `wingfoil dna set`                | Low        | DNA               | Low      | Critical | Define/update project structure           | Basic CRUD operations                    |
| P2.2       | `wingfoil dna show`               | Low        | DNA               | Low      | Critical | Query project structure                   | Essential for all journeys               |
| P2.4       | Project DNA (structured config)   | Low        | None              | Low      | Critical | Storage layer for DNA pillar              | Shared infrastructure for all pillars    |
| P2.5       | `wingfoil paths [category]`       | Medium     | DNA (paths config) | Low      | High     | Query resource paths without full scan    | Supports drill-down and multi-format output |
| P5.1.1     | `wingfoil init` (basic wizard)    | Low        | DNA, Directives   | Low      | Critical | First user interaction                    | Q&A mode only; agent-assisted in v0.4    |
| P5.1.2     | `wingfoil init --from-existing`   | Medium     | Codebase scanning | Medium   | Critical | Adoption blocker for existing projects    | Infers DNA, suggests directives          |
| P5.1.4     | `wingfoil audit`                  | Medium     | Codebase scanning | Medium   | Critical | Understand current state before migration | Pre-requisite to 0b journey              |
| P5.2.1     | MCP Resources (DNA + Memory)      | Medium     | MCP spec, CLI     | Medium   | Critical | Agents can access project state           | Read-only; foundation for agent context  |
| P4.18      | `wingfoil workflow template list` | Low        | None              | Low      | High     | Reduce friction in init                   | Browse templates before selection        |
| P4.19      | `wingfoil workflow template show` | Low        | None              | Low      | High     | Help user choose template                 | Display template details                 |
| P4.20      | Reference Workflow Templates      | Low        | None              | Low      | High     | Fast onboarding with proven workflows     | Scrum, Kanban, Lean, Trunk-Based         |

---

### **v0.2 — Project Directives**

**Target Date:** July 17, 2026

| Feature ID | Feature                                | Complexity | Dependencies                | MVP Risk | Priority | Why                                 | Notes                                                                       |
|------------|----------------------------------------|------------|-----------------------------|----------|----------|-------------------------------------|-----------------------------------------------------------------------------|
| P3.1       | `wingfoil directive create`            | Low        | Built-in template library   | Low      | Critical | Teams define custom rules           | Custom directives for team style                                            |
| P3.2       | `wingfoil directive add`               | Low        | Built-in template library   | Low      | Critical | Adopt WingFoil best practices       | Built-in templates for common scenarios                                     |
| P3.3       | `wingfoil directive assign`            | Medium     | DNA (roles)                 | Medium   | High     | Bind rules to roles                 | Role defined in `.wingfoil/dna.yaml`                                        |
| P3.4       | `wingfoil directive list`              | Low        | None                        | Low      | High     | Discover available rules            | Essential for Morgan to manage                                              |
| P3.5       | `wingfoil directive update`            | Low        | None                        | Low      | Medium   | Evolve rules as team matures        | Versioned in git                                                            |
| P3.6       | Project Directives (custom + built-in) | Medium     | Memory, built-in templates  | Low      | Critical | Storage layer for Directives pillar | Shared infrastructure for all pillars                                       |
| P3.7       | Auto-Load Directives by Role           | Medium     | Directive system, templates | Medium   | Critical | Agents respect rules automatically  | Core value proposition                                                      |
| P3.8       | Role-Based Directive Assignment        | Low        | None                        | Low      | High     | Flexible role bindings              | One role → multiple directives                                              |
| P3.9       | Built-in Directive Templates           | Low        | None                        | Low      | High     | Reduce friction                     | Pre-configured: Testing, Code Review, Architecture, Security, Documentation |
| P5.2.2     | MCP Prompts (role-based)               | Medium     | Directive system, templates | Medium   | Critical | Agents receive instructions + rules | Auto-loaded at session start                                                |
| P4.21      | Template Expansion                     | Low        | None                        | Low      | High     | Generate workflow + directives      | From template selection                                                     |
| P4.22      | Template Customization                 | Low        | None                        | Low      | Medium   | Override defaults                   | Adapt templates to team                                                     |

---

### **v0.3 — Workflow State Management**

**Target Date:** July 24, 2026

| Feature ID | Feature                                     | Complexity | Dependencies                             | MVP Risk | Priority | Why                              | Notes                                                         |
|------------|---------------------------------------------|------------|------------------------------------------|----------|----------|----------------------------------|---------------------------------------------------------------|
| P4.1       | Project Workflow (configuration)            | Medium     | None                                     | Low      | Critical | Define team process              | v0.1 + v0.2 foundation                                        |
| P4.2       | `wingfoil workflow start`                   | Low        | Workflow config                          | Low      | Critical | Begin workflow phase             | Atomic operation                                              |
| P4.3       | `wingfoil workflow end`                     | Low        | Workflow config                          | Low      | Critical | Close workflow phase             | Atomic operation                                              |
| P4.4       | `wingfoil workflow create`                  | Medium     | Memory, state tracking                   | Medium   | Critical | Create deliverables              | From templates                                                |
| P4.5       | `wingfoil workflow submit`                  | Medium     | Memory, state tracking                   | Medium   | Critical | Submit for approval              | State transition                                              |
| P4.6       | `wingfoil workflow approve`                 | Medium     | Memory, state tracking                   | Medium   | Critical | Accept deliverable               | Records decision                                              |
| P4.7       | `wingfoil workflow reject`                  | Medium     | Memory, state tracking                   | Medium   | Critical | Request rework                   | With feedback                                                 |
| P4.8       | `wingfoil workflow next`                    | Low        | Workflow, directives                     | Low      | Critical | Know what to do next             | Essential for all journeys                                    |
| P4.9       | `wingfoil workflow status`                  | Low        | Workflow state                           | Low      | Critical | See project state                | For Casey + Morgan                                            |
| P4.10      | Workflow Steps (atomic actions)             | High       | Memory, Directives, Agent                | High     | Critical | Execute step logic               | Memory.create, agent.execute, git ops, submit, await-approval |
| P4.11      | Deliverables (Memory + State)               | Medium     | Memory, git versioning                   | Medium   | Critical | Track work items                 | Frontmatter-based state                                       |
| P4.12      | Workflow Checks (pre/post)                  | High       | File system, git, test runner            | High     | Critical | Enforce quality gates            | Validation rules                                              |
| P4.13      | Workflow State Deduction (from Memory)      | Low        | Git, Memory frontmatter                  | Low      | Critical | Deduce state from Memory files   | No separate `.wingfoil/state/` index needed                   |
| P4.14      | Approval Routing (role-based from DNA)      | Medium     | DNA (roles, team members), Notifications | Medium   | High     | Route approvals correctly        | Team members defined in `.wingfoil/dna.yaml`                  |
| P4.15      | Fallback on Rejection                       | High       | State machine, optional steps            | High     | High     | Handle rejections gracefully     | Return to previous step                                       |
| P4.17      | Built-in Workflow Templates (Task, Release) | Low        | None                                     | Low      | High     | Common workflow patterns         | Task + Release templates                                      |
| P5.3.1     | `wingfoil agent execute [--next]`           | Medium     | Agent SDK, MCP, Directives               | High     | Critical | Launch agents with context       | Foundation for agent journeys                                 |
| P5.3.2     | Agent Role Selection per Step               | Medium     | Workflow system                          | Medium   | High     | Route agent by step              | Correct role per phase                                        |
| P5.3.3     | Relevance Filtering                         | Medium     | Memory, Agent context                    | Medium   | Medium   | Load only relevant docs          | Avoid context window exhaustion                               |
| P5.4.1     | Agent Role Definition                       | Low        | None                                     | Low      | Critical | Define agent personas            | Developer, Reviewer, QA, Architect                            |
| P5.4.2     | Agent Role → Directives Binding             | Low        | Directive system                         | Low      | Critical | Auto-load rules for agent        | Core differentiator                                           |
| P5.4.3     | Agent Context Pre-Loading                   | Medium     | DNA, Memory, Directives                  | Medium   | Critical | Pre-fetch agent context          | <30 sec launch time                                           |
| P5.4.4     | Agent Execution Context                     | Medium     | MCP, Agent SDK                           | Medium   | Critical | Structured context passing       | DNA + Memory + Directives                                     |
| P5.2.3     | MCP Tools (state management)                | Medium     | Workflow state, MCP spec                 | Medium   | High     | Agents can update workflow state | Submit, approve, record memory                                |
| X2.1       | "Human Needed" Notifications                | Medium     | CLI hooks, git hooks                     | Medium   | High     | Alert on approvals needed        | Essential for Morgan + Casey                                  |
| X2.2       | Notification Routing                        | Medium     | DNA (roles), Notifications               | Medium   | Medium   | Route alerts by role             | Role-based or person-specific                                 |

---

### **v0.4 — Polish & Documentation**

**Target Date:** July 31, 2026

| Feature ID | Feature                           | Complexity | Dependencies                          | MVP Risk | Priority | Why                             | Notes                   |
|------------|-----------------------------------|------------|---------------------------------------|----------|----------|---------------------------------|-------------------------|
| P1.4       | `wingfoil memory import`          | Medium     | Memory, file I/O                      | Medium   | High     | Auto-import existing docs       | Reduce 0b friction      |
| P1.6       | `wingfoil memory history`         | Low        | Git log                               | Low      | Medium   | Audit trail for decisions       | Casey requirement       |
| P2.3       | `wingfoil dna infer`              | Medium     | Codebase scanning, language detection | Medium   | High     | Auto-detect DNA                 | Reduce 0b friction      |
| P5.1.3     | `wingfoil init --template {name}` | Low        | Template system                       | Low      | High     | CLI flag for templates          | v0.1 had menu selection |
| P5.1.5     | CLI UX Improvements               | Low        | None                                  | Low      | High     | Polish help, formatting, errors | Better user experience  |
| P5.4.5     | Agent-Assisted Init Wizard        | Medium     | Agent SDK, conversation               | Medium   | High     | Natural language setup          | Alternative to Q&A mode |

---

### **v1.0 — MVP Complete**

**Target Date:** August 7, 2026

| Feature ID | Feature                     | Complexity | MVP Risk | Priority | Why                                             |
|------------|-----------------------------|------------|----------|----------|-------------------------------------------------|
| —          | All v0.4 features stable    | —          | Low      | Critical | Production-ready; battle-tested                 |
| —          | Determinism Index validated | —          | Medium   | Critical | Two independent runs produce equivalent outputs |
| —          | ≥1 real team using WingFoil | —          | High     | Critical | Early adopter validation                        |

---

### **Post-MVP (v1.0+)**

| Feature                               | Complexity | MVP Risk | Why Deferred                                      |
|---------------------------------------|------------|----------|---------------------------------------------------|
| Semantic Memory search                | High       | Medium   | Keyword search works; NLP post-MVP                |
| Dashboard UI                          | High       | Medium   | CLI works; web UI post-MVP                        |
| IDE plugins                           | Medium     | Medium   | CLI + MCP sufficient; native integration post-MVP |
| Advanced notifications (Slack, email) | Medium     | Low      | Basic CLI notifications work                      |
| Workflow visualization                | High       | Medium   | Status commands work; visual Gantt post-MVP       |
| Process mining (auto-detect workflow) | High       | High     | Manual config in MVP; ML-based post-MVP           |
| Blockers & dependencies (full)        | Medium     | Medium   | Basic fallback works; critical path post-MVP      |
| Memory tagging & relationships        | Low        | Low      | Flat structure works; linked docs post-MVP        |
| Multi-project support                 | Medium     | Medium   | Single project in MVP; expand post-MVP            |

---

## MVP Feature Set Summary

**Core Infrastructure:**

- ✓ Git-Backed Storage (P1.1) — All state in `.wingfoil/`
- ✓ Versioning & Audit Trail (P1.2) — Via git commits

**Pillar 1 — Project Memory:**

- ✓ Memory Entries (P1.7) — `.wingfoil/memory/`
- ✓ Add, Search, History commands (P1.3–P1.6)
- ✓ Keyword search (P1.8)

**Pillar 2 — Project DNA:**

- ✓ Project DNA (P2.4) — `.wingfoil/dna.yaml`
- ✓ Set, Show, Infer commands (P2.1–P2.3)

**Pillar 3 — Project Directives:**

- ✓ Project Directives (P3.6) — `.wingfoil/directives/`
- ✓ Create, Add, Assign, Update commands (P3.1–P3.5)
- ✓ Built-in templates (P3.9)
- ✓ Auto-Load by Role (P3.7)

**Pillar 4 — Project Workflow:**

- ✓ Project Workflow (P4.1) — `.wingfoil/workflows.yaml`
- ✓ State deduced from Memory (P4.13) — no separate state file
- ✓ All workflow commands (P4.2–P4.9)
- ✓ Deliverables, Checks, Routing, Fallback (P4.11–P4.16)
- ✓ Git operations in workflow steps (P4.10)

**Pillar 5 — Interaction Layer:**

- ✓ CLI Commands (P5.1) — init, audit, etc.
- ✓ MCP Server (P5.2) — Resources, Prompts, Tools
- ✓ Agent Execution (P5.3) — auto-loaded context
- ✓ Agent Configurations (P5.4) — roles, directive binding

**Extra Features:**

- ✓ Reference Workflow Templates (P4.18–P4.22) — Scrum, Kanban, Lean, Trunk-Based
- ✓ Notification System (X1) — Basic approvals

**Total Features (MVP):** 57 core features across all pillars
**Release Timeline:** 4 weeks (v0.1 → v1.0)
**Target Adoption:** ≥1 real team by v0.2, ≥3 teams by v1.0

---

## Key Implementation Notes

### Workflow State Deduction (P4.13)

State is **deduced from Memory files**, not stored in a separate index:

- If `.wingfoil/memory/tasks/task-xyz.md` exists and has frontmatter `status: draft` → draft state
- If frontmatter `status: pending` → awaiting approval
- If frontmatter `status: approved` → approved

This avoids a separate `.wingfoil/state/workflows.md` index file and keeps state close to deliverables. Git tracks all
state changes via Memory file commits.

### Team Members & Approval Routing (P4.14)

Team members are defined in `.wingfoil/dna.yaml` under a `team:` section:

```yaml
team:
  members:
    - name: Morgan
      email: morgan@...
      roles: [ tech-lead, approver ]
    - name: Jordan
      email: jordan@...
      roles: [ developer ]
```

Approval routing references roles/people from DNA, enabling role-based approval without hardcoding emails.

### Git Operations in Workflow (P4.10)

Workflow steps can execute git operations:

- **Create branch**: For feature branches
- **Create worktree**: For parallel development
- **Merge**: After approval
- **Commit**: To record state changes

Example step configuration:

```yaml
- name: Code Review
  actions:
    - git.create_branch(task-id)
    - agent.execute(reviewer)
    - git.merge(to: main)
```

### Built-in Directive Templates (P3.9)

WingFoil provides pre-configured directive templates for common scenarios:

- **Code Quality**: Testing, linting, code coverage
- **Code Review**: Review checklist, approval gates
- **Architecture**: ADR requirements, tech decisions
- **Security**: Credential handling, secrets
- **Documentation**: README, API docs, decision logs

Teams can use `wingfoil directive add {template}` to adopt and customize.

### Agent Role Configurations (P5.4)

WingFoil supports the following agent roles, configurable per team:

- **Developer**: Writes code, creates features, applies code quality directives
- **Reviewer**: Reviews code/docs, checks against team standards, approves/rejects
- **QA**: Tests features, validates acceptance criteria, runs checks
- **Architect**: Makes design decisions, documents ADRs
- **Custom Roles**: Teams can define additional roles (e.g., "data-engineer", "security-lead")

Each role has:

- **Directives** bound to it (auto-loaded at execution)
- **Memory** documents it can access (role-specific context)
- **Workflow Steps** it can trigger
- **Approval Authority** (which roles can approve its work)

### Complexity, Risk, Priority Ratings

**Complexity:**

- **Low**: Straightforward implementation, few dependencies, proven patterns
- **Medium**: Moderate complexity, some integration required, standard approaches
- **High**: Complex state management, multiple dependencies, novel or complex patterns

**MVP Risk:**

- **Low**: Well-understood, low chance of MVP delay
- **Medium**: Some uncertainty, may require design iteration
- **High**: High complexity or novel feature; may impact timeline if issues arise

**Priority:**

- **Critical**: Blocks v0.1–v0.3 release or core journey; non-negotiable
- **High**: Important for adoption but can be deferred to v0.4 if necessary
- **Medium**: Nice-to-have in MVP; could move to post-MVP without major impact
- **Low**: Post-MVP or optional enhancements