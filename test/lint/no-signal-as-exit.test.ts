/**
 * Test-hygiene gate — no `test/` file turns a child killed by a signal into an exit code
 * (`bug-197-ten-cli-suites-keep-local-spawn-helpers-several-reading-a-killed-child-as-exit-1`,
 * task-152).
 *
 * `spawnSync` reports `status: null` when the child ended on a signal rather than an exit. Local
 * spawn helpers coalesced that to a number — `status: run.status ?? 1` — so a crashed or killed child
 * read back as an ordinary exit 1 and could pass a `toBe(1)` assertion meant for a refusal. The shared
 * helper `test/cli/helpers/spawn-cli.ts` (`spawnCapture`, task-145) throws on a signal instead, and
 * every suite that coalesced now spawns through it. This gate fails, with the file and line, on any
 * `status ??` or `status ||` in a test source — TypeScript, and the JavaScript harnesses and jest
 * hooks under `test/` (`.js`, `.cjs`, `.mjs`), which spawn children too — so the coalescing cannot
 * come back.
 *
 * Textual, and deliberately strict: it reads lines, so either form in a comment or string is flagged
 * too. Deterministic: a sorted walk over a fixed source tree, no clock, no subprocess.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const TEST_ROOT = join(__dirname, '..');

/** A `status` coalesced with `??` or `||` — the shapes that turn a signal into an exit code. */
const SIGNAL_AS_EXIT = /\bstatus\s*(\?\?|\|\|)/;

/** The extensions walked: TypeScript suites and helpers, and the JavaScript harnesses and jest hooks. */
const SOURCE_EXTENSIONS = ['.ts', '.js', '.cjs', '.mjs'];

/** Every TypeScript or JavaScript file under `test/`, in a stable (sorted, depth-first) order. */
function testSources(dir: string): readonly string[] {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
  const found: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...testSources(full));
    else if (SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) found.push(full);
  }
  return found;
}

/** `path:line` for every line of `source` that coalesces a `status`. */
function offenders(path: string, source: string): readonly string[] {
  return source
    .split('\n')
    .flatMap((line, index) => (SIGNAL_AS_EXIT.test(line) ? [`${path}:${index + 1}`] : []));
}

describe('no test source reads a signal-killed child as an exit code (bug-197)', () => {
  it('no `status ??` or `status ||` remains under test/', () => {
    const self = relative(TEST_ROOT, __filename);
    const found = testSources(TEST_ROOT)
      .map((file) => relative(TEST_ROOT, file).split(sep).join('/'))
      .filter((file) => file !== self.split(sep).join('/'))
      .flatMap((file) => offenders(file, readFileSync(join(TEST_ROOT, file), 'utf-8')));

    expect(found).toEqual([]);
  });

  it('can fail: flags the coalescing shape, and not a status read as-is', () => {
    expect(offenders('x.ts', 'return { status: run.status ?? 1, stdout };')).toEqual(['x.ts:1']);
    expect(offenders('x.ts', 'const s = run.status??0;')).toEqual(['x.ts:1']);
    expect(offenders('x.ts', 'return { status: run.status, stdout };')).toEqual([]);
  });

  it('can fail: flags the `||` form of the same coalescing', () => {
    expect(offenders('x.ts', 'return { status: run.status || 1, stdout };')).toEqual(['x.ts:1']);
    expect(offenders('x.ts', 'const s = run.status||0;')).toEqual(['x.ts:1']);
  });

  it('walks the JavaScript test sources too (harnesses and jest hooks spawn children)', () => {
    const walked = testSources(TEST_ROOT).map((file) => relative(TEST_ROOT, file).split(sep).join('/'));

    expect(walked).toEqual(expect.arrayContaining(['cli/fixtures/cli-harness.cjs', 'global-setup.cjs']));
  });
});
