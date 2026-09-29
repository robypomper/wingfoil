---
id: "task-016-read-only-agent-channel"
type: task
title: "Infrastructure: REQ-SEC-05 — Read-only agent read channel"
status: done
release: "v0.1"
priority: "Blocker"
tags: ["v0.1", "architecture"]
ref: "REQ-SEC-05"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-011-mcp-resources-read-only"]
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

Worked on branch `task/task-016-read-only-agent-channel` (dedicated worktree), in parallel with another
agent on task-015 (REQ-SEC-02 audit trail, `src/memory` — disjoint module). Plan:
`docs/05_plans/X_task-016-plan.md`.

- **design (scope):** REQ-SEC-05's structural mechanisms already exist on `main` — `src/mcp/registrar.ts`
  `registerCoreModules` is explicitly "the structural half of REQ-SEC-05" (`mutates: true` → Tool,
  `mutates: false` → Resource, never both; a `CoreResult.error` → Tool `isError: true`), and task-011's
  read-only Resources channel + shared fixture `test/mcp/helpers/channel-enumeration.ts` were built
  "to extend to Tools without rework". So this task is the REQ-SEC-05 **guarantee test** over the
  existing structure — test-only. The one AC case that cannot run yet: a *mutating* Tool call rejected
  on an illegal state-machine transition identical to the CLI — no mutating op exists (`CORE_MODULES`
  is read-only; mutating ops are task-018+), Prompts are v0.2. Approver approved the "verify + defer"
  scope.
- **green (tests only):** extended the shared fixture with `connectCoreModuleSurface(modules)` (wires
  `registerCoreModules` for Tool/Resource enumeration), and added `test/mcp/read-only-agent-channel.test.ts`:
  (1) structural partition — a synthetic `mutates:true`/`mutates:false` module: `listTools` has only
  `x.write`, `listResources` only `wingfoil://x/read`; (2) the write channel validates — the synthetic
  Tool returns `isError: true` with the `CoreResult.error` message (a `coreOk` fn returns the value);
  (3) real surface — the Tools capability is advertised but zero core ops mutate; (4) Resources refuse
  both write-shaped requests (`resources are read-only`) with files byte-unchanged (task-011 fixture);
  (5) no Prompts channel advertised.
- **blocker (worth recording):** the SDK `McpServer` installs the `tools/list` request handler only on
  the *first* `registerTool`; `registerCapabilities({ tools: {} })` advertises the capability but does
  NOT wire the handler, so `client.listTools()` on a zero-tool server throws `-32601 Method not found`
  (contradicting the registrar's own comment). Adjusted the "zero mutating tools today" assertion to
  check the advertised `tools` capability + that `CORE_MODULES` has no `mutates: true` op, rather than
  calling `listTools()` on the empty server.
- **checks:** full suite green (325 tests), `tsc -p tsconfig.build.json` clean, eslint clean. Touched
  only `test/mcp/` (+ the shared fixture) — no `src/`; task-011's own test unaffected by the additive
  fixture change.

**Deferred (out of scope, traced):**
- A **mutating** MCP Tool call rejected on an illegal state-machine transition, asserted identical to
  the CLI (same message, no partial write) → the tasks that implement mutating operations (task-018+) /
  full Tools in v0.4. The registrar's `isError` error-parity mechanism is proven here with a synthetic op.
- Prompts-channel content (spec-004 §3 / REQ-INT-02, v0.2) → its own task; here confirmed *absent*.
