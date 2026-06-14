# WingFoil

**A structured harness for deterministic AI-assisted software development.**

WingFoil solves a critical problem: as your software project grows, AI agents lose consistency and control. Context gets
scattered, conventions drift, and decisions made in one session don't carry forward to the next.

WingFoil centralizes your project's **memory, DNA, and directives** in a structured, git-backed format — giving both
humans and AI agents a shared source of truth.

---

## The Problem

When using AI agents to write software, you face growing friction:

- **Context collapse:** Large context windows and full codebase scans become expensive and noisy
- **Convention drift:** Agents don't respect established patterns unless you re-explain them every session
- **Decision scatter:** Architectural decisions, patterns, and constraints live in Slack, old docs, or nowhere
- **Governance gaps:** No way to enforce rules consistently across human developers and AI agents

The larger the project, the worse the signal-to-noise ratio.

---

## The Solution

WingFoil provides a **structured, authoritative interface** to your project:

- **Project Memory** — Git-backed storage for decisions, artifacts, and domain knowledge
- **Project DNA** — Structural map of modules, tech stack, and conventions
- **Project Directives** — Role-based rules that both humans and agents respect
- **Workflow State Management** — Unified tracking and communication of project flow, progress, and blockers
- **Interaction Layer** — CLI for humans, MCP for agents

This keeps everything synchronized and deterministic.

---

## Who It's For

**Alex, the Solo Developer**  
Every new AI session forces you to re-explain context. WingFoil loads relevant info in seconds — no more context loss
between sessions.

**Sam, the Code Reviewer**  
You're starting with AI for code review but aren't confident enough for full development yet. WingFoil lets you enforce
quality standards and gradually expand AI usage as you gain confidence.

**Jordan, the Team Developer**  
You don't know what conventions your tech lead has defined, and agents ignore team rules. WingFoil keeps everyone
aligned on directives, decisions, and project state without constant manual updates.

**Morgan, the Tech Lead**  
You need agents to follow the team's rules automatically, not invent new ones. WingFoil encodes governance once; it
auto-loads for every agent. It also keeps the whole team synchronized on progress and blockers.

**Casey, the Manager**  
You need visibility into decisions and methodology. WingFoil provides an audit trail, queryable knowledge base, and
real-time tracking of project state.

---

## Key Features (MVP - v0.1 through v1.0)

### Five Pillars

- ✓ **Project Memory** — Git-backed document storage with versioning and audit trail
- ✓ **Project DNA** — Structured config: modules, tech stack, conventions
- ✓ **Project Directives** — Custom and built-in rules, scoped by role
- ✓ **Workflow State Management** — Track and communicate project status, progress, and blockers
- ✓ **Interaction Layer** — CLI for humans, MCP Server for agents

### CLI Commands

```bash
wingfoil init                    # Start a new WingFoil project
wingfoil init --from-existing    # Set up WingFoil on an existing codebase
wingfoil audit                   # Scan and summarize current project state

wingfoil dna set                 # Define project structure
wingfoil dna infer               # Auto-scan codebase and propose DNA
wingfoil dna show                # Query project structure

wingfoil directive create        # Write custom rules
wingfoil directive add           # Add built-in rule templates
wingfoil directive assign        # Bind rules to roles

wingfoil memory add              # Create project memory documents
wingfoil memory import           # Import existing docs into Memory
wingfoil memory search           # Find docs by keyword
wingfoil memory history          # View audit trail of decisions

wingfoil workflow status         # Check current project state
wingfoil workflow update         # Record progress, blockers, decisions
wingfoil workflow history        # View state changes over time
```

### For AI Agents (MCP Server)

- ✓ **MCP Resources** — Agents efficiently fetch DNA and Memory (read-only)
- ✓ **MCP Prompts** — Auto-load role-specific directives at session start
- ✓ **Keyword Search** — Find relevant docs; filter out noise
- ✓ **Read-Only Access** — Humans remain the source of truth; agents cannot write

---

## Getting Started

> **Note:** WingFoil is in active development (MVP, targeting v0.1 in July 2026). Early feedback welcome.

### Installation

```bash
npm install -g wingfoil
```

### Initialize WingFoil on a New Project

```bash
wingfoil init
```

This creates:

