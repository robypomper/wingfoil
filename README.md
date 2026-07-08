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

## Key Features

### Five Pillars — v0.1 status

- ✓ **Project Memory** — Git-backed document storage with versioning and audit trail (**shipped, v0.1**)
- ✓ **Project DNA** — Structured config: modules, tech stack, team & roles, resource paths (**shipped, v0.1**)
- ✓ **Interaction Layer** — CLI for humans (**shipped, v0.1**); MCP Server for agents, read-only Resources
  (**shipped, v0.1**)
- **Project Directives** — role-scoped rules (planned, v0.2)
- **Workflow State Management** — track and communicate project status/progress/blockers (planned, v0.3)

### CLI commands (v0.1)

Every command below is real, implemented, and covered by the walkthrough in
[Quick Start](#quick-start). `directive`/`workflow` CLI verbs beyond config inspection land in v0.2/v0.3.

```bash
wingfoil init [--template <Scrum|Kanban>]   # Bootstrap .wingfoil/ in the current git repo

wingfoil dna show [section]                 # Query project structure (whole file, or one top-level key)
wingfoil dna set <key> <value>              # Set a single dotted key path (e.g. project.name)

wingfoil memory add --type <t> --title <t> [--tags <t1,t2>]      # Create a Memory document (draft)
wingfoil memory search [keyword] [--tag <t>] [--type <t>] [--status <s>]  # Find docs by keyword/metadata

wingfoil paths [category]                   # Query resource paths (sources/tests/docs/config/governance)

wingfoil mcp                                # Start the MCP server (read-only Resources) over stdio
```

Global flags, accepted by every command: `--format <console|json|yaml>` (default `console`), `--verbose`,
`--no-color`, `--no-interactive`, `-h/--help`, `-V/--version`.

### For AI Agents (MCP Server)

- ✓ **MCP Resources** — Agents fetch DNA and Memory over stdio, read-only (`wingfoil mcp`)
- ✓ **Keyword Search** — Find relevant docs; filter out noise (`memory search`, keyword-only in v0.1)
- ✓ **Read-Only Access** — Humans remain the source of truth; the MCP surface exposes no mutating Tool

---

## Getting Started

> **Note:** WingFoil is in active development (MVP, targeting v0.1 in July 2026). Early feedback welcome.

### Installation

```bash
npm install -g wingfoil
```

This installs the `wingfoil` binary (Node.js 18+ required). Verify it:

```bash
wingfoil --version
```

### Quick Start

A complete, verified walkthrough: bootstrap a project, inspect and edit its DNA, create and find a
Memory document, and query resource paths. Run this from an empty **git repository** (`wingfoil` reads
and writes under its git root; `git init` first if you don't have one yet).

**1. Initialize WingFoil**

```bash
$ wingfoil init --template Scrum
```

`--template` selects a starter methodology (`Scrum` or `Kanban` — pick whichever fits, or answer the
interactive prompt if you omit `--template` in a terminal). This scaffolds `.wingfoil/` — DNA, Memory
schema + templates, directives, and workflow config — and commits it. On success (exit `0`) it prints
the list of files it created.

**2. Inspect the project's DNA**

```bash
$ wingfoil dna show
```

Prints the whole `dna.yaml` structure (project info, modules, tech/methodology stacks, team & roles,
resource paths), or narrow it to one top-level section:

```bash
$ wingfoil dna show project
{
  "name": "",
  "description": "",
  "methodology": "Scrum"
}
```

**3. Edit a DNA field**

```bash
$ wingfoil dna set project.name "My Project"
{
  "key": "project.name",
  "value": "My Project"
}
```

`dna set <key> <value>` writes one dotted key path and commits the change (`wf(dna): set project.name`).
Confirm it stuck:

```bash
$ wingfoil dna show project
{
  "name": "My Project",
  "description": "",
  "methodology": "Scrum"
}
```

**4. Create a Memory document**

```bash
$ wingfoil memory add --type task --title "My first task" --tags "demo,quickstart"
{
  "id": "task-001-my-first-task",
  "path": "docs/memory/task/task-001-my-first-task.md"
}
```

`memory add` generates a document ID from the type's `id_pattern` (`.wingfoil/memory.yaml`), copies that
type's scaffold, fills in the frontmatter, and commits it (`draft` status — see `.wingfoil/memory.yaml`
for each type's states). `--type` must be one already declared in `memory.yaml` (the starter templates
declare `adr`, `bug`, `decision-log`, `release`, `release-line`, `task`, `tech-spec`).

**5. Find it again**

```bash
$ wingfoil memory search first
{
  "query": "first",
  "matches": [
    {
      "path": "docs/memory/task/task-001-my-first-task.md",
      "id": "task-001-my-first-task",
      "title": "My first task",
      "type": "task",
      "status": "draft",
      "tags": ["demo", "quickstart"]
    }
  ]
}
```

`memory search` also takes `--tag`/`--type`/`--status` filters instead of (or alongside) a keyword; an
empty/omitted keyword with a filter browses by that metadata alone. A query that matches nothing is
still a success (exit `0`), with an explicit `message: "no documents matched the query"`.

**6. Query resource paths**

```bash
$ wingfoil paths config
{
  "category": "config",
  "paths": [".wingfoil"]
}
```

`paths [category]` reads the `dna.yaml` `paths:` map (`sources`/`tests`/`docs`/`config`/`governance`);
omit `category` to get the whole map.

### Machine-readable output & the exit-code contract

Every command accepts `--format console|json|yaml` (`console` — human console output — is the default;
the examples above show the raw JSON payload). `json`/`yaml` write only the structured result to
stdout — no banners mixed in — so scripts and CI can parse it directly:

```bash
$ wingfoil dna show project --format yaml
name: My Project
description: ''
methodology: Scrum
```

Every invocation ends in exactly one of three exit codes:

| Code | Meaning                | Example                                                                 |
|------|------------------------|--------------------------------------------------------------------------|
| `0`  | Success                 | `wingfoil paths config` above                                            |
| `1`  | User/logic error        | `wingfoil dna show nonexistent_section` → `error: no DNA key named 'nonexistent_section'` |
| `2`  | Usage/argument error    | `wingfoil memory add --type task` (missing `--title`) → `error: missing required argument: --title` |

A non-zero exit always carries an `error: <reason>` line on stderr (or `{"error": "<reason>"}` under
`--format json`/`yaml`) — never a bare failure with no message.

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
| Requirements Spec (Downcast)     | June 2026      | ✓ Complete | USM · BDD · SARD · Backlog     |
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

## Project Documentation

Before implementation, the product is fully specified through a **traceable documentation pipeline** under `docs/`,
taking the Lean Inception vision down to an implementation-ready backlog (the *specification downcast*):

```
docs/
├── 01_vision/         Lean Inception — product brief, vision, personas, 8 journeys, features, sequencer, MVP canvas
├── 02_requirements/   Specification downcast:
│   ├── 01_user_story_map/   User Story Map (Jeff Patton) — journey backbone + prioritized stories, incl. edge cases
│   ├── 02_bdd/              BDD suite (Gojko Adzic) — Gherkin scenarios per feature (happy + error/edge paths)
│   └── 03_sard/             System & Architecture Requirements (Volere) — NFRs with measurable Fit Criteria
└── 03_backlog/        Operational backlog — schema-validated JSON work items, partitioned by release wave
```

**Traceability chain.** Every item links back through the layers:
`Backlog task → SARD requirement / BDD scenario → User Story → Journey → Vision feature`.

**MVP scope at a glance:**

| Layer          | Artifact                                                    | Count    |
|----------------|-------------------------------------------------------------|----------|
| Vision         | User journeys                                               | 8        |
| Vision         | MVP features (5 pillars + notifications)                    | 63       |
| User Story Map | Journey files · edge-case / interruption stories            | 7 · 14   |
| BDD            | Gherkin feature files / scenarios                           | 63 / 190 |
| SARD           | Architecture & NFR requirements (measurable Fit Criteria)   | 43       |
| Backlog        | Implementation-ready tasks (63 user stories + 43 technical) | 106      |

All artifacts are scheduled across 5 release waves (v0.1 → v1.0), sequenced by risk in
`docs/01_vision/07_sequencer.md`.

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
- **Documentation:** See [`docs/`](docs/) — vision, requirements (USM · BDD · SARD), and the implementation backlog
- **Community:** Join discussions (links coming soon)

---

**WingFoil: Making AI-assisted development deterministic, not chaotic.**