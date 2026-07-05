---
id: "task-009-mcp-resource-fetch-latency"
type: task
title: "Infrastructure: REQ-PERF-04 — MCP resource fetch latency"
status: done
release: "v0.1"
priority: "Blocker"
tags: ["v0.1", "architecture"]
ref: "REQ-PERF-04"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

REQ-PERF-04 bounds the latency of agent-side reads over the MCP **Resources** channel — fetches of DNA
entries (`wingfoil://dna`) and Memory documents (`wingfoil://memory/*`) — because an agent session's
context assembly must stay within the overall 30 s budget (REQ-PERF-01). This task implements the MCP
Resources handler in `src/mcp` as a thin, read-only adapter (per REQ-SEC-05: Resources and Prompts never
mutate) over the same bounded query functions built for `src/core` (shared with REQ-PERF-02's CLI
commands), and ensures the MCP server process itself sustains repeated Resource fetches for the
duration of an agent session without needing a restart — i.e. no per-fetch cold-start cost, no resource
leak across a long-running stdio session.

## Acceptance Criteria

Per the SARD fit criterion (`docs/02_requirements/03_sard/02_performance-nfr.md`, REQ-PERF-04), with the
measurement conditions the same document defines:

> A single MCP Resource fetch returns in < 1,000 ms (p95); the MCP server sustains queries for the
> duration of an agent session without restart.
>
> Measurement conditions: latency targets are evaluated as **p95 over ≥ 20 runs** on a reference
> repository of **1,000 Memory documents**.

Testable form:
- A single `wingfoil://dna` or `wingfoil://memory/{id}` Resource fetch over the MCP stdio transport
  completes in under 1,000 ms at the p95 percentile across at least 20 timed runs on the 1,000-document
  reference repository.
- Repeated fetches across a simulated agent session (no server restart) show no latency degradation
  and no dropped connection.

## Implementation Notes

- `spec-004-mcp-surface-contract` is the authoritative definition of the Resources channel — URI scheme
  (`wingfoil://dna`, `wingfoil://memory/*`, `wingfoil://workflows`), the read-only refusal contract, and
  the strict Resources/Prompts (read) vs Tools (mutate) partition (REQ-SEC-05) this task must respect.
- `spec-006-core-domain-api` is where the actual query logic lives — the MCP Resource handler must be a
  thin wrapper over the same `CoreModule` functions used by the CLI's `dna show`/`memory search` (task
  `task-008-dna-memory-query-latency.md`, REQ-PERF-02), not a separate reimplementation.
- Related feature work in this release that this infra task unblocks (`related_stories` in
  `docs/03_backlog/04_backlog/by-release/v0.1.json`, backlog `TASK-007`): `TASK-028` "Implement MCP
  Resources (DNA + Memory)" (memory `task-030-implement-mcp-resources.md`).

## Execution Notes

- **design:** `agent.verify_specs` found no gap. The task's `ref` (REQ-PERF-04) plus
  `spec-004-mcp-surface-contract` and `spec-006-core-domain-api` (both named in Implementation
  Notes) are all `status: approved` already; no new tech-spec was authored. Phase passed straight
  through.

