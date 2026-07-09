/**
 * `assembleExecutionContext` / `resolveRoleDirectives` (task-037-role-task-scoped-context,
 * REQ-STATE-05) — the Fit Criterion under test, verbatim: "The assembled context object exposes
 * separate `dna`, `memory`, `directives` sections; it contains 100% of the role's assigned directives
 * and 0 directives of other roles." (`docs/02_requirements/03_sard/03_state-context.md`).
 */
import { assembleExecutionContext, resolveRoleDirectives } from '../../src/core/context';
import { loadDirectives, loadDnaYaml, loadMemoryYaml, loadRolesYaml } from '../../src/core/loaders';
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

  it('includes 100% of the role\'s assigned directives plus global', () => {
    const directives = loadDirectives(repo);
    const roles = loadRolesYaml(repo);
    const resolved = resolveRoleDirectives(directives, roles, 'developer');
    expect(resolved.map((d) => d.frontmatter.id)).toEqual(['code-quality', 'doc-versioning', 'testing']);
  });

  it('includes 0 directives of other roles', () => {
    const directives = loadDirectives(repo);
    const roles = loadRolesYaml(repo);
    const resolved = resolveRoleDirectives(directives, roles, 'developer');
    expect(resolved.map((d) => d.frontmatter.id)).not.toContain('code-review');
  });

  it('a role with no assignments resolves to only the global directives', () => {
    const directives = loadDirectives(repo);
    const roles = loadRolesYaml(repo);
    const resolved = resolveRoleDirectives(directives, roles, 'intern');
    expect(resolved.map((d) => d.frontmatter.id)).toEqual(['doc-versioning']);
  });

  it('is deterministic: sorted ascending by directive id, independent of file-system enumeration order', () => {
    const directives = loadDirectives(repo);
    const roles = loadRolesYaml(repo);
    const first = resolveRoleDirectives(directives, roles, 'developer').map((d) => d.frontmatter.id);
    const reversedInput = [...directives].reverse();
    const second = resolveRoleDirectives(reversedInput, roles, 'developer').map((d) => d.frontmatter.id);
    expect(first).toEqual(second);
    expect(first).toEqual([...first].sort());
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
});
