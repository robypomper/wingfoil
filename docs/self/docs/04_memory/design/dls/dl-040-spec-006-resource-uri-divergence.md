---
id: "dl-040-spec-006-resource-uri-divergence"
type: decision-log
title: "Core operations diverge from spec-006 §3's Resource-URI column, and nothing tracks it"
status: in-discussion
context: "dev-loop-review"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`spec-006-core-domain-api` (`approved`) §3 pins a Resource URI for each core operation, including
parameterised forms such as `wingfoil://memory/history/{id}` and `wingfoil://memory/search/{query}`.

The MCP registrar (`src/mcp/registrar.ts`) derives Resources **mechanically** from the `CoreOperation`
shape — and that shape carries no parameter metadata. So it can only produce the zero-argument form:
`wingfoil://memory/history`, `wingfoil://memory/search`. Two shipped operations therefore do not match
the column the spec pins for them.

This is not new, and that is the problem. `task-021` hit it first with `memorySearch` and recorded it
in a source comment and its own Execution Notes — and `task-021` is `done`, so nothing reschedules
those. `task-049` then added `memoryHistory` and made the divergence two-wide. A search across
`docs/self/docs/04_memory/` for a bug, decision-log or tech-spec covering it returns **nothing**: the
only elements that mention it are three `done` task files and the spec itself.

It will widen again. Every future operation taking an argument reproduces it by construction, and each
one will be recorded the same way — in notes nobody re-reads.

**Third occurrence, `directivesList` (`task-053`, v0.2)** — and it is worth stating precisely, because
it is the same *cause* wearing different clothes. `task-053` added a `--role` filter to
`directives list`. `spec-006` §3 pins that operation's Resource as the zero-argument
`wingfoil://directives/list`, and the registrar emits exactly that — so unlike the first two
occurrences **there is no divergence from the URI column**. What is missing is the ability to express
the filter at all: `registerCoreModules` calls `options.buildParams({moduleName, operationName, root})`
(`src/mcp/registrar.ts:80-84`), a context with no `options` field, so no operation can pass one —
`src/core/registry.ts:63,186` already documents that "the MCP surface never populates them". An MCP
consumer cannot request the filtered listing, so returning the full inventory is the correct
degeneration, not a silent loss of data.

That makes the count **two spec divergences and one capability gap, from one root cause**: no
parameter metadata on `CoreOperation`. Option 1 below closes all three; options 2 and 3 close neither
this one nor the next. Recorded here rather than in `task-053`'s Execution Notes precisely because
this decision-log's own complaint is that occurrences accumulate in notes nobody re-reads.

Worth noting what is **not** broken: `createMcpServer` registers only `registerReadOnlyResources` and
deliberately does not call `registerCoreModules`, so no running MCP surface is affected today. The
divergence lives between an approved spec and a mechanically-derived registry that only the parity
test exercises.

## Decision

*Approver to choose.*

1. **Teach the registrar parameterised Resource templates** (recommended). Add parameter metadata to
   `CoreOperation` and have the registrar emit `ResourceTemplate`s, so the derived URIs match §3 as
   written. Closes the divergence for every current and future operation at once, and keeps the
   registry mechanical — which is the property that made it trustworthy in the first place.
2. **Amend `spec-006` §3 to the mechanical zero-argument form**, and pass arguments some other way.
   Cheaper, and honest about what the derivation can express — but it gives up addressability that the
   spec deliberately specified, and `wingfoil://memory/history` with no id is a strange Resource.
3. **Record the divergence as accepted** and stop treating §3's parameterised column as binding. The
   least work and the most corrosive: it leaves an approved spec whose Resource column nobody
   implements.

## Rationale

- **Option 1 is the only one that scales.** The count went from one to two in a single release without
  anybody deciding it should; options 2 and 3 accept a growing list, while 1 makes the next operation
  correct for free.
- **The cost is contained but real**: `CoreOperation` is the shape the CLI registrar reads too
  (`spec-006` §4.1 forbids either surface holding its own operation list), so adding parameter metadata
  touches both derivations. That is a task, not a footnote — which is exactly why it needs an element
  rather than another line in someone's Execution Notes.
- **Option 2 deserves a fair hearing.** If the MCP surface is genuinely meant to be a browse-and-fetch
  channel rather than a query one, the zero-argument collection plus the existing by-id Resource may
  be the right shape, and §3's parameterised column may be the thing that drifted. Whoever decides
  should check what the P5.2 features actually ask for before defaulting to option 1.
- **Not urgent, and that is the trap.** No running surface is affected, so this can be deferred
  indefinitely — which is how it got to two occurrences unrecorded. Stamped `v0.3` so
  `release-planning` picks it up by construction.

## Actions

- Owner **approver**: choose 1, 2 or 3, after checking what P5.2.1/P5.2.2/P5.2.3 require of the URI shape.
- If 1: raise a task to add parameter metadata to `CoreOperation` and emit `ResourceTemplate`s from
  `src/mcp/registrar.ts`; it must also update `test/core/parity.test.ts`'s expected Resource list and
  remove the two source comments that currently carry the gap.
- If 2: amend `spec-006` §3 (new spec version per the doc-versioning directive).
- Either way: delete the now-redundant gap notes from the source comments, so the record lives in one
  place.
- Related: `task-021` (first occurrence, `memorySearch`), `task-049` (second, `memoryHistory`),
  `task-053` (third — the `--role` capability gap, not a URI divergence), `task-039` (owns
  `src/mcp/registrar.ts`'s area this cycle), `spec-004` §2 (the Resource contract),
  `dl-042-directives-list-output-contract` (the same command's payload shape).
