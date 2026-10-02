/**
 * The promote job's credential, the approver's release gates and the rollback posture, asserted
 * offline. Originally `task-061-publish-secrets` (`dl-018` T4, `adr-009` §5): a long-lived
 * `NPM_TOKEN` written to a transient `.npmrc`. Since `task-113` (`adr-011`, `spec-015` §3 stage 4
 * and §5 as amended on 2026-09-29, `dl-087`) there is **no credential at all**: `promote` stages
 * the tarball with `npm stage publish`, authenticated by a stage-only npm trusted publisher over
 * GitHub OIDC, and a maintainer's 2FA approval on npm makes the version live.
 *
 * Nothing here contacts a registry or holds a credential. The promote step's shell script is lifted
 * out of `.github/workflows/publish.yml` and run for real with bash, with a fake `npm` first on
 * `PATH` that only records what it saw.
 */
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { load as yamlLoad } from 'js-yaml';

import { withCallerEnv } from './helpers/npm-env';

const REPO_ROOT = join(__dirname, '..', '..');
const WORKFLOW_PATH = join(REPO_ROOT, '.github', 'workflows', 'publish.yml');

/** The environment variable the retired token lived in — split so this suite's own grep stays honest. */
const RETIRED_TOKEN_VAR = ['NPM', 'TOKEN'].join('_');

interface RunDefaults {
  readonly run?: { readonly shell?: string };
}

interface WorkflowStep {
  readonly name?: string;
  readonly uses?: string;
  readonly run?: string;
  readonly shell?: string;
  readonly if?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly with?: Readonly<Record<string, unknown>>;
}

interface WorkflowJob {
  readonly environment?: string | { readonly name: string };
  readonly env?: Readonly<Record<string, string>>;
  readonly permissions?: Readonly<Record<string, string>>;
  readonly defaults?: RunDefaults;
  readonly steps: readonly WorkflowStep[];
}

interface Workflow {
  readonly env?: Readonly<Record<string, string>>;
  readonly defaults?: RunDefaults;
  readonly jobs: Readonly<Record<string, WorkflowJob>>;
}

const raw = readFileSync(WORKFLOW_PATH, 'utf-8');
const workflow = yamlLoad(raw) as Workflow;
const promote = workflow.jobs.promote;
const stageStep = promote?.steps.find((s) => s.run?.includes('npm stage publish'));

