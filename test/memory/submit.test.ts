/**
 * Pure helpers behind `wingfoil memory submit` (P1.6, task-045-memory-submit), per
 * `spec-010-memory-frontmatter-schema`: "Validation rules" (title and every
 * `template.frontmatter.required` field non-empty once `status` leaves `draft`) and "Field-write
 * ownership" (`memory.submit` sets `status` and clears `rejection_reason` by removing the key).
 */
import { missingRequiredFields, renderSubmitDocument } from '../../src/memory/submit';

describe('missingRequiredFields', () => {
  it('returns [] when title and every required field are non-empty', () => {
    expect(missingRequiredFields({ title: 'T', release: 'v0.2' }, ['title', 'release'])).toEqual([]);
  });

  it('treats absent, null, blank strings and empty lists as missing; reports in declared order', () => {
    expect(
      missingRequiredFields({ title: 'T', a: '  ', b: null, d: [], e: ['x'], f: 0 }, ['e', 'd', 'c', 'b', 'a', 'f']),
    ).toEqual(['d', 'c', 'b', 'a']);
  });

  it('always requires `title`, first, even when the type does not list it (spec-010)', () => {
    expect(missingRequiredFields({ release: 'v1' }, ['release'])).toEqual(['title']);
    expect(missingRequiredFields({}, ['release', 'title'])).toEqual(['title', 'release']);
  });

  it('does not report a field twice', () => {
    expect(missingRequiredFields({}, ['title', 'title'])).toEqual(['title']);
  });
});

describe('renderSubmitDocument', () => {
  it('moves status and removes rejection_reason, leaving the rest byte-identical', () => {
    const doc = '---\nid: t\ntitle: "T"\nstatus: draft   # auto\nrejection_reason: "fix it"\n---\nbody\n';
    expect(renderSubmitDocument(doc, 'pending')).toBe('---\nid: t\ntitle: "T"\nstatus: pending   # auto\n---\nbody\n');
  });

  it('without a rejection_reason, only the status line changes', () => {
    const doc = '---\nid: t\nstatus: in-progress\n---\nbody\n';
    expect(renderSubmitDocument(doc, 'in-review')).toBe('---\nid: t\nstatus: in-review\n---\nbody\n');
  });
});
