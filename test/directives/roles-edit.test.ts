/**
 * task-051-directive-assign (P3.2) — the pure, comment-preserving `roles.yaml` writer
 * (`src/directives/roles-edit.ts`) that `directive assign` uses. Multi-directive assignment (P3.7,
 * task-056-role-based-directive-assignment) reuses both primitives **unchanged** and adds the third
 * one below; `directive remove` (P3.3, task-052) reuses neither, since P3.3 refuses a still-assigned
 * directive rather than unbinding it.
 *
 * Three primitives:
 * - `withAssignedDirectives(current, ids)` — the set semantics of an assignment: keep the existing
 *   order, append new ids in argument order, never duplicate (P3.7 "Binding is idempotent").
 * - `setRoleAssignmentsInText(text, role, next)` — rewrite `assignments.<role>` to exactly `next`
 *   while every other byte of the file (comments, blank lines, other roles, `global`) is untouched
 *   (the bug-004 / task-063 precedent, applied to `roles.yaml`); `undefined` whenever that cannot be
 *   done provably, so the caller decides the fallback (bug-019: never a silent comment loss).
 * - `parseDirectiveIds(raw)` — the comma-separated `--directive "a,b,c"` value (P3.7, task-056):
 *   trimmed, empty segments dropped, de-duplicated keeping the first position.
 */
import { load } from 'js-yaml';

import { parseDirectiveIds, setRoleAssignmentsInText, withAssignedDirectives } from '../../src/directives/roles-edit';

/** The exact shape `wingfoil init` scaffolds (`rolesYaml()`, src/storage/templates.ts), comments included. */
const SCAFFOLD = `# Directive role assignments (P3.2/P3.7) — scaffolded by \`wingfoil init\`.
# Binds directives to roles by directive ID, independent of the built-in/custom subfolder holding the file.
version: 1

assignments:
  developer:
    - code-quality
    - testing
    - determinism
  reviewer:
    - code-review
    - traceability

# Global directives apply to every role.
global:
  - doc-versioning
  - documentation
`;

function assignmentsOf(text: string): Record<string, unknown> {
  return (load(text) as { assignments: Record<string, unknown> }).assignments;
}

/** Lines present in `after` but not at the same position in `before` — a crude but strict line diff. */
function addedLines(before: string, after: string): string[] {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const added: string[] = [];
  let i = 0;
  for (const line of afterLines) {
    if (beforeLines[i] === line) i += 1;
    else added.push(line);
  }
  expect(i).toBe(beforeLines.length); // every original line survives, in order
  return added;
}

describe('withAssignedDirectives — assignment set semantics', () => {
  it('appends a new id after the existing ones, keeping their order', () => {
    expect(withAssignedDirectives(['code-quality', 'determinism'], ['testing'])).toEqual([
      'code-quality',
      'determinism',
      'testing',
    ]);
  });

  it('is idempotent: an already-assigned id is not duplicated and the list is unchanged', () => {
    expect(withAssignedDirectives(['testing'], ['testing'])).toEqual(['testing']);
  });

  it('appends several new ids in argument order, de-duplicating within the argument list too', () => {
    expect(withAssignedDirectives([], ['testing', 'code-quality', 'testing', 'security'])).toEqual([
      'testing',
      'code-quality',
      'security',
    ]);
  });

  it('does not mutate its input', () => {
    const current = ['a'];
    withAssignedDirectives(current, ['b']);
    expect(current).toEqual(['a']);
  });
});

// task-056-role-based-directive-assignment (P3.7, US-4-06) — the `--directive a,b,c` value parser.
// De-duplication happens HERE, not only in `withAssignedDirectives`, because the parsed list is also
// what the result payload and the commit subject echo back: `--directive testing,testing` must not
// produce a subject naming `testing` twice.
describe('parseDirectiveIds — the comma-separated `--directive` value (P3.7)', () => {
  it('parses a single id to a one-element list (P3.2 keeps working unchanged)', () => {
    expect(parseDirectiveIds('testing')).toEqual(['testing']);
  });

  it('splits on commas, in argument order', () => {
    expect(parseDirectiveIds('testing,code-quality,security')).toEqual(['testing', 'code-quality', 'security']);
  });

  it('trims whitespace around every id and around the separators', () => {
    expect(parseDirectiveIds('  testing , code-quality ,security  ')).toEqual([
      'testing',
      'code-quality',
      'security',
    ]);
  });

  it('de-duplicates, keeping the FIRST occurrence position (deterministic echo — REQ-SYS-07)', () => {
    expect(parseDirectiveIds('testing,code-quality,testing,security,code-quality')).toEqual([
      'testing',
      'code-quality',
      'security',
    ]);
  });

  it('drops empty segments rather than producing empty ids', () => {
    expect(parseDirectiveIds('testing,,security,')).toEqual(['testing', 'security']);
  });

  it.each(['', '   ', ',', ' , , '])('yields an empty list for a value contributing no ids (%p)', (raw) => {
    expect(parseDirectiveIds(raw)).toEqual([]);
  });
});

