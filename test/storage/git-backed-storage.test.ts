/**
 * task-018-implement-git-backed-storage (P1.1, US-0A-01, REQ-SYS-01/REQ-SYS-02) — the `.wingfoil/`
 * init routine as a storage-layer contract. Acceptance scenarios trace to
 * docs/02_requirements/02_bdd/features/p1-memory/P1.1-git-backed-storage.feature and the layout in
 * spec-011-storage-layout:
 *   - "Initialize the WingFoil storage structure" → initStorage writes the full skeleton and stages
 *     it as ONE commit authored by the current git user.
 *   - "Persisting a pillar state file produces exactly one tracked change" → writeDocument +
 *     commitPaths under `.wingfoil/` leave git status clean with no untracked residue.
 * The not-a-git-repo error scenario is a CoreResult concern — see test/core/init.test.ts.
 */
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

import { initStorage, scaffoldFiles, writeDocument, WINGFOIL_DIR } from '../../src/storage';
import { git, makeTempGitRepo, removeTempDir } from './helpers/git-fixture';

describe('initStorage — Initialize the WingFoil storage structure (P1.1 scenario 1)', () => {
  let repo: string;
  afterEach(() => removeTempDir(repo));

  it('creates .wingfoil/ with memory/, directives/ and dna/memory/workflows yaml files', () => {
    repo = makeTempGitRepo();
    expect(existsSync(join(repo, WINGFOIL_DIR))).toBe(false);

    initStorage(repo);

    const wf = join(repo, WINGFOIL_DIR);
    expect(existsSync(wf)).toBe(true);
    const tracked = git(repo, ['ls-files', WINGFOIL_DIR]).trim().split('\n');
    // Subfolders present (via a tracked entry inside each).
    expect(tracked.some((p) => p.startsWith('.wingfoil/memory/'))).toBe(true);
    expect(tracked.some((p) => p.startsWith('.wingfoil/directives/'))).toBe(true);
    // Top-level pillar config files present.
    for (const f of ['dna.yaml', 'memory.yaml', 'workflows.yaml']) {
      expect(tracked).toContain(`.wingfoil/${f}`);
    }
  });

  it('stages the new files as a SINGLE commit authored by the current git user', () => {
    repo = makeTempGitRepo();
    const before = Number(git(repo, ['rev-list', '--all', '--count']).trim() || '0');

    const sha = initStorage(repo);

    expect(sha).toMatch(/^[0-9a-f]{40}$/);
    // Exactly one new commit total.
    expect(Number(git(repo, ['rev-list', '--all', '--count']).trim())).toBe(before + 1);
    // Authored by the current (fixture-configured) git user.
    expect(git(repo, ['log', '-1', '--format=%ae']).trim()).toBe('wf-test@example.invalid');
    expect(git(repo, ['log', '-1', '--format=%an']).trim()).toBe('WingFoil Test');
    // That one commit contains every scaffold file and nothing else — working tree is clean.
    const committed = git(repo, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n').sort();
    expect(committed).toEqual(scaffoldFiles().map((f) => f.path).sort());
    expect(git(repo, ['status', '--porcelain'])).toBe('');
  });

  it('scaffoldFiles() is deterministic — same file set/content across calls', () => {
    expect(scaffoldFiles()).toEqual(scaffoldFiles());
    // Every scaffold path is under .wingfoil/ (confined) and none escapes via traversal.
    for (const f of scaffoldFiles()) {
      expect(f.path.startsWith('.wingfoil/')).toBe(true);
      expect(f.path).not.toContain('..');
    }
  });

  it('accepts a caller-supplied file list (task-029 wizard override) and commits exactly that', () => {
    repo = makeTempGitRepo();
    const custom = [{ path: '.wingfoil/dna.yaml', content: 'version: 42\n' }];
    initStorage(repo, custom);
    expect(git(repo, ['ls-files', WINGFOIL_DIR]).trim()).toBe('.wingfoil/dna.yaml');
    expect(git(repo, ['show', 'HEAD:.wingfoil/dna.yaml'])).toContain('version: 42');
  });
});

describe('Persisting a pillar state file produces exactly one tracked change (P1.1 scenario 2)', () => {
  let repo: string;
  afterEach(() => removeTempDir(repo));

  it('a pillar write under .wingfoil/ becomes tracked with no untracked residue', () => {
    repo = makeTempGitRepo();
    initStorage(repo);
    // A later pillar writes a state file under .wingfoil/ (writeDocument = bytes; commitPaths = commit).
    const rel = '.wingfoil/directives/custom/testing.md';
    writeDocument(join(repo, rel), '# testing directive\n');
    // Before committing it is the ONLY untracked change.
    expect(git(repo, ['status', '--porcelain']).trim()).toBe(`?? ${rel}`);

    // Commit just that file (the pillar's own single-commit operation).
    require('../../src/storage').commitPaths(repo, [rel], 'feat(directives): add testing');

    expect(git(repo, ['status', '--porcelain'])).toBe('');
    expect(git(repo, ['ls-files', rel]).trim()).toBe(rel);
    expect(readdirSync(join(repo, '.wingfoil', 'directives', 'custom'))).toContain('testing.md');
  });
});
