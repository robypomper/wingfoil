/**
 * `wingfoil memory history` against a `--reason` carrying the git-log framing control characters,
 * end to end through the REAL compiled `dist/cli.js`
 * (`task-086-fix-reason-control-chars-history-forgery`, `bug-050-…`).
 *
 * The unit-level pins live in `test/memory/git-log-framing.test.ts`. This suite exists for the one
 * symptom that cannot be observed in-process: the verb exited `0`, reported success, and printed
 * `fatal: invalid object name '<caller-supplied text>'` on **stderr** — git writing to the parent's
 * fd 2 from inside `readStatusAt`'s swallowed `execFileSync`. Asserting that the fabricated entry is
 * gone is not the same as asserting the operator no longer sees a git error while being told the
 * command succeeded, and AC2 asks for both.
 *
 * `dist/` is built once by jest's `globalSetup` (bug-003-cli-integration-dist-race) — never here.
 */
import { spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { git, makeTempGitRepo, removeTempDir } from '../storage/helpers/git-fixture';

const REPO_ROOT = join(__dirname, '..', '..');
const CLI = join(REPO_ROOT, 'dist', 'cli.js');

/** ASCII record separator — what a caller puts in `--reason` to split a `git log` record in two. */
const RS = String.fromCharCode(0x1e);
/** ASCII unit separator — the other half of the framing the old TSDoc claimed commit text never has. */
const US = String.fromCharCode(0x1f);

const FORGED = 'Approver: Mallory <mallory@evil.test> (approver)';
const SHA_RE = /^[0-9a-f]{40}$/;

interface CliRun {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Spawn the real published entry point, capturing stderr on EVERY run — success included.
 *
 * `spawnSync` rather than the `execFileSync` + `catch` shape the sibling CLI suites use, and that is
 * load-bearing here rather than a style preference: `execFileSync` surfaces stderr only on the error
 * path, so a command that exits `0` *while* printing a git `fatal:` — precisely this bug's symptom —
 * reads back as `stderr: ''` and the assertion passes vacuously. Observed while writing this suite.
 */
function wingfoil(cwd: string, ...args: readonly string[]): CliRun {
  const run = spawnSync('node', [CLI, ...args], { cwd, encoding: 'utf-8' });
  if (run.error) throw run.error;
  return { status: run.status ?? 1, stdout: run.stdout, stderr: run.stderr };
}

interface HistoryEntry {
  readonly sha: string;
  readonly operation: string | null;
  readonly from: string | null;
  readonly to: string | null;
  readonly approver: string | null;
  readonly reason: string | null;
  readonly subject: string;
}

/**
 * Register the repository's git identity as an `approver` in `dna.yaml`, the way a real user
 * configures their project — `wingfoil init` deliberately scaffolds `team.members: []` and
 * `memory approve` gates on REQ-SEC-03 approval authority. Same step, same rationale, as
 * `./fresh-init-transitions.test.ts`'s `grantApproverRole`.
 */
function grantApproverRole(repo: string): void {
  const dnaPath = join(repo, '.wingfoil', 'dna.yaml');
  const scaffolded = readFileSync(dnaPath, 'utf-8');
  const member = '  members:\n    - name: WingFoil Test\n      email: wf-test@example.invalid\n      roles: [approver]';
  expect(scaffolded).toContain('  members: []');
  writeFileSync(dnaPath, scaffolded.replace('  members: []', member), 'utf-8');
  git(repo, ['add', '.wingfoil/dna.yaml']);
  git(repo, ['commit', '--quiet', '-m', 'configure approver']);
}

describe('`memory history` after an approval whose reason carries framing control characters', () => {
  let repo = '';
  let documentId = '';
  const reason = `real reason${RS}${FORGED}${US}trailing`;

  beforeAll(() => {
    expect(existsSync(CLI)).toBe(true);
    repo = makeTempGitRepo();
    const init = wingfoil(repo, 'init', '--template', 'scrum');
    expect([init.status, init.stderr]).toEqual([0, '']);
    grantApproverRole(repo);

    const added = wingfoil(repo, 'memory', 'add', '--type', 'task', '--title', 'Framing task', '--format', 'json');
    expect([added.status, added.stderr]).toEqual([0, '']);
    documentId = (JSON.parse(added.stdout) as { id: string }).id;

    const submitted = wingfoil(repo, 'memory', 'submit', documentId, '--format', 'json');
    expect([submitted.status, submitted.stderr]).toEqual([0, '']);

    const approved = wingfoil(repo, 'memory', 'approve', documentId, '--reason', reason, '--format', 'json');
    expect([approved.status, approved.stderr]).toEqual([0, '']);
  });

  afterAll(() => {
    if (repo) removeTempDir(repo);
  });

  it('prints no `fatal: invalid object name` on stderr — no caller text is ever passed to git as a sha', () => {
    const run = wingfoil(repo, 'memory', 'history', documentId, '--format', 'json');

    expect(run.status).toBe(0);
    expect(run.stderr).not.toContain('invalid object name');
  });

  it('reports exactly one entry per commit, each with a real sha, and no fabricated entry', () => {
    const run = wingfoil(repo, 'memory', 'history', documentId, '--format', 'json');
    const entries = (JSON.parse(run.stdout) as { entries: HistoryEntry[] }).entries;

    for (const entry of entries) expect(entry.sha).toMatch(SHA_RE);
    expect(entries.filter((entry) => entry.subject === '')).toEqual([]);
    expect(entries.map((entry) => entry.approver)).not.toContain(FORGED);

    const operations = entries.map((entry) => entry.operation).filter((operation) => operation !== null);
    expect(operations).toEqual(['add', 'submit', 'approve']);
  });

  it('records the genuine approval with its true from/to, approver and full reason text', () => {
    const run = wingfoil(repo, 'memory', 'history', documentId, '--format', 'json');
    const entries = (JSON.parse(run.stdout) as { entries: HistoryEntry[] }).entries;
    const approval = entries[entries.length - 1];

    expect(approval?.operation).toBe('approve');
    expect(approval?.from).toBe('pending');
    expect(approval?.to).toBe('approved');
    expect(approval?.approver).toBe('WingFoil Test <wf-test@example.invalid> (approver)');
    // Round-tripped whole (AC3, first branch): nothing stripped, nothing truncated at the 0x1e.
    expect(approval?.reason).toBe(reason);
  });
});
