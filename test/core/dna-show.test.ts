/**
 * P2.2 (US-3-03) — `wingfoil dna show [section]` core-op fit criteria, per
 * `docs/02_requirements/02_bdd/features/p2-dna/P2.2-dna-show.feature` and
 * `docs/self/docs/04_memory/design/specs/spec-002-dna-yaml-schema.md` /
 * `docs/self/docs/04_memory/design/specs/spec-006-core-domain-api.md` (task-026-implement-dna-show).
 *
 * Exercises the REAL `CORE_MODULES` `dna.dnaShow` operation directly — the exact same `CoreFn` both
 * `src/cli`'s `dna show` command and the MCP `wingfoil://dna/show` Resource call (spec-006 §2/§4) —
 * no reimplementation of the lookup/alias/error logic here.
 */
import { CORE_MODULES } from '../../src/core';
import type { CoreFn } from '../../src/core/registry';
import { exitCodeForResult } from '../../src/core/exit-code';
import { makeTempGitRepo, removeTempDir, writeFixtureFile } from '../storage/helpers/git-fixture';

const DNA_FIXTURE = `
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

/** The real, registered `dna.dnaShow` `CoreFn` — fails loudly if a future change ever un-registers it. */
function dnaShowFn(): CoreFn<unknown, unknown> {
  const dnaModule = CORE_MODULES.find((module) => module.name === 'dna');
  if (!dnaModule) throw new Error('fixture bug: "dna" module not found in CORE_MODULES');
  const operation = dnaModule.operations.dnaShow;
  if (!operation) throw new Error('fixture bug: "dnaShow" operation not found on the dna module');
  return operation.fn;
}

describe('CORE_MODULES dna.dnaShow — P2.2 fit criteria', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, '.wingfoil/dna.yaml', DNA_FIXTURE);
  });

  afterEach(() => {
    removeTempDir(repo);
  });

  it('AC(a): no section -> the whole parsed DnaYaml (modules/stacks/team/paths)', async () => {
    const result = await dnaShowFn()({ root: repo });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const value = result.value as Record<string, unknown>;
    expect(value.modules).toBeDefined();
    expect(value.stacks).toBeDefined();
    expect(value.team).toBeDefined();
    expect(value.paths).toBeDefined();
  });

  it('AC(b): a section argument (the generic CLI "positional" seam) prints only that subtree', async () => {
    const result = await dnaShowFn()({ root: repo, positional: 'team' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      members: [{ name: 'Test User', roles: ['developer'] }],
      roles: [{ name: 'developer' }],
    });
  });

  it('AC(b): "tech_stack" resolves as a BDD-compat alias for "stacks" (spec-002 Consequences)', async () => {
    const full = await dnaShowFn()({ root: repo });
    const aliased = await dnaShowFn()({ root: repo, positional: 'tech_stack' });
    expect(full.ok).toBe(true);
    expect(aliased.ok).toBe(true);
    if (!full.ok || !aliased.ok) return;
    expect(aliased.value).toEqual((full.value as Record<string, unknown>).stacks);
  });

  it('AC(c): a nonexistent section -> CoreResult.error NOT_FOUND, exact message, mapped to exit 1 (never 2)', async () => {
    const result = await dnaShowFn()({ root: repo, positional: 'nonexistent_section' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
    expect(result.error.message).toBe("no DNA key named 'nonexistent_section'");
    expect(exitCodeForResult(result)).toBe(1);
  });
});
