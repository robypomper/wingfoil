/**
 * `memory` query primitives (task-008-dna-memory-query-latency, REQ-PERF-02). These are the
 * performance-bearing foundation `wingfoil memory search` (task-021, P1.5) will build its CLI/MCP
 * surface on top of: a deterministic, git-tracked-tree scan derived from `memory.yaml`'s per-type
 * `path` patterns (spec-011-storage-layout), plus keyword/frontmatter relevance filtering
 * (spec-012-context-loader-relevance-filtering's discipline — no full-text/semantic index).
 */
import {
  computeMemoryContentRoots,
  findMemoryDocumentById,
  listMemoryDocumentPaths,
  loadMemoryDocumentSummary,
  searchMemoryDocuments,
} from '../../src/memory/query';
import type { MemoryYaml } from '../../src/memory/schema';
import { makeTempGitRepo, removeTempDir, writeFixtureFile } from '../storage/helpers/git-fixture';

const MEMORY_YAML: MemoryYaml = {
  version: 1.1,
  types: {
    'release-line': { path: 'docs/04_memory/planning/{id}.md' },
    release: { path: 'docs/04_memory/planning/{release-line}/{id}.md' },
    task: { path: 'docs/04_memory/{release}/{id}.md' },
    adr: { path: 'docs/04_memory/design/adrs/{id}.md' },
    'decision-log': { path: 'docs/04_memory/design/dls/{id}.md' },
    'tech-spec': { path: 'docs/04_memory/design/specs/{id}.md' },
    bug: { path: 'docs/04_memory/bugs/{id}.md' },
  },
};

describe('computeMemoryContentRoots — derived from memory.yaml path patterns (spec-011)', () => {
  it('collapses to a single "docs/04_memory" root for the real 7-type registry (task\'s pattern is the broadest)', () => {
    expect(computeMemoryContentRoots(MEMORY_YAML)).toEqual(['docs/04_memory']);
  });

  it('does not include a root nested under another already-included root', () => {
    const yaml: MemoryYaml = {
      version: 1.1,
      types: {
        adr: { path: 'docs/04_memory/design/adrs/{id}.md' },
        bug: { path: 'docs/04_memory/bugs/{id}.md' },
      },
    };
    // Neither pattern's static dir is a prefix of the other's, so both survive.
    expect(computeMemoryContentRoots(yaml).sort()).toEqual(['docs/04_memory/bugs', 'docs/04_memory/design/adrs']);
  });

  it('is empty for a registry with no types', () => {
    expect(computeMemoryContentRoots({ version: 1.1, types: {} })).toEqual([]);
  });

  it('handles a placeholder-free path pattern (no `{...}` token at all)', () => {
    const yaml: MemoryYaml = { version: 1.1, types: { singleton: { path: 'docs/04_memory/singleton.md' } } };
    expect(computeMemoryContentRoots(yaml)).toEqual(['docs/04_memory']);
  });

  it('drops a type whose pattern has no directory portion at all (a bare `{id}.md`-style pattern)', () => {
    const yaml: MemoryYaml = { version: 1.1, types: { root: { path: '{id}.md' } } };
    expect(computeMemoryContentRoots(yaml)).toEqual([]);
  });
});

function seedRepo(): string {
  const repo = makeTempGitRepo();
  writeFixtureFile(
    repo,
    'docs/04_memory/v0.1/task-001-doc.md',
    [
      '---',
      'id: task-001-doc',
      'title: "API design"',
      'tags: [ architecture ]',
      'status: draft',
      '---',
      '',
      'Body text with no special keyword.',
      '',
    ].join('\n'),
  );
  writeFixtureFile(
    repo,
    'docs/04_memory/v0.1/task-002-doc.md',
    [
      '---',
      'id: task-002-doc',
      'title: "Unrelated task"',
      'tags: [ infra ]',
      'status: draft',
      '---',
      '',
      'This body mentions the api in passing, but only in the body.',
      '',
    ].join('\n'),
  );
  writeFixtureFile(
    repo,
    'docs/04_memory/design/adrs/adr-001-doc.md',
    ['---', 'id: adr-001-doc', 'title: "Storage layout"', 'tags: [ storage ]', 'status: draft', '---', '', 'Nothing relevant here.', ''].join(
      '\n',
    ),
  );
  return repo;
}

