/**
 * Lint-clean gate (task-066-fix-eslint-baseline-and-lint-gate, `dl-034`/`bug-009`).
 *
 * Asserts the project's ESLint baseline is green: `npx eslint .` reports zero errors over the whole
 * repository, or this test fails. The check is `eslint.config.js` at the repo root (exposed as the
 * `lint` npm script); this test runs the exact same ESLint invocation out-of-process and requires
 * exit 0. It is the executable half of the `refactor.checks.post` `lint.clean` gate in
 * `dev-loop.yaml` — a real, runnable assertion rather than a sentence in a YAML comment, in the same
 * spirit as `test/docs/api-docs.test.ts` for `docs:api`. Deterministic: ESLint reads a fixed config
 * over a fixed source tree, so the pass/fail verdict is a pure function of the code.
 */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
// Resolve the installed ESLint CLI via its package root so a hoisted install still resolves.
const eslintBin = join(dirname(require.resolve('eslint/package.json')), 'bin', 'eslint.js');

// A full-repo lint takes seconds and competes with the other suites for CPU; give it a wide,
// fixed budget so the gate reports lint status rather than machine load (contrast `bug-011`).
const LINT_TIMEOUT_MS = 120_000;

describe('ESLint baseline (task-066-fix-eslint-baseline-and-lint-gate)', () => {
  it('eslint reports zero errors over the repository', () => {
    let error: unknown;
    try {
      execFileSync(process.execPath, [eslintBin, '.'], {
        cwd: repoRoot,
        stdio: 'pipe',
      });
    } catch (thrown) {
      error = thrown;
    }
    if (error) {
      const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
      const output = `${stdout?.toString() ?? ''}${stderr?.toString() ?? ''}`;
      throw new Error(`eslint lint-clean gate failed:\n${output}`);
    }
    expect(error).toBeUndefined();
  }, LINT_TIMEOUT_MS);
});
