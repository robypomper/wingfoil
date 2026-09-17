/**
 * REQ-PERF-02 acceptance benchmark (task-008-dna-memory-query-latency):
 *
 *   "wingfoil memory search", "wingfoil dna show", and "wingfoil memory history" each return in
 *   < 1,000 ms (p95) on the reference repository. Measurement conditions: p95 over >= 20 runs on a
 *   reference repository of 1,000 Memory documents.
 *   (docs/02_requirements/03_sard/02_performance-nfr.md)
 *
 * task-008-dna-memory-query-latency originally benchmarked the query-path *primitives* it was scoped
 * to build, because no CLI command existed to measure. Two of the three named commands have since
 * been implemented, and each feature task re-pointed its own row at the REAL, REGISTERED
 * `CORE_MODULES` operation — the exact `CoreFn` the CLI command dispatches to, config load, argument
 * handling and result envelope included:
 *
 * - **`memory search`** -> `memory.memorySearch` (task-021-implement-memory-search), replacing a direct
 *   `searchMemoryDocuments` call.
 * - **`memory history`** -> `memory.memoryHistory` (task-049-memory-history), replacing a direct
 *   `getMemoryHistory` call. This matters: the registered op also resolves the bare `<id>` positional
 *   to a document (`findMemoryDocumentById`, a scan over all 1,000 reference documents) and
 *   reconstructs each transition's state from frontmatter (`git show` per commit) — real cost the raw
 *   git-log walk never paid, and cost a real `wingfoil memory history <id>` invocation does pay.
 * - **`dna show`** still measures `loadDnaYaml`, which IS the whole body of the registered `dnaShow`
 *   op for the no-section case (`src/core/index.ts`) — a bounded single-file read either way.
 *
 * Each timed run redoes the full pillar-config load + scan a real CLI invocation would redo (no
 * warm in-process cache carried across runs), so the measurement reflects one command's real cost.
 *
 * **This file owns BDD P1.5's and P1.10's under-1-second clauses** (task-067-fix-cli-latency-assertion,
 * `bug-011-cli-latency-assertion-measures-spawn-contention`; extended to P1.10 by task-049).
 * `P1.5-memory-search.feature`'s "Find a
 * decision by keyword" scenario was previously timed in `test/cli/program.integration.test.ts` by
 * wrapping `Date.now()` around a **spawned** `node dist/cli.js`, which measured Node process startup
 * plus CPU contention from jest's sibling workers instead of the query, and so failed intermittently
 * on a clean `main`. The threshold did not move — the measurement point did: the scenario's own
 * fixture (a document titled "API design" tagged "architecture", queried with `api`) is now one of
 * the reference repository's 1,000 documents, and the scenario runs here, in-process, through the
 * same registered op, under REQ-PERF-02's measurement conditions. The integration test keeps the
 * scenario's other clause (results include "API design") plus exit code and output shape;
 * `test/core/latency-budget-placement.test.ts` forbids the budget drifting back across a spawn.
 *
 * `P1.10-memory-history.feature`'s "And the query returns in under 1 second" clause lands here for the
 * same reason and was never written anywhere else: `test/cli/program.integration.test.ts` owns P1.10's
 * exit codes, messages and output shape (it spawns), and `test/core/memory-history.test.ts` owns the
 * entry-shape fit criteria (it never reads a clock). Only this file does both a real op call and a
 * wall-clock reading, and it does so without spawning anything.
 */
import { performance } from 'perf_hooks';

import { loadDnaYaml, CORE_MODULES } from '../../src/core';
import type { CoreFn } from '../../src/core/registry';
import { commitAll, makeTempGitRepo, removeTempDir, writeFixtureFile } from '../storage/helpers/git-fixture';

/** The projected match fields these benchmarks assert on — `memorySearchFn`'s real result items carry
 * more (`path`, `type`, `status`); this is the subset the P1.5 scenario checks. */
interface BenchmarkMatch {
  readonly id?: string;
  readonly title?: string;
  readonly tags: readonly string[];
}

/** The real, registered `memory.memorySearch` `CoreFn` (task-021) — fails loudly if a future change
 * un-registers it, rather than silently benchmarking a stale/wrong function. */
function memorySearchFn(): CoreFn<unknown, { matches: readonly BenchmarkMatch[] }> {
  const operation = CORE_MODULES.find((module) => module.name === 'memory')?.operations.memorySearch;
  if (!operation) throw new Error('fixture bug: "memorySearch" operation not registered on the memory module');
  return operation.fn as CoreFn<unknown, { matches: readonly BenchmarkMatch[] }>;
}

/** The projected audit-trail fields this benchmark asserts on — the real entries carry more
 * (`sha`, `author`, `timestamp`, `operation`, `from`, `approver`, `subject`). */
interface BenchmarkHistory {
  readonly path: string;
  readonly entries: readonly { readonly to: string | null; readonly reason: string | null }[];
}

