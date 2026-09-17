/**
 * The one commit-message formatter for Memory state-transition verbs (task-045-memory-submit).
 *
 * Every verb — `submit` today, `approve`/`reject`/`deprecate` next — produces exactly one commit whose
 * subject is `wf({type}): {verb} {id1}, {id2}` (`spec-004-mcp-surface-contract` §4.3), optionally
 * followed by a ` [from → to]` bracket and an `Approver:` / `Reason:` body for the verbs whose
 * evidence rules require them (P1.7/P1.8, REQ-SEC-04). Those are exactly the shapes
 * `./audit.ts` reads back for `wingfoil memory history` (P1.10): `OPERATION_RE` on the subject,
 * `BRACKET_RE` on the bracket, `parseApprovalMetadata`/`parseCommitReason` on the body. Building the
 * message in one place is what keeps writer and reader from drifting apart.
 *
 * Pure and deterministic (REQ-SYS-07): the output is a function of the input alone; ids keep the order
 * the caller gives.
 */
import type { TransitionOp } from './state-machine';

/** The arrow used in `[from → to]` subject brackets (U+2192), as `./audit.ts`'s `BRACKET_RE` expects. */
const ARROW = '→';

/** The identity recorded on an approval-gate commit's `Approver:` line. */
export interface CommitApprover {
  readonly name: string;
  readonly email: string;
  readonly role: string;
}

/** Everything one Memory transition commit message is built from. */
export interface MemoryCommitMessageInput {
  /** The Memory element type all `ids` belong to — one commit is scoped to one type. */
  readonly type: string;
  /** The verb, which is also the subject's operation word. `add` is included for completeness. */
  readonly op: TransitionOp | 'add';
  /** The element ids moved by this commit, in the order they are listed in the subject. */
  readonly ids: readonly string[];
  /** When given, appended to the subject as ` [from → to]`. Omitted for `add`/`submit` (spec-004 §4.3). */
  readonly transition?: { readonly from: string; readonly to: string };
  /** When given, an `Approver: Name <email> (role)` body line. */
  readonly approver?: CommitApprover;
  /** When given, a `Reason: …` body line. */
  readonly reason?: string;
}

/**
 * Format a Memory transition commit message: the subject, then — only when an approver or reason is
 * given — a blank line and the `Approver:` / `Reason:` lines in that order.
 *
 * @throws `Error` when `ids` is empty: a transition commit always names what it moved.
 */
export function formatMemoryCommitMessage(input: MemoryCommitMessageInput): string {
  if (input.ids.length === 0) {
    throw new Error('a Memory transition commit must name at least one id');
  }
  const bracket = input.transition ? ` [${input.transition.from} ${ARROW} ${input.transition.to}]` : '';
  const subject = `wf(${input.type}): ${input.op} ${input.ids.join(', ')}${bracket}`;

  const body: string[] = [];
  if (input.approver) {
    body.push(`Approver: ${input.approver.name} <${input.approver.email}> (${input.approver.role})`);
  }
  if (input.reason !== undefined) {
    body.push(`Reason: ${input.reason}`);
  }
  return body.length === 0 ? subject : `${subject}\n\n${body.join('\n')}`;
}
