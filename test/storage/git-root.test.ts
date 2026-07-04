/**
 * task-003-git-backed-sot — git-root detection (spec-011-storage-layout, "Git-root detection
 * algorithm"). WingFoil must be invoked at the exact git root: `findGitRoot` walks up looking only
 * for `.git`, and `resolveProjectRoot` layers the "must be cwd itself" rule on top.
 */
import { mkdirSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { StorageError } from '../../src/storage/errors';
import { findGitRoot, resolveProjectRoot } from '../../src/storage/git-root';
import { makeTempGitRepo, removeTempDir } from './helpers/git-fixture';

describe('findGitRoot', () => {
  let repo: string;

  afterEach(() => removeTempDir(repo));

  it('finds the repo root when cwd already is the root', () => {
    repo = makeTempGitRepo();
    expect(findGitRoot(repo)).toBe(repo);
  });

  it('walks up from a nested subdirectory to find the root', () => {
    repo = makeTempGitRepo();
    const nested = join(repo, 'docs', 'self', '.wingfoil');
    mkdirSync(nested, { recursive: true });
    expect(findGitRoot(nested)).toBe(repo);
  });

  it('returns null when no ancestor directory contains .git', () => {
    // A plain temp dir outside any git repository (os.tmpdir() is not itself git-tracked).
    repo = mkdtempSync(join(tmpdir(), 'wf-no-git-'));
    expect(findGitRoot(repo)).toBeNull();
  });
});

describe('resolveProjectRoot', () => {
  let repo: string;

  afterEach(() => removeTempDir(repo));

  it('returns the root when invoked from the root itself', () => {
    repo = makeTempGitRepo();
    expect(resolveProjectRoot(repo)).toBe(repo);
  });

  it('throws E_NOT_AT_GIT_ROOT when invoked from a subdirectory of the root', () => {
    repo = makeTempGitRepo();
    const nested = join(repo, 'sub');
    mkdirSync(nested, { recursive: true });
    let thrown: unknown;
    try {
      resolveProjectRoot(nested);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(StorageError);
    expect((thrown as StorageError).code).toBe('E_NOT_AT_GIT_ROOT');
  });

  it('throws E_NO_GIT_ROOT when not inside a git repository at all', () => {
    repo = mkdtempSync(join(tmpdir(), 'wf-no-git-'));
    let thrown: unknown;
    try {
      resolveProjectRoot(repo);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(StorageError);
    expect((thrown as StorageError).code).toBe('E_NO_GIT_ROOT');
  });
});
