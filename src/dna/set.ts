/**
 * Pure DNA key-path helpers for `wingfoil dna set` (P2.1, task-025-implement-dna-set). The `dna`
 * pillar owns the semantics of a dotted key path into its own structure; `src/core`'s `dnaSet`
 * operation composes these with the git-identity pre-flight, schema re-validation, write, and commit
 * (which are cross-pillar / storage concerns and therefore live in `src/core`, not here). Nothing in
 * this file imports `src/core` — the pillar stays a leaf under core (spec-006-core-domain-api §1).
 */

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
