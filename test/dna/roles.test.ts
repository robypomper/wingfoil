/**
 * Role-based binding resolver (REQ-SYS-08, task-034-role-based-binding) — reads `dna.yaml`'s
 * `team.roles`/`team.members`/`team.agents` alone to answer "is this role defined" and "who holds
 * it today", with no directive or workflow file involved (ADR-006's Fit Criterion).
 */
import * as dnaModule from '../../src/dna';
import * as rolesModule from '../../src/dna/roles';
import { DnaYaml } from '../../src/dna/schema';
import {
  assertRoleDefined,
  isRoleDefined,
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

  it('resolves an empty agent list for a DNA file with no team.agents key at all', () => {
    const noAgentsDna: DnaYaml = DnaYaml.parse({
      version: 1.1,
      modules: [{ name: 'core', path: 'src/core' }],
      stacks: { technologies: [{ name: 'TypeScript', category: 'language' }] },
      team: {
        members: [{ name: 'Solo Maintainer', roles: ['developer'] }],
        roles: [{ name: 'developer' }],
      },
      paths: {},
    });

    expect(noAgentsDna.team.agents).toBeUndefined();
    const holders = resolveRoleHolders(noAgentsDna, 'developer');
    expect(holders.members.map((m) => m.name)).toEqual(['Solo Maintainer']);
    expect(holders.agents).toEqual([]);
  });
});

describe('module surface (AC-3, dl-033-canonical-role-resolver option b)', () => {
  it('exports only the P5.4.2 directive-binding primitives — no approval-routing symbol', () => {
    expect(Object.keys(rolesModule).sort()).toEqual([
      'UnknownRoleError',
      'assertRoleDefined',
      'isRoleDefined',
      'resolveRoleHolders',
    ]);
  });

  it('does not re-export any approval-routing symbol from the dna module barrel', () => {
    expect(dnaModule).not.toHaveProperty('resolveApprover');
    expect(dnaModule).not.toHaveProperty('NoRoleHolderError');
  });

  it('still re-exports the four directive-binding symbols from the dna module barrel', () => {
    expect(dnaModule).toHaveProperty('isRoleDefined');
    expect(dnaModule).toHaveProperty('assertRoleDefined');
    expect(dnaModule).toHaveProperty('resolveRoleHolders');
    expect(dnaModule).toHaveProperty('UnknownRoleError');
  });
});