- **SCOPE decision (foundation vs. task-030-implement-mcp-resources feature work) — record for the
  reviewer:** REQ-PERF-04 needs two things measured: a `wingfoil://dna` fetch and a
  `wingfoil://memory/{id}` fetch, both at p95 over the 1,000-doc reference repo, plus sustained-session
  evidence. This task adds the smallest defensible foundation, not `task-030`'s full Resources
  feature:
  - `wingfoil://dna/show` — **no new code.** Measured through the already-registered, production
    `registerCoreModules`/`CORE_MODULES` path (task-006's `dnaShow` CoreOperation wrapping
    `loadDnaYaml`). Confirms task-006's existing Resource is already fast; the mechanical
    `wingfoil://dna/show` URI (not bare `wingfoil://dna`) is the form task-006/spec-004's zero-argument
    scheme already produces in production — this task did not change that.
  - `wingfoil://memory/{id}` — **one new, deliberately thin adapter.** Per the task brief's own
    scoping note: no `memoryShow`/`memoryGet` `CoreOperation` exists in `CORE_MODULES` yet (task-008
    left its query primitives unregistered on purpose — see `src/core/index.ts`'s SCOPE note).
    Registering the resource through `registerCoreModules` would therefore have required either (a)
    adding a real `memoryShow` CoreOperation to `CORE_MODULES` — completing `task-021`'s
    (`memorySearch`) or `task-030`'s (MCP Resources feature) own acceptance criteria ahead of them —
    or (b) inventing a parallel registration path outside the `CoreModule[]` registry, which
    `spec-006` §4 forbids ("no per-surface wiring is hand-written" / no operation reachable from one
    surface but not the other). Chose neither: added `findMemoryDocumentById` (new,
    `src/memory/query.ts` — a linear id-match scan over task-008's existing
    `listMemoryDocumentPaths`/`loadMemoryDocumentSummary`, no keyword/tag ranking, at most one
    result) and `registerMemoryDocumentResource` (new, `src/mcp/memory-resource.ts`) — a single
    `ResourceTemplate` for the exact `wingfoil://memory/{id}` URI this task's own Acceptance Criteria
    names, registered directly via `McpServer.registerResource` alongside (not instead of)
    `registerCoreModules`, structurally read-only (no Tool registration exists for it — REQ-SEC-05).
    Deliberately NOT built here, left to `task-030-implement-mcp-resources`: the richer
    `wingfoil://memory/{type}` collection listing and `wingfoil://memory/{type}/{id}` two-segment
    addressing (spec-004 §2.1's fuller scheme), the `metadata` envelope field (spec-004 §2.2's
    `id/type/status/title` block), the exact `"resources are read-only"` write-refusal string
    (spec-004 §2.3 — no write path was ever wired for this Resource, so there is nothing to refuse,
    but the literal refusal-message contract is task-030's to implement across the whole Resources
    surface), and any `CORE_MODULES` registration. This is the same "smallest defensible foundation,
    not the feature" judgment task-008 recorded for its own query primitives — if the
    reviewer/Roberto judge `findMemoryDocumentById` should instead be a real `CoreOperation` now,
    that is a low-risk follow-up, not a rewrite.
  - The sustained-session requirement ("no restart... no degradation... no dropped connection") is
    evidence-only, not a code change: `test/mcp/resource-latency.test.ts` drives 200 fetches (mixed
    `wingfoil://dna/show` + six different `wingfoil://memory/{id}`s) over one never-reconnected
    `InMemoryTransport` client/server pair and asserts no error and no latency-growth trend. No
    production code addresses "sustained session" directly — there is no per-fetch cache, connection
    pool, or other stateful mechanism in either Resource handler that could leak or degrade; the test
    is what demonstrates that absence of state is itself what keeps repeated fetches flat.

- **red:** wrote failing tests first — `findMemoryDocumentById` unit tests added to
  `test/memory/query.test.ts`, and the full REQ-PERF-04 acceptance benchmark,
  `test/mcp/resource-latency.test.ts` (a deterministic 1,000-Memory-document fixture — 700 tasks
  across 7 release directories with **globally-unique** ids (`task-{n}-r{release}-doc`, unlike
  task-008's own fixture whose task ids repeat per release — fine for a keyword scan, ambiguous for
  an id lookup) + 100 each of adr/dl/spec, index-derived content only, no `Math.random`/`Date.now`
  per REQ-SYS-07). Confirmed both suites failed — `findMemoryDocumentById` and
  `registerMemoryDocumentResource`/`src/mcp/memory-resource` did not exist yet — before writing any
  implementation (verified by temporarily reverting the not-yet-committed implementation files and
  re-running `npx jest`).

- **green:** minimum implementation — `findMemoryDocumentById` (`src/memory/query.ts`),
  `registerMemoryDocumentResource` (new `src/mcp/memory-resource.ts`), exported from
  `src/mcp/index.ts`. All new + existing tests passed; one `tsc --noEmit` error surfaced in the new
  test file (the MCP SDK's `ReadResourceResult.contents[]` is a `TextResourceContents |
  BlobResourceContents` union — `.text` isn't statically present on the blob variant), fixed with an
  explicit `'text' in content` narrowing guard rather than a cast.

- **refactor:** dropped one now-provably-dead branch: `registerMemoryDocumentResource`'s read
  callback initially handled `variables.id` as `string | string[]` (the SDK's generic `Variables`
  type) via `Array.isArray(...) ? rawId[0] : rawId`, but the `wingfoil://memory/{id}` template has no
  `*`/`+` explode modifier, so the SDK's `UriTemplate.match` can never actually bind `id` to an array
  for this template — confirmed by reading `uriTemplate.js`'s `match()` (explode + comma-containing
  value is the only path that produces `string[]`). Removed the branch, kept a one-line comment
  recording why; raised `src/mcp/memory-resource.ts` from 66.66% to 100% branch coverage. Project-wide
  coverage after this task: 98.69% statements / 90.49% branches / 100% functions / 99.13% lines —
  comfortably above the >80% Jest threshold. Did not touch `searchMemoryDocuments`'s pre-existing
  uncovered tie-break branch (`query.ts` line 219) — that's task-008's code, out of this task's diff.

- **review:** no BDD runner is wired into this repo yet (confirmed absent, matching task-006/008's
  prior finding — `docs/02_requirements/02_bdd/features/**/*.feature` are contracts, not yet
  executable specs, per CLAUDE.md §1). `npx jest` stands in for that check: **251 tests passed, 0
  failed** (was 244 before this task; +7: 3 `findMemoryDocumentById` unit tests + 4
  `resource-latency.test.ts` cases), `npx tsc --noEmit` exit 0.

  Measured latencies on the 1,000-document reference repo (temporarily instrumented with
  `console.log`, then reverted before this commit — not left in the committed test):
  - `wingfoil://dna/show` fetch, 25 runs: **p95 ≈ 4.07 ms**.
  - `wingfoil://memory/{id}` fetch at the worst-case linear-scan position (last document in sorted
    scan order, `docs/04_memory/v0.7/...`), 25 runs: **p95 ≈ 82.1 ms**.
  - Sustained session, 200 fetches (mixed dna/memory, 1 connection, no restart): first-10%-window
    mean ≈ 19.6 ms, last-10%-window mean ≈ 12.5 ms (no growth — the last window was actually faster,
    consistent with JIT warm-up, not degradation), max single fetch ≈ 66.2 ms, 0 errors, connection
    still serving correct data at the end.

  All measurements land one to two orders of magnitude under the 1,000 ms REQ-PERF-04 budget at this
  reference scale, and the sustained-session run shows no degradation trend and no dropped
  connection. No result-count capping or caching was added to hit the target — the linear
  `findMemoryDocumentById` scan alone comfortably clears the bar at 1,000 documents, same conclusion
  task-008 reached for `searchMemoryDocuments`'s comparable full-scan cost profile.
