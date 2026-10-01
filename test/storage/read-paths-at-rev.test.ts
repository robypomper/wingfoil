/**
 * `readPathsAtRev` and `resolveCommitAtRev` (`src/storage/commit.ts`, task-137) — the batched read at a
 * revision and the revision resolver the `…AtRev` readers build on.
 *
 * `readPathAtRev` spawns one `git show` per path: reading this repository's 664 Memory and plan
 * documents that way took 5.49 s against 0.39 s for one `git cat-file --batch` (task-137 design notes),
 * and `spec-017` §1.1 reads every Memory document at `HEAD` on every `workflow next`/`status`. The batch
 * answers, per path and in input order, exactly what `readPathAtRev` answers — the bytes, or `null` when
 * the revision does not hold that path as a file.
 *
 * Throwaway temp git repositories throughout (`bug-075`). Deterministic (REQ-SYS-07).
 */
import { readPathAtRev, readPathsAtRev, resolveCommitAtRev, StorageError } from '../../src/storage';
import { commitAll, git, makeTempGitRepo, removeTempDir, writeFixtureFile } from './helpers/git-fixture';

describe('readPathsAtRev — many paths at one revision, one git process (task-137)', () => {
  let repo: string;
  let first: string;

  beforeEach(() => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, 'a.md', 'A first\n');
    writeFixtureFile(repo, 'dir/b c.md', 'B with a space in its name\n');
    writeFixtureFile(repo, 'dir/caffè.md', 'non-ASCII name, multi-byte body: àèìòù €\n');
    writeFixtureFile(repo, 'empty.md', '');
    writeFixtureFile(repo, 'no-newline.md', 'no trailing newline');
    commitAll(repo, 'first');
    first = git(repo, ['rev-parse', 'HEAD']).trim();
    writeFixtureFile(repo, 'a.md', 'A LATER\n');
    writeFixtureFile(repo, 'later.md', 'added later\n');
    commitAll(repo, 'second');
    writeFixtureFile(repo, 'a.md', 'A DIRTY\n');
  });

  afterEach(() => removeTempDir(repo));

  it('answers each path as readPathAtRev does, in input order', () => {
    const paths = ['dir/caffè.md', 'a.md', 'later.md', 'empty.md', 'dir/b c.md', 'no-newline.md', 'dir', 'missing.md'];
    // A file or an absent path: the same answer as `readPathAtRev`. A tree is the one deliberate
    // difference — `git show <rev>:<dir>` prints a listing, which is not a file's content.
    const files = paths.filter((path) => path !== 'dir');
    expect(readPathsAtRev(repo, first, files)).toEqual(files.map((path) => readPathAtRev(repo, first, path)));
    expect(readPathsAtRev(repo, first, paths)).toEqual([
      'non-ASCII name, multi-byte body: àèìòù €\n',
      'A first\n',
      null,
      '',
      'B with a space in its name\n',
      'no trailing newline',
      null, // a tree, not a file
      null,
    ]);
  });

  it('an empty list is an empty answer, and spawns nothing that could fail', () => {
    expect(readPathsAtRev(repo, 'HEAD', [])).toEqual([]);
  });

  it('a path holding a newline is still answered (it cannot travel on the batch protocol)', () => {
    writeFixtureFile(repo, 'odd\nname.md', 'newline in the name\n');
    commitAll(repo, 'odd');
    expect(readPathsAtRev(repo, 'HEAD', ['odd\nname.md', 'a.md'])).toEqual(['newline in the name\n', 'A DIRTY\n']);
  });

  it('fails loudly, rather than answering null, when git itself cannot run in root', () => {
    expect(() => readPathsAtRev(`${repo}/does-not-exist`, 'HEAD', ['a.md'])).toThrow(StorageError);
  });
});

describe('resolveCommitAtRev — a revision to the full sha of a commit (task-137)', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeTempGitRepo();
  });

  afterEach(() => removeTempDir(repo));

  it('is null on an unborn HEAD, the sha once a commit exists, null for a tree or an unknown name', () => {
    expect(resolveCommitAtRev(repo, 'HEAD')).toBeNull();
    writeFixtureFile(repo, 'a.md', 'A\n');
    commitAll(repo, 'seed');
    const sha = git(repo, ['rev-parse', 'HEAD']).trim();
    expect(resolveCommitAtRev(repo, 'HEAD')).toBe(sha);
    expect(resolveCommitAtRev(repo, sha.slice(0, 10))).toBe(sha);
    expect(resolveCommitAtRev(repo, git(repo, ['rev-parse', 'HEAD^{tree}']).trim())).toBeNull();
    expect(resolveCommitAtRev(repo, 'no-such-ref')).toBeNull();
  });
});
