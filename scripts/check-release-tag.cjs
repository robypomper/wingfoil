#!/usr/bin/env node
/**
 * spec-015 §4 — assert the pushed release tag is `vX.Y.Z` and equals `v` + package.json `version`.
 *
 * Run by `.github/workflows/publish.yml`'s gate job before anything is built, so a hand-bumped version
 * or a mistyped tag stops the pipeline instead of promoting. Pure and offline.
 *
 * Usage: node scripts/check-release-tag.cjs <tag>        (CI passes "$GITHUB_REF_NAME")
 */
'use strict';

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const RELEASE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/**
 * @param {string | undefined} tag
 * @param {string} version
 * @returns {{ ok: boolean, message: string }}
 */
function checkReleaseTag(tag, version) {
  if (!tag) return { ok: false, message: 'no release tag given' };
  if (!RELEASE_TAG.test(tag)) return { ok: false, message: `tag ${tag} is not of the form vX.Y.Z (spec-015 §4)` };
  if (tag !== `v${version}`) {
    return { ok: false, message: `tag ${tag} does not match package.json version ${version} (expected v${version})` };
  }
  return { ok: true, message: `tag ${tag} matches package.json version ${version}` };
}

if (require.main === module) {
  const { version } = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
  const result = checkReleaseTag(process.argv[2], version);
  (result.ok ? process.stdout : process.stderr).write(`${result.message}\n`);
  process.exitCode = result.ok ? 0 : 1;
}

module.exports = { checkReleaseTag };
