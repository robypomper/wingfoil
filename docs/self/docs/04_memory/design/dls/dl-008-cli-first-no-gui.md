---
id: dl-008-cli-first-no-gui
type: decision-log
title: "CLI-first, no GUI or Dashboard in the MVP"
status: ready
context: scope
release: ""
tmpl_version: 260703
---

## Context

WingFoil's Interaction Layer (P5) could deliver multiple user interfaces: a command-line interface (CLI), a web dashboard for visual project status and state tracking, and IDE plugins for in-editor integration. Building and maintaining graphical interfaces is a substantial effort; the MVP must prioritize the five pillars (Memory, DNA, Directives, Workflow, and the Interaction Layer's CLI core) over visual frontends.

## Decision

The MVP delivers **CLI only**. No web dashboard, no graphical status interface, and no IDE plugins are built in v0.1–v1.0. The Dashboard UI and IDE plugins are explicitly deferred to Post-MVP (v1.0+).

## Rationale

A CLI is the fastest interface to build and the natural surface for developers and AI agents. It is fully scriptable, composable with standard Unix tools, and the right choice for the determinism goal—no GUI state management, no visual rendering quirks across browsers. The commands defined in P5.1–P5.4 (init, workflow status, memory search, agent execution) are all CLI-based and sufficient for the MVP end-to-end journeys (0a–6).

Building a Dashboard UI now would divert effort from hardening the five pillars and would introduce significant scope creep: visual design, responsive layout, browser compatibility, real-time synchronization, and separate deployment pipelines. The shared architecture—Memory, DNA, Directives, Workflow, and MCP Resources all behind a stable API—means a web dashboard can be added later without disrupting the core tool. All state lives in git-backed files and is queryable via the MCP Server (P5.2), so a future dashboard will have no trouble fetching and displaying project state.

IDE plugins are handled separately in dl-006 (no native IDE plugins in MVP). This decision focuses on the broader GUI surface: web dashboards, graphical status views, and any non-CLI interactive tools.
