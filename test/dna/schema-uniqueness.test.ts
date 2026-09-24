/**
 * Per-collection name uniqueness in `DnaYaml` (`src/dna/schema.ts`), task-093 AC4 —
 * `dl-081-dna-mutation-surface-shape`'s ratified **prerequisite**: once entries are addressed by
 * `name` (`dna update team.members.roberto.roles …`), uniqueness is what the addressing rests on, and the
 * schema carried no constraint that kept it holding.
 *
 * The ratification left the mechanism open — "a uniqueness refinement per collection, **or** the
 * verbs must refuse on more than one match". This is the refinement half: it makes the ambiguity
 * unreachable rather than handled, and it protects the readers that are not verbs (`resolveRoleHolders`,
 * the directive bindings, every future lookup by name). `test/dna/path.test.ts` pins the resolver's own
 * defensive refusal for a document handed to it directly.
 *
 * AC4 also asks that the refinement be shown **non-breaking**, and that is two questions, not one:
 * WingFoil's own `dna.yaml`, and the scaffold templates a fresh `wingfoil init` writes.
 */
import { load } from 'js-yaml';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DnaYaml } from '../../src/dna/schema';
import { TEMPLATES, templateScaffold } from '../../src/storage/templates';

/** A minimal schema-valid document, as the base every duplicate case below perturbs. */
function baseline(): Record<string, unknown> {
  return {
    version: 1,
    modules: [{ name: 'core' }],
    stacks: { technologies: [{ name: 'TypeScript', category: 'language' }], methodologies: [{ name: 'TDD' }] },
    team: {
      members: [{ name: 'roberto', roles: ['developer'] }],
      agents: [{ name: 'claude', executes_as: ['developer'] }],
      roles: [{ name: 'developer' }],
    },
    paths: { sources: ['src/'] },
  };
}

/** Every issue message a failed parse produced, joined — enough to assert the collection is named. */
function issues(document: unknown): string {
  const parsed = DnaYaml.safeParse(document);
  if (parsed.success) throw new Error('expected the document to FAIL validation, but it parsed');
  return parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
}

describe('DnaYaml — duplicate entry names are a validation failure, per collection (AC4)', () => {
  it('modules', () => {
    const document = baseline();
    (document.modules as unknown[]).push({ name: 'core', path: 'elsewhere' });
    expect(issues(document)).toContain('core');
  });

  it('stacks.technologies', () => {
    const document = baseline();
    (document.stacks as Record<string, unknown[]>).technologies!.push({ name: 'TypeScript', category: 'other' });
    expect(issues(document)).toContain('TypeScript');
  });

  it('stacks.methodologies', () => {
    const document = baseline();
    (document.stacks as Record<string, unknown[]>).methodologies!.push({ name: 'TDD' });
    expect(issues(document)).toContain('TDD');
  });

  it('team.members', () => {
    const document = baseline();
    (document.team as Record<string, unknown[]>).members!.push({ name: 'roberto', roles: ['developer'] });
    expect(issues(document)).toContain('roberto');
  });

  it('team.agents', () => {
    const document = baseline();
    (document.team as Record<string, unknown[]>).agents!.push({ name: 'claude', executes_as: ['developer'] });
    expect(issues(document)).toContain('claude');
  });

  it('team.roles', () => {
    const document = baseline();
    (document.team as Record<string, unknown[]>).roles!.push({ name: 'developer' });
    expect(issues(document)).toContain('developer');
  });

  it('names the collection and the duplicated name, so the message points at the fix', () => {
    const document = baseline();
    (document.modules as unknown[]).push({ name: 'core' });
    const message = issues(document);
    expect(message).toContain('modules');
    expect(message).toMatch(/duplicate/i);
  });

  it('leaves a document whose names are all distinct valid — the constraint is uniqueness, not order', () => {
    const document = baseline();
    (document.modules as unknown[]).push({ name: 'cli' }, { name: 'dna' });
    expect(DnaYaml.safeParse(document).success).toBe(true);
  });

  it('does not reject the same name used in DIFFERENT collections (a module and a role may share one)', () => {
    const document = baseline();
    (document.modules as unknown[]).push({ name: 'developer' });
    expect(DnaYaml.safeParse(document).success).toBe(true);
  });
});

describe('the refinement is non-breaking — measured, not assumed (AC4)', () => {
  it("WingFoil's own docs/self/.wingfoil/dna.yaml still validates", () => {
    const path = join(__dirname, '..', '..', 'docs', 'self', '.wingfoil', 'dna.yaml');
    const parsed = DnaYaml.safeParse(load(readFileSync(path, 'utf-8')));
    expect(parsed.success).toBe(true);
  });

  it('every registered `wingfoil init` template scaffolds a dna.yaml that still validates', () => {
    expect(TEMPLATES.length).toBeGreaterThan(0);
    for (const template of TEMPLATES) {
      const file = templateScaffold(template).find((scaffold) => scaffold.path.endsWith('/dna.yaml'));
      expect(file).toBeDefined();
      const parsed = DnaYaml.safeParse(load(file!.content));
      if (!parsed.success) {
        throw new Error(`${template.name} template's dna.yaml no longer validates: ${JSON.stringify(parsed.error.issues)}`);
      }
    }
  });
});
