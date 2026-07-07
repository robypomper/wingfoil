/**
 * task-018-implement-git-backed-storage (P1.1, REQ-SYS-01) — the reusable `commitPaths` git
 * primitive. This is the keystone Wave-3 helper: `writeDocument` writes bytes only, and no other
 * `src/storage` code produces the `CoreResult.commit` `{sha, message}` a mutation must return.
 * `commitPaths` stages ONLY the scoped paths it is given (never `git add -A`) and produces exactly
 * one commit, returning its sha — so task-019/020/025/029 can each turn a set of writes into a
 * single attributable commit.
 */
import { execFileSync } from 'child_process';
import { readdirSync } from 'fs';

import { commitPaths } from '../../src/storage';
import { git, makeTempGitRepo, removeTempDir, writeFixtureFile } from './helpers/git-fixture';

function headCount(root: string): number {
  return git(root, ['rev-list', '--count', 'HEAD']).trim().length > 0
    ? Number(git(root, ['rev-list', '--count', 'HEAD']).trim())
    : 0;
}

describe('commitPaths — scoped, single-commit git primitive (task-018, P1.1)', () => {
  let repo: string;
  afterEach(() => removeTempDir(repo));

  it('returns the created commit sha (40-hex) and produces exactly one commit', () => {
    repo = makeTempGitRepo();
    // Seed an initial commit so we can count deltas independent of the empty-repo edge case.
    writeFixtureFile(repo, 'seed.txt', 'seed');
    commitPathsSeed(repo);
    const before = headCount(repo);

    writeFixtureFile(repo, 'a.txt', 'A');
    writeFixtureFile(repo, 'sub/b.txt', 'B');
    const sha = commitPaths(repo, ['a.txt', 'sub/b.txt'], 'feat: add a and b');

    expect(sha).toMatch(/^[0-9a-f]{40}$/);
    expect(sha).toBe(git(repo, ['rev-parse', 'HEAD']).trim());
    expect(headCount(repo)).toBe(before + 1);
  });

  it('stages ONLY the scoped paths — an unrelated working-tree file stays untracked', () => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, 'a.txt', 'A');
    writeFixtureFile(repo, 'untracked.txt', 'nope');

    commitPaths(repo, ['a.txt'], 'feat: add a only');

    const tree = git(repo, ['ls-tree', '--name-only', '-r', 'HEAD']).trim().split('\n');
    expect(tree).toContain('a.txt');
    expect(tree).not.toContain('untracked.txt');
    // untracked.txt is still an untracked working-tree file (never staged by commitPaths).
    expect(git(repo, ['status', '--porcelain'])).toContain('?? untracked.txt');
  });

  it('leaves the scoped paths tracked with a clean status (no untracked residue)', () => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, '.wingfoil/dna.yaml', 'version: 1\n');
    commitPaths(repo, ['.wingfoil/dna.yaml'], 'feat: persist a pillar file');

    expect(git(repo, ['status', '--porcelain', '.wingfoil'])).toBe('');
    expect(git(repo, ['ls-files', '.wingfoil']).trim()).toBe('.wingfoil/dna.yaml');
  });

  it('is callable with an absolute cwd via -C (env passed explicitly, Jest-isolation safe)', () => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, 'x.txt', 'X');
    // Runs git with an explicit env (the task-014 Jest env-isolation gotcha) — should not throw.
    expect(() => commitPaths(repo, ['x.txt'], 'feat: x')).not.toThrow();
    expect(readdirSync(repo)).toContain('x.txt');
  });

  it('merges an options.env override over process.env (task-029 wizard author override path)', () => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, 'y.txt', 'Y');
    commitPaths(repo, ['y.txt'], 'feat: y', {
      env: { GIT_AUTHOR_NAME: 'Override Dev', GIT_AUTHOR_EMAIL: 'override@example.invalid' },
    });
    expect(git(repo, ['log', '-1', '--format=%an']).trim()).toBe('Override Dev');
    expect(git(repo, ['log', '-1', '--format=%ae']).trim()).toBe('override@example.invalid');
  });
});

// Local seed helper: commit the seed file without depending on commitPaths' own contract.
function commitPathsSeed(root: string): void {
  execFileSync('git', ['-C', root, 'add', 'seed.txt'], { encoding: 'utf-8', env: process.env });
  execFileSync('git', ['-C', root, 'commit', '--quiet', '-m', 'chore: seed'], {
    encoding: 'utf-8',
    env: process.env,
  });
}
