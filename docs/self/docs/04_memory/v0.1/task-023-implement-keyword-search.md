---
id: "task-023-implement-keyword-search"
type: task
title: "Implement Keyword Memory Search (P1.12)"
status: pending
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

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
