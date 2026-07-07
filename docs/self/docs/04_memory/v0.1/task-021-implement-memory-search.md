---
id: "task-021-implement-memory-search"
type: task
title: "Implement wingfoil memory search (P1.5)"
status: approved
release: "v0.1"
priority: "Critical"
tags: ["v0.1", "memory"]
ref: "P1.5"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

Feature **P1.5 — `wingfoil memory search`**: query Memory by keyword and metadata so relevant
decisions/documents surface without scanning the whole store.

As Alex (US-1-08), I want to query Memory by keyword and metadata so I find relevant decisions
without scanning all documents.

Concretely this task implements the `memory.search` domain operation and CLI verb: accept a free-
text query and optional `--tag`/metadata filters, run them against the keyword-matching algorithm
(implemented in task-023 / P1.12) over all Memory documents, and return matches within the
performance envelope (sub-1-second, per REQ-PERF). It must also handle a zero-result query as a
successful (exit 0), not an error, outcome.

## Acceptance Criteria

See docs/02_requirements/02_bdd/features/p1-memory/P1.5-memory-search.feature. Key scenarios:
- **Find a decision by keyword**: `wingfoil memory search api` returns the document titled
  "API design" among its results, returning in under 1 second.
- **Filter results by metadata tag**: `wingfoil memory search --tag architecture` returns only
  documents carrying the `architecture` tag.
- **Error — query with no matches**: searching for a nonexistent keyword returns zero results and
  exits with code 0 and message "no documents matched the query" (not an error exit).

## Implementation Notes

Cross-references `spec-006-core-domain-api` (the shared `memory.search` function surfaced
identically via CLI and MCP per REQ-SYS-05) and `spec-010-memory-frontmatter-schema` (the tag/
metadata fields the `--tag` filter matches against). Builds directly on the keyword-matching
algorithm from task-023 (implement keyword search, P1.12). Depends on task-001 (Node.js/TypeScript
scaffold), task-002 (validation/ID engine), and task-018/task-022 (git-backed storage and Memory
entries, since search operates over the files those tasks establish).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (architect) — spec verification, no gap; MCP-Resource-for-search design call recorded

Verified scope against the specs cited in this task's Implementation Notes plus the two governing the
CLI/exit-code surface; **no missing/insufficient tech-spec** was found, so no `memory.add(tech-spec)` was
needed:

