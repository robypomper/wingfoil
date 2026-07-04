import { EXIT_INTEGRITY, ValidationError } from '../../src/validation/errors';
import { generateId, patternToRegExp } from '../../src/validation/id';

// id_pattern values copied literally from docs/self/.wingfoil/memory.yaml (the authoritative
// source), one per Memory type — not re-derived. Mirrors module-layout.test.ts's convention of
// copying config values verbatim. Padding to 3 digits is the engine's declared choice (memory.yaml
// records exact numbering/padding as "an ID-generation-engine detail, not fixed here").
const ID_PATTERNS: Array<{
  type: string;
  pattern: string;
  values: Record<string, string | number>;
  expected: string;
}> = [
  { type: 'release-line', pattern: 'rl-{version}', values: { version: 'v1' }, expected: 'rl-v1' },
  {
    type: 'release',
    pattern: 'minor-{version}',
    values: { version: 'v0.1' },
    expected: 'minor-v0.1',
  },
  {
    type: 'task',
    pattern: 'task-{n}-{slug}',
    values: { n: 2, slug: 'validation-id-engine' },
    expected: 'task-002-validation-id-engine',
  },
  {
    type: 'adr',
    pattern: 'adr-{n}-{slug}',
    values: { n: 5, slug: 'typescript-node-stack' },
    expected: 'adr-005-typescript-node-stack',
  },
  {
    type: 'decision-log',
    pattern: 'dl-{n}-{slug}',
    values: { n: 12, slug: 'decision-log-state-machine' },
    expected: 'dl-012-decision-log-state-machine',
  },
  {
    type: 'tech-spec',
    pattern: 'spec-{n}-{slug}',
    values: { n: 9, slug: 'validation-strategy' },
    expected: 'spec-009-validation-strategy',
  },
  {
    type: 'bug',
    pattern: 'bug-{n}-{slug}',
    values: { n: 1, slug: 'null-deref' },
    expected: 'bug-001-null-deref',
  },
];

describe('generateId — IDs conform to each memory.yaml id_pattern', () => {
  it.each(ID_PATTERNS)('$type: $pattern -> $expected', ({ pattern, values, expected }) => {
    const id = generateId(pattern, values);
    expect(id).toBe(expected);
    expect(patternToRegExp(pattern).test(id)).toBe(true);
  });

  it('zero-pads numeric tokens to 3 digits by default (task-002, not task-2)', () => {
    expect(generateId('task-{n}-{slug}', { n: 2, slug: 'x' })).toBe('task-002-x');
  });

  it('never truncates numbers wider than the pad width', () => {
    expect(generateId('task-{n}-{slug}', { n: 1234, slug: 'x' })).toBe('task-1234-x');
  });
});

describe('generateId — rejects literal pattern chars outside [a-z0-9-.]', () => {
  it.each(['Task-{n}-{slug}', 'task_{n}-{slug}', 'task {n}-{slug}', 'task/{n}-{slug}'])(
    'rejects pattern %p with E_INVALID_ID_PATTERN_CHARS (exit 2)',
    (pattern) => {
      let thrown: unknown;
      try {
        generateId(pattern, { n: 1, slug: 'x' });
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(ValidationError);
      expect((thrown as ValidationError).issues.map((i) => i.code)).toContain(
        'E_INVALID_ID_PATTERN_CHARS',
      );
      expect((thrown as ValidationError).exitCode).toBe(EXIT_INTEGRITY);
    },
  );
});

describe('generateId — rejects placeholder values that would produce invalid IDs', () => {
  it('rejects a slug value with uppercase/space characters (E_INVALID_ID)', () => {
    let thrown: unknown;
    try {
      generateId('task-{n}-{slug}', { n: 1, slug: 'Not A Slug' });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ValidationError);
    expect((thrown as ValidationError).issues.map((i) => i.code)).toContain('E_INVALID_ID');
  });

  it('rejects a non-numeric value for a numeric token (E_INVALID_ID)', () => {
    let thrown: unknown;
    try {
      generateId('task-{n}-{slug}', { n: 'two', slug: 'x' });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ValidationError);
    expect((thrown as ValidationError).issues.map((i) => i.code)).toContain('E_INVALID_ID');
  });
});
