/**
 * Integration smoke test for `src/cli/program.ts` — the real `commander` wiring — following up on
 * task-006-dual-interface-shared-core. `program.ts`'s own module doc explains why no automated test
 * can import it directly: `commander` v15 is ESM-only, and this project's `ts-jest` test runtime is
 * CommonJS, so a static `require()`/`import` of anything that transitively pulls in `commander`
 * crashes at Jest-test runtime even though the exact same code works under real Node (which supports
 * `import(ESM)` from a CJS module, i.e. the `await import('commander')` inside `buildProgram`).
 * `test/cli/registrar.test.ts` already covers 100% of the AC-relevant dispatch behavior
 * (Commander-independent); what was NOT covered by any automated test was `program.ts`'s own thin
 * mechanical wiring — registering global flags, deriving one `Command` per `{noun, verb}`, forwarding
 * to `command.run` — the exact thing task-006's reviewer verified by hand instead of by test.
 *
 * The fix here is compile-then-spawn, not import-then-call: `beforeAll` runs a real
 * `tsc -p tsconfig.build.json` build to produce `dist/` (CommonJS output — confirmed by inspecting
 * `dist/cli/program.js`), then every test case spawns `test/cli/fixtures/cli-harness.cjs` as a
 * separate `node` process (via `execFileSync`), which `require()`s the COMPILED `dist/cli/program.js`
 * and `dist/core/index.js` and drives `buildProgram` exactly like a real `bin/wingfoil` entrypoint
 * would. That sidesteps the Jest/ESM limitation entirely (the harness never touches `ts-jest`) and
 * gives `program.ts`'s Commander wiring a permanent, real regression guard.
 *
 * Build-cost tradeoff (intentional, per task instructions): this test triggers a full project
 * `tsc` build once per `npx jest` run, in `beforeAll`, which is slower than the rest of the suite
 * combined. That is accepted for now — `program.ts` has no other automated guard at all — but if
 * `npx jest` start-up cost becomes a problem later, the natural fix is a `pretest`/CI-level build
 * step and having this file skip rebuilding when `dist/` is already fresh, not deleting the test.
 *
 * The fixture `.wingfoil` config lives at `test/cli/fixtures/wingfoil-root/` — a small, static,
 * committed config (not the evolving `docs/self/.wingfoil/` one), so this test's assertions never
 * drift out from under it as the real project config changes.
 *
 * Every exit code / message asserted below was confirmed by running the harness by hand against the
 * compiled `dist/` before writing the assertion (see this task's Execution Notes) — not guessed from
 * `docs/self/docs/04_memory/design/specs/spec-008-cli-grammar.md`. Notably, spec-008 §1 describes an
 * *aspirational* `E_UNKNOWN_COMMAND` -> exit `2` for an unknown command/verb; `program.ts` does not
 * implement that yet (it is a thin Commander wrapper with no custom `unknownCommand` handling), so an
 * unknown command actually exits `1` today — Commander's own built-in default
 * (`Command.unknownCommand()` -> `this.error(message, { code: 'commander.unknownCommand' })`, which
 * defaults `exitCode` to `1` absent an explicit override). This test asserts the real, current
 * behavior; if a future task implements spec-008's full grammar (closest-match suggestion, exit `2`),
 * update this test alongside that change.
 */
import { execFileSync, execSync } from 'child_process';
import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '..', '..');
const DIST_DIR = join(REPO_ROOT, 'dist');
const HARNESS = join(__dirname, 'fixtures', 'cli-harness.cjs');
const FIXTURE_ROOT = join(__dirname, 'fixtures', 'wingfoil-root');
const PKG_VERSION = (JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as { version: string }).version;

interface CliResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface ExecFileSyncError {
  readonly status: number | null;
  readonly stdout: Buffer | string;
  readonly stderr: Buffer | string;
}

function isExecFileSyncError(error: unknown): error is ExecFileSyncError {
  return typeof error === 'object' && error !== null && 'status' in error && 'stdout' in error && 'stderr' in error;
}

/** Spawn the real, compiled CLI wiring as a subprocess and capture its real exit code/stdout/stderr. */
function runCli(...args: readonly string[]): CliResult {
  try {
    const stdout = execFileSync('node', [HARNESS, DIST_DIR, FIXTURE_ROOT, ...args], { encoding: 'utf-8' });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    if (!isExecFileSyncError(error)) throw error;
    return {
      status: error.status ?? 1,
      stdout: error.stdout.toString(),
      stderr: error.stderr.toString(),
    };
  }
}

describe('program.ts — real commander wiring (compiled + spawned, out-of-process)', () => {
  beforeAll(() => {
    // A clean build so a broken `program.ts` can never hide behind a stale `dist/` from a previous run.
    rmSync(DIST_DIR, { recursive: true, force: true });
    execSync('npx tsc -p tsconfig.build.json', { cwd: REPO_ROOT, stdio: 'pipe' });
    expect(existsSync(join(DIST_DIR, 'cli', 'program.js'))).toBe(true);
  }, 120_000);

  it('`--version` prints the package.json version to stdout and exits 0 (bug-001)', () => {
    const result = runCli('--version');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(PKG_VERSION);
    expect(result.stderr).toBe('');
  });

  it('`dna show --format json` exits 0 and prints the fixture DnaYaml as compact JSON on stdout', () => {
    const result = runCli('dna', 'show', '--format', 'json');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      version: 1.1,
      modules: [{ name: 'core', path: 'src/core' }],
    });
    expect(result.stderr).toBe('');
  });

  it('`dna show --format yaml` exits 0 and prints the same value as YAML on stdout', () => {
    const result = runCli('dna', 'show', '--format', 'yaml');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('version: 1.1');
    expect(result.stdout).toContain('name: core');
  });

  it('a global flag placed BEFORE the noun/verb (`--format json dna show`) is honored the same way', () => {
    const result = runCli('--format', 'json', 'dna', 'show');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ version: 1.1 });
  });

  it('a global flag placed AFTER the noun/verb (`dna show --format json`) is honored the same way', () => {
    const result = runCli('dna', 'show', '--format', 'json');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ version: 1.1 });
  });

  it('`directives list --format json` exits 0 and lists the one fixture directive', () => {
    const result = runCli('directives', 'list', '--format', 'json');
    expect(result.status).toBe(0);
    const value = JSON.parse(result.stdout) as Array<{ frontmatter: { id: string } }>;
    expect(value).toHaveLength(1);
    expect(value[0]?.frontmatter.id).toBe('sample');
  });

  it('`workflow list --format json` exits 0 and includes the one fixture `main` workflow', () => {
    const result = runCli('workflow', 'list', '--format', 'json');
    expect(result.status).toBe(0);
    const value = JSON.parse(result.stdout) as { workflows: Array<{ name: string; kind: string }> };
    expect(value.workflows).toEqual([expect.objectContaining({ name: 'main', kind: 'main' })]);
  });

  it('an invalid --format value exits 2 with the usage-error message on stderr, never touching stdout', () => {
    const result = runCli('dna', 'show', '--format', 'xml');
    expect(result.status).toBe(2);
    expect(result.stderr).toBe('error: invalid --format value "xml", expected one of: console, json, yaml\n');
    expect(result.stdout).toBe('');
  });

  it('an unknown noun exits 1 with commander\'s own "unknown command" message on stderr (see header comment: spec-008\'s exit-2 grammar is not implemented by program.ts yet)', () => {
    const result = runCli('bogus', 'verb');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unknown command 'bogus'");
  });

  it('an unknown verb under a known noun also exits 1 the same way', () => {
    const result = runCli('dna', 'bogus');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unknown command 'bogus'");
  });
});
