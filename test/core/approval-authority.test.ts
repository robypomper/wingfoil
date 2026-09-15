/**
 * Role-based approval authority (REQ-SEC-03, adr-006-git-identity-role-based-authz —
 * task-040-role-based-approval-authority). Mirrors `test/core/git-identity.test.ts`'s isolation
 * pattern for the git-identity-resolution cases, and `test/memory/state-machine.test.ts`'s
 * real-config-fixture pattern for the pure role-lookup cases (parses the REAL
 * `docs/self/.wingfoil/dna.yaml`, whose one `team.members` entry — Roberto Pompermaier,
 * `robypomper@gmail.com` — holds the `approver` role among others).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'fs';
import { load } from 'js-yaml';

import { DnaYaml } from '../../src/dna/schema';
import { hasApproverRole, requireApprovalAuthority, resolveMemberRoles } from '../../src/core/approval-authority';

const raw = readFileSync(join(__dirname, '..', '..', 'docs', 'self', '.wingfoil', 'dna.yaml'), 'utf-8');
const realDna = DnaYaml.parse(load(raw));

const REVIEWER_ONLY_DNA: DnaYaml = {
  version: 1,
  modules: [],
  stacks: {},
  team: {
    members: [
      { name: 'Approver Amy', email: 'amy@example.com', roles: ['approver'] },
      { name: 'Reviewer Ray', email: 'ray@example.com', roles: ['reviewer', 'developer'] },
    ],
    roles: [{ name: 'approver' }, { name: 'reviewer' }, { name: 'developer' }],
  },
  paths: {},
};

describe('resolveMemberRoles / hasApproverRole — pure role lookup (REQ-SEC-03)', () => {
  it('resolves the real dna.yaml member roles for a matching email (case-insensitive)', () => {
    expect(resolveMemberRoles(realDna, 'robypomper@gmail.com')).toEqual(
      expect.arrayContaining(['approver', 'developer']),
    );
    expect(resolveMemberRoles(realDna, 'RobyPomper@Gmail.com')).toEqual(
      expect.arrayContaining(['approver']),
    );
  });

  it('returns an empty role list for an email with no matching team member', () => {
    expect(resolveMemberRoles(realDna, 'nobody@example.com')).toEqual([]);
  });

  it('returns an empty role list for an empty email', () => {
    expect(resolveMemberRoles(realDna, '')).toEqual([]);
  });

  it('hasApproverRole: true for the real approver, false for a reviewer-only member', () => {
    expect(hasApproverRole(realDna, 'robypomper@gmail.com')).toBe(true);
    expect(hasApproverRole(REVIEWER_ONLY_DNA, 'ray@example.com')).toBe(false);
    expect(hasApproverRole(REVIEWER_ONLY_DNA, 'amy@example.com')).toBe(true);
  });

  it('hasApproverRole: false for an unknown email', () => {
    expect(hasApproverRole(realDna, 'nobody@example.com')).toBe(false);
  });
});

describe('requireApprovalAuthority — git-identity-gated CoreResult (REQ-SEC-03)', () => {
  let dir: string;
  const isolationKeys = ['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM', 'GIT_CONFIG_NOSYSTEM'] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'wf-approval-authority-'));
    execFileSync('git', ['-C', dir, 'init', '-q'], { encoding: 'utf-8' });
    const emptyConfig = join(dir, 'empty.gitconfig');
    writeFileSync(emptyConfig, '');
    for (const key of isolationKeys) saved[key] = process.env[key];
    process.env.GIT_CONFIG_GLOBAL = emptyConfig;
    process.env.GIT_CONFIG_SYSTEM = emptyConfig;
    process.env.GIT_CONFIG_NOSYSTEM = '1';
  });

  afterEach(() => {
    for (const key of isolationKeys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    rmSync(dir, { recursive: true, force: true });
  });

  function setLocalConfig(key: string, value: string): void {
    execFileSync('git', ['-C', dir, 'config', key, value], { encoding: 'utf-8' });
  }

  it('rejects with the exact REQ-SEC-03 message + VALIDATION code when the committer email holds no approver role', () => {
    setLocalConfig('user.name', 'Reviewer Ray');
    setLocalConfig('user.email', 'ray@example.com');
    expect(requireApprovalAuthority(dir, REVIEWER_ONLY_DNA, 'task')).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION', message: "user not authorized to approve type 'task'" },
    });
  });

  it('rejects when the committer email matches no team member at all', () => {
    setLocalConfig('user.name', 'Stranger');
    setLocalConfig('user.email', 'stranger@example.com');
    expect(requireApprovalAuthority(dir, REVIEWER_ONLY_DNA, 'adr')).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION', message: "user not authorized to approve type 'adr'" },
    });
  });

  it('succeeds when the committer email matches a team member holding the approver role', () => {
    setLocalConfig('user.name', 'Approver Amy');
    setLocalConfig('user.email', 'amy@example.com');
    expect(requireApprovalAuthority(dir, REVIEWER_ONLY_DNA, 'task').ok).toBe(true);
  });

  it('succeeds against the real dna.yaml for its configured approver (Roberto)', () => {
    setLocalConfig('user.name', 'Roberto Pompermaier');
    setLocalConfig('user.email', 'robypomper@gmail.com');
    expect(requireApprovalAuthority(dir, realDna, 'release').ok).toBe(true);
  });

  it('the error type-interpolation reflects the exact `typeName` argument passed in', () => {
    setLocalConfig('user.name', 'Reviewer Ray');
    setLocalConfig('user.email', 'ray@example.com');
    expect(requireApprovalAuthority(dir, REVIEWER_ONLY_DNA, 'decision-log')).toMatchObject({
      error: { message: "user not authorized to approve type 'decision-log'" },
    });
  });
});
