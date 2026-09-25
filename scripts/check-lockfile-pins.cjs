#!/usr/bin/env node
/**
 * task-104-preserve-the-hoisted-emnapi-lock-entries-under-npm-11 (`bug-063`; `bug-056`, `task-080`) —
 * assert `package-lock.json` still carries the hoisted entries the release gate needs, and that the
 * mechanism keeping them there is still declared.
 *
 * Three properties, all read out of two committed files:
 *
 *   1. every dependency pinned in `package.json`'s nested `overrides` has a **hoisted** lock entry at
 *      exactly the pinned version — its absence is `bug-056`: `npm ci` exits 1 under npm 10.9.x (the
 *      npm Node 22.12.0 bundles, and `.github/workflows/publish.yml` pins that Node in
 *      `env.NODE_VERSION`) because npm resolves the edge from the registry and then refuses the lock
 *      for not containing what it just resolved;
 *   2. every such dependency is **also** declared as an exact direct dependency of this package —
 *      `bug-063`: an `overrides` pin binds a version but does not make npm record a node, so npm 11.x
 *      prunes the hoisted entry on a plain `npm install` and reports `up to date`. A direct
 *      declaration is never pruned, which is what makes the entry survive;
 *   3. no hoisted package declares a **required** peer with no hoisted entry to resolve it from —
 *      the general form of (1), so a future dependency that repeats the shape is caught without
 *      anyone remembering to add a pin. Peers the parent marks `peerDependenciesMeta.<name>.optional`
 *      are exempt; npm may legitimately leave those out of the tree.
 *
 * Pure and offline: it reads `package.json` and `package-lock.json` and never runs npm. Nothing keys
 * on npm's output — `dl-069` S1/E4 measured the same lock producing two different npm error messages
 * three days apart, so the message is not a stable signal (`task-080` AC6).
 *
 * Usage: node scripts/check-lockfile-pins.cjs [project-dir]      (`npm run check:lockfile`)
 */
'use strict';

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

/** An exact semver release. A range would be re-resolved from the registry on every install. */
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

/** What to do about a failure — the half `npm install` itself never printed (`bug-063`). */
const REMEDIATION = [
  'How to fix:',
  '  1. If you have not committed the loss:  git checkout -- package.json package-lock.json',
  '  2. If package.json changed on purpose:  keep each overridden package ALSO declared as an exact',
  '     direct devDependency, then run  npm install  and commit both files together.',
  '  3. Re-check with:  npm run check:lockfile',
  '',
  'Why it matters: `npm ci` exits 1 under npm 10.9.x — the npm Node 22.12.0 bundles, and',
  '.github/workflows/publish.yml pins that Node in env.NODE_VERSION — on a lock missing these',
  'entries, so the release gate cannot install (bug-056). An `overrides` pin alone does not keep',
  'them there: npm 11.x prunes them on an ordinary `npm install` and reports `up to date` (bug-063).',
].join('\n');

/**
 * Every edge declared in the nested `overrides` block, in declaration order.
 *
 * @param {import('./check-lockfile-pins.cjs').LockfilePinsManifest} manifest
 * @returns {{ parent: string, dependency: string, version: string }[]}
 */
function overridePins(manifest) {
  const pins = [];
  for (const [parent, edges] of Object.entries(manifest.overrides || {})) {
    if (typeof edges !== 'object' || edges === null) continue;
    for (const [dependency, version] of Object.entries(edges)) {
      pins.push({ parent, dependency, version: String(version) });
    }
  }
  return pins;
}

/**
 * The hoisted `node_modules/<name>` entries, as `[name, entry]`. Nested positions are excluded on
 * purpose: a peer edge is satisfied from the hoisted position, which is why the nested
 * `@emnapi/core@1.10.0` under `@unrs/resolver-binding-wasm32-wasi` never satisfied
 * `@napi-rs/wasm-runtime`'s peer.
 *
 * @param {import('./check-lockfile-pins.cjs').LockfilePinsLockfile} lockfile
 * @returns {[string, import('./check-lockfile-pins.cjs').LockfilePackage][]}
 */
