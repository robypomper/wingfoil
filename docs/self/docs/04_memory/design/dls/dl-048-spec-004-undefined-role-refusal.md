---
id: "dl-048-spec-004-undefined-role-refusal"
type: decision-log
title: "spec-004 §3 does not define the undefined-role Prompt refusal that BDD P5.2.2 requires"
status: in-discussion
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`docs/02_requirements/02_bdd/features/p5-interaction/P5.2.2-mcp-prompts.feature`, scenario "Error -
requesting a prompt for an undefined role":

> When an agent session starts under role "wizard" not defined in DNA
> Then the server returns error "no prompt for undefined role 'wizard'"

`spec-004-mcp-surface-contract` §3 (`awk '/^### 3/,/^### 4/'` on `main`, `8a6a091`) — §3.1 Naming &
enumeration, §3.2 Embedding contract, §3.3 No mutation — never mentions an undefined role:
`grep -n 'undefined\|wizard' docs/self/docs/04_memory/design/specs/spec-004-mcp-surface-contract.md` →
no output. Four things an implementer needs are therefore unspecified, and
`task-058-mcp-prompts-role-based` had to choose each (read on `task/task-058-mcp-prompts-role-based`,
`3f27d98`, `src/mcp/prompt.ts`):

1. **The message.** Only the BDD pins it. `task-058` emits it verbatim (lines 74-80).
2. **The JSON-RPC error code.** Unstated. `task-058` uses `-32602` `InvalidParams` (lines 70-72,
   `Object.assign(new Error(message), { code: ErrorCode.InvalidParams })`), so an SDK client reads
   `MCP error -32602: no prompt for undefined role 'wizard'` (pinned at
   `test/mcp/mcp-prompts.feature.test.ts:150`).
3. **What "an agent session starts under role R" means on the wire.** The BDD speaks of sessions; §3.1
   speaks of Prompts named `{role}-session`. `task-058` reads the step as `prompts/get("{R}-session")`,
   and answers a name that is not `…-session`-shaped with the SDK-style `Prompt <name> not found`
   instead (branch module doc, "keeps the SDK-equivalent … wording").
4. **Which role set is "defined in DNA", and when it is read.** §3.1 says the Prompt set is "derived
   from DNA at server start"; `task-058`'s second pass reads DNA per request. That timing question is
   `dl-049`; this DL only needs the answer to state where "known roles" come from.

This is also the same section `dl-039` (in-discussion) proposes to amend for its two illustrative
defects, so the edits should land together.

## Decision

*Approver to choose; recommended option first.*

1. **Amend `spec-004` with a §3.4 "Refusals" subsection** (recommended), stating:
   - `prompts/get` for `{R}-session` where `R` is not a role in `dna.yaml` `team.roles` → error code
     `-32602` (InvalidParams), message exactly `no prompt for undefined role '<R>'`;
   - `prompts/get` for a name not of the form `{role}-session` → `-32602`, message
     `Prompt <name> not found` (the SDK's own wording);
   - the BDD step "a session starts under role R" is realised as `prompts/get("{R}-session")`;
   - "defined in DNA" means `dna.yaml` `team.roles[].name`, read at the time `dl-049` settles.
   This ratifies what `task-058` already implements.
2. **Pin only the message** and leave the code and name-shape handling to implementation. Smaller edit,
   but a second MCP surface (v0.4 Tools) would face the same code question again with no precedent.
3. **Use a different code** (e.g. `-32601` MethodNotFound, or `-32603`). It would diverge from the
   SDK's own `Prompt … not found`, which uses `-32602`, so the same client would see two codes for the
   two unknown-name cases.

## Rationale

- The requirement already exists (BDD); only its protocol shape is missing, and the implementation has
  made reasonable, tested choices. Writing them down is cheaper than re-deriving them in the v0.4
  Tools task, which faces the same "unknown name" question.
- `-32602` matches the SDK's own not-found errors for prompts and resources
  (`node_modules/@modelcontextprotocol/sdk/dist/cjs/server/mcp.js:396,426` — `Resource … not found`,
  `Prompt … not found`, both `InvalidParams`), so clients see one code for every unknown-name refusal.
- Note for whoever edits: an `McpError` carries its code inside `message`, so the refusal must be thrown
  as a plain `Error` with a `code` to keep the wire string exact (`bug-034`).

## Actions

- Owner **approver**: choose 1, 2 or 3; settle together with `dl-039` and `dl-049` (same section).
- If 1: amend `spec-004` §3 with a dated Revision note (`dl-047`: specs carry no `version:`).
- Hand the outcome to `task-058` at its next review, so its choices are cited to the spec rather than to
  its own Execution Notes.

Related: `dl-039` (same section), `dl-049` (role-set read time), `bug-034` (McpError message prefix),
`task-058-mcp-prompts-role-based`, BDD `P5.2.2`, REQ-INT-02.
