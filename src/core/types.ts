/**
 * Core result & error shapes (spec-006-core-domain-api §2 — "Function shape").
 *
 * Every core function returns `Promise<CoreResult<T>>`, a discriminated union — never a thrown
 * error for *expected* domain failures (illegal state transition, missing element, schema
 * violation). That is what lets `src/cli`'s exit-code/stderr rendering and `src/mcp`'s Tool
 * `isError`/Resource-read-failure response be driven off the very same value, rather than each
 * surface independently deciding what counts as a failure and how to report it.
 */

/** The fixed `CoreError.code` enumeration (spec-006 §2, verbatim). */
export type CoreErrorCode = 'NOT_FOUND' | 'INVALID_TRANSITION' | 'VALIDATION' | 'CONFLICT' | 'IO';

/**
 * An expected domain failure carried by a failed {@link CoreResult} (spec-006 §2): a fixed
 * {@link CoreErrorCode}, a human-readable `message`, and optional structured `details`. The single
 * shape both surfaces map to an exit code / MCP error response.
 */
export interface CoreError {
  readonly code: CoreErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

/**
 * The discriminated-union return of every {@link CoreFn} (spec-006 §2): `ok: true` with the operation's
 * `value` (and, for a mutation, the `commit` it produced), or `ok: false` with a {@link CoreError}.
 * Expected domain failures travel here, never as a thrown exception.
 */
export type CoreResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly commit?: { readonly sha: string; readonly message: string };
    }
  | { readonly ok: false; readonly error: CoreError };

/** Build a success {@link CoreResult}, optionally carrying the git commit the operation produced. */
export function coreOk<T>(value: T, commit?: { sha: string; message: string }): CoreResult<T> {
  return commit ? { ok: true, value, commit } : { ok: true, value };
}

/** Build a failure {@link CoreResult} from a {@link CoreError}. */
export function coreErr<T = never>(error: CoreError): CoreResult<T> {
  return { ok: false, error };
}
