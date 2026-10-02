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

module.exports = async () => {
  const tag = process.env.WF_FIXTURE_RUN_TAG;
  if (!tag) return;
  const report = formatSweepReport(sweepFixtureDirs(tmpdir(), tag));
  if (report) console.warn(report);
};
module.exports.sweepFixtureDirs = sweepFixtureDirs;
module.exports.formatSweepReport = formatSweepReport;
