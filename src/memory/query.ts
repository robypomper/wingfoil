/**
 * Memory query primitives (task-008-dna-memory-query-latency, REQ-PERF-02; match/rank algorithm and
 * empty-query validation hardened by task-023-implement-keyword-search, P1.12) — the performance-
 * bearing foundation `wingfoil memory search` (task-021-implement-memory-search, P1.5) builds its
 * CLI/MCP surface on top of. Deliberately NOT wired into `src/core`'s `CORE_MODULES` registry yet
 * (see the task's Execution Notes for the scoping decision): this module ships the scan +
 * keyword/frontmatter relevance primitives plus the query-validation guard, not the `--tag` CLI
 * grammar, output rendering, or the "no documents matched" exit-code contract, which are task-021's
 * own scope.
 *
 * Three things keep this fast and correct at the 1,000-Memory-document reference scale (REQ-PERF-02)
 * and satisfy P1.12's fit criteria:
 *
 * - **Path-pattern-derived scan roots** (spec-011-storage-layout): rather than walking the whole
 *   project tree, {@link computeMemoryContentRoots} derives the minimal set of directories to scan
 *   from `memory.yaml`'s per-type `path` patterns (spec-001-memory-yaml-schema) — the same
 *   predictability spec-011 calls out as what keeps `memory search`/`history` from needing a
 *   full-repo walk for every query.
 * - **Deterministic keyword/frontmatter relevance, not full-text/semantic search**
 *   (spec-012-context-loader-relevance-filtering's discipline, applied here to `memory search`
 *   rather than the Agent Context Loader spec-012 itself defines): a metadata match (title/id/tag)
 *   ranks above a body-only match (P1.12-keyword-search.feature Scenario 1), case-insensitive
 *   substring matching (Scenario 2), sorted with a total, deterministic order (REQ-SYS-07: no
 *   unordered iteration in a query-building path). Both were already satisfied by
 *   {@link searchMemoryDocuments} as shipped by task-008 — task-023 verified this against P1.12's
 *   fit criteria and added characterization tests, no algorithm change was needed.
 * - **Empty-query rejection** ({@link validateSearchQuery}, P1.12-keyword-search.feature Scenario 3):
 *   a genuine gap task-008 left open (an empty query previously matched every document instead of
 *   being rejected) — task-023 closed it with a `ValidationError.semantic` guard a caller runs before
 *   invoking {@link searchMemoryDocuments}, exiting 2 with message "empty search query".
 */
import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import { parseYaml, ValidationError } from '../validation';

import type { MemoryYaml } from './schema';
import { readDocument, splitFrontmatter } from '../storage';

/**
 * The static (placeholder-free) directory prefix of a `memory.yaml` type `path` pattern — e.g.
 * `"docs/04_memory/design/adrs/{id}.md"` -> `"docs/04_memory/design/adrs"`. A pattern whose first
 * placeholder sits in the directory portion (e.g. task's `"docs/04_memory/{release}/{id}.md"`)
 * collapses to the parent of that placeholder — `"docs/04_memory"` — because every possible
 * `{release}` value lives under it.
 */
function staticDirPrefix(pattern: string): string {
  const braceIndex = pattern.indexOf('{');
  const staticPart = braceIndex === -1 ? pattern : pattern.slice(0, braceIndex);
  const lastSlash = staticPart.lastIndexOf('/');
  return lastSlash === -1 ? '' : staticPart.slice(0, lastSlash);
}

/**
 * Derive the minimal set of root-relative directories a scan needs to walk to see every Memory
 * document declared by `memoryYaml`'s types (spec-011: path-pattern predictability, not a full-repo
 * walk). A directory already covered by another (shorter) directory in the set is dropped, so the
 * result never contains redundant, nested roots.
 */
export function computeMemoryContentRoots(memoryYaml: MemoryYaml): string[] {
  const dirs = new Set<string>();
  for (const typeEntry of Object.values(memoryYaml.types)) {
    const dir = staticDirPrefix(typeEntry.path);
    if (dir) dirs.add(dir);
  }
  const all = [...dirs].sort();
  return all.filter((dir) => !all.some((other) => other !== dir && dir.startsWith(`${other}/`)));
}

