---
id: "task-016-read-only-agent-channel"
type: task
title: "Infrastructure: REQ-SEC-05 — Read-only agent read channel"
status: backlog
release: "v0.1"
priority: "Blocker"
tags: ["v0.1", "architecture"]
ref: "REQ-SEC-05"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

Enforce, as a channel-scoped, least-privilege guarantee, that agents cannot mutate project state
through the MCP Resources channel under any circumstance — mutation is possible only through
validated MCP Tools, and even that path is rejected unless it passes the same state-machine
validation the CLI enforces. Where task-011 (REQ-INT-01) implements the Resources channel itself as
read-only, this task is the channel-*enumeration* guarantee: across the whole agent-facing surface
(Resources + Prompts + Tools), Tools must be the *only* write path that can ever succeed, and even
that path must be rejected on an illegal transition. As Casey (integrating an AI agent via MCP), I
want a structural guarantee — not just a convention — that my agent's read/browse channel can never
be the path through which it accidentally corrupts project state.

## Acceptance Criteria

Per REQ-SEC-05's fit criterion: "A write attempt issued over the MCP Resources channel is refused
with `\"resources are read-only\"` and persists nothing; in a channel-enumeration test the only agent
write path that successfully mutates state is an MCP Tool call, and that call is rejected unless it
passes state-machine validation."

Testable breakdown:
- A write attempt over the Resources channel is refused with the exact string
  `resources are read-only` and persists nothing (shared assertion with REQ-INT-01/task-011).
- A channel-enumeration test exercises every agent-facing channel (Resources, Prompts, Tools) and
  asserts that Tools is the only one through which a state mutation can ever succeed.
- An MCP Tool call attempting an illegal state-machine transition (e.g. `memory.approve` on a
  document not in a gate-eligible state) is rejected identically to the equivalent CLI path — same
  error message, no partial write (shared contract with REQ-INT-03).
- Prompts (role-instruction templates) are confirmed to have no mutation side effect either — only
  instructional text is returned.
- See BDD `p5-interaction/P5.2.1-mcp-resources.feature`, `p5-interaction/P5.2.3-mcp-tools.feature`.

## Implementation Notes

- Full contract: `docs/self/docs/04_memory/design/specs/spec-004-mcp-surface-contract.md` §1
  (transport & channels — the structural partition: Resources/Prompts read-only, Tools mutating) and
  §2.3 (write-refusal contract, verbatim message). §4 (Tools) defines the parity/validation rules
  this task's Tool-side assertion depends on, though full Tools implementation ships in v0.4 per that
  spec's Consequences section — this v0.1 task validates the *read-channel* half of the guarantee end
  to end and stubs/asserts the channel-enumeration property against whatever Tool surface exists at
  this release.
- Architectural backing: `docs/self/docs/04_memory/design/adrs/adr-004-mcp-over-stdio.md` — read/write
  separation is structural (distinct MCP primitive kinds), not something re-verified per endpoint.
- Related feature tasks in this release: `task-030-implement-mcp-resources` (backlog `TASK-028`,
  P5.2.1); the MCP Tools feature (backlog `TASK-087`, P5.2.3) lands in a later release but this task's
  channel-enumeration test fixture is written to extend to it without rework.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
