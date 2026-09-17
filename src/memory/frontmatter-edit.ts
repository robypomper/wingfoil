/**
 * Line-based edits of top-level frontmatter fields (task-045-memory-submit).
 *
 * Memory transition verbs change a handful of fields — `status` on every verb, `rejection_reason` on
 * `submit` (removed) and `reject` (set) — per `spec-010-memory-frontmatter-schema`'s field-write
 * ownership table. Re-serializing the YAML would strip the templates' inline `# REQUIRED …` comments
 * and normalise quoting everywhere, the same defect class as `bug-004` for `dna set`; so these edits
 * touch only the affected line(s) and leave every other byte of the document — the rest of the
 * frontmatter and the whole body — exactly as it was.
 *
 * Only **top-level** keys (column 0) are matched, so a nested `status:` under some map, or a body line
 * that happens to start with `status:`, is never touched. Values are passed as already-serialized
 * YAML (e.g. `pending`, `"a quoted string"`); a trailing `# comment` on the edited line is kept.
 */
import { splitFrontmatter } from '../storage';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Split `content` into the text before the frontmatter lines, the frontmatter lines themselves, and
 * everything after them (closing delimiter and body), so an edit can be spliced back byte-exactly.
 */
function locateFrontmatter(content: string): { before: string; lines: string[]; after: string } {
  const { frontmatter } = splitFrontmatter(content);
  if (frontmatter === null) {
    throw new Error('document has no frontmatter block');
  }
  // `splitFrontmatter` anchors on an opening `---` line, so the frontmatter text starts right after
  // the first newline.
  const start = content.indexOf('\n') + 1;
  return {
    before: content.slice(0, start),
    lines: frontmatter.split('\n'),
    after: content.slice(start + frontmatter.length),
  };
}

/** Matches `key: value   # comment` at column 0, capturing the whitespace + comment tail if present. */
function keyLineRegExp(key: string): RegExp {
  return new RegExp(`^${escapeRegExp(key)}:[ \\t]*(?:"(?:[^"\\\\]|\\\\.)*"|'(?:[^']|'')*'|[^#]*?)([ \\t]+#.*)?$`);
}

/**
 * Set top-level `key` to `valueYaml`. An existing `key:` line has its value replaced (its trailing
 * comment kept); an absent key is appended as the last frontmatter line.
 *
 * @throws `Error` when the document has no frontmatter block.
 */
export function setFrontmatterField(content: string, key: string, valueYaml: string): string {
  const { before, lines, after } = locateFrontmatter(content);
  const re = keyLineRegExp(key);
  const index = lines.findIndex((line) => re.test(line));
  if (index === -1) {
    lines.push(`${key}: ${valueYaml}`);
  } else {
    const comment = re.exec(lines[index] ?? '')?.[1] ?? '';
    lines[index] = `${key}: ${valueYaml}${comment}`;
  }
  return `${before}${lines.join('\n')}${after}`;
}

/**
 * Remove top-level `key` — its `key:` line plus the indented continuation lines that directly follow
 * it (a block or nested value). Returns `content` unchanged when the key is absent.
 *
 * @throws `Error` when the document has no frontmatter block.
 */
export function removeFrontmatterField(content: string, key: string): string {
  const { before, lines, after } = locateFrontmatter(content);
  const index = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (index === -1) return content;
  let end = index + 1;
  while (end < lines.length && /^[ \t]+\S/.test(lines[end] ?? '')) end += 1;
  lines.splice(index, end - index);
  return `${before}${lines.join('\n')}${after}`;
}
