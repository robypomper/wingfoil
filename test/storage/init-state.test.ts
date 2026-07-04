/**
 * task-003-git-backed-sot — initialization-marker detection (spec-011-storage-layout,
 * "Initialization-marker detection algorithm"): a project is WingFoil-initialized when `.wingfoil/`
 * exists AND is non-empty. No other marker file is used (per the task's Description).
 */
import { mkdirSync } from 'fs';
import { join } from 'path';

import { detectInitState } from '../../src/storage/init-state';
import { makeTempGitRepo, removeTempDir, writeFixtureFile } from './helpers/git-fixture';

describe('detectInitState', () => {
  let repo: string;

  afterEach(() => removeTempDir(repo));

  it('reports "absent" when .wingfoil/ does not exist', () => {
    repo = makeTempGitRepo();
    expect(detectInitState(repo)).toBe('absent');
  });

  it('reports "incomplete" when .wingfoil/ exists but is empty', () => {
    repo = makeTempGitRepo();
    mkdirSync(join(repo, '.wingfoil'), { recursive: true });
    expect(detectInitState(repo)).toBe('incomplete');
  });

  it('reports "initialized" when .wingfoil/ contains at least one file', () => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, '.wingfoil/dna.yaml', 'version: 1.1\n');
    expect(detectInitState(repo)).toBe('initialized');
  });

  it('reports "initialized" even when the only entry is a subdirectory (non-emptiness only)', () => {
    repo = makeTempGitRepo();
    mkdirSync(join(repo, '.wingfoil', 'directives'), { recursive: true });
    expect(detectInitState(repo)).toBe('initialized');
  });
});
