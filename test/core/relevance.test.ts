/**
 * REQ-PERF-05 acceptance tests (task-035-bounded-context-relevance) for `src/core/relevance.ts`'s
 * `filterRelevantMemoryDocuments` — spec-012-context-loader-relevance-filtering §6's `relevance-filter`
 * unit. Covers the Fit Criterion verbatim ("given 1,000 Memory documents of which K are relevant to
 * the task, the assembled context contains exactly the K relevant (non-deprecated) documents and 0
 * others") at the literal 1,000-document reference scale, plus the tier-scoring/ordering/bounding
 * rules and the three P5.3.3-relevance-filtering.feature BDD scenarios (load-only-relevant,
 * deprecated-excluded, no-relevant-documents edge case).
 *
 * **Second pass (review fallback `in-review -> in-progress`).** Three review findings and one
 * ratified decision-log add the blocks marked `(second pass)` below:
 * - the module must be reachable through `src/core`'s public barrel, not only by deep path import;
 * - {@link NO_RELEVANT_MEMORY_NOTE} must assert "no relevant Memory found" only when nothing passed
 *   the relevance threshold — never when relevant documents existed and were merely bounded out;
 * - `dl-028-archived-states-excluded-from-context` (`ready`) makes the archived set canonically
 *   `{deprecated, superseded}` and drops the vestigial `rejected`, behind one shared
 *   `isArchivedStatus` predicate consumed by both the search path and this context path.
 */
