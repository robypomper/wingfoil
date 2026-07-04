/**
 * task-003-git-backed-sot — frontmatter extraction. Memory element state is derived from each
 * document's frontmatter (CLAUDE.md §5 / REQ-STATE-01/-02); this is the shared primitive the state
 * snapshot (src/storage/snapshot.ts) and future Memory-pillar code use to read it, without parsing
 * the YAML into a typed object (that's the validation module's job, spec-009/task-002).
 */
import { extractFrontmatter } from '../../src/storage/frontmatter';

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
