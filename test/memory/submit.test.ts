/**
 * Pure helpers behind `wingfoil memory submit` (P1.6, task-045-memory-submit), per
 * `spec-010-memory-frontmatter-schema`: "Validation rules" (title and every
 * `template.frontmatter.required` field non-empty once `status` leaves `draft`) and "Field-write
 * ownership" (`memory.submit` sets `status` and clears `rejection_reason` by removing the key).
 */
import { missingRequiredFields, notApplicableRefusals, renderSubmitDocument } from '../../src/memory/submit';

describe('missingRequiredFields', () => {
  it('returns [] when title and every required field are non-empty', () => {
    expect(missingRequiredFields({ title: 'T', release: 'v0.2' }, ['title', 'release'])).toEqual([]);
  });

  it('treats absent, null, blank strings and (on a field no scaffold declares a list) empty lists as missing; reports in declared order', () => {
    expect(
      missingRequiredFields({ title: 'T', a: '  ', b: null, d: [], e: ['x'], f: 0 }, ['e', 'd', 'c', 'b', 'a', 'f']),
    ).toEqual(['d', 'c', 'b', 'a']);
  });

  it('re-review ruling 2: on a field not in `lists`, any list or mapping is missing; a date is a value', () => {
    expect(missingRequiredFields({ title: 'T', kind: {} }, ['kind'], [])).toEqual(['kind']);
    expect(missingRequiredFields({ title: 'T', kind: [''] }, ['kind'], [])).toEqual(['kind']);
    expect(missingRequiredFields({ title: 'T', kind: ['feature'] }, ['kind'], [])).toEqual(['kind']);
    expect(missingRequiredFields({ title: { a: 1 } }, [])).toEqual(['title']);
    expect(missingRequiredFields({ title: 'T', renews: new Date('2026-10-01') }, ['renews'])).toEqual([]);
  });

  it('re-review ruling 1: on a field in `lists`, any list is filled ([] and [""] included); a mapping is not', () => {
    expect(missingRequiredFields({ title: 'T', features: [''] }, ['features'], ['features'])).toEqual([]);
    expect(missingRequiredFields({ title: 'T', features: {} }, ['features'], ['features'])).toEqual(['features']);
  });

  it('bug-147 (task-168): an explicit empty list is filled on a field the type declares in `lists`; an empty value (null) is not', () => {
    expect(missingRequiredFields({ title: 'T', features: [] }, ['features'], ['features'])).toEqual([]);
    expect(missingRequiredFields({ title: 'T', features: null }, ['features'], ['features'])).toEqual(['features']);
  });

  it('task-168 review ruling 1: `[]` stays missing on every field the scaffold does not declare a list — title always', () => {
    expect(missingRequiredFields({ title: [], release: [], kind: [], features: [] }, ['release', 'kind', 'features'])).toEqual([
      'title',
      'release',
      'kind',
      'features',
    ]);
    expect(missingRequiredFields({ title: [], kind: [], features: [] }, ['kind', 'features'], ['title', 'features'])).toEqual([
      'title',
      'kind',
    ]);
  });

  it('always requires `title`, first, even when the type does not list it (spec-010)', () => {
    expect(missingRequiredFields({ release: 'v1' }, ['release'])).toEqual(['title']);
    expect(missingRequiredFields({}, ['release', 'title'])).toEqual(['title', 'release']);
  });

  it('does not report a field twice', () => {
    expect(missingRequiredFields({}, ['title', 'title'])).toEqual(['title']);
  });
});

/**
 * task-168 — `dl-124` Q1 (A), Q2 (a), Q3 (ii): a required field the type declares in
 * `template.frontmatter.not_applicable_allowed` may hold `"n/a — <reason>"`, and only such a field.
 */
describe('not-applicable values (dl-124, task-168)', () => {
  const required = ['pillar', 'requirements', 'kind'];
  const allowed = ['pillar', 'requirements'];

  it('a declared field holding "n/a — <reason>" is present', () => {
    expect(missingRequiredFields({ title: 'T', pillar: 'n/a — patch release', requirements: 'r', kind: 'patch' }, required)).toEqual([]);
    expect(notApplicableRefusals({ title: 'T', pillar: 'n/a — patch release', requirements: 'r', kind: 'patch' }, required, allowed)).toEqual([]);
  });

  it('task-168 review fix 3: case and spacing around the em dash do not matter', () => {
    for (const value of ['N/A — patch release', 'n/a —  none', 'n/a—x', '  n/a   —   x  ', 'N/a — x']) {
      expect(notApplicableRefusals({ pillar: value }, required, allowed)).toEqual([]);
    }
  });

  it('task-168 review fix 3: any separator other than the em dash is refused as the wrong form, not as a missing reason', () => {
    for (const value of ['n/a - x', 'n/a: x', 'n/a x', 'n/a – x']) {
      expect(notApplicableRefusals({ pillar: value }, required, allowed)).toEqual([{ field: 'pillar', problem: 'bad-form' }]);
    }
  });

  it('bare `n/a`, or `n/a —` with a blank reason, in a declared field is refused as needing a reason', () => {
    expect(notApplicableRefusals({ pillar: 'n/a', requirements: 'n/a —   ' }, required, allowed)).toEqual([
      { field: 'pillar', problem: 'no-reason' },
      { field: 'requirements', problem: 'no-reason' },
    ]);
  });

  it('an undeclared required field holding a not-applicable value is refused, whatever its form', () => {
    expect(notApplicableRefusals({ pillar: 'P1', requirements: 'r', kind: 'n/a — patch release' }, required, allowed)).toEqual([
      { field: 'kind', problem: 'undeclared' },
    ]);
    expect(notApplicableRefusals({ kind: 'N/A' }, required, allowed)).toEqual([{ field: 'kind', problem: 'undeclared' }]);
    expect(notApplicableRefusals({ kind: 'n/a — x' }, required)).toEqual([{ field: 'kind', problem: 'undeclared' }]);
  });

  it('`title` can never be not-applicable, even when listed (spec-010 requires it of every type)', () => {
    expect(notApplicableRefusals({ title: 'n/a — none' }, [], ['title'])).toEqual([{ field: 'title', problem: 'undeclared' }]);
  });

  it('ordinary values that merely contain n/a are data, not a not-applicable value', () => {
    expect(notApplicableRefusals({ pillar: 'P1 (n/a for docs)', kind: 'n/available' }, required, allowed)).toEqual([]);
  });

  it('only required fields are checked; an optional field may hold anything', () => {
    expect(notApplicableRefusals({ priority: 'n/a' }, required, allowed)).toEqual([]);
  });

  it('a refused not-applicable value is not reported as missing too', () => {
    expect(missingRequiredFields({ title: 'T', pillar: 'n/a', requirements: 'r', kind: 'n/a — x' }, required)).toEqual([]);
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
