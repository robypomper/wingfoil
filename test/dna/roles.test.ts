/**
 * Role-based binding resolver (REQ-SYS-08, task-034-role-based-binding) — reads `dna.yaml`'s
 * `team.roles`/`team.members`/`team.agents` alone to answer "is this role defined" and "who holds
 * it today", with no directive or workflow file involved (ADR-006's Fit Criterion).
 */
import { DnaYaml } from '../../src/dna/schema';
import {
  assertRoleDefined,
  isRoleDefined,
  NoRoleHolderError,
  resolveApprover,
  resolveRoleHolders,
  UnknownRoleError,
} from '../../src/dna/roles';

const baseDna: DnaYaml = DnaYaml.parse({
  version: 1.1,
  modules: [{ name: 'core', path: 'src/core' }],
  stacks: { technologies: [{ name: 'TypeScript', category: 'language' }] },
  team: {
    members: [
      { name: 'Roberto Pompermaier', email: 'robypomper@gmail.com', roles: ['developer', 'approver'] },
    ],
    agents: [{ name: 'AI agent', executes_as: ['developer', 'reviewer'], approval_authority: false }],
    roles: [
      { name: 'developer' },
      { name: 'reviewer' },
      { name: 'approver' },
      { name: 'qa' },
    ],
  },
  paths: {},
});

describe('isRoleDefined / assertRoleDefined (AC-1)', () => {
  it('is true for a role registered in team.roles', () => {
    expect(isRoleDefined(baseDna, 'developer')).toBe(true);
  });

  it('is false for a role not registered in team.roles', () => {
    expect(isRoleDefined(baseDna, 'ghost')).toBe(false);
  });

  it("assertRoleDefined throws UnknownRoleError with the exact P5.4.2 message for an undefined role", () => {
    expect(() => assertRoleDefined(baseDna, 'ghost')).toThrow(UnknownRoleError);
    expect(() => assertRoleDefined(baseDna, 'ghost')).toThrow(
      "unknown role 'ghost' (not defined in dna.yaml)",
    );
  });

  it('assertRoleDefined does not throw for a defined role', () => {
    expect(() => assertRoleDefined(baseDna, 'developer')).not.toThrow();
  });
});

describe('resolveRoleHolders (AC-2 — Fit Criterion: DNA is the sole source of truth)', () => {
  it('resolves the members and agents currently holding a role', () => {
    const holders = resolveRoleHolders(baseDna, 'developer');
    expect(holders.members.map((m) => m.name)).toEqual(['Roberto Pompermaier']);
    expect(holders.agents.map((a) => a.name)).toEqual(['AI agent']);
  });

  it('resolves an empty member list for a defined role nobody holds', () => {
    const holders = resolveRoleHolders(baseDna, 'qa');
    expect(holders.members).toEqual([]);
    expect(holders.agents).toEqual([]);
  });

  it('throws UnknownRoleError for a role absent from team.roles', () => {
    expect(() => resolveRoleHolders(baseDna, 'ghost')).toThrow(UnknownRoleError);
  });

  it('reassigning a role in DNA alone changes the resolved holders — zero directive/workflow edits', () => {
    const reassigned = DnaYaml.parse({
      ...baseDna,
      team: {
        ...baseDna.team,
        members: [
          { name: 'Roberto Pompermaier', email: 'robypomper@gmail.com', roles: ['approver'] },
          { name: 'New Hire', roles: ['developer'] },
        ],
      },
    });

    expect(resolveRoleHolders(baseDna, 'developer').members.map((m) => m.name)).toEqual([
      'Roberto Pompermaier',
    ]);
    expect(resolveRoleHolders(reassigned, 'developer').members.map((m) => m.name)).toEqual([
      'New Hire',
    ]);
  });
});

describe('resolveApprover (AC-3)', () => {
  it('routes to the role holder (BDD P4.14 "Route a pending approval to the role holder")', () => {
    const approver = resolveApprover(baseDna, 'approver');
    expect(approver.name).toBe('Roberto Pompermaier');
  });

  it(
    "throws NoRoleHolderError with the exact P4.14 message when nobody holds the role",
    () => {
      expect(() => resolveApprover(baseDna, 'qa')).toThrow(NoRoleHolderError);
      expect(() => resolveApprover(baseDna, 'qa')).toThrow(
        "no approver found for role 'qa' in dna.yaml",
      );
    },
  );

  it('throws UnknownRoleError (not NoRoleHolderError) when the role itself is undefined', () => {
    expect(() => resolveApprover(baseDna, 'ghost')).toThrow(UnknownRoleError);
  });
});
