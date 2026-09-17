/**
 * task-051-directive-assign (P3.2) — the pure, comment-preserving `roles.yaml` writer
 * (`src/directives/roles-edit.ts`) that `directive assign` uses and that `directive remove` (P3.3,
 * task-052) and multi-directive assignment (P3.7, task-056) are designed to reuse.
 *
 * Two primitives:
 * - `withAssignedDirectives(current, ids)` — the set semantics of an assignment: keep the existing
 *   order, append new ids in argument order, never duplicate (P3.7 "Binding is idempotent").
 * - `setRoleAssignmentsInText(text, role, next)` — rewrite `assignments.<role>` to exactly `next`
 *   while every other byte of the file (comments, blank lines, other roles, `global`) is untouched
 *   (the bug-004 / task-063 precedent, applied to `roles.yaml`); `undefined` whenever that cannot be
 *   done provably, so the caller decides the fallback (bug-019: never a silent comment loss).
 */
import { load } from 'js-yaml';

import { setRoleAssignmentsInText, withAssignedDirectives } from '../../src/directives/roles-edit';

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

  it('is deterministic: the same inputs give byte-identical output', () => {
    const a = setRoleAssignmentsInText(SCAFFOLD, 'qa', ['testing', 'security']);
    const b = setRoleAssignmentsInText(SCAFFOLD, 'qa', ['testing', 'security']);
    expect(a).toBe(b);
  });
});