describe('promote credential (task-113) — spec-015 §5: a stage-only OIDC trusted publisher, no token', () => {
  it('stages the tarball with `npm stage publish`, and nothing in promote runs a plain `npm publish`', () => {
    expect(stageStep).toBeDefined();
    const promoteRuns = (promote?.steps ?? []).map((s) => s.run ?? '').join('\n');
    expect(promoteRuns).not.toContain('npm publish');
  });

  it('reads no secret anywhere in the workflow', () => {
    expect(raw.match(/secrets\.[A-Za-z_]+/g)).toBeNull();
  });

  it('names the retired token nowhere in the workflow — not in a step, not in the header', () => {
    expect(raw).not.toContain(RETIRED_TOKEN_VAR);
    expect(raw).not.toContain('NODE_AUTH_TOKEN');
    expect(raw).not.toContain('_authToken');
  });

  it('writes no .npmrc and hands npm no user config', () => {
    for (const step of promote?.steps ?? []) {
      expect(step.run ?? '').not.toContain('.npmrc');
      expect(step.run ?? '').not.toContain('--userconfig');
      expect(step.with ?? {}).not.toHaveProperty('registry-url');
    }
  });

  it('gives the stage step no env of its own; the promote job env carries only its Node pin', () => {
    expect(stageStep?.env).toBeUndefined();
    expect(Object.keys(promote?.env ?? {})).toEqual(['PROMOTE_NODE_VERSION']);
    expect(workflow.env).not.toHaveProperty(RETIRED_TOKEN_VAR);
  });

  it('holds `id-token: write`, the OIDC grant the trusted publisher and provenance both use', () => {
    expect(promote?.permissions).toEqual({ contents: 'read', 'id-token': 'write' });
  });

  it('keeps the promote job checkout-free: it stages the gate tarball, not a tree', () => {
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

/**
 * task-078 (`dl-057` item f) — shell tracing in the promote step once would have printed the token
 * test with the token **expanded** into the job log. Since task-113 the step holds no secret, but the
 * rule stays: it is free, and it would matter again the day a credential came back.
 */
describe('promote stage step (task-078) — no shell tracing', () => {
  /** Every way a bash step can end up tracing its commands. */
  const TRACING_PATTERNS: readonly (readonly [string, RegExp])[] = [
    // `x` anywhere in a short-option cluster, so `set -euxo pipefail` is caught as well as `set -x`.
    ['set -x (anywhere in the body, including an option cluster)', /(^|\n|[;&|(]\s*)\s*set\s+-[a-zA-Z]*x[a-zA-Z]*(\s|$)/],
    ['set -o xtrace', /set\s+-o\s+xtrace/],
    ['bash -x', /\bbash\s+-[a-zA-Z]*x\b/],
    ['the literal word xtrace', /\bxtrace\b/],
    ['SHELLOPTS / BASH_XTRACEFD manipulation', /\b(SHELLOPTS|BASH_XTRACEFD)\b/],
  ];

  it.each(TRACING_PATTERNS)('carries no %s', (_label, pattern) => {
    expect(stageStep?.run ?? '').not.toMatch(pattern);
  });

  it('turns tracing off explicitly as its very first command', () => {
    const lines = (stageStep?.run ?? '').split('\n');
    expect(lines[0]?.trim()).toBe('set +x');
  });

  it('lets no shell override reintroduce tracing — step, job or workflow defaults', () => {
    expect(stageStep?.shell).toBeUndefined();
    expect(workflow.defaults?.run?.shell).toBeUndefined();
    expect(promote?.defaults?.run?.shell).toBeUndefined();
  });
});

describe('promote stage step (task-113) — executed with a fake npm', () => {
  let work: string;

  beforeEach(() => {
    work = mkdtempSync(join(tmpdir(), 'wf-promote-'));
    mkdirSync(join(work, 'bin'));
    mkdirSync(join(work, 'dist-pack'));
    writeFileSync(join(work, 'dist-pack', 'wingfoil-0.2.0.tgz'), 'not a real tarball');
    // Records argv, and whether any .npmrc sat in the cwd when npm was called.
    writeFileSync(
      join(work, 'bin', 'npm'),
      [
        '#!/usr/bin/env bash',
        'printf "%s\\n" "$*" > "$RECORD_DIR/args"',
        'if [ -e .npmrc ]; then touch "$RECORD_DIR/npmrc-seen"; fi',
        'exit "${FAKE_NPM_EXIT:-0}"',
      ].join('\n'),
    );
    chmodSync(join(work, 'bin', 'npm'), 0o755);
    mkdirSync(join(work, 'record'));
  });

  afterEach(() => rmSync(work, { recursive: true, force: true }));

  /**
   * Run the step's script as GitHub's default bash shell does (`bash --noprofile --norc -eo pipefail`),
   * with an environment that holds no npm credential of any kind.
   */
  function runStep(env: Record<string, string> = {}): number | null {
    const result = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', stageStep?.run ?? 'exit 99'], {
      cwd: work,
      encoding: 'utf-8',
      env: {
        PATH: `${join(work, 'bin')}:${process.env.PATH ?? ''}`,
        RECORD_DIR: join(work, 'record'),
        ...env,
      },
    });
    return result.status;
  }

  it('stages the gate tarball with provenance and public access, with no credential in its environment', () => {
    expect(runStep()).toBe(0);
    const args = readFileSync(join(work, 'record', 'args'), 'utf-8').trim();
    // task-108 (bug-135): the explicit `./` keeps npm from reading `dist-pack/<file>` as a GitHub
    // `user/repo` shorthand. adr-011 / dl-068 Action 4: `--access` is accepted by `npm stage publish`.
    expect(args).toBe('stage publish ./dist-pack/wingfoil-0.2.0.tgz --provenance --access public');
  });

  it('leaves no .npmrc in the workspace, before or after npm runs', () => {
    expect(runStep()).toBe(0);
    expect(existsSync(join(work, 'record', 'npmrc-seen'))).toBe(false);
    expect(existsSync(join(work, '.npmrc'))).toBe(false);
  });

  it('fails the step when npm stage publish fails', () => {
    expect(runStep({ FAKE_NPM_EXIT: '1' })).not.toBe(0);
    expect(existsSync(join(work, 'record', 'args'))).toBe(true);
  });
});

describe('release authorization and rollback — spec-015 §5, adr-006, adr-011', () => {
  it('runs promote in the protected `npm-publish` environment — the GitHub deployment gate', () => {
    expect(promote?.environment).toBe('npm-publish');
    expect(workflow.jobs.gate?.environment).toBeUndefined();
    expect(workflow.jobs.stage?.environment).toBeUndefined();
  });

  it('keeps the environment runbook: required reviewer, `v*` tags, approver role (adr-006)', () => {
    expect(raw).toContain('approver');
    expect(raw).toContain('adr-006');
    expect(raw).toMatch(/required reviewer/i);
    expect(raw).toContain('`v*`');
  });

  /**
   * AC 5 — the registry-side steps, in the order the approver must take them. Each needle is a phrase
   * the runbook states; the order of their first occurrence *inside the runbook block* (from its
   * heading to the rollback paragraph — the header names the trusted publisher earlier too) is the
   * order of the steps.
   */
  it('states the registry-side runbook steps in their order (task-113 AC 5, adr-011 point 5)', () => {
    const from = raw.indexOf('Approver runbook');
    const to = raw.indexOf('Rollback posture');
    expect(from).toBeGreaterThanOrEqual(0);
    expect(to).toBeGreaterThan(from);
    const runbook = raw.slice(from, to);
    const steps = [
      /two-factor authentication \(2FA\) on the approver's npm account/i,
      /trusted publisher/i,
      /organisation `wingfoil`, repository `wingfoil`, workflow `publish\.yml`, environment `npm-publish`/,
      /require two-factor authentication and disallow tokens/i,
      /revoke the stage-only token/i,
      /delete the environment secret/i,
      /npm stage view/,
      /npm stage approve/,
    ];
    const at = steps.map((re) => runbook.search(re));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(runbook).toMatch(/permission limited to staging/i);
    expect(runbook).toContain('task-116');
  });

  it('documents rollback as npm deprecate + a patch release, not npm unpublish', () => {
    expect(raw).toContain('npm deprecate wingfoil@');
    expect(raw).toMatch(/patch release/i);
    expect(raw).toContain('npm unpublish');
    expect(raw).toMatch(/failed stage.*blocks promote|stage fails.*promote never runs/i);
    expect(raw).toContain('npm stage reject');
  });
});

/**
 * task-108 (bug-135) — the fake npm above records argv but cannot parse a package spec, which is how
 * `npm publish dist-pack/*.tgz` passed every test and then failed the first real run (exit 128: npm
 * read the path as a GitHub shorthand and ran `git ls-remote`). Here a REAL npm parses the step's own
 * tarball argument, offline and as a dry run, against a packed fixture.
 *
 * task-113: the step now runs `npm stage publish`, which the npm on a developer's machine may not
 * have (it needs npm ≥ 11.15.0). The test still runs `npm publish`, because `stage publish` IS
 * `publish` for argument parsing: npm 11.19.0's `lib/commands/stage/publish.js` is
 * `class StagePublish extends Publish` with `static params = Publish.params` and only
 * `static stage = true` added. What is under test is the spec, and the spec is parsed by the parent. `--offline` does not stop npm
 * from trying git on a git-shaped spec, so a stub `git` sits first on PATH: it records any call and
 * fails at once, keeping the test off the network and making "npm never reached for git" assertable.
 */
describe('promote publish step (task-108) — a real npm reads the tarball argument as a file', () => {
  let work: string;

  beforeEach(() => {
    work = mkdtempSync(join(tmpdir(), 'wf-promote-npm-'));
    mkdirSync(join(work, 'bin'));
    mkdirSync(join(work, 'fixture'));
    mkdirSync(join(work, 'dist-pack'));
    writeFileSync(join(work, 'bin', 'git'), '#!/usr/bin/env bash\ntouch "$(dirname "$0")/git-called"\nexit 128\n');
    chmodSync(join(work, 'bin', 'git'), 0o755);
    writeFileSync(join(work, 'npmrc'), '');
    writeFileSync(join(work, 'fixture', 'package.json'), JSON.stringify({ name: 'wf-fixture', version: '1.0.0' }));
    const pack = spawnSync('npm', ['pack', '--ignore-scripts', '--pack-destination', join(work, 'dist-pack')], {
      cwd: join(work, 'fixture'),
      encoding: 'utf-8',
      env: npmEnv(),
    });
    if (pack.status !== 0) throw new Error(`fixture npm pack failed: ${pack.stderr}`);
  });

  afterEach(() => rmSync(work, { recursive: true, force: true }));

  /** npm with an empty user config and a throwaway cache, and the stub git first on PATH. */
  function npmEnv(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      PATH: `${join(work, 'bin')}:${process.env.PATH ?? ''}`,
      npm_config_userconfig: join(work, 'npmrc'),
      npm_config_cache: join(work, 'cache'),
    };
  }

  /** Run the step's own tarball argument through a real `npm publish --dry-run`. */
  function dryRunPublish(): SpawnSyncReturns<string> {
    const arg = /npm stage publish (\S+)/.exec(stageStep?.run ?? '')?.[1];
    expect(arg).toBeDefined();
    // The argument is spliced unquoted, exactly as the step's shell sees it, so its glob expands the same way.
    return spawnSync(
      'bash',
      ['-c', `npm publish ${arg ?? ''} --dry-run --ignore-scripts --offline --registry http://localhost:9/ --provenance=false`],
      { cwd: work, encoding: 'utf-8', env: npmEnv() },
    );
  }

  it('publishes (dry run) the tarball the step names, without npm ever invoking git', () => {
    const result = dryRunPublish();
    expect(existsSync(join(work, 'bin', 'git-called'))).toBe(false);
    expect(result.stderr).not.toContain('ls-remote');
    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('+ wf-fixture@1.0.0');
  }, 60_000);

  /*
   * bug-181 / bug-167 (task-146): `npm run -s …` exports `npm_config_loglevel=silent` to the suite, and
   * the inner npm used to inherit it and print nothing, so the case above failed under `npm run -s
   * test:coverage` and passed under `npm run test:coverage`. The invariant the fix restores (testing
   * directive, T2) is that the inner npm reads no npm configuration from the caller: only the
   * throwaway files this fixture names. Both cases inject the condition themselves, so they fail
   * wherever the suite runs if the leak returns, not only under `npm run -s`.
   */
  it('hands the inner npm none of the caller\'s npm configuration, in either letter case', () => {
    const env = withCallerEnv({ npm_config_loglevel: 'silent', NPM_CONFIG_DRY_RUN: 'false' }, () => npmEnv());
    expect(Object.keys(env).filter((k) => /^npm_config_/i.test(k)).sort()).toEqual([
      'npm_config_cache',
      'npm_config_globalconfig',
      'npm_config_userconfig',
    ]);
    expect(env.npm_config_globalconfig).toBe(join(work, 'npmrc'));
  });

  it('publishes (dry run) the same way when the caller runs the suite with npm_config_loglevel=silent', () => {
    const result = withCallerEnv({ npm_config_loglevel: 'silent' }, () => dryRunPublish());
    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('+ wf-fixture@1.0.0');
  }, 60_000);
});

