/**
 * task-060-publish-pipeline — `scripts/publish-staging.cjs`, the local-first `publish:staging` flow
 * (`spec-015` §2/§3 stages 2–3, `adr-009` §3): ephemeral Verdaccio → publish → clean global install →
 * dl-023 smoke → teardown.
 *
 * Its real effects (installing and running Verdaccio, `npm publish`, `npm install -g`) contact a registry,
 * which no test may do. The orchestrator therefore takes its effects as a parameter; these cases drive it
 * with recording fakes and assert what must hold regardless of the network: step order, the staging-only
 * flags, the scrubbed environment, and that teardown runs on every failure path. The pure builders
 * (Verdaccio config, npm argv, env) are asserted directly.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';

import {
  REGISTRY_STOP_TIMEOUT_MS,
  STAGING_REGISTRY,
  installArgs,
  parseArgs,
  publishArgs,
  runStaging,
  stagingEnv,
  stagingPaths,
  stopProcess,
  verdaccioConfig,
} from '../../scripts/publish-staging.cjs';
import type { StagingEffects } from '../../scripts/publish-staging.cjs';

const WORK = '/tmp/wf-staging-test';

/** Recording fake effects; `failAt` makes the named effect throw (or the smoke fail). */
function fakeEffects(failAt?: string): { readonly effects: StagingEffects; readonly calls: string[] } {
  const calls: string[] = [];
  const maybeFail = (name: string): void => {
    if (failAt === name) throw new Error(`${name} failed`);
  };
  const effects: StagingEffects = {
    makeWorkDir: () => {
      calls.push('makeWorkDir');
      return WORK;
    },
    removeWorkDir: (dir) => {
      calls.push(`removeWorkDir ${dir}`);
    },
    packTarball: () => {
      calls.push('packTarball');
      maybeFail('packTarball');
      return `${WORK}/pack/wingfoil-0.2.0.tgz`;
    },
    startRegistry: async () => {
      calls.push('startRegistry');
      maybeFail('startRegistry');
      return {
        stop: async () => {
          calls.push('stopRegistry');
        },
      };
    },
    createToken: async () => {
      calls.push('createToken');
      maybeFail('createToken');
    },
    npm: (args) => {
      calls.push(`npm ${args[0]}`);
      maybeFail(`npm ${args[0]}`);
    },
    smoke: (_env, version) => {
      calls.push(`smoke ${version}`);
      return { ok: failAt !== 'smoke', checks: [{ label: 'wingfoil --help', ok: failAt !== 'smoke', detail: '' }] };
    },
    log: () => undefined,
  };
  return { effects, calls };
}

describe('publish:staging (task-060) — pure builders', () => {
  const paths = stagingPaths(WORK);

  it('stages on the transient localhost Verdaccio address (spec-015 §1/§5)', () => {
    expect(STAGING_REGISTRY).toBe('http://localhost:4873/');
  });

  it('keeps every staging file inside the run work dir', () => {
    for (const value of Object.values(paths)) {
      expect(value.startsWith(WORK)).toBe(true);
    }
  });

  it('publishes to staging only, with provenance explicitly off (task-059 handoff: no OIDC issuer at staging)', () => {
    const args = publishArgs('/x/wingfoil-0.2.0.tgz');
    expect(args.slice(0, 2)).toEqual(['publish', '/x/wingfoil-0.2.0.tgz']);
    expect(args).toEqual(expect.arrayContaining(['--registry', STAGING_REGISTRY, '--provenance=false']));
    expect(args.join(' ')).not.toContain('registry.npmjs.org');
  });

  it('installs the exact staged version globally from staging', () => {
    expect(installArgs('wingfoil', '0.2.0')).toEqual(['install', '--global', 'wingfoil@0.2.0', '--registry', STAGING_REGISTRY]);
  });

  it('never lets the real `wingfoil` on npmjs satisfy the install: no uplink for the package itself', () => {
    const config = verdaccioConfig(paths);
    const wingfoilBlock = config.split("'wingfoil':")[1]?.split("'**':")[0] ?? '';
    expect(wingfoilBlock).not.toBe('');
    expect(wingfoilBlock).not.toContain('proxy');
    expect(config.split("'**':")[1]).toContain('proxy: npmjs');
    expect(config).toContain(`storage: ${JSON.stringify(paths.storage)}`);
    expect(config).toContain('listen: localhost:4873');
  });

  it('scrubs inherited npm config and credentials, and isolates npm into the work dir', () => {
    const env = stagingEnv(
      {
        PATH: '/usr/bin',
        HOME: '/home/dev',
        npm_config_registry: 'https://registry.npmjs.org/',
        NPM_CONFIG_USERCONFIG: '/home/dev/.npmrc',
        npm_config__authtoken: 'x',
        NPM_TOKEN: 'x',
        NODE_AUTH_TOKEN: 'x',
      },
      paths,
    );
    expect(env.npm_config_registry).toBeUndefined();
    expect(env.NPM_CONFIG_USERCONFIG).toBeUndefined();
    expect(env.npm_config__authtoken).toBeUndefined();
    expect(env.NPM_TOKEN).toBeUndefined();
    expect(env.NODE_AUTH_TOKEN).toBeUndefined();
    expect(env).toMatchObject({
      HOME: '/home/dev',
      npm_config_userconfig: paths.userconfig,
      npm_config_globalconfig: paths.globalconfig,
      npm_config_cache: paths.cache,
      npm_config_prefix: paths.prefix,
      PATH: `${paths.prefix}/bin:/usr/bin`,
    });
  });

  it('parses an optional --tarball', () => {
    expect(parseArgs([])).toEqual({});
    expect(parseArgs(['--tarball', 'dist-pack/wingfoil-0.2.0.tgz'])).toEqual({ tarball: 'dist-pack/wingfoil-0.2.0.tgz' });
    expect(() => parseArgs(['--tarball'])).toThrow('--tarball');
    expect(() => parseArgs(['--registry', 'x'])).toThrow('--registry');
  });
});

