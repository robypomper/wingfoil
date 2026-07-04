/**
 * Git-root detection and project-root resolution (task-003-git-backed-sot, REQ-SYS-01,
 * spec-011-storage-layout "Git-root detection algorithm"). Every other storage primitive assumes it
 * is operating against a resolved project root — this is where that root comes from.
 */
import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';

import { E_NO_GIT_ROOT, E_NOT_AT_GIT_ROOT, StorageError } from './errors';

/**
 * Walk up from `cwd` looking for a `.git` entry (spec-011: "no upward search for `.wingfoil/`
 * itself, only for `.git`"). Returns the first ancestor directory (inclusive of `cwd`) that
 * contains `.git`, or `null` if the filesystem root is reached without finding one. `cwd` is
 * resolved first so relative paths and trailing separators don't affect the result (determinism).
 */
export function findGitRoot(cwd: string): string | null {
  let dir = resolve(cwd);
  for (;;) {
    if (existsSync(join(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null; // reached the filesystem root without finding .git
    dir = parent;
  }
}

/**
 * Resolve the WingFoil project root: the git root, and only the git root. Per spec-011, `wingfoil`
 * must be invoked at the exact repository root — no upward search for `.wingfoil/` and no running
 * from a subdirectory of the root.
 *
 * @throws {@link StorageError} `E_NO_GIT_ROOT` if `cwd` is not inside a git repository at all, or
 *   `E_NOT_AT_GIT_ROOT` if a git root was found but it isn't `cwd` itself.
 */
export function resolveProjectRoot(cwd: string): string {
  const resolvedCwd = resolve(cwd);
  const root = findGitRoot(resolvedCwd);
  if (root === null) {
    throw new StorageError(E_NO_GIT_ROOT, 'not inside a git repository');
  }
  if (root !== resolvedCwd) {
    throw new StorageError(E_NOT_AT_GIT_ROOT, 'run wingfoil from the project root');
  }
  return root;
}
