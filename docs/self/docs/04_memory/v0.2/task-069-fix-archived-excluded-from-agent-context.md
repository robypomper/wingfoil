---
id: "task-069-fix-archived-excluded-from-agent-context"
type: task
title: "Fix: archived documents still reach agent context through the MCP collection Resource and the context builder"
status: backlog
release: "v0.2"
priority: "High"
tags: ["v0.2", "architecture"]
ref: "REQ-STATE-06"
bug: "bug-010-deprecated-reaches-agent-context"
depends_on: ["task-035-bounded-context-relevance", "task-037-role-task-scoped-context"]
tmpl_version: 260703
---

## Description

REQ-STATE-06's Fit Criterion — *"a `deprecated` document never appears in an assembled agent
context"* — is unmet on **two** surfaces, and `dl-028` widened the set it must be met against.

1. `src/mcp/memory-resource.ts` builds the `wingfoil://memory/{type}` collection by calling
   `listMemoryDocumentsByType` with no status filter, so an agent reading `wingfoil://memory/adr`
   receives archived ADRs. Its sibling `wingfoil://memory/search` **is** filtered (`task-038`), so the
   two agent-facing read paths are mutually inconsistent.
2. `assembleExecutionContext` (`src/core/context.ts`, landed by `task-037`) resolves the target
   element's Memory document with no filter at all.

## Acceptance Criteria

1. Both surfaces exclude archived documents, using the **shared** `isArchivedStatus`
   (`src/memory/state-machine.ts`, exported from `src/memory`) — not a second local predicate. That
   primitive is what `dl-028` ratified as the single definition.
2. The excluded set is `{deprecated, superseded}` per `dl-028` and `spec-012` §6 as amended — **not
   `deprecated` alone**. A fix that closes only half the set closes none of the decision.
3. `draft`'s asymmetry is preserved: excluded from **context**, still returned by a default
   `memory search`. `task-038` built that deliberately and `task-035` pinned it with mirrored
   assertions; do not collapse the two sets.
4. Explicit retrieval still works: a `superseded` ADR remains resolvable by id, and
   `--status superseded` / `--status deprecated` still resolve. Verify on the real CLI, not only in
   tests — `task-035`'s reviewer established that as the bar for this area.
5. Full suite, coverage ≥80, `docs:api`, `tsc` and `eslint` all green.

## Implementation Notes

Scheduled into `v0.2` under the exception extended in **`dl-034`** point 4, and admitted on
**ordering rather than urgency**. Both surfaces are unwired today — no `.mcp.json` exists (`dl-026`),
and `assembleExecutionContext` has no CLI or MCP surface — so nothing leaks right now. What makes this
a v0.2 concern is **`task-055-auto-load-directives-by-role`**: it delivers P3.6, auto-loading
directives into agent context at task execution, which is precisely what makes the context path
user-reachable. If `task-055` lands first, v0.2 ships a context path that leaks archived documents.
Same ordering logic that put `task-064` ahead of `task-057`.

The fix is cheap because the groundwork is done: `dl-028` settled the set, `task-035` delivered the
shared predicate. Expect roughly two call sites plus their tests.

`bug-010` is linked, so `dev-loop`'s `bug.sync_state` advances it automatically.

## Execution Notes
