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
import { join } from 'path';

import { E_MISSING_PATH_VALUE, StorageError } from './errors';

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
