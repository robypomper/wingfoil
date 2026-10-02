'use strict';
/**
 * Jest `globalTeardown` — release the `dist/` lock `test/global-setup.cjs` took (bug-095, task-146).
 *
 * Only the run holding the lock releases it: `releaseDistLock` removes the lock only when it records
 * this process's pid. A run killed before reaching this point leaves a lock whose pid is dead, and
 * the next run takes it over.
 */
const { join } = require('node:path');

const { distLockPath, releaseDistLock } = require('./dist-lock.cjs');

module.exports = async () => {
  releaseDistLock({ lockPath: distLockPath(join(__dirname, '..')) });
};