describe('listMemoryDocumentPaths — sorted, deterministic scan over the derived content roots', () => {
  let repo: string;

  afterEach(() => removeTempDir(repo));

  it('finds every .md document under the derived roots, sorted lexicographically', () => {
    repo = seedRepo();
    expect(listMemoryDocumentPaths(repo, MEMORY_YAML)).toEqual([
      'docs/04_memory/design/adrs/adr-001-doc.md',
      'docs/04_memory/v0.1/task-001-doc.md',
      'docs/04_memory/v0.1/task-002-doc.md',
    ]);
  });

  it('is stable across repeated calls (no cache, no ordering drift)', () => {
    repo = seedRepo();
    const first = listMemoryDocumentPaths(repo, MEMORY_YAML);
    const second = listMemoryDocumentPaths(repo, MEMORY_YAML);
    expect(second).toEqual(first);
  });

  it('ignores non-.md files under a content root', () => {
    repo = seedRepo();
    writeFixtureFile(repo, 'docs/04_memory/v0.1/notes.txt', 'not a memory document');
    expect(listMemoryDocumentPaths(repo, MEMORY_YAML)).not.toContain('docs/04_memory/v0.1/notes.txt');
  });

  it('returns [] for a derived content root that does not exist on disk (no types registered yet)', () => {
    repo = makeTempGitRepo();
    expect(listMemoryDocumentPaths(repo, MEMORY_YAML)).toEqual([]);
  });
});

describe('loadMemoryDocumentSummary', () => {
  let repo: string;

  afterEach(() => removeTempDir(repo));

  it('parses frontmatter into a plain object and returns the body separately', () => {
    repo = seedRepo();
    const summary = loadMemoryDocumentSummary(repo, 'docs/04_memory/v0.1/task-001-doc.md');
    expect(summary.frontmatter.id).toBe('task-001-doc');
    expect(summary.frontmatter.title).toBe('API design');
    expect(summary.frontmatter.tags).toEqual(['architecture']);
    expect(summary.body).toContain('Body text with no special keyword.');
  });

  it('degrades to an empty frontmatter object (never throws) when the frontmatter block does not parse to an object', () => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, 'docs/04_memory/v0.1/scalar.md', '---\njust a scalar string, not a mapping\n---\nBody\n');
    const summary = loadMemoryDocumentSummary(repo, 'docs/04_memory/v0.1/scalar.md');
    expect(summary.frontmatter).toEqual({});
    expect(summary.body).toBe('Body\n');
  });

  it('degrades to an empty frontmatter object for a document with no frontmatter block at all', () => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, 'docs/04_memory/v0.1/no-frontmatter.md', '# Just a heading\n');
    const summary = loadMemoryDocumentSummary(repo, 'docs/04_memory/v0.1/no-frontmatter.md');
    expect(summary.frontmatter).toEqual({});
    expect(summary.body).toBe('# Just a heading\n');
  });
});

