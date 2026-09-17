---
id: "task-058-mcp-prompts-role-based"
type: task
title: "Implement MCP Prompts (role-based)"
status: in-progress
rejection_reason: "P5.2.2's three scenarios work on the production server and every gate is green, but the task changes `wingfoil mcp` startup without a test and against an approved spec. `createMcpServer` now reads `dna.yaml` when the server is built, contradicting spec-014 §2's \"no I/O at construction time\". A missing `dna.yaml` exits 1 through `src/cli.ts`'s last-resort handler as a raw ENOENT that ignores `--format json`, not through `runMcp`'s format-aware pre-flight. Making the registrar tolerate a missing `dna.yaml` leaves all 208 mcp/cli tests green. The notes mention the change but never check it against spec-014 or propose an element. Also, `test/mcp/read-only-agent-channel.test.ts:91` still grounds REQ-SEC-05 on \"no Prompts channel is advertised\", which this task made false. Route the startup failure through `runMcp` with a test (or defer the DNA read), re-ground the channel-enumeration test on the shipped surface, and raise the spec-004/spec-014 gaps as decision-logs."
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

### red — developer

`test/mcp/mcp-prompts.feature.test.ts` (new) — one `it` per `P5.2.2-mcp-prompts.feature` scenario, titles
quoting the scenarios, against the production `createMcpServer` over the SDK in-memory transport + a real
`Client`, plus two edge cases of the refusal. `test/mcp/server.test.ts`'s "scope (spec-014 §3)" case
inverted: `caps.prompts` now defined, `caps.tools` still undefined.

Observed (`npx jest test/mcp/mcp-prompts.feature.test.ts test/mcp/server.test.ts`): **6 failed, 4 passed**.
Failure reasons, all the stated one (no Prompts channel on the production server):
`McpError: MCP error -32601: Method not found` (×2), `Expected: -32602 / Received: -32601` (×2),
`Received string: "MCP error -32601: Method not found"`, `caps?.prompts` `Received: undefined`.
No characterization ACs; nothing fabricated.

### green — developer

- `src/mcp/server.ts`: `createMcpServer` now calls `registerRolePrompts(server, { resolveRoot })` after
  `registerReadOnlyResources` (spec-014 §3).
- `src/mcp/prompt.ts`: `registerRolePrompts` owns `prompts/list` / `prompts/get` on `server.server`
  (design note above) — role set read once from DNA; `{role}-session` for a DNA role → per-request
  `buildRolePrompt` (same `resolveRoleDirectives` composition as task-039, unchanged); `-session` name
  for a non-DNA role → `no prompt for undefined role '<role>'`; other names → `Prompt <name> not found`.

Result: `npx jest test/mcp test/cli` → **207 passed / 207**.

### refactor — developer

- **Defect found by a stdio smoke run, fixed test-first.** Built `dist/` and drove `node dist/cli.js mcp`
  with the SDK `StdioClientTransport` against a temp repo carrying `docs/self/.wingfoil/{dna,roles}.yaml`
  + `directives/custom/*.md`: the refusal arrived as `MCP error -32602: MCP error -32602: no prompt for
  undefined role 'wizard'` — `McpError` pre-prefixes its own message and the client prefixes again. Tests
  tightened to exact `toBe("MCP error -32602: no prompt for undefined role 'wizard'")` → **2 failed**
  (`Received: "MCP error -32602: MCP error -32602: …"`); fix: throw a plain `Error` carrying
  `code: InvalidParams` (`promptRequestError`) → pass. Re-run of the smoke prints the 8 `*-session`
  prompts of this project's DNA and `MCP error -32602: no prompt for undefined role 'wizard'`.
- Pinned the "owns its handlers" claim: a later `registerPrompt` on a `createMcpServer` server throws
  `A request handler for prompts/list already exists`.
