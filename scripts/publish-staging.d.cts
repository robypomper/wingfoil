import type { SmokeReport } from './e2e-smoke.cjs';

/** Every file and directory one staging run uses, all under its work dir. */
export interface StagingPaths {
  readonly root: string;
  readonly storage: string;
  readonly htpasswd: string;
  readonly config: string;
  readonly tools: string;
  readonly pack: string;
  readonly userconfig: string;
  readonly globalconfig: string;
  readonly cache: string;
  readonly prefix: string;
}

/** A started staging registry. */
export interface StagingRegistry {
  /** Stop the registry process. */
  stop(): Promise<void>;
}

/** The side effects {@link runStaging} orchestrates — real in the script, faked in tests. */
export interface StagingEffects {
  /** Create the throwaway work dir. */
  makeWorkDir(): string;
  /** Delete the work dir (teardown). */
  removeWorkDir(dir: string): void;
  /** Pack the package into `paths.pack`; returns the tarball path. */
  packTarball(paths: StagingPaths, env: NodeJS.ProcessEnv): string;
  /** Install and start Verdaccio; resolves once it answers. */
  startRegistry(paths: StagingPaths, env: NodeJS.ProcessEnv): Promise<StagingRegistry>;
  /** Register a throwaway user and write its token to `paths.userconfig`. */
  createToken(paths: StagingPaths): Promise<void>;
  /** Run `npm <args>`; throws on a non-zero exit. */
  npm(args: readonly string[], env: NodeJS.ProcessEnv, paths: StagingPaths): void;
  /** Run the dl-023 smoke against the installed `wingfoil`. */
  smoke(env: NodeJS.ProcessEnv, version: string): SmokeReport;
  /** Progress sink. */
  log(line: string): void;
}

/** Options for {@link runStaging}. */
export interface StagingOptions {
  /** Package name (`package.json` `name`). */
  readonly name: string;
  /** Package version (`package.json` `version`). */
  readonly version: string;
  /** A pre-built tarball to stage instead of packing (CI: the gate job's artifact). */
  readonly tarball?: string;
  /** The effects to run. */
  readonly effects: StagingEffects;
  /** Environment to derive the staging environment from (defaults to `process.env`). */
  readonly baseEnv?: NodeJS.ProcessEnv;
}

/** The transient staging registry address. */
export const STAGING_REGISTRY: string;
/** The Verdaccio package spec installed for staging. */
export const VERDACCIO_PACKAGE: string;

/** Work-dir layout for one staging run. */
export function stagingPaths(root: string): StagingPaths;
/** Verdaccio config: no uplink for the package under test, npmjs proxy for everything else. */
export function verdaccioConfig(paths: StagingPaths, packageName?: string): string;
/** Scrubbed, work-dir-isolated environment for every staging subprocess. */
export function stagingEnv(base: NodeJS.ProcessEnv, paths: StagingPaths): NodeJS.ProcessEnv;
/** argv publishing a tarball to staging, provenance off. */
export function publishArgs(tarball: string): string[];
/** argv globally installing the exact staged version from staging. */
export function installArgs(name: string, version: string): string[];
/** Parse `[--tarball <path>]`. */
export function parseArgs(argv: readonly string[]): { tarball?: string };
/** Run the staging flow; resolves to the exit code. Teardown runs on every path. */
export function runStaging(options: StagingOptions): Promise<number>;
