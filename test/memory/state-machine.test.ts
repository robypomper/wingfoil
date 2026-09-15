/**
 * State-machine transition-legality engine (spec-001-memory-yaml-schema, REQ-SYS-04,
 * task-005-per-type-state-machines). Exercises `resolveStateMachine` + `resolveTransitionTarget`
 * against the real 7 types registered in `docs/self/.wingfoil/memory.yaml` (per the task's
 * Acceptance Criteria) plus illegal-transition rejection.
 *
 * The final `describe` block below (REQ-STATE-08) is task-010-default-state-machine-fallback's
 * scope: a throwaway fixture `MemoryYaml` document (parsed in-test, never written to the real
 * `docs/self/.wingfoil/memory.yaml` per that task's Implementation Notes) whose one declared type has
 * NO `states:` key at all, proving `resolveStateMachine` falls back to `defaults.states` end-to-end
 * (Pass-1 structural parse → Pass-2 semantic transition legality, spec-009-validation-strategy §1) and
 * covering the two branches task-005 left genuinely unexercised in `resolveStateMachine` (see that
 * function's own doc comment in `src/memory/state-machine.ts`): the `?? defaults.states` fallback
 * itself, and the "neither the type nor `defaults` declares a machine" throw.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';

import { MemoryYaml } from '../../src/memory/schema';
import {
  ARCHIVED_STATUSES,
  DEPRECATED_STATE,
  E_INVALID_STATE,
  E_INVALID_TRANSITION,
  isArchivedStatus,
  resolveStateMachine,
  resolveTransitionTarget,
  SUPERSEDED_STATE,
  validateFrontmatterState,
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

describe('REQ-STATE-08 — a type with no `states` block falls back to `defaults.states` (task-010)', () => {
  // Throwaway fixture — deliberately NOT added to the real `docs/self/.wingfoil/memory.yaml`
  // (task-010's Implementation Notes are explicit: today all 7 real types declare their own
  // `states:`, so this path has no live consumer and must be exercised by a dedicated fixture type
  // here instead). Parsed through the real `MemoryYaml` schema (Pass 1, spec-009 §1) so this is a
  // genuine end-to-end exercise of the fallback, not just a call into `resolveStateMachine` with a
  // hand-built object.
  const FALLBACK_FIXTURE_YAML = {
    version: 1.1,
    defaults: {
      states: { sequence: ['draft', 'pending', 'approved'], gates: { pending: { reject: 'draft' } } },
    },
    types: {
      'fixture-no-states': {
        path: 'docs/04_memory/fixtures/{id}.md',
        id_pattern: 'fixture-no-states-{n}',
        // No `states:` key at all — this is exactly the REQ-STATE-08 condition under test.
      },
    },
  };

  const fixtureMemoryYaml = MemoryYaml.parse(FALLBACK_FIXTURE_YAML);

  it('Pass 1: a type entry with no `states:` key is structurally valid (`states` is `.optional()`, spec-001)', () => {
    expect(MemoryYaml.safeParse(FALLBACK_FIXTURE_YAML).success).toBe(true);
    expect(fixtureMemoryYaml.types['fixture-no-states']!.states).toBeUndefined();
  });

  it('resolves to `defaults.states` itself (the previously-uncovered `?? defaults.states` branch)', () => {
    const machine = resolveStateMachine(fixtureMemoryYaml, 'fixture-no-states');
    expect(machine).toBe(fixtureMemoryYaml.defaults!.states);
  });

  it('throws when neither the type nor `defaults` declares a machine (the other previously-uncovered branch)', () => {
    const noDefaultsYaml = MemoryYaml.parse({
      version: 1.1,
      types: { 'fixture-no-states': { path: 'docs/04_memory/fixtures/{id}.md' } },
    });
    expect(() => resolveStateMachine(noDefaultsYaml, 'fixture-no-states')).toThrow(
      /declares no `states` block and `defaults.states` is not set/,
    );
  });

  it('`memory.add` chain head is `draft` (`sequence[0]`)', () => {
    const machine = resolveStateMachine(fixtureMemoryYaml, 'fixture-no-states');
    expect(machine.sequence[0]).toBe('draft');
  });

  it('`memory.submit` moves draft → pending', () => {
    const machine = resolveStateMachine(fixtureMemoryYaml, 'fixture-no-states');
    expect(resolveTransitionTarget(machine, 'draft', 'submit')).toBe('pending');
  });

  it('`memory.approve` moves pending → approved', () => {
    const machine = resolveStateMachine(fixtureMemoryYaml, 'fixture-no-states');
    expect(resolveTransitionTarget(machine, 'pending', 'approve')).toBe('approved');
  });

  it('`memory.reject` moves pending → draft — no separate `rejected` status is ever written', () => {
    const machine = resolveStateMachine(fixtureMemoryYaml, 'fixture-no-states');
    expect(resolveTransitionTarget(machine, 'pending', 'reject')).toBe('draft');
    // The default machine's `sequence` never contains a `rejected` state at all (spec-001's
    // reconciliation note, CLAUDE.md §5): confirms no such status could ever be written.
    expect(machine.sequence).not.toContain('rejected');
  });

  it('any other transition (e.g. draft → approved directly) is rejected and leaves `status` unchanged', () => {
    const machine = resolveStateMachine(fixtureMemoryYaml, 'fixture-no-states');
    const doc = { status: 'draft' };
    expect(() => {
      const target = resolveTransitionTarget(machine, doc.status, 'approve');
      doc.status = target;
    }).toThrow(ValidationError);
    expect(doc.status).toBe('draft');
  });

  it('REQ-SYS-04: removing a type\'s own `states:` block and reloading falls back to `defaults` with no code change', () => {
    // Same fixture type, but this time WITH its own (different) `states:` block declared — proves
    // `resolveStateMachine` picks the type's own machine when present, and reverts to `defaults` the
    // moment that block is absent (as in `FALLBACK_FIXTURE_YAML` above), purely from config, with no
    // change to `resolveStateMachine` itself.
    const withOwnStatesYaml = MemoryYaml.parse({
      ...FALLBACK_FIXTURE_YAML,
      types: {
        'fixture-no-states': {
          ...FALLBACK_FIXTURE_YAML.types['fixture-no-states'],
          states: { sequence: ['draft', 'live'] },
        },
      },
    });

    const ownMachine = resolveStateMachine(withOwnStatesYaml, 'fixture-no-states');
    expect(ownMachine).toBe(withOwnStatesYaml.types['fixture-no-states']!.states);
    expect(ownMachine.sequence).toEqual(['draft', 'live']);

    // Remove the `states:` block (as `FALLBACK_FIXTURE_YAML` already does) — reload falls back.
    const fallbackMachine = resolveStateMachine(fixtureMemoryYaml, 'fixture-no-states');
    expect(fallbackMachine).toBe(fixtureMemoryYaml.defaults!.states);
    expect(fallbackMachine.sequence).toEqual(['draft', 'pending', 'approved']);
  });
});

describe('validateFrontmatterState — REQ-STATE-01 per-type frontmatter `status` membership (task-036, BDD P4.11/P4.13)', () => {
  it('passes silently (returns undefined, does not throw) for every state in a real type\'s declared `sequence`', () => {
    for (const typeName of ['release-line', 'release', 'task', 'adr', 'decision-log', 'tech-spec', 'bug']) {
      const machine = resolveStateMachine(memoryYaml, typeName);
      for (const state of machine.sequence) {
        expect(validateFrontmatterState(machine, typeName, state)).toBeUndefined();
      }
    }
  });

  it('passes silently for the implicit "deprecated" state on every real type, even though it is never declared in `sequence`', () => {
    for (const typeName of ['release-line', 'release', 'task', 'adr', 'decision-log', 'tech-spec', 'bug']) {
      const machine = resolveStateMachine(memoryYaml, typeName);
      expect(machine.sequence).not.toContain(DEPRECATED_STATE);
      expect(() => validateFrontmatterState(machine, typeName, DEPRECATED_STATE)).not.toThrow();
    }
  });

  it('BDD P4.11 scenario 3: "shipped" is not a valid task state — throws with the exact message "invalid state \'shipped\' for type \'task\'"', () => {
    const machine = resolveStateMachine(memoryYaml, 'task');
    expect(() => validateFrontmatterState(machine, 'task', 'shipped')).toThrow(ValidationError);
    try {
      validateFrontmatterState(machine, 'task', 'shipped');
      throw new Error('expected validateFrontmatterState to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const validationError = err as ValidationError;
      expect(validationError.issues).toHaveLength(1);
      expect(validationError.issues[0]?.code).toBe(E_INVALID_STATE);
      expect(validationError.issues[0]?.path).toBe('status');
      expect(validationError.issues[0]?.message).toBe("invalid state 'shipped' for type 'task'");
    }
  });

  it('BDD P4.13 scenario 3: "releasing" (a valid `release` state) is NOT a valid `task` state — rejected per-type, and `file` is threaded through when supplied', () => {
    const releaseMachine = resolveStateMachine(memoryYaml, 'release');
    expect(() => validateFrontmatterState(releaseMachine, 'release', 'releasing')).not.toThrow();

    const taskMachine = resolveStateMachine(memoryYaml, 'task');
    expect(() => validateFrontmatterState(taskMachine, 'task', 'releasing', 'docs/04_memory/v0.2/task-101.md')).toThrow(
      /invalid state 'releasing' for type 'task'/,
    );
    try {
      validateFrontmatterState(taskMachine, 'task', 'releasing', 'docs/04_memory/v0.2/task-101.md');
      throw new Error('expected validateFrontmatterState to throw');
    } catch (err) {
      const validationError = err as ValidationError;
      expect(validationError.issues[0]?.file).toBe('docs/04_memory/v0.2/task-101.md');
    }
  });

  it('exits `2` (EXIT_INTEGRITY) — a cross-file/system-integrity failure per spec-009 §3, matching `resolveTransitionTarget`\'s illegal-transition exit code', () => {
    const machine = resolveStateMachine(memoryYaml, 'task');
    try {
      validateFrontmatterState(machine, 'task', 'nonexistent-state');
      throw new Error('expected validateFrontmatterState to throw');
    } catch (err) {
      expect((err as ValidationError).exitCode).toBe(2);
    }
  });
});

describe('isArchivedStatus — the shared archived-status predicate (dl-028, REQ-STATE-06)', () => {
  // `dl-028-archived-states-excluded-from-context` (`ready`) settles the archived set at
  // `{deprecated, superseded}` and mandates ONE shared predicate consumed by both the search path
  // (`searchMemoryDocuments`) and the context path (`src/core/relevance.ts`), superseding
  // `task-038`'s `isDeprecatedStatus`. It lives here, next to `DEPRECATED_STATE`, because this module
  // is already the single source of truth for status literals.

  it('names the two archived statuses as declared constants', () => {
    expect(DEPRECATED_STATE).toBe('deprecated');
    expect(SUPERSEDED_STATE).toBe('superseded');
  });

  it('exposes the canonical archived set in a fixed, deterministic order', () => {
    expect([...ARCHIVED_STATUSES]).toEqual(['deprecated', 'superseded']);
  });

  it('is true for `deprecated` — any type reaches it via `memory deprecate` (P1.9)', () => {
    expect(isArchivedStatus(DEPRECATED_STATE)).toBe(true);
  });

  it('is true for `superseded` — the terminal state of `adr`/`tech-spec` (dl-028)', () => {
    expect(isArchivedStatus(SUPERSEDED_STATE)).toBe(true);
  });

  it('is false for every live status, including `draft`', () => {
    for (const live of ['draft', 'pending', 'backlog', 'in-progress', 'in-review', 'approved', 'accepted', 'done', 'ready']) {
      expect(isArchivedStatus(live)).toBe(false);
    }
  });

  it('is false for `rejected` — spec-001 removed that status; dl-028 drops it from the set', () => {
    expect(isArchivedStatus('rejected')).toBe(false);
  });

  it('is false when the document declares no status at all', () => {
    expect(isArchivedStatus(undefined)).toBe(false);
  });

  it('every archived status in the set is reported archived (set and predicate cannot drift)', () => {
    for (const status of ARCHIVED_STATUSES) expect(isArchivedStatus(status)).toBe(true);
  });
});
