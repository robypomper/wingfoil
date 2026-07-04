---
id: "task-003-git-backed-sot"
type: task
title: "Infrastructure: REQ-SYS-01 — Git-backed single source of truth"
status: approved
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

- **start.** Branch `task/task-003-git-backed-sot` + dedicated worktree created from `main` (forced
  `task/`-prefix + worktree convention, per dev-loop plan §2 / dl-014 G1–G2). Task moved
  `backlog → in-progress`. `bug:` is empty, so `bug.sync_state` was a no-op.

- **design (architect safety net).** No new tech-spec authored — design passed straight through, as
  the plan expected. `spec-011-storage-layout` (`approved`) is the authoritative directory layout
  and root-detection/init-marker algorithm; `spec-001-memory-yaml-schema` (`approved`) is the
  authoritative per-type `path`/`id_pattern` resolution contract. Both fully cover this task's scope
  (root/init detection, per-type path resolution, plain document I/O, no side-channel state) — no
  gap found.

- **Module placement deviation (src/storage, not src/core).** This task's Description (line 28-29)
  and its own title say "the foundation the `core` module's storage layer (`src/core`, per
  `dna.yaml` modules) is built on" — but `dna.yaml`'s actual `modules:` list has a dedicated
  `storage` module whose `description` reads *"Git-backed file storage (YAML + Markdown); single
  source of truth (REQ-SYS-01)"* — i.e. this task's own `ref`, verbatim, at `path: src/storage`. A
  `src/storage/index.ts` scaffold stub already existed for exactly this purpose. Per CLAUDE.md §10.1
  ("Specs win") this task's own prose is treated as the stale reference (same category as the
  spec-009 §2 stale-listing note already recorded against task-002), and `dna.yaml` — the
  authoritative module map — is followed instead: all source lands under `src/storage/`, not
  `src/core/`. (task-002's Execution Notes made the *opposite* placement call for `src/validation`,
  but for the opposite reason: `dna.yaml` has no `validation` module entry at all, so `core` was the
  best fit *by elimination*. Here `dna.yaml` has an exact-match `storage` module, so that one is
  used.) Per the dev-loop orchestrator's instructions, commit *subjects* still use the fixed `(core)`
  scope regardless of this placement (mirrors task-002's own commit-scope choice for a non-`core`
  source location).

