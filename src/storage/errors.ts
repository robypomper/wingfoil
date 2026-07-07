/**
 * Shared storage-layer error type (task-003-git-backed-sot, REQ-SYS-01, spec-011-storage-layout).
 *
 * Mirrors the shape of {@link ../validation/errors.ValidationError} — a single typed `Error`
 * subclass carrying a stable `E_*` code — but for storage/root/init-detection failures, which are
 * process-environment problems (wrong cwd, not a git repo, an unresolved path placeholder), not
 * data-validation problems. Kept separate from `src/validation` rather than reusing
 * `ValidationError` because these failures never carry a `ValidationIssue[]`/`exitCode` pair: they
 * are single, precise conditions raised before any document parsing happens.
 */
export class StorageError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'StorageError';
    this.code = code;
    // Restore the prototype chain so `instanceof StorageError` holds after transpilation.
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

/** Raised by {@link resolveProjectRoot} when no ancestor of `cwd` contains a `.git` entry. */
export const E_NO_GIT_ROOT = 'E_NO_GIT_ROOT';

/** Raised by {@link resolveProjectRoot} when the git root exists but isn't `cwd` itself. */
export const E_NOT_AT_GIT_ROOT = 'E_NOT_AT_GIT_ROOT';

/** Raised by {@link renderMemoryPath} when a `{placeholder}` in a `path` pattern has no value. */
export const E_MISSING_PATH_VALUE = 'E_MISSING_PATH_VALUE';

/**
 * Raised by {@link resolveConfinedMemoryPath} when a resolved Memory-entry path would land outside the
 * project root — e.g. a crafted `id`/value containing `../` traversal (REQ-SEC-06 storage confinement).
 */
export const E_PATH_ESCAPES_ROOT = 'E_PATH_ESCAPES_ROOT';
