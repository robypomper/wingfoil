/**
 * DirectiveFrontmatter schema (task-004-decoupled-pillars, REQ-SYS-02) — the fourth pillar named by
 * the task's Acceptance Criteria ("directives/*.yaml ... validate against their own Zod schema
 * independently"). NOTE: unlike memory.yaml/dna.yaml/workflows.yaml, no dedicated tech-spec exists
 * yet for the directive file's own frontmatter shape (spec-010-memory-frontmatter-schema explicitly
 * scopes to `docs/self/docs/04_memory/**\/*.md`, not `.wingfoil/directives/**`). This schema is
 * grounded directly in the fields actually present on every current directive file, plus one BDD
 * contract requirement (`name` is required per `p3-directives/P3.5-project-directives.feature`'s
 * "missing required header fields" scenario) — see this task's Execution Notes for the design-gap
 * this records.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';

import { DirectiveFrontmatter, RolesYaml } from '../../src/directives/schema';
import { extractFrontmatter } from '../../src/storage/frontmatter';

describe('DirectiveFrontmatter — structural shape', () => {
  it('accepts the shape common to every current directive file', () => {
    const result = DirectiveFrontmatter.safeParse({
      id: 'code-quality',
      name: 'Code Quality',
      type: 'directive',
      kind: 'custom',
      title: 'Code Quality',
      tags: ['custom', 'code-quality', 'typescript'],
      ref: ['P3.8'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a document missing `id`', () => {
    const result = DirectiveFrontmatter.safeParse({ type: 'directive', kind: 'custom', title: 'x' });
    expect(result.success).toBe(false);
  });

  it('rejects a document whose `type` is not "directive"', () => {
    const result = DirectiveFrontmatter.safeParse({
      id: 'x',
      name: 'X',
      type: 'task',
      kind: 'custom',
      title: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a document missing `name` (BDD p3-directives/P3.5, "missing required header fields")', () => {
    const result = DirectiveFrontmatter.safeParse({ id: 'x', type: 'directive', kind: 'custom', title: 'x' });
    expect(result.success).toBe(false);
  });

  it('preserves unknown fields (`.passthrough()`), e.g. `scope`', () => {
    const result = DirectiveFrontmatter.safeParse({
      id: 'doc-versioning',
      name: 'Documentation versioning',
      type: 'directive',
      kind: 'custom',
      title: 'Documentation versioning',
      scope: 'global',
      ref: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).scope).toBe('global');
    }
  });
});

describe('DirectiveFrontmatter — validates every real, live docs/self/.wingfoil/directives/custom/*.md file', () => {
  it('parses each file’s frontmatter with zero structural errors', () => {
    const dir = join(__dirname, '..', '..', 'docs', 'self', '.wingfoil', 'directives', 'custom');
    const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const raw = readFileSync(join(dir, file), 'utf-8');
      const fm = extractFrontmatter(raw);
      expect(fm).not.toBeNull();
      const data = load(fm as string);
      const result = DirectiveFrontmatter.safeParse(data);
      if (!result.success) {
        console.error(file, result.error.issues);
      }
      expect(result.success).toBe(true);
    }
  });
});

/**
 * RolesYaml schema (task-037-role-task-scoped-context, REQ-STATE-05) — the role → directive binding
 * config (`.wingfoil/roles.yaml`, P3.2/P3.7) `directive-loader` (spec-012 §5) resolves against. A
 * minimal [AUTHORING] shape grounded directly in the real `docs/self/.wingfoil/roles.yaml` file's
 * fields (`version`, `assignments`, `global`) — same rationale as `DirectiveFrontmatter` above: no
 * dedicated tech-spec exists for this pillar's file shapes yet.
 */
describe('RolesYaml — structural shape', () => {
  it('accepts the real roles.yaml shape (assignments + global)', () => {
    const result = RolesYaml.safeParse({
      version: 1.0,
      assignments: {
        developer: ['code-quality', 'testing', 'determinism'],
        reviewer: ['code-review', 'traceability'],
      },
      global: ['doc-versioning', 'documentation', 'security-secrets'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a document missing `assignments`', () => {
    const result = RolesYaml.safeParse({ version: 1.0, global: [] });
    expect(result.success).toBe(false);
  });

  it('defaults `global` to an empty array when omitted', () => {
    const result = RolesYaml.safeParse({ version: 1.0, assignments: { developer: ['testing'] } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.global).toEqual([]);
    }
  });

  it('rejects an `assignments` entry whose value is not a string array', () => {
    const result = RolesYaml.safeParse({ version: 1.0, assignments: { developer: 'testing' } });
    expect(result.success).toBe(false);
  });
});

describe('RolesYaml — validates the real, live docs/self/.wingfoil/roles.yaml file', () => {
  it('parses the live file with zero structural errors', () => {
    const raw = readFileSync(join(__dirname, '..', '..', 'docs', 'self', '.wingfoil', 'roles.yaml'), 'utf-8');
    const data = load(raw);
    const result = RolesYaml.safeParse(data);
    if (!result.success) {
      console.error(result.error.issues);
    }
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.assignments.developer).toEqual(['code-quality', 'testing', 'determinism']);
      expect(result.data.global).toContain('doc-versioning');
    }
  });
});
