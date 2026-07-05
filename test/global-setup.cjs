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
 * Deterministic by construction: a clean `rmSync` + a single `tsc` invocation, no wall-clock or
 * ordering dependence.
 */
const { execSync } = require('node:child_process');
const { rmSync } = require('node:fs');
const { join } = require('node:path');

module.exports = async () => {
  const repoRoot = join(__dirname, '..');
  rmSync(join(repoRoot, 'dist'), { recursive: true, force: true });
  execSync('npx tsc -p tsconfig.build.json', { cwd: repoRoot, stdio: 'pipe' });
};
