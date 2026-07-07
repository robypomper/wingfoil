# Plan — task-017-storage-confinement (REQ-SEC-06)

> Interim dev-loop plan (CLAUDE.md §6 / golden rule #7). Branch `task/task-017-storage-confinement`,
> worktree `.claude/worktrees/task-017-confinement`. Role: developer (code-quality, testing, determinism).

## Design-gate finding (scope + AC correction)

**AC correction (by Roberto, approver):** the confinement boundary is the **project root**, not
`.wingfoil/memory/`. task-017's AC lines 29-30 (and the `.wingfoil/memory/` refusal string) are wrong —
Memory entries must reside **within the project root**. Corrected in the task's AC as part of this work.
(REQ-SEC-06's SARD fit criterion carries the same `.wingfoil/memory/` error — flagged as a follow-up
spec reconciliation in Execution Notes; not edited unilaterally here.)

**Real gap this closes:** `src/storage/memory-path.ts` `resolveMemoryPath(root, pattern, values)` is
`join(root, renderMemoryPath(...))`, and `join`/`resolve` **normalize `../`** — so a crafted `id` (or
other value) containing `../` steers the write **outside the project root** today. That is the REQ-SEC-06
hole.

**Implementable now / deferred:** the confined-resolve function + its unit test are fully buildable and
testable standalone (pure path logic — no filesystem write, no mutating op needed). Only *wiring* it into
`memory.add`/`memory.submit` is deferred — those operations do not exist yet (`CORE_MODULES` read-only;
mutating ops are task-018+/task-022). Same "foundation (real code) + defer wiring" shape as task-014.

## Deliverable

- **`src/storage/errors.ts`** — add `E_PATH_ESCAPES_ROOT`.
- **`src/storage/memory-path.ts`** — add `resolveConfinedMemoryPath(root, pattern, values): string`:
  renders + resolves the path, then verifies the absolute target is **strictly under the resolved
  project root** (`path.relative(root, target)` is non-empty, not `..`/`../…`, not absolute). On a
  violation it throws `StorageError(E_PATH_ESCAPES_ROOT, 'Memory entries must reside within the project
  root')` **before returning any path** (no write happens — it is a pure resolver; the caller writes
  only the returned, confirmed-confined path). Lives in `src/storage` (the path authority); a future
  `memory.add`/`submit` in `src/core` maps the `StorageError` to a `CoreResult.error` so CLI + MCP share
  one enforcement (REQ-SYS-05), exactly as `wrapReadOnly` already maps StorageErrors today.

## Tests (test-first)

Extend `test/storage/memory-path.test.ts` with a `resolveConfinedMemoryPath` suite:
- a legitimate `task` id resolves to an absolute path under the root;
- a crafted `id` with `../…` traversal (e.g. `../../../../etc/passwd`) throws `E_PATH_ESCAPES_ROOT` with
  the exact message;
- traversal via another placeholder value (e.g. `release: '../../..'`) is refused the same way;
- a value with a harmless internal `..` that still normalizes **inside** the root is allowed;
- assert the message string is exactly `Memory entries must reside within the project root`.

## Checks (refactor.checks.post equivalent)

- `npx jest` green (full), coverage > 80% (`memory-path.ts` fully covered).
- `npx tsc -p tsconfig.build.json` clean; eslint clean on changed files.
- Determinism: pure path computation, no wall-clock/random/fs.
- Traceability: task-017 → REQ-SEC-06 → adr-001 / spec-011; BDD P1.11-memory-entries.

## Coordination

Touches only `src/storage` + its test. task-015 (REQ-SEC-02, `src/memory`) already merged to `main`;
disjoint. Rebase before the approver-gated merge; ~zero conflict surface.

## Deferred (out of this task, traced)

- Wiring `resolveConfinedMemoryPath` into `memory.add`/`memory.submit` (map the `StorageError` to
  `CoreResult.error`) → the Memory-entries tasks (task-022 / task-018+). The "no partial write on a
  refused attempt" AC bullet holds by construction (the resolver refuses before returning a path, so no
  write is ever attempted); the end-to-end CLI/MCP assertion of it belongs to those command tasks.
- SARD reconciliation: fix REQ-SEC-06's own `.wingfoil/memory/` fit-criterion text to "the project root"
  → a spec-owner follow-up.
