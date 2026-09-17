/**
 * P3.1 (US-4-02) — the Directives pillar's own pure helpers behind `wingfoil directive create`
 * (task-050-directive-create): the kebab-case name rule and the generated file's content.
 *
 * Ground truth for the name rule and its message is
 * `docs/02_requirements/02_bdd/features/p3-directives/P3.1-directive-create.feature`
 * ("Error - invalid directive name": `--name 'bad name!'` -> exit 2, message
 * `invalid directive name (use kebab-case)`). Ground truth for the generated frontmatter is
 * `spec-013-directive-frontmatter-schema` (`approved`) — `id`/`name`/`type`/`kind`/`title` required —
 * which is why the rendered document is validated here against the REAL `DirectiveFrontmatter`
 * schema rather than against a hand-copied field list (`bug-006` was exactly a generator drifting
 * away from that schema).
 *
 * These helpers are pure (REQ-SYS-07): no filesystem, no git, no clock. The write + commit half of
 * the operation lives in `src/core` and is covered by `test/core/directive-create.test.ts`.
 */
import { load as yamlLoad } from 'js-yaml';

import {
  INVALID_DIRECTIVE_NAME_MESSAGE,
  directiveTitleFromName,
  isValidDirectiveName,
  renderCustomDirective,
} from '../../src/directives/create';
import { DirectiveFrontmatter } from '../../src/directives/schema';
import { extractFrontmatter } from '../../src/storage';

describe('isValidDirectiveName — P3.1 "Error - invalid directive name" (kebab-case rule)', () => {
  it.each([
    'no-direct-db-access',
    'testing',
    'code-quality',
    'a',
    'rule-2',
    'v2-api-only',
  ])('accepts the kebab-case name %p', (name) => {
    expect(isValidDirectiveName(name)).toBe(true);
  });

  it.each([
    ['bad name!', 'the exact BDD counter-example: a space and a bang'],
    ['bad name', 'a space'],
    ['Bad-Name', 'upper case'],
    ['-leading', 'a leading hyphen'],
    ['trailing-', 'a trailing hyphen'],
    ['double--hyphen', 'an empty segment'],
    ['', 'empty'],
    ['   ', 'whitespace only'],
    ['under_score', 'an underscore'],
    ['dotted.name', 'a dot'],
    ['sub/dir', 'a path separator'],
    ['..', 'a parent-directory reference'],
    ['../escape', 'a path-traversal spelling'],
    ['/absolute', 'an absolute path'],
    ['name.md', 'the extension the command appends itself'],
    ['tab\there', 'a tab'],
    ['new\nline', 'a newline'],
  ])('rejects %p (%s)', (name) => {
    expect(isValidDirectiveName(name)).toBe(false);
  });

  it('exposes the exact BDD message string, verbatim', () => {
    expect(INVALID_DIRECTIVE_NAME_MESSAGE).toBe('invalid directive name (use kebab-case)');
  });
});

describe('directiveTitleFromName — deterministic humanization of the slug (REQ-SYS-07)', () => {
  it.each([
    ['no-direct-db-access', 'No direct db access'],
    ['code-quality', 'Code quality'],
    ['testing', 'Testing'],
    ['v2-api-only', 'V2 api only'],
  ])('%p -> %p', (name, expected) => {
    expect(directiveTitleFromName(name)).toBe(expected);
  });
});

describe('renderCustomDirective — the generated file (spec-013 frontmatter contract)', () => {
  const NAME = 'no-direct-db-access';

  it('renders the exact document, byte for byte', () => {
    expect(renderCustomDirective(NAME)).toBe(
      `---
id: no-direct-db-access
name: no-direct-db-access
type: directive
kind: custom
title: "No direct db access"
---

# No direct db access

<!-- Write the rule this directive enforces here. Directives are auto-loaded per role (roles.yaml). -->
`,
    );
  });

  it('is a pure function of the name — identical output across repeated calls (REQ-SYS-07)', () => {
    expect(renderCustomDirective(NAME)).toBe(renderCustomDirective(NAME));
    expect(renderCustomDirective('other-rule')).not.toBe(renderCustomDirective(NAME));
  });

  it('its frontmatter validates against the real DirectiveFrontmatter schema (spec-013)', () => {
    const frontmatterText = extractFrontmatter(renderCustomDirective(NAME));
    expect(frontmatterText).not.toBeNull();
    const parsed = DirectiveFrontmatter.safeParse(yamlLoad(frontmatterText as string));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toMatchObject({
      id: NAME,
      name: NAME,
      type: 'directive',
      kind: 'custom',
      title: 'No direct db access',
    });
  });

  it('sets `id` to the filename stem the command writes (spec-013: "matches the filename stem")', () => {
    const frontmatterText = extractFrontmatter(renderCustomDirective('rule-2')) as string;
    expect((yamlLoad(frontmatterText) as { id: string }).id).toBe('rule-2');
  });
});
