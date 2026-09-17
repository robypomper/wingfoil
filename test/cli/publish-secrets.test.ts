/**
 * task-061-publish-secrets (`dl-018` T4, `adr-009` §5, `spec-015` §5, REQ-SYS-09) — the publish secret,
 * the transient `.npmrc`, the approver's release gate and the rollback posture, asserted offline.
 *
 * Nothing here contacts a registry or holds a credential. The promote publish step's shell script is
 * lifted out of `.github/workflows/publish.yml` and run for real with bash, but with a fake `npm` first
 * on `PATH` that only records what it saw; the "token" is the spec-007 §3 placeholder shape
 * `XXXXXXXXXXXXXXXXXXXX`, which the secret scan exempts by construction.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { load as yamlLoad } from 'js-yaml';

const REPO_ROOT = join(__dirname, '..', '..');
const WORKFLOW_PATH = join(REPO_ROOT, '.github', 'workflows', 'publish.yml');

/** The exact line spec-015 §5 prescribes — a literal `${NPM_TOKEN}` reference npm expands at read time. */
const NPMRC_LINE = '//registry.npmjs.org/:_authToken=${NPM_TOKEN}';
const FAKE_TOKEN = 'XXXXXXXXXXXXXXXXXXXX';

interface WorkflowStep {
  readonly name?: string;
  readonly uses?: string;
  readonly run?: string;
  readonly if?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly with?: Readonly<Record<string, unknown>>;
}

interface WorkflowJob {
  readonly environment?: string | { readonly name: string };
  readonly env?: Readonly<Record<string, string>>;
  readonly steps: readonly WorkflowStep[];
}

interface Workflow {
  readonly env?: Readonly<Record<string, string>>;
  readonly jobs: Readonly<Record<string, WorkflowJob>>;
}

const raw = readFileSync(WORKFLOW_PATH, 'utf-8');
const workflow = yamlLoad(raw) as Workflow;
const promote = workflow.jobs.promote;
const publishStep = promote?.steps.find((s) => s.run?.includes('npm publish'));

describe('publish secret (task-061) — spec-015 §5 NPM_TOKEN from the Actions secret store', () => {
  it('maps secrets.NPM_TOKEN into the promote publish step only', () => {
    expect(publishStep?.env).toEqual({ NPM_TOKEN: '${{ secrets.NPM_TOKEN }}' });
    const secretRefs = raw.match(/secrets\.[A-Za-z_]+/g) ?? [];
    expect(secretRefs).toEqual(['secrets.NPM_TOKEN']);
    expect(workflow.env).not.toHaveProperty('NPM_TOKEN');
    expect(promote?.env).toBeUndefined();
  });

  it('writes the spec-015 §5 .npmrc line with the token as an unexpanded reference', () => {
    expect(publishStep?.run).toContain(`'${NPMRC_LINE}'`);
  });

  it('keeps the promote job checkout-free, so the transient .npmrc has no git tree to be committed from', () => {
    expect(promote?.steps.some((s) => s.uses?.startsWith('actions/checkout@'))).toBe(false);
  });

  it('git-ignores .npmrc, so a developer-local token file cannot be committed either', () => {
    const result = spawnSync('git', ['check-ignore', '--no-index', '-q', '.npmrc'], { cwd: REPO_ROOT });
    expect(result.status).toBe(0);
  });

  it('does not persist the GitHub token into any checkout (actions/checkout persist-credentials: false)', () => {
    const checkouts = Object.values(workflow.jobs).flatMap((job) =>
      job.steps.filter((s) => s.uses?.startsWith('actions/checkout@')),
    );
    expect(checkouts.length).toBeGreaterThan(0);
    for (const step of checkouts) expect(step.with?.['persist-credentials']).toBe(false);
  });
});