/** The real, registered `memory.memoryHistory` `CoreFn` (task-049) — fails loudly if a future change
 * un-registers it, rather than silently benchmarking a stale/wrong function. */
function memoryHistoryFn(): CoreFn<unknown, BenchmarkHistory> {
  const operation = CORE_MODULES.find((module) => module.name === 'memory')?.operations.memoryHistory;
  if (!operation) throw new Error('fixture bug: "memoryHistory" operation not registered on the memory module');
  return operation.fn as CoreFn<unknown, BenchmarkHistory>;
}

jest.setTimeout(60_000);

const RUNS = 25; // ">= 20 timed runs" per the SARD measurement conditions.
const P95_BUDGET_MS = 1000;
const KEYWORD = 'benchmarktoken';

// BDD P1.5 "Find a decision by keyword" (task-067), planted inside the reference repository rather
// than in a fixture of its own so the scenario is timed at REQ-PERF-02's 1,000-document scale, not
// against a two-document toy. Document 750 is `adr-050-doc` — a globally unique id (the `task-*`
// ids repeat across the seven release directories), already tagged `architecture` by the
// `index % TAGS.length` rotation exactly as the scenario's Background requires, and neither a
// `benchmarktoken` metadata hit (`750 % 13 !== 0`) nor a body hit (`750 % 7 !== 0`), so planting it
// leaves the keyword benchmark's match statistics untouched.
const P1_5_DOC_INDEX = 750;
const P1_5_DOC_ID = 'adr-050-doc';
const P1_5_TITLE = 'API design';
const P1_5_TAG = 'architecture';
const P1_5_QUERY = 'api';

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

/** The reference document's title: P1.5's Background document at {@link P1_5_DOC_INDEX}, a
 * `benchmarktoken` metadata hit on the `index % 13` rotation, or plain filler. */
