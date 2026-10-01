/**
 * Git-identity pre-flight check (REQ-SEC-01, adr-006-git-identity-role-based-authz —
 * task-014-git-identity-required).
 *
 * Git identity is WingFoil's sole attribution mechanism: the commit author *is* the "who" of the
 * audit trail (adr-001 / adr-006 — no separate auth/session/IAM layer). So every state-mutating
 * operation must refuse to run when no author name or email resolves (`user.name`/`user.email`, or
 * what outranks them for git: `GIT_AUTHOR_*`, `author.*` — task-132), rather than produce a commit
 * with an unattributable author. This check lives in `src/core` so the CLI and every MCP Tool enforce
 * it identically by construction (REQ-SYS-05) — a mutation calls it first and returns its
 * `CoreResult.error` unchanged, so the surface renders the exact message and writes nothing.
 */
import { execFileSync } from 'node:child_process';

import { coreErr, coreOk, type CoreResult } from './types';

/** Exact refusal message required by REQ-SEC-01's fit criterion — do not reword. */
const IDENTITY_ERROR = 'git identity not configured (user.name/user.email)';

/** The four config keys an author identity can come from, as `git config` prints them (lower case). */
const IDENTITY_KEYS = /^(author|user)\.(name|email)$/;

/**
 * The effective values of `author.name`, `author.email`, `user.name` and `user.email` at `root`, in
 * ONE `git config` subprocess. `--get-regexp` lists every scope's entry, lowest precedence first
 * (system, global, local), so the last value seen for a key is the effective one, exactly as
 * `git config <key>` would answer. `-z` keeps a value with unusual bytes intact. A key that is unset
 * is simply absent, and so is every key when git exits non-zero (no match, or not a repository) —
 * the same "empty means unconfigured" contract the check relies on.
 */
function readIdentityConfig(root: string): ReadonlyMap<string, string> {
  let output: string;
  try {
    // `env: process.env` is passed explicitly (identical to the default in production): it makes git's
    // config resolution follow the current environment by design, so a caller/test can scope it via
    // `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM`/`GIT_CONFIG_NOSYSTEM` deterministically.
    output = execFileSync('git', ['-C', root, 'config', '-z', '--get-regexp', IDENTITY_KEYS.source], {
      encoding: 'utf-8',
      env: process.env,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return new Map();
  }
  const values = new Map<string, string>();
  for (const record of output.split('\0')) {
    const newline = record.indexOf('\n');
    if (newline < 0) continue;
    values.set(record.slice(0, newline), record.slice(newline + 1).trim());
  }
  return values;
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

/**
 * The author identity {@link readGitIdentity} resolves at a given root — either field may be `''`
 * (unresolved). It is the one value a mutating operation checks (REQ-SEC-01), authorizes
 * (REQ-SEC-03), writes into an `Approver:` line and pins as its commit's author (task-132, `bug-149`).
 */
export interface GitIdentity {
  readonly name: string;
  readonly email: string;
}

/**
 * One field of the author identity, resolved in `git commit`'s own order for the author: the
 * `GIT_AUTHOR_*` environment variable, then the `author.*` config key, then `user.*`. A blank value at
 * one level falls through to the next.
 *
 * Deliberately NOT followed further down git's chain: the `EMAIL` environment variable and git's
 * hostname guess. Both are what REQ-SEC-01 exists to refuse — an identity nobody configured — and the
 * check's message names `user.name`/`user.email` as the thing to set.
 */
function resolveAuthorField(config: ReadonlyMap<string, string>, field: 'name' | 'email'): string {
  const fromEnv = (process.env[field === 'name' ? 'GIT_AUTHOR_NAME' : 'GIT_AUTHOR_EMAIL'] ?? '').trim();
  if (fromEnv.length > 0) return fromEnv;
  const fromAuthor = config.get(`author.${field}`) ?? '';
  if (fromAuthor.length > 0) return fromAuthor;
  return config.get(`user.${field}`) ?? '';
}

/**
 * Resolve the identity git would record as the author of a commit made at `root` — `GIT_AUTHOR_NAME`
 * / `GIT_AUTHOR_EMAIL`, then `author.name` / `author.email`, then `user.name` / `user.email`, each
 * field independently, as `git commit` does — with no "is it valid" judgement of its own (that is
 * {@link isConfiguredIdentity}'s job).
 *
 * Before task-132 this read `user.*` alone, while the commit itself was authored by git's precedence,
 * so with `GIT_AUTHOR_EMAIL` set the identity an approval was authorized for and the one it was
 * recorded under could differ (`bug-149`). Reading in git's order makes the value the one the user
 * meant; the transition verbs then pin it as the commit's `--author` (`commitMemoryTransition`), so
 * the recorded author is this value by construction rather than by agreement between two readers.
 *
 * One `git config` subprocess (it used to be two per read, and an approval read three times — six
 * subprocesses, `dl-064` Context (ii)). Called once per operation, by {@link requireGitIdentity}; the
 * result is passed on, never re-read (`dl-064` B.1).
 */
export function readGitIdentity(root: string): GitIdentity {
  const config = readIdentityConfig(root);
  return { name: resolveAuthorField(config, 'name'), email: resolveAuthorField(config, 'email') };
}

/**
 * Verify a git identity is resolvable at `root` before a state mutation, and return it. Returns a
 * `CoreResult.error` (code `VALIDATION` — a failed precondition, mapped to exit `1` by
 * `exitCodeForError`) carrying the exact REQ-SEC-01 message when the name or the email is unresolved;
 * otherwise `ok` with the identity, which the caller uses for every later step that needs a "who" —
 * the authority check, the `Approver:` line and the commit author (`dl-064` B.1, task-132) — instead
 * of reading it again.
 */
export function requireGitIdentity(root: string): CoreResult<GitIdentity> {
  const identity = readGitIdentity(root);
  if (!isConfiguredIdentity(identity.name, identity.email)) {
    return coreErr({ code: 'VALIDATION', message: IDENTITY_ERROR });
  }
  return coreOk(identity);
}
