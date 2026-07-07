/**
 * Exit-code selection (spec-005-cli-command-contract §1, REQ-INT-04 — task-012-cli-exit-code-contract).
 *
 * The `0`/`1`/`2` contract has a single source of truth here in `core`, not duplicated across the CLI
 * and MCP surfaces: both derive severity from the same `CoreError` model (REQ-SYS-05), so this module
 * owns the mapping from a domain outcome to its exit code and each surface only *applies* it
 * (`src/cli/exit.ts`'s `exitWith`). Usage errors (`2`) are deliberately NOT produced here — they are
 * parse-level failures a surface detects before any core call (unknown command, invalid flag value,
 * missing required argument), so they remain the surface's own concern (spec-005 §1).
 */
import { ValidationError } from '../validation';

import type { CoreError, CoreErrorCode, CoreResult } from './types';
import { UsageError } from './usage-error';

/** The three-code exit contract (spec-005 §1). Canonical home for the type; `src/cli` re-exports it. */
export type ExitCode = 0 | 1 | 2;

/**
 * Every `CoreError.code` is a **logic** error — a well-formed invocation that failed on business logic
 * — so all map to exit `1`. Declared as an exhaustive `Record<CoreErrorCode, ExitCode>` on purpose: a
 * future `CoreErrorCode` will not compile until its exit code is chosen here, rather than silently
 * defaulting.
 */
const EXIT_CODE_BY_ERROR: Record<CoreErrorCode, ExitCode> = {
  NOT_FOUND: 1,
  INVALID_TRANSITION: 1,
  VALIDATION: 1,
  CONFLICT: 1,
  IO: 1,
};

/** The exit code a {@link CoreError} maps to (spec-005 §1). */
export function exitCodeForError(error: CoreError): ExitCode {
  return EXIT_CODE_BY_ERROR[error.code];
}

/** The exit code for a whole {@link CoreResult}: `0` on success, else the error's mapped code. */
export function exitCodeForResult(result: CoreResult<unknown>): ExitCode {
  return result.ok ? 0 : exitCodeForError(result.error);
}

/** A thrown error's surface rendering: the human `reason` (spec-005 §3) and the process exit code. */
export interface ThrownOutcome {
  readonly reason: string;
  readonly exitCode: ExitCode;
}

/**
 * Select the exit code and reason for a core operation that *threw* (the throw-path companion to
 * {@link exitCodeForResult}, which handles the return path). Keeping this in `src/core` is what lets a
 * thrown usage/integrity error stay "core owns exit-code selection" (spec-008-cli-grammar
 * Consequences), so both surfaces apply it identically rather than each re-deciding:
 *
 * - a {@link UsageError} (a malformed argument, e.g. `dna set`'s invalid key path) → exit **2**, with
 *   its already-clean `.message` as the reason (task-025-implement-dna-set);
 * - a {@link ValidationError} carries its own `exitCode` (integrity/cross-field → 2, field-level → 1,
 *   per spec-009-validation-strategy §3), with the reason joined from its issue messages (never the
 *   composite `${code} ${path} (${file}): …` form its `.message` builds);
 * - anything else is a logic error → exit **1**, with the error's message (or its string form).
 */
export function exitCodeForThrow(error: unknown): ThrownOutcome {
  if (error instanceof UsageError) {
    return { reason: error.message, exitCode: 2 };
  }
  if (error instanceof ValidationError) {
    const reason = error.issues.length > 0 ? error.issues.map((issue) => issue.message).join('; ') : error.message;
    return { reason, exitCode: error.exitCode === 2 ? 2 : 1 };
  }
  return { reason: error instanceof Error ? error.message : String(error), exitCode: 1 };
}
