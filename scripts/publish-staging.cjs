#!/usr/bin/env node
/**
 * `npm run publish:staging` — spec-015 §2/§3 stages 2–3, adr-009 §3: the local-first staging flow.
 *
 *   1. pack the package (or take `--tarball`, which CI passes: the gate job's artifact);
 *   2. install and start an ephemeral Verdaccio on http://localhost:4873/ with its storage, config and
 *      users inside a throwaway work dir;
 *   3. register a throwaway user, keep its token in a work-dir `.npmrc` (never in the repo, never in `~`);
 *   4. `npm publish <tarball>` to staging with provenance explicitly off (no OIDC issuer at staging;
 *      `publishConfig.provenance: true` would otherwise apply, see task-059's handoff);
 *   5. `npm install --global wingfoil@<version>` from staging into a work-dir prefix and cache;
 *   6. run the dl-023 smoke (`scripts/e2e-smoke.cjs`) against the `wingfoil` now on PATH;
 *   7. tear down — stop Verdaccio, delete the work dir — on success and on every failure.
 *
 * The same script runs on a developer machine and in `.github/workflows/publish.yml`'s stage job; that is
 * the point (adr-009: no debugging CI through throwaway commits). It needs network access to npmjs (to
 * install Verdaccio and to proxy the package's dependencies) but never publishes anywhere except the
 * localhost registry it started, and it ignores any npm credentials in the calling environment.
 * Publishing a tarball runs no lifecycle scripts, so `prepublishOnly` is not re-run here — run the gate
 * (`npm run prepublishOnly`) first, as the workflow's gate job does. POSIX only (CI runs ubuntu).
 *
 * Usage: npm run publish:staging [-- --tarball path/to/wingfoil-X.Y.Z.tgz]
 */
'use strict';

const { spawn, spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { delimiter, dirname, join, resolve } = require('node:path');

const { runSmoke } = require('./e2e-smoke.cjs');

/** The transient staging registry address (spec-015 §1/§5) — passed as `--registry`, stored nowhere. */
const STAGING_REGISTRY = 'http://localhost:4873/';
/** Verdaccio release line used for staging (adr-009: MIT-licensed OSS). */
const VERDACCIO_PACKAGE = 'verdaccio@6';
/** How long Verdaccio gets to answer `/-/ping` before staging gives up. */
const REGISTRY_START_TIMEOUT_MS = 60_000;
/**
 * How long a stopped child gets to honour `SIGTERM` before `SIGKILL` (dl-057 item c). An order of
 * magnitude above a healthy Verdaccio's shutdown, and well below {@link REGISTRY_START_TIMEOUT_MS},
 * so the escalation can never fire before the start timeout that may call it.
 */
const REGISTRY_STOP_TIMEOUT_MS = 10_000;
/** How long `SIGKILL` gets before {@link stopProcess} resolves regardless (dl-057 item c). */
const SIGKILL_GRACE_MS = 2_000;

/** Every file and directory one staging run uses, all under its work dir. */
function stagingPaths(root) {
  return {
    root,
    storage: join(root, 'storage'),
    htpasswd: join(root, 'htpasswd'),
    config: join(root, 'verdaccio.yaml'),
    tools: join(root, 'tools'),
    pack: join(root, 'pack'),
    userconfig: join(root, 'npmrc'),
    globalconfig: join(root, 'npmrc-global'),
    cache: join(root, 'npm-cache'),
    prefix: join(root, 'prefix'),
  };
}

/**
 * Verdaccio config. The package under test gets NO uplink, so the smoke can only ever install the tarball
 * staged by this run — never a same-named package from npmjs; everything else proxies npmjs so the
 * package's dependencies resolve.
 */
function verdaccioConfig(paths, packageName = 'wingfoil') {
  return [
    `storage: ${JSON.stringify(paths.storage)}`,
    'auth:',
    '  htpasswd:',
    `    file: ${JSON.stringify(paths.htpasswd)}`,
    '    max_users: 1',
    'uplinks:',
    '  npmjs:',
    '    url: https://registry.npmjs.org/',
    'packages:',
    `  '${packageName}':`,
    '    access: $all',
    '    publish: $authenticated',
    "  '**':",
    '    access: $all',
    '    publish: $authenticated',
    '    proxy: npmjs',
    'listen: localhost:4873',
    'log: { type: stdout, format: pretty, level: warn }',
    '',
  ].join('\n');
}

/**
 * The environment every staging subprocess runs with: the caller's environment minus inherited npm
 * configuration (`npm run` injects `npm_config_*`) and registry credentials, with npm's user/global
 * config, cache and global prefix pointed into the work dir, and the prefix's `bin` first on PATH.
 */
function stagingEnv(base, paths) {
  const env = {};
  for (const [key, value] of Object.entries(base)) {
    const lower = key.toLowerCase();
    if (lower.startsWith('npm_config_') || lower === 'npm_token' || lower === 'node_auth_token') continue;
    env[key] = value;
  }
  env.npm_config_userconfig = paths.userconfig;
  env.npm_config_globalconfig = paths.globalconfig;
  env.npm_config_cache = paths.cache;
  env.npm_config_prefix = paths.prefix;
  env.PATH = [join(paths.prefix, 'bin'), base.PATH].filter(Boolean).join(delimiter);
  return env;
}

/** argv for publishing the tarball to staging only. */
function publishArgs(tarball) {
  return ['publish', tarball, '--registry', STAGING_REGISTRY, '--provenance=false'];
}

/** argv for the clean global install of the exact staged version. */
function installArgs(name, version) {
  return ['install', '--global', `${name}@${version}`, '--registry', STAGING_REGISTRY];
}

/** Parse `[--tarball <path>]`. */
function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--tarball' && argv[i + 1]) {
      options.tarball = argv[i + 1];
      i += 1;
    } else {
      throw new Error(`unknown or incomplete argument: ${argv[i]}`);
    }
  }
  return options;
}

