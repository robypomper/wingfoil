---
id: "task-023-implement-keyword-search"
type: task
title: "Implement Keyword Memory Search (P1.12)"
status: in-review
release: "v0.1"
priority: "Critical"
tags: ["v0.1", "memory"]
ref: "P1.12"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

Feature **P1.12 — Keyword Memory Search**: the underlying matching algorithm that finds relevant
documents via keyword and metadata matching, so content is retrievable without scanning
everything.

As Alex (US-1-09), I want to find relevant documents via keyword and metadata matching so I
retrieve content without scanning everything.

Concretely this task implements the case-insensitive keyword-matching algorithm itself: scan each
Memory document's body text and frontmatter metadata (tags, title) for the query term, and rank
results so that metadata matches (e.g. a tag match) are surfaced before body-only matches. This is
the algorithm `wingfoil memory search` (task-021, P1.5) calls; task-021 owns the CLI/MCP surface
and query parsing (including `--tag` filtering and the empty-query rejection), while this task
owns the match/rank logic proper.

## Acceptance Criteria

See docs/02_requirements/02_bdd/features/p1-memory/P1.12-keyword-search.feature. Key scenarios:
- **Keyword match against document body and metadata**: searching "caching" against a document
  "A" (body mentions "caching") and "B" (tagged "caching") returns both, with metadata matches
  (B) ranked before body-only matches (A).
- **Case-insensitive matching**: searching "CACHING" also returns both "A" and "B".
- **Error — empty query string**: searching with an empty query performs no search and returns
  exit code 2 with message "empty search query".

## Implementation Notes

Cross-references `spec-006-core-domain-api` (where the matching function lives in the shared
`src/core` module so both CLI and MCP get identical ranking) and `spec-010-memory-frontmatter-schema`
(the tag/title metadata fields eligible for metadata-match ranking). Feeds directly into task-021
(`wingfoil memory search`, P1.5), which is the CLI/MCP-facing consumer of this algorithm. Depends
on task-001 (Node.js/TypeScript scaffold), task-002 (validation/ID engine), and task-022 (Memory
entries), since this algorithm scans the files that task establishes.

## Execution Notes

**design**: Verified against `spec-006-core-domain-api` and `spec-010-memory-frontmatter-schema` —
no gap. `spec-006` places `src/memory` (this task's `src/memory/query.ts`) strictly *underneath*
`src/core`, never imported directly by `src/cli`/`src/mcp` — consistent with this task staying
library-level and *not* wiring `memorySearch` into `src/core`'s `CORE_MODULES` registry (that
remains task-021's scope, per `query.ts`'s own module doc). `spec-010`'s base frontmatter fields
(`title`, `id`, `tags`) are exactly the metadata fields task-008's `searchMemoryDocuments` already
uses for the metadata-match/rank check — no new field needed. No tech-spec change required.

**red/green**: `searchMemoryDocuments` (task-008-dna-memory-query-latency, REQ-PERF-02) already
implemented the metadata-before-body ranking and case-insensitive substring matching this task's
AC(a)/AC(b) require — verified with new, explicit P1.12-scenario tests
(`test/memory/query.test.ts`, "P1.12 acceptance criteria" describe block) that pass against the
unmodified implementation, i.e. these are characterization tests, not new coverage of new behavior.
Honest TDD note: no red step for AC(a)/(b) — they were already green.

AC(c) (empty query -> exit 2, "empty search query") was a genuine gap: `searchMemoryDocuments('', …)`
previously treated an empty needle as "match everything" (used intentionally by task-008's own
tag-only-browse test, `searchMemoryDocuments(root, yaml, '', { tag })`), never rejecting it. Added a
new, separate exported guard `validateSearchQuery(query: string): void` in `src/memory/query.ts`
(also exported from `src/memory/index.ts`) that throws `ValidationError.semantic([...])` — mirroring
`resolveTransitionTarget`'s pattern in `./state-machine.ts` — with message `"empty search query"` and
`exitCode` `EXIT_INTEGRITY` (2) for an empty or whitespace-only query. Deliberately did **not**
change `searchMemoryDocuments`'s own signature/behavior, to avoid breaking task-008's legitimate
tag-only-browse characterization test (`test/memory/query.test.ts` line ~193, `searchMemoryDocuments(repo, MEMORY_YAML, '', { tag: 'architecture' })`).
`validateSearchQuery` is a thin, separate validation step task-021's CLI/MCP surface is expected to
call on the raw user-supplied query string before invoking `searchMemoryDocuments`, per this task's
scope boundary ("task-023 owns ... the empty-query VALIDATION" at the algorithm level; task-021 owns
surfacing it as CLI exit code 2).

No refactor phase — the added guard is small and self-contained; nothing else needed cleanup.

**review**: `npx tsc --noEmit` exits 0. Full `npx jest` suite: 44 suites / 407 tests, all green.
Coverage for `src/memory/query.ts` across the full suite: 100% statements/lines/functions, 93.24%
branch — well above the >80% bar; the new `validateSearchQuery` code is fully exercised by the new
P1.12 tests. No regression in any other suite (task-008's own `test/core/query-latency.test.ts` and
the pre-existing `test/memory/query.test.ts` cases unchanged and still green).

**What the reviewer should scrutinize**: (1) whether keeping `searchMemoryDocuments` itself
permissive on empty query (rather than making it throw directly) is the right scope split with
task-021 — the alternative was baking the guard into `searchMemoryDocuments` and giving the
tag-only-browse case its own explicit "list" entry point instead, which would have been a larger,
task-021-adjacent redesign; (2) that `validateSearchQuery` is presently uncalled by any production
code path (by design — task-021 is the wiring task) — a reviewer should confirm this is an
acceptable, temporarily-dead-but-exported library primitive rather than a wiring gap that belongs to
this task.