import * as coreBarrel from '../../src/core';
import {
  DEFAULT_CONTEXT_LIMITS,
  filterRelevantMemoryDocuments,
  NO_RELEVANT_MEMORY_NOTE,
} from '../../src/core/relevance';
import { ARCHIVED_STATUSES } from '../../src/memory/state-machine';
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
        // type ASC then id ASC, not insertion/scan order. `task-900-b` is deliberately under a
        // DIFFERENT release than the element (T2 must NOT also fire for it, or the tie breaks early).
        writeTaskDoc(root, 'v0.9', 'task-900-b', { index: 0, tags: ['performance'], status: 'backlog' });
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
        // Each filler body is ~251 bytes; a 300-byte cap admits exactly one document (two would be ~502).
        const result = filterRelevantMemoryDocuments(root, MEMORY_YAML, element, { maxDocs: DEFAULT_CONTEXT_LIMITS.maxDocs, maxBytes: 300 });

        expect(result.documents.map((doc) => doc.id)).toEqual(['task-810-a']);
      } finally {
        removeTempDir(root);
      }
    });
  });

  describe('defensive edge cases (frontmatter completeness)', () => {
    it('scores an element that declares no release (T2 never fires) purely on T3/T4', () => {
      const root = makeTempGitRepo();
      try {
        writeTaskDoc(root, 'v0.2', 'task-700-tag', { index: 0, tags: ['performance'], status: 'backlog' });
        writeTaskDoc(root, 'v0.5', 'task-701-tag', { index: 1, tags: ['performance'], status: 'backlog' });
        writeTaskDoc(root, 'v0.5', 'task-702-noise', { index: 2, tags: ['unrelated'], status: 'backlog' });
        commitAll(root, 'seed no-release-element fixture');

        // No `release` in the element frontmatter → `isSameReleaseScope` short-circuits to false for
        // every candidate; only the shared-tag (T4) docs survive, regardless of which release they live under.
        const element = { type: 'task', id: 'task-active', frontmatter: { tags: ['performance'] } };
        const result = filterRelevantMemoryDocuments(root, MEMORY_YAML, element);

        expect(new Set(result.documents.map((doc) => doc.id))).toEqual(new Set(['task-700-tag', 'task-701-tag']));
      } finally {
        removeTempDir(root);
      }
    });

    it('sorts a relevant document that has no `id` frontmatter by its path (tie-break fallback)', () => {
      const root = makeTempGitRepo();
      try {
        // A well-formed doc (has id) and a malformed one (no id) both match on the same tag → equal
        // score. The id-less doc must still sort deterministically via its path fallback, never throw.
        writeFixtureFile(
          root,
          'docs/04_memory/v0.2/task-600-has-id.md',
          ['---', 'id: task-600-has-id', 'type: task', 'release: "v0.9"', 'status: backlog', 'tags: [performance]', '---', '', fillerBody(0), ''].join('\n'),
        );
        writeFixtureFile(
          root,
          'docs/04_memory/v0.2/zzz-no-id.md',
          ['---', 'type: task', 'release: "v0.9"', 'status: backlog', 'tags: [performance]', '---', '', fillerBody(1), ''].join('\n'),
        );
        commitAll(root, 'seed missing-id fixture');

        const element = { type: 'task', id: 'task-active', frontmatter: { release: 'v0.9', tags: ['performance'] } };
        const result = filterRelevantMemoryDocuments(root, MEMORY_YAML, element);

        // Same score → tie-break on `id ?? path`. The id-less doc falls back to its path
        // ("docs/…"), which sorts BEFORE the id "task-600-has-id" ('d' < 't'); the key point is the
        // order is total and never throws on the missing id.
        expect(result.documents.map((doc) => doc.id ?? doc.path)).toEqual([
          'docs/04_memory/v0.2/zzz-no-id.md',
          'task-600-has-id',
        ]);
      } finally {
        removeTempDir(root);
      }
    });

    it('matches T3 traceability keys that appear in a candidate\'s tags array, not just its ref string', () => {
      const root = makeTempGitRepo();
      try {
        // The candidate carries the shared REQ token inside its `tags:` ARRAY (not a scalar `ref`), so
        // this exercises collectTraceabilityKeys' array branch. Different release, no tag/keyword overlap.
        writeFixtureFile(
          root,
          'docs/04_memory/v0.5/task-500-array-req.md',
          ['---', 'id: task-500-array-req', 'type: task', 'release: "v0.5"', 'status: backlog', 'tags: ["REQ-PERF-05"]', '---', '', fillerBody(0), ''].join('\n'),
        );
        commitAll(root, 'seed array-traceability fixture');

        const element = { type: 'task', id: 'task-active', frontmatter: { release: 'v0.9', ref: 'REQ-PERF-05' } };
        const result = filterRelevantMemoryDocuments(root, MEMORY_YAML, element);

        expect(result.documents.map((doc) => doc.id)).toEqual(['task-500-array-req']);
      } finally {
        removeTempDir(root);
      }
    });
  });

  describe('public API reachability through the `core` barrel (second pass — review finding 1)', () => {
    // The deliverable is only usable by a sibling unit (task-037's `context-builder`) or by a
    // CLI/MCP surface if `src/core/index.ts` re-exports it — a deep `src/core/relevance` import is
    // not the module's public API. `src/memory/query.ts` (task-008) set the precedent: every one of
    // its primitives is re-exported from `src/memory/index.ts`.
    const exported = coreBarrel as unknown as Record<string, unknown>;

    it('re-exports `filterRelevantMemoryDocuments` from `src/core`', () => {
      expect(typeof exported.filterRelevantMemoryDocuments).toBe('function');
    });

    it('re-exports the spec-012 §6 constants (`DEFAULT_CONTEXT_LIMITS`, `NO_RELEVANT_MEMORY_NOTE`)', () => {
      expect(exported.DEFAULT_CONTEXT_LIMITS).toEqual({ maxDocs: 40, maxBytes: 262144 });
      expect(exported.NO_RELEVANT_MEMORY_NOTE).toBe('no relevant Memory found for task');
    });

    it('the barrel-exported function is the same callable, working end to end', () => {
      const root = makeTempGitRepo();
      try {
        writeTaskDoc(root, 'v0.2', 'task-210-relevant', { index: 0, tags: ['performance'] });
        commitAll(root, 'seed barrel-reachability fixture');

        const element = { type: 'task', id: 'task-active', frontmatter: { release: 'v0.2', tags: ['performance'] } };
        const viaBarrel = (
          exported.filterRelevantMemoryDocuments as typeof filterRelevantMemoryDocuments
        )(root, MEMORY_YAML, element);

        expect(viaBarrel.documents.map((doc) => doc.id)).toEqual(['task-210-relevant']);
      } finally {
        removeTempDir(root);
      }
    });
  });

  describe('the no-relevant-Memory note asserts only what is true (second pass — review finding 2)', () => {
    // P5.3.3's note is a factual claim ("no relevant Memory found for task"). Emitting it whenever
    // the BOUNDED result is empty lets it fire while relevant documents existed and were merely
    // bounded out by ContextLimits — an assertion the filter cannot support. The note belongs to the
    // relevance threshold (the SCORED set), not to the bounding step.
    function seedOneRelevantDoc(root: string): void {
      writeTaskDoc(root, 'v0.2', 'task-220-relevant', { index: 0, tags: ['performance'] });
      commitAll(root, 'seed bounded-out fixture');
    }

    const element = { type: 'task', id: 'task-active', frontmatter: { release: 'v0.2', tags: ['performance'] } };

    it('records NO note when a relevant document existed but was bounded out by `maxBytes`', () => {
      const root = makeTempGitRepo();
      try {
        seedOneRelevantDoc(root);
        // Each filler body is ~251 bytes, so a 10-byte cap admits nothing — yet one document DID
        // pass the relevance threshold, so "no relevant Memory found" would be false.
        const result = filterRelevantMemoryDocuments(root, MEMORY_YAML, element, { maxDocs: 40, maxBytes: 10 });

        expect(result.documents).toHaveLength(0);
        expect(result.note).toBeUndefined();
      } finally {
        removeTempDir(root);
      }
    });

    it('records NO note when a relevant document existed but was bounded out by `maxDocs`', () => {
      const root = makeTempGitRepo();
      try {
        seedOneRelevantDoc(root);
        const result = filterRelevantMemoryDocuments(root, MEMORY_YAML, element, {
          maxDocs: 0,
          maxBytes: DEFAULT_CONTEXT_LIMITS.maxBytes,
        });

        expect(result.documents).toHaveLength(0);
        expect(result.note).toBeUndefined();
      } finally {
        removeTempDir(root);
      }
    });

    it('still records the note when nothing passed the relevance threshold (P5.3.3 edge case unchanged)', () => {
      const root = makeTempGitRepo();
      try {
        writeTaskDoc(root, 'v0.5', 'task-230-noise', { index: 0 });
        commitAll(root, 'seed threshold fixture');

        const result = filterRelevantMemoryDocuments(root, MEMORY_YAML, element);

        expect(result.documents).toHaveLength(0);
        expect(result.note).toBe(NO_RELEVANT_MEMORY_NOTE);
      } finally {
        removeTempDir(root);
      }
    });
  });

  describe('dl-028 archived set — {deprecated, superseded} (second pass)', () => {
    it('the shared archived set is exactly {deprecated, superseded} — `rejected` is gone', () => {
      // `spec-001-memory-yaml-schema` removed `rejected` from every type's machine, so spec-012 §6's
      // former `draft`/`rejected`/`deprecated` list named a status that cannot occur. dl-028 drops it
      // and adds `superseded` (the terminal archived state of `adr`/`tech-spec`).
      expect([...ARCHIVED_STATUSES]).toEqual(['deprecated', 'superseded']);
    });

    it('excludes a `superseded` ADR from context even when it scores as relevant', () => {
      const root = makeTempGitRepo();
      try {
        writeFixtureFile(
          root,
          'docs/04_memory/design/adrs/adr-930-superseded.md',
          ['---', 'id: adr-930-superseded', 'type: adr', 'title: "Superseded decision"', 'status: superseded', 'tags: [performance]', '---', '', fillerBody(0), ''].join('\n'),
        );
        writeFixtureFile(
          root,
          'docs/04_memory/design/adrs/adr-931-current.md',
          ['---', 'id: adr-931-current', 'type: adr', 'title: "Current decision"', 'status: accepted', 'tags: [performance]', '---', '', fillerBody(1), ''].join('\n'),
        );
        commitAll(root, 'seed superseded-exclusion fixture');

        const element = { type: 'task', id: 'task-active', frontmatter: { release: 'v0.2', tags: ['performance'] } };
        const result = filterRelevantMemoryDocuments(root, MEMORY_YAML, element);

        expect(result.documents.map((doc) => doc.id)).toEqual(['adr-931-current']);
      } finally {
        removeTempDir(root);
      }
    });

    it('excludes a `superseded` tech-spec from context for the same reason', () => {
      const root = makeTempGitRepo();
      try {
        writeFixtureFile(
          root,
          'docs/04_memory/design/specs/spec-930-superseded.md',
          ['---', 'id: spec-930-superseded', 'type: tech-spec', 'title: "Superseded spec"', 'status: superseded', 'tags: [performance]', '---', '', fillerBody(0), ''].join('\n'),
        );
        commitAll(root, 'seed superseded-spec fixture');

        const element = { type: 'task', id: 'task-active', frontmatter: { release: 'v0.2', tags: ['performance'] } };
        const result = filterRelevantMemoryDocuments(root, MEMORY_YAML, element);

        expect(result.documents).toHaveLength(0);
        expect(result.note).toBe(NO_RELEVANT_MEMORY_NOTE);
      } finally {
        removeTempDir(root);
      }
    });

    it('keeps `draft` excluded from CONTEXT — the context set is archived ∪ {draft}, wider than the search set', () => {
      // Asymmetry pinned deliberately (task-038's Execution Notes): `draft` is excluded HERE
      // (spec-012 §6: only "stable, decided" content enters an execution context) but is NOT
      // excluded from `memory search` (REQ-STATE-06 names archived content only). The mirror
      // assertion lives in `test/memory/query.test.ts`.
      const root = makeTempGitRepo();
      try {
        writeTaskDoc(root, 'v0.2', 'task-940-draft', { index: 0, tags: ['performance'], status: 'draft' });
        writeTaskDoc(root, 'v0.2', 'task-941-deprecated', { index: 1, tags: ['performance'], status: 'deprecated' });
        writeTaskDoc(root, 'v0.2', 'task-942-active', { index: 2, tags: ['performance'], status: 'backlog' });
        commitAll(root, 'seed context-exclusion-set fixture');

        const element = { type: 'task', id: 'task-active', frontmatter: { release: 'v0.2', tags: ['performance'] } };
        const result = filterRelevantMemoryDocuments(root, MEMORY_YAML, element);

        expect(result.documents.map((doc) => doc.id)).toEqual(['task-942-active']);
      } finally {
        removeTempDir(root);
      }
    });
  });
});