- Docs brought in line: `src/mcp/prompt.ts` / `server.ts` / `index.ts` module comments (no longer "not
  wired"), `src/cli/program.ts` `mcp` help text → "(read-only Resources and role Prompts)".
- Observed behaviour change: `wingfoil mcp` in a repo whose `.wingfoil/dna.yaml` is missing now exits
  at start (`error: ENOENT: … .wingfoil/dna.yaml`, exit 1, via `src/cli.ts`'s last-resort handler —
  observed with the smoke repo after `rm .wingfoil/dna.yaml`) instead of starting and failing per request.

**Merge.** `git merge main` (dl-035, merge not rebase) brought in `ebfb1e3` (dl-041: spec-006 §3 `module`
column, spec-008 §1 `directives` noun) — merge commit `4072d4a`, no conflict. Re-read spec-006 §3 after
the merge (`grep -n -i "prompt" spec-006-core-domain-api.md` → no hit): these notes and the code cite
neither spec-006 nor spec-008, and no Tool/Resource name here derives from them. dl-040 stays open and is
untouched (`createMcpServer` still does not call `registerCoreModules`).

Gates (post-merge, worktree):

| Check | Command | Result |
|---|---|---|
| tests | `npx jest` | **81 suites, 1094 passed / 1094** |
| coverage | `npx jest --coverage` | global **98.31 stmts / 90.44 branch / 98.47 funcs / 98.94 lines** (baseline `79f9fda`: 98.29 / 90.18 / 98.44 / 98.93, 1087 tests); `src/mcp/prompt.ts` 100/100/100/100; `src/mcp/server.ts` 69.23 lines — uncovered 72-75 is the pre-existing `startMcpServer` stdio seam (baseline 66.66, lines 67-70) |
| build types | `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| all types | `npx tsc --noEmit -p tsconfig.json` | only `test/core/directive-create.test.ts(159,19): error TS2339` (bug-026, pre-existing) |
| `lint.clean` | `npm run lint` | exit 0 |
| `docs.api.*` | `npm run docs:api` | exit 0 |

### review-ready summary

**BDD coverage** (`p5-interaction/P5.2.2-mcp-prompts.feature`), all in `test/mcp/mcp-prompts.feature.test.ts`:

| Scenario | Test |
|---|---|
| Auto-load role prompt at session start | › `Scenario: Auto-load role prompt at session start` |
| Prompt reflects the current directive assignments | › `Scenario: Prompt reflects the current directive assignments` |
| Error - requesting a prompt for an undefined role | › `Scenario: Error - requesting a prompt for an undefined role` (+ edges: role bound in roles.yaml but not in DNA; non-`-session` name) |

REQ-INT-02 registrar contract remains pinned by task-039's `test/mcp/role-prompts.test.ts` (9/9 passing,
unchanged file).

**For the reviewer / approver.**
1. *Mechanism change to task-039's registrar*: handlers moved from `McpServer.registerPrompt` to the
   low-level `server.server` API (only way to emit the BDD string); prompts capability is now `{}`
   instead of the SDK's `{ listChanged: true }` (the list is fixed at start, so no change notification is
   ever sent).
2. *spec-004 §3 is silent on the undefined-role refusal* the BDD mandates, and on the error code chosen
   (`InvalidParams`) — raised as a proposed element, not edited here.
3. *dl-039 not decided*: `role: "user"` and id-ascending order are task-039's and unchanged; no P5.2.2
   scenario depends on either.
4. *task-055 coupling*: `buildRolePrompt` calls `resolveRoleDirectives(loadDirectives(root),
   loadRolesYaml(root), role)` and discards `warnings`. A signature change there (dl-037 shadow warnings)
   conflicts only at that one call; shadow warnings would, like dl-029's, not reach the agent via Prompts.
5. Directive bodies carry their own `# Directive — …` H1 inside each `## Directive: {id}` block (seen in
   the smoke run) — heading levels invert; spec-004 §3.2 says "full directive body", so left as is.