function titleFor(index: number, metadataKeywordHit: boolean): string {
  if (index === P1_5_DOC_INDEX) return P1_5_TITLE;
  return metadataKeywordHit ? `Document ${index} ${KEYWORD}` : `Document ${index}`;
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

/**
 * The history target's post-creation commits (task-049): conventional CLAUDE.md §5.1 subjects rather
 * than the synthetic `transition ->` wording they replaced, so the benchmarked op exercises the real
 * parse paths — `OPERATION_RE` on the subject, and an `Approver:`/`Reason:` body on the `approve`
 * commit. `start` is deliberately left unconventional-for-the-parser: it is a real subject this very
 * project writes (`wf(task): start task-049-memory-history [backlog → in-progress]`) that the
 * five-verb `OPERATION_RE` does not recognise, so the fixture covers that case too.
 */
const HISTORY_TARGET_COMMITS = [
  { status: 'pending', message: 'wf(task): submit task-000-doc' },
  {
    status: 'backlog',
    message:
      'wf(task): approve task-000-doc [pending → backlog]\n\nApprover: Roberto Pompermaier <robypomper@gmail.com> (approver)\nReason: scheduled into the release',
  },
  { status: 'in-progress', message: 'wf(task): start task-000-doc [backlog → in-progress]' },
] as const;

const HISTORY_APPROVE_REASON = 'scheduled into the release';

/** Write + commit the 1,000-document reference repository (REQ-PERF-02 measurement conditions). */
function seedReferenceRepo(): { root: string; historyTarget: string; historyTargetId: string } {
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
    writeFixtureFile(root, doc.relativePath, docContent(doc, index, titleFor(index, metadataKeywordHit), status, bodyKeywordHit));
  });

  commitAll(root, 'seed 1000-document reference repository (REQ-PERF-02)');

  // Give the memory-history target a few extra transitions — real `memory history` invocations walk
  // real, multi-commit history, not a single creation commit.
  const historyTarget = docs[0]!;
  for (const { status, message } of HISTORY_TARGET_COMMITS) {
    writeFixtureFile(root, historyTarget.relativePath, docContent(historyTarget, 0, 'Document 0', status, false));
    commitAll(root, message);
  }

  return { root, historyTarget: historyTarget.relativePath, historyTargetId: historyTarget.id };
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
  let historyTargetId: string;

  beforeAll(() => {
    ({ root, historyTarget, historyTargetId } = seedReferenceRepo());
  });

  afterAll(() => removeTempDir(root));

  it('`dna show`\'s bounded dna.yaml read stays under 1000ms at p95 over >= 20 runs', () => {
    const samples = Array.from({ length: RUNS }, () => timeSync(() => loadDnaYaml(root)));
    expect(samples).toHaveLength(RUNS);
    expect(p95(samples)).toBeLessThan(P95_BUDGET_MS);
  });

  it("`memory search`'s keyword/frontmatter scan over 1,000 documents stays under 1000ms at p95 over >= 20 runs (measured through the REGISTERED memory.memorySearch op, task-021)", async () => {
    const fn = memorySearchFn();
    let lastMatches: readonly unknown[] = [];
    const samples: number[] = [];
    for (let i = 0; i < RUNS; i += 1) {
      const start = performance.now();
      const outcome = await fn({ root, positional: KEYWORD });
      samples.push(performance.now() - start);
      if (outcome.ok) lastMatches = outcome.value.matches;
    }
    expect(samples).toHaveLength(RUNS);
    expect(p95(samples)).toBeLessThan(P95_BUDGET_MS);
    // Sanity: the fixture exercises a real, non-trivial match set (both metadata- and body-only hits
    // per `seedReferenceRepo`'s `index % 13`/`index % 7` construction) through the full registered op
    // — id/frontmatter-projection included, not just the raw scan primitive.
    expect(lastMatches.length).toBeGreaterThan(0);
  });

  // BDD P1.5 "Find a decision by keyword", both clauses, measured where the budget means something
  // (task-067 / bug-011). The Given ("Memory contains a document titled 'API design' tagged
  // 'architecture'") is document 750 of the reference repository; the When ("I run `wingfoil memory
  // search api`") is the registered `memory.memorySearch` op — the very call the CLI command
  // dispatches to; the Thens are the two assertions below. Strictly stronger than the spawn-wrapped
  // assertion it replaces on every axis: it measures the query rather than process startup, over
  // 1,000 documents rather than 2, at p95 over 25 runs rather than a single sample. The threshold is
  // untouched: 1,000 ms, exactly as the feature file and REQ-PERF-02 both state it.
  it('P1.5 "Find a decision by keyword": `memory search api` returns the "API design" document, in under 1000ms at p95 over >= 20 runs (task-067)', async () => {
    const fn = memorySearchFn();
    let lastMatches: readonly BenchmarkMatch[] = [];
    const samples: number[] = [];
    for (let i = 0; i < RUNS; i += 1) {
      const start = performance.now();
      const outcome = await fn({ root, positional: P1_5_QUERY });
      samples.push(performance.now() - start);
      if (outcome.ok) lastMatches = outcome.value.matches;
    }
    expect(samples).toHaveLength(RUNS);
    // "And the query returns in under 1 second" — P1.5-memory-search.feature line 12 / REQ-PERF-02.
    expect(p95(samples)).toBeLessThan(P95_BUDGET_MS);
    // "Then the results include the document titled 'API design'" — asserted as an exact singleton:
    // no other fixture document's id, title, tags or filler body contains the substring "api", so a
    // second match would mean the keyword scan had started over-matching.
    expect(lastMatches.map((match) => match.id)).toEqual([P1_5_DOC_ID]);
    expect(lastMatches[0]?.title).toBe(P1_5_TITLE);
    expect(lastMatches[0]?.tags).toContain(P1_5_TAG);
  });

  // BDD P1.10 "View the full audit trail of a document" — its "And the query returns in under 1
  // second" clause, measured where the budget means something (task-049; same placement rule
  // task-067/bug-011 established for P1.5). REQ-PERF-02 names `wingfoil memory history` explicitly,
  // and this measures the registered `memory.memoryHistory` op — the very call that command
  // dispatches to — end to end: `memory.yaml` load, the bare-`<id>` scan over all 1,000 reference
  // documents, the `git log --follow` walk, and one `git show` per commit to derive each state.
  //
  // The scenario's Background gives its document "3 recorded state transitions"; this fixture's
  // target has FOUR entries (creation + the three `HISTORY_TARGET_COMMITS`), so the measurement
  // upper-bounds the scenario's own case rather than approximating it — one extra `git show` on top
  // of an id scan two orders of magnitude larger than the scenario's Memory.
  it('P1.10 "View the full audit trail of a document": `memory history <id>` returns the full chronological trail, in under 1000ms at p95 over >= 20 runs (task-049)', async () => {
    const fn = memoryHistoryFn();
    let last: BenchmarkHistory | undefined;
    const samples: number[] = [];
    for (let i = 0; i < RUNS; i += 1) {
      const start = performance.now();
      const outcome = await fn({ root, positional: historyTargetId });
      samples.push(performance.now() - start);
      if (outcome.ok) last = outcome.value;
    }
    expect(samples).toHaveLength(RUNS);
    // "And the query returns in under 1 second" — P1.10-memory-history.feature line 13 / REQ-PERF-02.
    expect(p95(samples)).toBeLessThan(P95_BUDGET_MS);

    // Sanity: the op really resolved THIS document (the `task-*` ids repeat across the seven release
    // directories, so pin the path) and really walked its whole trail — "the output lists N entries
    // in chronological order", with the `approve` commit's `Reason:` read back off the commit body.
    expect(last?.path).toBe(historyTarget);
    expect(last?.entries.map((entry) => entry.to)).toEqual(['draft', 'pending', 'backlog', 'in-progress']);
    expect(last?.entries.map((entry) => entry.reason)).toEqual([null, null, HISTORY_APPROVE_REASON, null]);
  });
});
