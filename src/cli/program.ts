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
// Type-only; commander is ESM-only, hence the explicit resolution-mode attribute — see module doc above.
import type { Command } from 'commander' with { 'resolution-mode': 'import' };

import type { CoreModule } from '../core/registry';

import { buildCliCommands, type BuildCommandsOptions } from './registrar';

export async function buildProgram(modules: readonly CoreModule[], options: BuildCommandsOptions): Promise<Command> {
  const { Command: CommandCtor } = await import('commander');
  const program = new CommandCtor('wingfoil');
  program
    .option('--format <format>', 'output format (console|json|yaml)', 'console')
    .option('--verbose', 'emit diagnostic logs to stderr')
    .option('--no-color', 'disable ANSI colors')
    .option('--no-interactive', 'fail on missing args instead of prompting');

  const nounCommands = new Map<string, Command>();
  for (const command of buildCliCommands(modules, options)) {
    let nounCommand = nounCommands.get(command.noun);
    if (!nounCommand) {
      nounCommand = program.command(command.noun);
      nounCommands.set(command.noun, nounCommand);
    }
    nounCommand.command(command.verb).action(async () => {
      const globalOpts = program.opts<{ format: string }>();
      await command.run(globalOpts.format);
    });
  }

  return program;
}
