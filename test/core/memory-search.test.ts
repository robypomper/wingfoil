/**
 * P1.5 (US-1-08) — `wingfoil memory search` core-op fit criteria, per
 * `docs/02_requirements/02_bdd/features/p1-memory/P1.5-memory-search.feature`,
 * `docs/02_requirements/02_bdd/features/p1-memory/P1.12-keyword-search.feature`,
 * `spec-006-core-domain-api.md` (`memorySearch` is `mutates: false` -> MCP Resource
 * `wingfoil://memory/search`, verbatim), `spec-010-memory-frontmatter-schema.md` (base fields the
 * `--tag`/`--status`/`--type` filters match against), `spec-005-cli-command-contract.md` /
 * `spec-008-cli-grammar.md` (exit codes: zero matches -> 0, empty query -> 2), task-021 (this task).
 *
 * Exercises the REAL, registered `CORE_MODULES` `memory.memorySearch` operation — the exact same
 * `CoreFn` both `src/cli`'s `memory search` command and the MCP `wingfoil://memory/search` Resource
 * call. Wraps task-008/023's `src/memory/query.ts` primitives (`searchMemoryDocuments`,
 * `validateSearchQuery`) — no scan/ranking/validation logic is reimplemented here. Every fixture
 * lives in a THROWAWAY temp git repo (never this repo's own `docs/self/docs/04_memory/`).
 */
import { CORE_MODULES } from '../../src/core';
import type { CoreFn } from '../../src/core/registry';
import { exitCodeForResult, exitCodeForThrow } from '../../src/core/exit-code';
import { ValidationError } from '../../src/validation';
import { makeTempGitRepo, removeTempDir, writeFixtureFile, commitAll } from '../storage/helpers/git-fixture';

const MEMORY_YAML = `version: 1
types:
  task:
    path: "docs/04_memory/{release}/{id}.md"
  adr:
    path: "docs/04_memory/design/adrs/{id}.md"
`;

/** The real, registered `memory.memorySearch` `CoreFn` — fails loudly if a future change un-registers it. */
function memorySearchFn(): CoreFn<unknown, { query: string; matches: unknown[]; message?: string }> {
  const memoryModule = CORE_MODULES.find((module) => module.name === 'memory');
  const operation = memoryModule?.operations.memorySearch;
  if (!operation) throw new Error('fixture bug: "memorySearch" operation not registered on the memory module');
  return operation.fn as CoreFn<unknown, { query: string; matches: unknown[]; message?: string }>;
}

describe('CORE_MODULES memory.memorySearch — P1.5 fit criteria', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, '.wingfoil/memory.yaml', MEMORY_YAML);
    writeFixtureFile(
      repo,
      'docs/04_memory/v0.1/task-001-api-design.md',
      [
        '---',
        'id: task-001-api-design',
        'type: task',
        'title: "API design"',
        'status: draft',
        'tags: [ architecture ]',
        '---',
        '',
        'Discusses the REST API surface.',
        '',
      ].join('\n'),
    );
    writeFixtureFile(
      repo,
      'docs/04_memory/design/adrs/adr-001-storage.md',
      [
        '---',
        'id: adr-001-storage',
        'type: adr',
        'title: "Storage layout"',
        'status: accepted',
        'tags: [ storage ]',
        '---',
        '',
        'Nothing about that topic here.',
        '',
      ].join('\n'),
    );
    commitAll(repo, 'seed memory.yaml + two documents');
  });

  afterEach(() => removeTempDir(repo));

  it('AC(a): a keyword match returns the "API design" document (BDD "Find a decision by keyword")', async () => {
    const result = await memorySearchFn()({ root: repo, positional: 'api' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.query).toBe('api');
    expect(result.value.matches.map((m) => (m as { id?: string }).id)).toContain('task-001-api-design');
    expect(result.value.message).toBeUndefined();
    expect(exitCodeForResult(result)).toBe(0);
  });

  it('AC(a) is case-insensitive (P1.12 Scenario 2)', async () => {
    const result = await memorySearchFn()({ root: repo, positional: 'API' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.matches.map((m) => (m as { id?: string }).id)).toContain('task-001-api-design');
  });

  it('AC(b): `--tag architecture` (no keyword) returns only documents carrying that tag (BDD "Filter results by metadata tag")', async () => {
    const result = await memorySearchFn()({ root: repo, options: { tag: 'architecture' } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.value.matches.map((m) => (m as { id?: string }).id);
    expect(ids).toEqual(['task-001-api-design']);
    // Every returned document has the tag (BDD's own "every returned document" assertion).
    for (const match of result.value.matches) {
      expect((match as { tags: readonly string[] }).tags).toContain('architecture');
    }
  });

  it('AC(c): a query with zero matches exits 0 with the exact "no documents matched the query" message (BDD "Error - query with no matches")', async () => {
    const result = await memorySearchFn()({ root: repo, positional: 'nonexistentkeyword' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.matches).toEqual([]);
    expect(result.value.message).toBe('no documents matched the query');
    expect(exitCodeForResult(result)).toBe(0);
  });

  it('an explicit empty-string query throws a ValidationError -> exit 2 with the exact "empty search query" message (P1.12 "Error - empty query string")', async () => {
    await expect(memorySearchFn()({ root: repo, positional: '' })).rejects.toBeInstanceOf(ValidationError);
    try {
      await memorySearchFn()({ root: repo, positional: '' });
      throw new Error('expected a ValidationError');
    } catch (error) {
      const outcome = exitCodeForThrow(error);
      expect(outcome.exitCode).toBe(2);
      expect(outcome.reason).toBe('empty search query');
    }
  });

  it('a whitespace-only query is likewise rejected (validateSearchQuery trims before checking)', async () => {
    await expect(memorySearchFn()({ root: repo, positional: '   ' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('an OMITTED keyword (no positional at all) is NOT an empty query — it browses/filters without throwing', async () => {
    const result = await memorySearchFn()({ root: repo });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // No keyword, no filters -> every document in the store (symmetric with `dna show`/`paths`'s own
    // "no argument -> whole node" precedent), never a thrown validation error.
    expect(result.value.matches).toHaveLength(2);
  });

  it('`--type task` narrows the result to documents of that type', async () => {
    const result = await memorySearchFn()({ root: repo, options: { type: 'task' } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.matches.map((m) => (m as { id?: string }).id)).toEqual(['task-001-api-design']);
  });

  it('`--status accepted` narrows the result to documents in that state', async () => {
    const result = await memorySearchFn()({ root: repo, options: { status: 'accepted' } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.matches.map((m) => (m as { id?: string }).id)).toEqual(['adr-001-storage']);
  });

  it('combining a keyword with a `--tag` filter that excludes the only match returns zero results, exit 0', async () => {
    const result = await memorySearchFn()({ root: repo, positional: 'api', options: { tag: 'storage' } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.matches).toEqual([]);
    expect(result.value.message).toBe('no documents matched the query');
  });

  it('is deterministic — repeated calls over unchanged state produce the exact same ordered result (REQ-SYS-07)', async () => {
    const first = await memorySearchFn()({ root: repo });
    const second = await memorySearchFn()({ root: repo });
    expect(second).toEqual(first);
  });

  it('a missing `.wingfoil/memory.yaml` is a domain NOT_FOUND (CoreResult.error, exit 1), never a thrown crash', async () => {
    const bareRepo = makeTempGitRepo();
    try {
      const result = await memorySearchFn()({ root: bareRepo, positional: 'api' });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(exitCodeForResult(result)).toBe(1);
    } finally {
      removeTempDir(bareRepo);
    }
  });
});
