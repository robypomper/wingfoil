/**
 * The required-field check two verbs share (`spec-010` § Validation rules): `memory submit` before
 * leaving the initial state, and `memory amend` on a document already past it (task-127 review F1).
 * One function, so the two can never disagree about what "filled" means.
 *
 * A field is refused when it is missing (absent, `null`, blank, or an empty list), or when it holds a
 * not-applicable value that may not stand (`dl-124`, task-168): the type does not list the field in
 * `template.frontmatter.not_applicable_allowed`, or the value is not `"n/a — <reason>"`. A required
 * field the type does not list — `task.kind` in this repository — therefore cannot be skipped by
 * writing `n/a` in it.
 */
import { missingRequiredFields, notApplicableRefusals, type MemoryYaml, type NotApplicableRefusal } from '../memory';

import { coreErr, coreOk, type CoreResult } from './types';

function describeRefusal(type: string, refusal: NotApplicableRefusal): string {
  return refusal.problem === 'no-reason'
    ? `${refusal.field} needs a reason, written "n/a — <reason>"`
    : `${refusal.field} does not accept one (type '${type}' does not list it in template.frontmatter.not_applicable_allowed)`;
}

/**
 * `VALIDATION` (exit 1) naming every refused field, or `ok`. The message is
 * `missing required field on <verb>: a, b`, then — joined by `; ` when both apply —
 * `not-applicable value on <verb>: <field> …`, each clause in declared field order.
 */
export function requireRequiredFields(
  memoryYaml: MemoryYaml,
  type: string,
  frontmatter: Readonly<Record<string, unknown>>,
  verb: 'submit' | 'amend',
): CoreResult<undefined> {
  const template = memoryYaml.types[type]?.template?.frontmatter;
  const required = template?.required ?? [];
  const missing = missingRequiredFields(frontmatter, required);
  const refused = notApplicableRefusals(frontmatter, required, template?.not_applicable_allowed ?? []);
  const clauses: string[] = [];
  if (missing.length > 0) clauses.push(`missing required field on ${verb}: ${missing.join(', ')}`);
  if (refused.length > 0) {
    clauses.push(`not-applicable value on ${verb}: ${refused.map((refusal) => describeRefusal(type, refusal)).join(', ')}`);
  }
  if (clauses.length === 0) return coreOk(undefined);
  return coreErr({ code: 'VALIDATION', message: clauses.join('; ') });
}
