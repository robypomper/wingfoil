---
id: "task-008-dna-memory-query-latency"
type: task
title: "Infrastructure: REQ-PERF-02 — DNA/Memory query latency"
status: pending
release: "v0.1"
priority: "Blocker"
tags: ["v0.1", "architecture"]
ref: "REQ-PERF-02"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

REQ-PERF-02 bounds the latency of the three read-query commands that developers hit constantly during
a session: `wingfoil memory search`, `wingfoil dna show`, and `wingfoil memory history` — the Vision
metric is "DNA/Memory queries < 1 second". This task covers the query-path implementation in `src/core`
(the shared function surface behind CLI and MCP, `spec-006`) that keeps these three operations fast at
the reference scale of 1,000 Memory documents: keyword/frontmatter-based search (not a full-text or
semantic index) over the git-tracked `docs/04_memory/**` tree, a bounded `dna show` read against
`dna.yaml`, and a `memory history` walk of the element's git log — all without any external index or
service (REQ-SYS-01), which means the query path must be efficient directly against the filesystem/git
plumbing rather than relying on a cache that could itself violate the single-source-of-truth
constraint.

## Acceptance Criteria

Per the SARD fit criterion (`docs/02_requirements/03_sard/02_performance-nfr.md`, REQ-PERF-02), with
the measurement conditions the same document defines:

> `wingfoil memory search`, `wingfoil dna show`, and `wingfoil memory history` each return in < 1,000 ms
> (p95) on the reference repository.
>
> Measurement conditions: latency targets are evaluated as **p95 over ≥ 20 runs** on a reference
> repository of **1,000 Memory documents**.

Testable form:
- On a fixture/reference repo containing 1,000 Memory documents, each of the three commands completes
  in under 1,000 ms at the p95 percentile across at least 20 timed runs.

## Implementation Notes

- `spec-006-core-domain-api` defines the `src/core` function surface these three commands call into —
  the query functions must be implemented as part of that shared registry, not duplicated per CLI/MCP
  surface.
- `spec-012-context-loader-relevance-filtering` documents the keyword/link/frontmatter-based relevance
  approach (deterministic, no semantic search — deferred to v1.1) that keeps `memory search` bounded and
  fast at this scale; the same filtering discipline applies to keeping query cost roughly linear rather
  than requiring a full document scan per call.
- `spec-011-storage-layout` documents the on-disk layout these queries scan; path-pattern predictability
  (per-type `path` in `memory.yaml`, `spec-001`) is what keeps `memory search`/`history` from needing a
  full-repo walk for every query.
- Related feature work in this release that this infra task unblocks (`related_stories` in
  `docs/03_backlog/04_backlog/by-release/v0.1.json`, backlog `TASK-006`): `TASK-019` "Implement wingfoil
  memory search" (memory `task-021-implement-memory-search.md`) and `TASK-024` "Implement wingfoil dna
  show" (memory `task-026-implement-dna-show.md`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
