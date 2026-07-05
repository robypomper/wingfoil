/**
 * task-003-git-backed-sot — frontmatter extraction. Memory element state is derived from each
 * document's frontmatter (CLAUDE.md §5 / REQ-STATE-01/-02); this is the shared primitive the state
 * snapshot (src/storage/snapshot.ts) and future Memory-pillar code use to read it, without parsing
 * the YAML into a typed object (that's the validation module's job, spec-009/task-002).
 */
import { extractFrontmatter, splitFrontmatter } from '../../src/storage/frontmatter';

describe('extractFrontmatter', () => {
  it('extracts the raw YAML text between the first pair of --- delimiters', () => {
    const doc = ['---', 'id: task-003-git-backed-sot', 'status: in-progress', '---', '', '## Body', ''].join(
      '\n',
    );
    expect(extractFrontmatter(doc)).toBe('id: task-003-git-backed-sot\nstatus: in-progress');
  });

  it('returns null when the document has no frontmatter block', () => {
    expect(extractFrontmatter('## Just a heading\n\nNo frontmatter here.\n')).toBeNull();
  });

  it('returns null when the opening delimiter is not the very first line', () => {
    expect(extractFrontmatter('\n---\nid: x\n---\n')).toBeNull();
  });

  it('handles CRLF line endings the same as LF', () => {
    const doc = '---\r\nid: x\r\nstatus: draft\r\n---\r\n\r\nBody\r\n';
    expect(extractFrontmatter(doc)).toBe('id: x\r\nstatus: draft');
  });
});

describe('splitFrontmatter', () => {
  it('splits a document into its frontmatter text and the body that follows (task-008)', () => {
    const doc = ['---', 'id: x', 'status: draft', '---', '', '## Body', 'more text', ''].join('\n');
    expect(splitFrontmatter(doc)).toEqual({
      frontmatter: 'id: x\nstatus: draft',
      body: '\n## Body\nmore text\n',
    });
  });

  it('returns the whole document as body, with frontmatter null, when there is no frontmatter block', () => {
    const doc = '## Just a heading\n\nNo frontmatter here.\n';
    expect(splitFrontmatter(doc)).toEqual({ frontmatter: null, body: doc });
  });

  it('agrees with extractFrontmatter on the frontmatter half for every case extractFrontmatter covers', () => {
    const withFrontmatter = '---\nid: x\n---\nbody\n';
    const withoutFrontmatter = 'no frontmatter\n';
    expect(splitFrontmatter(withFrontmatter).frontmatter).toBe(extractFrontmatter(withFrontmatter));
    expect(splitFrontmatter(withoutFrontmatter).frontmatter).toBe(extractFrontmatter(withoutFrontmatter));
  });
});
