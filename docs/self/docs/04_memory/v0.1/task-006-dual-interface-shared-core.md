---
id: "task-006-dual-interface-shared-core"
type: task
title: "Infrastructure: REQ-SYS-05 — Dual interface over a shared core"
status: in-review
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

- **start.** Branch `task/task-006-dual-interface-shared-core` + dedicated worktree created from
  `main` (forced `task/`-prefix + worktree convention, dev-loop plan §2/§3.1, `dl-014` G1–G2). Task
  moved `backlog → in-progress`. `bug:` is empty, so `bug.sync_state` was a no-op.

- **design (architect safety net).** Read spec-006-core-domain-api, spec-004-mcp-surface-contract,
  spec-005-cli-command-contract, spec-008-cli-grammar — all four `approved`, all four directly cover
  this task's scope (registry shape, MCP channel split, CLI exit-code/format/error contract, CLI
  grammar). Passed straight through as the plan expected; no new tech-spec authored. One genuine
  spec-vs-spec inconsistency was found (not a gap — both specs exist and are approved, they simply
  disagree) and resolved by scope authority rather than escalated as a design-gap: spec-006 §5's
  own naming note for MCP suggests a snake_case Tool name (`memory_approve`) and doesn't address
  Resource URIs beyond a generic `{module}://{query}` convention, while spec-004 (`scope: "src/mcp"`,
  the spec whose entire remit is the MCP surface) explicitly specifies the dot form
  (`memory.approve`, §4.1) and the `wingfoil://` URI scheme (§2.1). Since spec-004 is the spec
  actually scoped to `src/mcp`, it wins; `src/mcp/registrar.ts`'s module doc records this. Left for
  a reviewer/spec-owner to reconcile spec-006 §5 itself in a later spec revision — not blocking.