/**
 * The staging flow over injectable effects. Resolves to the process exit code (0 = staged and smoked).
 * Teardown (registry stop, work-dir removal) runs on every path.
 */
async function runStaging({ name, version, tarball, effects, baseEnv = process.env }) {
  const workDir = effects.makeWorkDir();
  let registry;
  try {
    const paths = stagingPaths(workDir);
    const env = stagingEnv(baseEnv, paths);
    const file = tarball ?? effects.packTarball(paths, env);
    registry = await effects.startRegistry(paths, env);
    await effects.createToken(paths);
    effects.npm(publishArgs(file), env, paths);
    effects.npm(installArgs(name, version), env, paths);
    const report = effects.smoke(env, version);
    if (!report.ok) {
      effects.log('staging smoke FAILED — the build must not be promoted');
      return 1;
    }
    effects.log(`staged ${name}@${version} and smoke passed`);
    return 0;
  } catch (error) {
    effects.log(`staging FAILED: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    try {
      if (registry) await registry.stop();
    } finally {
      effects.removeWorkDir(workDir);
    }
  }
}

/** Run a command to completion with inherited stdio; throw on a non-zero exit. */
function run(command, args, options) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited ${result.status ?? result.error?.message}`);
  }
}

/**
 * Stop a child process without ever hanging (dl-057 item c): `SIGTERM`, then — if it has not exited
 * within `timeoutMs` — `SIGKILL`, then resolve after `killGraceMs` whether or not an `exit` was seen.
 * A child that ignores or stalls on `SIGTERM` can therefore no longer outlive the staging run, on a
 * developer machine as well as in CI. Resolves immediately, signalling nothing, if `hasExited()` is
 * already true, so a normal shutdown never waits out either interval.
 */
function stopProcess(child, options = {}) {
  const {
    hasExited = () => false,
    timeoutMs = REGISTRY_STOP_TIMEOUT_MS,
    killGraceMs = SIGKILL_GRACE_MS,
  } = options;
  return new Promise((done) => {
    if (hasExited()) return done();
    let timer;
    const finish = () => {
      if (timer) clearTimeout(timer);
      done();
    };
    child.once('exit', finish);
    child.kill('SIGTERM');
    timer = setTimeout(() => {
      child.kill('SIGKILL');
      timer = setTimeout(finish, killGraceMs);
      if (timer.unref) timer.unref();
    }, timeoutMs);
    if (timer.unref) timer.unref();
  });
}

