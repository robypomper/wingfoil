/**
 * Memory query primitives (task-008-dna-memory-query-latency, REQ-PERF-02) — the performance-bearing
 * foundation `wingfoil memory search` (task-021-implement-memory-search, P1.5) builds its CLI/MCP
 * surface on top of. Deliberately NOT wired into `src/core`'s `CORE_MODULES` registry yet (see the
 * task's Execution Notes for the scoping decision): this module ships the scan + keyword/frontmatter
 * relevance primitives, not the `--tag` CLI grammar, output rendering, or the "no documents matched"
 * exit-code contract, which are task-021's own scope.
 *
 * Two things keep this fast at the 1,000-Memory-document reference scale (REQ-PERF-02):
 *
 * - **Path-pattern-derived scan roots** (spec-011-storage-layout): rather than walking the whole
 *   project tree, {@link computeMemoryContentRoots} derives the minimal set of directories to scan
 *   from `memory.yaml`'s per-type `path` patterns (spec-001-memory-yaml-schema) — the same
 *   predictability spec-011 calls out as what keeps `memory search`/`history` from needing a
 *   full-repo walk for every query.
 * - **Deterministic keyword/frontmatter relevance, not full-text/semantic search**
 *   (spec-012-context-loader-relevance-filtering's discipline, applied here to `memory search`
 *   rather than the Agent Context Loader spec-012 itself defines): a metadata match (title/id/tag)
 *   ranks above a body-only match (P1.12-keyword-search.feature), case-insensitive substring
 *   matching, sorted with a total, deterministic order (REQ-SYS-07: no unordered iteration in a
 *   query-building path).
 */
import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import { parseYaml } from '../validation';

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
  /** Query matched the title, id, or a tag (P1.12: ranks above a body-only match). */
  readonly metadataMatch: boolean;
  /** Query matched somewhere in the document body. */
  readonly bodyMatch: boolean;
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

    matches.push({ path, id, title, tags, status, metadataMatch, bodyMatch });
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
