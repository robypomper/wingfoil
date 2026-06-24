# MVP Canvas — WingFoil v1.0 (MVP Complete)

**Version:** 1.0
**Date:** 2026-06-21
**Status:** Pending

---

## Problem

As projects grow and teams adopt AI agents for development, they lose consistency and control:

- **Context Management:** Brute-force approach (full codebase scans, massive context windows)
- **Decision Drift:** Conventions and decisions diverge across sessions and team members
- **No Shared Source of Truth:** Agents and developers operate independently
- **Governance Breakdown:** Rules are manual, leaky, and constantly need re-explaining
- **Reduced Determinism:** Even identical specs with different agents produce divergent codebases

**Impact:** Reduced determinism, increased governance overhead, constant rework, team friction.

---

## Solution

WingFoil is an open-source harness that gives humans and AI agents a **structured, authoritative interface** to a
project:

- **Project Memory** — git-backed storage for decisions and artifacts
- **Project DNA** — structural map of the project (modules, tech stack, conventions)
- **Project Directives** — role-based rules that both humans and agents respect
- **Workflow State Management** — unified tracking and communication of project flow, ensuring all actors maintain
  shared understanding of progress and blockers
- **Interaction Layer** — CLI for humans, MCP for agents

---

## Value Proposition

**For** developers and teams already using AI agents  
**WingFoil** makes the development process deterministic  
**By** centralizing memory, conventions, and directives — keeping them synchronized across all actors

---

## Target Users

| User                         | Problem                                     | Solution                                | Success                                         |
|------------------------------|---------------------------------------------|-----------------------------------------|-------------------------------------------------|
| **Alex** (solo dev)          | Re-explains context every session           | Load relevant info in 30 seconds        | Agent is pre-loaded; work starts immediately    |
| **Morgan** (tech lead)       | Conventions drift; governance is leaky      | Encode rules once; auto-load for agents | Rules are enforced; violations are caught early |
| **Casey** (non-tech manager) | Decisions are scattered; visibility is poor | Query decisions and audit trail         | Can answer strategic questions in minutes       |

---

## Key Features (MVP v1.0)

### All 5 Pillars Delivered

**Pillar 1: Project Memory (v0.1)**
✓ Git-backed document storage (`.wingfoil/memory/`)  
✓ Versioning & audit trail (git commits)  
✓ Add, search, history commands

**Pillar 2: Project DNA (v0.1)**
✓ Structured project map (`.wingfoil/dna.yaml`)  
✓ Tech stack, modules, conventions, team  
✓ Queryable resource paths (`wingfoil paths`)

**Pillar 3: Project Directives (v0.2)**
✓ Custom + built-in directive templates  
✓ Role-based assignment and auto-load  
✓ Versionable in git

**Pillar 4: Workflow State Management (v0.3)**
✓ Workflow configuration (`.wingfoil/workflows.yaml` main file + `include()` of built-in/custom workflows)  
✓ State machine: draft → pending → approved/rejected  
✓ Fallback on rejection, approval routing  
✓ Built-in workflow templates (Scrum, Kanban, Lean, Trunk-Based)

**Pillar 5: Interaction Layer (v0.4)**
✓ CLI commands (init, dna, memory, directive, workflow, agent)  
✓ MCP Server (Resources, Prompts, Tools)  
✓ Agent execution with auto-loaded context

**Not in MVP v1.0:**
✗ Semantic memory search (keyword search only)  
✗ Automated validation (manual review)  
✗ IDE plugins (MCP only)  
✗ Dashboard UI (CLI only)

---

## Metrics of Success

### North Star

**Determinism Index:** Two independent development runs from the same base (specs + WingFoil config) using different AI
agents should produce substantially equivalent software.

### Supporting Indicators

| Metric                       | Target                                                   | How Measured            |
|------------------------------|----------------------------------------------------------|-------------------------|
| **Adoption**                 | ≥1 real team using WingFoil by v0.2                      | GitHub issues, feedback |
| **Context Load Time**        | <30 seconds to load relevant Memory + DNA                | Agent session timing    |
| **Rule Compliance**          | 100% of agents receive correct directives for their role | MCP integration tests   |
| **Query Speed**              | DNA/Memory queries <1 second                             | CLI + MCP benchmarks    |
| **Audit Trail Completeness** | All decisions traceable to author + timestamp            | Git log verification    |

---

## Competitive Advantage

