/**
 * The two refusals that are `memory amend`'s own (task-127, `dl-108` A1 (a) and A3). The rest of the
 * verb — usage checks, git identity, locating the document, approval authority, the one-file commit —
 * is shared with the transition verbs; see `memoryAmendFn` in `./index.ts`.
 *
 * An amendment is the one Memory operation whose content comes from the author rather than from the
 * verb: the author edits the document, then `amend` records that edit under an approver's name. So
 * the questions are about the edit — is there one, is the type open to one, and does it stay inside
 * what an amendment owns (`spec-010` § Field-write ownership: the body and every frontmatter field
 * except `status`, `id` and `type`).
 */
import { describeDocumentChanges, type MemoryYaml } from '../memory';
import { readPathAtRev } from '../storage';

import { coreErr, coreOk, type CoreResult } from './types';

/**
 * The frontmatter fields an amendment may not change, in the order a refusal names them.
 * `status` belongs to the transition verbs. `id` and `type` locate the element and select its path
 * and machine: changing either is a new element, not a correction to this one.
 */
export const AMEND_RESERVED_FIELDS: readonly string[] = ['id', 'status', 'type'];

/**
 * Refuse a type whose committed `memory.yaml` entry does not declare `amendable: true` (`dl-108` A3,
 * `spec-001`). `memoryYaml` is the copy committed at `HEAD` that `prepareMemoryTransition` resolved
 * (`command-baseline`): an uncommitted `amendable: true` cannot open a type to amendment.
 */
export function requireAmendableType(memoryYaml: MemoryYaml, type: string): CoreResult<undefined> {
  const declared = memoryYaml.types[type]?.amendable;
  if (declared === true) return coreOk(undefined);
  const why = declared === false ? 'declares amendable: false' : 'does not declare amendable: true';
  return coreErr({ code: 'VALIDATION', message: `type '${type}' is not amendable: its memory.yaml entry ${why}` });
}

/**
 * Refuse a working-tree document that is not an amendment of its committed self: no commit holds it,
 * it carries no change, or the change touches a field in {@link AMEND_RESERVED_FIELDS}. `content` is
 * the document as read from the working tree, which is what the commit will record.
 *
 * The comparison is against `HEAD`, the committed baseline. That is also what keeps the subject's
 * `[s → s]` bracket true: `status` is the same on both sides, so the state the bracket names is the
 * committed one.
 */
export function requireAmendableEdit(root: string, id: string, path: string, content: string): CoreResult<undefined> {
  const committed = readPathAtRev(root, 'HEAD', path);
  if (committed === null) {
    return coreErr({
      code: 'VALIDATION',
      message:
        `nothing to amend: ${path} is not committed at HEAD — an amendment corrects a recorded document; ` +
        'a new one is recorded by memory add and memory submit',
    });
  }
  if (committed === content) {
    return coreErr({ code: 'VALIDATION', message: `nothing to amend: ${path} carries no uncommitted change` });
  }
  const reserved = new Set(AMEND_RESERVED_FIELDS.map((field) => `frontmatter field '${field}'`));
  const touched = describeDocumentChanges(committed, content).filter((change) => reserved.has(change));
  if (touched.length > 0) {
    return coreErr({
      code: 'VALIDATION',
      message:
        `refusing to amend ${id}: the working-tree edit changes ${touched.join(', ')}, which an amendment does not ` +
        'own — a state change is a transition verb\'s (submit, approve, reject, deprecate), and a new id or type is a ' +
        'new element; undo that change, then retry',
    });
  }
  return coreOk(undefined);
}
