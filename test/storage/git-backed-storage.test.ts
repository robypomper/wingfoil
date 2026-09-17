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

import { commitPaths, initStorage, scaffoldFiles, writeDocument, WINGFOIL_DIR } from '../../src/storage';
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
    // Before committing it is the ONLY untracked change (--untracked-files=all expands the new dir).
    expect(git(repo, ['status', '--porcelain', '--untracked-files=all']).trim()).toBe(`?? ${rel}`);

    // Commit just that file (the pillar's own single-commit operation).
    commitPaths(repo, [rel], 'feat(directives): add testing');

    expect(git(repo, ['status', '--porcelain'])).toBe('');
    expect(git(repo, ['ls-files', rel]).trim()).toBe(rel);
    expect(readdirSync(join(repo, '.wingfoil', 'directives', 'custom'))).toContain('testing.md');
  });
});

/**
 * task-054-project-directives, second pass — `p3-directives/P3.5-project-directives.feature`
 * scenario 2, "A directive change is versioned":
 *
 *   Given a custom directive "no-direct-db-access" exists
 *   When its content is edited and saved
 *   Then the change is captured as a git commit
 *   And the previous version is retrievable from history
 *
 * Distinct from the P1.1 scenario above it, which CREATES a directive file (it asserts the porcelain
 * status is exactly `?? …/testing.md`, i.e. the path did not previously exist) and therefore cannot
 * speak to either clause here: there is no prior content to edit, and no earlier revision to read
 * back. This one starts from an ALREADY TRACKED file and reads the superseded revision out of git —
 * the `HEAD~1` read is the whole point of the second clause, so it is asserted directly rather than
 * inferred from the commit succeeding.
 */
describe('A directive change is versioned (P3.5 scenario 2)', () => {
  let repo: string;
  afterEach(() => removeTempDir(repo));

  it('captures an edit to an existing directive as a commit, prior version still retrievable', () => {
    repo = makeTempGitRepo();
    initStorage(repo);

    const rel = '.wingfoil/directives/custom/no-direct-db-access.md';
    const before = '---\nname: no-direct-db-access\n---\n\nNo direct DB access from controllers.\n';
    const after = '---\nname: no-direct-db-access\n---\n\nNo direct DB access from controllers or jobs.\n';

    // Given — the directive exists AND is tracked (the precondition the P1.1 test above establishes).
    writeDocument(join(repo, rel), before);
    commitPaths(repo, [rel], 'feat(directives): add no-direct-db-access');
    expect(git(repo, ['ls-files', rel]).trim()).toBe(rel);
    const commitsBeforeEdit = Number(git(repo, ['rev-list', '--count', 'HEAD']).trim());

    // When — its content is edited and saved, then committed.
    writeDocument(join(repo, rel), after);
    // ` M` = tracked and modified in the working tree — NOT `??` (untracked) or `A ` (newly added).
    // Compared untrimmed: the leading column is index status, and trimming it away would let an
    // added-file result pass this line.
    expect(git(repo, ['status', '--porcelain'])).toBe(` M ${rel}\n`);
    commitPaths(repo, [rel], 'refactor(directives): widen no-direct-db-access to jobs');

    // Then — the change is captured as a git commit (exactly one, touching exactly this path).
    expect(Number(git(repo, ['rev-list', '--count', 'HEAD']).trim())).toBe(commitsBeforeEdit + 1);
    expect(git(repo, ['show', '--name-only', '--format=', 'HEAD']).trim()).toBe(rel);
    expect(git(repo, ['status', '--porcelain'])).toBe('');
    expect(git(repo, ['show', `HEAD:${rel}`])).toBe(after);

    // And — the previous version is retrievable from history.
    expect(git(repo, ['show', `HEAD~1:${rel}`])).toBe(before);
  });
});
