---
id: "task-021-implement-memory-search"
type: task
title: "Implement wingfoil memory search (P1.5)"
status: in-progress
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
