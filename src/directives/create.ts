/**
 * Pure Directives-pillar helpers for `wingfoil directive create` (P3.1,
 * task-050-directive-create). The `directives` pillar owns what a directive is *called* and what a
 * newly-created directive file *contains*; `src/core`'s `directiveCreate` operation composes these
 * with the git-identity pre-flight, the already-exists check, the write and the commit (cross-pillar
 * / storage concerns that therefore live in `src/core`, not here). Nothing in this file imports
 * `src/core` or touches the filesystem — the pillar stays a leaf under core
 * (spec-006-core-domain-api §1) and every function here is pure (REQ-SYS-07: no wall-clock, no
 * randomness, no environment read), so the same `--name` always yields byte-identical output.
 *
 * The generated frontmatter is a contract, not a formality: it must satisfy
 * {@link DirectiveFrontmatter} (spec-013-directive-frontmatter-schema) so a created directive loads
 * cleanly through `loadDirectives` alongside the ten `wingfoil init` scaffolds — `bug-006` was
 * precisely that invariant broken from the init-generator side.
 */

/**
 * A directive name is kebab-case: one or more lower-case alphanumeric segments joined by single
 * hyphens. No upper case, no leading/trailing/doubled hyphen, no whitespace, dot, underscore or path
 * separator.
 *
 * Rejecting everything else also makes the write target unescapable by construction: `..`, `../x`,
 * `a/b` and `/etc/passwd` all fail this rule *before* `src/core` builds any path from the name, so
 * the created file can only ever land directly inside `.wingfoil/directives/custom/`.
 */
const DIRECTIVE_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The exact refusal message P3.1's "Error - invalid directive name" scenario pins
 * (`docs/02_requirements/02_bdd/features/p3-directives/P3.1-directive-create.feature`) — surfaced by
 * `src/core` as a `UsageError`, hence exit `2` (spec-008-cli-grammar §5). Do not reword.
 */
export const INVALID_DIRECTIVE_NAME_MESSAGE = 'invalid directive name (use kebab-case)';

/** Whether `name` is a legal custom-directive name (kebab-case — see {@link DIRECTIVE_NAME_RE}). */
export function isValidDirectiveName(name: string): boolean {
  return DIRECTIVE_NAME_RE.test(name);
}

/**
 * The human-readable title generated from a kebab-case directive name: hyphens become spaces and the
 * first character is upper-cased (`no-direct-db-access` -> `No direct db access`). Deliberately the
 * same shape `wingfoil init`'s own directive generator uses for its scaffolds (`code-quality` ->
 * `Code quality`, `src/storage/templates.ts`), so a created directive is indistinguishable in style
 * from a scaffolded one. A pure function of `name`; assumes {@link isValidDirectiveName} already
 * passed (the caller validates first).
 */
export function directiveTitleFromName(name: string): string {
  const words = name.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The full Markdown document written for a new custom directive: a YAML frontmatter block that
 * satisfies `DirectiveFrontmatter` (spec-013 — `id`, `name`, `type`, `kind`, `title` are the required
 * fields) followed by a placeholder body for the rule text.
 *
 * - `id` is the name verbatim, matching the filename stem the caller writes (spec-013's `id` note).
 * - `kind: custom` because the file lands under `directives/custom/` (spec-011's built-in/custom split;
 *   `built-in/` is reserved for the P3.8 templates the package will ship).
 * - `tags`/`ref` are omitted: both are `.optional()` in the schema, and a user-authored rule has no
 *   upstream P3.8 reference to claim.
 *
 * The body is deliberately not schema-governed (spec-013: "Body content is not governed here").
 */
export function renderCustomDirective(name: string): string {
  const title = directiveTitleFromName(name);
  return `---
id: ${name}
name: ${name}
type: directive
kind: custom
title: "${title}"
---

# ${title}

<!-- Write the rule this directive enforces here. Directives are auto-loaded per role (roles.yaml). -->
`;
}
