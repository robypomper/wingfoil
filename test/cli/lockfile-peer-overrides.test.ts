/**
 * task-080-fix-npm-ci-under-pinned-npm (REQ-SYS-09, `spec-015` §3 stage 1) — the lock must carry every
 * peer this repository pins.
 *
 * `bug-056` is `npm ci` exiting 1 under npm **10.9.0** — the npm Node 22.12.0 bundles, and 22.12.0 is
 * what `.github/workflows/publish.yml` pins in `env.NODE_VERSION` — on a lockfile that installs fine
 * under the npm 11.6.2 a developer here happens to have. The cause is structural, not a stale version:
 * `@napi-rs/wasm-runtime` declares the peers `@emnapi/core` and `@emnapi/runtime`, the lock records no
 * **hoisted** entry for either, and npm 10.9 therefore resolves them from the registry at install time
 * and then refuses the lock for not containing what it just resolved. `dl-069` option (b) closes it by
 * pinning those peers from `package.json`'s `overrides`, so the resolution comes from the manifest and
 * the resolved nodes are recorded in the lock.
 *
 * **What this file can and cannot do.** It does *not* detect lockfile drift in general: `dl-069` E3
 * measured that offline, with a cold cache, `npm ci --dry-run` exits 0 on a lock that demonstrably does
 * not install, so detection would need registry data — which the `determinism` directive (REQ-SYS-07)
 * and the `testing` directive forbid a unit test to reach for. What it pins instead is a purely local
 * property of two committed files: **every peer pinned in `overrides` has a hoisted lock entry at
 * exactly the pinned version, and the package it is pinned for still declares it as a peer.** That is
 * the property whose absence *is* `bug-056`, and it is the one that silently reverts — a plain
 * `npm install` under npm 11.x re-resolves the tree and drops both hoisted entries again (measured in
 * this task's Execution Notes, `green`/D1), taking the release gate down with it and touching nothing
 * else in the diff.
 *
 * Deterministic and offline by construction: it reads `package.json` and `package-lock.json` and never
 * runs npm. Nothing here keys on npm's output — `dl-069` S1/E4 (the same lock produced two different
 * error messages three days apart) make the message unusable as a signal, and task-080 AC6 forbids it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..');

/** A `package-lock.json` entry, reduced to the fields this file reasons about. */
interface LockPackage {
  readonly version?: string;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly peerDependenciesMeta?: Readonly<Record<string, { readonly optional?: boolean }>>;
}

interface Lockfile {
  readonly packages: Readonly<Record<string, LockPackage>>;
}

/**
 * `overrides` as this repository uses it: nested, i.e. scoped to the package whose edge is being
 * pinned (`{ "<parent>": { "<dependency>": "<exact version>" } }`). The flat form — a bare
 * `"<dependency>": "<version>"` — would pin that dependency everywhere in the tree; it is rejected
 * below rather than supported, because the whole point of the pin is to stay attributable.
 */
interface Manifest {
  readonly overrides?: Readonly<Record<string, unknown>>;
}

const manifest = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as Manifest;
const lockfile = JSON.parse(readFileSync(join(REPO_ROOT, 'package-lock.json'), 'utf-8')) as Lockfile;

/** An exact semver release — no range operator, no prerelease. Anything else re-resolves on install. */
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

/** One pinned edge: the package the pin is scoped to, the dependency pinned, and the version. */
interface OverridePin {
  readonly parent: string;
  readonly dependency: string;
  readonly version: string;
}

/** Every pinned edge declared in the nested `overrides` block, in declaration order. */
function overridePins(): readonly OverridePin[] {
  const pins: OverridePin[] = [];
  for (const [parent, edges] of Object.entries(manifest.overrides ?? {})) {
    if (typeof edges !== 'object' || edges === null) continue;
    for (const [dependency, version] of Object.entries(edges as Record<string, string>)) {
      pins.push({ parent, dependency, version });
    }
  }
  return pins;
}

/** `"<parent> → <dependency>"`, so a failure names the edge rather than an array index. */
function edgeLabel(pin: OverridePin): string {
  return `${pin.parent} -> ${pin.dependency}`;
}

