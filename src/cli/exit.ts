/**
 * The exit-code contract (spec-005-cli-command-contract §1, REQ-INT-04). Every `wingfoil`
 * invocation terminates through this single function, so the `0`/`1`/`2` mapping can never be
 * bypassed by an uncaught code path elsewhere in `src/cli`.
 *
 * This module owns only the *mechanism* (the single `process.exit`). The exit-code *selection* —
 * which outcome maps to which code — lives in `src/core` (`exitCodeForError`/`exitCodeForResult`),
 * shared with the MCP surface per REQ-SYS-05 (task-012); `ExitCode` is re-exported from there so the
 * CLI never redeclares the contract's shape.
 */
import type { ExitCode } from '../core';

export type { ExitCode };

export function exitWith(code: ExitCode, message?: string): never {
  if (message) process.stderr.write(message + '\n');
  process.exit(code);
}
