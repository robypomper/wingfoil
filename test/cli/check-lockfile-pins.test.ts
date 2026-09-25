/**
 * task-104-preserve-the-hoisted-emnapi-lock-entries-under-npm-11 (`bug-063`, REQ-SYS-09,
 * `spec-015` §3 stage 1) — `scripts/check-lockfile-pins.cjs`, the gate that fails when
 * `package-lock.json` loses a hoisted entry the release gate needs.
 *
 * **Why a second file rather than more cases in `lockfile-peer-overrides.test.ts`.** That suite
 * (task-080) pins the *state of the two committed files* and has no failure text of its own: it
 * reports `expect(received).toEqual([])` and leaves the reader to find out what an unhoisted peer
 * edge is. This file covers the *check* — a pure function plus a standalone `npm run check:lockfile`
 * entry point that a developer can run in a second after an install, whose failure names the
 * remediation. `bug-063` is the case for it: under npm 11.x a plain `npm install` used to delete both
 * `@emnapi` entries and report `up to date`, so the loss reached a commit with nothing to read.
 *
 * Deterministic and offline: every negative case is a synthetic manifest/lock pair built here, and the
 * one positive case over the real files reads them from disk. Nothing runs npm, and nothing keys on
 * npm's output — `dl-069` S1/E4 measured that the same lock produced two different npm error messages
 * three days apart, so the message is not a usable signal (task-080 AC6).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { checkLockfilePins, readProject } from '../../scripts/check-lockfile-pins.cjs';
import type { LockfilePinsManifest, LockfilePinsLockfile } from '../../scripts/check-lockfile-pins.cjs';

const REPO_ROOT = join(__dirname, '..', '..');
const SCRIPT = join(REPO_ROOT, 'scripts', 'check-lockfile-pins.cjs');

/**
 * A manifest and lock in the shape this repository is in after task-104: one nested `overrides` pin,
 * the same package declared as an exact root devDependency, and a hoisted lock entry at that version.
 */
function healthy(): { manifest: LockfilePinsManifest; lockfile: LockfilePinsLockfile } {
  return {
    manifest: {
      devDependencies: { '@emnapi/core': '1.11.3' },
      overrides: { '@napi-rs/wasm-runtime': { '@emnapi/core': '1.11.3' } },
    },
    lockfile: {
      packages: {
        'node_modules/@emnapi/core': { version: '1.11.3' },
        'node_modules/@napi-rs/wasm-runtime': { version: '1.1.6', peerDependencies: { '@emnapi/core': '^1.7.1' } },
      },
    },
  };
}

describe('scripts/check-lockfile-pins.cjs (task-104) — the healthy shape', () => {
  it('passes when the pin, the direct declaration and the hoisted entry all agree', () => {
    expect(checkLockfilePins(healthy().manifest, healthy().lockfile).ok).toBe(true);
  });

  it('passes on this repository’s own committed package.json and package-lock.json', () => {
    // The live regression guard: this is the assertion that goes red the moment someone commits a
    // lock with the @emnapi entries gone, which is bug-063 exactly.
    const result = checkLockfilePins(...readProject(REPO_ROOT));
    expect(result).toEqual({ ok: true, message: expect.any(String) });
  });
});

