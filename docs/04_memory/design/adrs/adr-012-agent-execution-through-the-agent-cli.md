---
id: adr-012-agent-execution-through-the-agent-cli
type: adr
title: "`wingfoil agent execute` launches the agent's own CLI through a declared per-agent adapter, not an AI SDK; context still reaches the agent over MCP"
status: pending
sard_ref: "REQ-INT-07, REQ-PERF-01, REQ-SEC-08, REQ-SEC-07, REQ-SYS-07"
supersedes: ""
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703   # Orignal template version
---

## Context

`REQ-INT-07` (`docs/02_requirements/03_sard/04_integrations.md:64-71`) states the agent wrapper's
mechanism in its title and description: "Agent execution wrapper (Agent SDK + MCP)", and
"`wingfoil agent execute` wraps the AI Agent SDK, resolving role/element from the workflow step and
pre-loading context via MCP". Two vision rows carry the same dependency: P5.3.1 and P5.4.4 list
"Agent SDK" in their dependency column (`docs/01_vision/06_features.md:238`, `:244`). Nothing of
`agent execute` exists yet: `grep -cE "name: '(agent|memoryAmend)" src/core/index.ts` → `0`.

Four facts make the SDK reading untenable before the first line of `src/agent` is written.

- **There is no SDK to wrap.** `bug-138-unused-anthropic-sdk-runtime-dependency` (`closed`) found
  `@anthropic-ai/sdk` declared and imported nowhere. `task-117-remove-the-unused-anthropic-sdk`
  (`done`, merge `ccb933e0`) removed it for `0.2.2`: `grep -c anthropic package.json` → `0`,
  `grep -rn "@anthropic-ai" src | wc -l` → `0`, `package.json:3` → `"version": "0.2.2"`. Its
  `32c57d7b` also dropped the `Anthropic SDK` entry and its drift note from
  `.wingfoil/dna.yaml` `stacks.technologies` (now `.wingfoil/dna.yaml:69-100`, which names only
  `@modelcontextprotocol/sdk` at `:83`). The one SDK WingFoil ships is the MCP one, on the server
  side (`adr-004-mcp-over-stdio`).
- **The North Star names different agents.** "two independent development runs from the same specs
  + WingFoil config using different AI agents produce substantially equivalent software"
  (`docs/01_vision/01_product-brief.md:68-69`). A wrapper built on one vendor's SDK runs one vendor's
  agent. `dl-131-determinism-index-scope` (`ready`) states the consequence: code-level outcome depends
  on "the agents and models the customer picks"; WingFoil guarantees the **I**nput component and
  measures **P**rocess conformance. Both are properties of what WingFoil hands to an agent and of
  what it records afterwards, and neither needs WingFoil to be the agent loop.
- **An SDK wrapper holds the model credential.** To call a model API, WingFoil would need an API key
  in its process, which puts a secret in the one tool whose whole store is git
  (`REQ-SEC-08`, `05_security-compliance.md:87-95`). `dl-114-recording-agent-token-consumption`
  (`ready`) already chose Q3 (i), numbers from "the agent's own report", over Q3 (ii), provider
  usage records "which need credentials WingFoil does not hold".