describe('package.json overrides (task-080) — shape', () => {
  it('declares at least one override, scoped to the package whose edge it pins', () => {
    // The `@emnapi` peers are the reason the block exists (bug-056); the assertion is on the shape, so
    // a later pin for another package keeps this file honest without editing it.
    expect(overridePins().length).toBeGreaterThan(0);
  });

  it('uses the nested form only — never a tree-wide flat pin', () => {
    const flat = Object.entries(manifest.overrides ?? {})
      .filter(([, edges]) => typeof edges !== 'object' || edges === null)
      .map(([parent]) => parent);
    expect(flat).toEqual([]);
  });

  it('pins exact versions, since a range would be re-resolved from the registry', () => {
    const ranged = overridePins()
      .filter((pin) => !EXACT_VERSION.test(pin.version))
      .map((pin) => `${edgeLabel(pin)}@${pin.version}`);
    expect(ranged).toEqual([]);
  });
});

/**
 * Every hoisted `node_modules/<name>` entry, as `[name, entry]`. Nested entries
 * (`node_modules/a/node_modules/b`) are excluded: a peer edge is satisfied from the **hoisted**
 * position, which is exactly why the nested `@emnapi/core@1.10.0` under
 * `@unrs/resolver-binding-wasm32-wasi` never satisfied `@napi-rs/wasm-runtime`'s peer.
 */
function hoistedEntries(): readonly (readonly [string, LockPackage])[] {
  return Object.entries(lockfile.packages)
    .filter(([path]) => path.startsWith('node_modules/') && !path.slice('node_modules/'.length).includes('/node_modules/'))
    .map(([path, entry]) => [path.slice('node_modules/'.length), entry] as const);
}

describe('package-lock.json (task-080 AC4) — required peer edges resolve from the lock', () => {
  it('hoists every required peer any hoisted package declares', () => {
    // The general form of bug-056: a peer npm must install, with no hoisted entry to install it from,
    // is resolved from the registry at install time — and then `npm ci` refuses the lock for not
    // containing what it just resolved. Peers marked `peerDependenciesMeta.<name>.optional` are
    // exempt: npm may legitimately leave them out of the tree (the lock has nine such edges — jest's
    // `node-notifier`, eslint's `jiti` and so on — before and after this task).
    const unhoisted: string[] = [];
    for (const [name, entry] of hoistedEntries()) {
      for (const peer of Object.keys(entry.peerDependencies ?? {})) {
        if (entry.peerDependenciesMeta?.[peer]?.optional === true) continue;
        if (lockfile.packages[`node_modules/${peer}`] === undefined) unhoisted.push(`${name} -> ${peer}`);
      }
    }
    expect(unhoisted).toEqual([]);
  });
});

describe('package-lock.json (task-080 AC4) — every pinned peer is hoisted in the lock', () => {
  it('records a hoisted entry for each overridden dependency', () => {
    // Without the hoisted entry npm resolves the edge from the registry at install time and then
    // refuses the lock for not containing what it resolved — that failure is bug-056.
    const unhoisted = overridePins()
      .filter((pin) => lockfile.packages[`node_modules/${pin.dependency}`] === undefined)
      .map(edgeLabel);
    expect(unhoisted).toEqual([]);
  });

  it('records the hoisted entry at exactly the pinned version', () => {
    const mismatched = overridePins()
      .filter((pin) => lockfile.packages[`node_modules/${pin.dependency}`]?.version !== pin.version)
      .map((pin) => {
        const found = lockfile.packages[`node_modules/${pin.dependency}`]?.version ?? 'absent';
        return `${edgeLabel(pin)}: pinned ${pin.version}, lock has ${found}`;
      });
    expect(mismatched).toEqual([]);
  });

  it('pins only edges the parent package still declares', () => {
    const stale = overridePins()
      .filter((pin) => {
        const parentEntry = lockfile.packages[`node_modules/${pin.parent}`];
        if (parentEntry === undefined) return true;
        const declared = { ...(parentEntry.dependencies ?? {}), ...(parentEntry.peerDependencies ?? {}) };
        return !Object.prototype.hasOwnProperty.call(declared, pin.dependency);
      })
      .map(edgeLabel);
    expect(stale).toEqual([]);
  });
});
