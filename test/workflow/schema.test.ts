/**
 * WorkflowsYaml (Layer 1 manifest) + Workflow (Layer 2 per-file DSL) schemas
 * (spec-003-workflows-yaml-schema) — independent per-pillar schema, no dependency on memory.yaml or
 * dna.yaml's schemas (REQ-SYS-02, task-004-decoupled-pillars).
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';

import { WorkflowsYaml, Workflow } from '../../src/workflow/schema';

describe('WorkflowsYaml — Layer 1 manifest (spec-003)', () => {
  it('accepts a minimal valid manifest (canonical singular `include`)', () => {
    const result = WorkflowsYaml.safeParse({ version: 1.0, include: ['workflows/custom/sw-life-cycle.yaml'] });
    expect(result.success).toBe(true);
  });

  it('rejects a manifest with an empty `include` list', () => {
    const result = WorkflowsYaml.safeParse({ version: 1.0, include: [] });
    expect(result.success).toBe(false);
  });

  it('rejects a manifest with no `include` key at all', () => {
    const result = WorkflowsYaml.safeParse({ version: 1.0 });
    expect(result.success).toBe(false);
  });

  it('does not treat the legacy plural `includes:` as satisfying `include:` (required rename)', () => {
    // spec-003: "the manifest key is currently `includes:` (plural) and must be renamed to
    // `include:` (singular) ... The schema validates only `include` and treats `includes` as an
    // unknown key."
    const result = WorkflowsYaml.safeParse({ version: 1.0, includes: ['workflows/custom/x.yaml'] });
    expect(result.success).toBe(false);
  });

  it('makes `version` optional', () => {
    const result = WorkflowsYaml.safeParse({ include: ['workflows/custom/sw-life-cycle.yaml'] });
    expect(result.success).toBe(true);
  });
});

describe('Workflow — Layer 2 per-file DSL (spec-003)', () => {
  it('accepts a minimal main workflow with one phase', () => {
    const result = Workflow.safeParse({
      name: 'bug-ingest',
      kind: 'main',
      version: 1.0,
      phases: [{ name: 'capture', role: 'developer', actions: ['agent.execute'] }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown `kind`', () => {
    const result = Workflow.safeParse({
      name: 'x',
      kind: 'weird',
      phases: [{ name: 'p' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a workflow with zero phases', () => {
    const result = Workflow.safeParse({ name: 'x', kind: 'sub', phases: [] });
    expect(result.success).toBe(false);
  });

  it('accepts the full phase shape grounded in dev-loop.yaml `review`', () => {
    const result = Workflow.safeParse({
      name: 'dev-loop',
      kind: 'sub',
      element: 'task',
      phases: [
        {
          name: 'review',
          role: 'reviewer',
          actions: ['tests.bdd.run', 'memory.submit'],
          checks: { pre: ['tests.bdd.passing'] },
          approval: { by_role: 'approver' },
          fallback: { step: 'red', set_state: 'in-progress' },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts an `include`/`iterate_over`/`where` composition phase (release-line-cycle `delivery`)', () => {
    const result = Workflow.safeParse({
      name: 'release-line-cycle',
      kind: 'sub',
      element: 'release-line',
      phases: [
        {
          name: 'delivery',
          include: 'release-cycle',
          iterate_over: 'release',
          where: { 'release-line': '{release-line.version}', status: ['draft', 'planning'] },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('preserves unknown fields (`.passthrough()`)', () => {
    const result = Workflow.safeParse({
      name: 'x',
      kind: 'sub',
      mysteryField: 'y',
      phases: [{ name: 'p', mysteryPhaseField: 'z' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).mysteryField).toBe('y');
    }
  });
});

describe('WorkflowsYaml/Workflow — validates the real, live docs/self/.wingfoil workflow files', () => {
  const wingfoilRoot = join(__dirname, '..', '..', 'docs', 'self', '.wingfoil');

  it('the manifest parses with zero structural errors', () => {
    const raw = readFileSync(join(wingfoilRoot, 'workflows.yaml'), 'utf-8');
    const result = WorkflowsYaml.safeParse(load(raw));
    expect(result.success).toBe(true);
    if (!result.success) {
      // eslint-disable-next-line no-console
      console.error(result.error.issues);
    }
  });

  it('every referenced workflow-definition file parses with zero structural errors', () => {
    const files = readdirSync(join(wingfoilRoot, 'workflows', 'custom')).filter((f) => f.endsWith('.yaml'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const raw = readFileSync(join(wingfoilRoot, 'workflows', 'custom', file), 'utf-8');
      const result = Workflow.safeParse(load(raw));
      if (!result.success) {
        // eslint-disable-next-line no-console
        console.error(file, result.error.issues);
      }
      expect(result.success).toBe(true);
    }
  });
});
