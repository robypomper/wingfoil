/**
 * `formatMemoryCommitMessage` (task-045-memory-submit) — the single formatter every Memory
 * state-transition verb emits its commit through. Pins the subject shape
 * `spec-004-mcp-surface-contract` §4.3 fixes (`wf({type}): {verb} {id}`), the optional `[from → to]`
 * bracket and `Approver:`/`Reason:` body the approval-gate verbs add (read back by
 * `src/memory/audit.ts`), and — as a round-trip — that `src/memory/audit.ts`'s own parsers read the
 * formatted body back unchanged, so a verb can never emit a message `memory history` (P1.10) misreads.
 */
import { formatMemoryCommitMessage } from '../../src/memory/commit-message';
import { parseApprovalMetadata, parseCommitReason } from '../../src/memory/audit';

describe('formatMemoryCommitMessage', () => {
  it('submit: subject only, no bracket, no body (spec-004 §4.3)', () => {
    expect(formatMemoryCommitMessage({ type: 'task', op: 'submit', ids: ['task-101'] })).toBe('wf(task): submit task-101');
  });

  it('joins several ids of one type with ", " in the given order', () => {
    expect(formatMemoryCommitMessage({ type: 'bug', op: 'submit', ids: ['bug-2', 'bug-1'] })).toBe('wf(bug): submit bug-2, bug-1');
  });

  it('appends the `[from → to]` bracket (U+2192) when a transition is given', () => {
    expect(
      formatMemoryCommitMessage({ type: 'task', op: 'approve', ids: ['task-1'], transition: { from: 'pending', to: 'backlog' } }),
    ).toBe('wf(task): approve task-1 [pending → backlog]');
  });

  it('adds an `Approver:` / `Reason:` body separated by a blank line, which the audit parsers read back', () => {
    const message = formatMemoryCommitMessage({
      type: 'task',
      op: 'approve',
      ids: ['task-1'],
      transition: { from: 'pending', to: 'backlog' },
      approver: { name: 'Ada Lovelace', email: 'ada@example.invalid', role: 'approver' },
      reason: 'looks good',
    });
    expect(message).toBe(
      'wf(task): approve task-1 [pending → backlog]\n\nApprover: Ada Lovelace <ada@example.invalid> (approver)\nReason: looks good',
    );
    const body = message.split('\n\n')[1] ?? '';
    expect(parseApprovalMetadata(body)).toEqual({
      approverName: 'Ada Lovelace',
      approverEmail: 'ada@example.invalid',
      approverRole: 'approver',
      reason: 'looks good',
    });
    expect(parseCommitReason(body)).toBe('looks good');
  });

  it('a reason without an approver (deprecate) yields a `Reason:`-only body', () => {
    expect(
      formatMemoryCommitMessage({ type: 'adr', op: 'deprecate', ids: ['adr-1'], transition: { from: 'accepted', to: 'deprecated' }, reason: 'superseded by adr-2' }),
    ).toBe('wf(adr): deprecate adr-1 [accepted → deprecated]\n\nReason: superseded by adr-2');
  });

  it('refuses an empty id list (a transition commit always names what it moved)', () => {
    expect(() => formatMemoryCommitMessage({ type: 'task', op: 'submit', ids: [] })).toThrow('at least one id');
  });
});
