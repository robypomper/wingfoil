/**
 * `assembleExecutionContext` / `resolveRoleDirectives` (task-037-role-task-scoped-context,
 * REQ-STATE-05) — the Fit Criterion under test, verbatim: "The assembled context object exposes
 * separate `dna`, `memory`, `directives` sections; it contains 100% of the role's assigned directives
 * and 0 directives of other roles." (`docs/02_requirements/03_sard/03_state-context.md`).
 *
 * Second pass (review-gate reject) adds three contracts:
 * - the **prototype-key** defect: a role named `toString`/`constructor`/`valueOf`/`hasOwnProperty`
 *   must resolve to the globals like any other unbound role, never throw;
 * - **`dl-029-role-with-no-directive-assignments`** option (c): a role contributing no assignments of
 *   its own resolves to the globals **and** emits `no directives assigned to role '<role>'`
 *   (`p3-directives/P3.6-auto-load-by-role.feature`, edge scenario, as amended by dl-029);
 * - **spec-012 §5 "deduplicate by directive id"**, which the first pass claimed but never performed.
 */
import { assembleExecutionContext, resolveRoleDirectives } from '../../src/core/context';
import { loadDirectives, loadDnaYaml, loadMemoryYaml, loadRolesYaml } from '../../src/core/loaders';
import { ValidationError } from '../../src/validation';
import { makeTempGitRepo, removeTempDir, writeFixtureFile } from '../storage/helpers/git-fixture';

const MEMORY_YAML = `
version: 1.1
types:
  task:
    path: "docs/04_memory/{release}/{id}.md"
    id_pattern: "task-{n}-{slug}"
    states:
      sequence: [ draft, pending, backlog, in-progress, in-review, approved, done ]
      gates:
        pending: { reject: draft }
        in-review: { reject: in-progress }
      waiting: [ backlog, approved ]
`;

const DNA_YAML = `
version: 1.1
modules:
  - name: core
    path: src/core
stacks:
  technologies:
    - name: TypeScript
      category: language
team:
  members:
    - name: Test User
      roles: [ developer ]
  roles:
    - name: developer
    - name: reviewer
paths:
  sources: [ src/ ]
`;

const ROLES_YAML = `
version: 1.0
assignments:
  developer:
    - code-quality
    - testing
  reviewer:
    - code-review
global:
  - doc-versioning
`;

/** Same config, but `intern` is bound to an explicitly empty directive list (dl-029: "contributes no
 * assignments of its own" covers an empty list exactly as it covers an absent key). */
const ROLES_YAML_WITH_EMPTY_INTERN = `
version: 1.0
assignments:
  developer:
    - code-quality
    - testing
  reviewer:
    - code-review
  intern: []
global:
  - doc-versioning
`;

function directiveMd(id: string, name: string): string {
  return `---
id: ${id}
name: "${name}"
type: directive
kind: custom
title: "${name}"
tags: [ custom ]
ref: []
---

# Directive — ${name}
`;
}

function writeFixtureConfig(root: string): void {
  writeFixtureFile(root, '.wingfoil/memory.yaml', MEMORY_YAML);
  writeFixtureFile(root, '.wingfoil/dna.yaml', DNA_YAML);
  writeFixtureFile(root, '.wingfoil/roles.yaml', ROLES_YAML);
  writeFixtureFile(root, '.wingfoil/directives/custom/code-quality.md', directiveMd('code-quality', 'Code Quality'));
  writeFixtureFile(root, '.wingfoil/directives/custom/testing.md', directiveMd('testing', 'Testing'));
  writeFixtureFile(root, '.wingfoil/directives/custom/code-review.md', directiveMd('code-review', 'Code Review'));
  writeFixtureFile(root, '.wingfoil/directives/custom/doc-versioning.md', directiveMd('doc-versioning', 'Doc Versioning'));
}

function writeTask(root: string, id: string, title: string): void {
  writeFixtureFile(
    root,
    `docs/04_memory/v0.1/${id}.md`,
    `---\nid: "${id}"\ntype: task\ntitle: "${title}"\nstatus: in-progress\n---\n\n# ${title}\n`,
  );
}