| vs.                      | WingFoil                                                                  | Them                     | Why WingFoil Wins                                            |
|--------------------------|---------------------------------------------------------------------------|--------------------------|--------------------------------------------------------------|
| CLAUDE.md / .cursorrules | Structured, queryable, multi-layer (Memory + DNA + Directives + Workflow) | Single flat file         | Scales with project growth; workflow state is explicit       |
| README + scattered docs  | Centralized, versioned, indexed, queryable                                | Scattered + hard to find | One source of truth; audit trail on changes                  |
| Large context windows    | Selective + curated (only relevant docs + role-based)                     | Load everything          | Deterministic + cheaper (fewer tokens); faster session start |
| Manual governance        | Rule binding + auto-load by role                                          | Manual per session       | Agents respect rules automatically; no re-explaining         |
| Implicit workflow state  | Explicit state management via Memory frontmatter                          | Informal updates         | All actors (human + AI) see shared project state             |

---

## Risks & Mitigations

| Risk                        | Mitigation                                       |
|-----------------------------|--------------------------------------------------|
| `dna infer` too complex     | Simplify heuristics; fallback to manual guidance |
| MCP integration delays      | Start early; lean on open MCP spec               |
| Documentation lag           | Minimize scope; prioritize README + examples     |
| Single developer bottleneck | Use AI agents for reviews and async work         |

---

## Success & Next Steps

### MVP Success Criteria (v1.0)

- ✓ All 8 user journeys executable and tested (0a, 0b, 1–6)
    - Journey 0a: New project initialization with template
    - Journey 0b: Existing project migration
    - Journey 1: Alex (solo dev) with auto-loaded context
    - Journey 2: Sam (code reviewer) with review workflow
    - Journey 3: Jordan (team developer) with auto-loaded directives
    - Journey 4: Morgan (tech lead) with governance enforcement
    - Journey 5: Casey (PM) with decision visibility
    - Journey 6: Morgan (tech lead) with workflow evolution
- ✓ Data integrity preserved (git versioning + audit trail work)
- ✓ CLI is intuitive and documented (help text, examples)
- ✓ MCP server is stable (<1 sec queries)
- ✓ All 5 pillars integrated and stable
- ✓ Published to npm with documentation

### If v1.0 MVP Succeeds

- Validate Determinism Index: two independent runs from same specs produce equivalent outputs
- Gather feedback from early adopters (Weeks 1–4 post-release Aug 7)
- Secure ≥1 real team using WingFoil in production by v0.2 milestone (achieved by Week 2 of release cycle)
- Prioritize v1.1+ roadmap: semantic search, dashboard UI, IDE plugins, automated validation
- Explore commercial positioning (white-label, enterprise features, SaaS model)

### If v1.0 Stalls or Fails

- Reassess critical path: identify Week of slip, reduce scope for that week + subsequent weeks
- Fallback options: drop advanced features (dna infer → manual, semantic search → defer, validation → defer)
- Pivot: focus on solo dev use case (Journeys 0a + 1) for v1.0, move team features to v1.1
- Extend timeline: push release dates forward, maintain pillar sequence

---

## Appendix: Documentation Reference

This MVP Canvas is part of a comprehensive product specification created via Lean Inception workshop (June 15–21, 2026):

| Document               | Version | Status   | Content                                                    |
|------------------------|---------|----------|------------------------------------------------------------|
| `0_product-brief.md`   | 1.1     | Approved | Executive summary, vision, success metrics, timeline, GTM  |
| `1A_product-vision.md` | 1.0     | Pending  | Vision statement, key decisions, reference workflows       |
| `1B_is-isnot.md`       | 1.0     | Pending  | What WingFoil is/isn't, does/doesn't do                    |
| `2_personas.md`        | 1.0     | Pending  | 6 personas: Alex, Sam, Jordan, Morgan, Casey, Taylor       |
| `3_journeys.md`        | 1.1     | Pending  | 8 user journeys (0a, 0b, 1–6) with scenarios and obstacles |
| `4_features.md`        | 1.0     | Pending  | 57 features across 5 pillars, organized by release version |
| `5A_sequencer.md`      | 1.0     | Approved | Development timeline: 5 weeks (v0.1–v1.0), weekly releases |
| `5B_mvp-canvas.md`     | 1.0     | Approved | This file — MVP canvas with success criteria               |

**All outputs are versioned in git and open for refinement as development progresses.**
