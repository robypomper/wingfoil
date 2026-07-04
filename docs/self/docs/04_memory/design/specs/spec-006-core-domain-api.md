---
id: spec-006-core-domain-api
type: tech-spec
title: "core domain API — shared function surface behind CLI and MCP"
status: approved
scope: "src/core"
supersedes: ""
tmpl_version: 260703
---

## Context

REQ-SYS-05 ("Dual interface over a shared core") requires that humans (via the `wingfoil` CLI, Commander.js
+ chalk) and agents (via the MCP server, stdio transport, Anthropic SDK) get a single, non-divergent
behavior: *"Every state-mutating operation available in the CLI is reachable via an MCP Tool and vice
versa; an automated parity test enumerates both surfaces and reports 0 unmatched operations."*

`dna.yaml`'s `modules` section already names `core` as "shared domain logic; single behavior behind
both CLI and MCP surfaces (REQ-SYS-05)" at `src/core`, alongside separate `cli` (`src/cli`) and
`mcp-server` (`src/mcp`) modules. Without a spec pinning what lives in `src/core` and how the two
surface modules must call it, `cli` and `mcp-server` are free to re-implement the same operation
independently (e.g. two divergent `memory approve` code paths, one enforcing the type's state machine
and one not). That re-implementation risk is exactly what turns REQ-SYS-05's fit criterion into
something that must be *tested for* on every change, rather than a structural guarantee. Two
consumers exist for this artefact:

- `src/cli` — parses `wingfoil <noun> <verb>` argv (per `docs/01_vision/X_cli-cmds.md`) into a core
  function call, then renders the `CoreResult` to console/json/yaml.
- `src/mcp` — exposes MCP **Tools** (mutating operations) and MCP **Resources** (read-only queries) that
  each wrap exactly one core function call, then serialize the `CoreResult` as the Tool/Resource response.

This spec defines `src/core`'s public function surface — its module boundary, per-function
signature shape, and the parity rule that makes both consumers thin adapters over it — so that
"reachable via CLI ⇔ reachable via MCP" is true **by construction**: there is structurally no way to
add an operation to one surface without exposing the underlying core function to the other, because
both surfaces are generated from (or directly call) the same `CoreModule` registry.

## Specification

### 1. Module boundary

`src/core` exports one function per state-mutating or query operation. `src/cli` and `src/mcp` MUST NOT
contain business logic (validation, state-machine transition checks, file writes, git commits) — they
only: (a) parse their surface-native input (argv flags / MCP Tool-call JSON) into the function's typed
params, (b) call the core function, (c) render the typed result to their surface-native output (console
text / JSON-RPC response). `src/storage` (git-backed file I/O) and `src/memory`/`src/dna`/`src/directives`/
`src/workflow` (per-pillar rules, e.g. the state machines in `memory.yaml`) sit *underneath* `src/core`
and are never imported directly by `src/cli` or `src/mcp`.

```
 wingfoil (CLI, src/cli)        MCP client (agent, src/mcp)
        |                                |
        |   parse argv -> params         |   parse Tool/Resource call -> params
        v                                v
        +------------  src/core  ------------+
        |   one function per operation        |
        |   (validation, orchestration,       |
        |    calls into memory/dna/           |
        |    directives/workflow/storage)     |
        +--------------------------------------+
```

### 2. Function shape

Every core function has the same TypeScript shape: a single typed params object in, a single typed
`CoreResult<T>` out — synchronous surfaces (CLI, MCP) both `await` it. No function throws for
*expected* domain failures (illegal state transition, missing element, schema violation); those are
returned as `CoreResult.error`, so both the CLI's exit-code/stderr rendering and the MCP Tool's
`isError` response are driven by the same discriminated union, not by ad hoc try/catch per surface.

```ts
// src/core/types.ts
export type CoreResult<T> =
  | { ok: true; value: T; commit?: { sha: string; message: string } }
  | { ok: false; error: CoreError };

export interface CoreError {
  code: "NOT_FOUND" | "INVALID_TRANSITION" | "VALIDATION" | "CONFLICT" | "IO";
  message: string;
  details?: Record<string, unknown>;
}

// src/core/registry.ts
export type CoreFn<P, R> = (params: P) => Promise<CoreResult<R>>;

export interface CoreModule {
  readonly name: string;              // e.g. "memory", "dna", "workflow"
  readonly operations: Record<string, CoreOperation>;
}

export interface CoreOperation {
  readonly name: string;              // e.g. "memoryApprove"
  readonly mutates: boolean;          // true => MCP Tool, false => MCP Resource; CLI exposes both
  readonly fn: CoreFn<unknown, unknown>;
}
```

