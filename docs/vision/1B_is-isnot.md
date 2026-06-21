# Is / Is Not / Does / Does Not — WingFoil

**Version:** 1.0
**Date:** 2026-06-15
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
- A task execution or coordination tool — does not execute tasks or coordinate task work
- A real-time collaboration platform
- A spec or requirements validator

## DOES

- Stores and versions documents, decisions, and artifacts in git (Project Memory)
- Exposes the full structural map of a project to humans and agents (Project DNA)
- Manages and auto-loads role-based directives at session start (Project Directives)
- Tracks and manages workflow state, ensuring all actors share understanding of project progress and blockers (Workflow
  State Management)
- Exposes CLI commands for querying and updating all project state
- Exposes MCP tools, resources, and prompts for AI agents
- Makes independent development runs produce substantially equivalent output (Determinism)
- Notifies users when human intervention is required (human-on-the-loop supervision)

## DOES NOT

- Validate or correct initial specifications
- Generate, write, or review code
- Replace AI agents or models
- Provide native IDE integrations beyond MCP
- Manage multiple projects or workspaces (v1)
- Auto-sync Directives when DNA changes (v1)
- Auto-compile documents — document generation is limited to templates and simple placeholders derived from project
  state and properties