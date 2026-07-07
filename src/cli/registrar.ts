/**
 * The CLI adapter's command registrar (spec-006-core-domain-api §2/§4, spec-005-cli-command-contract,
 * spec-008-cli-grammar — task-006). `buildCliCommands` is the "command registrar" spec-006 §4.1
 * refers to: it imports nothing but the `CoreModule[]` it is given, iterates `enumerateOperations`
 * (never a hand-copied operation list), and derives **every** operation it finds into a
 * `wingfoil <noun> <verb>` command descriptor — regardless of `mutates` (§2: "CLI exposes every
 * operation regardless of `mutates`"). No business logic lives outside `run`: it only (a)
 * validates the global `--format` flag, (b) turns the invocation into typed params via the
 * caller-supplied `buildParams`, (c) calls the one core function, (d) renders the resulting
 * `CoreResult` via `renderSuccess`/`emitError` and terminates via `exitWith` — matching spec-005
 * §1's "exactly one process exit call per invocation".
 *
 * Deliberately Commander-independent (see `./program.ts`'s module doc for why): this module owns
 * 100% of the AC-relevant behavior — naming, dispatch, exit codes, output rendering — and is fully
 * unit-testable; wiring this command model onto a real `commander` `Command` tree is a separate,
 * thin, mechanical concern.
 */
import type { CoreModule, ParamsBuilder } from '../core/registry';
import { enumerateOperations, deriveVerb } from '../core/registry';
import type { CoreResult } from '../core/types';
import { exitCodeForResult } from '../core/exit-code';

import { emitError } from './error';
import { exitWith } from './exit';
import { isValidFormat, renderSuccess } from './output';

export interface BuildCommandsOptions {
  /** Resolves the project root a core call needs — an ambient/environment concern, not a CLI flag. */
  readonly resolveRoot: () => string;
  readonly buildParams: ParamsBuilder;
}

/**
 * One derived `wingfoil <noun> <verb>` command (or, when `verb === ''`, a flat `wingfoil <noun>`
 * command — spec-008-cli-grammar §1, task-028-implement-paths-category): its dispatch is a pure
 * function of the ambient `--format` value plus this operation's own positional/flag values, if any.
 */
export interface CliCommand {
  readonly noun: string;
  readonly verb: string;
  readonly mutates: boolean;
  /** Copied from `CoreOperation.flags` (`../core/registry.ts`) — the boolean flag names `program.ts`
   * registers as Commander `--{name}` options for this command (empty/absent for every command
   * before task-028-implement-paths-category; `['list']` for `paths`). */
  readonly flags?: readonly string[];
  /**
   * Execute this command given the resolved `--format` flag value (still unvalidated at this point),
   * the single bare positional argument the invocation supplied (task-026-implement-dna-show's
   * generic seam, `core/registry.ts`'s `ParamsContext.positional` — e.g. `wingfoil dna show
   * tech_stack` / `wingfoil paths sources`), and this command's own parsed `--{flag}` values
   * (task-028, e.g. `{ list: true }`). All three are additive/optional — a command that reads no
   * positional and declares no flags is still called exactly as before: `run(format)`.
   */
  readonly run: (
    formatValue: string,
    positional?: string,
    flags?: Readonly<Record<string, boolean>>,
  ) => Promise<void>;
}

/**
 * Derive one `CliCommand` per operation in `modules`, in `enumerateOperations`'s deterministic
 * order (REQ-SYS-07). The verb is derived via `deriveVerb` (spec-006 §5).
 */
export function buildCliCommands(modules: readonly CoreModule[], options: BuildCommandsOptions): CliCommand[] {
  return enumerateOperations(modules).map(({ module, operation }) => {
    const verb = deriveVerb(module.name, operation.name);
    return {
      noun: module.name,
      verb,
      mutates: operation.mutates,
      flags: operation.flags,
      run: async (
        formatValue: string,
        positional?: string,
        flags?: Readonly<Record<string, boolean>>,
      ) => {
        if (!isValidFormat(formatValue)) {
          exitWith(2, `error: invalid --format value "${formatValue}", expected one of: console, json, yaml`);
          return;
        }
        const format = formatValue;

        let result: CoreResult<unknown>;
        try {
          // `resolveRoot()` / `buildParams()` run INSIDE the try so an ambient failure — e.g. a
          // `StorageError` from resolving the git root outside a WingFoil project — is rendered
          // through the spec-005 §1 single-exit path (emitError + exitWith), never escaping as an
          // uncaught throw that a top-level handler would stack-dump (bug-002-cli-error-stack-dump).
          const params = options.buildParams({
            moduleName: module.name,
            operationName: operation.name,
            root: options.resolveRoot(),
            positional,
            flags,
          });
          result = await operation.fn(params);
        } catch (error) {
          emitError(error instanceof Error ? error.message : String(error), { format });
          exitWith(1);
          return;
        }

        // Render the outcome, then terminate through the single exit function with the code core
        // selects for this result (`0` success / `1` logic error) — the CLI does not re-decide the
        // `0`/`1` mapping (task-012, spec-005 §1). `2` (usage error) is handled above, pre-core.
        if (result.ok) {
          process.stdout.write(renderSuccess(result.value, format));
        } else {
          emitError(result.error.message, { format });
        }
        exitWith(exitCodeForResult(result));
      },
    };
  });
}

/**
 * Every `"{noun} {verb}"` command derived from `commands`, sorted (REQ-SYS-07) — the CLI-side
 * enumeration the REQ-SYS-05 parity test (`test/core/parity.test.ts`) diffs against the MCP Tool
 * list. A flat, no-verb command (`verb === ''`, task-028-implement-paths-category) renders as the
 * bare noun (`"paths"`), not `"paths "` with a trailing space.
 */
export function listRegisteredCliCommands(commands: readonly CliCommand[]): string[] {
  return commands.map((command) => (command.verb ? `${command.noun} ${command.verb}` : command.noun)).sort();
}
