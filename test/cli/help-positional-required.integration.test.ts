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
 * The second half pins AC 4 (no parsing change) for the commands that declare NO positional: an extra
 * operand was accepted before task-120 (every derived command registered a variadic list) and still
 * is — Commander's own "too many arguments" refusal must not appear on a derived command.
 *
 * Every invocation either refuses before touching the project or only reads it, so the shared fixture
 * root is never written.
 */
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

import { CORE_MODULES } from '../../src/core';
import { deriveVerb, enumerateOperations } from '../../src/core/registry';

const REPO_ROOT = join(__dirname, '..', '..');
const DIST_DIR = join(REPO_ROOT, 'dist');
const HARNESS = join(__dirname, 'fixtures', 'cli-harness.cjs');
const FIXTURE_ROOT = join(__dirname, 'fixtures', 'wingfoil-root');

interface CliResult {
  readonly status: number;
  readonly stderr: string;
}

function runCli(args: readonly string[]): CliResult {
  try {
    execFileSync('node', [HARNESS, DIST_DIR, FIXTURE_ROOT, ...args], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { status: 0, stderr: '' };
  } catch (error) {
    const failed = error as { status: number | null; stderr: Buffer | string };
    return { status: failed.status ?? 1, stderr: failed.stderr.toString() };
  }
}

const COMMANDS = enumerateOperations(CORE_MODULES).map(({ module, operation }) => {
  const verb = deriveVerb(module.name, operation.name);
  return { args: verb ? [module.name, verb] : [module.name], operation };
});
const WITH_POSITIONAL = COMMANDS.filter(({ operation }) => operation.positional !== undefined);
const WITHOUT_POSITIONAL = COMMANDS.filter(({ operation }) => operation.positional === undefined && operation.mutates === false);

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

describe('AC 4 — a read-only derived command that declares no positional still accepts an extra operand', () => {
  it.each(WITHOUT_POSITIONAL.map(({ args }) => [args.join(' '), args] as const))('`wingfoil %s extra`', (_label, args) => {
    const result = runCli([...args, 'extra']);
    expect(result.stderr).not.toContain('too many arguments');
    expect(result.status).not.toBe(2);
  });
});
