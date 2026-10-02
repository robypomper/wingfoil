'use strict';
/**
 * Jest `globalTeardown` — report, by count, the fixture directories this run left behind, and remove
 * them (`bug-064-fixture-temp-dirs-leak-with-no-aggregate-visibility`, task-152).
 *
 * `removeTempDir` (`test/storage/helpers/git-fixture.ts`) never throws: when it cannot remove a
 * fixture it warns once, per directory, and gives up, so a passing test cannot be failed by its own
 * teardown. Per-directory console lines are easy to miss across a 200-suite run — 946 leaked
 * directories once accumulated unnoticed over five days — so the end of the run states the total, in
 * one line, whenever it is not zero.
 *
 * Scope is this run only: fixture directories carry the run tag `test/global-setup.cjs` sets
 * (`wf-storage-<tag>-…`). Other runs sharing the temp dir — parallel worktrees — use other tags, so
 * their live fixtures are neither counted nor removed. Leftovers are reported, never fatal: whether a
 * leak should fail the run is not decided (bug-064 Notes).
 */
const { readdirSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

/**
 * Remove every entry of `tmpRoot` whose name starts with `wf-storage-<tag>-`, in sorted order.
 *
 * @param {string} tmpRoot - The temp directory fixtures were created in.
 * @param {string} tag - This run's fixture tag.
 * @returns {{ found: string[], unremoved: string[] }} What carried the tag, and what could not be removed.
 */
function sweepFixtureDirs(tmpRoot, tag) {
  const prefix = `wf-storage-${tag}-`;
  const found = readdirSync(tmpRoot)
    .filter((name) => name.startsWith(prefix))
    .sort()
    .map((name) => join(tmpRoot, name));
  const unremoved = [];
  for (const dir of found) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    } catch {
      unremoved.push(dir);
    }
  }
  return { found, unremoved };
}

/**
 * The one line reported for a sweep, or `null` when the run left nothing behind.
 *
 * @param {{ found: string[], unremoved: string[] }} result - What {@link sweepFixtureDirs} returned.
 * @returns {string | null}
 */
function formatSweepReport(result) {
  if (result.found.length === 0) return null;
  const kept = result.unremoved.length;
  return (
    `fixture teardown: this run left ${result.found.length} fixture director` +
    `${result.found.length === 1 ? 'y' : 'ies'} behind; removed ${result.found.length - kept}` +
    (kept > 0 ? `, could not remove ${kept}: ${result.unremoved.join(', ')}` : '')
  );
}

/**
 * Sweep this run's leftovers and return the report line — only in the process that set the tag. A
 * child jest started from inside a run (`test/lint/coverage-parity.test.ts`) loads this same config,
 * so it runs this teardown too, and it inherits the parent's tag through the environment; sweeping
 * there would delete the parent's fixtures while its suites are still using them. The tag is
 * `r<pid>` of the process that set it (`test/global-setup.cjs`), so a mismatch means "not mine": do
 * nothing.
 *
 * @param {{ tag: string | undefined, pid: number, tmpRoot: string }} run - The run's tag, the current
 *   process id, and the temp directory fixtures were created in.
 * @returns {string | null} The line to report, or `null` when there is nothing to say or nothing owned.
 */
function teardownRun({ tag, pid, tmpRoot }) {
  if (!tag || tag !== `r${pid}`) return null;
  return formatSweepReport(sweepFixtureDirs(tmpRoot, tag));
}

/** The jest `globalTeardown` entry point: one self-contained async function, easy to chain. */
module.exports = async () => {
  const report = teardownRun({ tag: process.env.WF_FIXTURE_RUN_TAG, pid: process.pid, tmpRoot: tmpdir() });
  if (report) console.warn(report);
};
module.exports.sweepFixtureDirs = sweepFixtureDirs;
module.exports.formatSweepReport = formatSweepReport;
module.exports.teardownRun = teardownRun;
