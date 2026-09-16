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
 * `dist/**`, `README.md`, or `package.json`. A package that leaked `docs/self/` or dropped `dist/`
 * fails here.
 *
 * Deterministic: both the parsed `package.json` and `npm pack --dry-run`'s file selection are pure
 * functions of the working tree — no clock, no network, no ordering assumptions (path sets are
 * compared as sorted arrays). `--ignore-scripts` skips the `prepack` rebuild, since jest's
 * `globalSetup` (`test/global-setup.cjs`) has already built `dist/` before any worker starts.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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
}

interface PackedFile {
  readonly path: string;
}

interface PackResult {
  readonly files: readonly PackedFile[];
}

const rawPackageJson = readFileSync(PKG_PATH, 'utf-8');
const pkg = JSON.parse(rawPackageJson) as PublishManifest;

/** The exact paths `npm pack` would ship, via the same file selection `npm publish` uses. */
function packedPaths(): readonly string[] {
  const raw = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
  });
  const [result] = JSON.parse(raw) as PackResult[];
  return (result?.files ?? []).map((f) => f.path);
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
      .filter((p) => !p.startsWith('dist/') && p !== 'README.md' && p !== 'package.json')
      .sort();
    expect(unexpected).toEqual([]);
  });

  it('still packs the bin entrypoint and the README the tarball is required to carry (REQ-SYS-09)', () => {
    const paths = packedPaths();
    expect(paths).toContain('dist/cli.js');
    expect(paths).toContain('README.md');
  });
});
