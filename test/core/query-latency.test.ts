/**
 * REQ-PERF-02 acceptance benchmark (task-008-dna-memory-query-latency):
 *
 *   "wingfoil memory search", "wingfoil dna show", and "wingfoil memory history" each return in
 *   < 1,000 ms (p95) on the reference repository. Measurement conditions: p95 over >= 20 runs on a
 *   reference repository of 1,000 Memory documents.
 *   (docs/02_requirements/03_sard/02_performance-nfr.md)
 *
 * This benchmarks the query-path *primitives* task-008 is scoped to build (see the task's Execution
 * Notes for the foundation/feature scoping decision) — `src/core`'s existing `loadDnaYaml` (already
 * wired as the `dnaShow` CoreOperation, task-006) and `src/memory`'s new `searchMemoryDocuments` /
 * `getMemoryHistory` — not the full CLI commands (argv grammar, `--tag` filtering, console/json/yaml
 * rendering, exit-code messaging), which are task-021 (memory search) / task-026 (dna show) / a
 * later, not-yet-scheduled P1.10 task (memory history) feature work.
 *
 * Each timed run redoes the full pillar-config load + scan a real CLI invocation would redo (no
 * warm in-process cache carried across runs), so the measurement reflects one command's real cost.
 */
import { performance } from 'perf_hooks';

import { loadDnaYaml, loadMemoryYaml } from '../../src/core';
import { getMemoryHistory } from '../../src/memory/history';
import { searchMemoryDocuments, type MemorySearchMatch } from '../../src/memory/query';
import { commitAll, makeTempGitRepo, removeTempDir, writeFixtureFile } from '../storage/helpers/git-fixture';

jest.setTimeout(60_000);

const RUNS = 25; // ">= 20 timed runs" per the SARD measurement conditions.
const P95_BUDGET_MS = 1000;
const KEYWORD = 'benchmarktoken';

const TAGS = ['architecture', 'infra', 'memory', 'dna', 'workflow'];
const STATUSES = ['draft', 'pending', 'backlog', 'in-progress'];

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

// Mirrors docs/self/.wingfoil/memory.yaml's real path patterns (states omitted — not needed by the
// query primitives, and MemoryTypeEntry.states is optional).
const MEMORY_YAML = `
version: 1.1
types:
  release-line:
    path: "docs/04_memory/planning/{id}.md"
  release:
    path: "docs/04_memory/planning/{release-line}/{id}.md"
  task:
    path: "docs/04_memory/{release}/{id}.md"
  adr:
    path: "docs/04_memory/design/adrs/{id}.md"
  decision-log:
    path: "docs/04_memory/design/dls/{id}.md"
  tech-spec:
    path: "docs/04_memory/design/specs/{id}.md"
  bug:
    path: "docs/04_memory/bugs/{id}.md"
`;

/** Deterministic filler paragraph — index-derived only, no randomness/wall-clock (REQ-SYS-07). */
function fillerBody(index: number, includeKeyword: boolean): string {
  const line = `Deterministic reference-repository filler content for document ${index}, used only to give the benchmark fixture a realistic body size.`;
  const paragraph = Array.from({ length: 4 }, () => line).join(' ');
  return includeKeyword ? `${paragraph} This one mentions ${KEYWORD} in its body.` : paragraph;
}

function pad(n: number): string {
  return String(n).padStart(3, '0');
}

interface FixtureDoc {
  readonly relativePath: string;
  readonly id: string;
}

/** Build the 1,000 (path, id) pairs — 700 tasks across 7 releases + 100 each of adr/dl/tech-spec. */
function planFixtureDocs(): FixtureDoc[] {
  const docs: FixtureDoc[] = [];
  for (let release = 1; release <= 7; release += 1) {
    for (let n = 0; n < 100; n += 1) {
      const id = `task-${pad(n)}-doc`;
      docs.push({ relativePath: `docs/04_memory/v0.${release}/${id}.md`, id });
    }
  }
  for (let n = 0; n < 100; n += 1) {
    const id = `adr-${pad(n)}-doc`;
    docs.push({ relativePath: `docs/04_memory/design/adrs/${id}.md`, id });
  }
  for (let n = 0; n < 100; n += 1) {
    const id = `dl-${pad(n)}-doc`;
    docs.push({ relativePath: `docs/04_memory/design/dls/${id}.md`, id });
  }
  for (let n = 0; n < 100; n += 1) {
    const id = `spec-${pad(n)}-doc`;
    docs.push({ relativePath: `docs/04_memory/design/specs/${id}.md`, id });
  }
  return docs;
}

