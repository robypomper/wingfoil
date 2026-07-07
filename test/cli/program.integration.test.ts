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
 * The fix here is compile-then-spawn, not import-then-call: the compiled `dist/` (CommonJS output —
 * confirmed by inspecting `dist/cli/program.js`) is built once by jest's `globalSetup`
 * (`test/global-setup.cjs`) before any worker starts, then every test case spawns
 * `test/cli/fixtures/cli-harness.cjs` as a separate `node` process (via `execFileSync`), which
 * `require()`s the COMPILED `dist/cli/program.js` and `dist/core/index.js` and drives `buildProgram`
 * exactly like a real `bin/wingfoil` entrypoint would. That sidesteps the Jest/ESM limitation
 * entirely (the harness never touches `ts-jest`) and gives `program.ts`'s Commander wiring a
 * permanent, real regression guard.
 *
 * Build ownership (bug-003-cli-integration-dist-race): the build lives in `globalSetup`, NOT in this
 * file's `beforeAll`. Previously this suite and `npm-distribution.test.ts` each `rmSync`+rebuilt the
 * same `dist/` in their own `beforeAll`, which raced across parallel jest workers; centralizing the
 * build (once, pre-worker) removed both the race and the redundant second build. This `beforeAll`
 * now only asserts the shared `dist/` is present.
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
import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { load as yamlLoad } from 'js-yaml';

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
    // `dist/` is built once by jest's globalSetup (test/global-setup.cjs) before any worker starts —
    // see bug-003-cli-integration-dist-race for why the per-suite rebuild was removed. Just assert it exists.
    expect(existsSync(join(DIST_DIR, 'cli', 'program.js'))).toBe(true);
  });

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

  it('REQ-INT-05 fit criterion: `--format json` and `--format yaml` parse to the SAME structure, stderr empty (task-013)', () => {
    // Stand-in for the AC's `wingfoil paths` / `wingfoil workflow status` cases; the `paths` case
    // itself is now covered directly below (task-028) — `dna show` still exercises the same shared
    // --format envelope every command inherits, `workflow status` remains its own owning task's job.
    const asJson = runCli('dna', 'show', '--format', 'json');
    const asYaml = runCli('dna', 'show', '--format', 'yaml');

    expect(asJson.status).toBe(0);
    expect(asYaml.status).toBe(0);
    // Both parse with a *standard* parser into a single top-level value...
    const fromJson = JSON.parse(asJson.stdout) as unknown;
    const fromYaml = yamlLoad(asYaml.stdout);
    // ...and that value is identical across the two machine-readable formats.
    expect(fromYaml).toEqual(fromJson);
    // Envelope rule: the structured payload is the only thing on stdout — no diagnostics on stderr.
    expect(asJson.stderr).toBe('');
    expect(asYaml.stderr).toBe('');
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

  it('`dna show team --format json` prints only the "team" subtree (P2.2, task-026)', () => {
    const result = runCli('dna', 'show', 'team', '--format', 'json');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      members: [{ name: 'Test User', roles: ['developer'] }],
      roles: [{ name: 'developer' }],
    });
    expect(result.stderr).toBe('');
  });

  it('`dna show tech_stack --format json` resolves the BDD-compat alias to the "stacks" subtree (P2.2, spec-002, task-026)', () => {
    const full = runCli('dna', 'show', '--format', 'json');
    const aliased = runCli('dna', 'show', 'tech_stack', '--format', 'json');
    expect(aliased.status).toBe(0);
    expect(JSON.parse(aliased.stdout)).toEqual((JSON.parse(full.stdout) as { stacks: unknown }).stacks);
  });

  it('`dna show nonexistent_section` exits 1 with the exact P2.2 error message, never exit 2 (read-only command, task-026)', () => {
    const result = runCli('dna', 'show', 'nonexistent_section');
    expect(result.status).toBe(1);
    expect(result.stderr).toBe("error: no DNA key named 'nonexistent_section'\n");
    expect(result.stdout).toBe('');
  });

  // task-028-implement-paths-category (P2.5, BDD `p2-dna/P2.5-paths.feature`). `paths` is registered
  // as a FLAT command (spec-008-cli-grammar §1: `wingfoil <noun> [args] [flags]`, no verb segment) —
  // these assertions exercise the real `program.ts` flat-command wiring, not just `registrar.ts`'s
  // Commander-independent model (already covered by `test/cli/registrar.test.ts`). The fixture DNA
  // (`test/cli/fixtures/wingfoil-root/.wingfoil/dna.yaml`) maps only `paths.sources: [src/]` — no
  // `governance` — matching the BDD "undefined category" scenario exactly.
  describe('`paths [category]` — flat command (task-028, P2.5)', () => {
    it('`paths sources --list` outputs the mapped entries and exits 0 (BDD "List paths for a category")', () => {
      const result = runCli('paths', 'sources', '--list');
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('src/');
    });

    it('`paths sources --format json` exits 0 and prints spec-005 §4\'s exact worked-example shape', () => {
      const result = runCli('paths', 'sources', '--format', 'json');
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({ category: 'sources', paths: ['src/'] });
      expect(result.stderr).toBe('');
    });

    it('`paths sources --format yaml` exits 0 and prints the same structure as YAML', () => {
      const result = runCli('paths', 'sources', '--format', 'yaml');
      expect(result.status).toBe(0);
      expect(yamlLoad(result.stdout)).toEqual({ category: 'sources', paths: ['src/'] });
      expect(result.stderr).toBe('');
    });

    it('REQ-INT-05 fit criterion (task-013\'s deferred check, delivered here): `--format json`/`--format yaml` parse to the SAME structure for `paths`, stderr empty', () => {
      const asJson = runCli('paths', 'sources', '--format', 'json');
      const asYaml = runCli('paths', 'sources', '--format', 'yaml');

      expect(asJson.status).toBe(0);
      expect(asYaml.status).toBe(0);
      expect(yamlLoad(asYaml.stdout)).toEqual(JSON.parse(asJson.stdout));
      expect(asJson.stderr).toBe('');
      expect(asYaml.stderr).toBe('');
    });

    it('`paths sources` (console, default format) also contains the mapped entry, --list not required for it to appear', () => {
      const result = runCli('paths', 'sources');
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('src/');
    });

    it('`paths governance` (unmapped category) exits 1 with the exact BDD error message (P2.5 "Error - querying an undefined category")', () => {
      const result = runCli('paths', 'governance');
      expect(result.status).toBe(1);
      expect(result.stderr).toBe("error: no paths mapped for category 'governance'\n");
      expect(result.stdout).toBe('');
    });

    it('`paths governance --format json` reports the same error, structured, on stderr', () => {
      const result = runCli('paths', 'governance', '--format', 'json');
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stderr)).toEqual({ error: "no paths mapped for category 'governance'" });
      expect(result.stdout).toBe('');
    });

    it('`paths` with no `category` returns the whole `paths` node and exits 0 — symmetric with `dna show` (no section = full DNA), per task-026\'s shared optional `[positional]` seam', () => {
      // Reconciled onto task-026's generic OPTIONAL `[positional]` (`X_cli-cmds.md`'s `[category]`
      // synopsis is bracketed = optional); an omitted category is not an error, it drills up to the
      // full `paths` map — exit 0, never exit 2 (read-only command, spec-005 §1).
      const result = runCli('paths', '--format', 'json');
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({ sources: ['src/'] });
      expect(result.stderr).toBe('');
    });
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
