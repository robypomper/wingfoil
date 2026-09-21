/**
 * `dl-067-reason-trailer-contract` (`ready`) — the declared-block contract for `--reason` against the
 * `Approver:`/`Reason:` commit trailer, and the fix for
 * `bug-042-reason-text-has-no-contract-against-commit-trailer` (`high`, `v0.2`) via
 * `task-072-fix-reason-trailer-contract`.
 *
 * What each clause of dl-067's option (C) pins here:
 *
 * - **clause 2 — the trailer is a block.** `Reason:` carries the remainder of its own line plus every
 *   following body line, up to (exclusive) git's trailing trailer paragraph or the end of the body.
 *   `parseReasonBlock` replaces `REASON_LINE_RE`'s first-line capture, which dropped everything past
 *   line one (bug-042 F1).
 * - **clause 3 — the normalization is declared.** `git commit -m` applies git's own
 *   `cleanup=whitespace`, so "recorded verbatim" (`spec-008-cli-grammar` §2, pre-revision) was already
 *   false for any multi-line text. `normalizeReason` IS that rule, applied by the writer, so the
 *   round trip is assertable equality rather than an approximation.
 * - **clause 4 — the narrow refusal.** A blank reason, and a reason carrying a line that begins
 *   `Approver:`/`Reason:`, are refused (bug-042 F2/F3). Generic `Key: value` prose stays legal: 8 of
 *   `main`'s approve/reject commits contain such a line inside the reason and 0 contain a reserved
 *   one (dl-067 E5).
 * - **clause 5 — one grammar, two sides.** The rules live in `../../src/memory/commit-message` and are
 *   consumed by `../../src/memory/audit`; `commit-message.ts`'s own module doc has claimed since
 *   `task-045-memory-submit` that building the message in one place keeps writer and reader from
 *   drifting. These cases are that claim, asserted.
 * - **clause 6 — degrade, don't vanish.** `parseApprovalMetadata` keeps a successfully parsed
 *   `Approver:` line when the reason is unreadable, instead of discarding both (bug-042 F2's second
 *   half). Lives in `./audit.test.ts` alongside that function's other cases.
 *
 * The corpus figures quoted above and below were measured on `main`; the block-accurate count is
 * **79 of 171** approve/reject commits carrying a multi-line reason (dl-067 E1 — bug-042's 66/156 and
 * task-072's own 72/169 both used a measure that stops at the first blank line and therefore
 * undercount).
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import {
  formatMemoryCommitMessage,
  normalizeReason,
  parseApproverTrailerLine,
  reasonDefect,
  reasonDefectMessage,
} from '../../src/memory/commit-message';
import { parseApprovalMetadata, parseCommitReason } from '../../src/memory/audit';
import { commitAll, makeTempGitRepo, removeTempDir, writeFixtureFile } from '../storage/helpers/git-fixture';

/** The pre-fix reader, kept here verbatim so the cases below can show what it used to lose. */
const FIRST_LINE_ONLY_RE = /^Reason:\s*(.+)$/m;

const APPROVER = { name: 'Roberto Pompermaier', email: 'robypomper@gmail.com', role: 'approver' } as const;

describe('normalizeReason — dl-067 clause 3: git cleanup=whitespace, declared rather than suffered', () => {
  it('strips per-line trailing whitespace, collapses blank-line runs, and drops leading/trailing blank lines', () => {
    expect(normalizeReason('\n\nline one   \n\n\nline two\ntrailing ws   \n\n')).toBe(
      'line one\n\nline two\ntrailing ws',
    );
  });

  it('keeps interior indentation, which carries meaning in real approval prose', () => {
    // e.g. `8c3fe35` (approve dl-051) indents the two warning strings it ratifies.
    expect(normalizeReason('ratified as written:\n  directive not found\n  role has no file')).toBe(
      'ratified as written:\n  directive not found\n  role has no file',
    );
  });

  it('trims only the FIRST line\'s leading whitespace — it sits after `Reason: ` on the same line', () => {
    expect(normalizeReason('   leading\n   kept')).toBe('leading\n   kept');
  });

  it('normalizes CRLF to LF, as git stores it', () => {
    expect(normalizeReason('a\r\nb')).toBe('a\nb');
  });

  it('is idempotent (REQ-SYS-07: a pure function of its input, applied once or twice alike)', () => {
    const once = normalizeReason('a   \n\n\n\nb  ');
    expect(normalizeReason(once)).toBe(once);
  });
});

