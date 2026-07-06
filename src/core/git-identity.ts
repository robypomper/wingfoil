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
 * Verify a git identity is configured at `root` before a state mutation. Returns a
 * `CoreResult.error` (code `VALIDATION` — a failed precondition, mapped to exit `1` by
 * `exitCodeForError`) carrying the exact REQ-SEC-01 message when either `user.name` or `user.email`
 * is unset; otherwise `ok`.
 */
export function requireGitIdentity(root: string): CoreResult<void> {
  const name = readGitConfig(root, 'user.name');
  const email = readGitConfig(root, 'user.email');
  if (name.length === 0 || email.length === 0) {
    return coreErr({ code: 'VALIDATION', message: IDENTITY_ERROR });
  }
  return coreOk<void>(undefined);
}
