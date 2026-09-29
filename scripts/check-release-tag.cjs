#!/usr/bin/env node
/**
 * spec-015 §4 — assert the pushed release tag is `vX.Y.Z` and equals `v` + package.json `version`,
 * and that `server.json` `version` and every `packages[].version` equal that same version
 * (task-115, `dl-093` point 5 option (a)): the MCP Registry listing can never name a version other
 * than the one published.
 *
 * Run by `.github/workflows/publish.yml`'s gate job before anything is built, so a hand-bumped version,
 * a mistyped tag or a `server.json` left behind stops the pipeline instead of promoting. Pure and offline.
 *
 * Usage: node scripts/check-release-tag.cjs <tag>        (CI passes "$GITHUB_REF_NAME")
 */
'use strict';

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const RELEASE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/**
 * The first `server.json` version that differs from `version`, as a message, or `undefined`.
 *
 * @param {{ version?: unknown, packages?: unknown } | undefined} server
 * @param {string} version
 * @returns {string | undefined}
 */
function serverJsonMismatch(server, version) {
  if (server === undefined || server === null) return 'no server.json was read';
  if (server.version !== version) {
    return `server.json version ${JSON.stringify(server.version)} does not match package.json version ${version}`;
  }
  if (!Array.isArray(server.packages) || server.packages.length === 0) {
    return 'server.json has no packages[] entry to check';
  }
  const index = server.packages.findIndex((entry) => entry === null || entry === undefined || entry.version !== version);
  if (index !== -1) {
    const found = server.packages[index] ? server.packages[index].version : undefined;
    return `server.json packages[${index}].version ${JSON.stringify(found)} does not match package.json version ${version}`;
  }
  return undefined;
}

/**
 * @param {string | undefined} tag
 * @param {string} version
 * @param {{ version?: unknown, packages?: unknown } | undefined} server
 * @returns {{ ok: boolean, message: string }}
 */
function checkReleaseTag(tag, version, server) {
  if (!tag) return { ok: false, message: 'no release tag given' };
  if (!RELEASE_TAG.test(tag)) return { ok: false, message: `tag ${tag} is not of the form vX.Y.Z (spec-015 §4)` };
  if (tag !== `v${version}`) {
    return { ok: false, message: `tag ${tag} does not match package.json version ${version} (expected v${version})` };
  }
  const mismatch = serverJsonMismatch(server, version);
  if (mismatch !== undefined) return { ok: false, message: `${mismatch} (spec-015 §4)` };
  return { ok: true, message: `tag ${tag} matches package.json version ${version}, and so do server.json and its packages` };
}

if (require.main === module) {
  const root = join(__dirname, '..');
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
  let server;
  try {
    server = JSON.parse(readFileSync(join(root, 'server.json'), 'utf-8'));
  } catch (error) {
    process.stderr.write(`cannot read server.json: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
  if (process.exitCode !== 1) {
    const result = checkReleaseTag(process.argv[2], version, server);
    (result.ok ? process.stdout : process.stderr).write(`${result.message}\n`);
    process.exitCode = result.ok ? 0 : 1;
  }
}

module.exports = { checkReleaseTag };