function docContent(doc: FixtureDoc, index: number, title: string, status: string, keywordInBody: boolean): string {
  const tag = TAGS[index % TAGS.length];
  return [
    '---',
    `id: ${doc.id}`,
    `title: "${title}"`,
    `tags: [ ${tag} ]`,
    `status: ${status}`,
    '---',
    '',
    fillerBody(index, keywordInBody),
    '',
  ].join('\n');
}

/** Write + commit the 1,000-document reference repository (REQ-PERF-02 measurement conditions). */
function seedReferenceRepo(): { root: string; historyTarget: string } {
  const root = makeTempGitRepo();
  writeFixtureFile(root, '.wingfoil/dna.yaml', DNA_YAML);
  writeFixtureFile(root, '.wingfoil/memory.yaml', MEMORY_YAML);

  const docs = planFixtureDocs();
  if (docs.length !== 1000) {
    throw new Error(`fixture generator bug: expected exactly 1000 documents, got ${docs.length}`);
  }

  docs.forEach((doc, index) => {
    const status = STATUSES[index % STATUSES.length]!;
    const metadataKeywordHit = index % 13 === 0;
    const bodyKeywordHit = index % 7 === 0 && !metadataKeywordHit;
    const title = metadataKeywordHit ? `Document ${index} ${KEYWORD}` : `Document ${index}`;
    writeFixtureFile(root, doc.relativePath, docContent(doc, index, title, status, bodyKeywordHit));
  });

  commitAll(root, 'seed 1000-document reference repository (REQ-PERF-02)');

  // Give the memory-history target a few extra transitions — real `memory history` invocations walk
  // real, multi-commit history, not a single creation commit.
  const historyTarget = docs[0]!;
  for (const status of ['pending', 'backlog', 'in-progress']) {
    writeFixtureFile(root, historyTarget.relativePath, docContent(historyTarget, 0, 'Document 0', status, false));
    commitAll(root, `wf(task): transition ${historyTarget.id} -> ${status}`);
  }

  return { root, historyTarget: historyTarget.relativePath };
}

function timeSync(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

/** p95 over `samples` — nearest-rank percentile: the `ceil(0.95 * n)`-th smallest value. */
function p95(samples: readonly number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length, Math.ceil(0.95 * sorted.length)) - 1;
  return sorted[Math.max(0, index)]!;
}

describe('REQ-PERF-02 — DNA/Memory query latency on a 1,000-Memory-document reference repository', () => {
  let root: string;
  let historyTarget: string;

  beforeAll(() => {
    ({ root, historyTarget } = seedReferenceRepo());
  });

  afterAll(() => removeTempDir(root));

  it('`dna show`\'s bounded dna.yaml read stays under 1000ms at p95 over >= 20 runs', () => {
    const samples = Array.from({ length: RUNS }, () => timeSync(() => loadDnaYaml(root)));
    expect(samples).toHaveLength(RUNS);
    expect(p95(samples)).toBeLessThan(P95_BUDGET_MS);
  });

  it('`memory search`\'s keyword/frontmatter scan over 1,000 documents stays under 1000ms at p95 over >= 20 runs', () => {
    let lastMatches: MemorySearchMatch[] = [];
    const samples = Array.from({ length: RUNS }, () =>
      timeSync(() => {
        const memoryYaml = loadMemoryYaml(root);
        lastMatches = searchMemoryDocuments(root, memoryYaml, KEYWORD);
      }),
    );
    expect(samples).toHaveLength(RUNS);
    expect(p95(samples)).toBeLessThan(P95_BUDGET_MS);
    // Sanity: the fixture exercises a real, non-trivial match set spanning both ranking tiers.
    expect(lastMatches.length).toBeGreaterThan(0);
    expect(lastMatches.some((m) => m.metadataMatch)).toBe(true);
    expect(lastMatches.some((m) => m.bodyMatch && !m.metadataMatch)).toBe(true);
  });

  it('`memory history`\'s git-log walk stays under 1000ms at p95 over >= 20 runs', () => {
    const samples = Array.from({ length: RUNS }, () => timeSync(() => getMemoryHistory(root, historyTarget)));
    expect(samples).toHaveLength(RUNS);
    expect(p95(samples)).toBeLessThan(P95_BUDGET_MS);
    expect(getMemoryHistory(root, historyTarget)).toHaveLength(4); // 1 creation + 3 transitions
  });
});
