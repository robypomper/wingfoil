/**
 * task-029-implement-wingfoil-init (P5.1.1, spec-011-storage-layout) — methodology templates that
 * produce the COMPLETE `.wingfoil/` layout `wingfoil init` commits. task-018 delivered only a minimal
 * skeleton and deferred the full spec-011 layout (roles.yaml, the `built-in`/`custom` splits,
 * `memory/templates/`) here; these tests pin that full layout + its determinism (REQ-SYS-07).
 */
import { load as loadYaml } from 'js-yaml';

import {
  DEFAULT_TEMPLATE,
  TEMPLATES,
  TEMPLATE_NAMES,
  initProjectCommitMessage,
  resolveTemplate,
  templateScaffold,
  type TemplateDefinition,
} from '../../src/storage/templates';
import type { ScaffoldFile } from '../../src/storage/layout';
import { DnaYaml } from '../../src/dna/schema';

function pathsOf(files: readonly ScaffoldFile[]): string[] {
  return files.map((f) => f.path);
}

describe('templates registry (P5.1.1)', () => {
  it('includes the BDD-named Scrum and Kanban templates', () => {
    expect(TEMPLATE_NAMES).toEqual(expect.arrayContaining(['Scrum', 'Kanban']));
  });

  it('resolves a template name case-insensitively to its canonical definition', () => {
    expect(resolveTemplate('scrum')?.name).toBe('Scrum');
    expect(resolveTemplate('KANBAN')?.name).toBe('Kanban');
  });

  it('returns null for an unknown template name', () => {
    expect(resolveTemplate('Waterfallish')).toBeNull();
  });

  it('exposes a DEFAULT_TEMPLATE that is itself a known template', () => {
    expect(resolveTemplate(DEFAULT_TEMPLATE)).not.toBeNull();
  });
});

describe('templateScaffold — complete spec-011 layout (P5.1.1 AC (a))', () => {
  const scrum = resolveTemplate('Scrum') as TemplateDefinition;

  it('creates all four top-level pillar config files', () => {
    const paths = pathsOf(templateScaffold(scrum));
    expect(paths).toEqual(
      expect.arrayContaining([
        '.wingfoil/dna.yaml',
        '.wingfoil/memory.yaml',
        '.wingfoil/roles.yaml',
        '.wingfoil/workflows.yaml',
      ]),
    );
  });

  it('creates the directives built-in/custom split (spec-011)', () => {
    const paths = pathsOf(templateScaffold(scrum));
    expect(paths).toContain('.wingfoil/directives/built-in/.gitkeep');
    expect(paths.some((p) => p.startsWith('.wingfoil/directives/custom/') && p.endsWith('.md'))).toBe(true);
  });

  it('creates one memory template scaffold per Memory element type (spec-011)', () => {
    const paths = pathsOf(templateScaffold(scrum));
    for (const type of ['adr', 'bug', 'decision-log', 'release', 'release-line', 'task', 'tech-spec']) {
      expect(paths).toContain(`.wingfoil/memory/templates/${type}.md`);
    }
  });

  it('creates the workflows built-in/custom split with a startable main (spec-011)', () => {
    const paths = pathsOf(templateScaffold(scrum));
    expect(paths).toContain('.wingfoil/workflows/built-in/.gitkeep');
    expect(paths).toContain('.wingfoil/workflows/custom/sw-life-cycle.yaml');
  });

  it('produces no path outside `.wingfoil/` (init never touches the rest of the tree)', () => {
    for (const p of pathsOf(templateScaffold(scrum))) {
      expect(p.startsWith('.wingfoil/')).toBe(true);
    }
  });

  it('every file carries non-empty content except the .gitkeep placeholders', () => {
    for (const f of templateScaffold(scrum)) {
      if (f.path.endsWith('.gitkeep')) expect(f.content).toBe('');
      else expect(f.content.length).toBeGreaterThan(0);
    }
  });
});

describe('determinism (REQ-SYS-07)', () => {
  it('two scaffolds for the same template are byte-identical (no wall-clock/random)', () => {
    const scrum = resolveTemplate('Scrum') as TemplateDefinition;
    expect(JSON.stringify(templateScaffold(scrum))).toBe(JSON.stringify(templateScaffold(scrum)));
  });

  it('returns files in a stable lexical order', () => {
    const scrum = resolveTemplate('Scrum') as TemplateDefinition;
    const paths = pathsOf(templateScaffold(scrum));
    expect(paths).toEqual([...paths].sort());
  });
});

describe('template selection differentiates generated content (P5.1.1 AC (a)/(b))', () => {
  it('the chosen methodology is reflected in the generated dna.yaml', () => {
    const scrumDna = templateScaffold(resolveTemplate('Scrum') as TemplateDefinition).find(
      (f) => f.path === '.wingfoil/dna.yaml',
    )!.content;
    const kanbanDna = templateScaffold(resolveTemplate('Kanban') as TemplateDefinition).find(
      (f) => f.path === '.wingfoil/dna.yaml',
    )!.content;
    expect(scrumDna).toContain('Scrum');
    expect(kanbanDna).toContain('Kanban');
    expect(scrumDna).not.toBe(kanbanDna);
  });

  it('the commit message names the selected template', () => {
    expect(initProjectCommitMessage(resolveTemplate('Kanban') as TemplateDefinition)).toContain('Kanban');
  });

  it('every registered template scaffolds a complete four-pillar layout', () => {
    for (const def of TEMPLATES) {
      const paths = pathsOf(templateScaffold(def));
      expect(paths).toEqual(
        expect.arrayContaining([
          '.wingfoil/dna.yaml',
          '.wingfoil/memory.yaml',
          '.wingfoil/roles.yaml',
          '.wingfoil/workflows.yaml',
        ]),
      );
    }
  });
});

/**
 * bug-005-init-scaffold-fails-schema-validation: `templateScaffold`'s generated `dna.yaml`/
 * `memory.yaml` must actually satisfy the schemas/consumers `dna show`/`dna set`/`paths`/
 * `memory add` enforce on them — task-018/task-029 never asserted this, only that the files were
 * non-empty and template-differentiated (the tests above). Discovered via task-032's manual CLI
 * walkthrough: a freshly-`init`'d project errored on every one of those four commands.
 */
describe('templateScaffold output satisfies its consumers’ real schemas (bug-005)', () => {
  for (const def of TEMPLATES) {
    it(`${def.name}: generated dna.yaml round-trips through the real DnaYaml schema`, () => {
      const dnaYamlText = templateScaffold(def).find((f) => f.path === '.wingfoil/dna.yaml')!.content;
      const parsed = loadYaml(dnaYamlText);
      const result = DnaYaml.safeParse(parsed);
      expect(result.success).toBe(true);
    });

    it(`${def.name}: every scaffolded memory.yaml type declares an id_pattern (memoryAdd requires one)`, () => {
      const memoryYamlText = templateScaffold(def).find((f) => f.path === '.wingfoil/memory.yaml')!.content;
      const parsed = loadYaml(memoryYamlText) as { types: Record<string, { id_pattern?: string; template?: unknown }> };
      for (const [type, entry] of Object.entries(parsed.types)) {
        expect([type, entry.id_pattern]).toEqual([type, expect.any(String)]);
        expect([type, entry.template]).toEqual([type, expect.anything()]);
      }
    });
  }
});
