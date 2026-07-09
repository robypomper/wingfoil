/**
 * Per-pillar loaders (task-004-decoupled-pillars, REQ-SYS-02) — `core` exposes one loader per
 * pillar, each independently reading its own artifact(s) through the shared two-pass validation
 * pipeline (spec-009), with no cross-pillar schema dependency.
 */
import { join } from 'path';

import { loadDirectives, loadDnaYaml, loadMemoryYaml, loadRolesYaml, loadWorkflowsYaml } from '../../src/core/loaders';
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
paths:
  sources: [ src/ ]
`;

const WORKFLOWS_YAML = `
version: 1.0
include:
  - workflows/custom/main.yaml
`;

const MAIN_WORKFLOW_YAML = `
name: main
kind: main
version: 1.0
phases:
  - name: only-phase
    role: developer
    actions:
      - agent.execute
`;

const DIRECTIVE_MD = `---
id: sample
name: "Sample"
type: directive
kind: custom
title: "Sample"
tags: [ custom ]
ref: []
---

# Directive — Sample
`;

const ROLES_YAML = `
version: 1.0
assignments:
  developer:
    - sample
global: []
`;

function writeAllFourPillars(root: string): void {
  writeFixtureFile(root, '.wingfoil/memory.yaml', MEMORY_YAML);
  writeFixtureFile(root, '.wingfoil/dna.yaml', DNA_YAML);
  writeFixtureFile(root, '.wingfoil/workflows.yaml', WORKFLOWS_YAML);
  writeFixtureFile(root, '.wingfoil/workflows/custom/main.yaml', MAIN_WORKFLOW_YAML);
  writeFixtureFile(root, '.wingfoil/directives/custom/sample.md', DIRECTIVE_MD);
  writeFixtureFile(root, '.wingfoil/roles.yaml', ROLES_YAML);
}

describe('per-pillar loaders — fixture repo', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeTempGitRepo();
    writeAllFourPillars(repo);
  });

  afterEach(() => {
    removeTempDir(repo);
  });

  it('loadMemoryYaml parses the fixture memory.yaml', () => {
    const memory = loadMemoryYaml(repo);
    expect(memory.types?.task).toBeDefined();
  });

  it('loadDnaYaml parses the fixture dna.yaml', () => {
    const dna = loadDnaYaml(repo);
    expect(dna.modules[0]?.name).toBe('core');
  });

  it('loadWorkflowsYaml parses the manifest and every included workflow file', () => {
    const { manifest, workflows } = loadWorkflowsYaml(repo);
    expect(manifest.include).toEqual(['workflows/custom/main.yaml']);
    expect(workflows).toHaveLength(1);
    expect(workflows[0]?.name).toBe('main');
  });

  it('loadWorkflowsYaml throws E_WORKFLOW_FILE_NOT_FOUND when an `include` path does not exist', () => {
    writeFixtureFile(repo, '.wingfoil/workflows.yaml', 'version: 1.0\ninclude:\n  - workflows/custom/missing.yaml\n');
    expect(() => loadWorkflowsYaml(repo)).toThrow(ValidationError);
    try {
      loadWorkflowsYaml(repo);
      fail('expected loadWorkflowsYaml to throw');
    } catch (err) {
      expect((err as ValidationError).issues.map((i) => i.code)).toContain('E_WORKFLOW_FILE_NOT_FOUND');
    }
  });

  it('loadWorkflowsYaml throws when no included workflow is `kind: main` (REQ-STATE-03)', () => {
    writeFixtureFile(
      repo,
      '.wingfoil/workflows/custom/main.yaml',
      MAIN_WORKFLOW_YAML.replace('kind: main', 'kind: sub'),
    );
    expect(() => loadWorkflowsYaml(repo)).toThrow(ValidationError);
  });

  it('loadDirectives parses every directive file under directives/', () => {
    const directives = loadDirectives(repo);
    expect(directives).toHaveLength(1);
    expect(directives[0]?.frontmatter.id).toBe('sample');
  });

  it('loadDirectives throws E_MISSING_FRONTMATTER for a .md file with no frontmatter block', () => {
    writeFixtureFile(repo, '.wingfoil/directives/custom/no-frontmatter.md', '# Just a heading, no frontmatter\n');
    expect(() => loadDirectives(repo)).toThrow(ValidationError);
    try {
      loadDirectives(repo);
      fail('expected loadDirectives to throw');
    } catch (err) {
      expect((err as ValidationError).issues.map((i) => i.code)).toContain('E_MISSING_FRONTMATTER');
    }
  });

  it('loadRolesYaml parses the fixture roles.yaml (task-037, REQ-STATE-05 directive-loader)', () => {
    const roles = loadRolesYaml(repo);
    expect(roles.assignments.developer).toEqual(['sample']);
    expect(roles.global).toEqual([]);
  });

  it('loadRolesYaml throws ValidationError when `assignments` is missing', () => {
    writeFixtureFile(repo, '.wingfoil/roles.yaml', 'version: 1.0\nglobal: []\n');
    expect(() => loadRolesYaml(repo)).toThrow(ValidationError);
  });
});

describe('per-pillar loaders — validate the real, live docs/self/.wingfoil config', () => {
  const liveRoot = join(__dirname, '..', '..', 'docs', 'self');

  it('all four pillars load without throwing', () => {
    expect(() => loadMemoryYaml(liveRoot)).not.toThrow();
    expect(() => loadDnaYaml(liveRoot)).not.toThrow();
    expect(() => loadWorkflowsYaml(liveRoot)).not.toThrow();
    expect(() => loadDirectives(liveRoot)).not.toThrow();
  });

  it('loadDirectives finds every real directive under directives/custom/', () => {
    const directives = loadDirectives(liveRoot);
    expect(directives.length).toBeGreaterThanOrEqual(10);
  });

  it('loadRolesYaml parses the real, live docs/self/.wingfoil/roles.yaml', () => {
    expect(() => loadRolesYaml(liveRoot)).not.toThrow();
    const roles = loadRolesYaml(liveRoot);
    expect(roles.assignments.developer).toEqual(['code-quality', 'testing', 'determinism']);
  });
});
