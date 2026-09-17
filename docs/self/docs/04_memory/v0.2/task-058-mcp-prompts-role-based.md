---
id: "task-058-mcp-prompts-role-based"
type: task
title: "Implement MCP Prompts (role-based)"
status: in-progress
release: "v0.2"
priority: "Critical"
tags: ["v0.2", "p5"]
ref: "P5.2.2"
bug: ""
depends_on: ["task-039-mcp-prompts-role-based-infra"]
tmpl_version: 260703
---

## Description

As an Agent, deliver feature **P5.2.2** (US-1-06): auto-load the role prompt at MCP session start, embedding the role's directives.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p5-interaction/P5.2.2-mcp-prompts.feature`.

Key scenario: session under `developer` → MCP prompt for `developer` returned, embedding `testing` + `code-quality`.

## Implementation Notes

Depends on REQ-INT-02 infra (`task-039`). MCP surface per `spec-004`.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### design — role: architect

**Scope.** Exactly what task-039's Execution Notes hand to this task (and `spec-014-mcp-server-entry-point`
§3 assigns to P5.2.2): (1) wire task-039's `registerRolePrompts` into the production `createMcpServer`,
and (2) implement the three scenarios of `p5-interaction/P5.2.2-mcp-prompts.feature`, including the
undefined-role refusal `no prompt for undefined role 'wizard'`. Expected file area: `src/mcp/` + `test/mcp/`.

**`agent.read_related` (dl-015, hard gate) — `task-039-mcp-prompts-role-based-infra` acknowledged.** Read
its full Execution Notes (`status: done`). Constraints carried forward and honoured here:

1. *Infra/feature boundary* — task-039 deliberately left `createMcpServer` untouched and did not build
   the undefined-role error; both are this task's. Nothing else in its registrar is re-scoped.
2. *Per-request resolution through `resolveRoleDirectives`* (no second union, no boot-time cache) and
   *role set read once at registration* (spec-004 §3.1 vs §3.2 timings) — kept as-is.
3. *`role: "user"` and id-ascending order* — task-039's choices, now under **dl-039** (open, v0.3). Not
   changed and not re-argued here: all three P5.2.2 scenarios assert inclusion only, so this task is
   not forced onto either side of dl-039 (checked: `grep -n "order\|before\|after" P5.2.2-mcp-prompts.feature`
   → no ordering step). **dl-040** (Resource-URI divergence in `registerCoreModules`) is unrelated to
   the Prompts channel and `createMcpServer` still does not call `registerCoreModules` — not touched.
4. *Warnings not embedded in the prompt payload* — kept. `resolveRoleDirectives(...).warnings` is still
   discarded on this surface: MCP delivery of diagnostics would need a `logging` capability no spec
   defines. Coupling with the parallel **task-055** (dl-037 shadow warnings / dl-029 hybrid in
   `src/core/context.ts`) is limited to that one public call; no resolution logic is duplicated here.
5. *dl-037 not implemented in the resolver* — inherited, not addressed (task-055's scope).

**T1 — acceptance-criterion classification.**

| # | Criterion (BDD scenario / spec) | Class | Evidence |
|---|---|---|---|
| AC-1 | *Auto-load role prompt at session start*: the running production server (`createMcpServer`) returns `developer-session` embedding `testing` + `code-quality` | **red-first** | Probe against `main`'s `createMcpServer`: `getServerCapabilities()` → `{"resources":{"listChanged":true}}`, `prompts/get` → `MCP error -32601: Method not found` (no Prompts channel wired). |
| AC-2 | *Prompt reflects the current directive assignments*: `security` newly assigned to `developer` appears on the next session start, on the production server | **red-first** at the production surface (same probe: no channel); the underlying per-request resolution is task-039's AC-3 and is only re-pinned here, not re-implemented | same probe |
| AC-3 | *Error — undefined role*: `prompts/get("wizard-session")` → error `no prompt for undefined role 'wizard'` | **red-first** | On `main` the production server answers `Method not found`; task-039's registrar alone answers the SDK's `Prompt wizard-session not found` (`@modelcontextprotocol/sdk@1.29.0` `dist/cjs/server/mcp.js:426`). Neither carries the BDD string. |
| AC-4 | spec-014 §3 channel scope, updated: production server advertises Resources **and** Prompts, still **no** Tools | **red-first** (inverts `test/mcp/server.test.ts`'s `caps?.prompts` undefined assertion) | `test/mcp/server.test.ts` "scope (spec-014 §3)" case |

**`agent.verify_specs`.** No new tech-spec. `spec-004` §3 (approved) fixes naming/embedding/read-only;
`spec-014` §3 (approved) assigns the wiring to P5.2.2. The undefined-role error string is fixed verbatim
by the BDD acceptance contract (`docs/02_requirements/…`, authoritative per CLAUDE.md §10.1). Two
implementation choices the contract leaves open, taken inside it:

- *"session starts under role R" ↔ `prompts/get("{R}-session")`* — the only session-start entry
  spec-004 §3.1 defines. A requested name ending in `-session` whose role is not in the DNA role set
  (read at server start, §3.1) gets the BDD string; any other unknown name keeps the SDK-equivalent
  `Prompt {name} not found`. Error code `InvalidParams` (-32602), the same code the SDK uses for an
  unknown prompt.
- *Mechanism*: the SDK's `McpServer.registerPrompt` throws its own not-found error before any callback
  runs (mcp.js:423-427), so the refusal cannot be expressed through it. `registerRolePrompts` therefore
  installs the `prompts/list` / `prompts/get` handlers on the low-level `server.server` directly — the
  same pattern `src/mcp/read-only.ts`'s `registerWriteRefusalHandler` already uses — instead of
  overriding one handler of the high-level API behind its back.

Gap noted for the approver (not resolved here): spec-004 §3 does not mention the undefined-role refusal
at all, so an implementer reading only the spec would miss it — see final report, proposed element.
