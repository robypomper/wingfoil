---
id: "dl-038-archived-exclusion-default-in-memory-primitives"
type: decision-log
title: "Should the Memory scan primitives default to excluding archived documents, so a forgetful consumer fails closed?"
status: in-discussion
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`task-069-fix-archived-excluded-from-agent-context` closed `bug-010` by filtering at each
**agent-facing call site** — the MCP collection Resource and `assembleExecutionContext` — while
leaving the underlying scan primitives, `listMemoryDocumentsByType` and
`findMemoryDocumentByTypeAndId`, neutral.

Its review scrutinised that against the shape this project rejected in `task-044` — a check a future
addition can silently skip — and concluded the two are **not** the same. `task-044`'s defect was a
duplicated list where divergence had no legitimate meaning, so derivation could make the bad state
unrepresentable. That option does not exist here: `findMemoryDocumentByTypeAndId` has a **required**
unfiltered consumer, the single-document Resource `wingfoil://memory/{type}/{id}`, which REQ-STATE-06
itself protects ("remaining present on disk and in git history") and which `bug-010`'s own Expected
Behavior names. Filtering inside that primitive would be flatly wrong for it. The layering is also
already this project's approved architecture: `src/core/relevance.ts` (`task-035`) scans raw and
applies `isExcludedFromContext` at its own call site, and `dl-028`'s text asks for one shared
*definition* consumed by the search path and the context path — which is what shipped.

So the design is right. What remains is a **residue**: any future agent-facing consumer of either
primitive must remember to filter at its own call site, and forgetting reproduces `bug-010`. Today the
blast radius is small and verified — `listMemoryDocumentsByType` has exactly one consumer,
`findMemoryDocumentByTypeAndId` has two, one deliberately unfiltered — but "small today" is what
`bug-010` was before `task-037` added a second surface.

This DL exists because that residue currently lives **only** in `task-069`'s Execution Notes, and
nothing reschedules a `done` task's notes. Its reviewer asked for it explicitly before approval.

## Decision

*Approver to choose.*

1. **Add an `includeArchived` option to both primitives, defaulting to exclusion** — mirroring
   `MemorySearchOptions.includeArchived`, which `task-035` already established for the search path.
   The single-document Resource passes `includeArchived: true` explicitly, making its intent visible
   at the call site rather than implicit in the primitive's neutrality. Omission then fails **closed**.
2. **Keep the primitives neutral, and add a consumer guard** — a structural test enumerating the
   agent-facing consumers of each primitive and asserting each applies the filter, in the style of
   `test/core/latency-budget-placement.test.ts`. Cheaper, but grep-equivalent and brittle, and it
   asserts an omission has not happened rather than preventing it — the argument `task-044` used
   against exactly this shape.
3. **Keep the primitives neutral, document the contract, change nothing else.** Defensible while the
   consumer count stays at three; the risk is that nothing marks the moment it stops being small.

## Rationale

- **Option 1 is the only one that makes omission fail closed**, which is the property this project has
  twice chosen to pay for: `task-044`'s derivation and `dl-034`'s lint gate were both bought on the
  same argument. It also makes the one legitimate unfiltered consumer *say so*, which is better
  documentation than a comment explaining why the primitive is neutral.
- **The cost is real but bounded**: it changes two primitives' signatures across `src/memory`,
  `src/mcp` and `src/core`, and it touches `test/memory/query.test.ts`'s characterization test from
  `task-038`, which deliberately pins `listMemoryDocumentsByType` as *not* the policy layer. That
  pinned contract is the strongest argument for option 3 — changing it means reopening a ratified
  decision from a closed task, which is precisely why `task-069` was right to decline it in-scope.
- **Option 2 is the weakest**: it carries most of option 1's cost in test maintenance while delivering
  none of its fail-closed property.
- **Timing.** Nothing is broken today, so this is not urgent. It becomes urgent the first time someone
  adds a third agent-facing consumer — and the point of recording it now is that such a person will
  have no reason to read `task-069`'s Execution Notes.

## Actions

- Owner **approver**: choose 1, 2 or 3.
- If 1: derive a task at the next `release-planning`; it must also amend `task-038`'s characterization
  test deliberately rather than incidentally, and state the new default in `spec-004` §2.1 and
  `spec-012`.
- If 3: record the contract in `spec-004` §2.1, which today describes `wingfoil://memory/{type}` as a
  "list of elements of that type" with no mention of the archived exclusion — the policy currently
  lives only in a source comment.
- Related: `dl-028` (which set the archived set), `bug-010` (the reach this closes), `task-035`
  (`MemorySearchOptions.includeArchived`, the precedent option 1 would mirror), `task-044` (the
  fail-closed-by-construction argument).
