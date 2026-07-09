/**
 * REQ-PERF-05 acceptance tests (task-035-bounded-context-relevance) for `src/core/relevance.ts`'s
 * `filterRelevantMemoryDocuments` — spec-012-context-loader-relevance-filtering §6's `relevance-filter`
 * unit. Covers the Fit Criterion verbatim ("given 1,000 Memory documents of which K are relevant to
 * the task, the assembled context contains exactly the K relevant (non-deprecated) documents and 0
 * others") at the literal 1,000-document reference scale, plus the tier-scoring/ordering/bounding
 * rules and the three P5.3.3-relevance-filtering.feature BDD scenarios (load-only-relevant,
 * deprecated-excluded, no-relevant-documents edge case).
 */
import {
  DEFAULT_CONTEXT_LIMITS,
  filterRelevantMemoryDocuments,
  NO_RELEVANT_MEMORY_NOTE,
} from '../../src/core/relevance';
import type { MemoryYaml } from '../../src/memory/schema';
import { commitAll, makeTempGitRepo, removeTempDir, writeFixtureFile } from '../storage/helpers/git-fixture';

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

function pad(n: number): string {
  return String(n).padStart(4, '0');
}

/** Deterministic filler body — index-derived only, no randomness/wall-clock (REQ-SYS-07). */
function fillerBody(index: number): string {
  const line = `Deterministic filler content for document ${index}, sized to look like a real Memory body.`;
  return Array.from({ length: 3 }, () => line).join(' ');
}

function writeTaskDoc(
  root: string,
  release: string,
  id: string,
  fields: { title?: string; status?: string; tags?: string[]; refs?: string[]; index: number },
): void {
  const { title = id, status = 'backlog', tags = [], refs = [], index } = fields;
  const lines = ['---', `id: ${id}`, 'type: task', `title: "${title}"`, `release: "${release}"`, `status: ${status}`];
  lines.push(`tags: [${tags.join(', ')}]`);
  if (refs.length > 0) lines.push(`ref: "${refs.join(' ')}"`);
  lines.push('---', '', fillerBody(index), '');
  writeFixtureFile(root, `docs/04_memory/${release}/${id}.md`, lines.join('\n'));
}

