/**
 * `listPathsAtRev` (`src/storage/commit.ts`) — the directory listing at a revision that
 * `task-096-directive-inventory-resolves-at-head` AC1 calls "the missing primitive", filed as the
 * prerequisite of `bug-086-directive-inventory-read-from-the-worktree`.
 *
 * `readPathAtRev` answers *"what does this one path contain at `<rev>`"*. Nothing answered
 * *"which paths are there"*, so every committed-baseline read so far has been of a file whose name
 * was known in advance (`.wingfoil/dna.yaml`, `.wingfoil/memory.yaml`). The Directives pillar is the
 * first whose baseline is a **directory** — `.wingfoil/directives/**`, whose members are discovered,
 * not named — and `task-091` scoped `bug-086` out precisely because this did not exist
 * (its Execution Notes, § "AC5 … S2": "reading the directive tree at `HEAD` needs a *directory*
 * listing at a revision (`git ls-tree`), a storage primitive that does not exist").
 *
 * Tested directly, not only through the directive verbs that need it, because it is written to
 * outlive them: the properties below (blobs only, the revision's answer and never the working tree's,
 * an explicit sort, `null` for an unresolvable revision, verbatim paths) are its contract, and a
 * caller-level test could only observe the handful of them that caller happens to exercise.
 *
 * Throwaway temp git repositories throughout (`bug-075`: nothing here may read this repository's own
 * `.wingfoil/`). Deterministic (REQ-SYS-07): fixed fixture text, fixed identity, no clock.
 */
import { join } from 'node:path';

import { listPathsAtRev, readPathAtRev } from '../../src/storage';
import { commitAll, git, makeTempGitRepo, removeTempDir, writeFixtureFile } from './helpers/git-fixture';

describe('listPathsAtRev — a directory listing at a revision (task-096 AC1)', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, '.wingfoil/directives/built-in/testing.md', 'built-in testing\n');
    writeFixtureFile(repo, '.wingfoil/directives/custom/determinism.md', 'custom determinism\n');
    writeFixtureFile(repo, '.wingfoil/directives/custom/nested/deep.md', 'custom nested\n');
    writeFixtureFile(repo, '.wingfoil/dna.yaml', 'version: 1.1\n');
    writeFixtureFile(repo, 'README.md', '# fixture\n');
    commitAll(repo, 'seed');
  });

  afterEach(() => removeTempDir(repo));

  it('lists every blob under the prefix, recursively, as root-relative POSIX paths in ascending order', () => {
    expect(listPathsAtRev(repo, 'HEAD', '.wingfoil/directives')).toEqual([
      '.wingfoil/directives/built-in/testing.md',
      '.wingfoil/directives/custom/determinism.md',
      '.wingfoil/directives/custom/nested/deep.md',
    ]);
  });

  it('answers for the REVISION, not the working tree: an uncommitted addition is absent', () => {
    writeFixtureFile(repo, '.wingfoil/directives/custom/ghost.md', 'never committed\n');

    const atHead = listPathsAtRev(repo, 'HEAD', '.wingfoil/directives');

    expect(atHead).not.toContain('.wingfoil/directives/custom/ghost.md');
    expect(atHead).toHaveLength(3);
  });

  it('answers for the REVISION, not the working tree: an uncommitted deletion is still listed', () => {
    git(repo, ['rm', '--quiet', '.wingfoil/directives/custom/determinism.md']);

    expect(listPathsAtRev(repo, 'HEAD', '.wingfoil/directives')).toContain(
      '.wingfoil/directives/custom/determinism.md',
    );
  });

  it('reads an older revision, not only HEAD', () => {
    writeFixtureFile(repo, '.wingfoil/directives/custom/later.md', 'added later\n');
    commitAll(repo, 'add one more directive');

    expect(listPathsAtRev(repo, 'HEAD~1', '.wingfoil/directives')).toHaveLength(3);
    expect(listPathsAtRev(repo, 'HEAD', '.wingfoil/directives')).toHaveLength(4);
  });

  it('returns [] — not null — when the revision exists but holds nothing under the prefix', () => {
    expect(listPathsAtRev(repo, 'HEAD', '.wingfoil/workflows')).toEqual([]);
  });

  it('returns null when the revision does not resolve: an unborn HEAD', () => {
    const empty = makeTempGitRepo();
    try {
      expect(listPathsAtRev(empty, 'HEAD', '.wingfoil/directives')).toBeNull();
    } finally {
      removeTempDir(empty);
    }
  });

  it('returns null when the revision does not resolve: a name no object carries', () => {
    expect(listPathsAtRev(repo, 'no-such-ref', '.wingfoil/directives')).toBeNull();
  });

  it('lists the whole tree when no prefix is given', () => {
    expect(listPathsAtRev(repo, 'HEAD')).toEqual([
      '.wingfoil/directives/built-in/testing.md',
      '.wingfoil/directives/custom/determinism.md',
      '.wingfoil/directives/custom/nested/deep.md',
      '.wingfoil/dna.yaml',
      'README.md',
    ]);
  });

  it('returns blobs only — a gitlink (submodule) entry under the prefix is not a file and is not listed', () => {
    const sha = git(repo, ['rev-parse', 'HEAD']).trim();
    git(repo, ['update-index', '--add', '--cacheinfo', `160000,${sha},.wingfoil/directives/vendored`]);
    git(repo, ['commit', '--quiet', '-m', 'fixture: a gitlink under the directives tree']);

    const listed = listPathsAtRev(repo, 'HEAD', '.wingfoil/directives');

    expect(listed).not.toContain('.wingfoil/directives/vendored');
    expect(listed).toHaveLength(3);
  });

  it('returns a path containing a space verbatim, never git-quoted', () => {
    writeFixtureFile(repo, '.wingfoil/directives/custom/two words.md', 'awkward name\n');
    commitAll(repo, 'fixture: a path with a space');

    const listed = listPathsAtRev(repo, 'HEAD', '.wingfoil/directives') ?? [];

    expect(listed).toContain('.wingfoil/directives/custom/two words.md');
    expect(listed.some((path) => path.startsWith('"'))).toBe(false);
  });

  it('a listed path can be read back with readPathAtRev at the same revision', () => {
    // The two primitives are meant to compose: list, then read each entry. Pinned so a future change
    // to either one's path spelling cannot silently break the pair.
    const [first] = listPathsAtRev(repo, 'HEAD', '.wingfoil/directives') ?? [];
    expect(first).toBe('.wingfoil/directives/built-in/testing.md');
    expect(readPathAtRev(repo, 'HEAD', first as string)).toBe('built-in testing\n');
  });

  it('passes its env override through to git, like every other primitive here', () => {
    // `GIT_DIR` pointed elsewhere must change the answer — proof the option is not silently dropped
    // (the task-014 env-isolation gotcha, recorded in this module's header).
    const other = makeTempGitRepo();
    try {
      writeFixtureFile(other, '.wingfoil/directives/custom/only-here.md', 'other repo\n');
      commitAll(other, 'seed the other repo');

      expect(listPathsAtRev(repo, 'HEAD', '.wingfoil/directives', { env: { GIT_DIR: join(other, '.git') } })).toEqual([
        '.wingfoil/directives/custom/only-here.md',
      ]);
    } finally {
      removeTempDir(other);
    }
  });
});