describe('promote publish step (task-061) — the transient .npmrc, executed with a fake npm', () => {
  let work: string;

  beforeEach(() => {
    work = mkdtempSync(join(tmpdir(), 'wf-promote-'));
    mkdirSync(join(work, 'bin'));
    mkdirSync(join(work, 'dist-pack'));
    writeFileSync(join(work, 'dist-pack', 'wingfoil-0.2.0.tgz'), 'not a real tarball');
    // Records argv, the cwd .npmrc as npm would find it, and whether the token reached npm's env.
    writeFileSync(
      join(work, 'bin', 'npm'),
      [
        '#!/usr/bin/env bash',
        'printf "%s\\n" "$*" > "$RECORD_DIR/args"',
        'if [ -f .npmrc ]; then cp .npmrc "$RECORD_DIR/npmrc-seen"; fi',
        'if [ "${NPM_TOKEN:-}" = "$EXPECTED_TOKEN" ]; then touch "$RECORD_DIR/token-in-env"; fi',
        'exit "${FAKE_NPM_EXIT:-0}"',
      ].join('\n'),
    );
    chmodSync(join(work, 'bin', 'npm'), 0o755);
    mkdirSync(join(work, 'record'));
  });

  afterEach(() => rmSync(work, { recursive: true, force: true }));

  /** Run the step's script as GitHub's default bash shell does (`bash --noprofile --norc -eo pipefail`). */
  function runStep(env: Record<string, string>): number | null {
    const result = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', publishStep?.run ?? 'exit 99'], {
      cwd: work,
      encoding: 'utf-8',
      env: {
        PATH: `${join(work, 'bin')}:${process.env.PATH ?? ''}`,
        RECORD_DIR: join(work, 'record'),
        EXPECTED_TOKEN: FAKE_TOKEN,
        ...env,
      },
    });
    return result.status;
  }

  it('publishes the staged tarball with provenance while the .npmrc exists, never writing the token value', () => {
    expect(runStep({ NPM_TOKEN: FAKE_TOKEN })).toBe(0);
    expect(readFileSync(join(work, 'record', 'npmrc-seen'), 'utf-8')).toBe(`${NPMRC_LINE}\n`);
    expect(existsSync(join(work, 'record', 'token-in-env'))).toBe(true);
    const args = readFileSync(join(work, 'record', 'args'), 'utf-8');
    expect(args).toContain('publish dist-pack/wingfoil-0.2.0.tgz');
    expect(args).toContain('--provenance');
  });

  it('removes the .npmrc after a successful publish', () => {
    expect(runStep({ NPM_TOKEN: FAKE_TOKEN })).toBe(0);
    expect(existsSync(join(work, '.npmrc'))).toBe(false);
  });

  it('removes the .npmrc and fails the step when npm publish fails', () => {
    expect(runStep({ NPM_TOKEN: FAKE_TOKEN, FAKE_NPM_EXIT: '1' })).not.toBe(0);
    expect(existsSync(join(work, 'record', 'npmrc-seen'))).toBe(true);
    expect(existsSync(join(work, '.npmrc'))).toBe(false);
  });

  it('fails before writing anything or calling npm when the secret is not configured', () => {
    expect(runStep({ NPM_TOKEN: '' })).not.toBe(0);
    expect(existsSync(join(work, 'record', 'args'))).toBe(false);
    expect(existsSync(join(work, '.npmrc'))).toBe(false);
  });
});

describe('release authorization and rollback (task-061) — spec-015 §5, adr-006', () => {
  it('runs promote in the protected `npm-publish` environment — the approver gate', () => {
    expect(promote?.environment).toBe('npm-publish');
    expect(workflow.jobs.gate?.environment).toBeUndefined();
    expect(workflow.jobs.stage?.environment).toBeUndefined();
  });

  it('documents the approver runbook: environment protection, providing and rotating NPM_TOKEN', () => {
    expect(raw).toContain('approver');
    expect(raw).toContain('adr-006');
    expect(raw).toMatch(/required reviewer/i);
    expect(raw).toMatch(/environment secret/i);
    expect(raw).toMatch(/rotat/i);
    expect(raw).toMatch(/revoke/i);
  });

  it('documents rollback as npm deprecate + a patch release, not npm unpublish', () => {
    expect(raw).toContain('npm deprecate wingfoil@');
    expect(raw).toMatch(/patch release/i);
    expect(raw).toContain('npm unpublish');
    expect(raw).toMatch(/failed stage.*blocks promote|stage fails.*promote never runs/i);
  });
});