async function registryAnswers() {
  try {
    return (await fetch(`${STAGING_REGISTRY}-/ping`)).ok;
  } catch {
    return false;
  }
}

/** The real effects: a filesystem work dir, a Verdaccio child process, npm subprocesses. */
function realEffects(repoRoot, log) {
  return {
    makeWorkDir: () => mkdtempSync(join(tmpdir(), 'wingfoil-staging-')),
    removeWorkDir: (dir) => rmSync(dir, { recursive: true, force: true }),
    packTarball: (paths, env) => {
      mkdirSync(paths.pack, { recursive: true });
      const out = spawnSync('npm', ['pack', '--json', '--pack-destination', paths.pack], {
        cwd: repoRoot,
        env,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'inherit'],
      });
      if (out.status !== 0) throw new Error(`npm pack exited ${out.status}`);
      const [packed] = JSON.parse(out.stdout.slice(Math.max(0, out.stdout.search(/^\[/m))));
      return join(paths.pack, packed.filename);
    },
    startRegistry: async (paths, env) => {
      if (await registryAnswers()) throw new Error(`${STAGING_REGISTRY} is already in use — stop that registry first`);
      writeFileSync(paths.globalconfig, '');
      writeFileSync(paths.config, verdaccioConfig(paths));
      run('npm', ['install', '--prefix', paths.tools, '--no-save', '--no-audit', '--no-fund', VERDACCIO_PACKAGE], { env });
      const pkgDir = join(paths.tools, 'node_modules', 'verdaccio');
      const { bin } = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf-8'));
      const entry = join(pkgDir, typeof bin === 'string' ? bin : bin.verdaccio);
      const child = spawn(process.execPath, [entry, '--config', paths.config], { env, stdio: 'inherit' });
      let exited = false;
      child.on('exit', () => {
        exited = true;
      });
      const stop = () => stopProcess(child, { hasExited: () => exited });
      for (let waited = 0; !(await registryAnswers()); waited += 500) {
        if (exited || waited >= REGISTRY_START_TIMEOUT_MS) {
          await stop();
          throw new Error(`Verdaccio did not answer on ${STAGING_REGISTRY} (exited: ${exited})`);
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      log(`Verdaccio up on ${STAGING_REGISTRY}`);
      return { stop };
    },
    createToken: async (paths) => {
      const user = 'wingfoil-staging';
      const response = await fetch(`${STAGING_REGISTRY}-/user/org.couchdb.user:${user}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: user, password: randomBytes(24).toString('hex'), type: 'user', roles: [] }),
      });
      const body = await response.json();
      if (!response.ok || typeof body.token !== 'string') {
        throw new Error(`could not register the throwaway staging user (HTTP ${response.status})`);
      }
      const host = STAGING_REGISTRY.replace(/^https?:/, '');
      writeFileSync(paths.userconfig, `${host}:_authToken=${body.token}\n`, { mode: 0o600 });
    },
    npm: (args, env, paths) => run('npm', args, { env, cwd: paths.root }),
    smoke: (env, version) =>
      runSmoke({ command: 'wingfoil', env, expectedVersion: version, log: (line) => log(`  ${line}`) }),
    log,
  };
}

async function main() {
  const repoRoot = dirname(__dirname);
  const { name, version } = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf-8'));
  const { tarball } = parseArgs(process.argv.slice(2));
  const log = (line) => process.stdout.write(`[publish:staging] ${line}\n`);
  return runStaging({
    name,
    version,
    tarball: tarball === undefined ? undefined : resolve(tarball),
    effects: realEffects(repoRoot, log),
  });
}

if (require.main === module) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`error: ${error.message}\n`);
      process.exitCode = 2;
    },
  );
}

module.exports = {
  REGISTRY_STOP_TIMEOUT_MS,
  SIGKILL_GRACE_MS,
  STAGING_REGISTRY,
  VERDACCIO_PACKAGE,
  stagingPaths,
  verdaccioConfig,
  stagingEnv,
  publishArgs,
  installArgs,
  parseArgs,
  runStaging,
  stopProcess,
};
