/**
 * `relevance-filter` (task-035-bounded-context-relevance, REQ-PERF-05) —
 * spec-012-context-loader-relevance-filtering §6's deterministic Memory-document selection unit:
 * rank and bound the set of Memory documents relevant to an active element (usually a `task`), so an
 * assembled agent context stays "curated, not full dump" (Product Brief) and satisfies REQ-PERF-05's
 * Fit Criterion verbatim — "given 1,000 Memory documents of which K are relevant to the task, the
 * assembled context contains exactly the K relevant (non-deprecated) documents and 0 others."
 *
 * This module implements ONLY spec-012 §6 (`relevance-filter`), one of the four cooperating units
 * spec-012 defines (`dna-loader`, `directive-loader`, `relevance-filter`, `context-builder`) — the
 * other three, and the canonical serialized envelope (§7), belong to
 * task-037-role-task-scoped-context (REQ-STATE-05, the `context-builder`/envelope task) and
 * task-038-deprecated-excluded-from-context (REQ-STATE-06). For the document scan itself it wraps, not
 * reimplements, `src/memory/query.ts`'s scan primitives (task-008) — no second directory walk or
 * frontmatter parser — and is placed in `src/core` per spec-012 §1 ("folded into the `core` module").
 *
 * FOLLOW-UP (deprecated-exclusion duplication): the deprecated/draft exclusion below
 * ({@link EXCLUDED_STATUSES}) is implemented LOCALLY here. task-038-deprecated-excluded-from-context
 * (REQ-STATE-06), developed on a sibling branch not yet on `main`, has since shipped a shared
 * `isDeprecatedStatus` helper reusing `memory`'s `DEPRECATED_STATE` constant. Those cannot be imported
 * from here yet (not on `main`). Once task-038 merges, this local status set MUST be reconciled onto
 * that shared helper so deprecated-exclusion has a single definition — recorded as a follow-up in this
 * task's Execution Notes for the coordinator.
 *
 * Determinism (REQ-SYS-07): no wall-clock, no randomness, no unordered map/set iteration in any
 * output-affecting path. Selection and ordering are a pure function of `(root@stateRef, memoryYaml,
 * element, limits)` — see {@link filterRelevantMemoryDocuments}'s own doc comment for the exact
 * ordering/bounding contract.
 */
import { listMemoryDocumentPaths, loadMemoryDocumentSummary } from '../memory/query';
import type { MemoryYaml } from '../memory/schema';

/**
 * Caps that keep an assembled context "bounded, not a full dump" (spec-012 §6) — the defaults match
 * spec-012's own defaults verbatim: `maxDocs: 40`, `maxBytes: 262144` (256 KiB).
 */
export interface ContextLimits {
  /** Maximum number of Memory documents included. */
  readonly maxDocs: number;
  /** Maximum total Memory-document body bytes (UTF-8) included. */
  readonly maxBytes: number;
}

/** spec-012 §6's default {@link ContextLimits} (`maxDocs: 40`, `maxBytes: 262144` / 256 KiB). */
export const DEFAULT_CONTEXT_LIMITS: ContextLimits = { maxDocs: 40, maxBytes: 262144 };

/**
 * The active Memory element (usually a `task`) relevance is scored against — already resolved by the
 * caller (spec-012 §3 stage 1, `resolve-element`, is a separate pipeline stage; this primitive is a
 * pure `(state) -> selection` function and never reads the element document itself, per REQ-SYS-07).
 */
export interface RelevanceElementRef {
  /** The element's `memory.yaml` type (e.g. `"task"`). */
  readonly type: string;
  /** The element's `id` frontmatter value. */
  readonly id: string;
  /** The element's already-parsed frontmatter (used to derive T1 links, T2 release scope, T3
   * traceability keys, and T4 keyword/tag overlap — see {@link filterRelevantMemoryDocuments}). */
  readonly frontmatter: Record<string, unknown>;
}

/** One Memory document selected as relevant, carrying the {@link ContextLimits}-bounding fields plus
 * its computed spec-012 §6 tier `score` (exposed for callers that want to display/debug ranking). */
export interface RelevantMemoryDocument {
  readonly path: string;
  readonly type?: string;
  readonly id?: string;
  readonly title?: string;
  readonly status?: string;
  readonly frontmatter: Record<string, unknown>;
  readonly body: string;
  /** `1000*T1 + 100*T2 + 10*T3 + overlapCount(T4)` (spec-012 §6) — always `> 0` for an included doc. */
  readonly score: number;
}

/** P5.3.3-relevance-filtering.feature's "Edge - no documents pass the relevance threshold" note,
 * verbatim: `'a note "no relevant Memory found for task" is recorded'`. */
export const NO_RELEVANT_MEMORY_NOTE = 'no relevant Memory found for task';

/**
 * {@link filterRelevantMemoryDocuments}'s result: the bounded, ordered set of relevant documents, plus
 * {@link NO_RELEVANT_MEMORY_NOTE} when — and only when — that set is empty (mirrors
 * `memorySearchFn`'s `message`-only-when-empty convention in `src/core/index.ts`).
 */