describe('reasonDefect — dl-067 clause 4: the narrow refusal, and only it', () => {
  it('refuses an empty or whitespace-only reason (bug-042 F2)', () => {
    expect(reasonDefect('')).toBe('blank');
    expect(reasonDefect('   ')).toBe('blank');
    expect(reasonDefect('\n\t \n')).toBe('blank');
  });

  it('refuses a reason carrying a line that begins `Approver:` — bug-042 F3, the forged trailer', () => {
    expect(reasonDefect('real reason\nApprover: Mallory <mallory@evil.test> (approver)')).toBe(
      'reserved-trailer-line',
    );
  });

  it('refuses a reason carrying a line that begins `Reason:`', () => {
    expect(reasonDefect('first\nReason: second')).toBe('reserved-trailer-line');
  });

  it('accepts generic `Key: value` prose — 8 commits on `main` carry one inside the reason (dl-067 E5)', () => {
    // Real lines from `3655166`, `58ac6f9` and `1ee7f00`.
    expect(reasonDefect('A: before the v0.2 release-publishing phase, a named task runs npm pack')).toBeNull();
    expect(reasonDefect('ratified.\n\nAction: amend spec-015 §3 as a dated Revision note')).toBeNull();
    expect(reasonDefect('The debt is implicit: this is a known, named debt, not an oversight')).toBeNull();
  });

  it('accepts an ordinary multi-paragraph reason', () => {
    expect(reasonDefect('First paragraph.\n\nSecond paragraph, longer.')).toBeNull();
  });

  it('refuses a reason whose FINAL paragraph is entirely trailer-shaped: the reader would read it as git\'s trailer block', () => {
    // The corollary of clause 2's termination rule. 0 of `main`'s 172 reason blocks end this way, so
    // the refusal is compatible with 100% of the existing corpus — the same standard clause 4 is held
    // to. Without it, clause 3's round-trip equality would be false for this one input shape.
    expect(reasonDefect('Ratified.\n\nAction: amend spec-008\nOwner: the approver')).toBe(
      'trailing-trailer-paragraph',
    );
  });

  it('judges the NORMALIZED text, so a defect cannot hide behind whitespace', () => {
    expect(reasonDefect('real reason\n   \nApprover: Mallory <m@evil.test> (approver)   ')).toBe(
      'reserved-trailer-line',
    );
  });

  it('gives each defect a distinct, non-empty message (dl-067 S1: NOT the omitted-argument string)', () => {
    const messages = (['blank', 'reserved-trailer-line', 'trailing-trailer-paragraph'] as const).map(
      reasonDefectMessage,
    );
    expect(new Set(messages).size).toBe(3);
    for (const message of messages) {
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toBe('missing required argument: --reason');
    }
  });
});

