/**
 * Git-identity pre-flight check (REQ-SEC-01, adr-006 — task-014-git-identity-required). Every
 * state-mutating operation must call `requireGitIdentity` before writing anything; with `user.name`
 * and/or `user.email` unset it refuses with the exact spec message and no side effects.
 *
 * The "unset" cases are made deterministic regardless of the host machine's own git identity by
 * pointing `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM` at an empty file and disabling system config, so a
 * fresh `git init` repo genuinely has no identity unless this test sets a local one.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { requireGitIdentity } from '../../src/core/git-identity';

const IDENTITY_ERROR = 'git identity not configured (user.name/user.email)';
const ISOLATION_KEYS = ['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM', 'GIT_CONFIG_NOSYSTEM'] as const;

function setLocalConfig(dir: string, key: string, value: string): void {
  execFileSync('git', ['-C', dir, 'config', key, value], { encoding: 'utf-8' });
}

describe('requireGitIdentity (REQ-SEC-01, adr-006)', () => {
  let dir: string;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'wf-identity-'));
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

  it('refuses with the exact REQ-SEC-01 message when neither user.name nor user.email is set', () => {
    expect(requireGitIdentity(dir)).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION', message: IDENTITY_ERROR },
    });
  });

  it('refuses when only user.name is set (email still missing)', () => {
    setLocalConfig(dir, 'user.name', 'Test Dev');
    expect(requireGitIdentity(dir)).toMatchObject({ ok: false, error: { message: IDENTITY_ERROR } });
  });

  it('refuses when only user.email is set (name still missing)', () => {
    setLocalConfig(dir, 'user.email', 'dev@example.com');
    expect(requireGitIdentity(dir)).toMatchObject({ ok: false, error: { message: IDENTITY_ERROR } });
  });

  it('succeeds when both user.name and user.email are configured', () => {
    setLocalConfig(dir, 'user.name', 'Test Dev');
    setLocalConfig(dir, 'user.email', 'dev@example.com');
    expect(requireGitIdentity(dir).ok).toBe(true);
  });
});
