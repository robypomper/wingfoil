/**
 * Resolving the revision a read is pinned to (task-137, `spec-012` §2 `stateRef`, `spec-016` §3.3
 * step 7, `spec-017` §1.1).
 *
 * Every `…AtRev(root, rev)` reader — the pillar loaders (`./loaders.ts`) and the Memory scan
 * (`../memory/query.ts`) — resolves its `rev` here, once, to the full sha of a commit, and reads every
 * byte at that sha. A rev that resolves to nothing is a refusal, never an empty answer: an empty
 * directive list or Memory scan is a legitimate answer for a commit that holds nothing, so handing it
 * back for a mistyped rev would build an agent a wrong context that looks right.
 */
import { resolveCommitAtRev } from '../storage';

import type { CoreError, CoreErrorCode } from './types';

/**
 * A revision a `…AtRev` reader cannot read at. It is thrown, like the loaders' `ValidationError`, and
 * it **is** a {@link CoreError} — `code`, `message`, `details: { rev }` — so a core function hands it
 * on with `coreErr(error.toCoreError())`.
 *
 * - `VALIDATION`: the rev is malformed ({@link isWellFormedRevision}) and was never shown to git.
 * - `NOT_FOUND`: the rev is well formed and names no commit — an unknown name, an unborn `HEAD`, a
 *   tree or a blob.
 *
 * Both messages name the rev JSON-quoted, so an empty or whitespace rev is visible.
 */
export class RevisionError extends Error implements CoreError {
  readonly code: CoreErrorCode;
  readonly details: { readonly rev: string };

  constructor(code: 'VALIDATION' | 'NOT_FOUND', rev: string) {
    super(
      code === 'VALIDATION'
        ? `malformed revision ${JSON.stringify(rev)}: a revision is a non-empty name with no leading '-', no whitespace or control character, no ':' and no '..'`
        : `revision ${JSON.stringify(rev)} does not name a commit`,
    );
    this.name = 'RevisionError';
    this.code = code;
    this.details = { rev };
    // Restore the prototype chain so `instanceof RevisionError` holds after transpilation.
    Object.setPrototypeOf(this, RevisionError.prototype);
  }

  /** The plain {@link CoreError} value, for a `CoreResult` (spec-006 §2). */
  toCoreError(): CoreError {
    return { code: this.code, message: this.message, details: { rev: this.details.rev } };
  }
}

/**
 * Whether `rev` has the shape a single-commit revision may have here. Refused: the empty string; a
 * leading `-` (git would read it as an option); whitespace and control bytes (no ref name holds them,
 * and a newline would split a batch request); `:` (that is `<rev>:<path>`, a blob, never a commit);
 * `..` (a range, two commits). Everything else — `HEAD`, `HEAD~2`, a sha or its prefix, a branch, a tag,
 * `main@{1}` — is left for git to resolve.
 */
export function isWellFormedRevision(rev: string): boolean {
  // eslint-disable-next-line no-control-regex
  return rev.length > 0 && !rev.startsWith('-') && !/[\s\u0000-\u001f\u007f:]/.test(rev) && !rev.includes('..');
}

/**
 * Resolve `rev` to the full sha of the commit it names (task-137).
 *
 * @param root - Project root (the git repository).
 * @param rev - A revision naming one commit: `HEAD`, a sha, a branch, a tag.
 * @returns The commit's full sha.
 * @throws {@link RevisionError} `VALIDATION` for a malformed rev, `NOT_FOUND` for one naming no commit.
 */
export function resolveRevision(root: string, rev: string): string {
  if (!isWellFormedRevision(rev)) throw new RevisionError('VALIDATION', rev);
  const sha = resolveCommitAtRev(root, rev);
  if (sha === null) throw new RevisionError('NOT_FOUND', rev);
  return sha;
}

/**
 * Run a `…AtRev(root, 'HEAD')` read with the answer the `…AtHead` readers have always given when there
 * is no `HEAD` to read — `fallback` (`null`, or `[]` for a directory) — rather than a
 * {@link RevisionError}. `HEAD` is a constant there, so the only refusal it can meet is `NOT_FOUND`: a
 * repository with no commit yet, which those readers' callers already treat as "nothing committed"
 * (task-090, task-091, task-096). Any other error propagates.
 */
export function atHeadOr<T, F>(read: () => T, fallback: F): T | F {
  try {
    return read();
  } catch (error) {
    if (error instanceof RevisionError && error.code === 'NOT_FOUND') return fallback;
    throw error;
  }
}