describe('resolveRoleDirectives — role-scoped directive resolution (REQ-STATE-05)', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeTempGitRepo();
    writeFixtureConfig(repo);
  });

  afterEach(() => {
    removeTempDir(repo);
  });

  function resolveIds(role: string, files = loadDirectives(repo)): string[] {
    return resolveRoleDirectives(files, loadRolesYaml(repo), role).directives.map((d) => d.frontmatter.id);
  }

  it('includes 100% of the role\'s assigned directives plus global', () => {
    expect(resolveIds('developer')).toEqual(['code-quality', 'doc-versioning', 'testing']);
  });

  it('includes 0 directives of other roles', () => {
    expect(resolveIds('developer')).not.toContain('code-review');
  });

  it('a role with no assignments resolves to only the global directives', () => {
    expect(resolveIds('intern')).toEqual(['doc-versioning']);
  });

  it('is deterministic: sorted ascending by directive id, independent of file-system enumeration order', () => {
    const directives = loadDirectives(repo);
    const first = resolveIds('developer', directives);
    const second = resolveIds('developer', [...directives].reverse());
    expect(first).toEqual(second);
    expect(first).toEqual([...first].sort());
  });

  describe('Object.prototype role names (rejection_reason — inherited-property defect)', () => {
    // `assignments` is a plain object, so `assignments['toString']` reaches `Object.prototype` and
    // yields a *function*; spreading it threw `TypeError: ... is not iterable` in the first pass.
    it.each(['toString', 'constructor', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', '__proto__'])(
      'role %p resolves to the globals instead of throwing',
      (role) => {
        expect(() => resolveIds(role)).not.toThrow();
        expect(resolveIds(role)).toEqual(['doc-versioning']);
      },
    );

    it('a prototype-named role also carries the dl-029 no-assignments warning', () => {
      const resolution = resolveRoleDirectives(loadDirectives(repo), loadRolesYaml(repo), 'toString');
      expect(resolution.warnings).toEqual(["no directives assigned to role 'toString'"]);
    });

    it('a role literally named `global` does not borrow the global list as its assignments', () => {
      // Guards the mirror-image mistake: `global` IS an own key of `RolesYaml`, but not of
      // `assignments`, so it must still be treated as an unbound role.
      expect(resolveIds('global')).toEqual(['doc-versioning']);
    });
  });

  describe('dl-029 option (c) — globals always, plus the operator warning (P3.6 edge scenario)', () => {
    it('emits no warning for a role that has its own assignments', () => {
      const resolution = resolveRoleDirectives(loadDirectives(repo), loadRolesYaml(repo), 'developer');
      expect(resolution.warnings).toEqual([]);
    });

    it('emits the P3.6 warning verbatim for a role absent from `assignments`', () => {
      const resolution = resolveRoleDirectives(loadDirectives(repo), loadRolesYaml(repo), 'intern');
      expect(resolution.warnings).toEqual(["no directives assigned to role 'intern'"]);
      expect(resolution.directives.map((d) => d.frontmatter.id)).toEqual(['doc-versioning']);
    });

    it('emits the same warning for a role bound to an explicitly empty list', () => {
      writeFixtureFile(repo, '.wingfoil/roles.yaml', ROLES_YAML_WITH_EMPTY_INTERN);
      const resolution = resolveRoleDirectives(loadDirectives(repo), loadRolesYaml(repo), 'intern');
      expect(resolution.warnings).toEqual(["no directives assigned to role 'intern'"]);
      expect(resolution.directives.map((d) => d.frontmatter.id)).toEqual(['doc-versioning']);
    });
  });

  describe('spec-012 §5 — deduplicate by directive id', () => {
    beforeEach(() => {
      // Same id shipped twice (the built-in/custom stand-in overlap CLAUDE.md §3 anticipates).
      writeFixtureFile(repo, '.wingfoil/directives/built-in/testing.md', directiveMd('testing', 'Testing (built-in)'));
    });

    it('includes a duplicated directive id exactly once', () => {
      expect(resolveIds('developer')).toEqual(['code-quality', 'doc-versioning', 'testing']);
    });

    it('picks the same duplicate regardless of input order (total, path-based tie-break)', () => {
      const directives = loadDirectives(repo);
      const roles = loadRolesYaml(repo);
      const forward = resolveRoleDirectives(directives, roles, 'developer').directives;
      const reversed = resolveRoleDirectives([...directives].reverse(), roles, 'developer').directives;
      expect(reversed.map((d) => d.path)).toEqual(forward.map((d) => d.path));
      expect(forward.find((d) => d.frontmatter.id === 'testing')?.path).toContain('built-in');
    });
  });
});

