/**
 * Wires `./registrar.ts`'s Commander-independent command model onto a real `commander` `Command`
 * tree — the only place this module (or any module reachable from a test file) imports `commander`.
 *
 * ENVIRONMENT NOTE (task-006, see the task's Execution Notes for the full write-up): `commander`
 * v15 ships ESM-only (no CJS build — its `package.json` has `"type": "module"` and a single
 * `"default": "./index.js"` export). This project's `tsconfig.json` (`module: Node16`, no
 * top-level `"type": "module"` in `package.json`) compiles `.ts` files as CommonJS by default, and
 * a *static* `import { Command } from 'commander'` from a CJS-resolved file is downleveled to a
 * `require()` call — which `tsc --noEmit` itself refuses to emit for an ESM-only target (TS1479),
 * and which, even if suppressed, would crash at Jest-test runtime (`ts-jest`'s CommonJS test
 * environment cannot `require()` an ESM module; confirmed empirically — this predates task-006, a
 * consequence of task-001's dependency pick, not something in this task's scope to fix
 * project-wide, e.g. by migrating the whole Jest config to ESM or downgrading `commander`).
 *
 * The fix that keeps `commander` as the real, declared CLI dependency (per `dna.yaml` /
 * spec-005/008) without touching the project's Jest/tsconfig setup: a *dynamic* `import('commander')`
 * here, inside an async function. Dynamic `import()` is never downleveled by `tsc` regardless of
 * module target, so it does not trigger TS1479, and it resolves correctly at real `node`/`wingfoil`
 * runtime (Node 22's ESM-aware module loader).
 *
 * TESTING (task-065-fix-commander-esm-jest-harness, `bug-007-commander-esm-jest-untestable`): this
 * file's wiring — construct the global flags, register a noun/verb `Command` per `CliCommand`,
 * forward to `command.run` — used to be verified by hand, because a test importing it hit that same
 * Jest-runtime wall (`module: Node16` *preserves* the dynamic `import()`, and jest's CommonJS runtime
 * has no dynamic-import callback). It is now covered two ways, with no change to this file: in-process
 * by `test/cli/program.test.ts` — jest compiles the test runtime as CommonJS against
 * `tsconfig.test.json` and transforms `commander`'s ESM on the way in, see `jest.config.js` — and
 * black-box by `test/cli/program.integration.test.ts`, which spawns the compiled `dist/` and so
 * exercises the real ESM `import()` this file actually ships with.
 * `buildCliCommands`/`listRegisteredCliCommands` (`./registrar.ts`) still carry 100% of the
 * AC-relevant behavior; this file adds no logic of its own beyond Commander's own API calls.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Type-only; commander is ESM-only, hence the explicit resolution-mode attribute — see module doc above.
import type { Command } from 'commander' with { 'resolution-mode': 'import' };

import type { CoreModule } from '../core/registry';

import { buildCliCommands, type BuildCommandsOptions, type CliCommand } from './registrar';
import { runInit, createReadlinePrompt } from './init-command';
import { runMcp } from './mcp-command';
import { emitError } from './error';
import { exitWith } from './exit';
import { isValidFormat } from './output';

/**
 * The CLI version, read from `package.json` deterministically (REQ-SYS-07 — no wall-clock, no
 * inference): the manifest sits two levels up from this module in both the `src/cli/` source layout
 * and the compiled `dist/cli/` layout, and npm always ships `package.json` at the package root, so
 * the same relative path resolves for `wingfoil --version` after a global install.
 */
function readPackageVersion(): string {
  const manifestPath = join(__dirname, '..', '..', 'package.json');
  return (JSON.parse(readFileSync(manifestPath, 'utf-8')) as { version: string }).version;
}

/**
 * Build the root `commander` program: register the global flags, the special `init`/`mcp` bootstrap
 * commands, and one `wingfoil <noun> <verb>` (or flat `<noun>`) command per `CoreModule` operation
 * derived through {@link BuildCommandsOptions}. Async because `commander` is imported dynamically
 * (see the module doc). The command *behaviour* lives in `./registrar.ts`; this only wires it onto
 * Commander.
 */
