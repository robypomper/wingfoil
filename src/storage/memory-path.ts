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
 * that "inside the project root" has one definition. This entry point stays **textual**, which is
 * all a rendered pattern needs: it decides where a document will be *created* from placeholder
 * values, and no filesystem answer exists for a path that does not exist yet. A caller holding a
 * real file on disk — where a symlinked directory can put the target outside the root with no
 * traversal in the string at all — wants `resolveRealPathInRoot` instead (`bug-044`).
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
