---
id: "task-022-implement-memory-entries"
type: task
title: "Implement Memory Entries (git-backed) (P1.11)"
status: backlog
release: "v0.1"
priority: "Critical"
tags: ["v0.1", "memory"]
ref: "P1.11"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

Feature **P1.11 — Memory Entries (git-backed)**: store documents, decisions, and artifacts in
`.wingfoil/memory/` with per-file versioning, as the storage layer the whole Memory pillar sits on.

As Alex (US-0A-03), I want a `.wingfoil/memory/` structure ready to contain versioned documents and
artifacts so I can record decisions from day one.

Concretely this task implements the Memory-entry storage contract: ensure `.wingfoil/memory/`
exists and is tracked by git right after init, guarantee that each individual Memory document's
modifications are captured as their own distinct git commits (so prior versions remain retrievable
from git history per file, not just per repo), and enforce storage confinement — any attempt to
write a Memory entry outside the configured store (e.g. `/tmp/decision-x.md`) is refused.

## Acceptance Criteria

See docs/02_requirements/02_bdd/features/p1-memory/P1.11-memory-entries.feature. Key scenarios:
- **Memory store is ready after initialization**: after project init, a `.wingfoil/memory/`
  directory exists and is tracked by git.
- **Each Memory entry is individually versioned**: modifying and saving a document like
  "decision-1" produces a distinct git commit for that file, with prior versions retrievable from
  git history.
- **Error — writing a Memory entry to a path outside the configured store**: a write to
  `/tmp/decision-x.md` is refused with message "Memory entries must reside under
  .wingfoil/memory/".

## Implementation Notes

Cross-references `spec-011-storage-layout` (the `.wingfoil/` directory shape and where `memory/`
sits within it) and `spec-010-memory-frontmatter-schema` (the per-entry frontmatter contract that
makes each file's version/state legible from git alone, per REQ-SYS-03 — no separate state index).
This is the storage foundation that task-020 (`memory.add`), task-021 (`memory.search`), and
task-023 (keyword search) all build on. Depends on task-001 (Node.js/TypeScript scaffold),
task-002 (validation/ID engine), and task-018/task-019 (git-backed storage + versioning &
audit trail), which this task specializes for the Memory pillar specifically.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
