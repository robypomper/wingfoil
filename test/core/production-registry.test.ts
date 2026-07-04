/**
 * The real, production `CORE_MODULES` registry exported from `src/core/index.ts` (task-006,
 * spec-006-core-domain-api). Scope note (see task-006's Execution Notes): today this registry wires
 * in exactly the core functions that already legitimately exist — task-004's read-only per-pillar
 * loaders (`loadDnaYaml`, `loadDirectives`, `loadWorkflowsYaml`) — re-packaged as `mutates: false`
 * `CoreOperation`s. The full memory/dna/directives/workflow domain operations tables in spec-006 §3
 * (`memoryAdd`, `dnaSet`, ...) are feature work for task-018..030 and are deliberately NOT registered
 * here yet; there is intentionally zero mutating operation in production today.
 */
import { enumerateOperations } from '../../src/core/registry';
import { CORE_MODULES } from '../../src/core';
import { makeTempGitRepo, removeTempDir, writeFixtureFile } from '../storage/helpers/git-fixture';

describe('CORE_MODULES — production registry', () => {
  it('registers exactly the three currently-existing read-only pillar-loader operations', () => {
    const flat = enumerateOperations(CORE_MODULES).map(
      (entry) => `${entry.module.name}.${entry.operation.name}`,
    );
    expect(flat).toEqual(['dna.dnaShow', 'directives.directivesList', 'workflow.workflowList']);
  });

  it('every currently-registered operation is read-only (mutates: false) — no mutating op exists yet', () => {
    for (const { operation } of enumerateOperations(CORE_MODULES)) {
      expect(operation.mutates).toBe(false);
    }
  });
});

describe('CORE_MODULES operations — wrapped loader behavior', () => {
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

  function findOperation(moduleName: string, operationName: string) {
    const found = CORE_MODULES.find((m) => m.name === moduleName)?.operations[operationName];
    if (!found) throw new Error(`fixture bug: ${moduleName}.${operationName} not registered`);
    return found;
  }

  let repo: string;

  beforeEach(() => {
    repo = makeTempGitRepo();
  });

  afterEach(() => {
    removeTempDir(repo);
  });

  it('dnaShow returns coreOk(DnaYaml) when .wingfoil/dna.yaml is valid', async () => {
    writeFixtureFile(repo, '.wingfoil/dna.yaml', DNA_YAML);
    const result = await findOperation('dna', 'dnaShow').fn({ root: repo });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { modules: unknown[] }).modules).toHaveLength(1);
    }
  });

  it('dnaShow returns coreErr(NOT_FOUND) when .wingfoil/dna.yaml is missing', async () => {
    const result = await findOperation('dna', 'dnaShow').fn({ root: repo });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('directivesList returns coreOk([...]) for valid directive files', async () => {
    writeFixtureFile(repo, '.wingfoil/directives/custom/sample.md', DIRECTIVE_MD);
    const result = await findOperation('directives', 'directivesList').fn({ root: repo });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value as unknown[]).toHaveLength(1);
    }
  });

  it('directivesList returns coreErr(VALIDATION) for a directive file with bad frontmatter', async () => {
    writeFixtureFile(
      repo,
      '.wingfoil/directives/custom/broken.md',
      '---\nid: broken\ntype: not-a-directive\nkind: custom\ntitle: Broken\n---\n',
    );
    const result = await findOperation('directives', 'directivesList').fn({ root: repo });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION');
    }
  });

  it('workflowList returns coreOk({manifest, workflows}) for a valid workflows pillar', async () => {
    writeFixtureFile(repo, '.wingfoil/workflows.yaml', WORKFLOWS_YAML);
    writeFixtureFile(repo, '.wingfoil/workflows/custom/main.yaml', MAIN_WORKFLOW_YAML);
    const result = await findOperation('workflow', 'workflowList').fn({ root: repo });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { workflows: unknown[] }).workflows).toHaveLength(1);
    }
  });

  it('workflowList returns coreErr(VALIDATION) when an include path is missing (cross-file check)', async () => {
    writeFixtureFile(repo, '.wingfoil/workflows.yaml', 'version: 1.0\ninclude:\n  - workflows/custom/missing.yaml\n');
    const result = await findOperation('workflow', 'workflowList').fn({ root: repo });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION');
    }
  });
});
