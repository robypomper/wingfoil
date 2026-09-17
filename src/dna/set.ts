/**
 * Pure DNA key-path helpers for `wingfoil dna set` (P2.1, task-025-implement-dna-set). The `dna`
 * pillar owns the semantics of a dotted key path into its own structure; `src/core`'s `dnaSet`
 * operation composes these with the git-identity pre-flight, schema re-validation, write, and commit
 * (which are cross-pillar / storage concerns and therefore live in `src/core`, not here). Nothing in
 * this file imports `src/core` — the pillar stays a leaf under core (spec-006-core-domain-api §1).
 *
 * task-063 adds {@link setDnaValueInText}, the minimal **comment-preserving** in-place edit that
 * replaces the whole-file `js-yaml` `dump()` round-trip as `dna set`'s primary write path
 * (bug-004-dna-set-strips-yaml-comments). Only `js-yaml` is imported — no comment-preserving YAML
 * library is added, per `dl-010-minimal-dependencies`.
 */
import { dump, load } from 'js-yaml';

/**
 * First-segment aliases applied to a dotted key path before resolution. `tech_stack` -> `stacks` keeps
 * `dna set` symmetric with `dna show`'s existing BDD-compatibility alias (spec-002-dna-yaml-schema
 * Consequences: the schema renamed the BDD's `tech_stack` wording to `stacks`), so
 * `dna set tech_stack.language python` writes under the real `stacks` node and `dna show tech_stack`
 * reads it back. The single source of truth for the alias.
 */
export const DNA_KEY_ALIASES: Readonly<Record<string, string>> = { tech_stack: 'stacks' };

/**
 * Whether `keyPath` is a well-formed dotted path: non-empty, and every `.`-separated segment non-empty.
 * A malformed path (e.g. the BDD's `..language`, or a leading/trailing/interior empty segment) is a
 * usage error (exit 2, spec-005-cli-command-contract §1) the caller rejects before any write — this is
 * a pure predicate with no side effects, so the caller owns turning `false` into that usage error.
 */
export function isValidKeyPath(keyPath: string): boolean {
  if (keyPath.length === 0) return false;
  return keyPath.split('.').every((segment) => segment.length > 0);
}

/** Whether `value` is a plain, traversable object (not null, not an array) we can descend into. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Set `value` at the (alias-resolved) dotted `keyPath` inside `dna`, mutating it in place. Intermediate
 * objects are created as needed; a non-object encountered mid-path is replaced with a fresh object so
 * the path can be completed. Setting an existing leaf overwrites it in place — an object key is unique,
 * so there is structurally no way to produce a duplicate key (P2.1 AC(b), idempotent update).
 *
 * Precondition: `isValidKeyPath(keyPath)` is `true` (the caller checks and raises the usage error
 * otherwise); with a valid path there is always at least one non-empty segment.
 */
export function setDnaValue(dna: Record<string, unknown>, keyPath: string, value: string): void {
  const segments = keyPath.split('.');
  segments[0] = DNA_KEY_ALIASES[segments[0]!] ?? segments[0]!;

  let node = dna;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i]!;
    if (!isPlainObject(node[segment])) node[segment] = {};
    node = node[segment] as Record<string, unknown>;
  }
  node[segments[segments.length - 1]!] = value;
}

// ---------------------------------------------------------------------------------------------
// Minimal, comment-preserving in-place edit (bug-004-dna-set-strips-yaml-comments, task-063)
// ---------------------------------------------------------------------------------------------

/** A block-mapping key line the scanner recognised, with everything it needs to be rewritten. */
interface KeyLine {
  /** 0-based index into the line array. */
  readonly line: number;
  /** Number of leading spaces (YAML forbids tabs for indentation). */
  readonly indent: number;
  /** The plain scalar key, exactly as written. */
  readonly key: string;
  /** Everything after the `:` — possibly empty, a value, an inline comment, or a value + comment. */
  readonly rest: string;
}

/** Where a dotted key path landed in the text: the leaf itself, or the deepest existing ancestor. */
interface Resolution {
  /** The line holding the full path, when every segment exists. */
  readonly leaf?: KeyLine;
  /** The line holding the deepest existing strict prefix of the path, when the leaf is absent. */
  readonly parent?: KeyLine;
  /** How many leading segments of the path exist in the text (0 when nothing matched). */
  readonly depth: number;
}

/**
 * A block-mapping key line: leading spaces, a plain scalar key, `:`, then end-of-line or a space.
 * Deliberately narrow — quoted, complex or flow keys simply do not match, which can only make the
 * scanner *miss* a key (falling back to the whole-file dump), never mis-target one.
 */
const KEY_LINE = /^( *)([A-Za-z0-9_][A-Za-z0-9_.+-]*):(?=$| )(.*)$/;

/** Leading-space count of a line (its block-mapping indentation level). */
function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/**
 * Index within `rest` of the `#` that starts an inline comment, or `-1`. Quote-aware, so a `#`
 * inside a `'single'`- or `"double"`-quoted scalar is not mistaken for a comment; per the YAML spec
 * a comment must also be preceded by whitespace (or start the field).
 */
