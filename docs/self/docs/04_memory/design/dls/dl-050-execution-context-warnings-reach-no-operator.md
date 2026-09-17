---
id: "dl-050-execution-context-warnings-reach-no-operator"
type: decision-log
title: "Directive-resolution warnings are computed for agent sessions but reach no operator — decide the surface that shows them"
status: in-discussion
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`resolveRoleDirectives` returns `{ directives, warnings }`, and `assembleExecutionContext` carries the
warnings on `ExecutionContext.warnings`. The warnings are the operator's only signal for three
configuration problems:

- a role with no assignments of its own (`dl-029`: `no directives assigned to role '<role>'`);
- a directive id defined in two files, and which one wins (`dl-037`, shadow warning);
- a role bound to a directive id with no file (`dl-042` D; implemented by `task-055`, see `dl-051`).

The design deliberately returns them instead of writing to stderr: `src/core/context.ts:35-40` on
`main` (`8a6a091`; `:38-42` after `task-055` merged at `9c83ca2`) — "free for the eventual CLI/MCP surface (`task-055-auto-load-directives-by-role`)
to render however that surface renders warnings". Measured, no surface does so for an agent session:

1. **MCP Prompts — dropped by design.** `src/mcp/prompt.ts:122-126` on `main` (task-039): the warnings
   "are **not** embedded in the prompt", since `spec-004` §3.2 defines the payload as role header +
   directive blocks. `task-058`'s second pass keeps this (`git show 3f27d98:src/mcp/prompt.ts`,
   `buildRolePrompt` destructures only `directives`). The warnings are not logged either: the stdio
   server has no operator channel besides stderr, which nothing writes.
2. **Context assembly — no caller.** `grep -rn 'assembleExecutionContext(' src` → only its definition
   (`src/core/context.ts:208`; `:267` at `9c83ca2`). Its consumer, `wingfoil agent execute` (P5.3.1), is `minor-v0.3` scope
   (`docs/self/docs/04_memory/planning/rl-v1/minor-v0.3.md:16`).
3. **`directives list` — the only surface.** `task-055-auto-load-directives-by-role` (`749e0e9`,
   merged to `main` at `9c83ca2` while this batch was being written) makes `src/core/directives-list.ts`
   return `{ entries, warnings }` (`dl-042`), with `--role` giving that role's resolver warnings.

So a human learns about a dangling or shadowed directive only by running
`wingfoil directives list --role <r>` on purpose. An agent session opened through `developer-session`
can silently receive fewer directives than configured (a dangling binding, a wrong shadow winner) and
nobody is told — the harm `dl-037`'s rationale names: "a directive an agent was supposed to obey and
never saw" (`dl-037-builtin-vs-custom-directive-precedence.md:74-75`).

## Decision

*Approver to choose; options are combinable.*

1. **Make `directives list` the ratified operator surface and add a check that runs it** (recommended
   for v0.2): the `dev-loop` / `release-planning` config sweeps, or `wingfoil audit` (P5.1.3) when it
   ships, run `directives list --role <r>` for every DNA role and fail on any warning. No spec change
   for MCP; the diagnostics get a deterministic, reviewable home.
2. **Emit warnings on `wingfoil mcp`'s stderr** at request time (MCP stdio servers may log to stderr;
   hosts typically capture it). Cheap, but the text ends up in a host log few operators read, and it
   is per-request noise.
3. **Carry warnings in the Prompt as a separate, clearly delimited block**, amending `spec-004` §3.2.
   The agent then sees them — but they are diagnostics about the configuration, not instructions, and
   mixing them into instruction text is what task-039 and task-058 both rejected.
4. **Defer to `agent execute` (v0.3)**, which renders `ExecutionContext.warnings` on its own stderr.
   Correct for that surface but leaves the MCP path silent indefinitely.

Recommendation: **1 now**, plus **4** as the rule `agent execute` must follow when it lands, so every
surface that assembles a context either shows its warnings or is covered by a check that does.

## Rationale

- The warnings exist precisely because these are silent-failure modes; computing them and showing them
  to no one reproduces the silence one layer down.
- Option 1 uses a surface that already exists (after `task-055`), is deterministic and reviewable, and
  adds no output channel to the context-building path (REQ-SYS-07).
- Option 3 conflicts with `spec-004` §3.2 and with two implementations' reasoning; it should only be
  chosen if agents themselves are meant to act on configuration problems.

## Actions

- Owner **approver**: choose.
- If 1: add the check to the relevant workflow sweep (or to `audit`'s scope in `minor-v0.4`) and record
  it in the v0.2 plan the sweep runs from.
- If 4 (in any combination): record it as an Acceptance Criterion input for the `agent execute` task in
  `minor-v0.3`.
- Hand the outcome to `task-058` (whose `prompt.ts` doc comment states the current drop) and `task-055`.

Related: `dl-029`, `dl-037`, `dl-042`, `dl-051`, `spec-004` §3.2, `spec-012` §5,
`task-039`, `task-055-auto-load-directives-by-role`, `task-058-mcp-prompts-role-based`.
