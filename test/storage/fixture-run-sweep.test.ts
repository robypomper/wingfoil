/**
 * The end-of-run fixture count (`bug-064-fixture-temp-dirs-leak-with-no-aggregate-visibility`,
 * task-152): `test/global-setup.cjs` tags the run, the fixture helper puts the tag in every directory
 * it creates, and `test/global-teardown.cjs` counts, reports and removes what carries the tag.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { basename, join } from 'path';

import {
  cloneTempRepo,
  commitAll,
  FIXTURE_RUN_TAG_ENV,
  makeTempGitRepo,
  removeTempDir,
  writeFixtureFile,
} from './helpers/git-fixture';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const teardown = require('../global-teardown.cjs') as (() => Promise<void>) & {
  sweepFixtureDirs(tmpRoot: string, tag: string): { found: string[]; unremoved: string[] };
  formatSweepReport(result: { found: string[]; unremoved: string[] }): string | null;
};

describe('fixture run tag — every fixture directory names the jest run that made it', () => {
  it('is set in the worker, by the global setup', () => {
    expect(process.env[FIXTURE_RUN_TAG_ENV]).toMatch(/^r\d+$/);
  });

  it('prefixes both the repos makeTempGitRepo creates and the clones cloneTempRepo creates', () => {
    const prefix = `wf-storage-${process.env[FIXTURE_RUN_TAG_ENV]}-`;
    const repo = makeTempGitRepo();
    writeFixtureFile(repo, 'a.txt', 'a\n');
    commitAll(repo, 'seed');
    const clone = cloneTempRepo(repo);
    try {
      expect(basename(repo).startsWith(prefix)).toBe(true);
      expect(basename(clone).startsWith(prefix)).toBe(true);
    } finally {
      removeTempDir(clone);
      removeTempDir(repo);
    }
  });
});

describe('global teardown sweep — counts and removes this run’s leftovers, and only those', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'wf-sweep-test-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('removes the directories carrying this run’s tag and reports them by count', () => {
    for (const name of ['wf-storage-r1-aaa', 'wf-storage-r1-bbb', 'wf-storage-r2-ccc', 'wf-storage-ddd', 'other']) {
      mkdirSync(join(root, name, '.git'), { recursive: true });
    }

    const result = teardown.sweepFixtureDirs(root, 'r1');

    expect(result.found).toEqual([join(root, 'wf-storage-r1-aaa'), join(root, 'wf-storage-r1-bbb')]);
    expect(result.unremoved).toEqual([]);
    expect(readdirSync(root).sort()).toEqual(['other', 'wf-storage-ddd', 'wf-storage-r2-ccc']);
    expect(teardown.formatSweepReport(result)).toBe(
      'fixture teardown: this run left 2 fixture directories behind; removed 2',
    );
  });

  it('reports nothing when the run left nothing behind', () => {
    mkdirSync(join(root, 'wf-storage-r2-ccc'));

    const result = teardown.sweepFixtureDirs(root, 'r1');

    expect(result).toEqual({ found: [], unremoved: [] });
    expect(teardown.formatSweepReport(result)).toBeNull();
    expect(existsSync(join(root, 'wf-storage-r2-ccc'))).toBe(true);
  });

  it('names the directories it could not remove', () => {
    expect(teardown.formatSweepReport({ found: ['/t/a', '/t/b'], unremoved: ['/t/b'] })).toBe(
      'fixture teardown: this run left 2 fixture directories behind; removed 1, could not remove 1: /t/b',
    );
    expect(teardown.formatSweepReport({ found: ['/t/a'], unremoved: [] })).toBe(
      'fixture teardown: this run left 1 fixture directory behind; removed 1',
    );
  });
});

describe('global teardown — only the run that owns the tag sweeps (task-152)', () => {
  // A child jest started from inside a run (`test/lint/coverage-parity.test.ts`) loads this
  // repository's config, so it runs the same teardown, and it inherits the parent's tag through the
  // environment. Its teardown must not sweep the parent's fixtures while the parent's suites are still
  // using them: the tag is `r<pid>` of the process that set it, and only that process sweeps.
  const saved = { tmp: process.env.TMPDIR, tag: process.env[FIXTURE_RUN_TAG_ENV] };
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'wf-sweep-owner-'));
    process.env.TMPDIR = root;
  });

  afterEach(() => {
    process.env.TMPDIR = saved.tmp;
    process.env[FIXTURE_RUN_TAG_ENV] = saved.tag;
    rmSync(root, { recursive: true, force: true });
  });

  it('leaves the fixtures alone when the tag names another process (an inherited tag)', async () => {
    const foreign = `r${process.pid + 1}`;
    process.env[FIXTURE_RUN_TAG_ENV] = foreign;
    mkdirSync(join(root, `wf-storage-${foreign}-live`));

    await teardown();

    expect(readdirSync(root)).toEqual([`wf-storage-${foreign}-live`]);
  });

  it('sweeps when the tag is its own', async () => {
    const own = `r${process.pid}`;
    process.env[FIXTURE_RUN_TAG_ENV] = own;
    mkdirSync(join(root, `wf-storage-${own}-left`));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      await teardown();
    } finally {
      warn.mockRestore();
    }

    expect(readdirSync(root)).toEqual([]);
  });
});
