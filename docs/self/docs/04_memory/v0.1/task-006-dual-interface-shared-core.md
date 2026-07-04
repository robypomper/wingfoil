---
id: "task-006-dual-interface-shared-core"
type: task
title: "Infrastructure: REQ-SYS-05 — Dual interface over a shared core"
status: backlog
release: "v0.1"
priority: "Blocker"
tags: ["v0.1", "architecture"]
ref: "REQ-SYS-05"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

REQ-SYS-05 requires that humans (the `wingfoil` CLI, Commander.js + chalk) and agents (the MCP server,
stdio transport, Anthropic SDK) get a single, non-divergent behavior by sitting on the **same core
domain logic** — never two independent implementations of the same operation.

This task builds `src/core` as the single function surface (`dna.yaml` module `core`: "shared domain
logic; single behavior behind both CLI and MCP surfaces") that both `src/cli` and `src/mcp` call into as
thin adapters: `src/cli` parses `wingfoil <noun> <verb>` argv into a core function call and renders the
resulting `CoreResult` to console/json/yaml; `src/mcp` exposes MCP Tools (mutating) and Resources
(read-only) that each wrap exactly one core function call and serialize the same `CoreResult`. Because
both surfaces are generated from (or directly call) one `CoreModule` registry, "reachable via CLI ⇔
reachable via MCP" holds by construction rather than by convention — there is structurally no way to
add an operation to one surface without exposing the underlying core function to the other.

## Acceptance Criteria

Per the SARD fit criterion (`docs/02_requirements/03_sard/01_architecture.md`, REQ-SYS-05):

> Every state-mutating operation available in the CLI is reachable via an MCP tool and vice versa; an
> automated parity test enumerates both surfaces and reports 0 unmatched operations.

Testable form:
- An automated parity test enumerates every state-mutating `wingfoil <noun> <verb>` CLI command and
  every MCP Tool, and reports 0 CLI operations without a matching Tool and 0 Tools without a matching
  CLI operation.
- MCP Resources and Prompts remain strictly read-only (REQ-SEC-05); only Tools mutate state, matching
  the CLI's own read/write command split.

## Implementation Notes

- `spec-006-core-domain-api` is the authoritative module boundary for `src/core` — the `CoreModule`
  registry and per-function signature shape that make both surfaces thin adapters.
- `spec-004-mcp-surface-contract` defines the MCP side of the parity: the Resources/Prompts/Tools
  channel split and the Tool-to-CLI-verb mapping.
- `spec-005-cli-command-contract` and `spec-008-cli-grammar` define the CLI side: exit codes, output
  formats, and invocation grammar that `src/cli` must expose over the same core calls.
- Related feature work in this release that this infra task unblocks (`related_stories` in
  `docs/03_backlog/04_backlog/by-release/v0.1.json`, backlog `TASK-004`): `TASK-027` "Implement
  wingfoil init" (memory `task-029-implement-wingfoil-init.md`) and `TASK-028` "Implement MCP Resources
  (DNA + Memory)" (memory `task-030-implement-mcp-resources.md`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