describe('filterRelevantMemoryDocuments (task-035-bounded-context-relevance, REQ-PERF-05, spec-012 §6)', () => {
  describe('REQ-PERF-05 Fit Criterion — 1,000 Memory documents, K relevant', () => {
    it('returns exactly the K relevant, non-deprecated documents and 0 others', () => {
      const root = makeTempGitRepo();
      try {
        // 6 documents deliberately made relevant via each spec-012 §6 tier (T1..T4), one of which is
        // ALSO deprecated (must still be excluded — REQ-PERF-05's own "(non-deprecated)" clause).
        writeTaskDoc(root, 'v0.2', 'task-100-t1-linked', { index: 0, status: 'backlog' }); // T1: cited in depends_on
        writeTaskDoc(root, 'v0.2', 'task-101-t2-release', { index: 1, status: 'backlog' }); // T2: same release
        writeTaskDoc(root, 'v0.2', 'task-102-t3-req', { index: 2, refs: ['REQ-PERF-05'], status: 'backlog' }); // T3: shared REQ-*
        writeTaskDoc(root, 'v0.2', 'task-103-t4-tag', { index: 3, tags: ['performance'], status: 'backlog' }); // T4: shared tag
        writeTaskDoc(root, 'v0.2', 'task-104-t1-deprecated', { index: 4, status: 'deprecated' }); // T1 but deprecated -> excluded
        writeTaskDoc(root, 'v0.9', 'task-105-t1-other-release', { index: 5, status: 'backlog' }); // T1, different release path

        const relevantIds = new Set([
          'task-100-t1-linked',
          'task-101-t2-release',
          'task-102-t3-req',
          'task-103-t4-tag',
          'task-105-t1-other-release',
        ]);

        // 994 irrelevant filler documents (no tier hit at all: different release, no shared REQ/tag,
        // not linked) so the fixture totals exactly 1,000 documents.
        for (let n = 0; n < 994; n += 1) {
          writeTaskDoc(root, 'v0.5', `task-9${pad(n)}-filler`, { index: 100 + n, status: 'backlog' });
        }

        commitAll(root, 'seed 1,000-document reference repository (REQ-PERF-05)');

        const element = {
          type: 'task',
          id: 'task-000-active',
          frontmatter: {
            release: 'v0.2',
            tags: ['performance'],
            depends_on: ['task-100-t1-linked', 'task-104-t1-deprecated', 'task-105-t1-other-release'],
          },
        };

        const result = filterRelevantMemoryDocuments(root, MEMORY_YAML, element, {
          maxDocs: 100,
          maxBytes: DEFAULT_CONTEXT_LIMITS.maxBytes,
        });

        expect(result.documents).toHaveLength(relevantIds.size);
        expect(new Set(result.documents.map((doc) => doc.id))).toEqual(relevantIds);
        expect(result.documents.every((doc) => doc.status !== 'deprecated')).toBe(true);
        expect(result.note).toBeUndefined();
      } finally {
        removeTempDir(root);
      }
    });
  });

  describe('P5.3.3-relevance-filtering.feature BDD scenarios', () => {
    it('Scenario: Load only relevant documents — 100 documents, 5 relevant, 95 excluded', () => {
      const root = makeTempGitRepo();
      try {
        const relevantIds: string[] = [];
        for (let n = 0; n < 5; n += 1) {
          const id = `task-2${pad(n)}-relevant`;
          writeTaskDoc(root, 'v0.2', id, { index: n, tags: ['performance'] });
          relevantIds.push(id);
        }
        for (let n = 0; n < 95; n += 1) {
          writeTaskDoc(root, 'v0.5', `task-3${pad(n)}-noise`, { index: 5 + n });
        }
        commitAll(root, 'seed 100-document fixture');

        const element = { type: 'task', id: 'task-active', frontmatter: { release: 'v0.2', tags: ['performance'] } };
        const result = filterRelevantMemoryDocuments(root, MEMORY_YAML, element);

        expect(result.documents).toHaveLength(5);
        expect(new Set(result.documents.map((doc) => doc.id))).toEqual(new Set(relevantIds));
      } finally {
        removeTempDir(root);
      }
    });

    it('Scenario: Deprecated documents are never loaded — 1 of 5 relevant is deprecated, 4 remain', () => {
      const root = makeTempGitRepo();
      try {
        const expectedIds: string[] = [];
        for (let n = 0; n < 5; n += 1) {
          const id = `task-4${pad(n)}-relevant`;
          const status = n === 0 ? 'deprecated' : 'backlog';
          writeTaskDoc(root, 'v0.2', id, { index: n, tags: ['performance'], status });
          if (status !== 'deprecated') expectedIds.push(id);
        }
        commitAll(root, 'seed deprecated-exclusion fixture');

        const element = { type: 'task', id: 'task-active', frontmatter: { release: 'v0.2', tags: ['performance'] } };
        const result = filterRelevantMemoryDocuments(root, MEMORY_YAML, element);

        expect(result.documents).toHaveLength(4);
        expect(new Set(result.documents.map((doc) => doc.id))).toEqual(new Set(expectedIds));
      } finally {
        removeTempDir(root);
      }
    });

    it('Scenario: Edge - no documents pass the relevance threshold — zero loaded, note recorded', () => {
      const root = makeTempGitRepo();
      try {
        for (let n = 0; n < 10; n += 1) {
          writeTaskDoc(root, 'v0.5', `task-5${pad(n)}-noise`, { index: n });
        }
        commitAll(root, 'seed no-relevance fixture');

        const element = { type: 'task', id: 'task-active', frontmatter: { release: 'v0.2', tags: ['unrelated'] } };
        const result = filterRelevantMemoryDocuments(root, MEMORY_YAML, element);

        expect(result.documents).toHaveLength(0);
        expect(result.note).toBe(NO_RELEVANT_MEMORY_NOTE);
        expect(NO_RELEVANT_MEMORY_NOTE).toBe('no relevant Memory found for task');
      } finally {
        removeTempDir(root);
      }
    });
  });

  describe('tier scoring, ordering, and self-exclusion', () => {
    it('orders by score DESC, then type ASC, then id ASC (total, deterministic order)', () => {
      const root = makeTempGitRepo();
      try {
        // Two docs share the exact same score (both T4-only, 1 tag overlap) — tie-break must be
        // type ASC then id ASC, not insertion/scan order.
        writeTaskDoc(root, 'v0.2', 'task-900-b', { index: 0, tags: ['performance'], status: 'backlog' });
        writeFixtureFile(
          root,
          'docs/04_memory/design/adrs/adr-900-a.md',
          ['---', 'id: adr-900-a', 'type: adr', 'title: "Same-tier ADR"', 'status: accepted', 'tags: [performance]', '---', '', fillerBody(1), ''].join('\n'),
        );
        // A T1 (explicit link) doc must outrank both, regardless of alphabetical id/type.
        writeTaskDoc(root, 'v0.2', 'task-901-zzz-linked', { index: 2, status: 'backlog' });
        commitAll(root, 'seed ordering fixture');

        const element = {
          type: 'task',
          id: 'task-active',
          frontmatter: { release: 'v0.2', tags: ['performance'], depends_on: ['task-901-zzz-linked'] },
        };
        const result = filterRelevantMemoryDocuments(root, MEMORY_YAML, element);

        expect(result.documents.map((doc) => doc.id)).toEqual(['task-901-zzz-linked', 'adr-900-a', 'task-900-b']);
      } finally {
        removeTempDir(root);
      }
    });

    it('never includes the element\'s own document, even when it would otherwise score relevant', () => {
      const root = makeTempGitRepo();
      try {
        writeTaskDoc(root, 'v0.2', 'task-active', { index: 0, tags: ['performance'] });
        writeTaskDoc(root, 'v0.2', 'task-910-other', { index: 1, tags: ['performance'] });
        commitAll(root, 'seed self-exclusion fixture');

        const element = { type: 'task', id: 'task-active', frontmatter: { release: 'v0.2', tags: ['performance'] } };
        const result = filterRelevantMemoryDocuments(root, MEMORY_YAML, element);

        expect(result.documents.map((doc) => doc.id)).toEqual(['task-910-other']);
      } finally {
        removeTempDir(root);
      }
    });

    it('excludes draft documents in addition to deprecated (spec-012 §6)', () => {
      const root = makeTempGitRepo();
      try {
        writeTaskDoc(root, 'v0.2', 'task-920-draft', { index: 0, tags: ['performance'], status: 'draft' });
        writeTaskDoc(root, 'v0.2', 'task-921-ready', { index: 1, tags: ['performance'], status: 'backlog' });
        commitAll(root, 'seed draft-exclusion fixture');

        const element = { type: 'task', id: 'task-active', frontmatter: { release: 'v0.2', tags: ['performance'] } };
        const result = filterRelevantMemoryDocuments(root, MEMORY_YAML, element);

        expect(result.documents.map((doc) => doc.id)).toEqual(['task-921-ready']);
      } finally {
        removeTempDir(root);
      }
    });
  });

  describe('deterministic bounding (ContextLimits)', () => {
    it('stops at maxDocs without dropping a higher-ranked doc to admit a lower-ranked one', () => {
      const root = makeTempGitRepo();
      try {
        // 5 docs, all T1-linked (same score) — id ASC breaks the tie deterministically.
        const ids = ['task-800-a', 'task-801-b', 'task-802-c', 'task-803-d', 'task-804-e'];
        ids.forEach((id, index) => writeTaskDoc(root, 'v0.2', id, { index, status: 'backlog' }));
        commitAll(root, 'seed maxDocs-bounding fixture');

        const element = { type: 'task', id: 'task-active', frontmatter: { release: 'v0.9', depends_on: ids } };
        const result = filterRelevantMemoryDocuments(root, MEMORY_YAML, element, { maxDocs: 3, maxBytes: DEFAULT_CONTEXT_LIMITS.maxBytes });

        expect(result.documents.map((doc) => doc.id)).toEqual(['task-800-a', 'task-801-b', 'task-802-c']);
      } finally {
        removeTempDir(root);
      }
    });

    it('stops at maxBytes without dropping a higher-ranked doc to admit a lower-ranked one', () => {
      const root = makeTempGitRepo();
      try {
        const ids = ['task-810-a', 'task-811-b', 'task-812-c'];
        ids.forEach((id, index) => writeTaskDoc(root, 'v0.2', id, { index, status: 'backlog' }));
        commitAll(root, 'seed maxBytes-bounding fixture');

        const element = { type: 'task', id: 'task-active', frontmatter: { release: 'v0.9', depends_on: ids } };
        // Each body is well over 100 bytes; a 150-byte cap admits exactly one document.
        const result = filterRelevantMemoryDocuments(root, MEMORY_YAML, element, { maxDocs: DEFAULT_CONTEXT_LIMITS.maxDocs, maxBytes: 150 });

        expect(result.documents.map((doc) => doc.id)).toEqual(['task-810-a']);
      } finally {
        removeTempDir(root);
      }
    });
  });
});