describe('parseReasonBlock via parseCommitReason — dl-067 clause 2: the block, not the first line', () => {
  it('reads a multi-paragraph reason in full (bug-042 F1: the first-line rule kept only line one)', () => {
    const body = 'Approver: A <a@b.c> (approver)\nReason: first line\n\nsecond paragraph\nand its second line';
    expect(parseCommitReason(body)).toBe('first line\n\nsecond paragraph\nand its second line');
    expect(FIRST_LINE_ONLY_RE.exec(body)?.[1]).toBe('first line');
  });

  it('stops at git\'s trailing trailer paragraph, which is not part of the reason', () => {
    const body = 'Approver: A <a@b.c> (approver)\nReason: why\n\nmore why\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>';
    expect(parseCommitReason(body)).toBe('why\n\nmore why');
  });

  it('does NOT stop at a `Key: value` prose line in the middle of the block', () => {
    const body = 'Approver: A <a@b.c> (approver)\nReason: ratified.\n\nAction: amend spec-015 §3\n\nand then re-ratify it';
    expect(parseCommitReason(body)).toBe('ratified.\n\nAction: amend spec-015 §3\n\nand then re-ratify it');
  });

  it('returns null for a bare `Reason:` with no value — bug-042 F2\'s post-git-cleanup shape', () => {
    expect(parseCommitReason('Approver: A <a@b.c> (approver)\nReason:')).toBeNull();
  });

  it('returns null when the body carries no Reason: line at all', () => {
    expect(parseCommitReason('')).toBeNull();
    expect(parseCommitReason('Approver: A <a@b.c> (approver)')).toBeNull();
  });

  it('still reads a deprecate body, which carries a Reason: and no Approver: line (dl-027)', () => {
    expect(parseCommitReason('Reason: superseded by adr-004')).toBe('superseded by adr-004');
  });
});

describe('parseApproverTrailerLine — dl-067 clause 5: the Approver: line is the FIRST body line, or it is not one', () => {
  it('returns the line when it leads the body (171/171 of main\'s approve/reject commits — dl-067 E4)', () => {
    expect(parseApproverTrailerLine('Approver: A <a@b.c> (approver)\nReason: why')).toBe(
      'Approver: A <a@b.c> (approver)',
    );
  });

  it('returns null for an `Approver:` line that is NOT first — a forged one can never win the parse', () => {
    expect(parseApproverTrailerLine('Reason: why\nApprover: Mallory <mallory@evil.test> (approver)')).toBeNull();
  });

  it('returns null when the body has no Approver: line', () => {
    expect(parseApproverTrailerLine('Reason: superseded by adr-004')).toBeNull();
  });
});

describe('formatMemoryCommitMessage — dl-067 clause 5: the writer enforces the same grammar it documents', () => {
  it('writes the NORMALIZED reason, so what is committed is what the contract declares', () => {
    const message = formatMemoryCommitMessage({
      type: 'task',
      op: 'approve',
      ids: ['task-1'],
      transition: { from: 'pending', to: 'backlog' },
      approver: APPROVER,
      reason: 'first   \n\n\nsecond',
    });
    expect(message.split('\n\n').slice(1).join('\n\n')).toBe(
      `Approver: ${APPROVER.name} <${APPROVER.email}> (${APPROVER.role})\nReason: first\n\nsecond`,
    );
  });

  it('refuses a defective reason rather than emitting it — no caller can route around the boundary check', () => {
    for (const reason of ['', '   ', 'x\nApprover: Mallory <m@evil.test> (approver)']) {
      expect(() =>
        formatMemoryCommitMessage({ type: 'adr', op: 'deprecate', ids: ['adr-1'], reason }),
      ).toThrow(/--reason/);
    }
  });

  it('leaves a message with no reason alone — `submit` passes none (characterization)', () => {
    expect(formatMemoryCommitMessage({ type: 'task', op: 'submit', ids: ['task-1'] })).toBe(
      'wf(task): submit task-1',
    );
  });
});

/**
 * dl-067 clause 3 + `task-072` AC6: git's own message cleanup is what turns `Reason: ` into a bare
 * `Reason:` (bug-042 F2) and what strips trailing whitespace from a multi-line reason. A test that
 * exercises only the formatter cannot see it, so these two round-trip through a REAL `git commit` in a
 * throwaway repository.
 */
