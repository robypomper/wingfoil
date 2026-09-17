/**
 * task-060-publish-pipeline (`dl-018` T3, `adr-009`, `spec-015` §2–§4, REQ-SYS-09) — the publish gate,
 * the CI workflow shape and the tag scheme, asserted offline.
 *
 * Sibling of `publish-metadata.test.ts` (task-059, `spec-015` §1). Kept in its own file so the two
 * contracts evolve independently — that suite's packed-contents allowlist is edited by other tasks.
 *
 * Nothing here contacts a registry or needs a credential:
 * - `package.json` and `.github/workflows/publish.yml` are parsed from the working tree;
 * - the one `npm publish --dry-run` runs with `--offline`, `--ignore-scripts` and a `localhost` registry,
 *   so any fetch npm might attempt fails locally instead of reaching the network, and the `prepack`
 *   rebuild of the shared `dist/` is skipped (the trap `bug-022` describes in `npm-distribution.test.ts`).
 *
 * The staging orchestration (`scripts/publish-staging.cjs`), the dl-023 smoke (`scripts/e2e-smoke.cjs`) and
 * the tag check (`scripts/check-release-tag.cjs`) have their own suites: `publish-staging.test.ts`,
 * `e2e-smoke.test.ts`, `check-release-tag.test.ts`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { load as yamlLoad } from 'js-yaml';

const REPO_ROOT = join(__dirname, '..', '..');
const WORKFLOW_PATH = join(REPO_ROOT, '.github', 'workflows', 'publish.yml');

interface PipelineManifest {
  readonly version: string;
  readonly bin?: Readonly<Record<string, string>>;
  readonly scripts?: Readonly<Record<string, string>>;
}

interface WorkflowStep {
  readonly name?: string;
  readonly uses?: string;
  readonly run?: string;
  readonly if?: string;
  readonly with?: Readonly<Record<string, unknown>>;
}

interface WorkflowJob {
  readonly needs?: string | readonly string[];
  readonly if?: string;
  readonly permissions?: Readonly<Record<string, string>>;
  readonly steps: readonly WorkflowStep[];
}

interface Workflow {
  readonly on: Readonly<Record<string, unknown>>;
  readonly permissions?: Readonly<Record<string, string>>;
  readonly env?: Readonly<Record<string, string>>;
  readonly jobs: Readonly<Record<string, WorkflowJob>>;
}

const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as PipelineManifest;

function readWorkflow(): { readonly raw: string; readonly parsed: Workflow } {
  const raw = readFileSync(WORKFLOW_PATH, 'utf-8');
  return { raw, parsed: yamlLoad(raw) as Workflow };
}

/** Every `run:` script of a job, joined — the unit the ordering assertions below read. */
function runs(job: WorkflowJob | undefined): string {
  return (job?.steps ?? []).map((s) => s.run ?? '').join('\n');
}

describe('publish gate (task-060) — spec-015 §2 scripts', () => {
  it('declares `prepublishOnly` as build && test && lint, in that order', () => {
    expect(pkg.scripts?.prepublishOnly).toBe('npm run build && npm test && npm run lint');
  });

  it('declares `publish:staging` as the local-first entry point running scripts/publish-staging', () => {
    expect(pkg.scripts?.['publish:staging']).toBe('node scripts/publish-staging.cjs');
    expect(existsSync(join(REPO_ROOT, 'scripts', 'publish-staging.cjs'))).toBe(true);
  });

  it('leaves the existing build/prepack/test/lint scripts unchanged (spec-015 §2)', () => {
    expect(pkg.scripts).toMatchObject({
      build: 'tsc -p tsconfig.build.json',
      prepack: 'npm run build',
      test: 'jest',
      lint: 'eslint .',
    });
  });
});

describe('bin entry (bug-020) — spec-015 §1 amended: no leading `./`', () => {
  it('declares `bin.wingfoil` as `dist/cli.js`', () => {
    expect(pkg.bin).toEqual({ wingfoil: 'dist/cli.js' });
  });

  it('`npm publish --dry-run` (the stage-1 gate) no longer auto-corrects the manifest', () => {
    const result = spawnSync(
      'npm',
      ['publish', '--dry-run', '--offline', '--ignore-scripts', '--registry', 'http://localhost:4873/', '--provenance=false'],
      { cwd: REPO_ROOT, encoding: 'utf-8' },
    );
    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain('auto-corrected');
    expect(result.stderr).not.toContain('bin[wingfoil]');
  });
});