/** Recursively list every `.md` file under `root/dir`, as root-relative POSIX paths, sorted. */
function listMarkdownFilesUnder(root: string, dir: string): string[] {
  const absoluteDir = join(root, dir);
  if (!existsSync(absoluteDir) || !statSync(absoluteDir).isDirectory()) return [];

  const out: string[] = [];
  const walk = (current: string, relativePrefix: string): void => {
    for (const entry of readdirSync(current).sort()) {
      const full = join(current, entry);
      const relative = `${relativePrefix}/${entry}`;
      if (statSync(full).isDirectory()) {
        walk(full, relative);
      } else if (entry.endsWith('.md')) {
        out.push(relative);
      }
    }
  };
  walk(absoluteDir, dir);
  return out;
}

/**
 * List every Memory document under `root`, as root-relative POSIX paths, sorted lexicographically
 * (REQ-SYS-07 — deterministic, no unordered iteration). Scans only the directories
 * {@link computeMemoryContentRoots} derives from `memoryYaml`, never the whole project tree.
 */
export function listMemoryDocumentPaths(root: string, memoryYaml: MemoryYaml): string[] {
  const out = new Set<string>();
  for (const dir of computeMemoryContentRoots(memoryYaml)) {
    for (const path of listMarkdownFilesUnder(root, dir)) out.add(path);
  }
  return [...out].sort();
}

/** A Memory document's parsed frontmatter (loose — no Zod schema validation, see module doc) + body. */
export interface MemoryDocumentSummary {
  readonly path: string;
  readonly frontmatter: Record<string, unknown>;
  readonly body: string;
}

/**
 * Read one Memory document and split it into its parsed frontmatter and body text, without running
 * it through any type's Zod schema — `memory search`/`history` must handle documents of every type
 * and any (even structurally imperfect) state, so this is a read, never a validation.
 */
