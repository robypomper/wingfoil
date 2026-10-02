/**
 * A positional `--help` calls required IS required, and one it calls optional is not
 * (task-120-subcommand-help-describes-every-command AC 2, `bug-128`: "The positional is documented as
 * optional even where it is required (`memory approve` without it exits `2`)").
 *
 * `CorePositional.required` is declarative — `src/cli/program.ts` renders it and never asks
 * Commander to enforce it — so nothing but this suite stops the synopsis from drifting away from what
 * the command does. Each derived command is driven through the COMPILED CLI (`dist/`, built once by
 * jest's globalSetup) against the static fixture root, with its positional omitted:
 *
 * - declared required → exit `2`, and the `error:` line names the same `<name>` the synopsis shows;
 * - declared optional → never the usage exit `2`: the command gets past argument checking.
 *
 * This suite used to pin, in a second half, task-120's AC 4 (no parsing change): a read-only command
 * declaring no positional still accepted an extra operand. That acceptance was `bug-131`, and
 * task-129 turned it into a refusal at exit `2` for every command; the refusal is pinned by
 * `./extra-operand-refusal.integration.test.ts`, so the half that asserted the opposite is gone.
 *
 * Every invocation either refuses before touching the project or only reads it, so the shared fixture
 * root is never written.
 */
import { existsSync } from 'fs';
import { join } from 'path';

import { CORE_MODULES } from '../../src/core';
import { deriveVerb, enumerateOperations } from '../../src/core/registry';
import { CLI_FIXTURE_ROOT, DIST_DIR, runCliHarness, type SpawnedRun } from './helpers/spawn-cli';

function runCli(args: readonly string[]): SpawnedRun {
  return runCliHarness(CLI_FIXTURE_ROOT, args);
}

const COMMANDS = enumerateOperations(CORE_MODULES).map(({ module, operation }) => {
  const verb = deriveVerb(module.name, operation.name);
  return { args: verb ? [module.name, verb] : [module.name], operation };
});
const WITH_POSITIONAL = COMMANDS.filter(({ operation }) => operation.positional !== undefined);

beforeAll(() => {
  expect(existsSync(join(DIST_DIR, 'cli', 'program.js'))).toBe(true);
});

describe('the declared required-ness of each positional matches what the command does', () => {
  it('declares a positional on every command that reads one (guard against a vacuous sweep)', () => {
    // memory submit/approve/reject/deprecate/history/search, dna show/set/add/update/remove, paths, directive remove.
    expect(WITH_POSITIONAL.length).toBeGreaterThanOrEqual(13);
  });

  it.each(WITH_POSITIONAL.map(({ args, operation }) => [args.join(' '), args, operation.positional!] as const))(
    '`wingfoil %s` without its positional',
    (_label, args, positional) => {
      const result = runCli(args);
      if (positional.required === true) {
        expect(result.status).toBe(2);
        expect(result.stderr).toContain(`<${positional.name}>`);
      } else {
        expect(result.status).not.toBe(2);
      }
    },
  );
});
