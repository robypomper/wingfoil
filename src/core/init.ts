/**
 * `.wingfoil/` initialization as a shared-core domain operation (task-018-implement-git-backed-storage,
 * P1.1, US-0A-01, REQ-SYS-01/REQ-SYS-02; spec-006-core-domain-api §2 `CoreResult` shape).
 *
 * The storage layer (`src/storage/layout.ts`'s `initStorage`) is a pure write+commit mechanism; this
 * is the thin `CoreResult`-returning wrapper that both surfaces (CLI, MCP — REQ-SYS-05) drive, so the
 * two guard rails the P1.1 acceptance contract states are enforced once, identically:
 *   1. "target directory is not a git repository" → a `VALIDATION` error carrying the exact message
 *      `not a git repository: run 'git init' first`, mapped to exit 1 by `exitCodeForError`
 *      (spec-005 §1) — and, critically, NOTHING is written (no `.wingfoil/`).
 *   2. the REQ-SEC-01 git-identity pre-flight (`requireGitIdentity`, task-014) — a WingFoil commit
 *      with no attributable author is refused before any file is written.
 *
 * The user-facing `wingfoil init` CLI command and its interactive wizard are task-029's scope; this
 * function is the library entry point that command will call. It is intentionally NOT registered in
 * `CORE_MODULES` yet — there is no distinct verb beyond `init`, and wiring the surface belongs with
 * task-029 (keeping the REQ-SYS-05 parity test's "0 mutating ops" invariant until a surface exists).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { INIT_COMMIT_MESSAGE, initStorage, scaffoldFiles } from '../storage';

import { requireGitIdentity } from './git-identity';
import { coreErr, coreOk, type CoreResult } from './types';

/** Exact refusal message required by P1.1-git-backed-storage.feature scenario 3 — do not reword. */
const NOT_A_GIT_REPO = "not a git repository: run 'git init' first";

/** What a successful init reports: the resolved root and the root-relative paths it created. */
export interface InitStorageValue {
  readonly root: string;
  readonly files: readonly string[];
}

/**
 * Initialize the `.wingfoil/` storage structure at `root` and stage it as a single commit authored
 * by the current git user.
 *
 * @returns `ok` carrying the created paths and the produced `{sha, message}` commit; or a
 *   `CoreResult.error` (code `VALIDATION` → exit 1) when `root` is not a git repository, when git
 *   identity is unconfigured (REQ-SEC-01), or (code `IO`) when the git commit itself fails.
 */
export function initWingfoilStorage(root: string): CoreResult<InitStorageValue> {
  // Guard 1 — `root` must itself be a git repository (a `.git` dir or worktree file at the root).
  // Checked first so its precise message wins over the identity pre-flight below.
  if (!existsSync(join(root, '.git'))) {
    return coreErr({ code: 'VALIDATION', message: NOT_A_GIT_REPO });
  }

  // Guard 2 — refuse an unattributable commit (REQ-SEC-01). Returns its VALIDATION error unchanged.
  const identity = requireGitIdentity(root);
  if (!identity.ok) return identity as CoreResult<InitStorageValue>;

  try {
    const sha = initStorage(root);
    return coreOk<InitStorageValue>(
      { root, files: scaffoldFiles().map((file) => file.path) },
      { sha, message: INIT_COMMIT_MESSAGE },
    );
  } catch (error) {
    return coreErr({ code: 'IO', message: (error as Error).message });
  }
}
