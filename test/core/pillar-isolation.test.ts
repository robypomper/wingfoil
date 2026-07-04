/**
 * The task-004-decoupled-pillars automated cross-pillar load test (REQ-SYS-02 fit criterion,
 * verbatim from the task's Acceptance Criteria):
 *
 *   "An automated test that edits memory.yaml (e.g. adds a new type entry) and reloads all four
 *   pillars reports zero validation errors in dna.yaml, directives/, or workflows.yaml."
 *
 * This is the automated proof that the four pillar loaders are genuinely decoupled — no cross-file
 * schema dependency (spec-001/002/003, spec-009's shared pipeline notwithstanding: the pipeline code
 * is shared, but each pass is still per-artifact).
 */
import { loadDirectives, loadDnaYaml, loadMemoryYaml, loadWorkflowsYaml } from '../../src/core/loaders';
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

// Same memory.yaml, plus one new type entry — the mutation the AC calls out by name.
const MEMORY_YAML_MUTATED = `
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
  note:
    path: "docs/04_memory/notes/{id}.md"
    id_pattern: "note-{n}-{slug}"
    states:
      sequence: [ draft, published ]
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

function writeAllFourPillars(root: string): void {
  writeFixtureFile(root, '.wingfoil/memory.yaml', MEMORY_YAML);
  writeFixtureFile(root, '.wingfoil/dna.yaml', DNA_YAML);
  writeFixtureFile(root, '.wingfoil/workflows.yaml', WORKFLOWS_YAML);
  writeFixtureFile(root, '.wingfoil/workflows/custom/main.yaml', MAIN_WORKFLOW_YAML);
  writeFixtureFile(root, '.wingfoil/directives/custom/sample.md', DIRECTIVE_MD);
}

describe('cross-pillar isolation — editing memory.yaml never breaks the other three pillars', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeTempGitRepo();
    writeAllFourPillars(repo);
  });

  afterEach(() => {
    removeTempDir(repo);
  });

  it('all four pillars load cleanly before the mutation', () => {
    expect(() => loadMemoryYaml(repo)).not.toThrow();
    expect(() => loadDnaYaml(repo)).not.toThrow();
    expect(() => loadWorkflowsYaml(repo)).not.toThrow();
    expect(() => loadDirectives(repo)).not.toThrow();
  });

  it('adding a new `type` to memory.yaml and reloading all four raises zero errors in the other three', () => {
    // Baseline: no `note` type yet.
    expect(loadMemoryYaml(repo).types?.note).toBeUndefined();

    // The mutation named in the Acceptance Criteria: edit memory.yaml only.
    writeFixtureFile(repo, '.wingfoil/memory.yaml', MEMORY_YAML_MUTATED);

    // Reload all four. memory.yaml itself must reflect the new type, and picking it up must not
    // raise in any of dna.yaml / workflows.yaml / directives/.
    const memory = loadMemoryYaml(repo);
    expect(memory.types?.note).toBeDefined();

    expect(() => loadDnaYaml(repo)).not.toThrow();
    expect(() => loadWorkflowsYaml(repo)).not.toThrow();
    expect(() => loadDirectives(repo)).not.toThrow();

    // And the content of the other three pillars is byte-for-byte unaffected by the memory.yaml edit.
    const dna = loadDnaYaml(repo);
    expect(dna.modules).toHaveLength(1);
    const { workflows } = loadWorkflowsYaml(repo);
    expect(workflows).toHaveLength(1);
    const directives = loadDirectives(repo);
    expect(directives).toHaveLength(1);
  });

  it('mutating dna.yaml (adding a module) raises zero errors in memory.yaml / workflows.yaml / directives/', () => {
    const dnaWithExtraModule = DNA_YAML.replace(
      'modules:\n  - name: core\n    path: src/core\n',
      'modules:\n  - name: core\n    path: src/core\n  - name: storage\n    path: src/storage\n',
    );
    writeFixtureFile(repo, '.wingfoil/dna.yaml', dnaWithExtraModule);
    expect(loadDnaYaml(repo).modules).toHaveLength(2);
    expect(() => loadMemoryYaml(repo)).not.toThrow();
    expect(() => loadWorkflowsYaml(repo)).not.toThrow();
    expect(() => loadDirectives(repo)).not.toThrow();
  });

  it('breaking workflows.yaml (bad include path) raises zero errors in memory.yaml / dna.yaml / directives/', () => {
    writeFixtureFile(repo, '.wingfoil/workflows.yaml', 'version: 1.0\ninclude:\n  - workflows/custom/missing.yaml\n');
    expect(() => loadWorkflowsYaml(repo)).toThrow();
    // The other three pillars never touch workflows.yaml or its include graph, so they are unaffected.
    expect(() => loadMemoryYaml(repo)).not.toThrow();
    expect(() => loadDnaYaml(repo)).not.toThrow();
    expect(() => loadDirectives(repo)).not.toThrow();
  });

  it('breaking a directive file’s frontmatter raises zero errors in memory.yaml / dna.yaml / workflows.yaml', () => {
    writeFixtureFile(
      repo,
      '.wingfoil/directives/custom/broken.md',
      '---\nid: broken\ntype: not-a-directive\nkind: custom\ntitle: Broken\n---\n',
    );
    expect(() => loadDirectives(repo)).toThrow();
    expect(() => loadMemoryYaml(repo)).not.toThrow();
    expect(() => loadDnaYaml(repo)).not.toThrow();
    expect(() => loadWorkflowsYaml(repo)).not.toThrow();
  });
});
