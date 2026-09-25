/**
 * Memory document path resolution (task-003-git-backed-sot, spec-001-memory-yaml-schema
 * `MemoryTypeEntry.path`). A type's `path` pattern (e.g. `docs/04_memory/{release}/{id}.md` for
 * `task`) MAY contain named placeholders besides `{id}`; spec-001 says those are "resolved by the
 * Workflow pillar from the active `element:` chain before the ID engine runs". This module is the
 * one place that renders any such pattern against concrete values — no other code may hardcode a
 * Memory document path.
 *
 * This does not itself generate `{id}` from a counter — that is the ID-generation engine's job
 * (`src/validation/id.ts`, task-002-validation-id-engine); callers pass the already-generated id in
 * `values` like any other placeholder.
 */
import { join, resolve } from 'path';

import { escapesRoot } from './confinement';
import { E_MISSING_PATH_VALUE, E_PATH_ESCAPES_ROOT, StorageError } from './errors';

/** Exact confinement-violation message required by REQ-SEC-06's fit criterion — do not reword. */
const CONFINEMENT_MESSAGE = 'Memory entries must reside within the project root';

const PLACEHOLDER_RE = /\{([^{}]+)\}/g;

/**
 * Render a `path` pattern against a set of concrete placeholder values.
 *
 * @throws {@link StorageError} `E_MISSING_PATH_VALUE` naming every `{placeholder}` in `pattern`
 *   that has no corresponding key in `values` (all missing values are reported together, not just
 *   the first).
 */
export function renderMemoryPath(pattern: string, values: Record<string, string>): string {
  const missing: string[] = [];
  const rendered = pattern.replace(PLACEHOLDER_RE, (_match, token: string) => {
    const value = values[token];
    if (value === undefined) {
      missing.push(token);
      return '';
    }
    return value;
  });
  if (missing.length > 0) {
    throw new StorageError(
      E_MISSING_PATH_VALUE,
      `path pattern "${pattern}" is missing value(s) for: ${missing.join(', ')}`,
    );
  }
  return rendered;
}

/** Render `pattern` (see {@link renderMemoryPath}) and resolve it to an absolute path under `root`. */
export function resolveMemoryPath(
  root: string,
  pattern: string,
  values: Record<string, string>,
): string {
  return join(root, renderMemoryPath(pattern, values));
}

/**
 * Render + resolve a Memory-entry path (see {@link resolveMemoryPath}) **and enforce storage
 * confinement (REQ-SEC-06)**: the absolute target must be strictly inside the project `root`.
 * `path.join`/`resolve` normalize `../`, so a crafted `id` (or any placeholder value) containing
 * traversal could otherwise steer the write outside the managed, git-tracked store that REQ-SYS-01
 * establishes as project truth — this refuses that **before** returning a path, so no caller ever
 * writes outside the root.
 *
 * The boundary itself is {@link escapesRoot} (`./confinement.ts`), shared with every other store so
 * that "inside the project root" has one definition. This entry point is still **textual**, and that
 * is a known gap rather than a justified choice: a symlinked directory on the way to a Memory
 * document puts the write outside the root with no traversal anywhere in the string, so this
 * function returns the path and the caller writes there. A filesystem answer does exist even for a
 * path not yet created — `resolveRealPathInRoot` (`./confinement.ts`) resolves as far as the
 * filesystem goes and keeps the missing tail verbatim, which is exactly the "path that does not
 * exist yet" case — so nothing about rendering a pattern prevents this from being resolved too.
 * Measured on the Memory store by `task-102`'s review; the repair is owned by
 * `bug-117-memory-add-writes-outside-the-project-root-through-a-symlinked-store` (a v0.2 blocker,
 * fix task `task-105`), not by `task-102`, whose boundary was `directive remove`. Until then, a caller that can reach a
 * real directory on disk should use `resolveRealPathInRoot` (`bug-044`).
 *
 * @returns the absolute, confinement-verified target path.
 * @throws {@link StorageError} `E_PATH_ESCAPES_ROOT` (message {@link CONFINEMENT_MESSAGE}) when the
 *   resolved path is the root itself or escapes it.
 */
export function resolveConfinedMemoryPath(
  root: string,
  pattern: string,
  values: Record<string, string>,
): string {
  const resolvedRoot = resolve(root);
  const target = resolve(resolvedRoot, renderMemoryPath(pattern, values));
  if (escapesRoot(resolvedRoot, target)) {
    throw new StorageError(E_PATH_ESCAPES_ROOT, CONFINEMENT_MESSAGE);
  }
  return target;
}
