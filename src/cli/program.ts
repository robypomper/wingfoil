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
 * runtime (Node 22's ESM-aware module loader). It is simply never exercised by an automated test in
 * this task — any test importing this file would still hit the same Jest-runtime wall — so this
 * file's own wiring (a handful of mechanical lines: construct global flags, register a noun/verb
 * `Command` per `CliCommand`, forward to `command.run`) is verified manually, not by `npx jest`.
 * `buildCliCommands`/`listRegisteredCliCommands` (`./registrar.ts`) carry 100% of the AC-relevant,
 * unit-tested behavior; this file adds no logic of its own beyond Commander's own API calls.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Type-only; commander is ESM-only, hence the explicit resolution-mode attribute — see module doc above.
import type { Command } from 'commander' with { 'resolution-mode': 'import' };

import type { CoreModule } from '../core/registry';

import { buildCliCommands, type BuildCommandsOptions, type CliCommand } from './registrar';

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

  const nounCommands = new Map<string, Command>();
  for (const command of buildCliCommands(modules, options)) {
    // A flat, no-verb command (`command.verb === ''` — `deriveVerb`'s self-named-operation case,
    // spec-008-cli-grammar §1's `wingfoil <noun> [args] [flags]` form, e.g. `wingfoil paths
    // [category]` — task-028-implement-paths-category) registers directly on the noun `Command`
    // itself; every other (`<noun> <verb>`) command keeps nesting under it exactly as before.
    const target: Command = command.verb
      ? (() => {
          let nounCommand = nounCommands.get(command.noun);
          if (!nounCommand) {
            nounCommand = program.command(command.noun);
            nounCommands.set(command.noun, nounCommand);
          }
          return nounCommand.command(command.verb);
        })()
      : program.command(command.noun);

    // A single optional bare positional (task-026-implement-dna-show's generic seam,
    // `../core/registry.ts`'s `ParamsContext.positional`) — registered on every command regardless
    // of whether its operation reads it (harmless if ignored), so `dna show [section]` and
    // `paths [category]` share ONE positional mechanism. Plus this command's own `--{flag}` options
    // (task-028-implement-paths-category's `CoreOperation.flags`, e.g. `paths`'s `--list`): Commander
    // rejects an unknown option, so each declared flag must be registered explicitly.
    target.argument('[positional]', 'optional positional argument (e.g. a section/category name)');
    for (const name of command.flags ?? []) {
      target.option(`--${name}`, `${name} flag`);
    }

    // Commander's action callback for a `[positional]` + options command is `(positionalValue,
    // optionsObject, commandObject)`. Forward the positional as-is (task-026) and collapse this
    // command's declared flags into a `{ name: boolean }` record (task-028) for `command.run`.
    target.action(async (positional: string | undefined, options: Record<string, unknown> = {}) => {
      const globalOpts = program.opts<{ format: string }>();
      await command.run(globalOpts.format, positional, buildFlagValues(command, options));
    });
  }

  return program;
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
