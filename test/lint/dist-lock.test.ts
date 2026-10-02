/**
 * Harness gate — one jest run at a time owns a worktree's `dist/`
 * (task-146-make-suite-result-independent-concurrent-runs-machine-load, `bug-095`).
 *
 * `test/global-setup.cjs` deletes and rebuilds `dist/` at the start of every run (`bug-003`). Two runs
 * in one worktree used to race on it: the second deleted the build the first was still spawning
 * `node dist/cli.js` from, and the first reported ordinary-looking failures that vanished on a solitary
 * re-run. The setup now takes a lock file before it touches `dist/` and the teardown releases it. A
 * second run waits for the lock, and refuses with a message naming the holder's pid if it is not
 * released in time. It never deletes a `dist/` another live run holds.
 *
 * What is asserted here, on temporary directories so the suite's own `dist/` is never touched:
 * - a free lock is taken and records the taker's pid;
 * - a lock held by a live process (this worker's parent) makes a second taker wait, and it takes the
 *   lock once the holder releases it;
 * - a lock still held when the wait ends is refused with a message naming the holder's pid and the
 *   lock path, and the refused setup neither deletes `dist/` nor builds;
 * - a lock left by a dead process (a run killed before its teardown) is taken over;
 * - a release removes only the releaser's own lock, so a nested jest (`coverage-parity.test.ts`) or a
 *   refused run cannot release the lock of the run that holds it;
 * - `jest.config.js` wires the setup and the teardown that do this.
 *
 * Deterministic in outcome: the waits are bounded and polled, and no assertion depends on how long a
 * step took — only on the order of the events.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { acquireDistLock, distLockPath, prepareDist, releaseDistLock } from '../dist-lock.cjs';

const REPO_ROOT = join(__dirname, '..', '..');

/** A pid that is certainly alive and is not this process: the jest worker's parent. */
const LIVE_OTHER_PID = process.ppid;

/** A pid that certainly belonged to a process that has exited. */
function deadPid(): number {
  const child = spawnSync(process.execPath, ['-e', '']);
  if (child.pid === undefined) throw new Error('could not spawn a short-lived process');
  return child.pid;
}

function holder(lockPath: string): number {
  return Number(readFileSync(lockPath, 'utf-8').trim());
}