export interface RelevantMemoryResult {
  readonly documents: readonly RelevantMemoryDocument[];
  readonly note?: string;
}

/**
 * spec-012 §6's per-tier score weights, isolated as named constants so the scoring formula
 * (`1000*T1 + 100*T2 + 10*T3 + overlapCount(T4)`) reads as tiers, not magic numbers. Each weight is a
 * strict order of magnitude above the next so any T(n) hit outranks every combination of lower tiers
 * (a single doc can carry at most a handful of T4 overlaps, far below `TIER_3_TRACEABILITY = 10`).
 */
const TIER_1_EXPLICIT_LINK = 1000;
const TIER_2_RELEASE_SCOPE = 100;
const TIER_3_TRACEABILITY = 10;
// T4 (keyword/tag overlap) contributes its raw overlap count, weight 1 — spec-012 §6.

/** Frontmatter fields spec-012 §6 T1 treats as explicit single-id links. */
const LINK_FRONTMATTER_FIELDS = ['adr', 'spec', 'dl', 'bug'] as const;

/**
 * Document `status:` values excluded from relevance regardless of score, per
 * spec-012-context-loader-relevance-filtering §6 verbatim: "Documents in states
 * draft/rejected/deprecated are excluded".
 *
 * SPEC CONFLICT (specs win — the vestigial `'rejected'` is retained deliberately, NOT dropped): the
 * later, also-approved spec-001-memory-yaml-schema removed the `rejected` status entirely from the
 * Memory model ("no document records `status: rejected` anymore" — a `reject` transition now lands
 * back on `draft`). So `'rejected'` here can never match a real document — it is vestigial but
 * harmless. It is kept because spec-012 §6 (this module's governing spec) still enumerates it, and a
 * `[SPEC]`-cited value may not be removed without first changing the governing spec. The two approved
 * specs therefore conflict on this point; spec-012 §6 needs reconciliation against spec-001 — recorded
 * as a spec-gap for the approver in this task's Execution Notes.
 */
const EXCLUDED_STATUSES = new Set(['draft', 'deprecated', 'rejected']);

/** A traceability token: a feature id (`P5.3.3`, `P1.9`, ...) or a SARD requirement id
 * (`REQ-PERF-05`, `REQ-SYS-07`, ...) — spec-012 §6 T3's "shared traceability keys". */
const TRACEABILITY_PATTERN = /\bP\d+(?:\.\d+)+\b|\bREQ-[A-Z]+-\d+\b/g;

/** Lowercase alphanumeric word tokens — spec-012 §6 T4's "title tokens". */
const WORD_PATTERN = /[a-z0-9]+/g;

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

/** T1: the set of ids the element's frontmatter explicitly references (`adr`, `spec`, `dl`, `bug`,
 * `depends_on`) — spec-012 §6. Insertion order follows {@link LINK_FRONTMATTER_FIELDS}'s fixed
 * declaration order then `depends_on`'s own array order (REQ-SYS-07: no unordered iteration). */
function collectLinkedIds(frontmatter: Record<string, unknown>): Set<string> {
  const ids = new Set<string>();
  for (const field of LINK_FRONTMATTER_FIELDS) {
    const value = asString(frontmatter[field]);
    if (value !== undefined && value.length > 0) ids.add(value);
  }
  for (const dependency of asStringArray(frontmatter.depends_on)) ids.add(dependency);
  return ids;
}

/** T3: the set of `P*`/`REQ-*` traceability tokens found across every string-valued frontmatter field
 * (`ref`, `tags`, ...) and, when supplied, the document body — spec-012 §6. */
function collectTraceabilityKeys(frontmatter: Record<string, unknown>, body?: string): Set<string> {
  const keys = new Set<string>();
  const scan = (text: string): void => {
    for (const match of text.matchAll(TRACEABILITY_PATTERN)) keys.add(match[0]);
  };
  for (const value of Object.values(frontmatter)) {
    if (typeof value === 'string') scan(value);
    else if (Array.isArray(value)) for (const entry of value) if (typeof entry === 'string') scan(entry);
  }
  if (body !== undefined) scan(body);
  return keys;
}

/** T4: the element/document's keyword set — its `tags:` entries plus its title's lowercase word
 * tokens — spec-012 §6 ("docs whose tags: or title tokens intersect the element's tags/title
 * tokens"). */
function collectKeywords(frontmatter: Record<string, unknown>): Set<string> {
  const keywords = new Set<string>();
  for (const tag of asStringArray(frontmatter.tags)) keywords.add(tag.toLowerCase());
  const title = asString(frontmatter.title);
  if (title !== undefined) for (const word of title.toLowerCase().match(WORD_PATTERN) ?? []) keywords.add(word);
  return keywords;
}

function intersectionSize(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let count = 0;
  for (const value of a) if (b.has(value)) count += 1;
  return count;
}

function hasIntersection(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  for (const value of a) if (b.has(value)) return true;
  return false;
}

