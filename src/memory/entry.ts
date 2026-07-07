/**
 * The git-backed Memory-entry store primitive (task-022-implement-memory-entries, P1.11,
 * REQ-SYS-01/REQ-SYS-03, REQ-SEC-06) — the storage foundation `wingfoil memory add` (task-020) and
 * `wingfoil memory submit` build their CLI/CoreResult surface on top of.
 *
 * This module composes three primitives that already exist and are NOT re-implemented here:
 *   - `resolveConfinedMemoryPath` (task-017-storage-confinement, `../storage/memory-path` — not
 *     re-exported by the `../storage` barrel, imported directly per that module's own convention)
 *     renders a type's `path` pattern against concrete values and refuses — throwing
 *     `StorageError('E_PATH_ESCAPES_ROOT', 'Memory entries must reside within the project root')`
 *     — any resolution that would land outside the project root, BEFORE anything is written. That
 *     confinement message is the corrected, canonical REQ-SEC-06 fit-criterion string; the BDD
 *     `.feature` file's older "must reside under .wingfoil/memory/" wording is stale (see this task's
 *     Execution Notes for the reconciliation).
 *   - `writeDocument` (`../storage`) writes bytes only (mkdir-p).
 *   - `commitPaths` (`../storage`) stages exactly the one resolved path and produces exactly one
 *     commit — so calling {@link writeMemoryEntry} twice against the SAME `pattern`/`values` (i.e.
 *     the same target file, modified) yields two DISTINCT commits, with the file's prior content
 *     retrievable from git history via that file's own commit log — the P1.11 "each Memory entry is
 *     individually versioned" contract.
 *
 * Deliberately a throwing **library** primitive, not a `CoreResult`-wrapped `CORE_MODULES` operation:
 * this task's scope is the reusable store primitive, not the `wingfoil memory add` CLI command or its
 * `StorageError` → `CoreError` mapping — both of those are task-020's scope, which wires this
 * primitive in (see the task's Execution Notes for that scoping decision).
 */
import type { CommitOptions } from '../storage';
import { commitPaths, writeDocument } from '../storage';
import { resolveConfinedMemoryPath } from '../storage/memory-path';

/** The result of a single {@link writeMemoryEntry} call. */
export interface MemoryEntryWrite {
  /** The absolute, confinement-verified path that was written (see `resolveConfinedMemoryPath`). */
  readonly path: string;
  /** The 40-hex sha of the single commit this write produced. */
  readonly sha: string;
}

/**
 * Render `pattern` against `values` (per `memory.yaml`'s per-type `path` pattern,
 * spec-001-memory-yaml-schema), confining the result to `root` (REQ-SEC-06), write `content` to that
 * path, and commit exactly that one path as a single commit with `message` (REQ-SYS-01).
 *
 * @throws {@link ../storage/errors.StorageError} `E_PATH_ESCAPES_ROOT` when the resolved path would
 *   escape `root` — refused before any write, so a rejected call writes and commits nothing.
 * @throws whatever `commitPaths`/git raises (e.g. no configured git identity) — callers that need a
 *   pre-flight identity check must call `requireGitIdentity` (`../core/git-identity`) themselves
 *   before invoking this primitive, same as every other mutating core operation.
 */
export function writeMemoryEntry(
  root: string,
  pattern: string,
  values: Record<string, string>,
  content: string,
  message: string,
  options: CommitOptions = {},
): MemoryEntryWrite {
  const path = resolveConfinedMemoryPath(root, pattern, values);
  writeDocument(path, content);
  const sha = commitPaths(root, [path], message, options);
  return { path, sha };
}