- **The approver ruled the mechanism.** `release-planning-rel-v0.3-plan` R2 (2026-09-29): "`wingfoil
  agent execute` launches **the agent's own CLI** through a declared per-agent adapter, not an SDK.
  This replaces `REQ-INT-07`'s 'wraps the AI Agent SDK'". The sequencer records the change of
  mechanism and defers its record to this ADR (`docs/01_vision/07_sequencer.md:117-119`).
  `dl-135-agent-run-tracking` (`ready`) is already written against it: its point 5 lists what "the
  adapter declares, per agent".

What does not change is how context reaches the agent. `adr-004` (`accepted`) made MCP over stdio
the agent-facing protocol, and `REQ-INT-07`'s fit criterion keeps "pre-loads DNA/Memory/Directives
via MCP before the agent starts". `dl-026-repo-versioned-mcp-server-config` (`ready`) registered
this repository's server for one agent, in `.mcp.json` (`.mcp.json:1-8`), and named the vendor
coupling that follows (`dl-026:55-58`: "`.mcp.json` is a Claude Code-specific registration
format"). An adapter per agent is where that coupling can be kept.

Two launch kinds are needed, in different releases. **Interactive** is in v0.3: `agent execute` hands the
terminal to the agent's session (P5.3.1 is in `minor-v0.3` `features:`,
`docs/04_memory/planning/rl-v1/minor-v0.3.md:8`; plan R3). **Headless** comes with workflow checks
(P4.12, v1.0, plan R3 and R4): a non-interactive run whose result gates a phase. R4's
checks (`tests.unchanged`, distinct executors, `dl-134-dev-loop-separation-of-duties`) and `dl-090`'s
rule that an `agent.*` token "never satisf[ies] a check" both assume a run whose verdict WingFoil
reads from something other than the agent's own claim. If the adapter shape covered only the
interactive launch, v1.0 would reopen it.

Alternatives considered:

- **(a) Wrap one vendor's agent SDK** — `REQ-INT-07` as written. Rejected. It restores the
  dependency `task-117` removed. It runs one vendor's models, which is the opposite of the North
  Star's "different AI agents". It needs an API key inside WingFoil (`REQ-SEC-08`). And WingFoil would
  own an agent loop (tool use, permissions, retries, context compaction) that every agent CLI
  already implements and keeps improving.
- **(b) MCP only, no launcher.** The user starts the agent, and the agent pulls context from the
  `wingfoil` MCP server. This is today's state (`.mcp.json`). Rejected as the whole answer. Nothing
  starts the clock `REQ-PERF-01` measures ("from `wingfoil agent execute` invocation to 'agent
  ready'", `02_performance-nfr.md:16-22`). Nothing resolves the role and element from the step
  (P5.3.2). No one writes `dl-114`'s run record, which that decision ties to "the only point where
  WingFoil starts an agent run and sees it end". It stays in the design as the channel for context,
  not as the launcher.
- **(c) Per-project shell hooks** (`agent-hook.sh` or similar, run by `agent execute`). Rejected.
  A shell string is the injection surface `dl-090` Q3 ruled out in favour of "argv, no shell". Each
  project would re-derive session-id and usage parsing, with no shared schema, no built-in versus
  custom split (the discriminator `REQ-SEC-07` uses for directives and workflows), and no fake that
  tests can substitute.
- **(d) A declared adapter per agent CLI** — chosen.

Without this decision, the first v0.3 task on P5.3.1 would implement a requirement that the approver
has already overruled, or would pick a launch mechanism in code review.

## Decision

1. **`wingfoil agent execute` launches the agent's own command-line program as a child process.**
   Examples are Claude Code and Codex, or any other CLI that can take an initial prompt and register
   an MCP server. WingFoil does not import, wrap or call any model SDK, and holds no model credential.
   The agent authenticates the way it does when a user starts it by hand, and WingFoil passes the
   environment through unchanged.

2. **How to launch each agent is declared, in an adapter manifest.** The manifest is data, not code,
   and holds per agent:
   - the executable;
   - an argument-vector template for each launch kind (point 4), with a closed set of placeholders and no shell
     (`dl-090` Q3 (a));
   - how the initial prompt is delivered;
   - how the `wingfoil` MCP server is registered for that process;
   - how the session id, token usage and model are obtained, with `not-reported` when the agent gives
     none (`dl-114` Q3 (i), `dl-135` point 2);
   - whether and how the agent resumes a session, and whether it exports a summary (`dl-135` point 5).

   Adapters shipped with the package are **built-in**. Adapters a project writes are **custom**. v0.3
   ships two built-ins, for **Claude Code** and for **Codex CLI** (approver ruling R17, 2026-09-30,
   `release-planning-rel-v0.3-plan`); each records in `verified_with` the agent CLI version its
   declarations were checked against by hand, filled by the task that implements it, and this ADR
   quotes none of their flags (`spec-016` §2.8). The
   `built-in/` and `custom/` directories keep them apart, as they do for directives and workflows
   (`spec-011-storage-layout`). That split is the structural discriminator `REQ-SEC-07` keys
   removability on; `REQ-SEC-07` names directives and workflow templates only, so adapters follow it
   by analogy, and `spec-016` lists the amendment that would extend it to them. Which DNA agent uses which adapter is declared in
   `dna.yaml` `team.agents`. The file layout and fields are `spec-016` (the agent-execution spec
   drafted in this planning).

3. **Context reaches the agent over MCP, as `adr-004` decided.** The adapter registers the `wingfoil`
   MCP server for the launched process, served by the same WingFoil build that launched it. The
   initial prompt is a short, deterministic bootstrap. It names the role, the element, the run and
   the commit the context is assembled at, and it sends the agent to the MCP server for the context
   itself. Before it launches anything, `agent execute`:
   - assembles the execution context itself (P5.4.4, `spec-012-context-loader-relevance-filtering`)
     to validate it;
   - prints its warnings on stderr (`dl-050` option 4);
   - checks that the MCP server answers.

   "Pre-loaded" in `REQ-INT-07` and P5.4.3 means these checks passed before the agent started. It does
   not mean that the payload was pushed into the agent. The assembled payload is carried by the
   `{role}-session` Prompt, called with the arguments `element` and `state` (approver ruling R18,
   2026-09-30, `release-planning-rel-v0.3-plan`; `spec-016` §2.4; the `spec-004` §3.1–§3.2 amendment is
   carried to a task).

4. **Two launch kinds, both in the adapter shape now.** They say whether the agent has a terminal.
   They are separate from `dl-135`'s execution modes (`fresh`, `resume`, `reference`), which say
   which earlier session a run builds on.
   - **interactive** (v0.3): the agent inherits the terminal and the user works in the agent's own
     session. WingFoil writes only to stderr, before launch and after exit.
   - **headless** (v1.0, with P4.12): the agent runs without a terminal. It reports a structured
     result, `PASS`, `FAIL` or `ERROR`, by calling an MCP Tool on the `wingfoil` server (provisionally
     `gate.report`). If the Tool is never called, the result is `ERROR`, never `FAIL`: an agent that
     crashed or ignored the instruction has not judged the work. A non-zero exit of the agent process
     is also `ERROR`. The verdict comes from the Tool call WingFoil receives, not from the agent's
     prose.

5. **`agent execute` records every run.** It writes `dl-114`'s run record with `dl-135`'s session id
   and fills it from the adapter's declarations. The record shape, the run id and the way the record
   is committed are specified in `spec-016`.

6. **Tests never launch a real agent.** A fake agent executable is declared through a **custom**
   adapter in test fixtures. It exercises the same manifest path as any project adapter. CI cannot
   run a real agent: it has no credential, and the test must not depend on the network or on the
   model. Jest and CI also give the child no terminal, so the adapter declares whether its
   interactive launch requires one (`launch.interactive.terminal: required | optional`, `spec-016`
   §2.2): the fake declares `optional` and runs the interactive success path headless, and the
   terminal check is the last one before the spawn, so every refusal is testable without a
   pseudo-terminal (`spec-016` §2.7, §3.3).

**Relation to `adr-004`.** This ADR complements `adr-004` and does not supersede it. `adr-004` fixed
the protocol the agent reads and writes through. This ADR fixes who starts the agent and how. Its
decision text says the MCP server is "implemented via the Anthropic SDK" (`adr-004-mcp-over-stdio.md:34`,
`:48`). That is inaccurate: the server is built on `@modelcontextprotocol/sdk` (`.wingfoil/dna.yaml:83`). `task-117`
left that sentence alone because decision records are "historical by nature"
(`docs/04_memory/v0.2.2/task-117-remove-the-unused-anthropic-sdk.md:96`), and this ADR does too.
Supersedes nothing.

**Amendment of `REQ-INT-07`** (proposed text; applied with a `doc-versioning` bump to
`03_sard/04_integrations.md` by the task that implements P5.3.1):

> ### REQ-INT-07 — Agent execution wrapper (agent CLI + MCP)
>
> * **Description:** `wingfoil agent execute` launches the agent's own command-line program through a
>   declared per-agent adapter, resolving role and element from the workflow step, registering the
>   `wingfoil` MCP server for the launched process, and recording the run and its execution mode
>   (`dl-135` Action 3). WingFoil holds no model
>   credential and calls no model API.
> * **Rationale:** A single command bridges workflow → agent with context, for any agent that can
>   take an initial prompt and register an MCP server (North Star: different AI agents).
> * **Fit Criterion:** `agent execute --next` resolves role and element from the active step,
>   assembles and validates the execution context, and verifies that the `wingfoil` MCP server answers,
>   all before the agent process starts; explicit `--element type:id` overrides the resolved element;
>   the launched process receives only the argument vector its adapter declares; every spawned run
>   appends one run record, holding the execution mode that ran, or, when the record cannot be
>   committed, prints it on stderr (`spec-016` §4.3–§4.4); a test using a fake adapter asserts all
>   four without launching a real agent and without a terminal.
> * **Traceability:** Feature P5.3.1 (US-1-03, BDD `p5-interaction/P5.3.1-agent-execute.feature`);
>   Feature P5.3.2 (US-2-07, BDD `p5-interaction/P5.3.2-agent-role-selection.feature`);
>   `adr-004`; `adr-012`; `dl-114`; `dl-135`.

The same edit replaces "Agent SDK" in `04_integrations.md:4`'s derivation line with "agent CLI". It
also replaces the dependency cell "Agent SDK, MCP, Directives" of P5.3.1 (`06_features.md:238`) with
"Agent CLI adapter, MCP, Directives", and "MCP, Agent SDK" of P5.4.4 (`:244`) with "MCP, agent CLI
adapter", each with a `doc-versioning` bump. P5.4.5 (`:262`, "Agent SDK, conversation") is out of v0.3's `features:` and stays until
its own release plans it.

## Consequences

- **Positive:**
  - **Agent neutrality holds for the North Star.** Any agent with a CLI that takes a prompt and an MCP
    server can be the second run the Determinism Index compares. Adding one is a manifest, not a
    WingFoil release.
  - **No model credential exists in WingFoil.** The `REQ-SEC-08` surface stays what it is: the git
    store and the secret scan over `.wingfoil/`. Adapter manifests are git-tracked, so the scan
    covers them, and they have no field for an environment value.
  - **The I component has one enforcement point.** Every agent gets the same bootstrap and the same
    MCP payload for the same `(role, element, commit)` (`REQ-SYS-07`, `REQ-STATE-09`). What an agent
    does with it is the O component, which `dl-131` says is measured and never promised.
  - **`dl-114` and `dl-135` get their writer.** The run record is written by the one process that
    sees every run start and end.
- **Negative:**
  - **Adapters are maintenance.** Agent CLIs change their flags and output formats without notice
    to WingFoil, so a built-in adapter can break between two agent releases. The fake adapter proves
    WingFoil's side, but nothing in CI proves a real agent's side. Each built-in adapter is verified
    by hand against a pinned agent version, and that version is recorded in the adapter.
  - **Interactive mode sees little.** Once the terminal belongs to the agent, WingFoil cannot parse
    its output. Session id, model and tokens come only from what the adapter can learn before launch
    or ask for after exit, and for some agents that is nothing. `not-reported` makes the gap visible
    (`dl-114` Q3 (i)) but does not close it.
  - **"Agent ready" means ready to launch.** `REQ-PERF-01` can only time what WingFoil controls: step
    resolution, context assembly, the MCP check and the process spawn. The agent's own start-up is
    outside it. `spec-016` states the reading, and the `REQ-INT-07` amendment above keeps the fit
    criterion on WingFoil's side.
  - **An agent without MCP support cannot be used.** An adapter that cannot register the server is
    refused, because context would not reach the agent the way `adr-004` requires.
  - **Context delivery depends on the agent.** The bootstrap asks the agent to fetch the
    `{role}-session` Prompt; whether an agent CLI lets its model do so is verified per built-in by
    hand (`spec-016` §2.8), not asserted.
- **Neutral:**
  - **The `dna.yaml` stack line is already correct.** `.wingfoil/dna.yaml` no longer names the
    Anthropic SDK (`32c57d7b`, `task-117`). No stack entry is added for agent CLIs, because they are
    the customer's tools, not WingFoil's stack. This repository's `team.agents` entry,
    `AI agent (Claude/Cursor/etc.)` (`.wingfoil/dna.yaml:125-128`), gains an adapter reference when
    `spec-016` lands. Until `spec-002` declares `team.agents[].adapter`, `dna update` / `dna set`
    refuse that path (`spec-002` §"Unknown keys: accepted on read, refused on write"); a project
    whose `dna.yaml` has no `team.agents` yet also meets `bug-126` when it adds the first entry.
  - **`spec-006` keeps the `agentExecute` row, with a new reason.** The row is still
    `mutates: true` (`spec-006-core-domain-api.md:196`), but because the operation commits the run
    record, not because it "can advance the active workflow's step context" (`:198-201`). Step
    advancement is P4.10 and belongs to v1.0 (plan R3). `spec-016` states the reason.
  - **Only this repository's configuration changes.** `.mcp.json` stays as `dl-026` ratified it,
    for users who start their agent by hand. A launched agent gets its registration from the adapter.
  - **The historical records are left alone.** `adr-002`, `adr-004` and `adr-005` still say
    "Anthropic SDK" (`adr-002-modular-monolith-dual-interface.md:44`,
    `adr-005-typescript-node-stack.md:15,29,37`). They are not edited, for the reason `task-117` gave.

## Process Notes

Authored during v0.3 `release-planning/record-adrs` (`release-planning-rel-v0.3-plan` step 4), from
approver ruling R2 of 2026-09-29, on branch `design/release_planning_v0.3`. Filed for the `dl-022`
spec-review and approver sign-off before `accepted`. Companion artefact: `spec-016` (agent
execution — adapter manifest, `agent` commands and the run record), drafted in the same planning
alongside `spec-017` (workflow commands and state deduction), which `agent execute --next` depends
on.

The planning brief expected this ADR to update the `dna.yaml` stack line that names the Anthropic
SDK. On this branch that line is already gone (`git log --oneline -S"Anthropic" -- .wingfoil/dna.yaml`
→ `32c57d7b docs(config): task-117 — dna.yaml drops the Anthropic SDK technology entry and its drift
note (v1.2)`), so the Consequences record it as done rather than as an action.

**Revised after the `dl-022` spec review** (same day, before submit): the `REQ-INT-07` fit criterion
records every *spawned* run and names the stderr fallback when the record cannot be committed, and
carries the execution mode (`dl-135` Action 3); the built-in/custom split cites `REQ-SEC-07` by
analogy, and `REQ-SEC-07` and `REQ-SYS-07` join `sard_ref`; the `dna.yaml` obstacle is `spec-002`'s
write-refusal of undeclared keys, not `bug-126`; point 6 states how the interactive path is tested
without a terminal. `adr-004`'s "implemented via the Anthropic SDK" is left as written.

**Revised after approver rulings R17–R18** (2026-09-30): the two v0.3 built-in adapters are named
(point 2) and the context primitive is stated as decided (point 3).

Confirming dl-022 pass (2026-09-30): N1, N10 applied.
