---
id: "task-008-dna-memory-query-latency"
type: task
title: "Infrastructure: REQ-PERF-02 — DNA/Memory query latency"
status: in-review
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

- **design:** `agent.verify_specs` found no gap. The task's `ref` (REQ-PERF-02) plus the three specs
  named in Implementation Notes — `spec-006-core-domain-api`, `spec-011-storage-layout`,
  `spec-012-context-loader-relevance-filtering` — are all `status: approved` already; no new
  tech-spec was authored. Phase passed straight through, as expected for a task whose `ref` already
  cites approved specs (per the dev-loop plan's own note on this).

- **SCOPE decision (foundation vs. task-021/task-026/future-P1.10 feature work) — record for the
  reviewer:** this task adds the query-path *primitives* only, deliberately NOT wired into
  `src/core`'s `CORE_MODULES` registry and NOT reachable via any CLI/MCP surface yet:
  - `src/memory/query.ts` — `computeMemoryContentRoots` (derives the minimal scan directories from
    `memory.yaml`'s per-type `path` patterns, spec-011, rather than hardcoding `docs/04_memory` or
    walking the whole repo), `listMemoryDocumentPaths`, `loadMemoryDocumentSummary`, and
    `searchMemoryDocuments` (deterministic keyword/frontmatter relevance — metadata match ranks
    above body-only match, per `P1.12-keyword-search.feature`; case-insensitive; optional exact
    `tag` filter; no full-text/semantic index, per spec-012's discipline applied to `memory search`).
  - `src/memory/history.ts` — `getMemoryHistory`, a `git log --follow` walk over one Memory
    document's file, returning structured commit records (sha/author/ISO-8601 date/subject/body)
    oldest-first.
  - `src/core`'s existing `dnaShow` operation (task-006, already wraps `loadDnaYaml`) needed no new
    code — `dna show`'s "bounded read against `dna.yaml`" was already the right shape; this task
    only needed to prove it's fast, which the benchmark does.
  - Deliberately **not** built here (left to task-021-implement-memory-search /
    task-026-implement-dna-show / the not-yet-scheduled P1.10 `memory history` feature task, per
    task-015's note that P1.7/P1.8/P1.10 land in a later release): the `--tag`/`section` CLI
    grammar, console/json/yaml output rendering, the "no documents matched the query" (exit 0) and
    "document not found"/"no DNA key named ..." (exit 1) error contracts, and any `CoreOperation`
    registration in `CORE_MODULES`. Registering these functions as CLI/MCP-reachable operations now
    would have completed those tasks' own acceptance criteria ahead of them; keeping the primitives
    as plain exported functions from `src/memory` (not `src/core`) means task-021/026 still do real,
    non-trivial work — wiring the registry entry, the CLI/MCP grammar, and the exit-code contract —
    on top of an already-fast foundation. This is the smallest defensible choice per the "genuinely
    ambiguous boundary" guidance; if the reviewer/Roberto judge the primitives should instead live
    directly under `src/core` (matching `spec-006`'s "query functions ... part of that shared
    registry" wording more literally), that's a low-risk follow-up move, not a rewrite.

- **red:** wrote failing tests first — `test/storage/frontmatter.test.ts` (new `splitFrontmatter`
  cases), `test/memory/query.test.ts`, `test/memory/history.test.ts`, and the REQ-PERF-02 acceptance
  benchmark itself, `test/core/query-latency.test.ts` (a deterministic 1,000-Memory-document
  fixture — 700 tasks across 7 release directories + 100 each of adr/decision-log/tech-spec,
  index-derived content only, no `Math.random`/`Date.now` per REQ-SYS-07). Confirmed all four
  suites failed to compile (referenced modules did not exist yet) before writing any
  implementation.

- **green:** minimum implementation — `src/memory/query.ts`, `src/memory/history.ts`, plus
  `splitFrontmatter` added to `src/storage/frontmatter.ts` (frontmatter text + body in one parse
  pass, `extractFrontmatter` now delegates to it — no behavior change, verified against its
  existing tests). All new + existing tests passed; `tsc --noEmit` exit 0.

- **refactor:** no structural refactor needed (implementation was already the minimum useful
  shape); added edge-case tests only — non-`.md` files under a content root, a not-yet-created
  content root, a directory-less/placeholder-free path pattern, frontmatter that parses to a
  non-object or is absent, an id-substring match combined with a `tag` filter, a path-based
  tie-break when a document has no `id`, and `memory history`'s not-a-git-repo error path. Raised
  `src/memory/**` branch coverage from 81.81% to 91.81% (project-wide: 90.9% branches / 98.65%
  statements) — comfortably above the >80% Jest threshold. One low-value branch left uncovered by
  design, not oversight: `getMemoryHistory`'s destructuring defaults for a malformed `git log`
  record (would need a commit message containing the internal `\x1f`/`\x1e` separator control
  characters to exercise — not worth manufacturing).

- **review:** no BDD runner is wired into this repo yet (confirmed absent — no `cucumber`/`gherkin`
  tooling in `package.json` or elsewhere); this matches task-006's prior finding
  (`docs/02_requirements/02_bdd/features/**/*.feature` are contracts, not yet executable specs, per
  CLAUDE.md §1's "specification & design phase" status). `npx jest` stands in for that check:
  **244 tests passed, 0 failed**, `npx tsc --noEmit` exit 0. Measured p95 latencies on the
  1,000-document reference repo, over 25 timed runs each (>= 20 required):
  - `dna show` (bounded `dna.yaml` read): **~0.87 ms** p95.
  - `memory search` (keyword `benchmarktoken` over 1,000 documents, 208 matches, both ranking
    tiers exercised): **~91.4 ms** p95.
  - `memory history` (git-log walk, 4-commit target): **~18.1 ms** p95.

  All three land two to three orders of magnitude under the 1,000 ms REQ-PERF-02 budget at this
  reference scale — no tuning of `maxDocs`/`maxBytes`-style bounds was needed to hit the target;
  none were added, since neither the AC nor the BDD scenarios call for result-count capping at the
  primitive level (left to task-021/026 if their own CLI UX wants one).
