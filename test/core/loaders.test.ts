/**
 * Per-pillar loaders (task-004-decoupled-pillars, REQ-SYS-02) — `core` exposes one loader per
 * pillar, each independently reading its own artifact(s) through the shared two-pass validation
 * pipeline (spec-009), with no cross-pillar schema dependency.
 */
import { join } from 'path';

import {
  loadDirectives,
  loadDnaYaml,
  loadDnaYamlAtHead,
  loadMemoryYaml,
  loadMemoryYamlAtHead,
  loadRolesYaml,
  loadWorkflowsYaml,
} from '../../src/core/loaders';
import { ValidationError } from '../../src/validation';
import { commitAll, makeTempGitRepo, removeTempDir, writeFixtureFile } from '../storage/helpers/git-fixture';

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

/**
 * `loadDnaYamlAtHead` — the committed-baseline read (task-090,
 * `bug-079-uncommitted-dna-yaml-grants-approval-authority`). Same schema and same failure shapes as
 * `loadDnaYaml`; the only difference is where the bytes come from, which is the whole point:
 * `requireApprovalAuthority` must not be able to see a working-tree edit.
 */
describe('loadDnaYamlAtHead — the DNA as the repository committed it', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeTempGitRepo();
    writeAllFourPillars(repo);
  });

  afterEach(() => removeTempDir(repo));

  it('returns null while dna.yaml is untracked — there is no committed record to read', () => {
    expect(loadDnaYamlAtHead(repo)).toBeNull();
  });

  it('returns HEAD\'s dna.yaml, not the working tree\'s, when the two differ', () => {
    commitAll(repo, 'seed');
    writeFixtureFile(repo, '.wingfoil/dna.yaml', DNA_YAML.replace('- name: core', '- name: INJECTED-BY-THE-WORKING-TREE'));

    expect(loadDnaYaml(repo).modules[0]?.name).toBe('INJECTED-BY-THE-WORKING-TREE');
    expect(loadDnaYamlAtHead(repo)?.modules[0]?.name).toBe('core');
  });

  it('throws ValidationError when the COMMITTED dna.yaml is invalid, even if the working-tree copy is fine', () => {
    writeFixtureFile(repo, '.wingfoil/dna.yaml', 'version: 1.1\nmodules: "not a list"\n');
    commitAll(repo, 'seed an invalid dna.yaml');
    writeFixtureFile(repo, '.wingfoil/dna.yaml', DNA_YAML);

    expect(() => loadDnaYaml(repo)).not.toThrow();
    expect(() => loadDnaYamlAtHead(repo)).toThrow(ValidationError);
  });
});

/**
 * `loadMemoryYamlAtHead` — the Memory pillar's committed-baseline read (task-091,
 * `bug-081-memory-yaml-read-from-worktree-fabricates-states`). Same schema and same failure shapes as
 * `loadMemoryYaml`; the only difference is where the bytes come from, which is the whole point: a
 * transition's state machine must not be decidable by an uncommitted edit.
 */
describe('loadMemoryYamlAtHead — the Memory config as the repository committed it', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeTempGitRepo();
    writeAllFourPillars(repo);
  });

  afterEach(() => removeTempDir(repo));

  it('returns null while memory.yaml is untracked — there is no committed machine to read', () => {
    expect(loadMemoryYamlAtHead(repo)).toBeNull();
  });

  it("returns HEAD's memory.yaml, not the working tree's, when the two differ", () => {
    commitAll(repo, 'seed');
    writeFixtureFile(repo, '.wingfoil/memory.yaml', MEMORY_YAML.replace(/pending/g, 'FABRICATED-BY-A-DIRTY-TREE'));

    expect(loadMemoryYaml(repo).types.task?.states?.sequence).toContain('FABRICATED-BY-A-DIRTY-TREE');
    expect(loadMemoryYamlAtHead(repo)?.types.task?.states?.sequence).toEqual([
      'draft',
      'pending',
      'backlog',
      'in-progress',
      'in-review',
      'approved',
      'done',
    ]);
  });

  it('throws ValidationError when the COMMITTED memory.yaml is invalid, even if the working-tree copy is fine', () => {
    writeFixtureFile(repo, '.wingfoil/memory.yaml', 'version: 1\ntypes: "not a mapping"\n');
    commitAll(repo, 'seed an invalid memory.yaml');
    writeFixtureFile(repo, '.wingfoil/memory.yaml', MEMORY_YAML);

    expect(() => loadMemoryYaml(repo)).not.toThrow();
    expect(() => loadMemoryYamlAtHead(repo)).toThrow(ValidationError);
  });
});
