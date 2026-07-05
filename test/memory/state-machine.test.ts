/**
 * State-machine transition-legality engine (spec-001-memory-yaml-schema, REQ-SYS-04,
 * task-005-per-type-state-machines). Exercises `resolveStateMachine` + `resolveTransitionTarget`
 * against the real 7 types registered in `docs/self/.wingfoil/memory.yaml` (per the task's
 * Acceptance Criteria) plus illegal-transition rejection. Does NOT exercise the "type declares no
 * `states` block, falls back to `defaults`" fixture — that is task-010-default-state-machine-fallback's
 * scope (see `src/memory/state-machine.ts`'s module doc).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';

import { MemoryYaml } from '../../src/memory/schema';
import {
  DEPRECATED_STATE,
  E_INVALID_TRANSITION,
  resolveStateMachine,
  resolveTransitionTarget,
} from '../../src/memory/state-machine';
import { ValidationError } from '../../src/validation';

const raw = readFileSync(join(__dirname, '..', '..', 'docs', 'self', '.wingfoil', 'memory.yaml'), 'utf-8');
const memoryYaml = MemoryYaml.parse(load(raw));

describe('resolveStateMachine — REQ-STATE-08 resolution', () => {
  it('resolves each of the 7 registered types to its own declared `states` block', () => {
    for (const typeName of ['release-line', 'release', 'task', 'adr', 'decision-log', 'tech-spec', 'bug']) {
      const machine = resolveStateMachine(memoryYaml, typeName);
      expect(machine).toBe(memoryYaml.types[typeName]!.states);
    }
  });

  it('throws for a type name not registered in `memory.yaml`', () => {
    expect(() => resolveStateMachine(memoryYaml, 'nonexistent-type')).toThrow(/no type "nonexistent-type"/);
  });
});

describe('resolveTransitionTarget — legal transitions for the real 7 types (spec-001 worked examples)', () => {
  it('task: submit draft→pending, approve pending→backlog, reject pending→draft', () => {
    const m = resolveStateMachine(memoryYaml, 'task');
    expect(resolveTransitionTarget(m, 'draft', 'submit')).toBe('pending');
    expect(resolveTransitionTarget(m, 'pending', 'approve')).toBe('backlog');
    expect(resolveTransitionTarget(m, 'pending', 'reject')).toBe('draft');
  });

  it('task: submit in-progress→in-review, approve in-review→approved, reject in-review→in-progress', () => {
    const m = resolveStateMachine(memoryYaml, 'task');
    expect(resolveTransitionTarget(m, 'in-progress', 'submit')).toBe('in-review');
    expect(resolveTransitionTarget(m, 'in-review', 'approve')).toBe('approved');
    expect(resolveTransitionTarget(m, 'in-review', 'reject')).toBe('in-progress');
  });

  it('task: `deprecate` is always legal, from any state, targeting the reserved "deprecated" state', () => {
    const m = resolveStateMachine(memoryYaml, 'task');
    for (const state of ['draft', 'pending', 'backlog', 'in-progress', 'in-review', 'approved', 'done']) {
      expect(resolveTransitionTarget(m, state, 'deprecate')).toBe(DEPRECATED_STATE);
    }
  });

  it('adr: submit draft→pending, approve pending→accepted, reject pending→draft', () => {
    const m = resolveStateMachine(memoryYaml, 'adr');
    expect(resolveTransitionTarget(m, 'draft', 'submit')).toBe('pending');
    expect(resolveTransitionTarget(m, 'pending', 'approve')).toBe('accepted');
    expect(resolveTransitionTarget(m, 'pending', 'reject')).toBe('draft');
  });

  it('decision-log: submit draft→in-discussion, approve in-discussion→ready, reject in-discussion→draft', () => {
    const m = resolveStateMachine(memoryYaml, 'decision-log');
    expect(resolveTransitionTarget(m, 'draft', 'submit')).toBe('in-discussion');
    expect(resolveTransitionTarget(m, 'in-discussion', 'approve')).toBe('ready');
    expect(resolveTransitionTarget(m, 'in-discussion', 'reject')).toBe('draft');
  });

  it('tech-spec: submit draft→pending, approve pending→approved, reject pending→draft', () => {
    const m = resolveStateMachine(memoryYaml, 'tech-spec');
    expect(resolveTransitionTarget(m, 'draft', 'submit')).toBe('pending');
    expect(resolveTransitionTarget(m, 'pending', 'approve')).toBe('approved');
    expect(resolveTransitionTarget(m, 'pending', 'reject')).toBe('draft');
  });

  it('release-line: submit draft→planning, approve planning→active, reject planning→draft', () => {
    const m = resolveStateMachine(memoryYaml, 'release-line');
    expect(resolveTransitionTarget(m, 'draft', 'submit')).toBe('planning');
    expect(resolveTransitionTarget(m, 'planning', 'approve')).toBe('active');
    expect(resolveTransitionTarget(m, 'planning', 'reject')).toBe('draft');
  });

  it('release: submit draft→planning (no `gates` at all — every other edge is `waiting`)', () => {
    const m = resolveStateMachine(memoryYaml, 'release');
    expect(resolveTransitionTarget(m, 'draft', 'submit')).toBe('planning');
  });

  it('bug: submit draft→open, approve open→triaged, reject open→closed (off-chain target)', () => {
    const m = resolveStateMachine(memoryYaml, 'bug');
    expect(resolveTransitionTarget(m, 'draft', 'submit')).toBe('open');
    expect(resolveTransitionTarget(m, 'open', 'approve')).toBe('triaged');
    expect(resolveTransitionTarget(m, 'open', 'reject')).toBe('closed');
  });

  it('bug: approve in-review→resolved, reject in-review→in-progress, approve resolved→closed, reject resolved→in-progress', () => {
    const m = resolveStateMachine(memoryYaml, 'bug');
    expect(resolveTransitionTarget(m, 'in-review', 'approve')).toBe('resolved');
    expect(resolveTransitionTarget(m, 'in-review', 'reject')).toBe('in-progress');
    expect(resolveTransitionTarget(m, 'resolved', 'approve')).toBe('closed');
    expect(resolveTransitionTarget(m, 'resolved', 'reject')).toBe('in-progress');
  });

  it('defaults machine: submit draft→pending, approve pending→approved, reject pending→draft', () => {
    const m = memoryYaml.defaults!.states;
    expect(resolveTransitionTarget(m, 'draft', 'submit')).toBe('pending');
    expect(resolveTransitionTarget(m, 'pending', 'approve')).toBe('approved');
    expect(resolveTransitionTarget(m, 'pending', 'reject')).toBe('draft');
  });
});

describe('resolveTransitionTarget — illegal transitions are rejected, target never returned', () => {
  const taskMachine = () => resolveStateMachine(memoryYaml, 'task');

  it('rejects `submit` from a `gates` state (must use `approve`, not `submit`)', () => {
    expect(() => resolveTransitionTarget(taskMachine(), 'pending', 'submit')).toThrow(ValidationError);
  });

  it('rejects `submit` from a `waiting` state (fires only via a Workflow action)', () => {
    expect(() => resolveTransitionTarget(taskMachine(), 'backlog', 'submit')).toThrow(ValidationError);
    expect(() => resolveTransitionTarget(taskMachine(), 'approved', 'submit')).toThrow(ValidationError);
  });

  it('rejects `approve` from a plain (non-gate) state', () => {
    expect(() => resolveTransitionTarget(taskMachine(), 'draft', 'approve')).toThrow(ValidationError);
    expect(() => resolveTransitionTarget(taskMachine(), 'backlog', 'approve')).toThrow(ValidationError);
  });

  it('rejects `reject` from a plain (non-gate) state', () => {
    expect(() => resolveTransitionTarget(taskMachine(), 'draft', 'reject')).toThrow(ValidationError);
  });

  it('rejects `submit` from the terminal state of `sequence` (no forward edge)', () => {
    expect(() => resolveTransitionTarget(taskMachine(), 'done', 'submit')).toThrow(ValidationError);
  });

  it('rejects any op (except `deprecate`) from a state not a member of `sequence` at all', () => {
    expect(() => resolveTransitionTarget(taskMachine(), 'bogus-state', 'submit')).toThrow(ValidationError);
    expect(() => resolveTransitionTarget(taskMachine(), 'bogus-state', 'approve')).toThrow(ValidationError);
    expect(() => resolveTransitionTarget(taskMachine(), 'bogus-state', 'reject')).toThrow(ValidationError);
    expect(resolveTransitionTarget(taskMachine(), 'bogus-state', 'deprecate')).toBe(DEPRECATED_STATE);
  });

  it('thrown error is a Pass-2 `ValidationError` carrying `E_INVALID_TRANSITION` and exits 2 (spec-009 §3)', () => {
    try {
      resolveTransitionTarget(taskMachine(), 'pending', 'submit', 'docs/04_memory/v0.1/task-x.md');
      throw new Error('expected resolveTransitionTarget to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const validationError = error as ValidationError;
      expect(validationError.exitCode).toBe(2);
      expect(validationError.issues).toHaveLength(1);
      expect(validationError.issues[0]!.code).toBe(E_INVALID_TRANSITION);
      expect(validationError.issues[0]!.file).toBe('docs/04_memory/v0.1/task-x.md');
    }
  });

  it('REQ-STATE-01: an illegal transition throws before any target is returned, so the document `status` is left unchanged', () => {
    const doc = { status: 'pending' };
    expect(() => {
      // A caller would only assign the new status once resolveTransitionTarget returns normally —
      // the illegal `submit` throws first, so this assignment is provably never reached.
      const target = resolveTransitionTarget(taskMachine(), doc.status, 'submit');
      doc.status = target;
    }).toThrow(ValidationError);
    expect(doc.status).toBe('pending');
  });
});

describe('resolveTransitionTarget — a state both `gates` and `waiting` (spec-001\'s explicit dual case)', () => {
  // Synthetic machine — none of the 7 real types currently exercise this combination, but spec-001
  // gives it explicit semantics ("its forward edge is verb-less ... while it still exposes a manual
  // `reject`/decline path"), so the engine must honor it. Mirrors the structural-validity fixture
  // already covered in test/memory/schema.test.ts ("allows a state to be both in `waiting` and a
  // `gates` key").
  const dualMachine = {
    sequence: ['draft', 'ready', 'done'],
    gates: { ready: { reject: 'draft' } },
    waiting: ['ready'],
  };

  it('`approve` is illegal — the forward edge is verb-less, picked up automatically by a Workflow action', () => {
    expect(() => resolveTransitionTarget(dualMachine, 'ready', 'approve')).toThrow(ValidationError);
  });

  it('`reject` is still legal — the manual decline path remains available', () => {
    expect(resolveTransitionTarget(dualMachine, 'ready', 'reject')).toBe('draft');
  });

  it('`submit` is illegal (it is a `waiting` state)', () => {
    expect(() => resolveTransitionTarget(dualMachine, 'ready', 'submit')).toThrow(ValidationError);
  });
});

describe('resolveTransitionTarget — defensive edge case: a `gates` state with no next `sequence` entry', () => {
  // None of the 7 real types construct a machine this way (every `gates` key has a following
  // `sequence` entry) — this is a defensive guard against a malformed machine, not a case spec-001
  // itself anticipates, but `approve` must still fail closed (never return `undefined` as a target)
  // rather than writing an invalid state.
  const terminalGateMachine = { sequence: ['draft', 'pending'], gates: { pending: { reject: 'draft' } } };

  it('`approve` is illegal when the gate state is the last entry in `sequence`', () => {
    expect(() => resolveTransitionTarget(terminalGateMachine, 'pending', 'approve')).toThrow(ValidationError);
  });

  it('`reject` remains legal regardless (its target is `gates.<state>.reject`, not `sequence`-derived)', () => {
    expect(resolveTransitionTarget(terminalGateMachine, 'pending', 'reject')).toBe('draft');
  });
});
