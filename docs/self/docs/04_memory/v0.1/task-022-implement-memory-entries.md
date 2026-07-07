---
id: "task-022-implement-memory-entries"
type: task
title: "Implement Memory Entries (git-backed) (P1.11)"
status: in-review
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
- **Error — writing a Memory entry to a path outside the configured store** (**corrected** — see
  Execution Notes): a write to `/tmp/decision-x.md` is refused with message "Memory entries must
  reside within the project root". *(The BDD literal and this task's original AC text both said
  "Memory entries must reside under .wingfoil/memory/"; that is stale. task-017-storage-confinement
  (REQ-SEC-06, merged) already established — with the approver's correction — that the confinement
  boundary is the **project root**, not a `.wingfoil/memory/` subtree, and implemented
  `resolveConfinedMemoryPath` with the exact message above. This task reuses that guard rather than
  inventing a second confinement rule; the BDD `.feature` file and REQ-SEC-06's SARD fit-criterion
  string still carry the stale wording — a spec-owner follow-up already flagged by task-017,
  reaffirmed here.)*

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

- **design:** verified against `spec-011-storage-layout` (approved) and
  `spec-010-memory-frontmatter-schema` (approved) — no tech-spec gap found; both already cover the
  layout/frontmatter this task builds on. **AC(c) message reconciliation** (see corrected bullet
  above): the exact confinement-refusal string is `"Memory entries must reside within the project
  root"`, per task-017's `resolveConfinedMemoryPath` (`src/storage/memory-path.ts`), not the stale
  `.wingfoil/memory/` wording still carried by the BDD `.feature` file and REQ-SEC-06's SARD
  fit-criterion. This task reuses task-017's guard as-is — no second confinement rule invented — and
  does not edit the BDD/SARD text itself (spec-owner follow-up, already flagged by task-017).
  **AC(a) status:** already satisfied by task-018's `initStorage`/`scaffoldFiles`
  (`src/storage/layout.ts`) — `.wingfoil/memory/.gitkeep` is scaffolded and committed at init, proven
  by `test/storage/git-backed-storage.test.ts`. This task adds a thin P1.11-scoped assertion over the
  same contract rather than duplicating that coverage.
- **scope:** delivers `writeMemoryEntry` — a reusable **library primitive** (throws, not
  `CoreResult`-wrapped) in `src/memory` composing `resolveConfinedMemoryPath` + `writeDocument` +
  `commitPaths`. It does not build the `wingfoil memory add` CLI command or register a `CORE_MODULES`
  operation — that CLI/CoreResult-mapping wiring is task-020's scope, per this task's own
  Implementation Notes ("this is the storage foundation that task-020 ... build[s] on").
- **red:** `test/memory/entry.test.ts` — one describe per P1.11 BDD scenario against real temp git
  repos (never mocked git, never this repo's own `.wingfoil/`). Scenario 1 (`.wingfoil/memory/`
  tracked-after-init) passed immediately — already satisfied by task-018's `initStorage`; scenarios 2
  (distinct per-file commit + prior-version retrievable) and 3 (out-of-root write refused with the
  exact confinement message) failed on the missing `writeMemoryEntry` — honest red.
- **green:** `src/memory/entry.ts` — `writeMemoryEntry(root, pattern, values, content, message,
  options?)` returns `{ path, sha }`, composing `resolveConfinedMemoryPath` (refuse-before-write) +
  `writeDocument` + `commitPaths`. No new confinement logic, no re-implemented commit primitive.
  All 3 scenarios pass; `entry.ts` 100% covered.
- **refactor:** none — the primitive is a 3-call composition; nothing to extract.
- **review:** full `npx tsc --noEmit` exit 0; full `npx jest` 401/401 green (44 suites);
  `src/memory/entry.ts` 100% stmts/branch/funcs/lines. `git ls-tree HEAD -- node_modules` empty.
  Deferred to task-020 (traced): the `wingfoil memory add`/`submit` CLI command + the
  `StorageError` → `CoreError` mapping that surfaces the exact confinement string to CLI/MCP
  identically (REQ-SYS-05), plus the `requireGitIdentity` pre-flight at that call site.