describe('scripts/check-lockfile-pins.cjs (task-104) — what it refuses', () => {
  it('fails when a pinned dependency has no hoisted lock entry, naming the edge', () => {
    const { manifest, lockfile } = healthy();
    const stripped = { packages: { 'node_modules/@napi-rs/wasm-runtime': lockfile.packages['@napi-rs/wasm-runtime'] ?? { version: '1.1.6', peerDependencies: { '@emnapi/core': '^1.7.1' } } } };
    const result = checkLockfilePins(manifest, stripped);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('@emnapi/core');
  });

  it('fails when the hoisted entry is at a version other than the pinned one', () => {
    const { manifest, lockfile } = healthy();
    const drifted: LockfilePinsLockfile = {
      packages: { ...lockfile.packages, 'node_modules/@emnapi/core': { version: '1.10.0' } },
    };
    const result = checkLockfilePins(manifest, drifted);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('1.10.0');
  });

  it('fails when a pin is not also declared as a direct dependency — the npm 11 pruning case', () => {
    // bug-063: `overrides` alone does not keep npm 11.x from dropping the hoisted entry on a plain
    // `npm install`. The direct declaration is what makes it survive, so its absence is a defect in
    // its own right even while the lock still happens to carry the entry.
    const { lockfile } = healthy();
    const result = checkLockfilePins({ overrides: { '@napi-rs/wasm-runtime': { '@emnapi/core': '1.11.3' } } }, lockfile);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('devDependencies');
  });

  it('fails when any hoisted package declares a required peer with nothing to resolve it from', () => {
    // The general form of bug-056, independent of the overrides block.
    const result = checkLockfilePins(
      {},
      { packages: { 'node_modules/some-pkg': { version: '1.0.0', peerDependencies: { 'absent-peer': '^1.0.0' } } } },
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain('absent-peer');
  });

  it('exempts peers the parent marks optional, so the check is not vacuously red', () => {
    const result = checkLockfilePins(
      {},
      {
        packages: {
          'node_modules/some-pkg': {
            version: '1.0.0',
            peerDependencies: { 'absent-peer': '^1.0.0' },
            peerDependenciesMeta: { 'absent-peer': { optional: true } },
          },
        },
      },
    );
    expect(result.ok).toBe(true);
  });

  it('names the remediation, not only the defect', () => {
    const result = checkLockfilePins({ overrides: { p: { dep: '1.0.0' } } }, { packages: {} });
    expect(result.ok).toBe(false);
    // A failure a reader cannot act on is what bug-063 already had: npm reported `up to date`.
    expect(result.message).toContain('npm install');
    expect(result.message).toContain('check:lockfile');
    expect(result.message).toContain('bug-063');
  });
});

describe('scripts/check-lockfile-pins.cjs (task-104) — the standalone entry point', () => {
  it('is wired as `npm run check:lockfile`', () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as {
      readonly scripts?: Readonly<Record<string, string>>;
    };
    expect(pkg.scripts?.['check:lockfile']).toBe('node scripts/check-lockfile-pins.cjs');
  });

  it('exits 0 on this repository', () => {
    const run = spawnSync(process.execPath, [SCRIPT], { cwd: REPO_ROOT, encoding: 'utf-8' });
    expect({ status: run.status, stderr: run.stderr }).toEqual({ status: 0, stderr: '' });
  });

  it('exits 1 and writes the remediation to stderr on a project whose lock lost the entry', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wf-lockpins-'));
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify(healthy().manifest));
      writeFileSync(join(dir, 'package-lock.json'), JSON.stringify({ packages: {} }));
      const run = spawnSync(process.execPath, [SCRIPT, dir], { cwd: REPO_ROOT, encoding: 'utf-8' });
      expect(run.status).toBe(1);
      expect(run.stderr).toContain('@emnapi/core');
      expect(run.stderr).toContain('check:lockfile');
      expect(run.stdout).toBe('');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('package.json (task-104 AC2) — the mechanism that makes the entries survive npm 11', () => {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as LockfilePinsManifest;

  it.each(['@emnapi/core', '@emnapi/runtime'])(
    'declares %s as an exact direct devDependency, not only as an overrides pin',
    (name) => {
      // `overrides` binds a version; it does not make npm record a node. Measured in this task's
      // Execution Notes: with the overrides block alone, `npm install` under npm 11.6.2 removes both
      // hoisted entries and reports `up to date`. With the direct declaration it keeps them.
      expect(pkg.devDependencies?.[name]).toMatch(/^\d+\.\d+\.\d+$/);
    },
  );
});