describe('setRoleAssignmentsInText — appending to an existing block list (P3.2 Sc.1)', () => {
  it('adds exactly one line after the last item of the role, every comment and other line intact', () => {
    const next = setRoleAssignmentsInText(SCAFFOLD, 'reviewer', ['code-review', 'traceability', 'testing']);
    expect(next).toBeDefined();
    expect(addedLines(SCAFFOLD, next as string)).toEqual(['    - testing']);
    expect(assignmentsOf(next as string).reviewer).toEqual(['code-review', 'traceability', 'testing']);
    expect(assignmentsOf(next as string).developer).toEqual(['code-quality', 'testing', 'determinism']);
  });

  it('returns the text unchanged when `next` equals the current list', () => {
    expect(setRoleAssignmentsInText(SCAFFOLD, 'reviewer', ['code-review', 'traceability'])).toBe(SCAFFOLD);
  });

  it('keeps an inline comment on an existing item and a comment line inside the list', () => {
    const text = `assignments:
  developer:
    # why these
    - testing   # mandatory
global: []
`;
    const next = setRoleAssignmentsInText(text, 'developer', ['testing', 'security']);
    expect(next).toBe(`assignments:
  developer:
    # why these
    - testing   # mandatory
    - security
global: []
`);
  });

  it('adopts the indentation of the existing items (compact, same-indent sequences too)', () => {
    const text = 'assignments:\n    developer:\n    - testing\nglobal: []\n';
    expect(setRoleAssignmentsInText(text, 'developer', ['testing', 'security'])).toBe(
      'assignments:\n    developer:\n    - testing\n    - security\nglobal: []\n',
    );
  });

  it('reads quoted items as their scalar value', () => {
    const text = 'assignments:\n  developer:\n    - "testing"\nglobal: []\n';
    const next = setRoleAssignmentsInText(text, 'developer', ['testing', 'security']);
    expect(next).toBe('assignments:\n  developer:\n    - "testing"\n    - security\nglobal: []\n');
  });

  it('renders an id that needs quoting through js-yaml, so it reads back as the same string', () => {
    const next = setRoleAssignmentsInText(SCAFFOLD, 'reviewer', ['code-review', 'traceability', 'yes']);
    expect(next).toBeDefined();
    expect(assignmentsOf(next as string).reviewer).toEqual(['code-review', 'traceability', 'yes']);
  });

  it('preserves CRLF line endings when the whole file uses them', () => {
    const crlf = SCAFFOLD.replace(/\n/g, '\r\n');
    const next = setRoleAssignmentsInText(crlf, 'reviewer', ['code-review', 'traceability', 'testing']);
    expect(next).toBe(
      SCAFFOLD.replace('    - traceability\n', '    - traceability\n    - testing\n').replace(/\n/g, '\r\n'),
    );
  });
});

describe('setRoleAssignmentsInText — a role with no assignments entry yet (dl-029)', () => {
  it('inserts the role key at the end of the assignments block, BEFORE its trailing blank/comment lines', () => {
    const next = setRoleAssignmentsInText(SCAFFOLD, 'qa', ['testing']);
    expect(next).toBe(
      SCAFFOLD.replace(
        '    - traceability\n\n# Global',
        '    - traceability\n  qa:\n    - testing\n\n# Global',
      ),
    );
  });

  it('adopts the sibling key indentation and their item indentation', () => {
    const text = 'assignments:\n    developer:\n        - testing\nglobal: []\n';
    expect(setRoleAssignmentsInText(text, 'qa', ['testing'])).toBe(
      'assignments:\n    developer:\n        - testing\n    qa:\n        - testing\nglobal: []\n',
    );
  });

  it('turns an empty flow list `role: []` into a block list, keeping its inline comment', () => {
    const text = 'assignments:\n  qa: [] # nothing yet\nglobal: []\n';
    expect(setRoleAssignmentsInText(text, 'qa', ['testing'])).toBe(
      'assignments:\n  qa: # nothing yet\n    - testing\nglobal: []\n',
    );
  });

  it('inserts under an `assignments:` block that has no entries yet, at the default indentation', () => {
    expect(setRoleAssignmentsInText('assignments:\nglobal: []\n', 'qa', ['testing'])).toBe(
      'assignments:\n  qa:\n    - testing\nglobal: []\n',
    );
  });

  it('uses key indentation + 2 for items when no sibling has a block list to copy', () => {
    expect(setRoleAssignmentsInText('assignments:\n  qa: []\nglobal: []\n', 'developer', ['testing'])).toBe(
      'assignments:\n  qa: []\n  developer:\n    - testing\nglobal: []\n',
    );
  });

  it('returns the text unchanged for an absent role and an empty `next`', () => {
    expect(setRoleAssignmentsInText(SCAFFOLD, 'qa', [])).toBe(SCAFFOLD);
  });
});