describe('round trip through a real `git commit` — what the writer declares is what git stores', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, 'f.txt', 'x');
    commitAll(repo, 'seed');
  });

  afterEach(() => removeTempDir(repo));

  function commitWithMessage(message: string): string {
    writeFixtureFile(repo, 'f.txt', `${Math.random()}`);
    execFileSync('git', ['-C', repo, 'add', '-A'], { encoding: 'utf-8' });
    execFileSync('git', ['-C', repo, 'commit', '--quiet', '-m', message], { encoding: 'utf-8' });
    return execFileSync('git', ['-C', repo, 'log', '-1', '--format=%b'], { encoding: 'utf-8' });
  }

  it('a multi-paragraph reason survives git and reads back identically to the declared normal form', () => {
    const reason = 'First paragraph, with a trailing space.   \n\n\nSecond paragraph.\n  an indented line';
    const body = commitWithMessage(
      formatMemoryCommitMessage({
        type: 'task',
        op: 'approve',
        ids: ['task-1'],
        transition: { from: 'pending', to: 'backlog' },
        approver: APPROVER,
        reason,
      }),
    );

    expect(parseCommitReason(body)).toBe(normalizeReason(reason));
    expect(parseCommitReason(body)).toBe(
      'First paragraph, with a trailing space.\n\nSecond paragraph.\n  an indented line',
    );
    expect(parseApprovalMetadata(body)).toEqual({
      approverName: APPROVER.name,
      approverEmail: APPROVER.email,
      approverRole: APPROVER.role,
      reason: normalizeReason(reason),
    });
  });

  it('git\'s cleanup is exactly what clause 3 declares — a hand-written `Reason: ` still collapses to a bare `Reason:`', () => {
    // The pre-fix write path could produce this; the fix makes it unreachable through the verbs, and
    // clause 6 (see `./audit.test.ts`) keeps the approver readable when it is met in old history.
    const body = commitWithMessage('wf(task): approve task-1 [pending → backlog]\n\nApprover: A <a@b.c> (approver)\nReason: ');
    expect(body).toContain('Reason:\n');
    expect(parseCommitReason(body)).toBeNull();
  });
});

/**
 * dl-067's accepted consequence, pinned against THIS repository's own history rather than a fixture:
 * the multi-line commits already on `main` start reading back in full. The commit is located by
 * subject rather than by sha so the case survives a history rewrite; `546b76e` is the sha it had when
 * dl-067 measured it, and it is dl-067 E2's worked worst case — the pre-fix reader kept 64 of 3298
 * characters (2%) of that approval's reasoning.
 */
describe('the existing corpus — a real approve commit from this repository reads back in full', () => {
  const repoRoot = resolve(__dirname, '../..');
  const SUBJECT = 'wf(task): approve task-054-project-directives [in-review → approved]';

  function shaBySubject(): string {
    const out = execFileSync('git', ['-C', repoRoot, 'log', '--format=%H', `--grep=^${SUBJECT.replace(/[[\]]/g, '\\$&')}$`], {
      encoding: 'utf-8',
    })
      .trim()
      .split('\n')
      .filter(Boolean);
    if (out.length !== 1) {
      throw new Error(`expected exactly one commit with subject "${SUBJECT}", found ${out.length}`);
    }
    return out[0] as string;
  }

  it('recovers the whole reason where the first-line rule kept 2% of it (dl-067 E2, worked case)', () => {
    const body = execFileSync('git', ['-C', repoRoot, 'log', '-1', '--format=%b', shaBySubject()], {
      encoding: 'utf-8',
    });

    const block = parseCommitReason(body);
    const firstLineOnly = FIRST_LINE_ONLY_RE.exec(body)?.[1] ?? '';

    expect(firstLineOnly.length).toBe(64);
    expect(block).not.toBeNull();
    expect(block).toHaveLength(3298);
    expect(block?.startsWith(firstLineOnly)).toBe(true);
    // Nothing is invented: every byte the block adds already exists in the commit git stores.
    expect(body).toContain(block as string);
    // And the approval record itself survives the change — identity unchanged, reason now whole.
    expect(parseApprovalMetadata(body)).toEqual({
      approverName: 'Roberto Pompermaier',
      approverEmail: 'robypomper@gmail.com',
      approverRole: 'approver',
      reason: block,
    });
  });
});
