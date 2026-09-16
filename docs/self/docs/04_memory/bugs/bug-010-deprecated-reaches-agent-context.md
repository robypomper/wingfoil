---
id: "bug-010-deprecated-reaches-agent-context"
type: bug
title: "Deprecated documents reach agent context through the MCP collection Resource, against REQ-STATE-06"
status: resolved
severity: "medium"
release-origin: "v0.2"
release: "v0.2"
feature: "P1.9"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

The MCP Resource `wingfoil://memory/{type}` returns every document of a type, including those with
`status: deprecated`, so REQ-STATE-06's "never appears in an assembled agent context" does not hold
on the one agent-facing surface that exists today.

## Steps to Reproduce

1. In a repository with at least one Memory document at `status: deprecated` (e.g. an `adr`), start
   the server: `wingfoil mcp`.
2. Have an MCP client read the Resource `wingfoil://memory/adr`.
3. Observe the deprecated document in the returned collection.

## Expected Behavior

Per **REQ-STATE-06**: *"A `deprecated` document never appears in an assembled agent context nor in
default `memory search` results, while remaining present on disk and in git history."* The collection
Resource is an agent-facing read path, so the deprecated document should be absent from it while
staying retrievable by explicit id through `wingfoil://memory/{type}/{id}`.

## Actual Behavior

`src/mcp/memory-resource.ts` builds the collection by calling `listMemoryDocumentsByType(root,
memoryYaml, type)` and mapping `{id, title, status, tags}` with no status filter. Every deprecated
document of that type is returned. The sibling Resource `wingfoil://memory/search` **is** filtered
(`task-038-deprecated-excluded-from-context` shipped the exclusion in `searchMemoryDocuments`), so the
two agent-facing read paths now behave inconsistently.

## Notes

A second surface is arriving. `task-037-role-task-scoped-context` (`in-review`) adds
`assembleExecutionContext`, which resolves the target element's Memory document with no deprecated
filter; once it merges alongside `task-038`, an element at `status: deprecated` will be returned in
`context.memory`. The two surfaces are the same defect and should be fixed together — the shared
predicate to call is **`isArchivedStatus`** (`src/memory/state-machine.ts`, exported from
`src/memory`). It supersedes `task-038`'s `isDeprecatedStatus`, which `task-035` removed outright when
it implemented `dl-028`: the archived set is now `{deprecated, superseded}`, so this fix must exclude
both, not only `deprecated`.

Related decision: **`dl-028-archived-states-excluded-from-context`** is deciding *which statuses*
count as archived (whether `superseded` joins `deprecated`). That DL settles the set; this bug fixes
the reach. Fixing this bug before `dl-028` ratifies would mean revisiting the call sites, so the
natural order is `dl-028` first, then one fix covering both surfaces against the ratified set.

## Triage & Execution Notes

- capture (`bug-ingest`, plan `bug-ingest-rel-v0.2-review-findings-plan`): found by the `dev-loop`
  review gate over `task-034`..`task-044`, surfaced independently by the `task-037` and `task-038`
  reviews. The MCP surface was verified on `main`; the `assembleExecutionContext` surface is on an
  unmerged branch and is recorded here as the incoming second half, not as a present defect.
  Severity `medium` — a requirement's Fit Criterion is unmet on a live read path, no data loss.
