/**
 * Exit-code selection (spec-005-cli-command-contract §1, REQ-INT-04 — task-012-cli-exit-code-contract).
 *
 * The `0`/`1`/`2` contract has a single source of truth here in `core`, not duplicated across the CLI
 * and MCP surfaces: both derive severity from the same `CoreError` model (REQ-SYS-05), so this module
 * owns the mapping from a domain outcome to its exit code and each surface only *applies* it
 * (`src/cli/exit.ts`'s `exitWith`).
 *
 * Parse-level usage errors (`2`) are *detected* by a surface before any core call — an unknown
 * command, an unknown option, a missing required argument — but since
 * task-101-route-commander-parse-errors-through-the-exit-code-contract (`bug-098`) their **code** is
 * decided here too, by {@link exitCodeForParseOutcome}. Before that task the CLI's argument parser
 * terminated through its own `process.exit(1)` and those classes never reached this module at all, so
 * an unknown command reported `1` — the code spec-005 §1 reserves for a *well-formed* invocation that
 * failed. Keeping the parse mapping here is what that task's AC6 protects: one place decides an exit
 * code, not one place per error origin.
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

/**
 * How a CLI argument parser terminated, reduced to the two fields the exit-code decision needs — the
 * parser's own outcome identifier and the exit code it *suggests*. Commander's `CommanderError` is
 * structurally this (`.code` / `.exitCode`), so `src/cli` hands one straight in; the interface is
 * declared structurally rather than importing `commander` so `core` keeps no dependency on the CLI's
 * parser (REQ-SYS-05 — the same mapping has to be applicable from the MCP surface).
 */
export interface ParseOutcome {
  /** The parser's outcome identifier, e.g. Commander's `'commander.unknownCommand'`. */
  readonly code: string;
  /** The exit code the parser suggests for this outcome — advisory, not the contract's answer. */
  readonly exitCode: number;
}

/**
 * The argument-parser outcomes that are **usage errors** under spec-005 §1 ("the invocation itself is
 * malformed: unknown command/pillar/verb, unknown flag, missing required argument, invalid flag
 * value") and therefore exit `2`, whatever the parser itself suggests.
 *
 * The identifiers are Commander's, confirmed against the **installed** version (`commander@15.0.0`,
 * `node_modules/commander/lib/command.js` — `unknownOption()`, `excessArguments()`,
 * `unknownCommand()`, `missingArgument()`, `optionMissingArgument()`, `missingMandatoryOptionValue()`,
 * `conflictingOption()`, each calling `this.error(message, { code })`, plus `commander.error` as
 * `error()`'s own default and `commander.invalidArgument` from `InvalidArgumentError`). They are
 * version surface: a Commander upgrade that renames or adds one must revisit this set, which is why
 * the codes are listed explicitly here rather than inferred from the suggested exit code.
 *
 * One of them, `commander.excessArguments`, is mapped but **unreachable in production today**: every
 * derived command registers a variadic `[positionals...]` (`src/cli/program.ts`), so Commander never
 * has an excess argument to refuse — `wingfoil dna show project extra` is accepted and an extra
 * positional on a write verb is refused by WingFoil's own check instead, already at exit `2`. It is
 * listed because the mapping must stay correct for the code rather than for today's registration
 * shape; a reader finding it never fires is not looking at a mistake.
 */
const USAGE_ERROR_PARSE_CODES: ReadonlySet<string> = new Set([
  'commander.unknownCommand',
  'commander.unknownOption',
  'commander.excessArguments',
  'commander.missingArgument',
  'commander.optionMissingArgument',
  'commander.missingMandatoryOptionValue',
  'commander.conflictingOption',
  'commander.invalidArgument',
  'commander.error',
]);

/**
 * The exit code for a CLI argument parser's own termination (spec-005 §1, REQ-INT-04 — task-101,
 * `bug-098`). The parser reaches this both when it *refuses* an invocation and when it *completes*
 * one without running a command (`--help`, `--version`), so the mapping has two branches:
 *
 * - an outcome in {@link USAGE_ERROR_PARSE_CODES} is a malformed invocation → exit **2**, overriding
 *   the parser's suggestion (Commander suggests `1` for every one of them);
 * - anything else is a *successful* termination or an outcome this contract does not classify, and
 *   keeps the parser's own suggested code, narrowed to the three-code contract: `0` stays `0` (so
 *   `--help` and `--version` still exit `0`, as spec-005 §1 requires), any non-zero suggestion becomes
 *   `1`. That default is deliberately the status quo rather than `2`: an unrecognised outcome must not
 *   silently acquire a usage-error meaning it was never shown to have.
 */
export function exitCodeForParseOutcome(outcome: ParseOutcome): ExitCode {
  if (USAGE_ERROR_PARSE_CODES.has(outcome.code)) return 2;
  return outcome.exitCode === 0 ? 0 : 1;
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
