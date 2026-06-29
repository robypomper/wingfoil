# Product Brief — WingFoil

**Version:** 1.2
**Date:** 2026-06-23  
**Status:** Approved

---

## Vision Statement

**For** developers and teams already using AI agents to write software  
**who** lose consistency and control over the development process as the project grows  
**WingFoil is** an open-source harness for AI-assisted software development  
**that** makes the process deterministic by giving both humans and AI agents a structured, authoritative interface to
the project
**Unlike** relying on large context windows or full codebase scans  
**our product** centralizes memory, conventions, directives and workflow state — keeping them synchronized across all
actors in the development process

---

## Core Problem

As software projects grow and teams adopt AI agents for development, they face a critical challenge:
**maintaining consistency and control becomes nearly impossible**.

**Symptoms:**

- Context is managed through brute force (full codebase scans, massive context windows)
- Decisions and conventions drift across sessions and between team members
- Agents and developers operate without a shared source of truth
- The larger the project, the worse the signal-to-noise ratio
- Governance is manual, leaky, and exhausting to maintain

**Impact:** Reduced determinism, increased governance overhead, and constant rework.

---

## Solution: WingFoil

WingFoil provides an open-source harness that gives humans and AI agents
a **structured, authoritative interface** to any software project:

### Five Pillars

1. **Project Memory** — Git-backed storage for decisions and artifacts
    - Centralized, versioned, queryable
    - Audit trail of who decided what and when

2. **Project DNA** — Structural map of the project
    - Modules, tech stack, conventions, resource paths
    - Source of truth for project anatomy; enables agents to navigate without full codebase scans

3. **Project Directives** — Role-based rules that both humans and agents respect
    - Custom directives (team-defined)
    - Built-in directives (WingFoil templates)
    - Scoped by role, auto-loaded for agents

4. **Project Workflow** — Unified tracking and communication of project flow
    - Commands to record development state and decisions
    - Configuration to expose workflow status to both developers and agents
    - Ensures all actors (human + AI) maintain a shared understanding of progress, blockers, and next steps

5. **Interaction Layer** — Dual interface
    - CLI for humans (init, dna, memory, directive, audit, workflow, etc.)
    - MCP Server for agents (read-only Resources, role-based Prompts, workflow commands)

This architecture ensures **determinism**: two independent development runs from the same specs + WingFoil config using
different AI agents produce substantially equivalent software. Even though code may diverge in form and style, its
substance remains identical. Additionally, two projects built from the same base configuration will generate similar
git tree (same checkpoint or flow commits), ensuring consistency across independent development efforts.

---

## Key Differentiators

| vs.                      | WingFoil                                                       | Them                     | Why WingFoil Wins                  |
|--------------------------|----------------------------------------------------------------|--------------------------|------------------------------------|
| CLAUDE.md / .cursorrules | Structured, queryable, multi-layer (Memory + DNA + Directives) | Single flat file         | Scales with project complexity     |
| README + scattered docs  | Centralized, versioned, indexed                                | Scattered + hard to find | One source of truth                |
| Large context windows    | Selective + curated (only relevant docs)                       | Load everything          | Deterministic + cheaper            |
| Manual governance        | Rule binding + auto-load                                       | Manual per session       | Agents respect rules automatically |
| Implicit workflow state  | Explicit workflow management + shared state                    | Informal updates         | All actors aligned on progress     |

---

## Target Users

### Alex — Solo Developer

- **Profile:** Full-stack developer, works alone on side projects or freelance. Daily driver: Claude Code or Cursor.
- **Pain:** Every new AI session starts from scratch. The agent re-discovers conventions, drifts from original intent.
- **Goal with WingFoil:** Load relevant project info in seconds; stop re-explaining context.

### Sam — Code Reviewer

- **Profile:** Developer on a team of 3–8, beginning to adopt AI tools. Currently uses AI agents only for code review
  and quality checks, not for writing code.
- **Pain:** Limited confidence in AI for development tasks yet; concerns about quality and team fit. Limited visibility
  into what conventions apply in reviews.
- **Goal with WingFoil:** Start simple with AI-assisted review workflows; gradually expand to other tasks as confidence
  grows. Maintain quality standards through clear directives.

### Jordan — Team Developer

- **Profile:** Mid-level developer on a team of 3–8, directed by a tech lead (like Morgan). Uses AI agents daily for
  code writing and exploration.