- **red.** Five suites, ~90 tests: `test/core/registry.test.ts` (pure — `coreOk`/`coreErr`,
  `deriveVerb`'s camel→verb/kebab derivation, `enumerateOperations`'s determinism,
  `computeParityDiff`'s both-directions set-diff); `test/core/production-registry.test.ts` (the
  real `CORE_MODULES` — shape + wrapped-loader success/NOT_FOUND/VALIDATION behavior against fixture
  git repos); `test/cli/registrar.test.ts` (command derivation + dispatch: format validation, success
  render, `CoreResult.error` render, exit codes); `test/mcp/registrar.test.ts` (Tool/Resource channel
  split + dispatch, over the real SDK `McpServer`/`Client`/`InMemoryTransport`); `test/core/parity.test.ts`
  (the central REQ-SYS-05 AC test). All 5 failed to compile (modules didn't exist yet) — genuine red.

- **green.** Implemented `src/core/{types,registry}.ts` + wired `CORE_MODULES` in `src/core/index.ts`;
  `src/cli/{exit,output,error,registrar,program}.ts`; `src/mcp/registrar.ts`. Full detail in the
  "SCOPE interpretation" and "Design decisions" sections of this task's final report (superseded here
  by the summary below — see the three `feat({module}):` commits for the authoritative account).

  - **Blocker discovered and resolved during green: `commander` v15 is ESM-only.** `commander`'s
    `package.json` has `"type": "module"` and a single `"default": "./index.js"` export — no CJS
    build. This project's `tsconfig.json` (`module: Node16`, no `"type": "module"` in the root
    `package.json`) compiles `.ts` files as CommonJS by default, so a static
    `import { Command } from 'commander'` is downleveled to `require()`, which `tsc --noEmit` itself
    refuses to emit for an ESM-only target (`TS1479`); confirmed empirically that even a raw
    `require('commander')` inside a Jest test crashes ("Cannot use import statement outside a
    module") — `ts-jest`'s CommonJS test runtime has no ESM interop, unlike real Node 22 (which
    *does* support `require()` of ESM packages natively, confirmed via a plain `node -e` check).
    This predates task-006 (task-001 picked `commander@^15`); fixing it project-wide (Jest ESM
    migration, or downgrading `commander`) is a cross-cutting infra call outside this task's scope,
    so I did not attempt either. Resolution used: split the CLI adapter into `src/cli/registrar.ts`
    (100% Commander-independent — owns 100% of the AC-relevant behavior: verb derivation, dispatch,
    exit codes, output rendering, all unit-tested) and `src/cli/program.ts` (the actual
    `commander` wiring, a handful of mechanical lines, using a *dynamic* `import('commander')` inside
    an async `buildProgram` — dynamic import is never downleveled by `tsc` regardless of module
    target, so it doesn't trigger `TS1479`, and it resolves correctly at real `node`/`wingfoil`
    runtime; it is simply not exercised by an automated test in this task, since any test importing
    it would hit the same Jest-runtime wall). `commander` is still the real, declared CLI dependency
    per `dna.yaml`/spec-005/spec-008 — this is a wiring-location decision, not a substitution.
  - `@modelcontextprotocol/sdk` (used for the MCP side) ships both CJS and ESM builds and loads fine
    under this project's existing Jest/tsconfig setup — no equivalent issue there; `src/mcp/registrar.ts`
    is fully unit-tested end-to-end against the real `McpServer`/`Client` over `InMemoryTransport`.
  - **Second SDK-behavior finding:** `McpServer` only installs a `tools/list` (resp. `resources/list`)
    JSON-RPC handler the first time a Tool (resp. Resource) is registered — with zero Tools
    registered (today's production case), calling `tools/list` is a protocol-level "Method not
    found", not an empty list. `registerCoreModules` now unconditionally calls
    `server.server.registerCapabilities({ tools: {}, resources: {} })` so both channels are always
    advertised (spec-004 §1: Resources/Tools are fixed channel types), and the parity test's helper
    short-circuits to `[]` when the registry has zero mutating ops rather than making a call that
    would protocol-error — structurally equivalent, and documented at both call sites.

- **refactor.** `npx jest --coverage`: **98.38% stmts / 91.1% branch / 100% funcs / 98.94% lines**
  globally (all four > 80%); every file this task added is at 100% branch except `src/cli/error.ts`
  (the unused `hint` plumbing — no current operation passes a `hint`, spec-005's hint feature is for
  the "unknown-command suggestion" UX explicitly out of this task's scope) and `src/core/registry.ts`
  (a `noUncheckedIndexedAccess` defensive guard in `enumerateOperations` that is unreachable given
  `Object.keys` always yields present keys, plus `deriveVerb`'s empty-suffix edge case). Added two
  tests closing the yaml-error and non-`Error`-throw branches. `npx tsc --noEmit` exit 0; `npx eslint .`
  clean. `npx jest` (no coverage): **24 suites / 202 tests, all passing.**

- **review (mechanical part).** No dedicated `.feature` file targets REQ-SYS-05 directly — it is a
  SARD architecture requirement cross-cutting all pillars' CLI/MCP parity, not a single P* feature
  with its own BDD scenario (mirrors task-002's precedent for REQ/SARD-only infra tasks). There is
  also no BDD runner wired into this repo yet (`docs/02_requirements/02_bdd/features/**/*.feature`
  are contracts, not executable specs, per the project's current "no source code yet" status — see
  CLAUDE.md §1). The parity mechanism this task builds is exactly what those feature tasks' own BDD
  suites (`P5.2.1-mcp-resources.feature`, `P5.2.3-mcp-tools.feature`, `P5.1.4-cli-ux.feature`, ...)
  will run against once `task-018..030` register real operations and once a BDD runner exists.
  Task moved `in-progress → in-review`; approval gate + merge are the approver's, not performed here.

### SCOPE interpretation (registry mechanism vs. feature tasks 018-030)

Built exactly the mechanism the task brief asked for, wired to what legitimately exists today:

- `src/core/registry.ts`: the `CoreModule`/`CoreOperation`/`CoreFn` types verbatim to spec-006 §2,
  plus three mechanical primitives both adapters (and the parity test) share — `enumerateOperations`
  (deterministic, sorted flattening, REQ-SYS-07), `deriveVerb` (the one camelCase-name → CLI-verb /
  MCP-verb derivation, spec-006 §5, so neither adapter hand-maintains a second name mapping), and
  `computeParityDiff` (the generic two-way set-diff the REQ-SYS-05 fit criterion is literally stated
  in terms of).
- `src/core/index.ts` `CORE_MODULES`: wires in the **three** core functions that already legitimately
  exist and have a natural spec-006 §3 counterpart — `dnaShow`/`directivesList`/`workflowList`,
  backed by task-004's read-only pillar loaders, all `mutates: false`. Deliberately did **not**
  register `loadMemoryYaml` under a `memoryXxx` name: it loads the Memory *pillar's own config*
  (`memory.yaml`'s types/state-machines), a different concept from spec-006 §3's `memory` module
  (which operates on Memory *documents* — `memoryAdd`, `memorySearch`, ...); naming it `memoryShow`
  or similar would misrepresent it as the latter and collide with the real `memory` module task-018+
  will register. **Zero mutating operation exists in production today** — none of spec-006 §3's real
  mutating functions (`memoryAdd`, `dnaSet`, `directiveCreate`, `workflowStart`, `projectInit`,
  `agentExecute`, ...) are implemented; that is squarely task-018..030's scope (memory/dna/directives/
  workflow feature implementation, `wingfoil init`, MCP Resources for DNA+Memory — this task's own
  Implementation Notes name exactly those two follow-on tasks as what it unblocks).
- `src/cli`/`src/mcp` registrars: fully generic per spec-006 §4 — both iterate
  `enumerateOperations(CORE_MODULES)` with no hardcoded allow/deny list of operation names, so
  today's 3 read-only ops (and whatever task-018+ adds later, mutating or not) are exposed
  automatically. I did **not** build a runnable CLI `bin` entry point or an MCP stdio server
  entrypoint (`StdioServerTransport` wiring) — those need `process.argv`/process-lifecycle concerns
  this task's brief didn't ask for and that make more sense once there's a real command surface
  worth shipping (task-018+ again). `buildProgram`/`registerCoreModules` are ready to be called from
  such an entrypoint whenever one is built.
- The REQ-SYS-05 parity test (`test/core/parity.test.ts`) runs against **both** a representative
  fixture registry (2 modules, 3 mutating + 2 read-only ops — meaningful coverage of the mechanism,
  since the production registry's current 0 mutating ops would make the assertion vacuous on its
  own) **and** the real production `CORE_MODULES` (the actual REQ-SYS-05 regression guard, which
  will start catching real drift the moment task-018+ registers a mutating operation).

### Design decisions / deviations for the reviewer

1. **spec-004 vs. spec-006 naming discrepancy (Tool name form, Resource URI scheme)** — resolved by
   spec-scope authority (spec-004 wins for `src/mcp`-facing names since it is the spec scoped to
   `src/mcp`); see the "design" note above and `src/mcp/registrar.ts`'s module doc. Flagging for a
   future spec-006 §5 revision to either drop its Tool-naming/URI mention or explicitly defer to
   spec-004.
2. **Resource URI addressing is mechanical/flat today** (`wingfoil://{module}/{verb}`) — spec-004
   §2.1's fuller scheme (`wingfoil://memory/{type}/{id}`, `wingfoil://dna/{section}`) adds
   sub-resource addressing that today's `CoreOperation` shape (spec-006 §2: just `{name, mutates,
   fn}`) carries no metadata for; deferred to whichever feature task first needs it.
3. **`commander` v15 ESM-only vs. this project's CommonJS Jest/tsconfig setup** — see the detailed
   green-phase note above. Production code still uses real `commander` (dynamic import in
   `src/cli/program.ts`); that one file's Commander-specific wiring is not exercised by an automated
   test in this task. This is the one piece of the AC's mechanism I could not fully verify by
   `npx jest` — I verified it manually via a standalone Node scratch script during investigation
   (confirmed `commander` loads and `Command`/`.option`/`.command`/`.action` all work under real Node
   22), but that scratch script was not kept as part of the deliverable. Recommend either (a) a
   dedicated infra task to add Jest ESM support (`--experimental-vm-modules`) project-wide once more
   ESM-only dependencies are anticipated, or (b) accepting `program.ts` as permanently
   manually-verified, mirroring how a real CLI binary is typically smoke-tested rather than
   unit-tested. Flagging for the approver's judgment.
4. **`registerCapabilities({ tools: {}, resources: {} })` forced unconditionally** in
   `registerCoreModules` — an SDK-behavior finding (see green-phase note), not a spec requirement;
   kept since it makes the server's advertised capabilities match spec-004 §1's "exactly three
   channel types" regardless of how many operations of each kind are currently registered.
5. **`renderSuccess`'s `console` format falls back to pretty-printed JSON** (`src/cli/output.ts`) —
   spec-005 §2 explicitly leaves each command's own console payload *shape* to that command's own
   spec, and none exists yet for `dna show`/`directives list`/`workflow list` (those are task-018+
   territory). Pretty JSON is a reasonable placeholder, not a spec-005 violation.

### Anything I'm unsure about

- Whether the reviewer considers `src/cli/program.ts` (Commander wiring, untested under `npx jest`)
  an acceptable deliverable for this task's Acceptance Criteria, or whether it should count as a
  blocker requiring the Jest-ESM-support infra decision to be made first. I judged it acceptable
  because 100% of the AC-relevant logic (naming, dispatch, exit codes, parity) lives in
  `src/cli/registrar.ts` and is fully tested; `program.ts` adds no logic beyond Commander's own API.
- The spec-004/spec-006 naming discrepancy (point 1 above) — I resolved it by scope authority rather
  than treating it as a `design-gap` STOP, since both specs are `approved` and neither is silent
  (this is a disagreement, not a gap); happy to be told that call was wrong.
