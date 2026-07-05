/**
 * task-007-npm-distribution (REQ-SYS-09) — packaging acceptance tests.
 *
 * The AC (SARD fit criterion, `docs/02_requirements/03_sard/01_architecture.md`) is: `npm install -g
 * wingfoil` resolves the `wingfoil` binary on `PATH`, `wingfoil --help` exits `0`, and the published
 * package includes `README.md` + command docs (not just compiled JS). A real global install isn't
 * practical to exercise in CI, so — mirroring `test/cli/program.integration.test.ts`'s
 * compile-then-spawn pattern — this file:
 *
 * 1. Builds the real `dist/` (a clean `tsc -p tsconfig.build.json`) and spawns the compiled `bin`
 *    entrypoint (`dist/cli.js`, mapped from `package.json`'s `"bin"` field) directly with `node`,
 *    asserting the real process exit code / stdout, exactly as npm's bin-shim would invoke it.
 * 2. Runs `npm pack --dry-run --json` — the same file-selection logic `npm publish` uses — and
 *    asserts the resulting tarball file list includes the compiled `dist/` output and `README.md`,
 *    and excludes the dogfooding `docs/self/.wingfoil/` config (spec-011: project-local, not part of
 *    the shipped artifact) and the `test/` tree (source-only, not runtime).
 *
 * This file performs its own clean build in `beforeAll` rather than sharing `dist/` with
 * `program.integration.test.ts`'s build — Jest test files are independent units and a shared,
 * possibly-stale `dist/` between them would trade correctness for a modest speedup; see that file's
 * own header comment for the same build-cost tradeoff already accepted there.
 */
import { execFileSync, execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '..', '..');
const DIST_DIR = join(REPO_ROOT, 'dist');
const BIN_ENTRY = join(DIST_DIR, 'cli.js');

interface PackedFile {
  readonly path: string;
}

interface PackResult {
  readonly files: readonly PackedFile[];
}

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

/** Spawn the compiled bin entrypoint and capture its real exit code/stdout/stderr. */
function runBin(...args: readonly string[]): CliResult {
  try {
    const stdout = execFileSync('node', [BIN_ENTRY, ...args], { cwd: REPO_ROOT, encoding: 'utf-8' });
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

describe('npm distribution (task-007) — bin entrypoint + package contents', () => {
  beforeAll(() => {
    // A clean build so a stale `dist/` from an earlier run can never hide a broken bin entrypoint.
    rmSync(DIST_DIR, { recursive: true, force: true });
    execSync('npx tsc -p tsconfig.build.json', { cwd: REPO_ROOT, stdio: 'pipe' });
  }, 120_000);

  it('compiles a `dist/cli.js` bin entrypoint', () => {
    expect(existsSync(BIN_ENTRY)).toBe(true);
  });

  it('`node dist/cli.js --help` exits 0 and prints usage', () => {
    const result = runBin('--help');
    expect(result.status).toBe(0);
    expect(result.stdout.toLowerCase()).toContain('wingfoil');
    expect(result.stderr).toBe('');
  });

  it('`npm pack --dry-run --json` includes the compiled dist/ bin + README.md, and excludes docs/self/.wingfoil + test/', () => {
    const raw = execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: REPO_ROOT, encoding: 'utf-8' });
    const [result] = JSON.parse(raw) as PackResult[];
    const paths = (result?.files ?? []).map((f) => f.path);

    expect(paths).toContain('dist/cli.js');
    expect(paths).toContain('README.md');

    expect(paths.some((p) => p.startsWith('docs/self/.wingfoil'))).toBe(false);
    expect(paths.some((p) => p.startsWith('test/'))).toBe(false);
  });
});
