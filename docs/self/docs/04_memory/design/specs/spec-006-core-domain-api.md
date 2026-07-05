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

> **MCP naming — authoritative source is `spec-004-mcp-surface-contract`.** The MCP column below uses
> the wire-visible names defined by `spec-004` (`scope: src/mcp`): **Tool names are dot-form
> `{module}.{verb}`** (`spec-004` §4.1), and **Resource URIs use the `wingfoil://{module}/{query}`
> scheme** (`spec-004` §2.1). An earlier draft of this table used a `{module}_{verb}` snake-case Tool
> form and a `{module}://{query}` URI form; those were **superseded** by `spec-004` and corrected here
> (reconciled as a fast-follow to `task-006`, whose review surfaced the discrepancy — see Process
> Notes). `spec-004` §2.1 owns the fuller sub-resource addressing (`wingfoil://memory/{type}/{id}`,
> `wingfoil://dna/{section}`); the mechanical zero-argument `wingfoil://{module}/{verb}` form shown
> here is what a read-only op with no parameter metadata resolves to today (`src/mcp/registrar.ts`).

**`memory` module** (P1, `src/memory`):

| function            | mutates | CLI                     | MCP                          |
|----------------------|---------|--------------------------|-------------------------------|
| `memoryAdd`          | true    | `wingfoil memory add`    | Tool `memory.add`             |
| `memorySearch`       | false   | `wingfoil memory search` | Resource `wingfoil://memory/search`    |
| `memoryImport`       | true    | `wingfoil memory import` | Tool `memory.import`          |
| `memorySubmit`       | true    | `wingfoil memory submit` | Tool `memory.submit`          |
| `memoryApprove`      | true    | `wingfoil memory approve`| Tool `memory.approve`         |
| `memoryReject`       | true    | `wingfoil memory reject` | Tool `memory.reject`          |
| `memoryDeprecate`    | true    | `wingfoil memory deprecate` | Tool `memory.deprecate`    |
| `memoryHistory`      | false   | `wingfoil memory history`| Resource `wingfoil://memory/history/{id}` |

**`dna` module** (P2, `src/dna`):

| function   | mutates | CLI                | MCP                     |
|------------|---------|---------------------|--------------------------|
| `dnaSet`   | true    | `wingfoil dna set`  | Tool `dna.set`           |
| `dnaShow`  | false   | `wingfoil dna show` | Resource `wingfoil://dna/show`    |
| `dnaInfer` | true    | `wingfoil dna infer`| Tool `dna.infer`         |
| `pathsQuery` | false | `wingfoil paths`    | Resource `wingfoil://dna/paths`   |

**`directives` module** (P3, `src/directives`):

| function            | mutates | CLI                        | MCP                          |
|----------------------|---------|------------------------------|--------------------------------|
| `directiveCreate`    | true    | `wingfoil directive create`  | Tool `directive.create`       |
| `directiveAssign`    | true    | `wingfoil directive assign`  | Tool `directive.assign`       |
| `directiveRemove`    | true    | `wingfoil directive remove`  | Tool `directive.remove`       |
| `directivesList`     | false   | `wingfoil directives list`   | Resource `wingfoil://directives/list`  |

**`workflow` module** (P4, `src/workflow`):

| function          | mutates | CLI                     | MCP                        |
|--------------------|---------|--------------------------|------------------------------|
| `workflowStatus`   | false   | `wingfoil workflow status` | Resource `wingfoil://workflow/status` |
| `workflowNext`     | false   | `wingfoil workflow next`   | Resource `wingfoil://workflow/next`   |
| `workflowStart`    | true    | `wingfoil workflow start`  | Tool `workflow.start`        |
| `workflowEnd`      | true    | `wingfoil workflow end`    | Tool `workflow.end`          |
| `workflowList`     | false   | `wingfoil workflow list`   | Resource `wingfoil://workflow/list`   |
| `workflowShow`     | false   | `wingfoil workflow show`   | Resource `wingfoil://workflow/show/{name}` |
| `workflowCreate`   | true    | `wingfoil workflow create` | Tool `workflow.create`       |
| `workflowRemove`   | true    | `wingfoil workflow remove` | Tool `workflow.remove`       |

**`init` module** (P5.1, `src/core` top-level, no dedicated pillar module):

| function     | mutates | CLI              | MCP                    |
|--------------|---------|-------------------|--------------------------|
| `projectInit`| true    | `wingfoil init`   | Tool `project.init`      |
| `projectAudit` | false | `wingfoil audit`  | Resource `wingfoil://project/audit` |

**`agent` module** (Agent Execution Commands, `src/core` top-level):

| function        | mutates | CLI                     | MCP                      |
|------------------|---------|---------------------------|----------------------------|
| `agentExecute`   | true    | `wingfoil agent execute`  | Tool `agent.execute`      |

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
  first-noun-then-verb shape of the CLI command it backs (`wingfoil memory approve`). **This is the one
  naming convention `spec-006` owns** — the core-function surface is `src/core`'s (this spec's) scope.
- **MCP Tool names and Resource URIs are owned by `spec-004-mcp-surface-contract` (`scope: src/mcp`),
  not by this spec.** `spec-004` is authoritative for anything wire-visible on the MCP surface; the
  values in §3's MCP column follow it and are reproduced here only for the parity cross-reference:
  - MCP **Tool** names: dot-form `{module}.{verb}` (`memory.approve`) — `spec-004` §4.1, a mechanical
    transform of the CLI verb (space → `.`), so a code-review can still diff Tool name against the
    CLI command / core function for drift.
  - MCP **Resource** URIs: the `wingfoil://{module}/{query}[/{id}]` scheme — `spec-004` §2.1. Read-only;
    no Resource may accept a body that mutates state (enforced by `mutates: false` on the backing
    `CoreOperation`). The richer sub-resource addressing (`wingfoil://memory/{type}/{id}`,
    `wingfoil://dna/{section}`) is `spec-004` §2.1's; the zero-argument `wingfoil://{module}/{verb}`
    form is what an operation with no parameter metadata resolves to until a feature task adds it.
  - *(A prior version of this section specified snake-case `{module}_{verb}` Tools and a
    `{module}://{query}` URI scheme; both diverged from `spec-004` and were the source of the
    `task-006` reconciliation — see Process Notes.)*
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

**Revision (2026-07-05) — MCP naming reconciled to `spec-004`, as a fast-follow to `task-006`.**
`task-006-dual-interface-shared-core`'s independent review found that this spec's §3/§5 MCP naming
(snake-case `{module}_{verb}` Tools, `{module}://{query}` Resource URIs) contradicted
`spec-004-mcp-surface-contract` (dot-form `{module}.{verb}` Tools, `wingfoil://…` URIs). Because
`spec-004` is the spec explicitly scoped to `src/mcp`, it is authoritative for the wire-visible MCP
surface, and `task-006`'s shipped `src/mcp/registrar.ts` correctly followed it. This spec's §3 table
and §5 conventions were the stale side and are now corrected to match — removing a traceability hazard
before the MCP feature tasks (`task-011`, `task-030`, and the `memory`/`dna` CLI+MCP tasks) build on
this table's enumeration. No core-function names (`{module}{Verb}`, §5 bullet 1 — the part `spec-006`
actually owns) changed; only the MCP column, which merely reproduces `spec-004`'s naming for the
parity cross-reference. Recorded per the user's decision to revise `spec-006` (rather than open a
separate decision-log) to close the gap.
