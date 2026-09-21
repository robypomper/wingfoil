/**
 * task-059-publish-metadata (`dl-018` T1, `spec-015` §1, REQ-SYS-09) — publish-surface acceptance tests.
 *
 * `task-007` delivered *packability*: `npm pack` yields a valid tarball (asserted by the sibling
 * `npm-distribution.test.ts`). It did not deliver *publishability* — `package.json` carried no
 * `repository`/`author`/`homepage`/`bugs` and no `publishConfig`, so `npm publish` could not attribute
 * the package, and `adr-009`'s provenance/OIDC promote step had no `repository.url` to attest against.
 * `spec-015` §1 fixes that field set as the contract; this file is its executable form.
 *
 * Scope is deliberately narrow — **metadata only**. The publish *gate* and *pipeline* (`prepublishOnly`,
 * `publish:staging`, `.github/workflows/publish.yml`; `spec-015` §2–§4) belong to `task-060`, and the
 * registry token (`spec-015` §5) to `task-061`, so nothing here asserts a script, a workflow file, or a
 * credential. What it does assert, per the task's T1 classification:
 *
 * - **red-first** — the four attribution fields and the `publishConfig` triple, all absent before this task.
 * - **characterization** — the `files` allowlist (reviewed, verdict "unchanged"), the absence of an
 *   `.npmignore` (`spec-015` §1 makes `files` the single source, avoiding the `files`/`.npmignore`
 *   double-negative), and the packed manifest being *exactly* `dist` + docs. These already held on
 *   `main`; the tests pin them as regression guards rather than fabricate a failure.
 *
 * On the manifest check: `npm-distribution.test.ts` asserts *inclusion* (`dist/cli.js` and `README.md`
 * are there) and two spot exclusions. That is satisfiable by a tarball that also ships something it
 * should not, so this file tightens it to an **exhaustive allowlist** — every packed path must be
 * `dist/**`, `README.md`, `LICENSE` (npm packs it regardless of `files`; task-070), or `package.json`.
 * A package that leaked `docs/self/` or dropped `dist/` fails here.
 *
 * Deterministic: both the parsed `package.json` and `npm pack --dry-run`'s file selection are pure
 * functions of the working tree — no clock, no network, no ordering assumptions (path sets are
 * compared as sorted arrays). `--ignore-scripts` skips the `prepack` rebuild, since jest's
 * `globalSetup` (`test/global-setup.cjs`) has already built `dist/` before any worker starts.
 *
 * `task-074-fix-engines-node-floor` (`bug-023`) later added the `engines.node` guard at the bottom of
 * this file — the same "metadata only" boundary, one field over. Its own header explains why it is
 * computed from the installed tree rather than pinned to a value.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..');
const PKG_PATH = join(REPO_ROOT, 'package.json');

/** The single GitHub `owner/repo` all three attribution URLs must agree on (`spec-015` §1). */
const REPO_SLUG = 'robypomper/wingfoil';

/** The `spec-015` §1 publish surface, as far as this task's assertions reach into it. */
interface PublishManifest {
  readonly repository?: { readonly type?: string; readonly url?: string };
  readonly author?: string;
  readonly homepage?: string;
  readonly bugs?: { readonly url?: string };
  readonly publishConfig?: {
    readonly registry?: string;
    readonly access?: string;
    readonly provenance?: boolean;
  };
  readonly files?: readonly string[];
  readonly bin?: Readonly<Record<string, string>>;
  readonly license?: string;
  /** task-074: the advertised runtime floor, and the closure it has to be true of. */
  readonly engines?: { readonly node?: string };
  readonly dependencies?: Readonly<Record<string, string>>;
}

interface PackedFile {
  readonly path: string;
}

interface PackResult {
  readonly files: readonly PackedFile[];
}

const rawPackageJson = readFileSync(PKG_PATH, 'utf-8');
const pkg = JSON.parse(rawPackageJson) as PublishManifest;

let cachedPackedPaths: readonly string[] | undefined;

/**
 * The exact paths `npm pack` would ship, via the same file selection `npm publish` uses.
 *
 * Memoized: the manifest is a pure function of the working tree, so every case in this file observes
 * the same tarball, and the (~1s) `npm pack` subprocess is spawned once rather than per assertion.
 */
function packedPaths(): readonly string[] {
  if (cachedPackedPaths === undefined) {
    const raw = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    });
    const [result] = JSON.parse(raw) as PackResult[];
    cachedPackedPaths = (result?.files ?? []).map((f) => f.path);
  }
  return cachedPackedPaths;
}

