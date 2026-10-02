/**
 * task-142 review, finding 3 — `readPathAtRev` and `listPathsAtRev` (`src/storage/commit.ts`) read
 * through the same helper as every other Memory git read (`runGitRead`, `src/storage/git-read.ts`).
 * Before, they ran without a `maxBuffer`: past Node's 1 MiB default `execFileSync` threw `ENOBUFS`,
 * and their `catch` answered `null` — "this path is absent" / "this revision does not resolve" — for
 * a document or a tree that is there. `memory amend`, `memory add-type`, the loaders and the write
 * guard all read `null` as absence, so the operator got a wrong refusal for a large document.
 *
 * Throwaway temp repositories throughout.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { E_GIT_READ_FAILED, listPathsAtRev, readPathAtRev } from '../../src/storage';
import { commitAll, git, makeTempGitRepo, removeTempDir, writeFixtureFile } from './helpers/git-fixture';

/** Node's default `maxBuffer`: 1 MiB. */
const NODE_DEFAULT_MAX_BUFFER = 1024 * 1024;

describe('readPathAtRev / listPathsAtRev past 1 MiB (task-142 review, finding 3)', () => {
  const dirs: string[] = [];
  afterEach(() => {
    while (dirs.length > 0) removeTempDir(dirs.pop() as string);
  });

  it('readPathAtRev returns a committed document larger than 1 MiB, not null', () => {
    const repo = makeTempGitRepo();
    dirs.push(repo);
    const content = `---\nid: task-900\nstatus: draft\n---\n\n${`${'y'.repeat(79)}\n`.repeat(Math.ceil((NODE_DEFAULT_MAX_BUFFER + 200 * 1024) / 80))}`;
    writeFixtureFile(repo, 'docs/memory/task-900.md', content);
    commitAll(repo, 'large');

    expect(readPathAtRev(repo, 'HEAD', 'docs/memory/task-900.md')).toBe(content);
  });

  it('listPathsAtRev lists a tree whose listing is larger than 1 MiB, not null', () => {
    const repo = makeTempGitRepo();
    dirs.push(repo);
    const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: repo, input: 'x\n', encoding: 'utf-8' }).trim();
    // ~18,000 index entries pointing at one blob: an `ls-tree -r -z` answer past 1 MiB, built without
    // writing 18,000 files.
    const count = 18_000;
    const paths = Array.from({ length: count }, (_, index) => `docs/memory/v0.1/task-${String(index).padStart(5, '0')}-a-reasonably-long-slug.md`);
    execFileSync('git', ['update-index', '--index-info'], { cwd: repo, input: paths.map((path) => `100644 ${blob}\t${path}\n`).join('') });
    git(repo, ['commit', '--quiet', '-m', 'many']);
    expect(execFileSync('git', ['ls-tree', '-r', '-z', '--full-tree', 'HEAD'], { cwd: repo, maxBuffer: 64 * NODE_DEFAULT_MAX_BUFFER }).length).toBeGreaterThan(NODE_DEFAULT_MAX_BUFFER);

    expect(listPathsAtRev(repo, 'HEAD', 'docs/')).toHaveLength(count);
  });

  it('still answers null for a path the revision does not hold, and for a revision that does not resolve', () => {
    const repo = makeTempGitRepo();
    dirs.push(repo);
    writeFixtureFile(repo, 'a.md', 'a\n');
    commitAll(repo, 'one');

    expect(readPathAtRev(repo, 'HEAD', 'absent.md')).toBeNull();
    expect(readPathAtRev(repo, 'no-such-ref', 'a.md')).toBeNull();
    expect(listPathsAtRev(repo, 'no-such-ref', '')).toBeNull();
  });

  it('a git that cannot be spawned is E_GIT_READ_FAILED, not "absent"', () => {
    const repo = mkdtempSync(join(tmpdir(), 'wf-no-git-'));
    dirs.push(repo);
    const saved = process.env.PATH;
    process.env.PATH = join(tmpdir(), 'wf-no-such-dir-on-path');
    try {
      expect(() => readPathAtRev(repo, 'HEAD', 'a.md')).toThrow(E_GIT_READ_FAILED);
      expect(() => listPathsAtRev(repo, 'HEAD', '')).toThrow(E_GIT_READ_FAILED);
    } finally {
      process.env.PATH = saved;
    }
  });
});