export function loadMemoryDocumentSummary(root: string, relativePath: string): MemoryDocumentSummary {
  const absolute = join(root, relativePath);
  const raw = readDocument(absolute);
  const { frontmatter: frontmatterText, body } = splitFrontmatter(raw);

  let frontmatter: Record<string, unknown> = {};
  if (frontmatterText) {
    const parsed = parseYaml(frontmatterText, absolute);
    if (parsed !== null && typeof parsed === 'object') frontmatter = parsed as Record<string, unknown>;
  }

  return { path: relativePath, frontmatter, body };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Resolve a single Memory document by its `id` frontmatter value alone — REQ-PERF-04 /
 * task-009-mcp-resource-fetch-latency's Acceptance Criteria, which name a `wingfoil://memory/{id}`
 * benchmark fetch. This is NOT spec-004-mcp-surface-contract §2.1's Resource addressing: spec-004's
 * actual scheme is `wingfoil://memory/{type}` (collection listing) and `wingfoil://memory/{type}/{id}`
 * (single document) — there is no bare, single-segment `wingfoil://memory/{id}` form there, and this
 * `{id}` segment would collide with spec-004's `{type}` segment. task-011-mcp-resources-read-only has
 * since replaced the `wingfoil://memory/{id}` *Resource* this primitive originally backed with the
 * conformant `wingfoil://memory/{type}/{id}` form (see {@link findMemoryDocumentByTypeAndId}) — this
 * bare-id primitive itself is left in place (still covered by its own `test/memory/query.test.ts`
 * unit tests and REQ-PERF-04's ported benchmark) as a generic, type-agnostic lookup; nothing in
 * `src/mcp` calls it anymore.
 *
 * A linear scan over every document {@link listMemoryDocumentPaths} returns, in its
 * already-deterministic sorted order, stopping at the first document whose frontmatter `id` matches
 * *exactly* (never a substring — that remains `searchMemoryDocuments`'/task-021's keyword-search
 * surface, not this primitive's). Returns `undefined` — never throws — when no document matches;
 * turning that into a protocol-level "resource not found" failure is the MCP Resource adapter's job
 * (spec-004 §2.2's general unresolvable-URI contract), not this primitive's.
 */
export function findMemoryDocumentById(
  root: string,
  memoryYaml: MemoryYaml,
  id: string,
): MemoryDocumentSummary | undefined {
  for (const path of listMemoryDocumentPaths(root, memoryYaml)) {
    const summary = loadMemoryDocumentSummary(root, path);
    if (asString(summary.frontmatter.id) === id) return summary;
  }
  return undefined;
}

/** A Memory document's frontmatter-only summary — spec-004 §2.1's collection-listing shape
 * (id, title, status, tags), deliberately omitting body content to keep listing calls cheap. */
export interface MemoryDocumentFrontmatterSummary {
  readonly path: string;
  readonly id?: string;
  readonly title?: string;
  readonly status?: string;
  readonly tags: readonly string[];
}

/**
 * List every Memory document whose frontmatter `type:` field equals `type` (a `memory.yaml` `types:`
 * key), as frontmatter-only summaries — spec-004 §2.1's `wingfoil://memory/{type}` collection
 * addressing (task-011-mcp-resources-read-only, REQ-INT-01). Sorted by `id` (falling back to `path`
 * when a document has no `id`) ascending (REQ-SYS-07 — deterministic, no unordered iteration).
 *
 * Membership is decided by each document's own frontmatter `type:` field, not by which directory it
 * lives in: several types' `path` patterns collapse to the *same* static directory prefix (e.g.
 * `release`/`release-line` both resolve to `docs/04_memory/planning`; `task`'s own pattern collapses
 * all the way to `docs/04_memory` itself — see {@link computeMemoryContentRoots}'s doc comment), so a
 * directory-only filter would wrongly fold sibling types' documents into this type's collection.
 */
export function listMemoryDocumentsByType(
  root: string,
  memoryYaml: MemoryYaml,
  type: string,
): MemoryDocumentFrontmatterSummary[] {
  const out: MemoryDocumentFrontmatterSummary[] = [];
  for (const path of listMemoryDocumentPaths(root, memoryYaml)) {
    const { frontmatter } = loadMemoryDocumentSummary(root, path);
    if (asString(frontmatter.type) !== type) continue;
    out.push({
      path,
      id: asString(frontmatter.id),
      title: asString(frontmatter.title),
      status: asString(frontmatter.status),
      tags: asStringArray(frontmatter.tags),
    });
  }
  return out.sort((a, b) => {
    const keyA = a.id ?? a.path;
    const keyB = b.id ?? b.path;
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });
}

/**
 * Resolve a single Memory document by (`type`, `id`) — spec-004 §2.1's `wingfoil://memory/{type}/{id}`
 * single-document addressing (task-011-mcp-resources-read-only, REQ-INT-01), the conformant
 * replacement for task-009's bare-`{id}` `findMemoryDocumentById` Resource usage. Both `type` and `id`
 * must match a document's own frontmatter — same directory-collision reasoning as
 * {@link listMemoryDocumentsByType} — so this never returns a document of a *different* type merely
 * because that type's path pattern happens to also resolve under the same directory. Returns
 * `undefined` — never throws — when nothing matches; surfacing that as a protocol-level "resource not
 * found" failure is the MCP Resource adapter's job (spec-004 §2.2), not this primitive's.
 */
export function findMemoryDocumentByTypeAndId(
  root: string,
  memoryYaml: MemoryYaml,
  type: string,
  id: string,
): MemoryDocumentSummary | undefined {
  for (const path of listMemoryDocumentPaths(root, memoryYaml)) {
    const summary = loadMemoryDocumentSummary(root, path);
    if (asString(summary.frontmatter.type) === type && asString(summary.frontmatter.id) === id) return summary;
  }
  return undefined;
}

/** Optional filters/refinements for {@link searchMemoryDocuments}. */
export interface MemorySearchOptions {
  /** Only include documents whose `tags:` frontmatter contains this exact tag. */
  readonly tag?: string;
}

/** One ranked search result — enough for a future CLI/MCP surface to render without re-reading the file. */
export interface MemorySearchMatch {
  readonly path: string;
  readonly id?: string;
  readonly title?: string;
  readonly tags: readonly string[];
  readonly status?: string;
  /** The document's frontmatter `type:` field (spec-010-memory-frontmatter-schema base field) —
   * projected here (task-021-implement-memory-search) alongside `status`/`tags` so `memorySearch`'s
   * `--type` filter can narrow an already-ranked result without a second file read per match. */
  readonly type?: string;
  /** Query matched the title, id, or a tag (P1.12: ranks above a body-only match). */
  readonly metadataMatch: boolean;
  /** Query matched somewhere in the document body. */
  readonly bodyMatch: boolean;
}

/** `E_EMPTY_SEARCH_QUERY` field-level code (spec-009-validation-strategy §3) for a rejected empty
 * or whitespace-only `wingfoil memory search` query. */
export const E_EMPTY_SEARCH_QUERY = 'E_EMPTY_SEARCH_QUERY';

/**
 * Reject an empty or whitespace-only search query (P1.12 BDD Scenario "Error - empty query string":
 * "no search is performed" and exit code 2, message "empty search query"). Mirrors
 * `resolveTransitionTarget`'s `ValidationError.semantic` pattern (`./state-machine.ts`) so the shared
 * exit-code mapping (spec-009 §3) surfaces this as exit 2 without a bespoke error path; task-021's
 * `wingfoil memory search` CLI/MCP surface calls this on the user-supplied query string before it
 * ever reaches {@link searchMemoryDocuments}.
 *
 * Deliberately a separate guard, not a change to `searchMemoryDocuments`'s own signature/behavior:
 * `searchMemoryDocuments(root, memoryYaml, '', { tag })` remains a legitimate "browse by tag alone,
 * no keyword" call (task-008's own characterization test) — the empty-query rejection is this task's
 * (P1.12's) algorithm-level validation concern, applied at the point a *user-facing* query string is
 * about to be searched, not baked into the lower-level scan primitive that also serves tag-only
 * listing.
 */
export function validateSearchQuery(query: string): void {
  if (query.trim().length === 0) {
    throw ValidationError.semantic([
      { code: E_EMPTY_SEARCH_QUERY, path: '', file: '', message: 'empty search query' },
    ]);
  }
}

/**
 * Deterministic keyword/frontmatter search over every Memory document `memoryYaml` declares
 * (P1.5/P1.12): case-insensitive substring matching against title/id/tags (metadata) and body text,
 * optionally narrowed to one exact `tag`. A query that matches nothing returns `[]` — a successful,
 * empty result, never a thrown error (that "no documents matched" outcome is a CLI/MCP-surface
 * concern, task-021's, not this primitive's).
 *
 * Ordering is a total, deterministic order (REQ-SYS-07): metadata matches before body-only matches,
 * then by `id` (falling back to `path` when a document has no `id`) ascending — so calling this
 * twice against unchanged state always returns the exact same array.
 */
export function searchMemoryDocuments(
  root: string,
  memoryYaml: MemoryYaml,
  query: string,
  options: MemorySearchOptions = {},
): MemorySearchMatch[] {
  const needle = query.trim().toLowerCase();
  const matches: MemorySearchMatch[] = [];

  for (const path of listMemoryDocumentPaths(root, memoryYaml)) {
    const { frontmatter, body } = loadMemoryDocumentSummary(root, path);
    const tags = asStringArray(frontmatter.tags);
    if (options.tag && !tags.includes(options.tag)) continue;

    const title = asString(frontmatter.title);
    const id = asString(frontmatter.id);
    const status = asString(frontmatter.status);
    const type = asString(frontmatter.type);

    let metadataMatch = false;
    let bodyMatch = false;
    if (needle.length > 0) {
      metadataMatch =
        (title !== undefined && title.toLowerCase().includes(needle)) ||
        (id !== undefined && id.toLowerCase().includes(needle)) ||
        tags.some((tag) => tag.toLowerCase().includes(needle));
      bodyMatch = body.toLowerCase().includes(needle);
      if (!metadataMatch && !bodyMatch) continue;
    }

    matches.push({ path, id, title, tags, status, type, metadataMatch, bodyMatch });
  }

  return matches.sort((a, b) => {
    const scoreA = a.metadataMatch ? 1 : 0;
    const scoreB = b.metadataMatch ? 1 : 0;
    if (scoreA !== scoreB) return scoreB - scoreA;
    const keyA = a.id ?? a.path;
    const keyB = b.id ?? b.path;
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });
}