describe('publish metadata (task-059) — spec-015 §1 attribution fields', () => {
  it('declares `repository` as a git URL pointing at the project repo', () => {
    expect(pkg.repository).toEqual({
      type: 'git',
      url: `git+https://github.com/${REPO_SLUG}.git`,
    });
  });

  it('declares `author` with the maintainer identity', () => {
    expect(pkg.author).toBe('Roberto Pompermaier <robypomper@gmail.com>');
  });

  it('declares `homepage` as the repo README URL', () => {
    expect(pkg.homepage).toBe(`https://github.com/${REPO_SLUG}#readme`);
  });

  it('declares `bugs` as the repo issue tracker', () => {
    expect(pkg.bugs).toEqual({ url: `https://github.com/${REPO_SLUG}/issues` });
  });

  it('points `repository`, `homepage` and `bugs` at one and the same repo', () => {
    // npm provenance (adr-009 step 4) attests the build against `repository.url`; three URLs drifting
    // apart is the failure mode that turns a cosmetic typo into a broken promote step.
    for (const url of [pkg.repository?.url, pkg.homepage, pkg.bugs?.url]) {
      expect(url).toContain(`github.com/${REPO_SLUG}`);
    }
  });
});

describe('publish metadata (task-059) — spec-015 §1 publishConfig', () => {
  it('targets the public npm registry with public access and provenance', () => {
    expect(pkg.publishConfig).toEqual({
      registry: 'https://registry.npmjs.org/',
      access: 'public',
      provenance: true,
    });
  });

  it('records only the prod registry — never a staging address or a credential (spec-015 §5)', () => {
    // §5's security boundary: non-secret prod config lives here in git; the Verdaccio staging address
    // is transient (`--registry` passed by `publish:staging`, task-060) and the auth token lives only
    // in the CI secret store (task-061). None of the three may leak into the committed manifest.
    expect(pkg.publishConfig?.registry).not.toContain('localhost');
    expect(rawPackageJson).not.toContain('_authToken');
    expect(rawPackageJson).not.toContain('NPM_TOKEN');
  });
});

describe('publish metadata (task-059) — shipped file surface', () => {
  it('keeps `files` as the reviewed allowlist', () => {
    expect(pkg.files).toEqual(['dist', 'README.md']);
  });

  it('has no `.npmignore` — `files` is the single source (spec-015 §1)', () => {
    expect(existsSync(join(REPO_ROOT, '.npmignore'))).toBe(false);
  });

  it('packs exactly `dist` + docs — nothing else reaches the tarball', () => {
    const unexpected = packedPaths()
      .filter((p) => !p.startsWith('dist/') && p !== 'README.md' && p !== 'LICENSE' && p !== 'package.json')
      .sort();
    expect(unexpected).toEqual([]);
  });

  it('still packs the bin entrypoint and the README the tarball is required to carry (REQ-SYS-09)', () => {
    const paths = packedPaths();
    expect(paths).toContain('dist/cli.js');
    expect(paths).toContain('README.md');
  });
});

/* ---------------------------------------------------------------------------------------------- *
 * task-074-fix-engines-node-floor (`bug-023`, `spec-015` §1, REQ-SYS-09) — the declared
 * `engines.node` floor, checked against what the dependency tree actually accepts.
 *
 * `bug-023`: `package.json` declared `engines.node >=18.0.0` while the installed `commander@15`
 * declares `>=22.12.0`, so the published manifest promised a runtime its own dependencies reject.
 * npm's behaviour on such a package (measured in task-074's Execution Notes) is to warn `EBADENGINE`
 * and install anyway by default, and to hard-fail only under `engine-strict=true` — i.e. a false
 * floor is not caught by installing, which is why it survived `task-059` and would survive
 * `task-060`'s staging smoke, since that smoke runs on CI's Node >= 22.
 *
 * The guard is therefore *computed from the installed tree*, never hard-coded: naming the offending
 * package would pass the day a different dependency raises its own floor. It walks the **production**
 * closure — `dependencies`, transitively — because `files: ["dist", "README.md"]` means that is
 * exactly what a consumer of `wingfoil` installs, and `engines` is a promise about that closure.
 * devDependencies are deliberately out of scope: they never reach a consumer.
 *
 * Range arithmetic is done here rather than with `semver`. `require('semver')` resolves to 6.3.1 in
 * this tree (no `subset`); semver 7 exists only nested under devDependencies, as a hoisting accident;
 * and declaring the dependency would mean editing `package-lock.json` beyond the engines mirror this
 * task already owns — moving resolutions, which is out of scope here. The
 * evaluator below covers the comparator forms npm `engines` ranges actually use and **throws on
 * anything it does not understand**, so an unreadable range fails the suite instead of being quietly
 * treated as satisfied. It has its own unit tests at the bottom of this file.
 *
 * Deterministic and side-effect free: pure reads of the root manifest and of each installed package's
 * own `package.json`; no clock, no network, results sorted by package name. In particular it spawns
 * **no** subprocess, so it adds no new instance of `bug-022` (`npm pack` without `--ignore-scripts`);
 * the `packedPaths()` helper above, which does pack, is untouched and already passes that flag.
 * ---------------------------------------------------------------------------------------------- */