`mutates: true` operations MUST be exposed by `src/mcp` only as MCP **Tools** (never Resources, which
are read-only per REQ-INT-01: "MCP Resources are read-only — mutations only via
validated MCP Tools"); `mutates: false` operations are exposed as MCP **Resources**. The CLI exposes
every operation regardless of `mutates`, as a `wingfoil <module> <verb>` subcommand. This single
`mutates` flag is the one place surface-routing logic lives — it is read by both `src/cli`'s command
registrar and `src/mcp`'s Tool/Resource registrar, so adding an operation to `CoreModule.operations`
is sufficient to make it reachable from both surfaces; no per-surface wiring is hand-written.

### 3. Core functions (v0.1 surface, per `X_cli-cmds.md` Pillars 1–5 + Agent Execution)

Grouped by `CoreModule.name`. Each row: function name (camelCase, matches `{module}{Verb}` — e.g.
`memoryApprove`), `mutates`, and the CLI command / MCP exposure it backs.

**`memory` module** (P1, `src/memory`):

| function            | mutates | CLI                     | MCP                          |
|----------------------|---------|--------------------------|-------------------------------|
| `memoryAdd`          | true    | `wingfoil memory add`    | Tool `memory_add`             |
| `memorySearch`       | false   | `wingfoil memory search` | Resource `memory://search`    |
| `memoryImport`       | true    | `wingfoil memory import` | Tool `memory_import`          |
| `memorySubmit`       | true    | `wingfoil memory submit` | Tool `memory_submit`          |
| `memoryApprove`      | true    | `wingfoil memory approve`| Tool `memory_approve`         |
| `memoryReject`       | true    | `wingfoil memory reject` | Tool `memory_reject`          |
| `memoryDeprecate`    | true    | `wingfoil memory deprecate` | Tool `memory_deprecate`    |
| `memoryHistory`      | false   | `wingfoil memory history`| Resource `memory://history/{id}` |

**`dna` module** (P2, `src/dna`):

| function   | mutates | CLI                | MCP                     |
|------------|---------|---------------------|--------------------------|
| `dnaSet`   | true    | `wingfoil dna set`  | Tool `dna_set`           |
| `dnaShow`  | false   | `wingfoil dna show` | Resource `dna://show`    |
| `dnaInfer` | true    | `wingfoil dna infer`| Tool `dna_infer`         |
| `pathsQuery` | false | `wingfoil paths`    | Resource `dna://paths`   |

**`directives` module** (P3, `src/directives`):

| function            | mutates | CLI                        | MCP                          |
|----------------------|---------|------------------------------|--------------------------------|
| `directiveCreate`    | true    | `wingfoil directive create`  | Tool `directive_create`       |
| `directiveAssign`    | true    | `wingfoil directive assign`  | Tool `directive_assign`       |
| `directiveRemove`    | true    | `wingfoil directive remove`  | Tool `directive_remove`       |
| `directivesList`     | false   | `wingfoil directives list`   | Resource `directives://list`  |

**`workflow` module** (P4, `src/workflow`):

| function          | mutates | CLI                     | MCP                        |
|--------------------|---------|--------------------------|------------------------------|
| `workflowStatus`   | false   | `wingfoil workflow status` | Resource `workflow://status` |
| `workflowNext`     | false   | `wingfoil workflow next`   | Resource `workflow://next`   |
| `workflowStart`    | true    | `wingfoil workflow start`  | Tool `workflow_start`        |
| `workflowEnd`      | true    | `wingfoil workflow end`    | Tool `workflow_end`          |
| `workflowList`     | false   | `wingfoil workflow list`   | Resource `workflow://list`   |
| `workflowShow`     | false   | `wingfoil workflow show`   | Resource `workflow://show/{name}` |
| `workflowCreate`   | true    | `wingfoil workflow create` | Tool `workflow_create`       |
| `workflowRemove`   | true    | `wingfoil workflow remove` | Tool `workflow_remove`       |

**`init` module** (P5.1, `src/core` top-level, no dedicated pillar module):

| function     | mutates | CLI              | MCP                    |
|--------------|---------|-------------------|--------------------------|
| `projectInit`| true    | `wingfoil init`   | Tool `project_init`      |
| `projectAudit` | false | `wingfoil audit`  | Resource `project://audit` |

**`agent` module** (Agent Execution Commands, `src/core` top-level):

| function        | mutates | CLI                     | MCP                      |
|------------------|---------|---------------------------|----------------------------|
| `agentExecute`   | true    | `wingfoil agent execute`  | Tool `agent_execute`      |

`agentExecute` is `mutates: true` because it can advance the active workflow's step context as a side
effect of `--next` resolution (per `X_cli-cmds.md`: "Pre-loads Memory context ... "), even though its
primary output is a read (context payload); when a future revision splits context-preview from
step-advance into two functions, this table is the record to update (§ Consequences).

### 4. Parity rule (structural, not tested-for)

1. `src/cli`'s command registrar and `src/mcp`'s Tool/Resource registrar both import the **same**
   `CoreModule[]` array from `src/core/index.ts` (no duplicated or hand-copied operation list in
   either surface module).
2. Each registrar iterates that array and registers **every** operation it finds — the CLI registers
   all of them as subcommands; the MCP registrar registers `mutates: true` ones as Tools and
   `mutates: false` ones as Resources. Neither registrar is permitted a hardcoded allow/deny list of
   operation names.
3. Consequently, an operation added to a `CoreModule.operations` map by construction becomes reachable
   from **both** surfaces at the next build — there is no code path that lets `src/cli` or `src/mcp`
   expose an operation `src/core` does not define, nor omit one it does. This is what lets the
   REQ-SYS-05 fit criterion's "automated parity test enumerates both surfaces and reports 0 unmatched
   operations" be a **regression guard** (catching a future registrar bypassing the shared array) rather
   than the primary mechanism securing parity.

### 5. Naming and versioning conventions

- Function names: `{module}{Verb}` camelCase (`memoryApprove`, `dnaSet`), matching the module +
  first-noun-then-verb shape of the CLI command it backs (`wingfoil memory approve`).
- MCP Tool names: `{module}_{verb}` snake_case (`memory_approve`) — mechanical transform of the core
  function name, so a code-review can diff Tool name against function name for drift.
- MCP Resource URIs: `{module}://{query}[/{id}]` — read-only, mirrors `pathsQuery`/`memorySearch`-style
  queries; no Resource may accept a body that mutates state (enforced by `mutates: false` on the
  backing `CoreOperation`).
- This table (§3) is the enumeration source for the REQ-SYS-05 parity test; when `X_cli-cmds.md` gains
  or removes a command, this spec is revised in the same change (§ Consequences).

## Consequences

- `src/cli` and `src/mcp` become thin: no business logic to keep in sync by hand, so a bug fix or a
  new validation rule in a core function (e.g. a stricter `memory.yaml` transition check) is
  automatically identical on both surfaces without a second patch.
- The REQ-SYS-05 parity test (an automated CLI-vs-MCP enumeration diff) becomes a **regression guard**
  against a registrar bypassing the shared `CoreModule[]` array (§4.3), not the mechanism that
  produces parity in the first place — parity is structural.
- Any task implementing a new CLI command or MCP Tool/Resource MUST add its operation to `src/core`
  first (TDD: a failing core-level test before the CLI/MCP wiring), never bypass `src/core` to hand-roll
  logic in `src/cli` or `src/mcp` — a dev-loop code-review finding "logic added directly to src/cli or
  src/mcp" is a REQ-SYS-05 violation, not a style nit.
- When `docs/01_vision/X_cli-cmds.md` adds, renames, or removes a command, this spec's §3 table must be
  revised in the same task/commit that changes the CLI reference, keeping the enumeration source
  authoritative.
- `agentExecute`'s dual read/mutate nature (§3, `agent` module) is a known rough edge: a future revision
  of this spec may split it into `agentResolveNext` (`mutates: false`) and `agentAdvanceStep`
  (`mutates: true`) once workflow-step advancement is itself specified (candidate future tech-spec on
  `src/workflow` step transitions) — that revision would supersede this one for the `agent` module rows
  only.

## Process Notes

Authored proactively during `initial-design` (no code exists yet to react to a gap). Grounded directly
in `docs/02_requirements/03_sard/01_architecture.md` (REQ-SYS-05, verbatim description/fit
criterion/traceability) and `docs/self/.wingfoil/dna.yaml` (`modules: core/cli/mcp-server` descriptions
and `path:` values); the §3 function/command enumeration cross-checks every row against
`docs/01_vision/X_cli-cmds.md` (approved v1.2) so the operation table matches the currently-approved CLI
surface rather than an invented one. No prior-art source was available or used.
