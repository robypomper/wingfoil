/**
 * REQ-SEC-04 (task-041-mandatory-reason-on-verbs) — the shared `--reason` enforcement primitive
 * `memory approve`/`memory reject` (task-046/047, P1.7/P1.8) will call at the top of their `CoreFn`
 * bodies, exactly the way every mutating op already calls `requireGitIdentity` (task-014, REQ-SEC-01).
 *
 * Ground truth: `spec-008-cli-grammar.md` §2 (`--reason <text>` — "Required on approval-gate commands
 * (`memory approve`, `memory reject`)... Omitted where required exits `2` with `error: missing
 * required argument: --reason`"), matching `P1.7-memory-approve.feature` / `P1.8-memory-reject.feature`
 * Scenario "Error - approving/rejecting without a reason" verbatim. `memory deprecate` (task-048,
 * P1.9) does NOT call this helper — spec-008 marks `--reason` optional there, and
 * `P1.9-memory-deprecate.feature` has no matching "missing reason" error scenario, so `memoryDeprecate`
 * will read `options?.reason` directly instead (see this task's Execution Notes for the reconciliation
 * of the SARD REQ-SEC-04 fit-criterion wording against the already-approved `spec-008`).
 */
import { requireReason } from '../../src/core/require-reason';
import { UsageError } from '../../src/core/usage-error';

const MISSING_REASON_ERROR = 'missing required argument: --reason';

describe('requireReason (REQ-SEC-04, task-041-mandatory-reason-on-verbs)', () => {
  it('throws a UsageError (exit 2) with the exact REQ-SEC-04 message when `options` is undefined', () => {
    expect(() => requireReason(undefined)).toThrow(UsageError);
    try {
      requireReason(undefined);
      throw new Error('expected a UsageError');
    } catch (error) {
      expect(error).toBeInstanceOf(UsageError);
      expect((error as UsageError).message).toBe(MISSING_REASON_ERROR);
      expect((error as UsageError).exitCode).toBe(2);
    }
  });

  it('throws the same UsageError when `options` is present but carries no `reason` key', () => {
    try {
      requireReason({ type: 'task' });
      throw new Error('expected a UsageError');
    } catch (error) {
      expect(error).toBeInstanceOf(UsageError);
      expect((error as UsageError).message).toBe(MISSING_REASON_ERROR);
    }
  });

  it('returns the `--reason` value verbatim when present', () => {
    expect(requireReason({ reason: 'meets standards' })).toBe('meets standards');
  });

  it('returns a reason value alongside other unrelated options untouched', () => {
    expect(requireReason({ type: 'task', reason: 'tests missing' })).toBe('tests missing');
  });
});
