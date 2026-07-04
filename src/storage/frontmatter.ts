/**
 * Frontmatter extraction (task-003-git-backed-sot). Memory element state is derived from each
 * document's frontmatter, not any external index (CLAUDE.md §5, REQ-STATE-01/-02): this is the
 * shared primitive for reading it, as raw YAML text. Parsing that text against a type's schema is
 * the validation module's job (spec-009-validation-strategy, task-002), not this module's — keeping
 * the two concerns separate lets the storage layer stay YAML-schema-agnostic.
 */

// Opening delimiter must be the very first line of the document (no leading blank line); content is
// everything up to the next standalone "---" line; trailing newline after the closing delimiter is
// optional so a frontmatter-only document (no body) still matches.
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Extract the raw YAML frontmatter block (the text between the first pair of `---` delimiters)
 * from a Memory document's content. Returns `null` if the document has no frontmatter block at all
 * (no leading `---` line).
 */
export function extractFrontmatter(content: string): string | null {
  const match = FRONTMATTER_RE.exec(content);
  return match ? (match[1] ?? '') : null;
}
