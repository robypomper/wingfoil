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
 * The first-segment alias `dna show` resolves: `tech_stack` -> `stacks`, the BDD-compatibility alias
 * spec-002-dna-yaml-schema's Consequences describe (the schema renamed the BDD's `tech_stack` wording
 * to `stacks`), so `dna show tech_stack` still reads the `stacks` subtree.
 *
 * **READ side only, since task-093** (`bug-084-dna-key-alias-writes-unschemad-keys`). It used to be
 * applied on the write path too, and there it was a trap: `stacks` replaced a fixed-key `tech_stack`
 * OBJECT, which is a change of shape rather than of name, so rewriting only the first segment
 * produced a path that resolves nowhere — `dna set tech_stack.cli.framework Commander` wrote
 * `stacks.cli.framework`, a key no schema declares, through `Stacks`'s `.passthrough()`, at exit 0.
 * spec-002 says plainly that "any consumer that read `tech_stack.<key>` must now scan" the lists, and
 * a first-segment alias cannot honour that sentence. The write path therefore does not alias at all;
 * an old-shape path is refused as the unknown key it is (`src/dna/path.ts`, exit 1).
 */
export const DNA_KEY_ALIASES: Readonly<Record<string, string>> = { tech_stack: 'stacks' };

/** The segments of a dotted DNA path, or the refusal message the caller reports (`splitDnaPath`). */
export type DnaPathSplit =
  | { readonly ok: true; readonly segments: readonly string[] }
  | { readonly ok: false; readonly message: string };

/** The delimiter that opens and closes a quoted path segment (`dl-083`). */
const QUOTE = '"';

/**
 * Parse a dotted DNA key path into its segments — the ONE place a path is split, shared by
 * {@link isValidKeyPath}, {@link setDnaValueInText}'s text resolver and `resolveDnaPath`
 * (`./path.ts`). It replaced three copies of `keyPath.split('.')`, which is why the quoting rule
 * below has one definition rather than three chances to disagree.
 *
 * **The grammar** (`dl-083-dotted-entry-names-in-paths`, ratified; it exists because
 * `dl-081-dna-mutation-surface-shape` made an entry's `name` the key it is addressed by, and
 * `stacks.technologies` really does carry entries named `Node.js` and `Commander.js`):
 *
 * - a segment that **begins** with `"` is quoted and ends at the **next** `"`. The quotes are
 *   delimiters and are not part of the name; between them `.` is an ordinary character, and so is
 *   everything else;
 * - the closing `"` must be followed by `.` or by the end of the path;
 * - a segment that does not begin with `"` ends at the next `.`;
 * - quoting is optional where it is unnecessary: `team."members".roberto` and `team.members.roberto`
 *   are the same path. Nothing that parsed before this rule existed parses differently under it,
 *   because a `"` could not appear in a *resolving* path at all.
 *
 * At a shell prompt the two quoting layers overlap and are easy to confuse:
 * `wingfoil dna update 'stacks.technologies."Node.js".version' --value 22.14+` has the **shell's**
 * single quotes outside and **WingFoil's** double quotes inside. This function sees only the inner
 * form.
 *
 * **Three refusals, and the distinctions between them are load-bearing:**
 *
 * - an **empty** segment, quoted (`team.""`) or not (`..language`) — `invalid key path: '<path>'`,
 *   the message `P2.1-dna-set.feature` scenario 3 pins, unchanged;
 * - an **unterminated** quote — a segment that opens with `"` and never closes. Refused as
 *   unterminated rather than taken as a name that happens to begin with a quote, so
 *   `dna update 'stacks."Node.js'` reports the typo instead of hunting for an entry named `"Node`;
 * - a `"` **no delimiter can account for**: inside an unquoted segment (`modules.co"re`), or in the
 *   remainder of a quoted one (`stacks."say "hi""`). A quoted segment may not contain `"` and there
 *   is **no escape sequence** — `dl-083` accepted that cost deliberately rather than overlooking it —
 *   so the name being reached for has no spelling at all. The refusal says the **name** is
 *   unaddressable, not that the path is malformed, because the path is the only spelling an
 *   impossible request has. A quoted segment that merely fails to span its segment (`"Node.js"x`)
 *   carries no such `"` and is malformed instead: that is what keeps the unaddressable message true
 *   every time it is printed.
 *
 * All three are usage errors (exit 2, `spec-005-cli-command-contract` §1) — properties of how the
 * argument is spelled, decided before anything is read. This is a pure function with no side effects,
 * so the caller owns turning a refusal into that exit code.
 */
