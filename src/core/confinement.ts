/**
 * Project-root confinement as a mutating-op **pre-flight** (REQ-SEC-06 —
 * `task-102`, `bug-044-symlinked-directives-custom-escapes-confinement`).
 *
 * The boundary is decided once, in `src/storage/confinement.ts`; this is the thin layer that turns
 * that answer into the `CoreResult` a core operation returns, exactly as `requireGitIdentity`
 * (REQ-SEC-01) and `requireCustomAsset` (REQ-SEC-07) do for their own rules. It lives in `src/core`
 * for their reason too: the rule crosscuts pillars, and the CLI and MCP surfaces must enforce it
 * identically because they run the same function (REQ-SYS-05).
 *
 * **Why a pre-flight and not a check at the write.** `bug-044`'s whole defect is order. The shipped
 * `directive remove` unlinked the outside file and only then failed, on `git add`, with a raw
 * `execFileSync` message — so the operator lost a file, got git's text instead of a mapped refusal,
 * and no commit recorded any of it. A check that runs after the deletion reports a loss it could
 * have prevented; the refusal has to land before the filesystem is touched at all.
 *
 * **Baseline.** This guard resolves against the **working tree**, not `HEAD`, and that is deliberate
 * — a departure from the `command-baseline` directive's read half, argued (as that directive
 * requires) in `task-102`'s Execution Notes and in the decision-log filed from them, never settled
 * here. The one-line reason: what this predicts is where `unlinkSync` will land, and `unlinkSync`
 * follows the symlinks that are on disk, not the ones a commit records.
 */
import { resolveRealPathInRoot } from '../storage/confinement';

import { coreErr, coreOk, type CoreResult } from './types';

/**
 * Refuse, before anything on disk changes, a target whose **real** path lies outside the project
 * root.
 *
 * Resolution is the point. A prefix check over `relativePath` cannot see this: the path this bug is
 * about — `.wingfoil/directives/custom/legacy-rule.md` under a `custom` that is a symlink to another
 * directory — is inside the project in every segment and outside it on the filesystem. So the check
 * resolves first and compares afterwards.
 *
 * Returns a `VALIDATION` `CoreResult.error`, which `exitCodeForError` maps to exit **1**: a
 * well-formed invocation refused on the state of the repository, never the `2` that
 * `spec-005-cli-command-contract` §1 reserves for a malformed one. The message names both spellings
 * of the path — the one the operator typed against and the one it really resolves to — because the
 * two differing is the entire finding, and it deliberately carries no child-process text
 * (`bug-071`/`bug-093`).
 *
 * @param root - Project root.
 * @param relativePath - Root-relative POSIX path of the file the operation is about to touch.
 * @param action - The verb for the refusal's first clause, e.g. `'remove'` → `cannot remove '<path>'`
 *   (P3.3's own message shape, shared with `requireCustomAsset`).
 */
export function requireConfinedTarget(
  root: string,
  relativePath: string,
  action: string,
): CoreResult<void> {
  const resolved = resolveRealPathInRoot(root, relativePath);
  if (resolved.within) return coreOk<void>(undefined);
  return coreErr({
    code: 'VALIDATION',
    message:
      `cannot ${action} '${relativePath}': it resolves to '${resolved.real}', outside the project root. ` +
      'A path that leaves the project is refused, never written to and never deleted; check whether a ' +
      'directory on the way to it is a symlink.',
  });
}
