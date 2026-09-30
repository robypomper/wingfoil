/**
 * task-128 — the `{n}` counter behind `memory add` (`dl-101` §2 (a); `bug-087`, `bug-162`;
 * `spec-001-memory-yaml-schema` "Counter algorithm", revised 2026-09-30).
 *
 * - {@link highestSequenceNumber} is the pure half: given candidate repository paths, the highest
 *   number the type's `path` + `id_pattern` capture, with every non-`{id}` path token a wildcard.
 * - {@link nextSequenceNumber} is the git half: it collects those paths from every local branch,
 *   every remote-tracking ref, `HEAD`, the index and the untracked working-tree files, and adds one.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { highestSequenceNumber, nextSequenceNumber } from '../../src/memory';
import { StorageError } from '../../src/storage';
import { commitAll, git, makeTempGitRepo, removeTempDir, writeFixtureFile } from '../storage/helpers/git-fixture';

const TASK_PATH = 'docs/memory/{release}/{id}.md';
const TASK_ID = 'task-{n}-{slug}';

describe('highestSequenceNumber — pure maximum over candidate paths', () => {
  it('is 0 when nothing matches', () => {
    expect(highestSequenceNumber([], TASK_PATH, TASK_ID)).toBe(0);
    expect(highestSequenceNumber(['docs/memory/v0.1/README.md'], TASK_PATH, TASK_ID)).toBe(0);
  });

  it('takes the highest number, not the count, so a gap never reissues a number (bug-087)', () => {
    const paths = ['docs/memory/v0.1/task-001-a.md', 'docs/memory/v0.1/task-003-c.md'];
    expect(highestSequenceNumber(paths, TASK_PATH, TASK_ID)).toBe(3);
  });

  it('treats every non-{id} path token as a wildcard, so the counter spans every folder (bug-162)', () => {
    const paths = [
      'docs/memory/v0.1/task-017-a.md',
      'docs/memory/v0.2/task-108-b.md',
      'docs/memory/v0.2.2/task-123-c.md',
    ];
    expect(highestSequenceNumber(paths, TASK_PATH, TASK_ID)).toBe(123);
  });

  it('a token may resolve to more than one path segment (a {scope} such as rl-v1/rel-v0.3)', () => {
    expect(highestSequenceNumber(['docs/plans/rl-v1/rel-v0.3/p-9-x.md'], 'docs/plans/{scope}/{id}.md', 'p-{n}-{slug}')).toBe(9);
  });

  it('ignores paths outside the pattern: other types, other roots, non-.md files, nested ids', () => {
    const paths = [
      'docs/memory/v0.1/bug-900-x.md', // another type's id
      'other/v0.1/task-901-x.md', // outside the literal prefix
      'docs/memory/v0.1/task-902-x.txt', // not the path's extension
      'docs/memory/task-903-x.md', // no folder for the {release} token
      'docs/memory/v0.1/task-004-ok.md',
    ];
    expect(highestSequenceNumber(paths, TASK_PATH, TASK_ID)).toBe(4);
  });

  it('reads leading zeros as the number they pad (task-0012 is 12)', () => {
    expect(highestSequenceNumber(['docs/memory/v1/task-0012-a.md'], TASK_PATH, TASK_ID)).toBe(12);
  });

  it('respects the materialized id prefix: only ids of that prefix count', () => {
    const paths = ['docs/r/minor-7.md', 'docs/r/patch-9.md'];
    expect(highestSequenceNumber(paths, 'docs/r/{id}.md', 'minor-{n}')).toBe(7);
  });

  it('is independent of the order the paths come in (REQ-SYS-07)', () => {
    const paths = ['docs/memory/a/task-002-x.md', 'docs/memory/b/task-010-y.md', 'docs/memory/c/task-007-z.md'];
    const orders = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ];
    for (const order of orders) {
      expect(highestSequenceNumber(order.map((index) => paths[index] as string), TASK_PATH, TASK_ID)).toBe(10);
    }
  });
});

describe('nextSequenceNumber — every ref, HEAD, the index and the working tree', () => {
  const dirs: string[] = [];
  const repo = (): string => {
    const dir = makeTempGitRepo();
    dirs.push(dir);
    return dir;
  };
  afterEach(() => {
    while (dirs.length > 0) removeTempDir(dirs.pop() as string);
  });

  it('is 1 in a repository with no commit and no matching file', () => {
    expect(nextSequenceNumber(repo(), TASK_PATH, TASK_ID)).toBe(1);
  });

  it('counts an untracked working-tree file and a staged one', () => {
    const dir = repo();
    writeFixtureFile(dir, 'docs/memory/v0.1/task-004-untracked.md', 'x\n');
    expect(nextSequenceNumber(dir, TASK_PATH, TASK_ID)).toBe(5);
    writeFixtureFile(dir, 'docs/memory/v0.1/task-006-staged.md', 'x\n');
    git(dir, ['add', 'docs/memory/v0.1/task-006-staged.md']);
    expect(nextSequenceNumber(dir, TASK_PATH, TASK_ID)).toBe(7);
  });

  it('counts a number only a detached HEAD holds', () => {
    const dir = repo();
    writeFixtureFile(dir, 'README.md', 'x\n');
    commitAll(dir, 'base');
    writeFixtureFile(dir, 'docs/memory/v0.1/task-009-detached.md', 'x\n');
    commitAll(dir, 'on main');
    git(dir, ['checkout', '--quiet', '--detach', 'HEAD']);
    git(dir, ['branch', '--quiet', '-f', 'main', 'HEAD~1']);
    git(dir, ['rm', '--quiet', 'docs/memory/v0.1/task-009-detached.md']);
    // Now only the detached HEAD's tree holds task-009: no branch, not the index, not the tree.
    expect(nextSequenceNumber(dir, TASK_PATH, TASK_ID)).toBe(10);
  });

  it('counts a number held by a branch that is not checked out and by a remote-tracking ref', () => {
    const dir = repo();
    writeFixtureFile(dir, 'README.md', 'x\n');
    commitAll(dir, 'base');
    git(dir, ['checkout', '--quiet', '-b', 'other']);
    writeFixtureFile(dir, 'docs/memory/v0.2/task-020-other.md', 'x\n');
    commitAll(dir, 'other');
    const otherSha = git(dir, ['rev-parse', 'HEAD']).trim();
    git(dir, ['checkout', '--quiet', 'main']);
    expect(nextSequenceNumber(dir, TASK_PATH, TASK_ID)).toBe(21);

    git(dir, ['update-ref', 'refs/remotes/origin/other', otherSha]);
    git(dir, ['branch', '--quiet', '-D', 'other']);
    expect(nextSequenceNumber(dir, TASK_PATH, TASK_ID)).toBe(21);
  });

  it('a failed git read is an error, never an empty answer that would reissue 1', () => {
    const notARepo = mkdtempSync(join(tmpdir(), 'wf-seq-norepo-'));
    dirs.push(notARepo);
    writeFixtureFile(notARepo, 'docs/memory/v0.1/task-005-x.md', 'x\n');
    expect(() => nextSequenceNumber(notARepo, TASK_PATH, TASK_ID)).toThrow(StorageError);
  });

  it('a ref whose tree cannot be listed is an error too, not a ref silently skipped', () => {
    const dir = repo();
    writeFixtureFile(dir, 'README.md', 'x\n');
    commitAll(dir, 'base');
    const blob = git(dir, ['hash-object', '-w', 'README.md']).trim();
    git(dir, ['update-ref', 'refs/remotes/origin/not-a-commit', blob]);
    expect(() => nextSequenceNumber(dir, TASK_PATH, TASK_ID)).toThrow(/E_GIT_READ_FAILED: git ls-tree/);
  });
});
