/**
 * The shared skeleton of every Memory state-transition verb (task-045-memory-submit; reused by
 * `memory approve`/`reject`/`deprecate`, task-046/047/048).
 *
 * A transition verb always does the same two things around its own verb-specific rules:
 *
 * 1. {@link prepareMemoryTransition} — find the document by its bare id (spec-008-cli-grammar §7), read
 *    its declared `type` and current `status`, and resolve the legal target for the verb. Every expected
 *    refusal is returned as a `CoreResult.error` (exit `1`), **before anything is written**, so "the
 *    state is unchanged" (P1.6 sc.2, REQ-STATE-01) holds by construction.
 * 2. {@link commitMemoryTransition} — write the new bytes and turn them into exactly one commit scoped
 *    to that one document.
 *
 * What happens in between (required-field checks, which fields change, the commit message) is the
 * verb's own business; see `memorySubmitFn` in `./index.ts`.
 */
import { join } from 'path';

import {
  E_INVALID_TRANSITION,
  findMemoryDocumentById,
  resolveStateMachine,
  resolveTypeTransition,
  validateFrontmatterState,
} from '../memory';
import type { MemoryYaml, StateMachine, TransitionOp } from '../memory';
import { commitPaths, readDocument, writeDocument } from '../storage';
import { ValidationError } from '../validation';

import { coreErr, coreOk, type CoreResult } from './types';

/** A document located and cleared for one transition — everything the verb needs to finish it. */
export interface PreparedMemoryTransition {
  readonly id: string;
  /** The document's declared frontmatter `type` (a registered `memory.yaml` type). */
  readonly type: string;
  /** Root-relative POSIX path of the document. */
  readonly path: string;
  /** The document's parsed frontmatter as read (not schema-validated). */
  readonly frontmatter: Readonly<Record<string, unknown>>;
  /** The full current file content, the base for the verb's edit. */
  readonly content: string;
  readonly from: string;
  readonly to: string;
}

/**
 * Locate document `id` and resolve verb `op` on it. Refusals, all returned (never thrown) and all
 * exit `1`:
 *
 * - no document carries that frontmatter `id` → `NOT_FOUND` `document not found: <id>` (P1.6 sc.3);
 * - its `type` is not registered → `NOT_FOUND` with `memory add`'s unknown-type message;
 * - no state machine applies to the type (REQ-STATE-08: neither `states` nor `defaults.states`) →
 *   `VALIDATION`;
 * - its `status` is not a state of the type → `VALIDATION` `invalid state '<s>' for type '<t>'`
 *   (task-036's `validateFrontmatterState`);
 * - the verb is illegal from that state → `INVALID_TRANSITION` with the `dl-032` contract message
 *   (`resolveTypeTransition`), the engine's explanation in `details.issues[0].detail`.
 */
export function prepareMemoryTransition(
  root: string,
  memoryYaml: MemoryYaml,
  id: string,
  op: TransitionOp,
): CoreResult<PreparedMemoryTransition> {
  const found = findMemoryDocumentById(root, memoryYaml, id);
  if (!found) {
    return coreErr({ code: 'NOT_FOUND', message: `document not found: ${id}` });
  }

  const type = found.frontmatter.type;
  if (typeof type !== 'string' || memoryYaml.types[type] === undefined) {
    return coreErr({ code: 'NOT_FOUND', message: `unknown memory type '${String(type)}' (not defined in memory.yaml)` });
  }

  let machine: StateMachine;
  try {
    machine = resolveStateMachine(memoryYaml, type);
  } catch (error) {
    // The type is registered, so this is REQ-STATE-08's "neither `states` nor `defaults.states`".
    return coreErr({ code: 'VALIDATION', message: (error as Error).message });
  }

  const status = found.frontmatter.status;
  // A missing or non-string `status` is reported as an invalid state, never as the text 'undefined'.
  const from = typeof status === 'string' ? status : String(status ?? '');
  try {
    validateFrontmatterState(machine, type, from, found.path);
    const to = resolveTypeTransition(memoryYaml, type, from, op, found.path);
    const content = readDocument(join(root, found.path));
    return coreOk({ id, type, path: found.path, frontmatter: found.frontmatter, content, from, to });
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    const code = error.issues.some((issue) => issue.code === E_INVALID_TRANSITION) ? 'INVALID_TRANSITION' : 'VALIDATION';
    const message = error.issues.map((issue) => issue.message).join('; ');
    return coreErr({ code, message, details: { issues: error.issues } });
  }
}

/**
 * Write `content` over the prepared document and commit exactly that one path with `message`,
 * returning the new commit's sha (`commitPaths`, task-018). Callers must have run the git-identity
 * pre-flight (REQ-SEC-01) and every refusal check first; this step is the only write.
 */
export function commitMemoryTransition(root: string, prepared: PreparedMemoryTransition, content: string, message: string): string {
  writeDocument(join(root, prepared.path), content);
  return commitPaths(root, [prepared.path], message);
}
