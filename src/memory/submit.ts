/**
 * Pure helpers behind `wingfoil memory submit` (P1.6, task-045-memory-submit), kept out of the
 * `CoreResult`-wrapped operation in `src/core` the same way `./add.ts` serves `memory add`.
 *
 * Both implement `spec-010-memory-frontmatter-schema`:
 * - "Validation rules": `title`, and every field in the type's `template.frontmatter.required`, must
 *   be non-empty once `status` is anything other than `draft` — so a submit checks them first. A field
 *   the type lists in `template.frontmatter.not_applicable_allowed` may instead hold
 *   `"n/a — <reason>"` (`dl-124`, task-168); no other field may hold a not-applicable value.
 * - "Field-write ownership": `memory.submit` moves `status` to the next state and clears
 *   `rejection_reason` by removing the key (it mirrors only the most recent reject).
 *
 * Deterministic (REQ-SYS-07): results follow the declared field order, never object-key order.
 */
import { removeFrontmatterField, setFrontmatterField } from './frontmatter-edit';

/** The frontmatter key `memory.reject` sets and `memory.submit` removes (spec-010). */
export const REJECTION_REASON_FIELD = 'rejection_reason';

/**
 * Absent, `null` (an empty YAML value, `features:`) or a blank string count as "not filled in". An
 * explicit empty list (`features: []`) is filled: the author declared "none" (`bug-147`, approver
 * ruling 2026-10-02 at `task-168`). A scaffold that must not pass untouched leaves a list field empty
 * (`features:`) rather than `[]`.
 */
function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  return false;
}

/**
 * A value that says "this field does not apply" (`dl-124` Q1 (A)): a string whose text starts with
 * `n/a`, in any case, not followed by a letter, digit or `_` — so `n/a`, `N/A` and
 * `n/a — patch release` are, while `n/available` or `P1 (n/a for docs)` are ordinary data.
 */
const NOT_APPLICABLE_SHAPE = /^n\/a(?![\w])/i;

/** The one accepted form (`dl-124` Q3 (ii)): `n/a`, an em dash, then a non-blank reason. */
const NOT_APPLICABLE_WITH_REASON = /^n\/a — \S/;

function isNotApplicableShaped(value: unknown): value is string {
  return typeof value === 'string' && NOT_APPLICABLE_SHAPE.test(value.trim());
}

/** Why a required field's not-applicable value is refused: the type does not declare it, or it gives no reason. */
export type NotApplicableProblem = 'undeclared' | 'no-reason';

/** One refused not-applicable value, by field. */
export interface NotApplicableRefusal {
  readonly field: string;
  readonly problem: NotApplicableProblem;
}

/** `title` first (spec-010 requires it of every type), then `required` in declared order, deduplicated. */
function requiredFieldOrder(required: readonly string[]): string[] {
  return [...new Set(['title', ...required])];
}

/**
 * The fields that must be filled before a submit but are not: `title` first (spec-010 requires it of
 * every type), then each of `required` in its declared order, without duplicates. `[]` means no field
 * is missing. A not-applicable value counts as present here — whether it is *accepted* is
 * {@link notApplicableRefusals}'s question, so a field is reported by one of the two, never both.
 */
export function missingRequiredFields(frontmatter: Readonly<Record<string, unknown>>, required: readonly string[]): string[] {
  return requiredFieldOrder(required).filter((field) => isEmptyValue(frontmatter[field]));
}

/**
 * The required fields holding a not-applicable value that may not stand (`dl-124`, task-168), in the
 * same order as {@link missingRequiredFields}:
 * - `undeclared` — the type's `template.frontmatter.not_applicable_allowed` does not list the field
 *   (`title` never counts as listed: spec-010 requires it of every type);
 * - `no-reason` — the field is listed, but the value is not `"n/a — <reason>"` with a non-blank reason.
 *
 * Optional fields are not checked: what they hold is the type's own business.
 */
export function notApplicableRefusals(
  frontmatter: Readonly<Record<string, unknown>>,
  required: readonly string[],
  notApplicableAllowed: readonly string[] = [],
): NotApplicableRefusal[] {
  const allowed = new Set(notApplicableAllowed.filter((field) => field !== 'title'));
  const refusals: NotApplicableRefusal[] = [];
  for (const field of requiredFieldOrder(required)) {
    const value = frontmatter[field];
    if (!isNotApplicableShaped(value)) continue;
    if (!allowed.has(field)) refusals.push({ field, problem: 'undeclared' });
    else if (!NOT_APPLICABLE_WITH_REASON.test(value.trim())) refusals.push({ field, problem: 'no-reason' });
  }
  return refusals;
}

/** The submitted document: `status` set to `target` and `rejection_reason` removed; nothing else changes. */
export function renderSubmitDocument(content: string, target: string): string {
  return removeFrontmatterField(setFrontmatterField(content, 'status', target), REJECTION_REASON_FIELD);
}
