/**
 * The pure document edit behind `wingfoil memory reject` (P1.8, task-047-memory-reject), kept out of
 * the `CoreResult`-wrapped operation in `src/core` exactly as `./submit.ts` serves `memory submit`.
 *
 * `spec-010-memory-frontmatter-schema`'s field-write ownership table makes `memory.reject` the one
 * transition verb that writes TWO frontmatter fields — "`memory.reject` changes `status` plus
 * `rejection_reason` — the one exception to 'status only' among the transition verbs". The reason is
 * stored verbatim, as the mirror of the `Reason:` trailer the commit body carries (the commit stays
 * the authoritative audit record, P1.7/REQ-SEC-04); the next `memory.submit` removes the key again
 * ({@link renderSubmitDocument}), so it always reflects only the most recent reject.
 *
 * Deterministic (REQ-SYS-07): a pure function of its arguments, with no clock, randomness or
 * object-key iteration.
 */
import { setFrontmatterField } from './frontmatter-edit';
import { REJECTION_REASON_FIELD } from './submit';

/**
 * The rejected document: `status` set to `target` (the type's `gates.<state>.reject` value, taken
 * verbatim per `spec-001-memory-yaml-schema`) and `rejection_reason` set to `reason`. Every other byte
 * — the remaining frontmatter entries, their inline comments, and the whole body — is untouched.
 *
 * `reason` is arbitrary user input (`--reason <text>`, `spec-008-cli-grammar` §2), so it is written
 * through `setFrontmatterField`'s YAML-safe serialization: quotes, colons, `#`, newlines, a leading
 * `-`, YAML-typed words such as `no`/`null` and unicode all parse back to exactly the text given.
 */
export function renderRejectDocument(content: string, target: string, reason: string): string {
  return setFrontmatterField(setFrontmatterField(content, 'status', target), REJECTION_REASON_FIELD, reason);
}
