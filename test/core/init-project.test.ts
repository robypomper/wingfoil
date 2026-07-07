/**
 * task-029-implement-wingfoil-init (P5.1.1, spec-011-storage-layout, spec-005-cli-command-contract §1)
 * — `initWingfoilProject`, the CoreResult flow `wingfoil init` drives on both surfaces (REQ-SYS-05).
 * Covers the P5.1.1 BDD contract at the domain layer:
 *   (a) a chosen template creates the COMPLETE `.wingfoil/` layout in exactly one commit, exit 0;
 *   (c) an already-initialized project overwrites NOTHING and fails with the exact message, exit 1.
 * The not-a-git-repo and git-identity guards are inherited from task-018's write path.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { exitCodeForResult } from '../../src/core';
import {
  WINGFOIL_ALREADY_INITIALIZED,
  initWingfoilProject,
} from '../../src/core/init';
import { makeTempGitRepo, removeTempDir } from '../storage/helpers/git-fixture';

const NOT_A_GIT_REPO = "not a git repository: run 'git init' first";

function headSha(root: string): string {
  return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim();
}

describe('initWingfoilProject — success (P5.1.1 AC (a))', () => {
  let repo: string;
  afterEach(() => removeTempDir(repo));

  it('creates the complete .wingfoil/ layout and returns ok with one commit, exit 0', () => {
    repo = makeTempGitRepo();
    const result = initWingfoilProject(repo, 'Scrum');

    expect(result.ok).toBe(true);
    expect(exitCodeForResult(result)).toBe(0);
    if (result.ok) {
      expect(result.value.template).toBe('Scrum');
      expect(result.commit?.sha).toMatch(/^[0-9a-f]{40}$/);
    }
    // All four pillars materialized on disk.
    expect(existsSync(join(repo, '.wingfoil', 'dna.yaml'))).toBe(true);
    expect(existsSync(join(repo, '.wingfoil', 'memory.yaml'))).toBe(true);
    expect(existsSync(join(repo, '.wingfoil', 'roles.yaml'))).toBe(true);
    expect(existsSync(join(repo, '.wingfoil', 'workflows.yaml'))).toBe(true);
    expect(existsSync(join(repo, '.wingfoil', 'directives', 'custom'))).toBe(true);
    expect(existsSync(join(repo, '.wingfoil', 'memory', 'templates', 'task.md'))).toBe(true);
    expect(existsSync(join(repo, '.wingfoil', 'workflows', 'custom', 'sw-life-cycle.yaml'))).toBe(true);
  });

  it('records the whole layout in a SINGLE commit (spec-011 / CLAUDE.md §5.1)', () => {
    repo = makeTempGitRepo();
    const before = execFileSync('git', ['-C', repo, 'rev-list', '--count', 'HEAD'], {
      encoding: 'utf-8',
    }).trim();
    initWingfoilProject(repo, 'Kanban');
    const after = execFileSync('git', ['-C', repo, 'rev-list', '--count', 'HEAD'], {
      encoding: 'utf-8',
    }).trim();
    expect(Number(after) - Number(before)).toBe(1);
  });
});

describe('initWingfoilProject — already initialized (P5.1.1 AC (c))', () => {
  let repo: string;
  afterEach(() => removeTempDir(repo));

  it('overwrites nothing and fails with the exact message, exit 1', () => {
    repo = makeTempGitRepo();
    initWingfoilProject(repo, 'Scrum');

    const dnaPath = join(repo, '.wingfoil', 'dna.yaml');
    const dnaBefore = readFileSync(dnaPath, 'utf-8');
    const shaBefore = headSha(repo);

    const result = initWingfoilProject(repo, 'Kanban');

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION', message: WINGFOIL_ALREADY_INITIALIZED },
    });
    expect(WINGFOIL_ALREADY_INITIALIZED).toBe(
      'WingFoil already initialized (use a migration command to change config)',
    );
    expect(exitCodeForResult(result)).toBe(1);
    // Nothing overwritten: the Scrum dna.yaml and HEAD are untouched.
    expect(readFileSync(dnaPath, 'utf-8')).toBe(dnaBefore);
    expect(headSha(repo)).toBe(shaBefore);
  });
});

describe('initWingfoilProject — guards inherited from the write path', () => {
  it('returns the exact not-a-git-repo VALIDATION error and creates no .wingfoil/', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wf-init-nogit-'));
    try {
      const result = initWingfoilProject(dir, 'Scrum');
      expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION', message: NOT_A_GIT_REPO } });
      expect(existsSync(join(dir, '.wingfoil'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects an unknown template (defense-in-depth VALIDATION) and writes nothing', () => {
    const repo = makeTempGitRepo();
    try {
      const result = initWingfoilProject(repo, 'NopeTemplate');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('VALIDATION');
      expect(existsSync(join(repo, '.wingfoil'))).toBe(false);
    } finally {
      removeTempDir(repo);
    }
  });
});