describe('publish workflow (task-060) — spec-015 §3 / adr-009', () => {
  it('exists at .github/workflows/publish.yml', () => {
    expect(existsSync(WORKFLOW_PATH)).toBe(true);
  });

  it('triggers only on a `vX.Y.Z` tag push — no branch, PR or manual trigger', () => {
    const { parsed } = readWorkflow();
    expect(Object.keys(parsed.on)).toEqual(['push']);
    expect(parsed.on.push).toEqual({ tags: ['v[0-9]+.[0-9]+.[0-9]+'] });
  });

  it('runs gate → stage → promote as a strict `needs` chain', () => {
    const { parsed } = readWorkflow();
    expect(Object.keys(parsed.jobs)).toEqual(['gate', 'stage', 'promote']);
    expect(parsed.jobs.gate?.needs).toBeUndefined();
    expect(parsed.jobs.stage?.needs).toBe('gate');
    expect(parsed.jobs.promote?.needs).toBe('stage');
  });

  it('gate asserts tag-on-main + tag↔version, then prepublishOnly, the dry-run manifest, and packs once', () => {
    const script = runs(readWorkflow().parsed.jobs.gate);
    const order = [
      'git merge-base --is-ancestor "$GITHUB_SHA" origin/main',
      'node scripts/check-release-tag.cjs "$GITHUB_REF_NAME"',
      'npm ci',
      'npm run prepublishOnly',
      'npm publish --dry-run --ignore-scripts',
      'npm pack --ignore-scripts --pack-destination',
    ].map((cmd) => script.indexOf(cmd));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('stage runs the same local-first staging script against the gate tarball', () => {
    const { parsed } = readWorkflow();
    expect(runs(parsed.jobs.stage)).toContain('npm run publish:staging -- --tarball');
    const download = parsed.jobs.stage?.steps.find((s) => s.uses?.startsWith('actions/download-artifact@'));
    const upload = parsed.jobs.gate?.steps.find((s) => s.uses?.startsWith('actions/upload-artifact@'));
    expect(download?.with?.name).toBeDefined();
    expect(download?.with?.name).toBe(upload?.with?.name);
  });

  it('promote publishes the same tarball with provenance, skipped under act', () => {
    const { parsed } = readWorkflow();
    const promote = parsed.jobs.promote;
    const download = promote?.steps.find((s) => s.uses?.startsWith('actions/download-artifact@'));
    expect(download?.with?.name).toBe(parsed.jobs.gate?.steps.find((s) => s.uses?.startsWith('actions/upload-artifact@'))?.with?.name);
    const publish = promote?.steps.find((s) => s.run?.includes('npm publish'));
    expect(publish?.run).toContain('--provenance');
    expect(publish?.run).not.toContain('--dry-run');
    expect(publish?.if).toBe('${{ !env.ACT }}');
  });

  it('grants `id-token: write` (OIDC provenance) to promote only; the workflow default is read-only', () => {
    const { parsed } = readWorkflow();
    expect(parsed.permissions).toEqual({ contents: 'read' });
    expect(parsed.jobs.promote?.permissions).toEqual({ contents: 'read', 'id-token': 'write' });
    expect(parsed.jobs.gate?.permissions).toBeUndefined();
    expect(parsed.jobs.stage?.permissions).toBeUndefined();
  });

  it('pins one Node version for every job and ties the choice to bug-023', () => {
    const { raw, parsed } = readWorkflow();
    expect(parsed.env?.NODE_VERSION).toBe('22.12.0');
    for (const job of Object.values(parsed.jobs)) {
      const setup = job.steps.find((s) => s.uses?.startsWith('actions/setup-node@'));
      expect(setup?.with?.['node-version']).toBe('${{ env.NODE_VERSION }}');
    }
    expect(raw).toContain('bug-023');
  });

  it('gate and stage carry no registry credential — the token is promote-only (spec-015 §5, task-061)', () => {
    const { parsed } = readWorkflow();
    for (const job of [parsed.jobs.gate, parsed.jobs.stage]) {
      const text = JSON.stringify(job);
      expect(text).not.toContain('NPM_TOKEN');
      expect(text).not.toContain('NODE_AUTH_TOKEN');
      expect(text).not.toContain('_authToken');
    }
  });

  it('documents how to exercise the workflow locally with `act` (spec-015 §3)', () => {
    const { raw } = readWorkflow();
    expect(raw).toContain('act push');
    expect(raw).toContain('--artifact-server-path');
  });
});