describe('searchMemoryDocuments — deterministic keyword/frontmatter relevance (spec-012 discipline)', () => {
  let repo: string;

  afterEach(() => removeTempDir(repo));

  it('finds a document by a title keyword, case-insensitively', () => {
    repo = seedRepo();
    const matches = searchMemoryDocuments(repo, MEMORY_YAML, 'API');
    const paths = matches.map((m) => m.path);
    expect(paths).toContain('docs/04_memory/v0.1/task-001-doc.md');
  });

  it('ranks a metadata (title/tag/id) match above a body-only match', () => {
    repo = seedRepo();
    const matches = searchMemoryDocuments(repo, MEMORY_YAML, 'api');
    // task-001-doc matches on title ("API design") -> metadata match; task-002-doc only matches in body.
    const byPath = new Map(matches.map((m) => [m.path, m]));
    expect(byPath.get('docs/04_memory/v0.1/task-001-doc.md')?.metadataMatch).toBe(true);
    expect(byPath.get('docs/04_memory/v0.1/task-002-doc.md')?.bodyMatch).toBe(true);
    expect(matches[0]?.path).toBe('docs/04_memory/v0.1/task-001-doc.md');
  });

  it('filters by tag when `tag` option is given', () => {
    repo = seedRepo();
    const matches = searchMemoryDocuments(repo, MEMORY_YAML, '', { tag: 'architecture' });
    expect(matches.map((m) => m.path)).toEqual(['docs/04_memory/v0.1/task-001-doc.md']);
  });

  it('returns zero results (not an error) for a keyword nothing matches', () => {
    repo = seedRepo();
    expect(searchMemoryDocuments(repo, MEMORY_YAML, 'nonexistentkeyword')).toEqual([]);
  });

  it('is deterministic — repeated calls over unchanged state produce the exact same ordered result', () => {
    repo = seedRepo();
    const first = searchMemoryDocuments(repo, MEMORY_YAML, 'a');
    const second = searchMemoryDocuments(repo, MEMORY_YAML, 'a');
    expect(second).toEqual(first);
  });

  it('matches on `id` (not just title/tags), and combines a keyword with a `tag` filter', () => {
    repo = seedRepo();
    writeFixtureFile(
      repo,
      'docs/04_memory/v0.1/uniquetoken-doc.md',
      ['---', 'id: uniquetoken-doc', 'title: "Untitled"', 'tags: [ infra ]', 'status: draft', '---', '', 'body', ''].join('\n'),
    );
    const byId = searchMemoryDocuments(repo, MEMORY_YAML, 'uniquetoken');
    expect(byId.map((m) => m.path)).toEqual(['docs/04_memory/v0.1/uniquetoken-doc.md']);

    // Combining a keyword with a tag filter that excludes the only match -> zero results.
    expect(searchMemoryDocuments(repo, MEMORY_YAML, 'uniquetoken', { tag: 'architecture' })).toEqual([]);
    expect(searchMemoryDocuments(repo, MEMORY_YAML, 'uniquetoken', { tag: 'infra' })).toHaveLength(1);
  });

  it('breaks a same-tier tie by path when a document has no `id` frontmatter field', () => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, 'docs/04_memory/v0.1/no-id-b.md', '---\ntitle: "shared"\n---\nshared\n');
    writeFixtureFile(repo, 'docs/04_memory/v0.1/no-id-a.md', '---\ntitle: "shared"\n---\nshared\n');
    const matches = searchMemoryDocuments(repo, MEMORY_YAML, 'shared');
    expect(matches.map((m) => m.path)).toEqual(['docs/04_memory/v0.1/no-id-a.md', 'docs/04_memory/v0.1/no-id-b.md']);
  });
});

describe('findMemoryDocumentById — thin id -> document lookup (task-009-mcp-resource-fetch-latency, REQ-PERF-04)', () => {
  let repo: string;

  afterEach(() => removeTempDir(repo));

  it('returns the document whose frontmatter `id` matches exactly', () => {
    repo = seedRepo();
    const doc = findMemoryDocumentById(repo, MEMORY_YAML, 'task-002-doc');
    expect(doc?.path).toBe('docs/04_memory/v0.1/task-002-doc.md');
    expect(doc?.frontmatter.title).toBe('Unrelated task');
  });

  it('returns undefined (never throws) when no document has a matching `id`', () => {
    repo = seedRepo();
    expect(findMemoryDocumentById(repo, MEMORY_YAML, 'no-such-id')).toBeUndefined();
  });

  it('does not partial-match — a substring of an id is not a match', () => {
    repo = seedRepo();
    expect(findMemoryDocumentById(repo, MEMORY_YAML, 'task-002')).toBeUndefined();
  });
});
