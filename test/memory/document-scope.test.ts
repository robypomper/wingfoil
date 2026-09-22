/**
 * task-088-fix-gated-verbs-commit-only-the-status-change / `bug-076` — the two pure document
 * comparisons the transition write path is built on, exercised on text rather than through git.
 *
 * - {@link verifyDocumentEdit} answers "is this edit within the operation's scope" — the frontmatter
 *   rules of `verifyFrontmatterEdit` plus the body, gated by `DocumentScope`. The body half is what
 *   `bug-076` showed nothing was checking: an approval carried a paragraph and every recorded fact
 *   about the commit stayed true.
 * - {@link describeDocumentChanges} answers "so what exactly is in the way" — the wording a user acts
 *   on when a gated verb refuses.
 *
 * `spec-010-memory-frontmatter-schema` § "Field-write ownership" is the contract both serve:
 * `memory.approve` owns `status` alone, `memory.reject` owns `status` and `rejection_reason`,
 * `memory.submit` owns "`title`, all other required type-specific fields, `status` … body content".
 *
 * Deterministic (REQ-SYS-07): fixed inputs, no git, no clock, no filesystem.
 */
import { describeDocumentChanges, verifyDocumentEdit } from '../../src/memory';

function doc(fields: { status: string; extra?: string; body?: string }): string {
  return `---
id: "task-101"
type: task
title: "A task"
status: ${fields.status}${fields.extra === undefined ? '' : `\n${fields.extra}`}
---

${fields.body ?? 'Real content.'}
`;
}

describe('verifyDocumentEdit — how much of a document an operation may change', () => {
  it('accepts an edit that moves only the declared field', () => {
    expect(verifyDocumentEdit(doc({ status: 'pending' }), doc({ status: 'backlog' }), { status: 'backlog' }, 'declared-fields-only')).toEqual([]);
  });

  it('under `declared-fields-only` a changed BODY is a problem — the half `verifyFrontmatterEdit` could never see', () => {
    const before = doc({ status: 'pending' });
    const after = doc({ status: 'backlog', body: 'INJECTED BODY PARAGRAPH.' });

    expect(verifyDocumentEdit(before, after, { status: 'backlog' }, 'declared-fields-only')).toEqual([
      'the body changed although this operation does not own it',
    ]);
  });

  it('under `declared-fields-only` an unowned frontmatter field is a problem, and both problems are reported together', () => {
    const before = doc({ status: 'pending' });
    const after = doc({ status: 'backlog', extra: 'tags: ["INJECTED"]', body: 'INJECTED BODY PARAGRAPH.' });

    expect(verifyDocumentEdit(before, after, { status: 'backlog' }, 'declared-fields-only')).toEqual([
      "field 'tags' changed although this operation does not own it",
      'the body changed although this operation does not own it',
    ]);
  });

  it('under `carries-content` the same edit is in scope — `memory submit` fills content AND moves state', () => {
    const before = doc({ status: 'draft' });
    const after = doc({ status: 'pending', extra: 'tags: ["written by the author"]', body: 'The content the author just wrote.' });

    expect(verifyDocumentEdit(before, after, { status: 'pending' }, 'carries-content')).toEqual([]);
  });

  it('under `carries-content` the DECLARED fields are still enforced — the scope widens what may change, never what must', () => {
    const before = doc({ status: 'draft' });
    const after = doc({ status: 'pending', extra: 'rejection_reason: "stale"' });

    expect(verifyDocumentEdit(before, after, { status: 'pending', rejection_reason: undefined }, 'carries-content')).toEqual([
      "field 'rejection_reason' is still present, expected it removed",
    ]);
  });

  it('reports an unparseable rendering instead of comparing it, under either scope', () => {
    const broken = '# no frontmatter block at all\n';

    expect(verifyDocumentEdit(doc({ status: 'pending' }), broken, { status: 'backlog' }, 'declared-fields-only')).toEqual([
      'rendered document has no frontmatter block',
    ]);
    expect(verifyDocumentEdit(doc({ status: 'pending' }), broken, { status: 'backlog' }, 'carries-content')).toEqual([
      'rendered document has no frontmatter block',
    ]);
  });

  it('treats an unparseable BEFORE as empty rather than throwing — every field then reads as newly set', () => {
    const problems = verifyDocumentEdit('# not a document\n', doc({ status: 'backlog' }), { status: 'backlog' }, 'declared-fields-only');

    expect(problems).toContain("field 'id' changed although this operation does not own it");
    expect(problems).toContain('the body changed although this operation does not own it');
  });
});

describe('describeDocumentChanges — naming what is in the way', () => {
  it('says nothing about an identical document', () => {
    expect(describeDocumentChanges(doc({ status: 'pending' }), doc({ status: 'pending' }))).toEqual([]);
  });

  it('names an untracked document as such rather than diffing it against nothing', () => {
    expect(describeDocumentChanges(null, doc({ status: 'pending' }))).toEqual(['the document is not tracked at HEAD']);
  });

  it('names each changed frontmatter field, sorted, then the body (REQ-SYS-07)', () => {
    const before = doc({ status: 'pending' });
    const after = doc({ status: 'backlog', extra: 'tags: ["INJECTED"]', body: 'INJECTED BODY PARAGRAPH.' });

    expect(describeDocumentChanges(before, after)).toEqual([
      "frontmatter field 'status'",
      "frontmatter field 'tags'",
      'the body',
    ]);
  });

  it('names a frontmatter change that moves no parsed value — git will still commit it', () => {
    const before = doc({ status: 'pending' });
    const after = before.replace('status: pending', 'status: pending   # touched by hand');

    expect(describeDocumentChanges(before, after)).toEqual(['the frontmatter text (comments or formatting)']);
  });

  it('falls back to naming the file when the difference is in neither the parsed frontmatter nor the body', () => {
    // Identical frontmatter text and identical body; only the delimiters' line endings differ, which
    // `splitFrontmatter` consumes. A real difference, and one no finer description can locate.
    const lf = '---\nid: "task-101"\n---\nbody\n';
    const crlf = '---\r\nid: "task-101"\r\n---\r\nbody\n';

    expect(describeDocumentChanges(lf, crlf)).toEqual(['the file content']);
  });

  it('describes a document with no frontmatter block at all as a body change', () => {
    expect(describeDocumentChanges('plain text\n', 'plain text, edited\n')).toEqual(['the body']);
  });
});