export function splitDnaPath(keyPath: string): DnaPathSplit {
  const malformed: DnaPathSplit = { ok: false, message: `invalid key path: '${keyPath}'` };
  const segments: string[] = [];
  let index = 0;

  for (;;) {
    let segment: string;
    /** Index of the `.` that ended this segment, or `-1` when the segment ran to the end of the path. */
    let dot: number;

    if (keyPath[index] === QUOTE) {
      const close = keyPath.indexOf(QUOTE, index + 1);
      if (close < 0) {
        return {
          ok: false,
          message: `invalid key path: '${keyPath}': unterminated quote — a segment that opens with ${QUOTE} must close with ${QUOTE}`,
        };
      }
      dot = keyPath.indexOf('.', close + 1);
      const trailer = dot < 0 ? keyPath.slice(close + 1) : keyPath.slice(close + 1, dot);
      if (trailer.length > 0) return trailer.includes(QUOTE) ? unaddressable(keyPath) : malformed;
      segment = keyPath.slice(index + 1, close);
    } else {
      dot = keyPath.indexOf('.', index);
      segment = dot < 0 ? keyPath.slice(index) : keyPath.slice(index, dot);
      if (segment.includes(QUOTE)) return unaddressable(keyPath);
    }

    if (segment.length === 0) return malformed;
    segments.push(segment);
    // A `.` always opens another segment — `team.` owes one, and it is the empty one refused above.
    if (dot < 0) return { ok: true, segments };
    index = dot + 1;
  }
}

/** The refusal for a `"` that cannot be a delimiter: the NAME has no spelling, not the path. */
function unaddressable(keyPath: string): DnaPathSplit {
  return {
    ok: false,
    message:
      `unaddressable entry name in key path '${keyPath}': a segment may not contain ${QUOTE} and there is ` +
      `no escape sequence, so an entry whose name contains ${QUOTE} cannot be addressed`,
  };
}

/**
 * The path spelling of one segment: quoted when its name contains a `.`, bare otherwise — the inverse
 * of {@link splitDnaPath}, used wherever a refusal echoes part of a path so the reported prefix can be
 * pasted back into a command. Without it `stacks.technologies.Node.js` would be reported for the entry
 * named `Node.js`, and that re-splits into four segments and names a different node.
 */
export function quoteDnaSegment(name: string): string {
  return name.includes('.') ? `${QUOTE}${name}${QUOTE}` : name;
}

/**
 * Whether `keyPath` is a well-formed dotted path — {@link splitDnaPath} reduced to a boolean, so the
 * predicate and the parser cannot disagree about what "well-formed" means. A malformed path (the
 * BDD's `..language`, an empty segment, an unterminated or unaccountable quote) is a usage error
 * (exit 2, spec-005-cli-command-contract §1) the caller rejects before any write; a caller that
 * reports a message uses `splitDnaPath` directly, because only it knows *which* of the three it was.
 */
export function isValidKeyPath(keyPath: string): boolean {
  return splitDnaPath(keyPath).ok;
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
 *
 * Exported for `./edit.ts`, the sequence-aware editor added by task-093: both write paths must agree
 * on where a line's value ends and its comment begins, and two copies of this scanner would be two
 * chances to disagree.
 */
export function inlineCommentIndex(rest: string): number {
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
export function valueOf(rest: string): string {
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
  // task-093/bug-084: the write path does NOT apply `DNA_KEY_ALIASES` — see that constant's own note.
  // task-099: one parser for every path, so a quoted segment means the same here as at the resolver,
  // and a malformed path is the single `ok: false` this function turns into its `undefined` fallback.
  const split = splitDnaPath(keyPath);
  if (!split.ok) return undefined;
  const segments = split.segments;

  try {
    load(text); // a single, parseable document: never "repair" input the caller could not read
  } catch {
    return undefined;
  }

  const scalar = renderScalar(value);
  if (scalar === undefined) return undefined;

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