export async function buildProgram(modules: readonly CoreModule[], options: BuildCommandsOptions): Promise<Command> {
  const { Command: CommandCtor } = await import('commander');
  const program = new CommandCtor('wingfoil');
  // Register `-V, --version` so `wingfoil --version` prints the version and exits 0
  // (spec-008-cli-grammar §1, bug-001-cli-version-flag) — Commander handles it before any command.
  program.version(readPackageVersion());
  program
    .option('--format <format>', 'output format (console|json|yaml)', 'console')
    .option('--verbose', 'emit diagnostic logs to stderr')
    .option('--no-color', 'disable ANSI colors')
    .option('--no-interactive', 'fail on missing args instead of prompting');

  // `wingfoil init` is a SPECIAL bootstrap command (task-029, P5.1.1): it runs BEFORE config exists,
  // so it is NOT a `CORE_MODULES` noun-verb op — it is wired directly here and drives `runInit`
  // (./init-command.ts). The wizard/`--template`/prompt-matrix logic is fully unit-tested in
  // ./init-command.ts; this registration is the same thin, un-unit-tested `commander` seam as the
  // rest of this file (see the module doc).
  program
    .command('init')
    .description('initialize WingFoil in the current git repository')
    .option('--template <name>', 'methodology template to initialize with (non-interactive)')
    .action(async (localOpts: { template?: string }) => {
      const globalOpts = program.opts<{ format: string; interactive: boolean }>();
      let root: string;
      try {
        root = options.resolveRoot();
      } catch (error) {
        emitError(error instanceof Error ? error.message : String(error), { format: 'console' });
        exitWith(1);
        return;
      }
      await runInit(
        { template: localOpts.template, interactive: globalOpts.interactive, format: globalOpts.format },
        { root, isTTY: Boolean(process.stdout.isTTY), prompt: createReadlinePrompt() },
      );
    });

  // `wingfoil mcp` is a SPECIAL command (task-030, P5.2.1, spec-014-mcp-server-entry-point §1): it
  // starts the long-running production MCP server over stdio rather than wrapping a `CORE_MODULES`
  // noun-verb op, so — like `init` above — it is wired directly here and drives `runMcp`
  // (./mcp-command.ts). The pre-flight (resolve-root / error / exit 1) is unit-tested in
  // ./mcp-command.ts with an injected server-start; this registration is the same thin, un-unit-tested
  // `commander` seam as the rest of this file (see the module doc).
  program
    .command('mcp')
    .description('start the WingFoil MCP server (read-only Resources) over stdio')
    .action(async () => {
      const globalOpts = program.opts<{ format: string }>();
      const format = isValidFormat(globalOpts.format) ? globalOpts.format : 'console';
      await runMcp({ resolveRoot: options.resolveRoot, version: readPackageVersion(), format });
    });

  const nounCommands = new Map<string, Command>();
  for (const command of buildCliCommands(modules, options)) {
    const target = resolveCommandTarget(program, nounCommands, command);

    // A variadic optional bare positional list (task-025-implement-dna-set's `positionals` seam,
    // generalizing task-026's single `[positional]`) — registered on every command regardless of how
    // many positionals its operation reads (harmless if ignored), so `dna show [section]` /
    // `paths [category]` (one) and `dna set <key> <value>` (two) share ONE positional mechanism.
    // Plus this command's own `--{flag}` options (task-028-implement-paths-category's
    // `CoreOperation.flags`, e.g. `paths`'s `--list`): Commander rejects an unknown option, so each
    // declared flag must be registered explicitly.
    target.argument('[positionals...]', 'optional positional arguments (e.g. a section/category name, or `dna set <key> <value>`)');
    for (const name of command.flags ?? []) {
      target.option(`--${name}`, `${name} flag`);
    }
    // Value-bearing `--{name} <value>` options (task-020-implement-memory-add's `memory add
    // --type/--title/--tags`): Commander rejects an unknown option, so each declared option must be
    // registered explicitly with a `<value>` operand (distinguishing it from a boolean `--flag`).
    for (const option of command.options ?? []) {
      target.option(`--${option.name} <value>`, `${option.name} value`);
    }

    // Commander's action callback for a `[positionals...]` variadic + options command is
    // `(positionalsArray, optionsObject, commandObject)`. Forward the whole array (task-025),
    // collapse this command's declared flags into a `{ name: boolean }` record (task-028) and its
    // declared value options into a `{ name: value }` record (task-020) for `run`.
    target.action(async (positionals: string[] = [], options: Record<string, unknown> = {}) => {
      const globalOpts = program.opts<{ format: string }>();
      await command.run(globalOpts.format, positionals, buildFlagValues(command, options), buildOptionValues(command, options));
    });
  }

  return program;
}

/**
 * The Commander `Command` a `CliCommand` registers itself on: a flat, no-verb command
 * (`command.verb === ''` — `deriveVerb`'s self-named-operation case, spec-008-cli-grammar §1's
 * `wingfoil <noun> [args] [flags]` form, e.g. `wingfoil paths [category]` —
 * task-028-implement-paths-category) registers directly on the noun `Command` itself; every other
 * (`<noun> <verb>`) command keeps nesting under it exactly as before task-028.
 */
function resolveCommandTarget(program: Command, nounCommands: Map<string, Command>, command: CliCommand): Command {
  if (!command.verb) return program.command(command.noun);

  let nounCommand = nounCommands.get(command.noun);
  if (!nounCommand) {
    nounCommand = program.command(command.noun);
    nounCommands.set(command.noun, nounCommand);
  }
  return nounCommand.command(command.verb);
}

/**
 * Collapse this command's declared `CoreOperation.flags` names (`./registrar.ts`'s `CliCommand.flags`)
 * into a `{ name: boolean }` record read from Commander's parsed options object, so `command.run`
 * (Commander-independent) never has to know Commander's option-object shape. Returns `undefined` when
 * the command declares no flags (every command before task-028-implement-paths-category), matching
 * `CliCommand.run`'s already-optional `flags` parameter.
 */
function buildFlagValues(
  command: CliCommand,
  options: Record<string, unknown>,
): Readonly<Record<string, boolean>> | undefined {
  const flagNames = command.flags ?? [];
  if (flagNames.length === 0) return undefined;
  const flagValues: Record<string, boolean> = {};
  for (const name of flagNames) {
    flagValues[name] = Boolean(options[name]);
  }
  return flagValues;
}

/**
 * Collapse this command's declared `CoreOperation.options` (`./registrar.ts`'s `CliCommand.options`)
 * into a `{ name: value }` record read from Commander's parsed options object (task-020), so
 * `command.run` never has to know Commander's option-object shape. An option the invocation omitted is
 * simply absent from the record (not present-as-`undefined`), so a core op can distinguish "not given"
 * from an empty string. Returns `undefined` when the command declares no value options (every command
 * before task-020-implement-memory-add), matching `CliCommand.run`'s already-optional `options` param.
 */
function buildOptionValues(
  command: CliCommand,
  options: Record<string, unknown>,
): Readonly<Record<string, string>> | undefined {
  const declared = command.options ?? [];
  if (declared.length === 0) return undefined;
  const optionValues: Record<string, string> = {};
  for (const { name } of declared) {
    const value = options[name];
    if (typeof value === 'string') optionValues[name] = value;
  }
  return optionValues;
}
