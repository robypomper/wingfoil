/**
 * Per-pillar loaders (task-004-decoupled-pillars, REQ-SYS-02) — `core` exposes one loader per
 * pillar, each independently reading its own artifact(s) through the shared two-pass validation
 * pipeline (spec-009), with no cross-pillar schema dependency.
 */
import { chmodSync, mkdirSync, symlinkSync } from 'fs';
import { join } from 'path';

import {
  loadDirectiveInventory,
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
    expect(manifest?.include).toEqual(['workflows/custom/main.yaml']);
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

  // task-143 (bug-125), RED-FIRST: `statSync` follows a link, so one dangling symlink under
  // `.wingfoil/directives/` used to throw a raw ENOENT out of every directive read.
  describe('a dangling symlink under directives/ (task-143, bug-125)', () => {
    const DANGLING = '.wingfoil/directives/custom/dangling.md';
    const WARNING = `directive entry '${DANGLING}' skipped: it is a symbolic link whose target does not exist`;

    beforeEach(() => {
      symlinkSync(join(repo, 'no-such-target.md'), join(repo, DANGLING));
    });

    it('loadDirectiveInventory skips it with a warning naming it, and loads every other directive', () => {
      const inventory = loadDirectiveInventory(repo);
      expect(inventory.files.map((file) => file.frontmatter.id)).toEqual(['sample']);
      expect(inventory.warnings).toEqual([WARNING]);
    });

    it('a dangling link named without `.md` is reported too — it may have been a directory of directives', () => {
      symlinkSync(join(repo, 'no-such-dir'), join(repo, '.wingfoil/directives/custom/team'));
      expect(loadDirectiveInventory(repo).warnings).toEqual([
        WARNING,
        "directive entry '.wingfoil/directives/custom/team' skipped: it is a symbolic link whose target does not exist",
      ]);
    });

    it('loadDirectives does not throw: it returns the other directives and writes the warning to stderr', () => {
      const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      try {
        expect(loadDirectives(repo).map((file) => file.frontmatter.id)).toEqual(['sample']);
        expect(stderr.mock.calls.map(([chunk]) => String(chunk))).toEqual([`Warning: ${WARNING}\n`]);
      } finally {
        stderr.mockRestore();
      }
    });

    it('a symlink loop is skipped too, with the error code as its reason', () => {
      symlinkSync('loop.md', join(repo, '.wingfoil/directives/custom/loop.md'));
      expect(loadDirectiveInventory(repo).warnings).toEqual([
        WARNING,
        "directive entry '.wingfoil/directives/custom/loop.md' skipped: it cannot be read (ELOOP)",
      ]);
    });

    // Permission bits do not bind root, so the case only exists for an unprivileged user.
    const unprivileged = typeof process.getuid === 'function' && process.getuid() !== 0;
    (unprivileged ? it : it.skip)('a subdirectory that cannot be listed is skipped, not fatal', () => {
      const locked = join(repo, '.wingfoil/directives/custom/locked');
      mkdirSync(locked);
      chmodSync(locked, 0o000);
      try {
        const inventory = loadDirectiveInventory(repo);
        expect(inventory.files.map((file) => file.frontmatter.id)).toEqual(['sample']);
        expect(inventory.warnings).toEqual([
          WARNING,
          "directive entry '.wingfoil/directives/custom/locked' skipped: it cannot be read (EACCES)",
        ]);
      } finally {
        chmodSync(locked, 0o755);
      }
    });

    it('a symlink whose target exists is still followed and loaded (characterization)', () => {
      writeFixtureFile(repo, 'outside/linked.md', ['---', 'id: linked', 'name: "linked"', 'type: directive', 'kind: custom', 'title: "linked"', '---', ''].join('\n'));
      symlinkSync(join(repo, 'outside/linked.md'), join(repo, '.wingfoil/directives/custom/linked.md'));
      expect(loadDirectiveInventory(repo).files.map((file) => file.frontmatter.id)).toEqual(['linked', 'sample']);
    });
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

describe('per-pillar loaders — validate the real, live .wingfoil config', () => {
  const liveRoot = join(__dirname, '..', '..');

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

  // The live bindings are asserted by property, not by exact array (task-133, bug-112): a new binding
  // in roles.yaml is a configuration change, not a loader regression, and must not fail here. What a
  // loader regression would do — drop a binding, duplicate one, or lose the link to its file — is
  // what these assert.
  it('loadRolesYaml parses the real, live .wingfoil/roles.yaml', () => {
    expect(() => loadRolesYaml(liveRoot)).not.toThrow();
    const roles = loadRolesYaml(liveRoot);
    // task-094 added `command-baseline` (dl-080 option (B)) to the three code-writing roles.
    expect(roles.assignments.developer).toEqual(
      expect.arrayContaining(['code-quality', 'testing', 'determinism', 'command-baseline']),
    );
    expect(roles.assignments.reviewer).toContain('command-baseline');
    expect(roles.assignments.architect).toContain('command-baseline');
    // task-133 (dl-059): the built-in security directive is global, beside security-secrets.
    expect(roles.global).toEqual(expect.arrayContaining(['security', 'security-secrets']));
    for (const ids of [...Object.values(roles.assignments), roles.global]) {
      expect(ids.length).toBe(new Set(ids).size);
    }
  });

  it('every id the live roles.yaml binds resolves to a directive loadDirectives finds', () => {
    const roles = loadRolesYaml(liveRoot);
    const known = new Set(loadDirectives(liveRoot).map((d) => d.frontmatter.id));
    const bound = [...Object.values(roles.assignments).flat(), ...roles.global];
    expect(bound.length).toBeGreaterThan(0);
    expect(bound.filter((id) => !known.has(id))).toEqual([]);
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
