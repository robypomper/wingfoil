/**
 * The exit-code contract (spec-005-cli-command-contract §1, REQ-INT-04). Every `wingfoil`
 * invocation terminates through this single function, so the `0`/`1`/`2` mapping can never be
 * bypassed by an uncaught code path elsewhere in `src/cli`.
 */
export type ExitCode = 0 | 1 | 2;

export function exitWith(code: ExitCode, message?: string): never {
  if (message) process.stderr.write(message + '\n');
  process.exit(code);
}