function inlineCommentIndex(rest: string): number {
  let quote: string | undefined;
  for (let i = 0; i < rest.length; i += 1) {
    const char = rest[i]!;
    if (quote !== undefined) {
      if (char === quote) {
        if (quote === "'" && rest[i + 1] === "'") i += 1;
        else quote = undefined;
      } else if (quote === '"' && char === '\\') i += 1;
      continue;
    }
    if (char === "'" || char === '"') quote = char;
    else if (char === '#' && (i === 0 || rest[i - 1] === ' ' || rest[i - 1] === '\t')) return i;
  }
  return -1;
}

/** The value part of a key line's `rest`, with any inline comment and surrounding spaces removed. */
function valueOf(rest: string): string {
  const commentIndex = inlineCommentIndex(rest);
  return (commentIndex < 0 ? rest : rest.slice(0, commentIndex)).trim();
}

/**
 * Whether the value on line `line` continues past it — a nested block, a same-indent sequence, or a
 * multi-line scalar. Such a line cannot be rewritten on its own without orphaning what follows, so
 * the editor refuses (the caller falls back to the whole-file dump).
 */
function hasContinuation(lines: readonly string[], line: number, indent: number): boolean {
  for (let i = line + 1; i < lines.length; i += 1) {
    const candidate = lines[i]!;
    if (candidate.trim() === '') continue;
    const candidateIndent = indentOf(candidate);
    if (candidateIndent > indent) return true;
    return candidateIndent === indent && candidate.trimStart().startsWith('-');
  }
  return false;
}

/**
 * Walk the document's block mappings top-down, tracking the current key path by indentation, and
 * report where `segments` lands. Sequence branches are skipped wholesale (a dotted DNA key path only
 * ever names mapping keys), as is block-scalar content, so neither can produce a false match.
 */
function resolveKeyPath(lines: readonly string[], segments: readonly string[]): Resolution {
  const stack: Array<{ key: string; indent: number }> = [];
  /** While set, every line indented at least this far is skipped (sequence / block-scalar content). */
  let skipFrom: number | undefined;
  let parent: KeyLine | undefined;
  let depth = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (line.trim() === '') continue; // blank lines belong to whatever region is open; never close one
    const indent = indentOf(line);
    if (skipFrom !== undefined) {
      if (indent >= skipFrom) continue;
      skipFrom = undefined;
    }
    const content = line.trimStart();
    if (content.startsWith('#')) continue;
    if (content.startsWith('-')) {
      skipFrom = indent; // a sequence item: skip this whole branch, items and their children alike
      continue;
    }
    const match = KEY_LINE.exec(line);
    if (match === null) continue;

    const key = match[2]!;
    const rest = match[3]!;
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) stack.pop();
    const path = [...stack.map((frame) => frame.key), key];

    if (path.length <= segments.length && path.every((name, index) => name === segments[index])) {
      if (path.length === segments.length) {
        return { leaf: { line: i, indent, key, rest }, depth: segments.length };
      }
      parent = { line: i, indent, key, rest };
      depth = path.length;
    }
    stack.push({ key, indent });

    const value = valueOf(rest);
    if (value.startsWith('|') || value.startsWith('>')) skipFrom = indent + 1; // block scalar content
  }

  return { parent, depth };
}

/**
 * Rewrite `leaf`'s value to `scalar`, keeping its indentation, its key, and any inline comment —
 * realigned to the column it already occupied whenever the new value still leaves room for it, so a
 * hand-aligned annotation block stays aligned. Returns `undefined` when the value spills past this
 * one line (block scalar, nested block, hanging sequence): no single-line edit exists then.
 */
function replaceLeafValue(lines: string[], leaf: KeyLine, scalar: string): string[] | undefined {
  const value = valueOf(leaf.rest);
  if (value.startsWith('|') || value.startsWith('>')) return undefined;
  if (hasContinuation(lines, leaf.line, leaf.indent)) return undefined;

  const head = `${' '.repeat(leaf.indent)}${leaf.key}: ${scalar}`;
  const commentIndex = inlineCommentIndex(leaf.rest);
  if (commentIndex < 0) {
    lines[leaf.line] = head;
    return lines;
  }

  const column = leaf.indent + leaf.key.length + 1 + commentIndex;
  const gap = column > head.length ? ' '.repeat(column - head.length) : ' ';
  lines[leaf.line] = head + gap + leaf.rest.slice(commentIndex);
  return lines;
}

/**
 * Append `remaining` (the still-missing tail of the key path) to the end of `parent`'s block — or to
 * the end of the document when `parent` is absent, i.e. the whole path is new. The new key lands
 * after the block's last content line and *before* any trailing comment lines, so a comment that
 * introduces the next section keeps introducing it. Returns `undefined` when the parent cannot hold
 * a mapping key (it already holds an inline scalar, or its block is a sequence).
 */