- **red.** Wrote 6 failing suites under `test/storage/` (30 tests) plus a shared, non-`.test.ts`
  fixture helper (`test/storage/helpers/git-fixture.ts`) that drives the real `git` binary (`init`,
  `config`, `add`, `commit`, `clone`) against throwaway temp directories — needed because
  REQ-SYS-01's fit criterion is literally stated in terms of `git clone`, so the acceptance test
  exercises a real clone rather than a mock: `git-root` (walk-up detection + at-root enforcement),
  `init-state` (absent/incomplete/initialized), `memory-path` (per-type `path` pattern rendering,
  values copied verbatim from `docs/self/.wingfoil/memory.yaml` per the project's established
  convention), `frontmatter` (raw YAML block extraction), `document` (plain read/write, no
  side-channel state), and `snapshot` (the direct REQ-SYS-01 fit-criterion test: seed a fixture repo,
  commit, `git clone` it for real, and assert the two snapshots are byte-identical; plus "no file
  outside the tracked tree" and "cache-free / stable recompute, including after `jest.resetModules()`"
  checks). All 6 suites failed to resolve their not-yet-created `src/storage/*` modules — genuine
  red. (One authoring slip caught at this stage: a `**/` sequence inside a JSDoc block comment in
  `snapshot.test.ts` prematurely closed the comment, TS1109/TS1160 — fixed before green, noted in
  the green commit since it's a comment-only fix, not a test-behavior change.)

- **green.** Implemented `src/storage/{errors,git-root,init-state,memory-path,frontmatter,document,
  snapshot}.ts` + updated the `index.ts` barrel:
  - `git-root.ts` / `init-state.ts` implement spec-011's two pseudocode algorithms essentially
    verbatim (same error codes `E_NO_GIT_ROOT`/`E_NOT_AT_GIT_ROOT`, same three-state
    absent/incomplete/initialized result).
  - `memory-path.ts` renders any type's `path` pattern (spec-001 `MemoryTypeEntry.path`) against
    caller-supplied placeholder values, reporting *every* missing placeholder in one
    `E_MISSING_PATH_VALUE` error, not just the first. It does not generate `{id}` itself — the
    already-built `generateId` (task-002, `src/validation/id.ts`) remains the sole ID source; this
    module only substitutes already-known values, `{id}` included, into the path template.
  - `frontmatter.ts` extracts the raw YAML frontmatter block as text (not parsed) — parsing against a
    type's schema stays validation's job (spec-009/task-002), keeping this module schema-agnostic.
  - `document.ts` is a thin `fs` wrapper (`mkdirSync` + `readFileSync`/`writeFileSync`) — deliberately
    minimal, no in-memory cache, no auxiliary files.
  - `snapshot.ts` (`computeStateSnapshot`/`serializeSnapshot`) is the piece that directly answers the
    task's Acceptance Criteria: it walks `.wingfoil/**` (in full — DNA/Directives/Workflow config)
    and every `docs/04_memory/**/*.md` (frontmatter only — Memory state lives in frontmatter,
    CLAUDE.md §5), always re-sorting explicitly (REQ-SYS-07: no unordered iteration) since
    `readdirSync` order isn't guaranteed stable, and holds no cache between calls.
  - `npx tsc --noEmit` and `npx eslint src/storage test/storage` both clean; full `npx jest` green
    (73 tests, 11 suites — the pre-existing validation/module-layout suites plus the 6 new ones).

- **refactor.** Two small, behavior-preserving cleanups with tests kept green throughout: (1)
  `document.ts`'s `writeDocument` doc comment reformatted to the project's standard `/** ... */`
  block shape (was a stray inline continuation); (2) `snapshot.ts`'s `listFilesSorted` switched from
  a `try/statSync/catch` existence check to `existsSync(dir) || !statSync(dir).isDirectory()`,
  matching `init-state.ts`'s established style, and `git-root.ts`'s per-ancestor `.git` check
  switched from `resolve(dir, '.git')` to `join(dir, '.git')` (redundant re-resolution against an
  already-absolute `dir`, inconsistent with the rest of the module's `join`-based style). Coverage
  over `src/storage/**` (via `collectCoverageFrom: src/**/*.ts` minus `index.ts`, project default):
  **98.94% stmts, 85.29% branch, 100% funcs, 100% lines** — comfortably over the 80% threshold;
  whole-project coverage (`src/storage` + `src/validation`) is 98.7% stmts / 89.16% branch. Remaining
  uncovered lines are trivial defensive fallbacks (`frontmatter.ts`'s `match[1] ?? ''` — the capture
  group is never actually undefined on a match; `snapshot.ts`'s directory-doesn't-exist branch, not
  hit by the fixture-based tests since both `.wingfoil/` and `docs/04_memory/` always exist in every
  fixture repo used).

- **review (mechanical part).** No dedicated storage `.feature` file targets this task directly —
  `p1-memory/P1.1-git-backed-storage.feature` exists, but its scenarios ("Initialize the WingFoil
  storage structure", "target directory is not a git repository") are the `wingfoil init` CLI
  surface, explicitly scoped to `task-018-implement-git-backed-storage` per this task's own
  Implementation Notes ("Related feature work... this infra task unblocks: TASK-016... memory
  task-018..."), not to task-003. There is also no BDD test runner wired yet (same situation task-002
  recorded: `.feature` files are contracts, not yet executable). This task instead targets the SARD
  fit criterion directly (`REQ-SYS-01`, `01_architecture.md`) via `test/storage/snapshot.test.ts`'s
  real-`git-clone` byte-identical check — the acceptance test *is* the fit criterion, executed
  literally rather than paraphrased. Commit scope: code commits use the `(core)` scope per the
  orchestrator's fixed convention for this task, even though the source lives under `src/storage/`
  (see the module-placement note above). Task moved `in-progress → in-review`; approval gate + merge
  are the approver's, not performed here.