/** A fully-resolved `major.minor.patch` triple. */
type Version = readonly [number, number, number];

/** A version as written inside a range — 1 to 3 declared parts (`18`, `18.14`, `22.12.0`). */
type VersionParts = readonly number[];

/** One package reached by walking the production dependency closure. */
interface ClosureEntry {
  readonly name: string;
  readonly version: string;
  /** The package's own `engines.node` range, or `undefined` when it declares none. */
  readonly enginesNode: string | undefined;
}

/** The shape of any `package.json` this guard reads out of `node_modules`. */
interface InstalledManifest {
  readonly name?: string;
  readonly version?: string;
  readonly engines?: { readonly node?: string };
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
}

function compareVersions(a: Version, b: Version): number {
  for (let i = 0; i < 3; i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left !== right) return left < right ? -1 : 1;
  }
  return 0;
}

/** Parse `18`, `18.14` or `22.12.0` into its 1–3 declared parts. Throws on anything else. */
function parseVersionParts(raw: string): VersionParts {
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(raw);
  if (match === null) throw new Error(`unsupported version literal in engines range: "${raw}"`);
  return [match[1], match[2], match[3]]
    .filter((part): part is string => part !== undefined)
    .map((part) => Number(part));
}

/** Widen declared parts to a full triple, filling the unspecified tail with zeros. */
function toVersion(parts: VersionParts): Version {
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/** Exclusive upper bound of a bare/`=` X-range: `18` -> `19.0.0`, `18.14` -> `18.15.0`. */
function nextAfterParts(parts: VersionParts): Version {
  if (parts.length === 1) return [(parts[0] ?? 0) + 1, 0, 0];
  if (parts.length === 2) return [parts[0] ?? 0, (parts[1] ?? 0) + 1, 0];
  const exact = toVersion(parts);
  return [exact[0], exact[1], exact[2] + 1];
}

/** Exclusive upper bound of a `^` range — the next release allowed to break compatibility. */
function caretUpperBound(parts: VersionParts): Version {
  const [major = 0, minor = 0, patch = 0] = parts;
  if (major > 0 || parts.length === 1) return [major + 1, 0, 0];
  if (minor > 0 || parts.length === 2) return [0, minor + 1, 0];
  return [0, 0, patch + 1];
}

/** Exclusive upper bound of a `~` range — the next minor, or the next major when only one part. */
function tildeUpperBound(parts: VersionParts): Version {
  const [major = 0, minor = 0] = parts;
  if (parts.length === 1) return [major + 1, 0, 0];
  return [major, minor + 1, 0];
}

/** Does one comparator (`>=22.12.0`, `^20.19.0`, `>= 0.4`, `*`) admit `candidate`? */
function comparatorAllows(operator: string, literal: string, candidate: Version): boolean {
  if (literal === '*' || literal === 'x' || literal === 'X') {
    if (operator !== '') throw new Error(`unsupported engines comparator: "${operator}${literal}"`);
    return true;
  }
  const parts = parseVersionParts(literal);
  const lower = toVersion(parts);
  switch (operator) {
    case '>=':
      return compareVersions(candidate, lower) >= 0;
    case '>':
      return parts.length === 3
        ? compareVersions(candidate, lower) > 0
        : compareVersions(candidate, nextAfterParts(parts)) >= 0;
    case '<':
      return compareVersions(candidate, lower) < 0;
    case '<=':
      return parts.length === 3
        ? compareVersions(candidate, lower) <= 0
        : compareVersions(candidate, nextAfterParts(parts)) < 0;
    case '^':
      return (
        compareVersions(candidate, lower) >= 0 &&
        compareVersions(candidate, caretUpperBound(parts)) < 0
      );
    case '~':
      return (
        compareVersions(candidate, lower) >= 0 &&
        compareVersions(candidate, tildeUpperBound(parts)) < 0
      );
    case '':
    case '=':
      return (
        compareVersions(candidate, lower) >= 0 &&
        compareVersions(candidate, nextAfterParts(parts)) < 0
      );
    default:
      throw new Error(`unsupported engines comparator: "${operator}${literal}"`);
  }
}

/**
 * Does an npm `engines.node` range admit `candidate`?
 *
 * Supports `||`-separated alternatives of whitespace-separated comparators, the `>= > <= < =` and
 * `^ ~` operators (with or without a space before the literal), partial X-ranges and `*`. Everything
 * else — hyphen ranges, prereleases, build metadata — throws, by design: see the header note.
 */
function rangeAllows(range: string, candidate: Version): boolean {
  const trimmed = range.trim();
  if (trimmed === '') return true;
  if (/\s-\s/.test(trimmed)) throw new Error(`unsupported engines range (hyphen): "${range}"`);
  return trimmed.split('||').some((clause) => {
    const comparatorPattern = /(\^|~|>=|<=|>|<|=)?\s*(\d+(?:\.\d+){0,2}|[*xX])/g;
    let consumedTo = 0;
    let sawComparator = false;
    let clauseAllows = true;
    for (const match of clause.matchAll(comparatorPattern)) {
      const at = match.index ?? 0;
      if (clause.slice(consumedTo, at).trim() !== '') {
        throw new Error(`unsupported engines range syntax: "${range}"`);
      }
      consumedTo = at + (match[0] ?? '').length;
      sawComparator = true;
      if (!comparatorAllows(match[1] ?? '', match[2] ?? '', candidate)) clauseAllows = false;
    }
    if (clause.slice(consumedTo).trim() !== '') {
      throw new Error(`unsupported engines range syntax: "${range}"`);
    }
    if (!sawComparator) throw new Error(`unsupported engines range syntax: "${range}"`);
    return clauseAllows;
  });
}

/**
 * The single lowest Node version this package claims to run on.
 *
 * Deliberately narrow: only a plain `>=major.minor.patch` is accepted, so "the floor" is a
 * well-defined number rather than something inferred from a compound range. A maintainer who needs a
 * compound `engines.node` has to teach this guard what the advertised floor then means, instead of
 * silently weakening it.
 */
function parseNodeFloor(declared: string | undefined): Version {
  const match = /^>=\s*(\d+)\.(\d+)\.(\d+)$/.exec(declared ?? '');
  if (match === null) {
    throw new Error(
      `engines.node must be a plain ">=major.minor.patch" floor; found ${JSON.stringify(declared)}`,
    );
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Locate a package's manifest the way Node resolves it: `node_modules` upwards, bounded at the repo root. */
function resolveInstalledManifest(name: string, fromDir: string): string | undefined {
  let dir = fromDir;
  for (;;) {
    const candidate = join(dir, 'node_modules', name, 'package.json');
    if (existsSync(candidate)) return candidate;
    if (dir === REPO_ROOT) return undefined;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

let cachedClosure: readonly ClosureEntry[] | undefined;

/**
 * Every package a consumer of `wingfoil` installs: the transitive closure of `dependencies` over the
 * installed tree, sorted by name. An unresolvable non-optional dependency is an error rather than a
 * silent gap — a guard that skips what it cannot find is a guard that passes for the wrong reason.
 */
function productionClosure(): readonly ClosureEntry[] {
  if (cachedClosure !== undefined) return cachedClosure;
  const entries: ClosureEntry[] = [];
  const visited = new Set<string>();
  const queue: { readonly name: string; readonly fromDir: string; readonly optional: boolean }[] =
    Object.keys(pkg.dependencies ?? {}).map((name) => ({
      name,
      fromDir: REPO_ROOT,
      optional: false,
    }));

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const item = queue[cursor];
    if (item === undefined) continue;
    const manifestPath = resolveInstalledManifest(item.name, item.fromDir);
    if (manifestPath === undefined) {
      if (item.optional) continue;
      throw new Error(
        `production dependency "${item.name}" is not installed (resolved from ${item.fromDir}) — ` +
          'install dependencies before running this suite',
      );
    }
    if (visited.has(manifestPath)) continue;
    visited.add(manifestPath);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as InstalledManifest;
    entries.push({
      name: manifest.name ?? item.name,
      version: manifest.version ?? 'unknown',
      enginesNode: manifest.engines?.node,
    });
    const ownDir = dirname(manifestPath);
    const optionalNames = new Set(Object.keys(manifest.optionalDependencies ?? {}));
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      queue.push({ name: dependency, fromDir: ownDir, optional: optionalNames.has(dependency) });
    }
  }

  cachedClosure = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  return cachedClosure;
}

describe('publish surface (task-074) — `engines.node` vs the production dependency closure', () => {
  it('declares `engines.node` as a plain `>=major.minor.patch` floor (bug-023)', () => {
    expect(pkg.engines?.node).toMatch(/^>=\d+\.\d+\.\d+$/);
  });

  it('declares a floor every production dependency accepts (bug-023, REQ-SYS-09)', () => {
    const floor = parseNodeFloor(pkg.engines?.node);
    const rejected = productionClosure()
      .filter((entry) => entry.enginesNode !== undefined)
      .filter((entry) => !rangeAllows(entry.enginesNode ?? '', floor))
      .map((entry) => `${entry.name}@${entry.version} requires node ${entry.enginesNode ?? ''}`);
    // A non-empty list means the published manifest promises a Node version some dependency refuses:
    // npm warns EBADENGINE on install and hard-fails under `engine-strict=true`.
    expect(rejected).toEqual([]);
  });

  it('really walks the tree — the guard cannot pass by finding nothing', () => {
    // Without this, a broken walk (wrong root, or unresolved deps quietly skipped) would make the
    // check above vacuously green — the failure mode a "no violations" assertion cannot see alone.
    const closure = productionClosure();
    expect(closure.map((entry) => entry.name)).toContain('commander');
    expect(closure.filter((entry) => entry.enginesNode !== undefined).length).toBeGreaterThan(10);
  });
});

describe('publish surface (task-074) — the engines-range evaluator itself', () => {
  const rangeCases: [string, Version, boolean][] = [
    ['>=18', [22, 12, 0], true],
    ['>=22.12.0', [22, 12, 0], true],
    ['>=22.12.0', [22, 11, 9], false],
    ['>= 0.4', [22, 12, 0], true],
    ['>=18.14.1', [18, 14, 0], false],
    ['>18', [19, 0, 0], true],
    ['>18', [18, 20, 0], false],
    ['<24', [22, 12, 0], true],
    ['<=18', [18, 99, 0], true],
    ['^22.13.0', [22, 12, 0], false],
    ['^22.13.0', [22, 13, 0], true],
    ['^20.19.0 || ^22.13.0 || >=24', [22, 12, 0], false],
    ['^20.19.0 || ^22.13.0 || >=24', [24, 0, 0], true],
    ['^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0', [22, 12, 0], true],
    ['^0.4.2', [0, 4, 9], true],
    ['^0.4.2', [0, 5, 0], false],
    ['~22.12', [22, 12, 9], true],
    ['~22.12', [22, 13, 0], false],
    ['>=18 <23', [22, 12, 0], true],
    ['>=18 <23', [23, 0, 0], false],
    ['*', [22, 12, 0], true],
    ['22.12.0', [22, 12, 0], true],
    ['22', [22, 12, 0], true],
  ];

  it.each(rangeCases)('reads "%s" against %j as %s', (range, candidate, expected) => {
    expect(rangeAllows(range, candidate)).toBe(expected);
  });

  it.each([['1.2.3 - 2.0.0'], ['>=18.0.0-beta'], ['>=nonsense'], ['^^18'], ['>=*']])(
    'refuses "%s" rather than treating it as satisfied',
    (range) => {
      expect(() => rangeAllows(range, [22, 12, 0])).toThrow(/unsupported/);
    },
  );

  it.each([['^20 || >=22'], ['>=18'], ['18.0.0'], [undefined]])(
    'refuses %j as an advertised floor — it is not a single `>=major.minor.patch`',
    (declared) => {
      expect(() => parseNodeFloor(declared)).toThrow(/plain ">=major\.minor\.patch" floor/);
    },
  );

  it('reads a well-formed floor', () => {
    expect(parseNodeFloor('>=22.12.0')).toEqual([22, 12, 0]);
  });
});
