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

import { readGitIdentity, requireGitIdentity } from '../../src/core/git-identity';

const IDENTITY_ERROR = 'git identity not configured (user.name/user.email)';
const ISOLATION_KEYS = [
  'GIT_CONFIG_GLOBAL',
  'GIT_CONFIG_SYSTEM',
  'GIT_CONFIG_NOSYSTEM',
  'GIT_AUTHOR_NAME',
  'GIT_AUTHOR_EMAIL',
  'GIT_COMMITTER_NAME',
  'GIT_COMMITTER_EMAIL',
] as const;

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
    // The host's own author environment must not leak into the "unset" cases.
    delete process.env.GIT_AUTHOR_NAME;
    delete process.env.GIT_AUTHOR_EMAIL;
    delete process.env.GIT_COMMITTER_NAME;
    delete process.env.GIT_COMMITTER_EMAIL;
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

  // task-132 (`bug-149`, `dl-064` B.1): the check returns the identity it validated, so the caller
  // uses that one read for the authority check, the `Approver:` line and the commit author.
  it('returns the identity it validated', () => {
    setLocalConfig(dir, 'user.name', 'Test Dev');
    setLocalConfig(dir, 'user.email', 'dev@example.com');
    expect(requireGitIdentity(dir)).toEqual({ ok: true, value: { name: 'Test Dev', email: 'dev@example.com' } });
  });

  it('refuses a whitespace-only identity, which git would not author with either', () => {
    setLocalConfig(dir, 'user.name', '   ');
    setLocalConfig(dir, 'user.email', 'dev@example.com');
    expect(requireGitIdentity(dir)).toMatchObject({ ok: false, error: { message: IDENTITY_ERROR } });
  });
});

