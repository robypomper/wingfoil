---
id: "task-017-storage-confinement"
type: task
title: "Infrastructure: REQ-SEC-06 — Storage confinement"
status: in-review
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

Per REQ-SEC-06's fit criterion (**corrected**): "An attempt to write a Memory entry to a path outside
**the project root** is refused with `\"Memory entries must reside within the project root\"`."
*(The original AC/REQ-SEC-06 text said `.wingfoil/memory/`; corrected by the approver — Memory files
must be confined to the WingFoil **project root**, the single git-tracked store per REQ-SYS-01, not to a
`.wingfoil/memory/` subtree. The SARD REQ-SEC-06 fit-criterion string needs the same fix — flagged in
Execution Notes as a spec-owner follow-up.)*

Testable breakdown:
- A path-resolution attempt that would escape the **project root** (e.g. via a crafted `id` containing
  `../`, or any other traversal that normalizes outside the root) is refused before any file is written,
  with the confinement message.
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

Worked on branch `task/task-017-storage-confinement` (dedicated worktree). Plan:
`docs/05_plans/X_task-017-plan.md`. task-015 (REQ-SEC-02, `src/memory`) merged to `main` mid-session
(disjoint module) — my branch includes it; rebase clean.

- **design (AC correction, by Roberto):** the confinement boundary is the **project root**, NOT
  `.wingfoil/memory/` — the AC (and REQ-SEC-06's SARD fit criterion) were wrong. Corrected the task's AC
  above; the SARD REQ-SEC-06 fit-criterion string carries the same `.wingfoil/memory/` error and needs
  the same fix — **spec-owner follow-up** (not edited unilaterally here). Real gap found: `resolveMemoryPath`
  is `join(root, render(...))`, and `join`/`resolve` **normalize `../`**, so a crafted `id`/value could
  steer a write outside the root today.
- **green:** `src/storage/memory-path.ts` — added `resolveConfinedMemoryPath(root, pattern, values)`:
  renders + resolves, then refuses (throwing `StorageError(E_PATH_ESCAPES_ROOT, 'Memory entries must
  reside within the project root')`) when `path.relative(root, target)` is empty / `..` / `../…` /
  absolute — i.e. the target is the root itself or escapes it. Pure resolver: it refuses **before**
  returning a path, so a caller never writes on a refused attempt (the "no partial write" AC bullet holds
  by construction). Added `E_PATH_ESCAPES_ROOT` to `src/storage/errors.ts`.
- **message note:** `StorageError` prefixes its code (`E_PATH_ESCAPES_ROOT: <msg>`, like every storage
  error — cf. `E_NO_GIT_ROOT` in bug-002), so `error.message` contains, but is not byte-equal to, the
  exact AC string. The exact user-facing `Memory entries must reside within the project root` is produced
  by the (deferred) `memory.add`/`submit` mapping of this `StorageError` to a `CoreError` — same pattern
  as `wrapReadOnly`. Test asserts `.code` exact + `.message` contains the exact string.
- **checks:** full suite green (356 tests), `memory-path.ts` + `errors.ts` 100% covered, overall 98.9%
  (> 80%), `tsc -p tsconfig.build.json` clean, eslint clean. Touched only `src/storage` + its test.

**Deferred (out of scope, traced):**
- Wiring `resolveConfinedMemoryPath` into `memory.add`/`memory.submit` (map the `StorageError` to a
  `CoreError` whose message is exactly the confinement string, so CLI + MCP surface it identically,
  REQ-SYS-05) → the Memory-entries command tasks (task-022 / task-018+). None exist yet (`CORE_MODULES`
  read-only), so the end-to-end "refused, nothing written" assertion belongs there; the resolver's own
  confinement contract is proven here.
- SARD reconciliation: fix REQ-SEC-06's `.wingfoil/memory/` fit-criterion text to "the project root".
