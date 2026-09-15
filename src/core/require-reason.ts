/**
 * `--reason` mandatory-argument pre-flight check (REQ-SEC-04 — task-041-mandatory-reason-on-verbs).
 *
 * Decisions must be explainable in the audit trail: `memory approve` (P1.7) and `memory reject`
 * (P1.8) both record an approver/rejecter identity, an ISO-8601 timestamp, and a reason in the
 * resulting git commit body (P1.7/P1.8 BDD "the git commit records the approver identity, timestamp,
 * and reason"). The reason text can only be recorded if the caller supplied one, so both operations
 * refuse before any read/write when `--reason` is omitted — the argument-validation step every
 * mutating `CoreFn` already performs inline for its own required options (e.g. `memoryAddFn`'s
 * `--type`/`--title` checks, task-020), factored out here once both approve and reject need the
 * identical check (this task is their shared prerequisite, per its own Implementation Notes).
 *
 * This mirrors `requireGitIdentity`'s (`./git-identity.ts`, REQ-SEC-01, task-014) role and calling
 * convention: a mutating `CoreFn` calls it first, before any registry lookup or file access, so an
 * omitted `--reason` makes no change (REQ-SEC-04's fit criterion). Unlike `requireGitIdentity` (an
 * ambient precondition, not tied to a CLI argument, returning a `CoreResult.error` mapped to exit 1)
 * this is an ARGUMENT-shape problem — spec-005-cli-command-contract §1's "missing required argument"
 * case — so, matching `memoryAddFn`'s own `--type`/`--title` checks and `dnaSetFn`'s invalid-key-path
 * check, it `throw`s a `UsageError` (exit **2**, `./exit-code.ts`'s `exitCodeForThrow`) rather than
 * returning a `CoreResult`.
 *
 * `memory deprecate` (P1.9, task-048) deliberately does NOT call this: `spec-008-cli-grammar.md` §2
 * marks `--reason` optional "elsewhere (e.g. `memory deprecate`)", and
 * `P1.9-memory-deprecate.feature` has no "missing reason" error scenario (unlike P1.7/P1.8) — so
 * `memoryDeprecate`'s `CoreFn` reads `options?.reason` directly instead of calling `requireReason`.
 */
import { UsageError } from './usage-error';

/** Exact refusal message required by REQ-SEC-04's fit criterion (spec-008-cli-grammar §2's ground-truth wording) — do not reword. */
const MISSING_REASON_ERROR = 'missing required argument: --reason';

/**
 * Return the `--reason` value out of a `CoreFn`'s parsed `options` (the `ParamsContext.options`
 * value-bearing seam, `../core/registry.ts` — the same one `memoryAddFn` reads `--type`/`--title`/
 * `--tags` from), or throw a `UsageError` with the exact REQ-SEC-04 message when it is absent
 * (`options` itself undefined, or present without a `reason` key). Call this BEFORE any
 * registry/document lookup in a mutating `CoreFn` so an omitted `--reason` makes no change.
 */
export function requireReason(options: Readonly<Record<string, string>> | undefined): string {
  const reason = options?.reason;
  if (reason === undefined) {
    throw new UsageError(MISSING_REASON_ERROR);
  }
  return reason;
}
