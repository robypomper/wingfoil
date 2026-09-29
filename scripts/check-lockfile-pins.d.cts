/** One `package-lock.json` entry, reduced to the fields {@link checkLockfilePins} reasons about. */
export interface LockfilePackage {
  /** The package's real name, recorded when it differs from its install path (an `npm:` alias). */
  readonly name?: string;
  /** The resolved version of this node. */
  readonly version?: string;
  /** Peers this package requires, by name, as declared ranges. */
  readonly peerDependencies?: Readonly<Record<string, string>>;
  /** Per-peer metadata; `optional: true` exempts that peer from needing a hoisted entry. */
  readonly peerDependenciesMeta?: Readonly<Record<string, { readonly optional?: boolean }>>;
}

/** A `package-lock.json`, reduced to its `packages` map keyed by install path. */
export interface LockfilePinsLockfile {
  /** Every node in the tree, keyed by its path (`""` is the root, `node_modules/x` a hoisted one). */
  readonly packages: Readonly<Record<string, LockfilePackage>>;
}

/**
 * A `package.json`, reduced to what the check reads: the direct declarations and the nested
 * `overrides` block (`{ "<parent>": { "<dependency>": "<exact version>" } }`).
 */
export interface LockfilePinsManifest {
  /** Direct runtime dependencies, by name. */
  readonly dependencies?: Readonly<Record<string, string>>;
  /** Direct development dependencies, by name. */
  readonly devDependencies?: Readonly<Record<string, string>>;
  /** Transitive-edge pins, scoped to the package whose edge is pinned. */
  readonly overrides?: Readonly<Record<string, unknown>>;
}

/** Outcome of {@link checkLockfilePins}. */
export interface LockfilePinsCheck {
  /** `true` only when every pin is hoisted, declared and exact, and every required peer resolves. */
  readonly ok: boolean;
  /** The verdict, and on failure the defects plus what to do about them. */
  readonly message: string;
}

/**
 * task-104 / `bug-063`: assert `package-lock.json` still carries the hoisted entries the release gate
 * needs and that the direct declarations keeping them there are still present.
 */
export function checkLockfilePins(
  manifest: LockfilePinsManifest,
  lockfile: LockfilePinsLockfile,
): LockfilePinsCheck;

/** Read `dir`'s `package.json` and `package-lock.json` as the pair {@link checkLockfilePins} takes. */
export function readProject(dir: string): [LockfilePinsManifest, LockfilePinsLockfile];
