/**
 * MemoryYaml schema (spec-001-memory-yaml-schema) — independent per-pillar schema, no dependency on
 * dna.yaml or workflows.yaml's schemas (REQ-SYS-02, task-004-decoupled-pillars).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';

import { MemoryYaml } from '../../src/memory/schema';

const MINIMAL_VALID = {
  version: 1.1,
  defaults: {
    states: { sequence: ['draft', 'pending', 'approved'], gates: { pending: { reject: 'draft' } } },
  },
  types: {
    task: {
      path: 'docs/04_memory/{release}/{id}.md',
      id_pattern: 'task-{n}-{slug}',
      states: {
        sequence: ['draft', 'pending', 'backlog', 'in-progress', 'in-review', 'approved', 'done'],
        gates: { pending: { reject: 'draft' }, 'in-review': { reject: 'in-progress' } },
        waiting: ['backlog', 'approved'],
      },
    },
  },
};

describe('MemoryYaml — structural shape (spec-001)', () => {
  it('accepts a minimal valid document', () => {
    const result = MemoryYaml.safeParse(MINIMAL_VALID);
    expect(result.success).toBe(true);
  });

  it('accepts `version: 1.0` — a float, not an int', () => {
    const result = MemoryYaml.safeParse({ ...MINIMAL_VALID, version: 1.0 });
    expect(result.success).toBe(true);
  });

  it('rejects a non-positive version', () => {
    const result = MemoryYaml.safeParse({ ...MINIMAL_VALID, version: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a document with no `types` key', () => {
    const { types: _types, ...rest } = MINIMAL_VALID;
    const result = MemoryYaml.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('preserves unknown fields (`.passthrough()`, spec-009)', () => {
    const result = MemoryYaml.safeParse({ ...MINIMAL_VALID, mysteryField: 'x' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).mysteryField).toBe('x');
    }
  });
});

describe('MemoryYaml — StateMachine semantic checks (spec-001 "Semantic validation (post-parse)")', () => {
  function withTaskStates(states: Record<string, unknown>) {
    return {
      version: 1.1,
      types: {
        task: {
          path: 'docs/04_memory/{release}/{id}.md',
          states,
        },
      },
    };
  }

  it('rejects a `gates` key that is not a member of `sequence`', () => {
    const result = MemoryYaml.safeParse(
      withTaskStates({ sequence: ['draft', 'pending'], gates: { nonexistent: { reject: 'draft' } } }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a `waiting` entry that is not a member of `sequence`', () => {
    const result = MemoryYaml.safeParse(
      withTaskStates({ sequence: ['draft', 'pending'], waiting: ['nonexistent'] }),
    );
    expect(result.success).toBe(false);
  });

  it('accepts a `gates.<state>.reject` target that is off-chain (not a member of `sequence`)', () => {
    // spec-001: "A gates.<state>.reject target need not be a member of sequence: ... may name an
    // off-chain decline state reached by no forward edge (e.g. bug's open: { reject: closed })."
    const result = MemoryYaml.safeParse(
      withTaskStates({ sequence: ['draft', 'open', 'triaged'], gates: { open: { reject: 'closed' } } }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects "deprecated" declared explicitly in `sequence`', () => {
    const result = MemoryYaml.safeParse(withTaskStates({ sequence: ['draft', 'deprecated'] }));
    expect(result.success).toBe(false);
  });

  it('rejects "deprecated" declared explicitly as a `gates` key', () => {
    const result = MemoryYaml.safeParse(
      withTaskStates({ sequence: ['draft', 'pending'], gates: { deprecated: { reject: 'draft' } } }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects "deprecated" declared explicitly as a `gates.<state>.reject` target', () => {
    const result = MemoryYaml.safeParse(
      withTaskStates({ sequence: ['draft', 'pending'], gates: { pending: { reject: 'deprecated' } } }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects "deprecated" declared explicitly in `waiting`', () => {
    const result = MemoryYaml.safeParse(
      withTaskStates({ sequence: ['draft', 'pending'], waiting: ['deprecated'] }),
    );
    expect(result.success).toBe(false);
  });

  it('applies the same checks to `defaults.states`', () => {
    const result = MemoryYaml.safeParse({
      version: 1.1,
      defaults: { states: { sequence: ['draft'], waiting: ['nonexistent'] } },
      types: { task: { path: 'docs/04_memory/{release}/{id}.md' } },
    });
    expect(result.success).toBe(false);
  });

  it('allows a state to be both in `waiting` and a `gates` key', () => {
    const result = MemoryYaml.safeParse(
      withTaskStates({
        sequence: ['draft', 'ready', 'done'],
        gates: { ready: { reject: 'draft' } },
        waiting: ['ready'],
      }),
    );
    expect(result.success).toBe(true);
  });
});

describe('MemoryYaml — validates the real, live docs/self/.wingfoil/memory.yaml', () => {
  it('parses with zero structural or semantic errors', () => {
    const raw = readFileSync(
      join(__dirname, '..', '..', 'docs', 'self', '.wingfoil', 'memory.yaml'),
      'utf-8',
    );
    const data = load(raw);
    const result = MemoryYaml.safeParse(data);
    expect(result.success).toBe(true);
    if (!result.success) {
      // eslint-disable-next-line no-console
      console.error(result.error.issues);
    }
  });
});
