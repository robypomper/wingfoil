---
id: "task-017-storage-confinement"
type: task
title: "Infrastructure: REQ-SEC-06 — Storage confinement"
status: in-progress
release: "v0.1"
priority: "Blocker"
tags: ["v0.1", "architecture"]
ref: "REQ-SEC-06"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

Confine every Memory-entry write to the project's own managed storage tree, refusing any attempt to
write outside it. `memory.add`/`memory.submit` resolve a document's target path exclusively through
the type's declared `path` pattern in `memory.yaml` (e.g. `docs/04_memory/{release}/{id}.md` for
`task`) resolved against the WingFoil root — never from a caller-supplied raw filesystem path — so
there is no way for a client (CLI argument, MCP Tool call, or a malformed `id`) to steer a write
outside the managed tree. This prevents state from leaking outside the single, versioned,
git-tracked store that REQ-SYS-01 establishes as project truth. As Morgan (the auditor persona), I
want every Memory write to be provably confined to the managed store so that "the git repo is the
whole truth" can never be silently violated by a write that lands elsewhere on disk.

## Acceptance Criteria

Per REQ-SEC-06's fit criterion: "An attempt to write a Memory entry to a path outside
`.wingfoil/memory/` is refused with `\"Memory entries must reside under .wingfoil/memory/\"`."

Testable breakdown:
- A path-resolution attempt that would escape the confined tree (e.g. via a crafted `id` containing
  `../`, an absolute path, or any other traversal) is refused before any file is written, with a
  message naming the confinement violation.
- Legitimate writes — via each type's own `path` pattern in `memory.yaml` — succeed normally and land
  exactly where that pattern resolves to.
- The confinement check runs identically for CLI-invoked and MCP-Tool-invoked mutations (shared
  `core` validation, REQ-SYS-05) — no divergent enforcement between the two surfaces.
- No partial write occurs on a refused attempt — the operation either fully succeeds inside the
  confined tree or writes nothing.
- See BDD `p1-memory/P1.11-memory-entries.feature`.

## Implementation Notes

- Note on path literalism: this project's *current* dogfooding layout resolves Memory element
  **content** under `docs/self/docs/04_memory/` (per each type's `path` pattern in `memory.yaml`),
  not literally inside `.wingfoil/memory/` — `docs/self/docs/04_memory/design/specs/spec-011-storage-layout.md`
  documents `.wingfoil/memory/templates/` (scaffolds only) as distinct from element content's own
  resolved path. Implement the confinement check against whichever concrete root is authoritative at
  build time (the resolved per-type `path` pattern against the WingFoil root), not a hardcoded
  literal `.wingfoil/memory/` string, so the guarantee holds under both the current dogfooding layout
  and the eventual repo-root `.wingfoil/` layout `spec-011` describes.
- Full layout contract: `docs/self/docs/04_memory/design/specs/spec-011-storage-layout.md` — directory
  layout, top-level config files, and the git-root/init-marker detection algorithms a confinement
  check must build on to resolve "the managed tree" correctly.
- Storage grounding: `docs/self/docs/04_memory/design/adrs/adr-001-git-backed-storage.md` — git is
  the single source of truth with no external state store; confinement keeps that guarantee intact by
  construction.
- Related feature task in this release: `task-022-implement-memory-entries` (backlog `TASK-020`,
  P1.11, "Memory store is ready after initialization").

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
