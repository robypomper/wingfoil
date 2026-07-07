/**
 * Pure/domain helpers behind `wingfoil memory add` (P1.3, task-020-implement-memory-add). Factored
 * out of the `CoreResult`-wrapped orchestration in `src/core` so that (mirroring `dna set`'s split —
 * pure `setDnaValue` in `src/dna`, the `CoreFn` in `src/core`) the surface-facing operation stays a
 * thin composition and the id/slug/document-render logic is independently unit-testable.
 *
 * Every function here is deterministic (REQ-SYS-07): a slug is a pure function of the title, the
 * rendered document a pure function of `(scaffold, id, title, tags)`, and the sequence counter a pure
 * function of the committed on-disk state (a stable count, order-independent) — no wall-clock, no
 * randomness, no unordered iteration in a value that reaches the produced id or document.
 */
import { existsSync, readdirSync, statSync } from 'fs';
import { dirname, join } from 'path';

import { renderMemoryPath, splitFrontmatter } from '../storage';
import { patternToRegExp } from '../validation';

const TOKEN_RE = /\{([^{}]+)\}/g;

/**
 * Turn a human `--title` into a single, valid `[a-z0-9-.]` ID slug piece (spec-009-validation-strategy
 * §1's ID character class, the same one `generateId` enforces): lowercase, every run of characters
 * outside `[a-z0-9]` collapsed to one `-`, and no leading/trailing/doubled `-`. Deterministic and
 * idempotent-shaped so `generateId`'s Pass-B slug check (`[a-z0-9.]+(?:-[a-z0-9.]+)*`) accepts it.
 */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parse the CLI `--tags "a,b,c"` value into a trimmed, non-empty string array, or `undefined` when the
 * option is absent or contributes no tags (so `renderAddDocument` leaves the scaffold's `tags` at its
 * default rather than writing an empty list).
 */
export function parseTags(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  const tags = raw
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  return tags.length > 0 ? tags : undefined;
}

/** Whether an `id_pattern` contains a `{n}`-family numeric token (e.g. `task-{n}-{slug}`) — i.e. it
 * needs a sequence counter resolved before {@link generateId} can render it. */
export function hasNumericToken(idPattern: string): boolean {
  for (const match of idPattern.matchAll(TOKEN_RE)) {
    if (/^n+$/.test(match[1] ?? '')) return true;
  }
  return false;
}

/**
 * The directory that holds every document of a type: the type's `path` pattern
 * (spec-001-memory-yaml-schema `MemoryTypeEntry.path`, e.g. `docs/memory/decision/{id}.md`) rendered
 * with a dummy `{id}` and reduced to its containing directory. The directory portion never depends on
 * the concrete id value, so this is well-defined before the id is generated (used by
 * {@link nextSequenceNumber} to count existing siblings).
 */
export function resolveTypeDirectory(root: string, pathPattern: string): string {
  return dirname(join(root, renderMemoryPath(pathPattern, { id: '__id__' })));
}

/**
 * The next sequence number for a `{n}`-token id: `1 +` the count of existing files in `dir` whose
 * basename (sans `.md`) matches `idPattern` (`patternToRegExp`, task-002). Deterministic — a count is
 * independent of directory-entry order (REQ-SYS-07) — and confined to this type's own directory, so
 * unrelated files never perturb it. Returns `1` when the directory does not yet exist.
 */
export function nextSequenceNumber(dir: string, idPattern: string): number {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return 1;
  const re = patternToRegExp(idPattern);
  let count = 0;
  for (const entry of readdirSync(dir).sort()) {
    if (entry.endsWith('.md') && re.test(entry.slice(0, -'.md'.length))) count += 1;
  }
  return count + 1;
}

/** The fields `memory.add` pins on the freshly-created draft document (P1.3 memory.add / spec-010). */
export interface AddDocumentFields {
  readonly id: string;
  readonly title: string;
  readonly tags?: readonly string[];
}

/**
 * Escape a literal string for safe insertion into a `RegExp` source (a frontmatter key here). */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Set one frontmatter field on the raw frontmatter text, line-based: replace the value on the existing
 * `^<indent>key:` line if present (preserving the scaffold's ordering, comments and other fields
 * verbatim — the P1.3 memory.add contract copies the scaffold verbatim), otherwise append the field. `valueYaml`
 * is the already-serialized YAML scalar/flow value (e.g. a JSON-quoted string, a flow sequence).
 */
function setFrontmatterField(frontmatter: string, key: string, valueYaml: string): string {
  const re = new RegExp(`^([ \\t]*)${escapeRegExp(key)}:.*$`, 'm');
  if (re.test(frontmatter)) {
    return frontmatter.replace(re, (_match, indent: string) => `${indent}${key}: ${valueYaml}`);
  }
  return `${frontmatter}\n${key}: ${valueYaml}`;
}

/**
 * Copy a type's `template.file` scaffold verbatim and fill only the frontmatter skeleton `memory.add`
 * pins (P1.3; spec-010-memory-frontmatter-schema): the generated `id`, the `--title`, the
 * initial `status: draft`, and — when `--tags` was supplied — the `tags` flow sequence. Every other
 * field (notably `type` and `tmpl_version`, spec-010: not touched by add) and the whole body are left
 * exactly as the scaffold had them. `title`/`tags` are JSON-quoted (valid YAML double-quoted scalars /
 * flow sequences), so an arbitrary title with spaces or colons is written safely.
 *
 * @throws when the scaffold has no frontmatter block (a malformed template — a config error surfaced
 *   as a thrown `Error` the core op maps to a `CoreError`).
 */
export function renderAddDocument(scaffold: string, fields: AddDocumentFields): string {
  const { frontmatter, body } = splitFrontmatter(scaffold);
  if (frontmatter === null) {
    throw new Error('memory template scaffold has no frontmatter block');
  }
  let fm = frontmatter;
  fm = setFrontmatterField(fm, 'id', fields.id);
  fm = setFrontmatterField(fm, 'title', JSON.stringify(fields.title));
  fm = setFrontmatterField(fm, 'status', 'draft');
  if (fields.tags !== undefined) {
    const flow = `[${fields.tags.map((tag) => JSON.stringify(tag)).join(',')}]`;
    fm = setFrontmatterField(fm, 'tags', flow);
  }
  return `---\n${fm}\n---\n${body}`;
}
