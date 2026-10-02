/**
 * Coverage-parity gate — the coverage report lists every `src/` file `collectCoverageFrom` matches,
 * whether or not a test loads it, so a file no test requires counts at 0% instead of vanishing from
 * the denominator (task-134-report-source-file-coverage-so-untested-file-counts,
 * `bug-141-coverage-omits-unrequired-source-files`).
 *
 * Jest finds the files it reports as uncovered by walking its `roots`. With `roots` limited to
 * `test/`, only the `src/` files the executed tests imported reached the report, and the 80%
 * threshold was computed over whatever the tests happened to load (`bug-141`).
 *
 * How the gate works: it runs a child jest with this repository's own `jest.config.js` and
 * `--coverage`, on one probe suite (`fixtures/coverage-probe.ts`) that loads no source file at all,
 * then compares the keys of the resulting `coverage-summary.json` with the expected list — every
 * `*.ts` file under `src/` minus the barrels `collectCoverageFrom` declares — and fails on any
 * difference in either direction. Because the probe loads nothing, every listed file is one no test
 * required, which is the bug's reproduction inverted, and the key set is the same one a full run
 * reports: what decides it is the configuration, not which suites ran.
 *
 * The child differs from `npm run test:coverage` only where the measurement needs it: `testMatch`
 * selects the probe, `globalSetup` (the `dist/` build) is dropped because the probe spawns no CLI and
 * a second build would race the parent's (`bug-095`), `--maxWorkers=1` keeps the child from adding a
 * worker per core to the parent's run, the threshold is cleared because a run that
 * covers nothing is meant to sit at 0%, and the summary goes to a fresh temporary directory.
 *
 * Deterministic: a sorted file walk, a fixed probe, set comparison on sorted lists — no clock, no
 * network, no dependency on a previous run's `coverage/` directory.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..');
const PROBE = 'test/lint/fixtures/coverage-probe.ts';

interface JestConfig {
  collectCoverageFrom?: string[];
  [key: string]: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const jestConfig = require(join(REPO_ROOT, 'jest.config.js')) as JestConfig;

/** Byte-order comparison, the `LC_ALL=C sort` order — independent of the host's locale. */
function byteOrder(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Every `*.ts` file under `dir`, as repository-relative POSIX paths, sorted. */
function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTs(abs));
    else if (entry.isFile() && entry.name.endsWith('.ts')) out.push(relative(REPO_ROOT, abs).split(sep).join('/'));
  }
  return out.sort(byteOrder);
}

/**
 * The files the report must list: `find src -name '*.ts'` minus the barrels `collectCoverageFrom`
 * excludes. `test/lint/coverage-scope.test.ts` holds every exclusion to a literal path, so a plain
 * set difference is exact.
 */
function expectedFiles(): string[] {
  const excluded = new Set((jestConfig.collectCoverageFrom ?? []).filter((p) => p.startsWith('!')).map((p) => p.slice(1)));
  return walkTs(join(REPO_ROOT, 'src')).filter((f) => !excluded.has(f));
}

/**
 * The difference between the expected file list and a coverage summary's file keys (absolute paths,
 * plus the `total` entry). Both lists come back sorted; equal sets give two empty lists.
 */
function coverageDifference(expected: readonly string[], summaryKeys: readonly string[]): { missing: string[]; unexpected: string[] } {
  const reported = summaryKeys
    .filter((k) => k !== 'total')
    .map((k) => relative(REPO_ROOT, k).split(sep).join('/'))
    .sort(byteOrder);
  const reportedSet = new Set(reported);
  const expectedSet = new Set(expected);
  return {
    missing: expected.filter((f) => !reportedSet.has(f)).sort(byteOrder),
    unexpected: reported.filter((f) => !expectedSet.has(f)),
  };
}

interface FileSummary {
  lines: { covered: number };
  statements: { covered: number };
  functions: { covered: number };
  branches: { covered: number };
}

describe('coverageDifference — the comparison the gate fails on', () => {
  const abs = (f: string): string => join(REPO_ROOT, f);

  it('is empty when the report lists exactly the expected files', () => {
    expect(coverageDifference(['src/a.ts', 'src/b.ts'], ['total', abs('src/b.ts'), abs('src/a.ts')])).toEqual({
      missing: [],
      unexpected: [],
    });
  });

  it('names a source file the report leaves out', () => {
    expect(coverageDifference(['src/a.ts', 'src/b.ts'], ['total', abs('src/a.ts')])).toEqual({
      missing: ['src/b.ts'],
      unexpected: [],
    });
  });

  it('names a reported file outside the expected list (e.g. a declared barrel)', () => {
    expect(coverageDifference(['src/a.ts'], ['total', abs('src/a.ts'), abs('src/x/index.ts')])).toEqual({
      missing: [],
      unexpected: ['src/x/index.ts'],
    });
  });
});

describe('coverage report lists every source file, unloaded ones at 0% (bug-141)', () => {
  let outDir: string;
  let summary: Record<string, FileSummary>;

  beforeAll(() => {
    outDir = mkdtempSync(join(tmpdir(), 'wf-coverage-parity-'));
    const config = {
      ...jestConfig,
      rootDir: REPO_ROOT,
      testMatch: [`<rootDir>/${PROBE}`],
      globalSetup: undefined,
      coverageReporters: ['json-summary'],
      coverageDirectory: outDir,
      coverageThreshold: {},
    };
    execFileSync(
      process.execPath,
      [join(REPO_ROOT, 'node_modules', 'jest', 'bin', 'jest.js'), '--config', JSON.stringify(config), '--coverage', '--ci', '--maxWorkers=1'],
      // `execFileSync` blocks the event loop, so the hook's own timeout could never fire on a hung
      // child: the child is killed inside the hook's budget instead, and the hook fails loudly.
      // `--maxWorkers=1`: the child's coverage reporter transforms the untested files in its own
      // workers, which would otherwise be cores-1 more processes on top of the parent's full run.
      { cwd: REPO_ROOT, stdio: 'pipe', timeout: 170_000, killSignal: 'SIGKILL' },
    );
    summary = JSON.parse(readFileSync(join(outDir, 'coverage-summary.json'), 'utf8')) as Record<string, FileSummary>;
  }, 180_000);

  afterAll(() => {
    if (outDir !== undefined) rmSync(outDir, { recursive: true, force: true });
  });

  it('expects a non-trivial list, so an empty walk cannot pass', () => {
    expect(expectedFiles().length).toBeGreaterThan(0);
  });

  it('lists exactly find src -name "*.ts" minus the declared barrels', () => {
    expect(coverageDifference(expectedFiles(), Object.keys(summary))).toEqual({ missing: [], unexpected: [] });
  });

  it('reports every file at 0%, because the probe loads none of them', () => {
    const covered = Object.entries(summary)
      .filter(([k]) => k !== 'total')
      .filter(([, s]) => s.lines.covered + s.statements.covered + s.functions.covered + s.branches.covered > 0)
      .map(([k]) => relative(REPO_ROOT, k));
    expect(covered).toEqual([]);
  });
});
