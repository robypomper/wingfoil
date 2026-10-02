/** Options shared by {@link acquireDistLock} and {@link prepareDist}. */
export interface DistLockOptions {
  /** The pid the lock is taken for; defaults to this process. */
  readonly pid?: number;
  /** How long to wait for a live holder before refusing, in milliseconds. */
  readonly waitMs?: number;
  /** How often to look at the lock while waiting, in milliseconds. */
  readonly pollMs?: number;
  /** Where the one "waiting for pid N" line goes; defaults to stderr. */
  readonly log?: (message: string) => void;
  /** Whether a pid is a live process; defaults to `process.kill(pid, 0)`. */
  readonly isAlive?: (pid: number) => boolean;
}

/** The lock file guarding `<repoRoot>/dist/`: `<repoRoot>/.jest-dist.lock`. */
export function distLockPath(repoRoot: string): string;

/** Take the lock, waiting for a live holder; rejects naming the holder if the wait runs out. */
export function acquireDistLock(options: DistLockOptions & { readonly lockPath: string }): Promise<void>;

/** Remove the lock if `pid` holds it; returns whether it did. */
export function releaseDistLock(options: { readonly lockPath: string; readonly pid?: number }): boolean;

/** Take the lock, then delete `<repoRoot>/dist/` and call `build`. The lock stays held. */
export function prepareDist(options: DistLockOptions & { readonly repoRoot: string; readonly build: () => void }): Promise<void>;
