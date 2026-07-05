---
id: "task-009-mcp-resource-fetch-latency"
type: task
title: "Infrastructure: REQ-PERF-04 — MCP resource fetch latency"
status: in-progress
release: "v0.1"
priority: "Blocker"
tags: ["v0.1", "architecture"]
ref: "REQ-PERF-04"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

REQ-PERF-04 bounds the latency of agent-side reads over the MCP **Resources** channel — fetches of DNA
entries (`wingfoil://dna`) and Memory documents (`wingfoil://memory/*`) — because an agent session's
context assembly must stay within the overall 30 s budget (REQ-PERF-01). This task implements the MCP
Resources handler in `src/mcp` as a thin, read-only adapter (per REQ-SEC-05: Resources and Prompts never
mutate) over the same bounded query functions built for `src/core` (shared with REQ-PERF-02's CLI
commands), and ensures the MCP server process itself sustains repeated Resource fetches for the
duration of an agent session without needing a restart — i.e. no per-fetch cold-start cost, no resource
leak across a long-running stdio session.

## Acceptance Criteria

Per the SARD fit criterion (`docs/02_requirements/03_sard/02_performance-nfr.md`, REQ-PERF-04), with the
measurement conditions the same document defines:

> A single MCP Resource fetch returns in < 1,000 ms (p95); the MCP server sustains queries for the
> duration of an agent session without restart.
>
> Measurement conditions: latency targets are evaluated as **p95 over ≥ 20 runs** on a reference
> repository of **1,000 Memory documents**.

Testable form:
- A single `wingfoil://dna` or `wingfoil://memory/{id}` Resource fetch over the MCP stdio transport
  completes in under 1,000 ms at the p95 percentile across at least 20 timed runs on the 1,000-document
  reference repository.
- Repeated fetches across a simulated agent session (no server restart) show no latency degradation
  and no dropped connection.

## Implementation Notes

- `spec-004-mcp-surface-contract` is the authoritative definition of the Resources channel — URI scheme
  (`wingfoil://dna`, `wingfoil://memory/*`, `wingfoil://workflows`), the read-only refusal contract, and
  the strict Resources/Prompts (read) vs Tools (mutate) partition (REQ-SEC-05) this task must respect.
- `spec-006-core-domain-api` is where the actual query logic lives — the MCP Resource handler must be a
  thin wrapper over the same `CoreModule` functions used by the CLI's `dna show`/`memory search` (task
  `task-008-dna-memory-query-latency.md`, REQ-PERF-02), not a separate reimplementation.
- Related feature work in this release that this infra task unblocks (`related_stories` in
  `docs/03_backlog/04_backlog/by-release/v0.1.json`, backlog `TASK-007`): `TASK-028` "Implement MCP
  Resources (DNA + Memory)" (memory `task-030-implement-mcp-resources.md`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
