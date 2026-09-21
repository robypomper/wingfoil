/**
 * bug-030-init-memory-yaml-has-no-state-machine (task-071), AC1/AC6 — **a freshly `wingfoil init`-ed
 * project can run every Memory transition verb**, proved the only way that claim can honestly be
 * proved: against a REAL `wingfoil init`, driving the REAL compiled `dist/cli.js` end-to-end in a
 * throwaway git repository, for every template the `init` registry supports.
 *
 * Why this suite exists at all, rather than an assertion inside an existing one:
 *
 * - `test/memory/state-machine.test.ts` and `test/storage/templates.test.ts` exercise the resolver and
 *   the scaffold *as library calls*. They cannot show that the shipped CLI, reading the bytes `init`
 *   committed, completes a transition and writes the state to disk.
 * - `scripts/e2e-smoke.cjs` (dl-023, reused as spec-015 §3 stage 3) does drive a fresh init through the
 *   real CLI, but its step list is `init`, `dna show`, `dna set`, `memory add`, `paths`,
 *   `directives list`, `workflow list` — **no transition verb at all**. That omission is
 *   `bug-029-e2e-smoke-omits-memory-submit` (`open`, `low`, unscheduled), a sibling of bug-030 that
 *   task-071 deliberately does NOT fix: extending the smoke script is bug-029's ground. The smoke is
 *   run unchanged as a regression check on the scaffold edit instead, and is explicitly not offered as
 *   evidence for AC1. This suite is the equivalent-coverage route AC6 allows — and is precisely what
 *   bug-029 would later automate inside the smoke script.
 *
 * The drive is the full four-verb round trip, in the order that exercises both gate edges of the
 * scaffolded machine (`draft → pending → approved`, `gates.pending.reject: draft`):
 *
 *   `init` → `memory add` → `submit` → `approve` → `reject` → `submit` → `deprecate`
 *
 * After every verb this asserts both halves of "it completed": the `status` the verb wrote into the
 * document's frontmatter, and that it produced **exactly one** commit (P1.2/§5.1 — one operation, one
 * commit). `--reason` is passed where the verb requires it (REQ-SEC-04, spec-008 §2) and omitted on
 * `deprecate`, where dl-027 makes it optional — passed there too, for the audit trail.
 *
 * Determinism (REQ-SYS-07): fixed template order (the `TEMPLATES` registry order), fixed git identity,
 * fixed step list; nothing asserted depends on a clock, on randomness, or on the temp directory name.
 * `dist/` is built once by jest's `globalSetup` (bug-003-cli-integration-dist-race) — never rebuilt here.
 */
import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { TEMPLATES } from '../../src/storage/templates';
import { git, makeTempGitRepo, removeTempDir } from '../storage/helpers/git-fixture';

const REPO_ROOT = join(__dirname, '..', '..');
const CLI = join(REPO_ROOT, 'dist', 'cli.js');