function insertKeyPath(
  lines: string[],
  parent: KeyLine | undefined,
  remaining: readonly string[],
  scalar: string,
): string[] | undefined {
  if (parent !== undefined && valueOf(parent.rest) !== '') return undefined;

  const containerLine = parent?.line ?? -1;
  const containerIndent = parent?.indent ?? -1;
  let blockEnd = containerLine;
  let childIndent: number | undefined;

  for (let i = containerLine + 1; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (line.trim() === '') continue;
    const indent = indentOf(line);
    if (indent <= containerIndent) break;
    if (line.trimStart().startsWith('#')) continue;
    if (childIndent === undefined) {
      if (line.trimStart().startsWith('-')) return undefined; // the block is a sequence, not a mapping
      childIndent = indent;
    }
    blockEnd = i;
  }

  const baseIndent = childIndent ?? (parent === undefined ? 0 : parent.indent + 2);
  const inserted = remaining.map((segment, index) => {
    const indent = ' '.repeat(baseIndent + index * 2);
    return index === remaining.length - 1 ? `${indent}${segment}: ${scalar}` : `${indent}${segment}:`;
  });
  lines.splice(blockEnd + 1, 0, ...inserted);
  return lines;
}

/**
 * Render `value` as the YAML scalar token `js-yaml`'s own `dump()` would emit for it, so an in-place
 * edit writes byte-identical bytes to a whole-file re-serialization at that position. This is what
 * keeps `dna set`'s scalar-coercion contract intact: `dump('2')` is `'2'`, which reads back as the
 * STRING `'2'` (and so still fails `version`'s `z.number()`), whereas a bare `2` would read back as
 * a number. `undefined` when the scalar is itself multi-line (e.g. a `|-` block) — not inlinable.
 */
function renderScalar(value: string): string | undefined {
  const scalar = dump(value, { lineWidth: -1 }).replace(/\n$/, '');
  return scalar.includes('\n') ? undefined : scalar;
}

/** Whether `text` parses and the (already alias-resolved) `segments` read back as exactly `scalar`. */
function readsBackAs(text: string, segments: readonly string[], scalar: string): boolean {
  let node: unknown;
  let expected: unknown;
  try {
    node = load(text);
    expected = load(scalar);
  } catch {
    return false;
  }
  for (const segment of segments) {
    if (typeof node !== 'object' || node === null || Array.isArray(node)) return false;
    if (!Object.prototype.hasOwnProperty.call(node, segment)) return false;
    node = (node as Record<string, unknown>)[segment];
  }
  return node === expected;
}

/**
 * Set the (alias-resolved) dotted `keyPath` to `value` inside the RAW TEXT of a `dna.yaml`, editing
 * as few bytes as possible: one line rewritten, or one line inserted. Everything else — every
 * comment, including the inline `[SPEC]`/`[AUTHORING]` field-provenance annotations, and every blank
 * line, quote style and alignment — is returned byte-for-byte unchanged.
 *
 * This is `dna set`'s primary write path (bug-004): re-serializing the parsed object through
 * `dump()` is correct but discards every comment token, which silently voids the field-provenance
 * convention — a `[SPEC]` field may only be removed or renamed after changing the specification it
 * cites, and that cannot be audited once the annotations are gone. A textual edit also needs no
 * comment-preserving YAML library, keeping `dl-010-minimal-dependencies` intact.
 *
 * Returns `undefined` — deliberately, not as an error — whenever a provably-minimal edit does not
 * exist, leaving the caller to fall back to the whole-file `dump()`:
 * - `text` is not a single, valid YAML document;
 * - the key path is malformed (the caller has already raised the exit-2 usage error for it);
 * - the value's own YAML form is multi-line;
 * - the target, or an ancestor of it, is a block/multi-line scalar, opens a nested block, or holds
 *   an inline scalar the path would have to descend through;
 * - the parent block is a sequence rather than a mapping;
 * - the edited text does not read back with the target key holding exactly the intended scalar.
 *
 * The result is a pure function of `(text, keyPath, value)` — no wall-clock, randomness or unordered
 * iteration anywhere on the path (REQ-SYS-07).
 */
export function setDnaValueInText(text: string, keyPath: string, value: string): string | undefined {
  if (!isValidKeyPath(keyPath)) return undefined;
  try {
    load(text); // a single, parseable document: never "repair" input the caller could not read
  } catch {
    return undefined;
  }

  const scalar = renderScalar(value);
  if (scalar === undefined) return undefined;

  const segments = keyPath.split('.');
  segments[0] = DNA_KEY_ALIASES[segments[0]!] ?? segments[0]!;

  const lines = text.split('\n');
  const resolved = resolveKeyPath(lines, segments);
  const edited =
    resolved.leaf !== undefined
      ? replaceLeafValue(lines.slice(), resolved.leaf, scalar)
      : insertKeyPath(lines.slice(), resolved.parent, segments.slice(resolved.depth), scalar);
  if (edited === undefined) return undefined;

  const result = edited.join('\n');
  return readsBackAs(result, segments, scalar) ? result : undefined;
}
