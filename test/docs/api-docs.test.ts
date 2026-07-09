/**
 * API-documentation coverage gate (task-062-typedoc-tsdoc-backfill, `dl-013`/`dl-014`).
 *
 * Asserts the project's TypeDoc doc-coverage check builds clean: every exported declaration in `src/`
 * carries a TSDoc comment, or the build fails. The check is `typedoc.json` at the repo root
 * (`validation.notDocumented: true` + `treatWarningsAsErrors: true`, exposed as the `docs:api` npm
 * script); this test runs the exact same TypeDoc invocation out-of-process and requires exit 0. It is
 * the executable half of the `refactor.checks.post` `docs.api.*` gate in `dev-loop.yaml` — a real,
 * runnable coverage assertion, not a stub. Deterministic: TypeDoc reads a fixed config over a fixed
 * source tree with sources/readme disabled, so the pass/fail verdict is a pure function of the code.
 */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
// Resolve the installed TypeDoc CLI via its package root so a hoisted install still resolves.
const typedocBin = join(dirname(require.resolve('typedoc/package.json')), 'bin', 'typedoc');

describe('API documentation coverage (task-062-typedoc-tsdoc-backfill)', () => {
  it('TypeDoc builds clean — every exported declaration in src/ is documented', () => {
    let error: unknown;
    try {
      execFileSync(process.execPath, [typedocBin, '--options', 'typedoc.json'], {
        cwd: repoRoot,
        stdio: 'pipe',
      });
    } catch (thrown) {
      error = thrown;
    }
    if (error) {
      const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
      const output = `${stdout?.toString() ?? ''}${stderr?.toString() ?? ''}`;
      throw new Error(`typedoc doc-coverage gate failed:\n${output}`);
    }
    expect(error).toBeUndefined();
  });
});