describe('setRoleAssignmentsInText — deletions (the shape task-052 remove reuses)', () => {
  it('deletes an item line and keeps the rest', () => {
    const next = setRoleAssignmentsInText(SCAFFOLD, 'developer', ['code-quality', 'determinism']);
    expect(next).toBe(SCAFFOLD.replace('    - testing\n', ''));
  });

  it('collapses a list emptied entirely to `role: []`', () => {
    const next = setRoleAssignmentsInText(SCAFFOLD, 'reviewer', []);
    expect(next).toBe(SCAFFOLD.replace('  reviewer:\n    - code-review\n    - traceability\n', '  reviewer: []\n'));
  });
});

describe('setRoleAssignmentsInText — refuses (undefined) whatever it cannot edit provably', () => {
  it.each([
    ['no `assignments:` key', 'version: 1\nglobal: []\n'],
    ['a flow-mapping assignments block', 'assignments: {developer: [testing]}\n'],
    ['a non-empty flow list for the role', 'assignments:\n  developer: [testing]\nglobal: []\n'],
    ['a nested sequence item', 'assignments:\n  developer:\n    -\n      - testing\nglobal: []\n'],
    ['a multi-line item', 'assignments:\n  developer:\n    - testing\n      continued\nglobal: []\n'],
    ['a mapping item', 'assignments:\n  developer:\n    - id: testing\nglobal: []\n'],
    ['tab indentation', 'assignments:\n\tdeveloper:\n\t\t- testing\nglobal: []\n'],
    ['mixed line endings', 'assignments:\r\n  developer:\n    - testing\nglobal: []\n'],
    ['text that is not YAML', 'assignments:\n  developer:\n    - [unclosed\n'],
    ['a lone CR line ending', 'assignments:\r  developer:\r    - testing\rglobal: []\r'],
    ['a flow-mapping child line', 'assignments:\n  {developer: [testing], qa: [testing]}\nglobal: []\n'],
    ['a tagged/null key line the editor cannot re-render', 'assignments:\n  developer: ~\nglobal: []\n'],
    ['invalid YAML outside the assignments block', 'assignments:\n  developer:\n    - testing\nglobal: [unclosed\n'],
    // An alias INSIDE the assignments block is refused early, in `mappingEntry` — js-yaml cannot load
    // `qa: *d` as a standalone line ("unidentified alias") — so it never reaches the self-check.
    ['a role line aliasing another role', 'assignments:\n  developer: &d\n    - testing\n  qa: *d\nglobal: []\n'],
    // This one DOES reach the re-parse self-check: `global` aliases `developer`'s list, so appending
    // an item would silently change `global` too. Mutation-proof that the self-check is what refuses
    // it: replacing `readsBackAs`'s final `roleMatches && sameJson(...)` with `roleMatches` makes this
    // case return the edited text (with `global` silently rewritten) and this assertion fail.
    ['a list the `global` key aliases', 'assignments:\n  developer: &d\n    - testing\nglobal: *d\n'],
  ])('%s', (_label, text) => {
    expect(setRoleAssignmentsInText(text, 'developer', ['testing', 'security'])).toBeUndefined();
  });

  it('a `next` that reorders existing items is realized by delete + append (never moved lines) and reads back exactly', () => {
    // Greedy subsequence matching deletes and re-appends rather than moving lines; the result must
    // still read back as exactly `next`.
    const next = setRoleAssignmentsInText(SCAFFOLD, 'developer', ['testing', 'code-quality', 'determinism']);
    expect(next).toBeDefined();
    expect(assignmentsOf(next as string).developer).toEqual(['testing', 'code-quality', 'determinism']);
  });

  it('refuses an id whose rendering would span several lines — appended or inserted', () => {
    expect(setRoleAssignmentsInText(SCAFFOLD, 'reviewer', ['code-review', 'traceability', 'two\nlines'])).toBeUndefined();
    expect(setRoleAssignmentsInText(SCAFFOLD, 'qa', ['two\nlines'])).toBeUndefined();
  });

  it('is deterministic: the same inputs give byte-identical output', () => {
    const a = setRoleAssignmentsInText(SCAFFOLD, 'qa', ['testing', 'security']);
    const b = setRoleAssignmentsInText(SCAFFOLD, 'qa', ['testing', 'security']);
    expect(a).toBe(b);
  });
});
