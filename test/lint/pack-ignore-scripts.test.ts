/**
 * Repo-hygiene gate — no `npm pack` / `npm publish` in the test suite may run lifecycle scripts
 * (task-075-fix-pack-ignore-scripts, `bug-022`, `dl-056` clause B).
 *
 * `package.json` declares `"prepack": "npm run build"`, so an `npm pack` without `--ignore-scripts`
 * shells out to `tsc -p tsconfig.build.json` and rewrites the shared `dist/` — in place, truncating
 * each file rather than renaming over it — while other jest workers are spawning `node dist/cli.js`
 * from it. Measured: during one such pack, `dist/core/index.js` (final size 70428) is observable at
 * 0 bytes and `dist/validation/secret-scan.js` (final 18152) at 8192; with `--ignore-scripts`, zero
 * such observations. `dist/` is built once before the worker pool exists by jest's `globalSetup`
 * (`test/global-setup.cjs`, added for `bug-003-cli-integration-dist-race`), and a mid-run rebuild is
 * exactly what defeats that.
 *
 * Three of the four pack call sites already carried the flag; `test/cli/npm-distribution.test.ts`
 * did not, and survived three sibling fixes because nothing checked. Hence this gate rather than a
 * fourth header comment alone: the property is "no call site, ever", which only an executable check
 * can hold. It also matters beyond a local flake — `.github/workflows/publish.yml`'s `gate` job runs
 * `npm run prepublishOnly` (`npm run build && npm test && npm run lint`), so the race sits inside the
 * job that guards a tagged release, on a runner whose worker count is its core count (no
 * `maxWorkers` is configured).
 *
 * Deterministic by construction: a sorted directory walk over a fixed source tree and a pure regex
 * scan — no clock, no network, no subprocess. The scan also asserts it found the call sites it
 * expects, so a change in call shape fails the gate loudly instead of making it vacuously true.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const TEST_ROOT = join(__dirname, '..');

/** Node child-process helpers that take `('npm', [args])`. */
const SPAWN_HELPERS = ['execFileSync', 'spawnSync', 'execFile', 'spawn'];

/**
 * Matches `<helper>('npm', [ ...args ])` and captures the argument-array literal. `[^\]]*` spans
 * newlines, so a multi-line argument list is captured whole.
 */
const NPM_CALL = new RegExp(String.raw`\b(?:${SPAWN_HELPERS.join('|')})\(\s*'npm',\s*\[([^\]]*)\]`, 'g');

/** npm subcommands that execute package lifecycle scripts (`prepack`, `prepare`, `prepublishOnly`). */
const LIFECYCLE_SUBCOMMANDS = ['pack', 'publish'];

interface NpmCallSite {
  readonly file: string;
  readonly subcommand: string;
  readonly args: string;
  readonly ignoresScripts: boolean;
}

/** Every `*.ts` file under `test/`, in a stable (sorted, depth-first) order. */
function testSources(dir: string): readonly string[] {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
  const found: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...testSources(full));
    else if (entry.name.endsWith('.ts')) found.push(full);
  }
  return found;
}

/** Scan the suite for `npm pack` / `npm publish` invocations and whether each disables scripts. */
function npmLifecycleCallSites(): readonly NpmCallSite[] {
  const sites: NpmCallSite[] = [];
  for (const file of testSources(TEST_ROOT)) {
    const source = readFileSync(file, 'utf-8');
    for (const match of source.matchAll(NPM_CALL)) {
      const args = match[1] ?? '';
      const subcommand = LIFECYCLE_SUBCOMMANDS.find((cmd) => new RegExp(String.raw`(^|[\s,])'${cmd}'`).test(args));
      if (subcommand === undefined) continue;
      sites.push({
        file: relative(TEST_ROOT, file).split(sep).join('/'),
        subcommand,
        args: args.replace(/\s+/g, ' ').trim(),
        ignoresScripts: args.includes("'--ignore-scripts'"),
      });
    }
  }
  return sites;
}

describe('npm lifecycle scripts in the test suite (task-075-fix-pack-ignore-scripts, bug-022)', () => {
  const sites = npmLifecycleCallSites();

  it('finds the npm pack/publish call sites, so the guard below is not vacuous', () => {
    // Four `npm pack` (cli/npm-distribution, cli/publish-metadata, cli/license-file,
    // core/builtin-directive-templates) + one `npm publish --dry-run` (cli/publish-pipeline).
    expect(sites.length).toBeGreaterThanOrEqual(5);
    expect(sites.map((s) => s.file)).toContain('cli/npm-distribution.test.ts');
    expect(sites.filter((s) => s.subcommand === 'pack').length).toBeGreaterThanOrEqual(4);
  });

  it('runs every one of them with --ignore-scripts, so none rebuilds the shared dist/', () => {
    const offenders = sites
      .filter((s) => !s.ignoresScripts)
      .map((s) => `${s.file}: npm ${s.subcommand} — [${s.args}]`);
    expect(offenders).toEqual([]);
  });
});
