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
  describeDocumentChanges,
  E_INVALID_TRANSITION,
  findMemoryDocumentById,
  resolveStateMachine,
  resolveTypeTransition,
  validateFrontmatterState,
  verifyDocumentEdit,
} from '../memory';
import type { DocumentScope, MemoryYaml, StateMachine, TransitionOp } from '../memory';
import {
  changedPathsBetween,
  commitParent,
  commitPaths,
  pathPorcelainStatus,
  readDocument,
  readPathAtRev,
  writeDocument,
} from '../storage';
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

  // Always resolves: the type is registered (checked immediately above), and since task-071
  // (`bug-030-init-memory-yaml-has-no-state-machine`) a registered type with no `states` and no
  // `defaults.states` falls back to the engine's built-in `DEFAULT_STATE_MACHINE` (REQ-STATE-08)
  // instead of throwing. The `VALIDATION` refusal that used to guard this call is therefore gone with
  // the condition it reported — the only throw left in `resolveStateMachine` is for an UNregistered
  // type, which the `NOT_FOUND` above has already returned for.
  const machine: StateMachine = resolveStateMachine(memoryYaml, type);

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
 * Refuse, before anything is written, a document that already carries modifications this transition
 * does not own (task-088, `bug-076`; AC2 option (b)).
 *
 * `commitPaths` bounds a commit by **pathspec**, not by content: `git add -- <path>` stages the whole
 * file, so an uncommitted body paragraph or an unowned frontmatter field rode into an approval under a
 * subject declaring only a state change — and the old post-condition could not see it, because it
 * compared the rendering against the same dirty file. Every recorded fact in such a commit is true
 * (`P1.7`'s approver, timestamp and reason are all present and all correct); the commit is simply
 * larger than what it claims.
 *
 * **Why refusing rather than committing only the status hunk.** Partial staging is undefined here
 * before it is difficult: there are two candidate baselines on disk (the index and the working tree)
 * and they can disagree, so "only the status hunk" does not say onto which text. Worse, the verb reads
 * `status` itself from the working tree, so a hand-edited-but-uncommitted `status` would have the
 * commit record `draft → approved` under a subject declaring `pending → approved` — the audit trail
 * asserting something that did not happen, which is the defect, not a fix for it. And the edits a
 * partial commit left behind would be invisible, deferred, and swept into whatever commits next. A
 * refusal costs the user two commands, now, on a document this function has provably not touched.
 *
 * Runs only under `declared-fields-only`; `memory submit` is entitled to carry content and is
 * therefore not guarded (see {@link DocumentScope}). The verb's own writes — `reject`'s
 * `rejection_reason`, every verb's `status` — happen *after* this check, on text it has just certified
 * equal to `HEAD`, so no verb is caught by its own guard.
 */
function requireUnmodifiedDocument(root: string, prepared: PreparedMemoryTransition): CoreResult<undefined> {
  // git's own answer to "is this modified", not a content comparison: it owns index refresh,
  // `core.autocrlf` and `.gitattributes` filters, and a re-derived answer would disagree with
  // `git status` on exactly the machines where that matters.
  const porcelain = pathPorcelainStatus(root, prepared.path);
  if (porcelain === '') return coreOk(undefined);

  const atHead = readPathAtRev(root, 'HEAD', prepared.path);
  const named = new Set<string>();
  // Both of the user's declarations are inspected — what is staged (`:0`) and what is in the working
  // tree — because they can differ, and `git add` would silently replace the former with the latter.
  for (const candidate of [readPathAtRev(root, ':0', prepared.path), prepared.content]) {
    if (candidate === null) {
      named.add('the document is not in the index');
      continue;
    }
    for (const change of describeDocumentChanges(atHead, candidate)) named.add(change);
  }
  return coreErr({
    code: 'VALIDATION',
    message:
      `refusing to commit ${prepared.path}: it carries uncommitted modifications this transition does not own ` +
      `[git status '${porcelain}'] — ${[...named].sort().join(', ')}. A state-transition commit records the ` +
      'status change and nothing else; commit or stash these changes first, then retry.',
  });
}

/**
 * Verify what the new commit **contains**, by diffing it against its own parent (task-088, AC3).
 *
 * This is the half that makes the guard above checkable rather than hopeful. Reading the file on disk
 * answers "does the document now say `approved`?" — true no matter what else rode along; `HEAD~1..HEAD`
 * is not. Same shape as `task-080`'s lockfile guard: assert the diff, not the end state. The parent is
 * `<sha>^`, or git's empty tree for a root commit, so the check is total rather than conditional.
 *
 * It is an **alarm, not a rollback**: it can only run once the commit exists, and rewriting history
 * behind the user's back is a worse failure than reporting one (`dl-035` points the same way). With
 * {@link requireUnmodifiedDocument} in place it should be unreachable, which is the point.
 */
function verifyCommittedScope(
  root: string,
  sha: string,
  path: string,
  expected: Readonly<Record<string, string | undefined>>,
  scope: DocumentScope,
): string[] {
  const parent = commitParent(root, sha);
  const problems = changedPathsBetween(root, parent, sha)
    .filter((changed) => changed !== path)
    .map((changed) => `it also contains '${changed}'`);

  const after = readPathAtRev(root, sha, path);
  if (after === null) return [...problems, `it does not contain '${path}'`];
  return [...problems, ...verifyDocumentEdit(readPathAtRev(root, parent, path) ?? '', after, expected, scope)];
}

/**
 * Write `content` over the prepared document and commit exactly that one path with `message`,
 * returning the new commit's sha (`commitPaths`, task-018; scoped to that path even when other changes
 * are staged, bug-027). Callers must have run the git-identity pre-flight (REQ-SEC-01) and every refusal
 * check first; this step is the only write.
 *
 * Three checks bound what reaches the repository, in this order — they are not redundant, they catch
 * different defects:
 *
 * 1. **The working tree is unmodified** ({@link requireUnmodifiedDocument}, `declared-fields-only`
 *    only) — catches a wrong *baseline*: content that was already on disk before the verb ran
 *    (`bug-076`).
 * 2. **The rendering is in scope** ({@link verifyDocumentEdit} against the prepared document) —
 *    catches a defect in the *editor*: `status` must be the prepared target, every field in `expected`
 *    must have its value (`undefined` = absent), and no other field and no byte of the body may have
 *    moved (the `bug-041` class). Runs under `declared-fields-only` for **every** verb, `submit`
 *    included: `renderSubmitDocument` owns `status` and `rejection_reason` alone, and the content
 *    `submit` carries is already in the prepared document it is compared against.
 * 3. **The commit contains only the declared change** ({@link verifyCommittedScope} against
 *    `HEAD~1`) — the post-condition proper, and the only one that measures the artefact of record.
 *
 * Checks 1 and 2 report a `VALIDATION` error (exit 1) with nothing written or committed. Check 3 can
 * only report; see {@link verifyCommittedScope}.
 *
 * @param scope - How much of the document this operation owns; defaults to the strict
 *   `declared-fields-only`, so a new verb is guarded unless it opts out deliberately.
 */
export function commitMemoryTransition(
  root: string,
  prepared: PreparedMemoryTransition,
  content: string,
  message: string,
  expected: Readonly<Record<string, string | undefined>> = {},
  scope: DocumentScope = 'declared-fields-only',
): CoreResult<string> {
  const owned = { status: prepared.to, ...expected };
  if (scope === 'declared-fields-only') {
    const unmodified = requireUnmodifiedDocument(root, prepared);
    if (!unmodified.ok) return unmodified;
  }

  const problems = verifyDocumentEdit(prepared.content, content, owned, 'declared-fields-only');
  if (problems.length > 0) {
    return coreErr({
      code: 'VALIDATION',
      message: `refusing to write ${prepared.path}: the rendered document failed its post-condition: ${problems.join('; ')}`,
    });
  }
  writeDocument(join(root, prepared.path), content);
  const sha = commitPaths(root, [prepared.path], message);

  const leaked = verifyCommittedScope(root, sha, prepared.path, owned, scope);
  if (leaked.length > 0) {
    return coreErr({
      code: 'VALIDATION',
      message: `commit ${sha} carries more than the change it declares: ${leaked.join('; ')}`,
    });
  }
  return coreOk(sha);
}