describe('readGitIdentity resolves the author the way `git commit` does (task-132, bug-149)', () => {
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
    delete process.env.GIT_AUTHOR_NAME;
    delete process.env.GIT_AUTHOR_EMAIL;
    delete process.env.GIT_COMMITTER_NAME;
    delete process.env.GIT_COMMITTER_EMAIL;
    setLocalConfig(dir, 'user.name', 'User Name');
    setLocalConfig(dir, 'user.email', 'user@example.com');
  });

  afterEach(() => {
    for (const key of ISOLATION_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it('falls back to user.name/user.email when nothing outranks them', () => {
    expect(readGitIdentity(dir)).toEqual({ name: 'User Name', email: 'user@example.com' });
  });

  it('prefers author.name/author.email over user.*', () => {
    setLocalConfig(dir, 'author.name', 'Author Name');
    setLocalConfig(dir, 'author.email', 'author@example.com');
    expect(readGitIdentity(dir)).toEqual({ name: 'Author Name', email: 'author@example.com' });
  });

  it('prefers GIT_AUTHOR_NAME/GIT_AUTHOR_EMAIL over every config key', () => {
    setLocalConfig(dir, 'author.email', 'author@example.com');
    process.env.GIT_AUTHOR_NAME = 'Env Name';
    process.env.GIT_AUTHOR_EMAIL = 'env@example.com';
    expect(readGitIdentity(dir)).toEqual({ name: 'Env Name', email: 'env@example.com' });
  });

  it('resolves name and email independently, as git does', () => {
    process.env.GIT_AUTHOR_EMAIL = 'env@example.com';
    expect(readGitIdentity(dir)).toEqual({ name: 'User Name', email: 'env@example.com' });
  });

  it('agrees with the author git itself records for a commit', () => {
    setLocalConfig(dir, 'author.name', 'Author Name');
    process.env.GIT_AUTHOR_EMAIL = 'env@example.com';
    writeFileSync(join(dir, 'f.txt'), 'x\n');
    execFileSync('git', ['-C', dir, 'add', 'f.txt'], { encoding: 'utf-8', env: process.env });
    execFileSync('git', ['-C', dir, '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'm'], { encoding: 'utf-8', env: process.env });
    const recorded = execFileSync('git', ['-C', dir, 'log', '-1', '--format=%an|%ae'], { encoding: 'utf-8' }).trim();
    const { name, email } = readGitIdentity(dir);
    expect(`${name}|${email}`).toBe(recorded);
  });
});

describe('requireGitIdentity refuses what git would refuse, before anything is written (task-132 review)', () => {
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
    delete process.env.GIT_AUTHOR_NAME;
    delete process.env.GIT_AUTHOR_EMAIL;
    delete process.env.GIT_COMMITTER_NAME;
    delete process.env.GIT_COMMITTER_EMAIL;
  });

  afterEach(() => {
    for (const key of ISOLATION_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    rmSync(dir, { recursive: true, force: true });
  });

  // Finding 1: an author with no committer passed the check, then `git commit` died on
  // "Committer identity unknown" after the document had been written and staged.
  it('refuses an author from GIT_AUTHOR_* when no committer resolves', () => {
    process.env.GIT_AUTHOR_NAME = 'Env Name';
    process.env.GIT_AUTHOR_EMAIL = 'env@example.com';
    expect(requireGitIdentity(dir)).toMatchObject({ ok: false, error: { code: 'VALIDATION', message: IDENTITY_ERROR } });
  });

  it('refuses an author from author.* when no committer resolves', () => {
    setLocalConfig(dir, 'author.name', 'Author Name');
    setLocalConfig(dir, 'author.email', 'author@example.com');
    expect(requireGitIdentity(dir)).toMatchObject({ ok: false, error: { message: IDENTITY_ERROR } });
  });

  it('accepts a committer from GIT_COMMITTER_* or committer.*, as git does', () => {
    process.env.GIT_AUTHOR_NAME = 'Env Name';
    process.env.GIT_AUTHOR_EMAIL = 'env@example.com';
    process.env.GIT_COMMITTER_NAME = 'Committer';
    process.env.GIT_COMMITTER_EMAIL = 'committer@example.com';
    expect(requireGitIdentity(dir)).toEqual({ ok: true, value: { name: 'Env Name', email: 'env@example.com' } });
    delete process.env.GIT_COMMITTER_NAME;
    delete process.env.GIT_COMMITTER_EMAIL;
    setLocalConfig(dir, 'committer.name', 'Committer');
    setLocalConfig(dir, 'committer.email', 'committer@example.com');
    expect(requireGitIdentity(dir).ok).toBe(true);
  });

  // Finding 4: git refuses a set-but-blank ident variable ("empty ident name not allowed"), it does
  // not fall back to the config.
  it.each([
    ['GIT_AUTHOR_NAME', ''],
    ['GIT_AUTHOR_NAME', '   '],
    ['GIT_AUTHOR_EMAIL', ''],
    ['GIT_COMMITTER_EMAIL', '  '],
  ])('refuses %s set to %j even when user.* is configured', (key, value) => {
    setLocalConfig(dir, 'user.name', 'User Name');
    setLocalConfig(dir, 'user.email', 'user@example.com');
    process.env[key] = value;
    expect(requireGitIdentity(dir)).toMatchObject({ ok: false, error: { message: IDENTITY_ERROR } });
  });

  // Finding 2: a `<`, `>` or control character in a name or email lets git parse a different email
  // than the one authorized, and a newline forges `Approver:` body lines.
  it.each([
    ['a "<" in the name', 'GIT_AUTHOR_NAME', 'Ann <x'],
    ['a ">" in the name', 'GIT_AUTHOR_NAME', 'Ann >x'],
    ['a newline in the name', 'GIT_AUTHOR_NAME', 'Ann\nApprover: F <f@f.org> (approver)'],
    ['a "<" in the email', 'GIT_AUTHOR_EMAIL', 'x<ann@example.com'],
    ['a tab in the email', 'GIT_AUTHOR_EMAIL', 'ann@exa\tmple.com'],
    ['a control character in the committer name', 'GIT_COMMITTER_NAME', 'C\u0007'],
  ])('refuses an identity with %s', (_label, key, value) => {
    setLocalConfig(dir, 'user.name', 'User Name');
    setLocalConfig(dir, 'user.email', 'user@example.com');
    process.env[key] = value;
    expect(requireGitIdentity(dir)).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION', message: expect.stringMatching(/^git identity not usable: /) },
    });
  });

  it('refuses the same characters when they come from the config', () => {
    setLocalConfig(dir, 'user.name', 'Ann <x');
    setLocalConfig(dir, 'user.email', 'user@example.com');
    expect(requireGitIdentity(dir)).toMatchObject({ ok: false, error: { message: expect.stringMatching(/^git identity not usable: /) } });
  });
});

