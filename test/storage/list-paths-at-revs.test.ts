/**
 * `listPathsAtRevs` (`src/storage/commit.ts`, `task-142`, `bug-178`) — the union of
 * {@link listPathsAtRev} over many revisions, read in a number of git processes that does not depend
 * on how many revisions there are. Its contract is "the same answer as `listPathsAtRev`, unioned", so
 * every case below compares the two on the same fixture rather than restating the expected listing.
 *
 * Throwaway temp git repositories throughout. Deterministic (REQ-SYS-07).
 */
import { execFileSync } from 'node:child_process';
import { rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';

import { E_GIT_READ_FAILED, E_INVALID_REVISION, listPathsAtRev, listPathsAtRevs } from '../../src/storage';
import { commitAll, git, makeTempGitRepo, removeTempDir, writeFixtureFile } from './helpers/git-fixture';

/** `listPathsAtRev` over each revision, unioned and sorted — the reference answer. */
function reference(repo: string, revs: readonly string[], prefix: string): string[] {
  const paths = new Set<string>();
  for (const rev of revs) for (const path of listPathsAtRev(repo, rev, prefix) ?? []) paths.add(path);
  return [...paths].sort();
}

describe('listPathsAtRevs — one listing for many revisions (task-142, bug-178)', () => {
  let repo = '';
  let revs: string[] = [];

  beforeEach(() => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, 'docs/mem/v0.1/task-001-a.md', 'a\n');
    writeFixtureFile(repo, 'docs/mem/v0.1/same.md', 'same\n');
    writeFixtureFile(repo, 'docs/mem/v0.2/same.md', 'same\n'); // an identical blob at a second path
    writeFixtureFile(repo, 'docs/other/x.md', 'x\n');
    writeFixtureFile(repo, 'README.md', '# r\n');
    symlinkSync('task-001-a.md', join(repo, 'docs/mem/v0.1/link.md'));
    commitAll(repo, 'one');
    const first = git(repo, ['rev-parse', 'HEAD']).trim();
    writeFixtureFile(repo, 'docs/mem/v0.3/deep/er/task-009-z.md', 'z\n');
    writeFixtureFile(repo, 'docs/mem/caffè.md', 'accent\n');
    // A gitlink: an entry of the tree, but not a file (listPathsAtRev filters it out). Staged AFTER
    // `git add -A`, and committed with a plain `git commit`: `add -A` would drop an index entry
    // whose path is absent on disk (task-142 review, finding 1).
    git(repo, ['add', '-A']);
    git(repo, ['update-index', '--add', '--cacheinfo', `160000,${first},docs/mem/submodule`]);
    git(repo, ['commit', '--quiet', '-m', 'two']);
    const second = git(repo, ['rev-parse', 'HEAD']).trim();
    git(repo, ['rm', '-r', '--quiet', 'docs']);
    commitAll(repo, 'three: no docs at all');
    revs = [first, second, git(repo, ['rev-parse', 'HEAD']).trim()];
  });

  afterEach(() => removeTempDir(repo));

  it.each(['docs/mem/', 'docs/mem', 'docs/', ''])('gives the same answer as listPathsAtRev, unioned, under prefix %p', (prefix) => {
    const answer = listPathsAtRevs(repo, revs, prefix);

    expect(answer).toEqual(reference(repo, revs, prefix));
    expect(answer.length).toBeGreaterThan(0);
  });

  it('keeps an identical subtree or blob at two paths as two paths, and drops the gitlink', () => {
    // The gitlink really is in the tree — otherwise "drops it" asserts nothing.
    expect(git(repo, ['ls-tree', revs[1] as string, 'docs/mem/submodule'])).toMatch(/^160000 commit /);
    const answer = listPathsAtRevs(repo, revs, 'docs/mem/');

    expect(answer).toEqual(expect.arrayContaining(['docs/mem/v0.1/same.md', 'docs/mem/v0.2/same.md', 'docs/mem/v0.1/link.md', 'docs/mem/caffè.md']));
    expect(answer).not.toContain('docs/mem/submodule');
  });

  it('answers [] for no revisions, and for a prefix no revision holds', () => {
    expect(listPathsAtRevs(repo, [], 'docs/')).toEqual([]);
    expect(listPathsAtRevs(repo, revs, 'nowhere/')).toEqual([]);
  });

  it('fails loudly for a revision that names no commit, rather than skipping it', () => {
    const blob = git(repo, ['rev-parse', `${revs[0]}:README.md`]).trim();

    expect(() => listPathsAtRevs(repo, [...revs, blob], 'docs/')).toThrow(E_GIT_READ_FAILED);
    expect(() => listPathsAtRevs(repo, ['0'.repeat(40)], 'docs/')).toThrow(E_GIT_READ_FAILED);
  });

  it('refuses a revision that would change the batch request', () => {
    expect(() => listPathsAtRevs(repo, ['HEAD\nHEAD'], 'docs/')).toThrow(E_INVALID_REVISION);
  });

  it('reads a prefix that cannot travel on the batch protocol (a newline) revision by revision', () => {
    writeFixtureFile(repo, 'odd\ndir/task-001-n.md', 'n\n');
    commitAll(repo, 'four: a directory whose name holds a newline');
    const withOdd = [...revs, git(repo, ['rev-parse', 'HEAD']).trim()];

    expect(listPathsAtRevs(repo, withOdd, 'odd\ndir/')).toEqual(['odd\ndir/task-001-n.md']);
    expect(() => listPathsAtRevs(repo, ['0'.repeat(40)], 'odd\ndir/')).toThrow(E_GIT_READ_FAILED);
  });

  it('reads a directory two revisions share once, and lists it once', () => {
    writeFixtureFile(repo, 'docs/mem/v0.1/task-001-a.md', 'a\n');
    commitAll(repo, 'four: docs back');
    writeFixtureFile(repo, 'README.md', '# changed outside docs\n');
    commitAll(repo, 'five: same docs tree');
    const shared = [git(repo, ['rev-parse', 'HEAD~1']).trim(), git(repo, ['rev-parse', 'HEAD']).trim()];

    expect(listPathsAtRevs(repo, shared, 'docs/', { env: { GIT_OPTIONAL_LOCKS: '0' } })).toEqual(['docs/mem/v0.1/task-001-a.md']);
  });

  it('fails loudly when a subtree object cannot be read, rather than listing less', () => {
    const subtree = git(repo, ['rev-parse', `${revs[1]}:docs/mem/v0.3`]).trim();
    rmSync(join(repo, '.git', 'objects', subtree.slice(0, 2), subtree.slice(2)));

    expect(() => listPathsAtRevs(repo, revs, 'docs/')).toThrow(new RegExp(`E_GIT_READ_FAILED: .*tree ${subtree} is missing`));
  });

  it('lists whole trees when no prefix is given (the default)', () => {
    expect(listPathsAtRevs(repo, revs)).toEqual(reference(repo, revs, ''));
  });

  it.each([
    ['a file path, no trailing slash', 'docs/other/x.md'],
    ['a ./-prefixed directory', './docs/mem/'],
  ])('gives the same answer as listPathsAtRev for %s', (_what, prefix) => {
    const answer = listPathsAtRevs(repo, revs, prefix);

    expect(answer).toEqual(reference(repo, revs, prefix));
    expect(answer.length).toBeGreaterThan(0);
  });

  /**
   * task-142 review, finding 2: a tree entry whose mode is zero-padded (`040000`, which old git
   * versions and some third-party writers produced; `git fsck` reports it as `zeroPaddedFilemode`)
   * is still a directory. `git ls-tree` normalises the mode and recurses into it; reading it as a
   * file would hide every id inside it from the counter and reissue a number (the `bug-087` class).
   */
  it('reads a zero-padded tree mode (040000) as a directory, as listPathsAtRev does', () => {
    const blob = git(repo, ['rev-parse', `${revs[0]}:docs/mem/v0.1/task-001-a.md`]).trim();
    const literalTree = (entries: [string, string, string][]): string => {
      const raw = Buffer.concat(entries.map(([mode, name, oid]) => Buffer.concat([Buffer.from(`${mode} ${name}\0`), Buffer.from(oid, 'hex')])));
      return execFileSync('git', ['hash-object', '-t', 'tree', '-w', '--literally', '--stdin'], { cwd: repo, input: raw, encoding: 'utf-8' }).trim();
    };
    const inner = literalTree([['100644', 'task-042-padded.md', blob]]);
    const docs = literalTree([['040000', 'mem', inner]]);
    const root = literalTree([['40000', 'docs', docs]]);
    const commit = git(repo, ['commit-tree', root, '-m', 'zero-padded mode']).trim();

    expect(listPathsAtRev(repo, commit, 'docs/')).toEqual(['docs/mem/task-042-padded.md']);
    expect(listPathsAtRevs(repo, [commit], 'docs/')).toEqual(['docs/mem/task-042-padded.md']);
  });
});
