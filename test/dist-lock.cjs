'use strict';
/**
 * One jest run at a time owns a worktree's `dist/`
 * (task-146-make-suite-result-independent-concurrent-runs-machine-load, `bug-095`).
 *
 * `test/global-setup.cjs` deletes and rebuilds `dist/` before the worker pool starts (`bug-003`). A
 * second jest run in the same worktree used to do the same while the first was still spawning
 * `node dist/cli.js`, and the first then reported failures indistinguishable from a regression. The
 * setup now takes `<worktree>/.jest-dist.lock` first and keeps it for the whole run;
 * `test/global-teardown.cjs` releases it.
 *
 * - The lock is a file holding the holder's pid. It is created atomically: the content is written to
 *   a private file which is then hard-linked to the lock path, and a link onto an existing path
 *   fails. A reader therefore never sees a half-written lock.
 * - A run that finds the lock held by a live process waits, polling, and says so once on stderr,
 *   naming the holder. If the lock is still held when the wait ends, the run refuses with an error
 *   naming the holder and the lock path. It deletes nothing in either case.
 * - A lock whose pid is not a live process was left by a run killed before its teardown, and is
 *   taken over.
 * - A release removes the lock only if it holds the releaser's own pid, so a nested jest (as
 *   `test/lint/coverage-parity.test.ts` spawns) or a refused run cannot free the holder's lock.
 */
const { linkSync, readFileSync, rmSync, unlinkSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

/** How long a second run waits for the lock by default: longer than a full coverage run under load. */
const DEFAULT_WAIT_MS = 15 * 60 * 1000;
const DEFAULT_POLL_MS = 500;

function distLockPath(repoRoot) {
  return join(repoRoot, '.jest-dist.lock');
}

function defaultIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: the process exists but belongs to someone else.
    return err.code === 'EPERM';
  }
}

function defaultLog(message) {
  process.stderr.write(`${message}\n`);
}

/** The pid recorded in the lock, `null` if there is no lock, `NaN` if its content is not a pid. */
function readHolder(lockPath) {
  let raw;
  try {
    raw = readFileSync(lockPath, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  const text = raw.trim();
  return /^[1-9][0-9]*$/.test(text) ? Number(text) : Number.NaN;
}

/** Create the lock holding `pid`; `false` if a lock already exists. */
function tryCreate(lockPath, pid) {
  const temp = `${lockPath}.${pid}.tmp`;
  writeFileSync(temp, `${pid}\n`);
  try {
    linkSync(temp, lockPath);
    return true;
  } catch (err) {
    if (err.code === 'EEXIST') return false;
    throw err;
  } finally {
    rmSync(temp, { force: true });
  }
}

/**
 * Take the lock for `pid`, waiting up to `waitMs` for a live holder to release it.
 * Rejects, without touching anything, if the holder still has it when the wait ends.
 */
async function acquireDistLock({
  lockPath,
  pid = process.pid,
  waitMs = DEFAULT_WAIT_MS,
  pollMs = DEFAULT_POLL_MS,
  log = defaultLog,
  isAlive = defaultIsAlive,
}) {
  let waited = 0;
  let announced = false;
  for (;;) {
    if (tryCreate(lockPath, pid)) return;
    const holder = readHolder(lockPath);
    if (holder === null) continue; // released between the two calls
    if (holder === pid) return; // already ours (a watch-mode re-run)
    if (Number.isNaN(holder) || !isAlive(holder)) {
      // Left by a run killed before its teardown. Re-reading before the unlink narrows, but does not
      // close, the window in which two runs breaking the same stale lock could both take it.
      const again = readHolder(lockPath);
      if (again === holder || (Number.isNaN(again) && Number.isNaN(holder))) {
        try {
          unlinkSync(lockPath);
        } catch (err) {
          if (err.code !== 'ENOENT') throw err;
        }
      }
      continue;
    }
    if (waited >= waitMs) {
      throw new Error(
        `jest globalSetup: dist/ is in use by another jest run in this worktree (pid ${holder}, lock ${lockPath}). ` +
          `Waited ${waitMs} ms; refusing to delete and rebuild the dist/ that run is using (bug-095). ` +
          `Re-run when it has finished, or remove the lock if pid ${holder} is not a jest run.`,
      );
    }
    if (!announced) {
      log(`jest globalSetup: dist/ is in use by another jest run in this worktree (pid ${holder}, lock ${lockPath}); waiting for it to finish.`);
      announced = true;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
    waited += pollMs;
  }
}

/** Remove the lock if `pid` holds it. Returns whether it did. */
function releaseDistLock({ lockPath, pid = process.pid }) {
  if (readHolder(lockPath) !== pid) return false;
  try {
    unlinkSync(lockPath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

/** Take the lock, then delete `dist/` and rebuild it with `build`. The lock stays held. */
async function prepareDist({ repoRoot, build, ...lockOptions }) {
  await acquireDistLock({ lockPath: distLockPath(repoRoot), ...lockOptions });
  rmSync(join(repoRoot, 'dist'), { recursive: true, force: true });
  build();
}

module.exports = { acquireDistLock, distLockPath, prepareDist, releaseDistLock };
