---
id: "dl-055-core-error-details-never-reach-operators"
type: decision-log
title: "CoreError.details is dropped by every surface, so dl-032's `detail` and the offending file path never reach an operator"
status: in-discussion
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`dl-032` (`ready`) ratified option **(c)** for the illegal-transition error: the contract string
`illegal transition <from> -> <to> for type '<type>'` is the **message**, and the engine's explanation
("a `gates` state — its forward edge requires `approve`, not `submit`") "rides as the issue's detail
rather than replacing it". Its rationale: "The shipped message is genuinely more useful, and throwing it
away to satisfy a string match would be a regression in operator experience. Option (c) keeps both by
separating *message* from *detail*."

`task-045` implements the split (`task/task-045-memory-submit`, `7bfa835`):
`src/memory/state-machine.ts:302-309` puts the explanation in the issue's `detail`, and
`src/core/memory-transition.ts:94-96` returns
`coreErr({ code, message, details: { issues: error.issues } })`.

**No surface renders `details`.** Measured on `main` (`8a6a091`):

- **CLI:** `src/cli/registrar.ts:132` calls `emitError(result.error.message, { format })`;
  `src/cli/error.ts:16-20` writes `error: <reason>` (console), `{"error": <reason>}` (json) or the YAML
  equivalent. `details` is never read.
- **`--verbose`:** does not help. A `VALIDATION` error whose `details.issues[0].file` names the failing
  document printed identical output with and without `--verbose` (reproduction in `bug-031`: `memory
  search` over one malformed document).
- **MCP:** `src/mcp/registrar.ts:27` maps a failed `CoreResult` to `{ ok: false, message:
  result.error.message }`; `details` is dropped there too.
- **Spec:** `spec-008-cli-grammar` §6 (Error format, REQ-INT-08) defines exactly `error: <reason>` and
  `{"error": "<reason>"}`; `--verbose` "appends diagnostic lines (stack trace, underlying git output)".
  There is no slot for a structured detail.

So `dl-032`'s stated benefit is not delivered: the operator gets the terse contract string only. The
same gap hides the **file path** of every `ValidationError` issue (`ValidationError.yamlParse` records
`file`, `src/validation/errors.ts:66-70`), which is why a malformed Memory document produces an error
that does not name it (`bug-031`).

## Decision

*Approver to choose.*

1. **Render issue details in every format, after the contract line** (recommended). Console: the
   `error: <reason>` line unchanged, then one indented line per issue with its `file` and `detail`
   when present. JSON/YAML: add an optional `details` array
   (`{"error": "<reason>", "details": [{"file": …, "detail": …}]}`) — additive, so existing consumers
   keep parsing `error`. MCP: append the same detail lines to the tool/resource error text, or carry
   them in the JSON-RPC `error.data` field. Amend `spec-008` §6 to define the slot.
2. **Render details only under `--verbose`** (console and structured). Keeps default output minimal;
   but the file path of a parse error is the one thing a user needs by default.
3. **Fold the detail into the message** where it matters (e.g. `yamlParse` puts the path in its
   message) and keep `details` machine-only. Cheapest for `bug-031`, but reverses `dl-032`'s
   message/detail separation for the transition error.

## Rationale

- A field computed on every error and shown on none is dead weight, and it gives a false sense that
  `dl-032`'s operator-experience concern was addressed.
- Option 1 preserves the stable contract line that BDD and scripts match on (REQ-INT-08) while making
  the diagnostic visible; the JSON change is additive.
- `error.data` is the JSON-RPC field designed for exactly this on the MCP side.

## Actions

- Owner **approver**: choose.
- Amend `spec-008` §6 (dated Revision note per `dl-047`) and, for MCP, `spec-004`'s error contract.
- Raise one task for the CLI renderer and the MCP registrar; `bug-031`'s filename half closes with it.
- Hand the outcome to `task-045` (its error is the first consumer) and `task-046`/`task-047`.

Related: `dl-032`, `bug-031`, `spec-008` §6, REQ-INT-08, `task-045-memory-submit`, `dl-053`.