describe('assembleExecutionContext — distinct addressable dna/memory/directives sections (REQ-STATE-05)', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeTempGitRepo();
    writeFixtureConfig(repo);
    writeTask(repo, 'task-101-alpha', 'Alpha task');
    writeTask(repo, 'task-102-beta', 'Beta task');
  });

  afterEach(() => {
    removeTempDir(repo);
  });

  function assemble(role: string, elementId: string) {
    const dna = loadDnaYaml(repo);
    const memoryYaml = loadMemoryYaml(repo);
    const directiveFiles = loadDirectives(repo);
    const rolesYaml = loadRolesYaml(repo);
    return assembleExecutionContext({
      root: repo,
      dna,
      memoryYaml,
      directiveFiles,
      rolesYaml,
      role,
      element: { type: 'task', id: elementId },
    });
  }

  it('exposes distinct, individually addressable `dna`, `memory`, and `directives` sections', () => {
    const context = assemble('developer', 'task-101-alpha');
    expect(context.dna).toBeDefined();
    expect(context.memory).toBeDefined();
    expect(context.directives).toBeDefined();
    expect(context.dna.modules[0]?.name).toBe('core');
  });

  it('directives: 100% of the role\'s assigned directives, 0% of other roles\' (Fit Criterion, verbatim)', () => {
    const developerContext = assemble('developer', 'task-101-alpha');
    const developerIds = developerContext.directives.map((d) => d.frontmatter.id);
    expect(developerIds).toEqual(['code-quality', 'doc-versioning', 'testing']);
    expect(developerIds).not.toContain('code-review');

    const reviewerContext = assemble('reviewer', 'task-101-alpha');
    const reviewerIds = reviewerContext.directives.map((d) => d.frontmatter.id);
    expect(reviewerIds).toEqual(['code-review', 'doc-versioning']);
    expect(reviewerIds).not.toContain('code-quality');
    expect(reviewerIds).not.toContain('testing');
  });

  it('memory: scoped to the active task — the named element is present', () => {
    const context = assemble('developer', 'task-101-alpha');
    expect(context.memory).toHaveLength(1);
    expect(context.memory[0]?.frontmatter.id).toBe('task-101-alpha');
  });

  it('memory: an unrelated task is NOT present in the assembled context', () => {
    const context = assemble('developer', 'task-101-alpha');
    const ids = context.memory.map((doc) => doc.frontmatter.id);
    expect(ids).not.toContain('task-102-beta');
  });

  it('memory: an unresolvable element yields an empty (not thrown) memory section', () => {
    const context = assemble('developer', 'task-999-missing');
    expect(context.memory).toEqual([]);
  });

  it('is deterministic for unchanged inputs: assembling twice yields deep-equal output', () => {
    const first = assemble('developer', 'task-101-alpha');
    const second = assemble('developer', 'task-101-alpha');
    expect(second).toEqual(first);
  });

  it('surfaces the dl-029 warning on the assembled context, not only on the resolver', () => {
    expect(assemble('developer', 'task-101-alpha').warnings).toEqual([]);
    const intern = assemble('intern', 'task-101-alpha');
    expect(intern.warnings).toEqual(["no directives assigned to role 'intern'"]);
    expect(intern.directives.map((d) => d.frontmatter.id)).toEqual(['doc-versioning']);
  });

  it('assembles for a prototype-named role instead of throwing (rejection_reason)', () => {
    expect(() => assemble('constructor', 'task-101-alpha')).not.toThrow();
    const context = assemble('constructor', 'task-101-alpha');
    expect(context.directives.map((d) => d.frontmatter.id)).toEqual(['doc-versioning']);
    expect(context.memory[0]?.frontmatter.id).toBe('task-101-alpha');
  });

  it('propagates a ValidationError when any Memory document has unparseable frontmatter', () => {
    // Documents the *real* contract the first pass mis-stated as "never throws": the element lookup
    // walks and YAML-parses Memory documents in path order until it matches, so a malformed sibling
    // visited *before* the target aborts assembly (`task-100-*` sorts ahead of `task-101-alpha`).
    writeFixtureFile(repo, 'docs/04_memory/v0.1/task-100-broken.md', '---\nid: "task-100-broken\n---\n\nbody\n');
    expect(() => assemble('developer', 'task-101-alpha')).toThrow(ValidationError);
  });
});
