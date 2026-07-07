/**
 * task-018-implement-git-backed-storage (P1.1, REQ-SYS-01) — `initWingfoilStorage`, the CoreResult
 * wrapper that surfaces `.wingfoil/` initialization as a domain operation behind both surfaces
 * (REQ-SYS-05). It wires the two guard rails the BDD acceptance contract requires as `CoreResult`
 * errors so they map to exit 1 (spec-005 §1, exitCodeForError):
 *   - "Error - target directory is not a git repository" → error message
 *     "not a git repository: run 'git init' first", and .wingfoil/ is NOT created.
 *   - the git-identity pre-flight (REQ-SEC-01, task-014) refuses an unattributable commit.
 * The user-facing `wingfoil init` CLI command/wizard is task-029's scope, not this task's.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { exitCodeForResult } from '../../src/core';
import { initWingfoilStorage } from '../../src/core/init';
import { makeTempGitRepo, removeTempDir } from '../storage/helpers/git-fixture';

const NOT_A_GIT_REPO = "not a git repository: run 'git init' first";
const ISOLATION_KEYS = ['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM', 'GIT_CONFIG_NOSYSTEM'] as const;

describe('initWingfoilStorage (P1.1, REQ-SYS-01)', () => {
  describe('Error - target directory is not a git repository (scenario 3)', () => {
    let dir: string;
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it('returns a VALIDATION error with the exact message and creates no .wingfoil/', () => {
      dir = mkdtempSync(join(tmpdir(), 'wf-not-a-repo-'));
      const result = initWingfoilStorage(dir);

      expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION', message: NOT_A_GIT_REPO } });
      expect(existsSync(join(dir, '.wingfoil'))).toBe(false);
    });

    it('the not-a-git-repo error maps to exit code 1 (spec-005 §1)', () => {
      dir = mkdtempSync(join(tmpdir(), 'wf-not-a-repo-'));
      expect(exitCodeForResult(initWingfoilStorage(dir))).toBe(1);
    });
  });

  describe('git-identity pre-flight (REQ-SEC-01)', () => {
    let dir: string;
    const saved: Record<string, string | undefined> = {};

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'wf-init-noid-'));
      execFileSync('git', ['-C', dir, 'init', '-q'], { encoding: 'utf-8' });
      const emptyConfig = join(dir, 'empty.gitconfig');
      writeFileSync(emptyConfig, '');
      for (const key of ISOLATION_KEYS) saved[key] = process.env[key];
      process.env.GIT_CONFIG_GLOBAL = emptyConfig;
      process.env.GIT_CONFIG_SYSTEM = emptyConfig;
      process.env.GIT_CONFIG_NOSYSTEM = '1';
    });

    afterEach(() => {
      for (const key of ISOLATION_KEYS) {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
      }
      rmSync(dir, { recursive: true, force: true });
    });

    it('refuses (VALIDATION, exit 1) when no git identity is configured', () => {
      const result = initWingfoilStorage(dir);
      expect(result.ok).toBe(false);
      expect(exitCodeForResult(result)).toBe(1);
    });
  });

  describe('success', () => {
    let repo: string;
    afterEach(() => removeTempDir(repo));

    it('initializes and returns ok with the produced commit {sha, message}', () => {
      repo = makeTempGitRepo();
      const result = initWingfoilStorage(repo);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.commit?.sha).toMatch(/^[0-9a-f]{40}$/);
        expect(result.commit?.message.length).toBeGreaterThan(0);
      }
      expect(existsSync(join(repo, '.wingfoil', 'dna.yaml'))).toBe(true);
      expect(exitCodeForResult(result)).toBe(0);
    });
  });
});