describe('publish:staging (task-060) — orchestration', () => {
  const run = (effects: StagingEffects, tarball?: string): Promise<number> =>
    runStaging({ name: 'wingfoil', version: '0.2.0', tarball, effects });

  it('packs, stages, publishes, installs, smokes, then tears down — in that order', async () => {
    const { effects, calls } = fakeEffects();
    await expect(run(effects)).resolves.toBe(0);
    expect(calls).toEqual([
      'makeWorkDir',
      'packTarball',
      'startRegistry',
      'createToken',
      'npm publish',
      'npm install',
      'smoke 0.2.0',
      'stopRegistry',
      `removeWorkDir ${WORK}`,
    ]);
  });

  it('reuses a given tarball instead of packing (CI: the gate job’s artifact)', async () => {
    const { effects, calls } = fakeEffects();
    await expect(run(effects, 'dist-pack/wingfoil-0.2.0.tgz')).resolves.toBe(0);
    expect(calls).not.toContain('packTarball');
  });

  it.each([
    ['smoke', true],
    ['npm install', true],
    ['npm publish', true],
    ['createToken', true],
    ['startRegistry', false],
    ['packTarball', false],
  ])('fails (exit 1) when %s fails, and still tears down', async (failAt, registryStarted) => {
    const { effects, calls } = fakeEffects(failAt);
    await expect(run(effects)).resolves.toBe(1);
    expect(calls[calls.length - 1]).toBe(`removeWorkDir ${WORK}`);
    expect(calls.includes('stopRegistry')).toBe(registryStarted);
  });
});

/**
 * task-078 (`dl-057` item c) — `stopProcess`, the bounded stop the staging registry's `stop()` is built
 * from. The child processes below are plain `node -e` scripts: they touch no registry and no network.
 */
describe('stopProcess (task-078) — SIGTERM, then a bounded wait, then SIGKILL', () => {
  const children: ChildProcess[] = [];

  /** Spawn a `node -e` child and resolve once it has printed `ready` (so its handlers are installed). */
  async function spawnChild(script: string): Promise<ChildProcess> {
    const child = spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'ignore'] });
    children.push(child);
    for await (const chunk of child.stdout ?? []) {
      if (String(chunk).includes('ready')) break;
    }
    return child;
  }

  afterEach(() => {
    for (const child of children.splice(0)) child.kill('SIGKILL');
  });

  it('escalates to SIGKILL when the child ignores SIGTERM, and still resolves', async () => {
    const child = await spawnChild("process.on('SIGTERM', () => {}); console.log('ready'); setInterval(() => {}, 1000);");
    const exited = once(child, 'exit');
    await stopProcess(child, { timeoutMs: 250 });
    const [, signal] = (await exited) as [number | null, NodeJS.Signals | null];
    expect(signal).toBe('SIGKILL');
  });

  it('resolves as soon as a well-behaved child exits, without waiting out the interval', async () => {
    const child = await spawnChild("console.log('ready'); setInterval(() => {}, 1000);");
    const exited = once(child, 'exit');
    // A 30 s interval the test itself could never wait out: if the escalation delay were awaited
    // unconditionally, this case would fail on jest's 5 s timeout instead of passing.
    await stopProcess(child, { timeoutMs: 30_000 });
    const [, signal] = (await exited) as [number | null, NodeJS.Signals | null];
    expect(signal).toBe('SIGTERM');
  });

  it('resolves — and signals nothing — when the child has already exited', async () => {
    const child = await spawnChild("console.log('ready');");
    await once(child, 'exit');
    const signalled: string[] = [];
    const recorder = { ...child, kill: (s: string) => signalled.push(s) } as unknown as ChildProcess;
    await stopProcess(recorder, { hasExited: () => true, timeoutMs: 30_000 });
    expect(signalled).toEqual([]);
  });

  it('resolves even for a child that never exits at all, after SIGTERM then SIGKILL', async () => {
    const signalled: string[] = [];
    const deaf = {
      once: () => deaf,
      kill: (s: string) => {
        signalled.push(s);
        return true;
      },
    } as unknown as ChildProcess;
    await stopProcess(deaf, { timeoutMs: 20, killGraceMs: 20 });
    expect(signalled).toEqual(['SIGTERM', 'SIGKILL']);
  });

  it('defaults the escalation interval well below the registry start timeout it can be called from', () => {
    expect(REGISTRY_STOP_TIMEOUT_MS).toBe(10_000);
  });
});