- `.wingfoil/` — Configuration directory
- `.wingfoil/dna.json` — Project structure and conventions
- `.wingfoil/directives/` — Rules for the team
- `.wingfoil/memory/` — Decisions and artifacts (git-tracked)

### On an Existing Project

```bash
wingfoil init --from-existing
wingfoil audit          # Scan and understand current state
wingfoil dna infer      # Auto-propose project structure (review and approve)
wingfoil memory import  # Pull in existing docs (README, design docs, etc.)
```

### Add a Directive

```bash
wingfoil directive add <template>  # Copy a built-in rule (e.g., "testing", "api-design")
wingfoil directive assign <role>   # Bind it to a role (e.g., "tech-lead", "agent")
```

### Create Project Memory

```bash
wingfoil memory add --title "Why we chose Rust" --author "Morgan"
# Opens your editor; saves to `.wingfoil/memory/`

wingfoil memory search "Rust"  # Find it later by keyword
```

---

## Value Proposition

**For** developers and teams already using AI agents  
**WingFoil** makes the development process **deterministic**  
**By** centralizing memory, conventions, and directives — keeping them synchronized across all actors

### Success Metric: Determinism Index

Two independent development runs from the same specs + WingFoil config using different AI agents should produce
substantially equivalent software, with all team members and agents maintaining shared understanding of project workflow
state, progress, and alignment.

---

## What Comes Later

The following features are **not in v0.1** but planned for subsequent releases based on early adopter feedback:

**v0.2+:**

- Semantic search (keyword search only for v0.1)
- Automated validation rules
- IDE integrations beyond MCP
- Advanced notification routing (email, Slack)
- Multi-project management

**v1.0+:**

- Commercial offerings and integrations
- Advanced analytics and reporting
- Custom workflow templates

---

## Release Roadmap

WingFoil releases build progressively—one pillar per week until all five pillars are integrated (v1.0 MVP Complete).

| Phase                            | Timeline       | Status     | Focus                          |
|----------------------------------|----------------|------------|--------------------------------|
| Lean Inception                   | June 2026      | ✓ Complete | Product vision & roadmap       |
| **v0.1** (Memory + DNA)          | ~July 10, 2026 | 🔄 In Dev  | Core foundations               |
| **v0.2** (+ Directives)          | ~July 17, 2026 | Planned    | Team governance                |
| **v0.3** (+ Workflow Management) | ~July 24, 2026 | Planned    | State sync & team coordination |
| **v0.4** (+ Polish)              | ~July 31, 2026 | Planned    | UX refinement & stability      |
| **v1.0** (MVP Complete)          | ~Aug 7, 2026   | Planned    | All pillars integrated         |

**Dogfooding:** Starting in v0.1, WingFoil development is managed by WingFoil itself—the harness immediately becomes its
first production user.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  Humans (CLI)        Agents (MCP Client)        │
├─────────────────────────────────────────────────┤
│           WingFoil Harness                      │
│  ┌─────────────────────────────────────────┐    │
│  │ Memory | DNA | Directives | Workflow    │    │
│  └─────────────────────────────────────────┘    │
├─────────────────────────────────────────────────┤
│         Git Repository                          │
│  (versioning, audit trail, state history)       │
└─────────────────────────────────────────────────┘
```

- **CLI**: Humans use `wingfoil` commands to manage Memory, DNA, Directives, and Workflow state
- **MCP Server**: Agents connect via Model Context Protocol to query Memory/DNA, receive Directives, and view Workflow
  state
- **Git Backend**: All changes (memory, decisions, workflow state) are versioned and auditable
- **Read-Only for Agents**: Only humans can modify project state; agents can query and suggest, but humans control
  writes
- **Workflow Synchronization**: All team members and agents stay aligned on current progress and blockers

---

## License

MIT — open source and free to use.

---

## Contributing

Early feedback is welcome. Please open issues on GitHub to share:

- Use cases and pain points
- Feature requests
- Bug reports

See `CONTRIBUTING.md` for development setup (coming soon).

---

## Questions?

- **GitHub Issues:** Bug reports, feature requests
- **Documentation:** See `docs/` for detailed guides (coming soon)
- **Community:** Join discussions (links coming soon)

---

**WingFoil: Making AI-assisted development deterministic, not chaotic.**