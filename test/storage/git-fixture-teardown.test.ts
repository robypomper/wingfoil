/**
 * Regression guard for `bug-058-fixture-teardown-enotempty-flake-under-load` (task-082).
 *
 * `removeTempDir` is fixture teardown, called from 156 sites across 50 test files. It must never be
 * able to fail a test whose assertions have already passed — the observed failure was
 * `ENOTEMPTY: directory not empty, rmdir` on a fixture's `.git`, thrown out of an unguarded
 * `rmSync(dir, { recursive: true, force: true })`.
 *
 * The flake itself cannot be scheduled, so the acceptance evidence here is a **simulated** failure
 * (a stubbed `rmSync` that throws the real error codes), not an attempt to reproduce a race. The
 * concurrent-writer test below is a second, weaker demonstration against a genuinely busy directory.
 */
import * as fs from 'fs';
import { execFileSync, spawn } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { makeTempGitRepo, removeTempDir } from './helpers/git-fixture';

// `fs.rmSync` is a non-configurable property on Node 22, so `jest.spyOn(fs, 'rmSync')` throws
// "Cannot redefine property". Mock the module instead, wrapping the real implementation so every
// other `fs` call in this suite (and in the fixture helper) keeps its genuine behaviour, and only
// `rmSync` is steerable per test.
jest.mock('fs', () => {
  const actual = jest.requireActual<typeof import('fs')>('fs');
  return { ...actual, rmSync: jest.fn(actual.rmSync) };
});

const mockedRmSync = fs.rmSync as jest.MockedFunction<typeof fs.rmSync>;

/** Build a throwaway directory shaped like a fixture repo (a `.git` with many entries). */
function makeFixtureShapedDir(entries = 50): string {
  const dir = mkdtempSync(join(tmpdir(), 'wf-teardown-test-'));
  const git = join(dir, '.git');
  mkdirSync(git, { recursive: true });
  for (let i = 0; i < entries; i += 1) writeFileSync(join(git, `o${i}`), 'x');
  return dir;
}

/** An `Error` carrying a POSIX `code`, the shape `fs` throws. */
function errnoError(code: string, path: string): Error & { code: string } {
  const error = new Error(`${code}: directory not empty, rmdir '${path}'`) as Error & { code: string };
  error.code = code;
  return error;
}

describe('removeTempDir — teardown must never fail a passing test (bug-058)', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockedRmSync.mockClear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  // AC1 + AC3 — red-first. Against the pre-fix helper this test fails: the stubbed ENOTEMPTY
  // propagates straight out of removeTempDir.
  it('does not propagate ENOTEMPTY from a directory that is still being written into', () => {
    const dir = makeFixtureShapedDir();
    mockedRmSync.mockImplementationOnce(() => {
      throw errnoError('ENOTEMPTY', join(dir, '.git'));
    });

    expect(() => removeTempDir(dir)).not.toThrow();
    expect(mockedRmSync).toHaveBeenCalled();

    rmSync(dir, { recursive: true, force: true });
  });

  // AC1 — EBUSY is the sibling failure on the same mechanism and must be swallowed too.
  it('does not propagate EBUSY either', () => {
    const dir = makeFixtureShapedDir();
    mockedRmSync.mockImplementationOnce(() => {
      throw errnoError('EBUSY', join(dir, '.git'));
    });

    expect(() => removeTempDir(dir)).not.toThrow();

    rmSync(dir, { recursive: true, force: true });
  });

  // AC4 — red-first. Swallowing is only acceptable if the leftover path stays visible, otherwise a
  // /tmp leak accumulates silently across a 156-call-site suite.
  it('reports the leftover path on console.warn when removal fails', () => {
    const dir = makeFixtureShapedDir();
    mockedRmSync.mockImplementationOnce(() => {
      throw errnoError('ENOTEMPTY', join(dir, '.git'));
    });

    removeTempDir(dir);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = String(warnSpy.mock.calls[0][0]);
    expect(message).toContain(dir);
    expect(message).toContain('ENOTEMPTY');

    rmSync(dir, { recursive: true, force: true });
  });

  // Characterization — the happy path must be untouched: the directory really is removed, and a
  // successful removal stays silent (no warning noise at 156 call sites).
  it('still removes the directory, silently, when nothing is in the way', () => {
    const dir = makeFixtureShapedDir();

    removeTempDir(dir);

    expect(existsSync(dir)).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // Characterization — `force: true` already covers a missing path; keep that contract.
  it('is a no-op on a path that does not exist', () => {
    const dir = join(tmpdir(), 'wf-teardown-test-definitely-absent-982374');

    expect(() => removeTempDir(dir)).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // AC3 — the "being written into concurrently" variant, against a real background writer rather
  // than a stub. Weaker than the stubbed tests (the writer does not always win the race, and this
  // test passes either way), so it corroborates rather than proves; the stubbed tests above are the
  // actual guard.
  //
  // The writer is bounded by an iteration count rather than by a deadline, and the parent kills it
  // in `finally` regardless: `test/core/latency-budget-placement.test.ts` (bug-011) forbids any test
  // file from both spawning a child and reading the wall clock, and that rule is textual and
  // deliberately strict. Nothing here is being timed, so there is no reason to reach for a clock.
  it('survives a directory being written into concurrently by another process', () => {
    const dir = makeFixtureShapedDir(500);
    const git = join(dir, '.git');
    const writer = spawn(
      process.execPath,
      [
        '-e',
        `const {writeFileSync,mkdirSync}=require('fs');
         const g=${JSON.stringify(git)};
         for(let n=0;n<200000;n++){
           try{ mkdirSync(g,{recursive:true}); }catch(e){}
           try{ writeFileSync(g+'/index.lock.'+n,'x'); }catch(e){}
         }`,
      ],
      { stdio: 'ignore', detached: true },
    );
    writer.unref();

    try {
      expect(() => removeTempDir(dir)).not.toThrow();
    } finally {
      try {
        process.kill(-writer.pid!, 'SIGKILL');
      } catch {
        /* writer already exited */
      }
      rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 20 });
    }
  });
});

describe('git-fixture — the race is closed at the source where it can be (bug-058 AC2)', () => {
  // AC2 characterization — every git child the fixture spawns is awaited by construction, because
  // `execFileSync` does not return until the child exits. This pins that fact so a later
  // `spawn`/`exec` cannot silently reintroduce an unawaited writer.
  it('spawns git only through the synchronous execFileSync', () => {
    const source = readFileSync(join(__dirname, 'helpers', 'git-fixture.ts'), 'utf-8');

    expect(source).toContain('execFileSync');
    for (const asyncApi of ['spawn(', 'exec(', 'execFile(', 'fork(', 'spawnSync(']) {
      expect(source).not.toContain(asyncApi);
    }
  });

  // AC2 — the one detached writer git can still leave is auto-maintenance: `gc.autoDetach` defaults
  // to true, so an auto-gc would outlive the `execFileSync` that triggered it and keep writing
  // `.git`. It does not fire at today's fixture sizes (1,002 loose objects vs the 6,700 default
  // threshold), but nothing pins the fixtures below that threshold, so it is disabled outright.
  it('disables git auto-gc in every fixture repo, so no detached gc can outlive the fixture', () => {
    const repo = makeTempGitRepo();
    try {
      const autoGc = execFileSync('git', ['config', '--get', 'gc.auto'], {
        cwd: repo,
        encoding: 'utf-8',
      }).trim();

      expect(autoGc).toBe('0');
    } finally {
      removeTempDir(repo);
    }
  });
});
