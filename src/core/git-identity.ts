/**
 * Git-identity pre-flight check (REQ-SEC-01, adr-006-git-identity-role-based-authz —
 * task-014-git-identity-required).
 *
 * Git identity is WingFoil's sole attribution mechanism: the commit author *is* the "who" of the
 * audit trail (adr-001 / adr-006 — no separate auth/session/IAM layer). So every state-mutating
 * operation must refuse to run when `user.name`/`user.email` are unset, rather than produce a commit
 * with an unattributable author. This check lives in `src/core` so the CLI and every MCP Tool enforce
 * it identically by construction (REQ-SYS-05) — a mutation calls it first and returns its
 * `CoreResult.error` unchanged, so the surface renders the exact message and writes nothing.
 */
import { execFileSync } from 'node:child_process';

import { coreErr, coreOk, type CoreResult } from './types';

/** Exact refusal message required by REQ-SEC-01's fit criterion — do not reword. */
const IDENTITY_ERROR = 'git identity not configured (user.name/user.email)';

/**
 * The effective value of a git config `key` at `root`, or `''` when it is unset — git exits non-zero
 * for an unset key, which we treat as absent (the same "empty means unconfigured" contract the check
 * relies on). Resolves local → global → system exactly as any git command would.
 */
function readGitConfig(root: string, key: string): string {
  try {
    // `env: process.env` is passed explicitly (identical to the default in production): it makes git's
    // config resolution follow the current environment by design, so a caller/test can scope it via
    // `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM`/`GIT_CONFIG_NOSYSTEM` deterministically.
    return execFileSync('git', ['-C', root, 'config', key], { encoding: 'utf-8', env: process.env }).trim();
  } catch {
    return '';
  }
}

/**
 * The single source of truth for "a configured/attributable identity": non-empty `name` AND
 * non-empty `email`. Both the write-time precondition below (`requireGitIdentity`, REQ-SEC-01,
 * task-014-git-identity-required) and the read-time historical audit (`isValidAttribution` in
 * `src/memory/audit.ts`, REQ-SEC-02, task-015-complete-audit-trail) build on this exact predicate for
 * their shared base check — see `isValidAttribution`'s doc-comment for the audit-only augmentations
 * it layers on top for historical commits (a concern this write-time check has no need for, since it
 * only ever looks at the *current* live git config). Pure predicate — no git/filesystem access.
 */
export function isConfiguredIdentity(name: string, email: string): boolean {
  return name.length > 0 && email.length > 0;
}

/** The `user.name`/`user.email` pair `readGitIdentity` resolves at a given root — either may be `''` (unset). */
export interface GitIdentity {
  readonly name: string;
  readonly email: string;
}

/**
 * Read the live `user.name`/`user.email` git identity configured at `root`, with no "is it valid"
 * judgement of its own (that is {@link isConfiguredIdentity}'s job) — the single read primitive both
 * {@link requireGitIdentity} (REQ-SEC-01) and `src/core/approval-authority.ts`'s
 * `requireApprovalAuthority` (REQ-SEC-03, task-040-role-based-approval-authority) build on, so the two
 * checks never each re-implement their own `git config` read.
 */
export function readGitIdentity(root: string): GitIdentity {
  return { name: readGitConfig(root, 'user.name'), email: readGitConfig(root, 'user.email') };
}

/**
 * Verify a git identity is configured at `root` before a state mutation. Returns a
 * `CoreResult.error` (code `VALIDATION` — a failed precondition, mapped to exit `1` by
 * `exitCodeForError`) carrying the exact REQ-SEC-01 message when either `user.name` or `user.email`
 * is unset; otherwise `ok`.
 */
export function requireGitIdentity(root: string): CoreResult<void> {
  const { name, email } = readGitIdentity(root);
  if (!isConfiguredIdentity(name, email)) {
    return coreErr({ code: 'VALIDATION', message: IDENTITY_ERROR });
  }
  return coreOk<void>(undefined);
}