describe('dist/ lock (task-146, bug-095) — one jest run at a time owns a worktree\'s dist/', () => {
  let root: string;
  let lockPath: string;
  let messages: string[];
  const log = (message: string): void => {
    messages.push(message);
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'wf-dist-lock-'));
    lockPath = distLockPath(root);
    messages = [];
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('places the lock in the worktree root, next to the dist/ it guards', () => {
    expect(lockPath).toBe(join(root, '.jest-dist.lock'));
  });

  it('takes a free lock and records the taker\'s pid', async () => {
    await acquireDistLock({ lockPath, pid: process.pid, waitMs: 1_000, pollMs: 10, log });
    expect(holder(lockPath)).toBe(process.pid);
    expect(messages).toEqual([]);
  });

  it('waits on a lock a live run holds, and takes it once that run releases it', async () => {
    writeFileSync(lockPath, `${LIVE_OTHER_PID}\n`);
    const acquired = acquireDistLock({ lockPath, pid: process.pid, waitMs: 30_000, pollMs: 10, log });
    // The waiter announced the wait (naming the holder) before the holder let go.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(messages.join('\n')).toContain(`pid ${LIVE_OTHER_PID}`);
    expect(holder(lockPath)).toBe(LIVE_OTHER_PID);
    expect(releaseDistLock({ lockPath, pid: LIVE_OTHER_PID })).toBe(true);
    await acquired;
    expect(holder(lockPath)).toBe(process.pid);
  });

  it('refuses, naming the holder\'s pid and the lock, when a live run keeps the lock past the wait', async () => {
    writeFileSync(lockPath, `${LIVE_OTHER_PID}\n`);
    await expect(acquireDistLock({ lockPath, pid: process.pid, waitMs: 50, pollMs: 10, log })).rejects.toThrow(
      new RegExp(`pid ${LIVE_OTHER_PID}[\\s\\S]*${lockPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    );
    expect(holder(lockPath)).toBe(LIVE_OTHER_PID);
  });

  it('never deletes or rebuilds a dist/ that a live run holds the lock on', async () => {
    mkdirSync(join(root, 'dist'));
    writeFileSync(join(root, 'dist', 'cli.js'), 'in use by the other run\n');
    writeFileSync(lockPath, `${LIVE_OTHER_PID}\n`);
    let built = false;
    await expect(
      prepareDist({ repoRoot: root, build: () => { built = true; }, pid: process.pid, waitMs: 50, pollMs: 10, log }),
    ).rejects.toThrow(/bug-095/);
    expect(built).toBe(false);
    expect(readFileSync(join(root, 'dist', 'cli.js'), 'utf-8')).toBe('in use by the other run\n');
  });

  it('with the lock free, removes the previous dist/, builds, and keeps holding the lock', async () => {
    mkdirSync(join(root, 'dist'));
    writeFileSync(join(root, 'dist', 'stale.js'), 'from an earlier build\n');
    const order: string[] = [];
    await prepareDist({
      repoRoot: root,
      build: () => {
        order.push(`build (dist present: ${existsSync(join(root, 'dist'))}, holder: ${holder(lockPath)})`);
      },
      pid: process.pid,
      waitMs: 1_000,
      pollMs: 10,
      log,
    });
    expect(order).toEqual([`build (dist present: false, holder: ${process.pid})`]);
    expect(holder(lockPath)).toBe(process.pid);
  });

  it('takes over a lock left by a run that died before its teardown', async () => {
    const dead = deadPid();
    writeFileSync(lockPath, `${dead}\n`);
    await acquireDistLock({ lockPath, pid: process.pid, waitMs: 1_000, pollMs: 10, log });
    expect(holder(lockPath)).toBe(process.pid);
  });

  it('releases only its own lock: another run\'s lock survives a foreign release', () => {
    writeFileSync(lockPath, `${LIVE_OTHER_PID}\n`);
    expect(releaseDistLock({ lockPath, pid: process.pid })).toBe(false);
    expect(holder(lockPath)).toBe(LIVE_OTHER_PID);
    expect(releaseDistLock({ lockPath, pid: LIVE_OTHER_PID })).toBe(true);
    expect(existsSync(lockPath)).toBe(false);
    expect(releaseDistLock({ lockPath, pid: LIVE_OTHER_PID })).toBe(false);
  });
});

describe('dist/ lock wiring (task-146, bug-095)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const config = require(join(REPO_ROOT, 'jest.config.js')) as { globalSetup?: string; globalTeardown?: string };

  it('jest.config.js runs the locking setup and the releasing teardown', () => {
    expect(config.globalSetup).toBe('<rootDir>/test/global-setup.cjs');
    expect(config.globalTeardown).toBe('<rootDir>/test/global-teardown.cjs');
  });

  it('the setup builds dist/ only through prepareDist, and the teardown releases the lock', () => {
    const setup = readFileSync(join(REPO_ROOT, 'test', 'global-setup.cjs'), 'utf-8');
    const teardown = readFileSync(join(REPO_ROOT, 'test', 'global-teardown.cjs'), 'utf-8');
    expect(setup).toMatch(/prepareDist\(/);
    expect(setup).not.toMatch(/rmSync/);
    expect(teardown).toMatch(/releaseDistLock\(/);
  });

  it('the lock file is git-ignored', () => {
    const ignored = spawnSync('git', ['check-ignore', '-q', '.jest-dist.lock'], { cwd: REPO_ROOT });
    expect(ignored.status).toBe(0);
  });
});
