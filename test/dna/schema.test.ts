/**
 * DnaYaml schema (spec-002-dna-yaml-schema) — independent per-pillar schema, no dependency on
 * memory.yaml or workflows.yaml's schemas (REQ-SYS-02, task-004-decoupled-pillars).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';

import { DnaYaml } from '../../src/dna/schema';

// Copied from spec-002's own "Minimal valid instance".
const MINIMAL_VALID = {
  version: 1.1,
  modules: [{ name: 'core', path: 'src/core' }],
  stacks: {
    technologies: [
      { name: 'TypeScript', category: 'language' },
      { name: 'Node.js', category: 'runtime', version: '18+' },
    ],
  },
  team: {
    members: [{ name: 'Roberto Pompermaier', email: 'robypomper@gmail.com', roles: ['developer', 'approver'] }],
    roles: [{ name: 'developer' }, { name: 'approver' }],
  },
  paths: {
    sources: ['src/'],
    tests: ['test/'],
    docs: ['docs/'],
    config: ['package.json'],
    governance: ['docs/self/.wingfoil/'],
  },
};

describe('DnaYaml — structural shape (spec-002)', () => {
  it('accepts the spec-002 minimal valid instance', () => {
    const result = DnaYaml.safeParse(MINIMAL_VALID);
    expect(result.success).toBe(true);
  });

  it('rejects a non-positive version', () => {
    const result = DnaYaml.safeParse({ ...MINIMAL_VALID, version: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects a document missing `modules`', () => {
    const rest: Record<string, unknown> = { ...MINIMAL_VALID };
    delete rest.modules;
    const result = DnaYaml.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('preserves unknown fields (`.passthrough()`)', () => {
    const result = DnaYaml.safeParse({ ...MINIMAL_VALID, mysteryField: 'x' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).mysteryField).toBe('x');
    }
  });
});

describe('DnaYaml — role-binding semantic check (spec-002 "Role binding (REQ-SYS-08)")', () => {
  it('rejects a `team.members[].roles` entry not present in `team.roles`', () => {
    const result = DnaYaml.safeParse({
      ...MINIMAL_VALID,
      team: {
        members: [{ name: 'X', roles: ['not-a-real-role'] }],
        roles: [{ name: 'developer' }],
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a `team.agents[].executes_as` entry not present in `team.roles`', () => {
    const result = DnaYaml.safeParse({
      ...MINIMAL_VALID,
      team: {
        members: [{ name: 'X', roles: ['developer'] }],
        agents: [{ name: 'AI agent', executes_as: ['not-a-real-role'], approval_authority: false }],
        roles: [{ name: 'developer' }],
      },
    });
    expect(result.success).toBe(false);
  });

  it('accepts role names that are all registered in `team.roles`', () => {
    const result = DnaYaml.safeParse({
      ...MINIMAL_VALID,
      team: {
        members: [{ name: 'X', roles: ['developer', 'approver'] }],
        agents: [{ name: 'AI agent', executes_as: ['developer'], approval_authority: false }],
        roles: [{ name: 'developer' }, { name: 'approver' }],
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('DnaYaml — validates the real, live docs/self/.wingfoil/dna.yaml', () => {
  it('parses with zero structural or semantic errors', () => {
    const raw = readFileSync(join(__dirname, '..', '..', 'docs', 'self', '.wingfoil', 'dna.yaml'), 'utf-8');
    const data = load(raw);
    const result = DnaYaml.safeParse(data);
    expect(result.success).toBe(true);
    if (!result.success) {
      console.error(result.error.issues);
    }
  });
});
