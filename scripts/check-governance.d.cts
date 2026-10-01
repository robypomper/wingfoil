/**
 * The rule a governance finding breaks (`dl-103` §1): the subject grammar, the canonical bracket, the
 * `Approver:`/`Reason:` body shape, the author's approval authority, or the element's state.
 */
export type GovernanceRule = 'subject' | 'bracket' | 'body' | 'authority' | 'state';

/** One rule broken by one commit. */
export interface GovernanceFinding {
  /** The full sha of the commit. */
  readonly sha: string;
  /** The commit's subject line. */
  readonly subject: string;
  readonly rule: GovernanceRule;
  /** What is wrong, in one line. */
  readonly message: string;
  /**
   * `true` when the commit is not an ancestor of (nor) the introduction commit: the finding fails the
   * check. `false` for history, which is reported and does not fail it.
   */
  readonly gated: boolean;
}

/** A bracketed commit whose state could not be checked, and why. */
export interface UncheckedState {
  readonly sha: string;
  readonly subject: string;
  readonly reason: string;
}

/** The outcome of {@link checkGovernance}. */
export interface GovernanceReport {
  /** The commit the range ends at — the repository's `HEAD`. */
  readonly head: string;
  /** The exclusive start of the range, or `null` for the whole history. */
  readonly base: string | null;
  /** The commit that introduced the check, or `null` when none did (every commit is then gated). */
  readonly introducedAt: string | null;
  /** The `wf()` commits checked (configuration scopes excluded). */
  readonly checked: number;
  /** How many of {@link checked} are gated. */
  readonly gatedCommits: number;
  /** Every finding, oldest commit first, then by rule. */
  readonly findings: readonly GovernanceFinding[];
  /** Bracketed commits whose state was not checked. */
  readonly stateUnchecked: readonly UncheckedState[];
}

/** Options of {@link checkGovernance}. */
export interface GovernanceOptions {
  /** Check `base..HEAD` instead of the whole history. */
  readonly base?: string;
  /**
   * The introduction commit. Defaults to the oldest commit of `HEAD`'s history that added
   * `scripts/check-governance.cjs`.
   */
  readonly introducedAt?: string;
}

/** Check every `wf()` commit of `base..HEAD` (or of the whole history) in the repository at `root`. */
export function checkGovernance(root: string, options?: GovernanceOptions): GovernanceReport;

/** `1` when any finding is gated, else `0`. */
export function exitCodeFor(report: GovernanceReport): 0 | 1;

/** The report as the lines the command prints. */
export function formatReport(report: GovernanceReport): string;