- **spec-006-core-domain-api §3** (memory table) already pins `memorySearch` verbatim: `mutates: false`,
  CLI `wingfoil memory search`, MCP **Resource `wingfoil://memory/search`** — not a Resource *template*.
  This settles the design gate the orchestrator flagged ("a zero-arg Resource URI can't carry the
  keyword cleanly"): the approved spec already chose the mechanical, zero-argument
  `wingfoil://{module}/{verb}` form (`src/mcp/registrar.ts`'s generic derivation, spec-004 §2.1's
  fallback case) as `memorySearch`'s MCP exposure, not a richer `{query}`-carrying template — so
  registering `memorySearch` through `CORE_MODULES` exactly as `dnaShow`/`paths` are registered is
  spec-conformant, not a workaround.
- **Consequence for a param-less Resource read:** `registerCoreModules`'s Resource `callCore` path calls
  every read op with `{root}` only (no `positional`/`options` — see `src/core/registry.ts`'s
  `ParamsContext` doc comments); reading `wingfoil://memory/search` therefore executes `memorySearchFn`
  with an omitted keyword and no filters. That is treated as a legitimate "browse every Memory document,
  unranked" call — symmetric with `dnaShow`'s "no section → whole DNA" and `paths`' "no category → whole
  node" precedent (`src/core/index.ts`) — never an error. task-011's richer, parameter-carrying
  `wingfoil://memory/{type}` (collection) and `wingfoil://memory/{type}/{id}` (single document) Resources
  (`src/mcp/memory-resource.ts`, registered directly, outside `CORE_MODULES`, per that task's own
  documented spec-006 §4 parity exception) remain the primary MCP-side way to target one type or
  document; `wingfoil://memory/search` is a supplementary whole-store browse. The fully-parameterized
  surface for an actual keyword/tag/status/type query is the CLI (`wingfoil memory search <keyword>
  --tag/--status/--type`), per the orchestrator's own framing ("CLI-primary") — recorded here as the
  design call, not left implicit.
- **spec-010-memory-frontmatter-schema** — `type`/`status`/`tags` are base fields on every document
  (§"Base fields"), so filtering by them needs no type-specific schema knowledge; `type` was not
  previously projected onto `searchMemoryDocuments`'s `MemorySearchMatch` (only `status`/`tags` were), so
  it is added as one more `asString(frontmatter.type)` extraction alongside the existing `title`/`id`/
  `status` ones — additive, not a change to the scan/ranking algorithm itself (task-008/023's own scope,
  left otherwise untouched).
- **spec-005-cli-command-contract §1** — a read-only command exits only `0`/`1` post-parse; the P1.5 BDD
  scenario titled "Error - query with no matches" actually asserts exit `0`, so it is modelled as
  `coreOk` with an empty `matches` array plus the exact `message` field, never `coreErr`.
- **spec-008-cli-grammar** — the keyword rides task-026's generic bare `ParamsContext.positional` seam
  (like `dna show [section]`/`paths [category]`); `--tag`/`--status`/`--type` ride task-020's value-option
  seam (`CoreOperation.options`), declared optional (no `required: true`) since the AC/BDD only mandate
  the bare keyword form and the `--tag` filter — `--status`/`--type` are additive, consistent extensions
  of the same seam, not scope invented beyond what `X_cli-cmds.md`'s Pillar-1 table already lists for
  this command.
- **Empty-query vs. omitted-keyword, reconciled:** task-023's `validateSearchQuery` (P1.12 BDD "Error -
  empty query string") fires only when the CLI/MCP caller supplied an explicit, whitespace-only/empty
  keyword string; an *omitted* keyword (`wingfoil memory search --tag architecture`, P1.5 BDD Scenario
  "Filter results by metadata tag") is a different, legitimate case — a tag-only browse — and is never
  passed to the guard. This distinction is the one piece of behavior this task's `memorySearchFn` adds on
  top of the wrapped primitives; everything else is direct reuse.

No spec was invented or edited; traceability: P1.5, P1.12, REQ-PERF-02, REQ-SYS-05, REQ-SYS-07,
spec-004-mcp-surface-contract, spec-005-cli-command-contract, spec-006-core-domain-api,
spec-008-cli-grammar, spec-010-memory-frontmatter-schema.

### red

Added `test/core/memory-search.test.ts` (the real registered `memory.memorySearch` op over throwaway
temp repos — AC(a)/(b)/(c), the empty-query-vs-omitted-keyword distinction, `--type`/`--status`
filters, determinism, missing-`memory.yaml` -> NOT_FOUND) + `test/memory/query.test.ts` characterization
tests for the new `type` field on `MemorySearchMatch` + a `memory search` describe block in
`test/cli/program.integration.test.ts` (real compiled-CLI spawn, mirroring the `dna set` e2e block).
Updated `production-registry`/`parity` to expect `memory.memorySearch` alongside `memory.memoryAdd`, and
re-pointed `test/core/query-latency.test.ts`'s REQ-PERF-02 `memory search` benchmark from the raw
`searchMemoryDocuments` primitive onto the registered op (task-008's own deferred note). Confirmed every
new/updated assertion failing for the right reason (operation not yet registered / field not yet
projected) before writing any production code.

### green

`src/memory/query.ts`: added `type` to `MemorySearchMatch`/`searchMemoryDocuments` (additive, no
scan/ranking change). `src/core/index.ts`: `memorySearchFn` + `memory.memorySearch` registration
(`mutates: false`, optional `--tag`/`--status`/`--type` options, keyword on the generic `positional`
seam). No deviation from the design-gate plan above.

**One real bug found and fixed, outside this task's own new code:**
`test/cli/fixtures/cli-harness.cjs`'s `buildParams` predated task-020's `options` seam and never spread
`ctx.options` — every CLI-integration-harness invocation silently passed `options: undefined` regardless
of what `--type`/`--tag`/etc. was typed on the command line. Nothing caught this because no CLI
integration test exercised a value-option before this task (`memory add` has no e2e test; only its
CoreFn-level `test/core/memory-add.test.ts` exists). Found because the new `memory search --tag
architecture` e2e assertion kept returning BOTH documents instead of the tagged one; fixed by adding
`options: ctx.options` to the harness's `buildParams`, back in lockstep with the real `src/cli.ts`
production wiring. Recorded as its own `fix(cli)` commit, separate from this task's `memorySearch`
feature commit, since it is a pre-existing test-fixture gap, not new-task logic.

### review

`npx tsc --noEmit` clean. `npx jest` 536/536 green (18 net-new `it()` cases — 12 in the new
`test/core/memory-search.test.ts`, 2 added to `test/memory/query.test.ts`, 4 added to
`test/cli/program.integration.test.ts`'s `memory search` block — plus updated expectations in
`test/core/production-registry.test.ts`, `test/core/parity.test.ts`, `test/core/query-latency.test.ts`
(re-pointed, not net-new), `test/mcp/read-only-agent-channel.test.ts` (comment only), and
`test/cli/fixtures/cli-harness.cjs` (harness fix, not a test)). New-code coverage: `src/memory/query.ts` 100%
stmts/100% funcs/100% lines; `src/core/index.ts` 97.27% stmts (uncovered lines are pre-existing
generic-rethrow branches in `loadOrError`/`memoryAddFn`, not this task's new code). REQ-SYS-05 parity
confirmed: `wingfoil://memory/search` now among the MCP Resources; `dna.set` + `memory.add` remain the
ONLY two Tools (`memorySearch` is `mutates: false`, so it never appears as a Tool). `git ls-tree HEAD --
node_modules` empty throughout.
