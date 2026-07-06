# Plan — task-016-read-only-agent-channel (REQ-SEC-05)

> Interim dev-loop plan (CLAUDE.md §6 / golden rule #7). Branch
> `task/task-016-read-only-agent-channel`, worktree `.claude/worktrees/task-016-agent-channel`, in
> parallel with another agent on task-015 (REQ-SEC-02 audit trail, `src/memory` — disjoint module).
> Role: developer (code-quality, testing, determinism).

## Design-gate finding (scope)

REQ-SEC-05 is a **channel-enumeration guarantee**: across the agent-facing surface (Resources +
Prompts + Tools), Tools must be the *only* channel a state mutation can ever succeed through, and even
that path is rejected unless it passes validation. The **structural mechanisms already exist on `main`**:
- `src/mcp/registrar.ts` `registerCoreModules` is explicitly "the structural half of REQ-SEC-05": a
  `mutates: true` op is registered as a Tool, a `mutates: false` op as a Resource — **never both** — so
  a mutation is structurally incapable of being a Resource. It also serializes a `CoreResult.error` as a
  Tool `isError: true` (spec-004 §4.3, error-parity with the CLI).
- task-011 (done) built the read-only Resources channel + the shared fixture
  `test/mcp/helpers/channel-enumeration.ts` (`connectReadOnlyClient`, `attemptEveryResourceWrite`,
  `snapshotFiles`/`assertFilesUnchanged`) **explicitly for task-016 to reuse**.

What cannot be exercised yet: an actual **mutating Tool call rejected on an illegal state-machine
transition identically to the CLI** — no mutating operation exists (`CORE_MODULES` is read-only; the
mutating ops are task-018+), and Prompts (spec-004 §3) ship in v0.2. task-016's own notes anticipate
this ("validates the read-channel half end to end and asserts the channel-enumeration property against
whatever Tool surface exists at this release; the fixture extends to Tools without rework").

**Scope decision (approver-approved):** deliver the REQ-SEC-05 **guarantee test** now over the existing
structure (test-only — the structural mechanisms already exist); defer the real-state-machine
illegal-transition Tool assertion to the command tasks (task-018+/v0.4).

## Deliverable (tests only — structural guarantees already present)

- **`test/mcp/helpers/channel-enumeration.ts`** (extend, as task-011 intended): add
  `connectCoreModuleSurface(modules, { resolveRoot })` — wires `registerCoreModules` onto a real
  Client/Server pair so a test can enumerate Tools/Resources over the SDK.
- **`test/mcp/read-only-agent-channel.test.ts`** (new — REQ-SEC-05):
  - **Structural partition (core guarantee):** feed `registerCoreModules` a synthetic module with a
    `mutates: true` and a `mutates: false` op; assert `listTools()` contains **only** the mutating op's
    Tool and `listResources()` contains **only** the read-only op — a mutation can never be a Resource,
    a read-only op can never be a Tool ⇒ Tools is the only channel a write is registered under.
  - **Write path validates (error-parity mechanism):** the synthetic mutating Tool, given a core fn
    returning `coreErr`, responds `isError: true` with the error message (the same `CoreResult` the CLI
    renders) — the "rejected unless it passes validation" mechanism; a `coreOk` fn returns the value.
  - **Today's real surface has no successful write path:** with the real `CORE_MODULES`, `listTools()`
    is empty (zero mutating ops) while the tools capability is still advertised (call doesn't error).
  - **Resources refuse writes, nothing persists:** reuse `connectReadOnlyClient` +
    `attemptEveryResourceWrite` + snapshot (shared REQ-INT-01/REQ-SEC-05 assertion).
  - **Prompts have no mutation surface:** `getServerCapabilities().prompts` is undefined (no Prompts
    channel is registered ⇒ nothing mutating can flow through Prompts).

## Checks (refactor.checks.post equivalent)

- `npx jest` green (full), coverage > 80%.
- `npx tsc -p tsconfig.build.json` clean; eslint clean on changed files.
- Determinism: MCP over the SDK's in-memory transport; no wall-clock/random.
- Traceability: task-016 → REQ-SEC-05 → spec-004 §1/§2.3/§4; BDD P5.2.1 / P5.2.3.

## Coordination

Touches only `test/mcp/` (+ the shared fixture) — no `src/`. Disjoint from task-015 (`src/memory`).
Rebase before the approver-gated merge; ~zero conflict surface.

## Deferred (out of this task, traced)

- A **mutating** MCP Tool call rejected on an illegal state-machine transition, asserted identical to
  the CLI path (same message, no partial write) → the tasks that implement mutating operations
  (task-018+) / full Tools in v0.4. The registrar's `isError` error-parity mechanism is proven here
  with a synthetic op; only the real state-machine case is deferred.
- Prompts channel content assertion (spec-004 §3 / REQ-INT-02, v0.2) → its own task; here it is
  confirmed *absent* (no mutation surface).
