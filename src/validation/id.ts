/**
 * ID-generation engine (task-002-validation-id-engine, acceptance criteria 5).
 *
 * Generates a concrete Memory-element ID from a type's `id_pattern` (declared in
 * `docs/self/.wingfoil/memory.yaml`, e.g. `task-{n}-{slug}`) plus values for its `{placeholder}`
 * tokens. It enforces the shared ID character class `[a-z0-9-.]` that spec-009-validation-strategy
 * §1 frames as a Pass-2 rule owned by "the shared ID constants":
 *
 *  - Every literal character of the pattern (outside `{...}` tokens) must be in `[a-z0-9-.]`;
 *    otherwise `E_INVALID_ID_PATTERN_CHARS` (integrity failure, exit 2 — the pattern itself is
 *    malformed).
 *  - Every rendered value must keep the produced ID inside `[a-z0-9-.]`; otherwise `E_INVALID_ID`
 *    (field-level failure, exit 1).
 *
 * It lives under `src/validation` (not `src/core`) because spec-009 §1 co-locates the id-character
 * rule with the validation module, and `runValidation`'s Pass-2 id-pattern check consumes the same
 * character class exported here — keeping one source of truth for what a legal ID looks like.
 */
import { ValidationError, ValidationIssue } from './errors';

/** The shared ID character class (spec-009 §1): lowercase alphanumerics, `-`, and `.`. */
export const ID_CHAR_CLASS = 'a-z0-9-.';

/** A rendered ID (or ID piece) must match this end-to-end. `-` is placed last to avoid a range. */
const ID_PIECE_RE = /^[a-z0-9.-]+$/;

/** A literal pattern segment: every character must be a member of the ID character class. */
const LITERAL_RE = /^[a-z0-9.-]+$/;

/** A numeric token is one written purely as `n` (e.g. `{n}`, `{nn}`, `{nnn}`). */
const NUMERIC_TOKEN_RE = /^n+$/;

/** Minimum zero-pad width for numeric tokens (observed convention: task-001, adr-005, spec-009). */
const DEFAULT_PAD_WIDTH = 3;

type SegmentKind = 'literal' | 'token';
interface Segment {
  readonly kind: SegmentKind;
  readonly value: string;
}

const TOKEN_RE = /\{([^{}]+)\}/g;

/** Split a pattern into ordered literal / token segments. */
function parsePattern(pattern: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(pattern)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'literal', value: pattern.slice(lastIndex, match.index) });
    }
    segments.push({ kind: 'token', value: match[1] ?? '' });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < pattern.length) {
    segments.push({ kind: 'literal', value: pattern.slice(lastIndex) });
  }
  return segments;
}

function isNumericToken(token: string): boolean {
  return NUMERIC_TOKEN_RE.test(token);
}

/** Escape a literal segment for safe insertion into a RegExp source. */
function escapeLiteral(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build the RegExp an ID produced from `pattern` must match: literals are matched verbatim, numeric
 * tokens as `[0-9]+`, and every other token as a hyphen-separated `[a-z0-9.]` slug.
 */
export function patternToRegExp(pattern: string): RegExp {
  const segments = parsePattern(pattern);
  let source = '^';
  for (const segment of segments) {
    if (segment.kind === 'literal') {
      source += escapeLiteral(segment.value);
    } else {
      source += isNumericToken(segment.value) ? '[0-9]+' : '[a-z0-9.]+(?:-[a-z0-9.]+)*';
    }
  }
  source += '$';
  return new RegExp(source);
}

/** Collect, in order of first appearance, the characters of `literal` outside the ID class. */
function offendingChars(literal: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ch of literal) {
    if (!LITERAL_RE.test(ch) && !seen.has(ch)) {
      seen.add(ch);
      out.push(ch);
    }
  }
  return out;
}

/**
 * Generate a concrete ID from `pattern` and `values`.
 *
 * @throws {@link ValidationError} `E_INVALID_ID_PATTERN_CHARS` (exit 2) if the pattern's literals
 *   leave the ID character class, or `E_INVALID_ID` (exit 1) if a value is missing, mistyped, or
 *   would produce an ID outside `[a-z0-9-.]`.
 */
export function generateId(pattern: string, values: Record<string, string | number>): string {
  const segments = parsePattern(pattern);

  // Pass A — pattern literals must all be inside the ID character class (integrity failure).
  const badChars = new Set<string>();
  for (const segment of segments) {
    if (segment.kind === 'literal') {
      for (const ch of offendingChars(segment.value)) badChars.add(ch);
    }
  }
  if (badChars.size > 0) {
    throw ValidationError.semantic([
      {
        code: 'E_INVALID_ID_PATTERN_CHARS',
        path: 'id_pattern',
        file: pattern,
        message: `pattern contains character(s) outside [${ID_CHAR_CLASS}]: ${[...badChars].join(', ')}`,
      },
    ]);
  }

  // Pass B — render each token, collecting value-level failures.
  const issues: ValidationIssue[] = [];
  let id = '';
  for (const segment of segments) {
    if (segment.kind === 'literal') {
      id += segment.value;
      continue;
    }
    const token = segment.value;
    const value = values[token];
    if (value === undefined) {
      issues.push(invalidId(pattern, `missing value for token {${token}}`));
      continue;
    }
    if (isNumericToken(token)) {
      const rendered = renderNumeric(token, value);
      if (rendered === null) {
        issues.push(invalidId(pattern, `token {${token}} expects a non-negative integer, got "${String(value)}"`));
        continue;
      }
      id += rendered;
    } else {
      if (typeof value !== 'string' || !ID_PIECE_RE.test(value)) {
        issues.push(invalidId(pattern, `value for token {${token}} is not a valid [${ID_CHAR_CLASS}] piece: "${String(value)}"`));
        continue;
      }
      id += value;
    }
  }
  if (issues.length > 0) {
    throw new ValidationError(issues);
  }

  // Pass C — final safety net: the assembled ID must match the pattern and the ID character class.
  if (!ID_PIECE_RE.test(id) || !patternToRegExp(pattern).test(id)) {
    throw new ValidationError([invalidId(pattern, `generated id "${id}" does not conform to pattern`)]);
  }
  return id;
}

function invalidId(pattern: string, message: string): ValidationIssue {
  return { code: 'E_INVALID_ID', path: 'id', file: pattern, message };
}

/** Render a numeric token, zero-padded to at least the token width (min 3). `null` if not numeric. */
function renderNumeric(token: string, value: string | number): string | null {
  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else if (/^\d+$/.test(value)) {
    n = Number(value);
  } else {
    return null;
  }
  if (!Number.isInteger(n) || n < 0) return null;
  const width = Math.max(DEFAULT_PAD_WIDTH, token.length);
  return String(n).padStart(width, '0');
}