interface CliRun {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface ExecFileSyncError {
  readonly status: number | null;
  readonly stdout: Buffer | string;
  readonly stderr: Buffer | string;
}

function isExecFileSyncError(error: unknown): error is ExecFileSyncError {
  return typeof error === 'object' && error !== null && 'status' in error && 'stdout' in error;
}

/** Spawn the real published entry point (`node dist/cli.js`) inside a project root. */
function wingfoil(cwd: string, ...args: readonly string[]): CliRun {
  try {
    const stdout = execFileSync('node', [CLI, ...args], { cwd, encoding: 'utf-8' });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    if (!isExecFileSyncError(error)) throw error;
    return { status: error.status ?? 1, stdout: error.stdout.toString(), stderr: error.stderr.toString() };
  }
}

/** Number of commits on HEAD — the "exactly one commit per operation" counter. */
function commitCount(repo: string): number {
  return Number(git(repo, ['rev-list', '--count', 'HEAD']).trim());
}

/** The `status:` value in a document's frontmatter, as written on disk. */
function statusOf(repo: string, relativePath: string): string {
  const match = /^status:\s*"?([A-Za-z0-9-]+)"?\s*$/m.exec(readFileSync(join(repo, relativePath), 'utf-8'));
  return match?.[1] ?? '';
}

describe('a freshly `wingfoil init`-ed project runs every Memory transition verb (bug-030, AC1)', () => {
  beforeAll(() => {
    // Built once by test/global-setup.cjs before any worker starts — just assert it is there.
    expect(existsSync(CLI)).toBe(true);
  });

  for (const def of TEMPLATES) {
    describe(`template ${def.name}`, () => {
      let repo: string;
      let documentPath: string;
      let documentId: string;

      beforeAll(() => {
        repo = makeTempGitRepo();
        const init = wingfoil(repo, 'init', '--template', def.name);
        expect([init.status, init.stderr]).toEqual([0, '']);
        const added = wingfoil(repo, 'memory', 'add', '--type', 'task', '--title', 'Smoke task', '--format', 'json');
        expect([added.status, added.stderr]).toEqual([0, '']);
        const value = JSON.parse(added.stdout) as { id: string; path: string };
        documentId = value.id;
        documentPath = value.path;
      });

      afterAll(() => removeTempDir(repo));

      it('`memory add` wrote a document in the scaffolded type\'s path, at the machine\'s chain head', () => {
        expect(documentPath).toMatch(/task/);
        expect(statusOf(repo, documentPath)).toBe('draft');
      });

      it('`memory submit` completes: draft -> pending, in exactly one commit', () => {
        const before = commitCount(repo);
        const run = wingfoil(repo, 'memory', 'submit', documentId);
        expect([run.status, run.stderr]).toEqual([0, '']);
        expect(statusOf(repo, documentPath)).toBe('pending');
        expect(commitCount(repo) - before).toBe(1);
      });

      it('`memory approve --reason` completes: pending -> approved, in exactly one commit', () => {
        const before = commitCount(repo);
        const run = wingfoil(repo, 'memory', 'approve', documentId, '--reason', 'fresh-init smoke');
        expect([run.status, run.stderr]).toEqual([0, '']);
        expect(statusOf(repo, documentPath)).toBe('approved');
        expect(commitCount(repo) - before).toBe(1);
      });

      it('`memory reject --reason` completes on the gate: pending -> draft, in exactly one commit', () => {
        // Walk back to the gate state first (`approved` is not a `gates` key), so `reject` is
        // exercised on the edge the scaffolded machine actually declares.
        const backToDraft = wingfoil(repo, 'memory', 'reject', documentId, '--reason', 'needs work');
        expect(backToDraft.status).not.toBe(0); // `approved` is not a gate — refused by the engine, not by resolution
        expect(backToDraft.stderr).not.toMatch(/REQ-STATE-08/);

        const resubmit = wingfoil(repo, 'memory', 'submit', documentId);
        expect(resubmit.status).toBe(0);
        expect(statusOf(repo, documentPath)).toBe('pending');

        const before = commitCount(repo);
        const run = wingfoil(repo, 'memory', 'reject', documentId, '--reason', 'needs work');
        expect([run.status, run.stderr]).toEqual([0, '']);
        expect(statusOf(repo, documentPath)).toBe('draft');
        expect(commitCount(repo) - before).toBe(1);
      });

      it('`memory deprecate` completes from any state: -> deprecated, in exactly one commit', () => {
        const before = commitCount(repo);
        const run = wingfoil(repo, 'memory', 'deprecate', documentId, '--reason', 'end of smoke');
        expect([run.status, run.stderr]).toEqual([0, '']);
        expect(statusOf(repo, documentPath)).toBe('deprecated');
        expect(commitCount(repo) - before).toBe(1);
      });

      it('no verb ever failed on state-machine resolution (the bug-030 signature)', () => {
        // The defect's fingerprint: `resolveStateMachine` throwing REQ-STATE-08 before the verb's own
        // logic runs. Re-drive one verb on the now-`deprecated` document: whatever the engine answers,
        // it must be the engine's own answer, never a resolution failure.
        const run = wingfoil(repo, 'memory', 'submit', documentId);
        expect(`${run.stdout}${run.stderr}`).not.toMatch(/REQ-STATE-08|declares no `states` block/);
      });

      it('the working tree is clean — every mutation was committed (dl-023 smoke invariant)', () => {
        expect(git(repo, ['status', '--porcelain']).trim()).toBe('');
      });
    });
  }
});