function hoistedEntries(lockfile) {
  const prefix = 'node_modules/';
  return Object.entries(lockfile.packages || {})
    .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/node_modules/'))
    .map(([path, entry]) => [path.slice(prefix.length), entry]);
}

/**
 * The version this package declares for `name` as a direct dependency, or `undefined`.
 *
 * @param {import('./check-lockfile-pins.cjs').LockfilePinsManifest} manifest
 * @param {string} name
 * @returns {string | undefined}
 */
function directDeclaration(manifest, name) {
  const dev = (manifest.devDependencies || {})[name];
  if (dev !== undefined) return dev;
  return (manifest.dependencies || {})[name];
}

/**
 * @param {import('./check-lockfile-pins.cjs').LockfilePinsManifest} manifest
 * @param {import('./check-lockfile-pins.cjs').LockfilePinsLockfile} lockfile
 * @returns {{ ok: boolean, message: string }}
 */
function checkLockfilePins(manifest, lockfile) {
  const packages = lockfile.packages || {};
  /** @type {string[]} */
  const problems = [];
  const pins = overridePins(manifest);

  for (const pin of pins) {
    const edge = `${pin.parent} -> ${pin.dependency}@${pin.version}`;
    if (!EXACT_VERSION.test(pin.version)) {
      problems.push(`${edge}: overrides pin is a range, which npm re-resolves from the registry on every install`);
    }
    const entry = packages[`node_modules/${pin.dependency}`];
    if (entry === undefined) {
      problems.push(`${edge}: package-lock.json has NO hoisted entry for ${pin.dependency}`);
    } else if (entry.version !== pin.version) {
      problems.push(`${edge}: package-lock.json hoists ${pin.dependency} at ${entry.version} instead`);
    }
    const declared = directDeclaration(manifest, pin.dependency);
    if (declared === undefined) {
      problems.push(
        `${edge}: ${pin.dependency} is pinned in overrides but not declared in package.json ` +
          'devDependencies (or dependencies), so npm 11.x will prune its hoisted lock entry',
      );
    } else if (!EXACT_VERSION.test(declared)) {
      problems.push(
        `${edge}: ${pin.dependency} is declared "${declared}" in devDependencies; an exact version is ` +
          'required so the direct declaration and the overrides pin cannot drift apart',
      );
    }
  }

  for (const [name, entry] of hoistedEntries(lockfile)) {
    for (const peer of Object.keys(entry.peerDependencies || {})) {
      const meta = entry.peerDependenciesMeta || {};
      if (meta[peer] && meta[peer].optional === true) continue;
      if (packages[`node_modules/${peer}`] === undefined) {
        problems.push(`${name} -> ${peer}: required peer with no hoisted lock entry to resolve it from`);
      }
    }
  }

  if (problems.length === 0) {
    return {
      ok: true,
      message: `package-lock.json carries every pinned entry (${pins.length} overrides pin(s)) and every required peer edge resolves from the lock`,
    };
  }
  return {
    ok: false,
    message: ['package-lock.json / package.json lost a pin the release gate depends on:', '']
      .concat(problems.map((p) => `  - ${p}`))
      .concat(['', REMEDIATION])
      .join('\n'),
  };
}

/**
 * Read a project's manifest and lockfile as the pair {@link checkLockfilePins} takes.
 *
 * @param {string} dir
 * @returns {[import('./check-lockfile-pins.cjs').LockfilePinsManifest, import('./check-lockfile-pins.cjs').LockfilePinsLockfile]}
 */
function readProject(dir) {
  return [
    JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8')),
    JSON.parse(readFileSync(join(dir, 'package-lock.json'), 'utf-8')),
  ];
}

if (require.main === module) {
  const dir = process.argv[2] || join(__dirname, '..');
  const result = checkLockfilePins(...readProject(dir));
  (result.ok ? process.stdout : process.stderr).write(`${result.message}\n`);
  process.exitCode = result.ok ? 0 : 1;
}

module.exports = { checkLockfilePins, readProject };
