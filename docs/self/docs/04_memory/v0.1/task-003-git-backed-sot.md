---
id: "task-003-git-backed-sot"
type: task
title: "Infrastructure: REQ-SYS-01 — Git-backed single source of truth"
status: backlog
release: "v0.1"
priority: "Blocker"
tags: ["v0.1", "architecture"]
ref: "REQ-SYS-01"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

REQ-SYS-01 requires that **all** project state — Memory, DNA, Directives, Workflow — is persisted
purely as files under `.wingfoil/` (config) and `docs/04_memory/` (Memory content) inside the
project's own git repository. No external database, SaaS backend, or local cache may hold
authoritative state; git itself is the only store, and its commit history is the audit trail (P1.2,
P1.10).

Concretely, this task covers the storage-layer contract that every other Memory operation depends on:
resolving the WingFoil project root and detecting whether it is already initialized (no marker file
other than the presence of `.wingfoil/` itself), reading/writing Memory documents at the path patterns
declared per-type in `memory.yaml` (e.g. `docs/04_memory/{release}/{id}.md` for `task`), and ensuring
every mutation (`memory.add`/`submit`/`approve`/`reject`/`deprecate`) round-trips through a plain git
commit with no side-channel state. This is the foundation the `core` module's storage layer
(`src/core`, per `dna.yaml` modules) is built on before any pillar-specific logic runs.

## Acceptance Criteria

Per the SARD fit criterion (`docs/02_requirements/03_sard/01_architecture.md`, REQ-SYS-01):

> A fresh `git clone` of the repository reconstructs 100% of Memory/DNA/Directives/Workflow state with
> no external data source; a state dump before and after clone is byte-identical.

Testable form:
- Cloning the repository to a fresh directory and reading `.wingfoil/*.yaml` + every `docs/04_memory/**/*.md`
  frontmatter produces a state snapshot byte-identical to a snapshot taken from the original working copy
  at the same commit.
- No file or directory outside the git-tracked tree (no daemon, no external DB connection string, no
  `.wingfoil/state/` index per REQ-SYS-03) is required to reconstruct state.
- Deleting any in-process cache and recomputing state from disk yields the same result (ties to
  REQ-STATE-02).

## Implementation Notes

- `spec-011-storage-layout` (`docs/self/docs/04_memory/design/specs/spec-011-storage-layout.md`) is the
  authoritative directory layout and root-detection/init-marker algorithm this task must implement
  against — it documents the current `docs/self/.wingfoil/` ground truth and the rule for finding the
  project root once the directory moves to the repo root.
- `spec-001-memory-yaml-schema` defines the per-type `path`/`id_pattern` resolution that the storage
  layer must honor when reading/writing Memory documents (no hardcoded paths).
- Related feature work in this release that this infra task unblocks (`related_stories` in
  `docs/03_backlog/04_backlog/by-release/v0.1.json`, backlog `TASK-001`): `TASK-016` "Implement
  Git-Backed Storage" (memory `task-018-implement-git-backed-storage.md`) and `TASK-020` "Implement
  Memory Entries (git-backed)" (memory `task-022-implement-memory-entries.md`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
