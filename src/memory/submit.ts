/**
 * Pure helpers behind `wingfoil memory submit` (P1.6, task-045-memory-submit), kept out of the
 * `CoreResult`-wrapped operation in `src/core` the same way `./add.ts` serves `memory add`.
 *
 * Both implement `spec-010-memory-frontmatter-schema`:
 * - "Validation rules": `title`, and every field in the type's `template.frontmatter.required`, must
 *   be non-empty once `status` is anything other than `draft` — so a submit checks them first.
 * - "Field-write ownership": `memory.submit` moves `status` to the next state and clears
 *   `rejection_reason` by removing the key (it mirrors only the most recent reject).
 *
 * Deterministic (REQ-SYS-07): results follow the declared field order, never object-key order.
 */
import { removeFrontmatterField, setFrontmatterField } from './frontmatter-edit';

/** The frontmatter key `memory.reject` sets and `memory.submit` removes (spec-010). */
export const REJECTION_REASON_FIELD = 'rejection_reason';

/** Absent, `null`, a blank string or an empty list count as "not filled in". */
function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * The fields that must be filled before a submit but are not: `title` first (spec-010 requires it of
 * every type), then each of `required` in its declared order, without duplicates. `[]` means the
 * document may be submitted.
 */
export function missingRequiredFields(frontmatter: Readonly<Record<string, unknown>>, required: readonly string[]): string[] {
  const fields = [...new Set(['title', ...required])];
  return fields.filter((field) => isEmptyValue(frontmatter[field]));
}

/** The submitted document: `status` set to `target` and `rejection_reason` removed; nothing else changes. */
export function renderSubmitDocument(content: string, target: string): string {
  return removeFrontmatterField(setFrontmatterField(content, 'status', target), REJECTION_REASON_FIELD);
}
