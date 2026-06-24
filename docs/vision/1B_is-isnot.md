# Is / Is Not / Does / Does Not — WingFoil

**Version:** 1.2
**Date:** 2026-06-24
**Status:** Pending

---

## IS

- An open-source tool that provides structured, authoritative context for AI-assisted software development
- A structured, git-backed interface between developers, AI agents, and the project
- A workflow state management system — tracks and communicates project progress, blockers, and deliverable status
- A CLI tool for human developers
- An MCP server for AI agents
- A governance layer above IDEs and agents

## IS NOT

- An AI model or coding agent
- An IDE or IDE plugin
- A code generator or code reviewer
- A task executor or work verifier — it launches the configured agents but neither performs the development work itself
  nor inspects agent output directly; it only validates deliverables through workflow checks, run as a separate command
  after the agent has executed
- A real-time collaboration platform
- A spec or requirements validator

## DOES

- Stores and versions documents, decisions, and artifacts in git (Project Memory)
- Exposes the full structural map of a project to humans and agents (Project DNA)
- Manages and auto-loads role-based directives at session start (Project Directives)
- Tracks and manages workflow state, ensuring all actors share understanding of project progress and blockers (Workflow
  State Management)
- Defines each Memory element type and its own state machine in `.wingfoil/memory.yaml` (per-type states, not a single
  global one)
- Exposes CLI commands for querying and updating all project state
- Exposes MCP tools, resources, and prompts for AI agents
- Launches the configured AI agents with auto-loaded context (orchestration wrapper; does not perform the work itself)
- Auto-syncs built-in Directives and Workflow templates when DNA (tech-stack/methodology) changes
- Validates deliverables through workflow checks (pre/post execution), run as a separate command after the agent runs
- Makes independent development runs produce substantially equivalent output (Determinism)
- Notifies users when human intervention is required (human-on-the-loop supervision)

## DOES NOT

- Validate or correct initial specifications
- Generate, write, or review code
- Replace AI agents or models
- Provide native IDE integrations beyond MCP
- Manage multiple projects or workspaces (v1)
- Auto-compile documents — document generation is limited to templates and simple placeholders derived from project
  state and properties