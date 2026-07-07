/**
 * Pure DNA key-path validation + deep-set helpers (P2.1, task-025-implement-dna-set). These are the
 * project-shape-agnostic pieces `src/core`'s `dnaSet` op composes with git identity + write + commit:
 * a malformed dotted key path is rejected up front (the exit-2 usage-error case, AC(c)), a valid one
 * sets/overwrites the value in place (AC(a)/(b), no duplicate keys), and the `tech_stack -> stacks`
 * alias (spec-002-dna-yaml-schema Consequences) is applied to the first segment so a set is symmetric
 * with `dna show`'s existing alias.
 */
import { isValidKeyPath, setDnaValue, DNA_KEY_ALIASES } from '../../src/dna/set';

describe('isValidKeyPath (P2.1 AC(c) — malformed dotted path)', () => {
  it('accepts a simple two-segment dotted path', () => {
    expect(isValidKeyPath('tech_stack.language')).toBe(true);
  });

  it('accepts a single-segment path', () => {
    expect(isValidKeyPath('version')).toBe(true);
  });

  it("rejects the BDD's leading-double-dot example '..language'", () => {
    expect(isValidKeyPath('..language')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidKeyPath('')).toBe(false);
  });

  it('rejects a leading, trailing, or interior empty segment', () => {
    expect(isValidKeyPath('.foo')).toBe(false);
    expect(isValidKeyPath('foo.')).toBe(false);
    expect(isValidKeyPath('a..b')).toBe(false);
  });
});

describe('setDnaValue (P2.1 AC(a)/(b))', () => {
  it('AC(a): sets a nested value, creating missing intermediate objects', () => {
    const dna: Record<string, unknown> = { stacks: {} };
    setDnaValue(dna, 'stacks.language', 'python');
    expect(dna).toEqual({ stacks: { language: 'python' } });
  });

  it('AC(b): overwrites an existing value in place — one key, not a duplicate', () => {
    const dna: Record<string, unknown> = { stacks: { language: 'python' } };
    setDnaValue(dna, 'stacks.language', 'go');
    expect(dna).toEqual({ stacks: { language: 'go' } });
  });

  it('creates a missing intermediate object when the path descends into an absent key', () => {
    const dna: Record<string, unknown> = {};
    setDnaValue(dna, 'project.name', 'WingFoil');
    expect(dna).toEqual({ project: { name: 'WingFoil' } });
  });

  it('replaces a non-object encountered mid-path so the path can complete', () => {
    const dna: Record<string, unknown> = { project: 'scalar' };
    setDnaValue(dna, 'project.name', 'WingFoil');
    expect(dna).toEqual({ project: { name: 'WingFoil' } });
  });

  it('applies the tech_stack -> stacks first-segment alias (symmetric with `dna show`, spec-002)', () => {
    const dna: Record<string, unknown> = { stacks: { technologies: [] } };
    setDnaValue(dna, 'tech_stack.language', 'python');
    expect(dna).toEqual({ stacks: { technologies: [], language: 'python' } });
    expect((dna as Record<string, unknown>).tech_stack).toBeUndefined();
  });

  it('DNA_KEY_ALIASES is the single source of the tech_stack -> stacks alias', () => {
    expect(DNA_KEY_ALIASES.tech_stack).toBe('stacks');
  });
});