/** T2: is `documentPath` under the element's release scope? True when the element declares a
 * `release` and either the candidate document's own `release:` frontmatter matches it exactly, or its
 * path contains that release as a path segment (covers release-line-scoped docs whose own frontmatter
 * has no `release` field) — spec-012 §6 ("docs under the element's release / release-line path"). */
function isSameReleaseScope(elementRelease: string | undefined, documentPath: string, documentFrontmatter: Record<string, unknown>): boolean {
  if (elementRelease === undefined) return false;
  return documentPath.includes(`/${elementRelease}/`) || asString(documentFrontmatter.release) === elementRelease;
}

/**
 * Rank and bound the Memory documents relevant to `element` (spec-012 §6, REQ-PERF-05). Deterministic
 * end to end (REQ-SYS-07):
 *
 * 1. **Scan** every document `memoryYaml` declares under `root` ({@link listMemoryDocumentPaths}'s
 *    already-sorted order, task-008) — no second directory walk.
 * 2. **Exclude** the element's own document (never relevant to itself) and any document whose
 *    `status` is in {@link EXCLUDED_STATUSES} (draft/deprecated — REQ-STATE-06's own concern extends
 *    this to `memory search` defaults too, out of this task's scope).
 * 3. **Score** each remaining document: `1000*T1 + 100*T2 + 10*T3 + overlapCount(T4)` — T1 explicit
 *    link, T2 same release scope, T3 shared traceability key, T4 keyword/tag overlap count
 *    (spec-012 §6's exact formula). A document scoring `0` (no tier hit at all) is **not relevant**
 *    and is dropped — this is the relevance threshold P5.3.3-relevance-filtering.feature's "Edge - no
 *    documents pass the relevance threshold" scenario exercises.
 * 4. **Order**: score DESC, then `type` ASC, then `id` ASC (falling back to `path` when a document has
 *    no `id`) — a total, deterministic tie-break (spec-012 §6/REQ-SYS-07).
 * 5. **Bound**: walk in that order, including documents until either `limits.maxDocs` or
 *    `limits.maxBytes` (summed UTF-8 body bytes) would be exceeded, then **stop** — never skip a
 *    lower-ranked document to fit under a cap while a higher-ranked one was excluded, and never
 *    partially include a document (spec-012 §6's "deterministic truncation").
 *
 * Returns {@link NO_RELEVANT_MEMORY_NOTE} in `note` only when the bounded result is empty (P5.3.3's
 * edge-case scenario, verbatim wording).
 */
export function filterRelevantMemoryDocuments(
  root: string,
  memoryYaml: MemoryYaml,
  element: RelevanceElementRef,
  limits: ContextLimits = DEFAULT_CONTEXT_LIMITS,
): RelevantMemoryResult {
  const linkedIds = collectLinkedIds(element.frontmatter);
  const elementRelease = asString(element.frontmatter.release);
  const elementTraceability = collectTraceabilityKeys(element.frontmatter);
  const elementKeywords = collectKeywords(element.frontmatter);

  const scored: RelevantMemoryDocument[] = [];
  for (const path of listMemoryDocumentPaths(root, memoryYaml)) {
    const { frontmatter, body } = loadMemoryDocumentSummary(root, path);
    const type = asString(frontmatter.type);
    const id = asString(frontmatter.id);
    const status = asString(frontmatter.status);

    if (status !== undefined && EXCLUDED_STATUSES.has(status)) continue;
    if (type === element.type && id === element.id) continue;

    const t1 = id !== undefined && linkedIds.has(id);
    const t2 = isSameReleaseScope(elementRelease, path, frontmatter);
    const t3 = hasIntersection(elementTraceability, collectTraceabilityKeys(frontmatter, body));
    const t4OverlapCount = intersectionSize(elementKeywords, collectKeywords(frontmatter));

    const score =
      (t1 ? TIER_1_EXPLICIT_LINK : 0) +
      (t2 ? TIER_2_RELEASE_SCOPE : 0) +
      (t3 ? TIER_3_TRACEABILITY : 0) +
      t4OverlapCount;
    if (score <= 0) continue;

    scored.push({ path, type, id, title: asString(frontmatter.title), status, frontmatter, body, score });
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    const typeA = a.type ?? '';
    const typeB = b.type ?? '';
    if (typeA !== typeB) return typeA < typeB ? -1 : 1;
    const idA = a.id ?? a.path;
    const idB = b.id ?? b.path;
    return idA < idB ? -1 : idA > idB ? 1 : 0;
  });

  const documents: RelevantMemoryDocument[] = [];
  let totalBytes = 0;
  for (const doc of scored) {
    if (documents.length >= limits.maxDocs) break;
    const docBytes = Buffer.byteLength(doc.body, 'utf-8');
    if (totalBytes + docBytes > limits.maxBytes) break;
    documents.push(doc);
    totalBytes += docBytes;
  }

  return documents.length === 0 ? { documents, note: NO_RELEVANT_MEMORY_NOTE } : { documents };
}
