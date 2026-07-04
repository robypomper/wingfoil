/**
 * task-003-git-backed-sot — state snapshot reconstruction: the direct test of REQ-SYS-01's SARD fit
 * criterion (docs/02_requirements/03_sard/01_architecture.md):
 *
 *   "A fresh git clone of the repository reconstructs 100% of Memory/DNA/Directives/Workflow state
 *   with no external data source; a state dump before and after clone is byte-identical."
 *
 * Acceptance Criteria covered (task-003-git-backed-sot.md):
 *  - Cloning to a fresh directory and snapshotting `.wingfoil/**` + every `docs/04_memory/**/*.md`
 *    frontmatter produces a byte-identical snapshot to the original working copy at the same commit.
 *  - No file/directory outside the git-tracked tree is required to reconstruct state.
 *  - Deleting any in-process cache and recomputing from disk yields the same result.
 */
import { computeStateSnapshot, serializeSnapshot } from '../../src/storage/snapshot';
import {
  cloneTempRepo,
  commitAll,
  makeTempGitRepo,
  removeTempDir,
  writeFixtureFile,
} from './helpers/git-fixture';

function seedFixtureRepo(): string {
  const repo = makeTempGitRepo();

  // DNA / Directives / Workflow config — lives entirely under .wingfoil/.
  writeFixtureFile(repo, '.wingfoil/dna.yaml', 'version: 1.1\nmodules:\n  - name: core\n');
  writeFixtureFile(repo, '.wingfoil/memory.yaml', 'version: 1.1\ntypes:\n  task:\n    path: x\n');
  writeFixtureFile(repo, '.wingfoil/roles.yaml', 'assignments:\n  developer: [ testing ]\n');
  writeFixtureFile(
    repo,
    '.wingfoil/directives/custom/testing.md',
    '# Testing directive\n\nTDD, coverage > 80%.\n',
  );

  // Memory content — lives under docs/04_memory/, state derived from frontmatter only.
  writeFixtureFile(
    repo,
    'docs/04_memory/v0.1/task-003-git-backed-sot.md',
    ['---', 'id: task-003-git-backed-sot', 'status: in-progress', '---', '', '## Body text', ''].join(
      '\n',
    ),
  );

  // A non-.md file under docs/04_memory/ (should be ignored by the Memory half of the snapshot) and
  // a file entirely outside both tracked subtrees (should never appear in the snapshot at all).
  writeFixtureFile(repo, 'docs/04_memory/v0.1/notes.txt', 'not a memory document');
  writeFixtureFile(repo, 'README.md', '# Not part of WingFoil state\n');

  commitAll(repo, 'seed fixture state');
  return repo;
}

describe('computeStateSnapshot — REQ-SYS-01 fit criterion', () => {
  let repo: string;
  let clone: string;

  afterEach(() => {
    removeTempDir(repo);
    if (clone) removeTempDir(clone);
  });

  it('produces a byte-identical snapshot from a fresh git clone', () => {
    repo = seedFixtureRepo();
    const before = computeStateSnapshot(repo);

    clone = cloneTempRepo(repo);
    const after = computeStateSnapshot(clone);

    expect(serializeSnapshot(after)).toBe(serializeSnapshot(before));
    expect(after).toEqual(before); // paths are root-relative, so a deep-equal holds too
  });

  it('includes every .wingfoil/ file in full and every Memory doc as frontmatter-only', () => {
    repo = seedFixtureRepo();
    const snapshot = computeStateSnapshot(repo);
    const byPath = new Map(snapshot.map((e) => [e.path, e.content]));

    expect(byPath.get('.wingfoil/dna.yaml')).toBe('version: 1.1\nmodules:\n  - name: core\n');
    expect(byPath.get('.wingfoil/directives/custom/testing.md')).toBe(
      '# Testing directive\n\nTDD, coverage > 80%.\n',
    );
    expect(byPath.get('docs/04_memory/v0.1/task-003-git-backed-sot.md')).toBe(
      'id: task-003-git-backed-sot\nstatus: in-progress',
    );
  });

  it('excludes files outside .wingfoil/ and docs/04_memory/, and non-.md Memory files', () => {
    repo = seedFixtureRepo();
    const paths = computeStateSnapshot(repo).map((e) => e.path);

    expect(paths).not.toContain('README.md');
    expect(paths).not.toContain('docs/04_memory/v0.1/notes.txt');
    expect(paths.some((p) => p.startsWith('.wingfoil/state'))).toBe(false);
  });

  it('is stable across repeated calls with no cache (no accumulating or drifting state)', () => {
    repo = seedFixtureRepo();
    const first = serializeSnapshot(computeStateSnapshot(repo));
    const second = serializeSnapshot(computeStateSnapshot(repo));
    expect(second).toBe(first);
  });

  it('is stable after the module is freshly re-imported (no module-level cache/state)', () => {
    repo = seedFixtureRepo();
    const first = serializeSnapshot(computeStateSnapshot(repo));

    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const reimported = require('../../src/storage/snapshot') as typeof import('../../src/storage/snapshot');
    const second = reimported.serializeSnapshot(reimported.computeStateSnapshot(repo));

    expect(second).toBe(first);
  });

  it('reflects a change on disk immediately (recompute-from-disk is not memoized)', () => {
    repo = seedFixtureRepo();
    const before = serializeSnapshot(computeStateSnapshot(repo));

    writeFixtureFile(repo, '.wingfoil/dna.yaml', 'version: 1.2\nmodules: []\n');
    const after = serializeSnapshot(computeStateSnapshot(repo));

    expect(after).not.toBe(before);
  });
});
