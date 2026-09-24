/**
 * Exit-code selection (spec-005-cli-command-contract §1, REQ-INT-04, task-012-cli-exit-code-contract).
 * Both the CLI and the MCP surface derive severity from the same CoreError model (REQ-SYS-05); this
 * maps a CoreError / CoreResult onto the 0/1/2 exit contract in ONE place so neither surface hardcodes
 * its own convention. Parse-level usage errors (2) are *detected* by the surface before any core call,
 * but since task-101-route-commander-parse-errors-through-the-exit-code-contract (`bug-098`) their code
 * is chosen here too, by `exitCodeForParseOutcome` — covered at the bottom of this file.
 */
import { coreErr, coreOk } from '../../src/core/types';
import type { CoreErrorCode } from '../../src/core/types';
import { exitCodeForError, exitCodeForParseOutcome, exitCodeForResult } from '../../src/core/exit-code';

const ALL_CODES: readonly CoreErrorCode[] = ['NOT_FOUND', 'INVALID_TRANSITION', 'VALIDATION', 'CONFLICT', 'IO'];

describe('exitCodeForError — CoreError → exit code (REQ-INT-04)', () => {
  it.each(ALL_CODES)('maps the domain error code %s to a logic-error exit 1', (code) => {
    expect(exitCodeForError({ code, message: `boom: ${code}` })).toBe(1);
  });
});

describe('exitCodeForResult — CoreResult → exit code', () => {
  it('maps a successful result to 0', () => {
    expect(exitCodeForResult(coreOk({ any: 'value' }))).toBe(0);
  });

  it.each(ALL_CODES)('maps a %s failure result to 1', (code) => {
    expect(exitCodeForResult(coreErr({ code, message: 'boom' }))).toBe(1);
  });
});

/**
 * The argument-parser mapping (task-101, `bug-098`). The code strings are Commander's, read from the
 * INSTALLED `commander@15.0.0` (`node_modules/commander/lib/command.js` / `lib/error.js`) rather than
 * from memory — they are version surface, and this suite is what fails if an upgrade renames one while
 * `USAGE_ERROR_PARSE_CODES` still lists the old spelling.
 */
describe('exitCodeForParseOutcome — an argument parser\'s own termination → exit code (spec-005 §1)', () => {
  /** Every code commander@15.0.0 raises through `Command#error()` or `InvalidArgumentError`. */
  const USAGE_ERROR_CODES = [
    'commander.unknownCommand',
    'commander.unknownOption',
    'commander.excessArguments',
    'commander.missingArgument',
    'commander.optionMissingArgument',
    'commander.missingMandatoryOptionValue',
    'commander.conflictingOption',
    'commander.invalidArgument',
    'commander.error',
  ] as const;

  it.each(USAGE_ERROR_CODES)('maps %s to a usage-error exit 2, overriding the parser\'s suggested 1', (code) => {
    // 1 is what commander suggests for all of these (`Command#error`'s `config.exitCode || 1`); the
    // contract answers 2, which is the whole of bug-098.
    expect(exitCodeForParseOutcome({ code, exitCode: 1 })).toBe(2);
  });

  it.each(['commander.helpDisplayed', 'commander.version', 'commander.help'])(
    'keeps %s at exit 0 — `--help` and `--version` always exit 0 (spec-005 §1)',
    (code) => {
      expect(exitCodeForParseOutcome({ code, exitCode: 0 })).toBe(0);
    },
  );

  it('keeps a non-zero suggestion on a non-usage outcome at 1 rather than promoting it to 2', () => {
    // `commander.help` reached through `this.help({ error: true })` — a noun invoked with no verb —
    // suggests 1. That case is NOT a usage error this task reclassifies: it keeps the code it had, so
    // this change cannot smuggle in a behaviour it was never asked to change.
    expect(exitCodeForParseOutcome({ code: 'commander.help', exitCode: 1 })).toBe(1);
  });

  it('gives an unrecognised parser code the status quo, never a usage-error meaning by default', () => {
    // A future commander release adding a code this table does not list must not silently acquire
    // exit 2; it keeps the parser's own suggestion, narrowed to the three-code contract.
    expect(exitCodeForParseOutcome({ code: 'commander.somethingNew', exitCode: 1 })).toBe(1);
    expect(exitCodeForParseOutcome({ code: 'commander.somethingNew', exitCode: 0 })).toBe(0);
    expect(exitCodeForParseOutcome({ code: 'commander.executeSubCommandAsync', exitCode: 1 })).toBe(1);
  });

  it('narrows any out-of-contract suggestion into the three-code contract', () => {
    expect(exitCodeForParseOutcome({ code: 'commander.somethingNew', exitCode: 127 })).toBe(1);
  });
});
