/**
 * `setDnaValueInText` — the minimal, comment-preserving in-place YAML edit behind `wingfoil dna set`
 * (bug-004-dna-set-strips-yaml-comments, task-063). The pure counterpart to
 * `test/core/dna-set-comment-preservation.test.ts`, which exercises the same behaviour end-to-end
 * through the registered `dna.dnaSet` core op on WingFoil's own comment-rich `dna.yaml`.
 *
 * Two properties matter beyond "it edits the right key":
 * - **Byte-minimality** — every line other than the target's is returned untouched, so comments
 *   (including the `[SPEC]`/`[AUTHORING]` field-provenance annotations) survive.
 * - **Honest refusal** — the editor returns `undefined` for every YAML shape it cannot edit
 *   minimally *and provably*, so the caller can fall back to the whole-file `dump()` path rather
 *   than write something subtly wrong.
 */
import { setDnaValueInText } from '../../src/dna/set';

describe('setDnaValueInText — replacing an existing key (bug-004 AC(a)/(b))', () => {
  it('rewrites only the target line, leaving every other byte identical', () => {
    const text = '# header comment\nversion: 1.1\nproject:\n  name: WingFoil\n  license: MIT\n';
    const edited = setDnaValueInText(text, 'project.name', 'Renamed');
    expect(edited).toBe('# header comment\nversion: 1.1\nproject:\n  name: Renamed\n  license: MIT\n');
  });

  it('keeps an inline trailing comment, and its column when the new value still fits', () => {
    // `'1.2'` is quoted because the GIVEN value is the string "1.2" (see the scalar-coercion block
    // below); the point here is that the `#` stays in column 33, exactly where it was.
    const text = 'version: 1.1                     # [AUTHORING] config-file format version\n';
    const edited = setDnaValueInText(text, 'version', '1.2');
    expect(edited).toBe("version: '1.2'                   # [AUTHORING] config-file format version\n");
    expect(edited!.indexOf('#')).toBe(text.indexOf('#'));
  });

  it('falls back to a single separating space when the new value overruns the comment column', () => {
    const text = 'name: a   # note\n';
    expect(setDnaValueInText(text, 'name', 'a-much-longer-value')).toBe('name: a-much-longer-value # note\n');
  });

  it('is not confused by a `#` inside a quoted value', () => {
    const text = "motto: 'not # a comment'   # but this one is\n";
    expect(setDnaValueInText(text, 'motto', 'plain')).toBe('motto: plain               # but this one is\n');
  });

  it('applies the tech_stack -> stacks first-segment alias, like `setDnaValue`', () => {
    const text = 'stacks:\n  language: python\n';
    expect(setDnaValueInText(text, 'tech_stack.language', 'go')).toBe('stacks:\n  language: go\n');
  });

  it('fills a null-valued key in place (`key:` with nothing under it)', () => {
    const text = 'project:\n  name:\n  license: MIT\n';
    expect(setDnaValueInText(text, 'project.name', 'WingFoil')).toBe('project:\n  name: WingFoil\n  license: MIT\n');
  });

  it('never matches a key nested inside a sequence item (no false positives across branches)', () => {
    const text = 'modules:\n  - name: core\n    path: src/core\nname: top\n';
    // `modules.name` must NOT resolve to the sequence entry's `name`; it is an absent key instead.
    const edited = setDnaValueInText(text, 'name', 'renamed');
    expect(edited).toBe('modules:\n  - name: core\n    path: src/core\nname: renamed\n');
  });

  it('is a pure function of (text, key, value) — REQ-SYS-07', () => {
    const text = 'project:\n  name: WingFoil   # [SPEC] identity\n';
    expect(setDnaValueInText(text, 'project.name', 'X')).toBe(setDnaValueInText(text, 'project.name', 'X'));
  });
});

describe('setDnaValueInText — scalar rendering parity with `js-yaml` dump (scalar coercion)', () => {
  it('quotes a value YAML would otherwise coerce, so it reads back as the string it was given', () => {
    // `dump('2')` emits `'2'`; writing a bare `2` would read back as the NUMBER 2 instead.
    expect(setDnaValueInText('version: 1.1\n', 'version', '2')).toBe("version: '2'\n");
    expect(setDnaValueInText('flag: no\n', 'flag', 'yes')).toBe("flag: 'yes'\n");
  });

  it('leaves a plain scalar unquoted, exactly as a whole-file dump would', () => {
    expect(setDnaValueInText('version: 1.1\n', 'version', 'not-a-number')).toBe('version: not-a-number\n');
  });

  it('refuses a value whose YAML form is itself multi-line (no single-line edit exists)', () => {
    expect(setDnaValueInText('name: a\n', 'name', 'line one\nline two')).toBeUndefined();
  });
});

describe('setDnaValueInText — inserting an absent key', () => {
  it('appends the key at the end of its existing parent block, after the last content line', () => {
    const text = 'project:\n  name: WingFoil\n\n# next section\nmodules: []\n';
    expect(setDnaValueInText(text, 'project.license', 'MIT')).toBe(
      'project:\n  name: WingFoil\n  license: MIT\n\n# next section\nmodules: []\n',
    );
  });

  it('adopts the parent block\'s own child indentation', () => {
    const text = 'project:\n    name: WingFoil\nversion: 1\n';
    expect(setDnaValueInText(text, 'project.license', 'MIT')).toBe(
      'project:\n    name: WingFoil\n    license: MIT\nversion: 1\n',
    );
  });

  it('creates missing intermediate levels for a wholly new top-level path', () => {
    const text = 'version: 1\n';
    expect(setDnaValueInText(text, 'project.name', 'WingFoil')).toBe('version: 1\nproject:\n  name: WingFoil\n');
  });

  it('inserts into an empty parent block', () => {
    const text = 'project:\nversion: 1\n';
    expect(setDnaValueInText(text, 'project.name', 'WingFoil')).toBe('project:\n  name: WingFoil\nversion: 1\n');
  });

  it('refuses to add a mapping key to a parent whose block is a sequence', () => {
    expect(setDnaValueInText('modules:\n  - name: core\n', 'modules.extra', 'x')).toBeUndefined();
  });
});

describe('setDnaValueInText — honest refusals (caller falls back to the whole-file dump)', () => {
  it('refuses to rewrite a block scalar (`>-` / `|`)', () => {
    const text = 'project:\n  north_star: >-\n    Determinism Index — two independent runs\n    agree.\n';
    expect(setDnaValueInText(text, 'project.north_star', 'short')).toBeUndefined();
  });

  it('refuses to replace a key that opens a nested block (the edit would delete the subtree)', () => {
    expect(setDnaValueInText('paths:\n  sources:\n    - src/\n', 'paths.sources', 'src')).toBeUndefined();
  });

  it('refuses to replace a key whose sequence hangs at the same indentation', () => {
    expect(setDnaValueInText('paths:\n- src/\n', 'paths', 'src')).toBeUndefined();
  });

  it('refuses to descend through a key that holds an inline scalar', () => {
    expect(setDnaValueInText('version: 1.1\n', 'version.major', '2')).toBeUndefined();
  });

  it('refuses a multi-document stream', () => {
    expect(setDnaValueInText('version: 1\n---\nversion: 2\n', 'version', '3')).toBeUndefined();
  });

  it('refuses a malformed key path (the caller has already raised the exit-2 usage error)', () => {
    expect(setDnaValueInText('version: 1\n', '..language', 'python')).toBeUndefined();
  });

  it('refuses text that is not valid YAML at all, rather than writing a broken edit', () => {
    expect(setDnaValueInText('name: [unclosed\n', 'name', 'x')).toBeUndefined();
  });
});