- **Pain:** Doesn't know what conventions Morgan has defined; agents ignore team rules. Hard to sync on what's been
  decided and where the project stands.
- **Goal with WingFoil:** Follow team directives automatically; stay aligned on project state without constant manual
  updates.

### Morgan — Tech Lead

- **Profile:** Senior developer leading a team of 3–8. Sets architecture, reviews PRs, defines conventions.
- **Pain:** Agents don't respect established rules unless explicitly reminded. Governance is manual and leaky. Difficult
  to keep team and agents synchronized on progress.
- **Goal with WingFoil:** Encode team rules once; have them auto-loaded and enforced. Track and communicate workflow
  state to the entire team.

### Casey — Non-Technical Manager

- **Profile:** Product manager, team lead, or stakeholder. Does not write code. Cares about delivery and velocity.
- **Pain:** Unclear what's been decided, what the process is, what risks exist, and what the team's actual progress is.
- **Goal with WingFoil:** Understand decisions and methodology; see clear audit trail; track project state and blockers.

---

## Success Metrics

### North Star

**Determinism Index:** Two independent development runs from the same base (specs + WingFoil config) using different AI
agents should produce substantially equivalent software, with shared understanding of project workflow state and
progress alignment across all team members and agents.

### Supporting Indicators

| Metric                       | Target                                                          |
|------------------------------|-----------------------------------------------------------------|
| **Adoption**                 | ≥1 real team using WingFoil by v0.4                             |
| **Context Load Time**        | <30 seconds to load relevant Memory + DNA + Workflow            |
| **Rule Compliance**          | 100% of agents receive correct directives for their role        |
| **Workflow State Sync**      | All team members + agents share current project state           |
| **Query Speed**              | DNA/Memory/Workflow queries <1 second                           |
| **Audit Trail Completeness** | All decisions and state changes traceable to author + timestamp |

---

## Market Position

**License:** MIT (open source)  
**Distribution:** npm package + GitHub  
**Monetization:** None (MVP); positioning for commercial offerings (v1+)

### Go-to-Market Strategy

**Incremental Release Roadmap:** WingFoil releases build progressively. Each version centers on a pillar, but shared
infrastructure (git storage, audit trail) and an early MCP Resources skeleton land in v0.1, reference templates arrive
with the Workflow pillar (v0.3), and some versions span more than one pillar. v1.0 integrates and stabilizes all five
rather than adding a new one.

**Phase 1 (v0.1):** Project Memory + Project DNA

- Core foundations: storage, querying, CLI basics
- Target: Solo developers (Alex) validating core workflow
- Focus: Determinism for memory + architecture
- **Dogfooding:** WingFoil itself becomes the first production user—WingFoil development is managed by WingFoil (v0.1+
  features used immediately)

**Phase 2 (v0.2):** + Project Directives

- Governance layer: role-based rules, auto-loading
- Target: Small teams (Morgan, Sam + early adopters)
- Focus: Team rule enforcement, first validation with real teams

**Phase 3 (v0.3):** + Project Workflow

- Unified state tracking and team synchronization
- Target: Expanding teams with Jordan-type developers
- Focus: Shared context, blockers, progress alignment

**Phase 4 (v0.4):** + Interaction Layer (polish & stabilization)

- CLI UX refinement, MCP stability, documentation
- Target: Broader adoption, production readiness; non-technical stakeholders (Casey) gain decision visibility
- Focus: User experience, reliability

**Version 1.0 (MVP Complete):** All five pillars integrated, stable, and battle-tested

**Target Channels:**

- GitHub (trending projects)
- Hacker News
- AI / developer communities (Twitter, Dev.to, Slack communities)
- Partner with Claude Code, Cursor, VS Code AI extensions

---

## Investment & Timeline

- **Team:** 1 developer (Roberto Pompermaier, supported by AI agents)
- **Release Cadence:** roughly one release per week, each centered on a pillar (some weeks deliver shared
  infrastructure or span two pillars; aggressive but achievable with AI support)
- **Estimate:** ~13 story points (v0.1), ~63 across the full MVP; roadmap TBD post-validation
- **Target Releases:**
    - **v0.1** (Project Memory + Project DNA): ~July 10, 2026
    - **v0.2** (+ Project Directives): ~July 17, 2026
    - **v0.3** (+ Project Workflow): ~July 24, 2026
    - **v0.4** (+ Interaction Layer): ~July 31, 2026
    - **v1.0** (MVP Complete): ~August 7, 2026

