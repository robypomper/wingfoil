'use strict';
/**
 * Jest `globalSetup` — compile `dist/` exactly once, before any worker starts.
 *
 * The CLI integration suites (`test/cli/program.integration.test.ts`,
 * `test/cli/npm-distribution.test.ts`) spawn the compiled `node dist/cli.js` out-of-process. They
 * used to each `rmSync(dist)` + `tsc`-rebuild the SAME `dist/` in their own `beforeAll`; because jest
 * runs test files in parallel workers, one suite could delete/rebuild `dist/` while the other was
 * spawning `node dist/cli.js`, producing an intermittent failure that passed on re-run
 * (bug-003-cli-integration-dist-race). Building here, once, before the worker pool exists removes the
 * race entirely — and does one build per run instead of two.
 *
 * The same race between two jest RUNS in one worktree (bug-095) is closed by the lock in
 * `test/dist-lock.cjs`: the build happens only once this run holds `.jest-dist.lock`, which it keeps
 * until `test/global-teardown.cjs`. A second run waits for it, or refuses naming the holder; it never
 * deletes the `dist/` another run is using.
 *
 * Deterministic by construction: a clean removal + a single `tsc` invocation, no wall-clock or
 * ordering dependence in what is built.
 */
const { execSync } = require('node:child_process');
const { join } = require('node:path');

const { prepareDist } = require('./dist-lock.cjs');

module.exports = async () => {
  const repoRoot = join(__dirname, '..');
  await prepareDist({
    repoRoot,
    build: () => execSync('npx tsc -p tsconfig.build.json', { cwd: repoRoot, stdio: 'pipe' }),
  });
};