**Note:** Each release is technically oversized for a traditional 1-week sprint (would require 2–3 weeks without AI
support). This schedule assumes consistent AI-assisted development; additional buffers may be needed if velocity drops
or unforeseen blockers emerge. Proceed with this timeline and adjust if necessary during execution.

---

## Success Criteria

### v0.1 Success (Project Memory + DNA)

- ✓ Core foundations stable: Memory creation/read/update, DNA structure
- ✓ Data integrity preserved (git versioning works)
- ✓ CLI is intuitive and documented
- ✓ MCP server is stable (<1 sec queries)
- ✓ Solo developer (Alex) can complete Journey 1 end-to-end
- ✓ Released to npm

### v0.2 Success (+ Directives)

- ✓ Team developer (Jordan) and Tech Lead (Morgan) can define and enforce team rules
- ✓ Agents auto-receive correct directives for their role
- ✓ First pilot team trialing WingFoil for early validation

### v0.3 Success (+ Project Workflow)

- ✓ Team can track and share project state without manual updates
- ✓ All actors (humans + agents) stay aligned on progress and blockers
- ✓ Workflow state queryable and updateable via CLI + MCP

### v0.4 Success (+ Interaction Layer)

- ✓ Existing projects can adopt WingFoil via `init --mode infer` (Journey 0b)
- ✓ MCP server stable (Resources + Prompts + Tools) with <1 sec queries
- ✓ CLI help, formatting, and error messages polished
- ✓ Journey 5 (Casey) and Journey 6 (Morgan) executable end-to-end
- ✓ ≥1 real team using WingFoil in production

### v1.0 Success (MVP Complete)

- ✓ All five pillars integrated and stable
- ✓ ≥3 teams actively using WingFoil
- ✓ Determinism Index validated: two independent runs produce equivalent outputs
- ✓ Audit trail complete for all decisions and state changes

### If Initial Validation (v0.1) Fails

- Reduce scope: drop advanced Memory features (import, bulk operations)
- Pivot to solo dev use case (Alex only, Journey 1)
- Extend timeline, reassess viability

---

## Technical Stack

**Language & Runtime:** TypeScript, Node.js 18+ (npm)  
**Storage:** Git (local file-backed, YAML + Markdown)  
**CLI:** Commander.js, chalk for formatting  
**MCP Server:** Model Context Protocol (stdio transport, Anthropic SDK)  
**Validation:** Zod (JSON Schema)  
**Testing:** Jest (>80% coverage target)  
**Deployment:** npm registry (public), semantic versioning

---

## Known Constraints & Assumptions

- **Single Project:** One `.wingfoil/` instance per repo (multi-project in v1+)
- **Git-only Storage:** No cloud backend; all state versioned in git
- **Local First:** No real-time collaboration (async via git push/pull) (auto-sync in v1+)
- **Timeline:** 5 weeks (aggressive with AI support; buffer if velocity drops)
- **No IDE Plugins in MVP:** MCP sufficient; native integration in v1+
- **Keyword Search Only:** Semantic search deferred to v1.1+
- **Manual Approval Gates:** No automated workflow triggers in MVP

---

## References

This brief summarizes outputs from a 2-day Lean Inception workshop (June 2026). See the workshop plan in
[`X_lean-inception-plan.md`](X_lean-inception-plan.md).

**Core Documents:**

- [`02_product-vision.md`](02_product-vision.md) — Vision statement, key decisions
- [`03_is-isnot.md`](03_is-isnot.md) — Scope boundaries
- [`04_personas.md`](04_personas.md) — User types and pain points
- [`05_journeys.md`](05_journeys.md) — 8 end-to-end user journeys
- [`06_features.md`](06_features.md) — 63 features across 5 pillars

**Technical & Planning:**

- [`X_cli-cmds.md`](X_cli-cmds.md) — CLI commands reference (all pillars)
- [`07_sequencer.md`](07_sequencer.md) — Week-by-week timeline, Definition of Done
- [`08_mvp-canvas.md`](08_mvp-canvas.md) — MVP canvas and success criteria

All documents are versioned in git and open for refinement as development progresses.
