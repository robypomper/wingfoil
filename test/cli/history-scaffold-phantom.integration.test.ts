/**
 * `wingfoil memory history` on a project created by `wingfoil init`, end to end through the REAL
 * compiled `dist/cli.js` (`task-089-fix-history-walk-attributes-only-real-commits`, `bug-077-…`).
 *
 * The unit-level pins live in `test/memory/history-scaffold-copy.test.ts`. This suite exists because
 * the defect is a property of the *shipped* sequence, not of a fixture: `wingfoil init` commits the
 * scaffold, `memory add` copies a template out of it, and `git log --follow` therefore walked out of
 * the element and into the commit that added the template. Nothing short of running those commands
 * demonstrates that the released verbs produce a history a reader can trust — and the BDD contract
 * this restores is literal: `P1.10-memory-history.feature` requires "the output lists 3 entries in
 * chronological order" for a three-transition document and "exactly 1 entry describing the creation"
 * for a just-created one. Before the fix a scaffolded project reported 4 and 2.
 *
 * `dist/` is built once by jest's `globalSetup` (bug-003-cli-integration-dist-race) — never here.
 */
import { spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { git, makeTempGitRepo, removeTempDir } from '../storage/helpers/git-fixture';

const REPO_ROOT = join(__dirname, '..', '..');
const CLI = join(REPO_ROOT, 'dist', 'cli.js');

interface CliRun {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Spawn the published entry point with `spawnSync`, capturing stderr on every run — success
 * included. `execFileSync` surfaces stderr only on the error path, so a command that exits `0`
 * *while* printing git's `fatal:` reads back as `stderr: ''` and the assertion passes vacuously
 * (`bug-070-cli-integration-helpers-fabricate-empty-stderr`; same rationale as
 * `./reason-control-chars.integration.test.ts`).
 */
function wingfoil(cwd: string, ...args: readonly string[]): CliRun {
  const run = spawnSync('node', [CLI, ...args], { cwd, encoding: 'utf-8' });
  if (run.error) throw run.error;
  return { status: run.status ?? 1, stdout: run.stdout, stderr: run.stderr };
}

/**
 * Register the repository's git identity as an `approver` in `dna.yaml`, the way a real user
 * configures their project — `wingfoil init` scaffolds `team.members: []` and `memory approve` gates
 * on REQ-SEC-03 approval authority. Same step as `./fresh-init-transitions.test.ts`.
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

interface HistoryEntry {
  readonly sha: string;
  readonly operation: string | null;
  readonly from: string | null;
  readonly to: string | null;
  readonly subject: string;
}

interface HistoryResult {
  readonly path: string;
  readonly entries: readonly HistoryEntry[];
}

function history(repo: string, id: string): { run: CliRun; result: HistoryResult } {
  const run = wingfoil(repo, 'memory', 'history', id, '--format', 'json');
  return { run, result: JSON.parse(run.stdout) as HistoryResult };
}

describe('`memory history` on a project scaffolded by `wingfoil init`', () => {
  let repo = '';
  let createdOnly = '';
  let transitioned = '';
  let scaffoldSha = '';

  beforeAll(() => {
    expect(existsSync(CLI)).toBe(true);
    repo = makeTempGitRepo();

    const init = wingfoil(repo, 'init', '--template', 'scrum');
    expect([init.status, init.stderr]).toEqual([0, '']);
    scaffoldSha = git(repo, ['rev-parse', 'HEAD']).trim();
    grantApproverRole(repo);

    const added = wingfoil(repo, 'memory', 'add', '--type', 'adr', '--title', 'Three transitions', '--format', 'json');
    expect([added.status, added.stderr]).toEqual([0, '']);
    transitioned = (JSON.parse(added.stdout) as { id: string }).id;
    expect(wingfoil(repo, 'memory', 'submit', transitioned, '--format', 'json').status).toBe(0);
    expect(wingfoil(repo, 'memory', 'approve', transitioned, '--reason', 'sound', '--format', 'json').status).toBe(0);

    const fresh = wingfoil(repo, 'memory', 'add', '--type', 'adr', '--title', 'Just created', '--format', 'json');
    expect([fresh.status, fresh.stderr]).toEqual([0, '']);
    createdOnly = (JSON.parse(fresh.stdout) as { id: string }).id;
  });

  afterAll(() => {
    if (repo) removeTempDir(repo);
  });

  it('lists 3 entries for a document with 3 recorded transitions (P1.10 "View the full audit trail")', () => {
    const { run, result } = history(repo, transitioned);

    expect(run.status).toBe(0);
    expect(result.entries.map((entry) => entry.operation)).toEqual(['add', 'submit', 'approve']);
    expect(result.entries).toHaveLength(3);
  });

  it('lists exactly 1 entry for a just-created document (P1.10 "Edge - document with a single creation event")', () => {
    const { result } = history(repo, createdOnly);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.operation).toBe('add');
    expect(result.entries[0]?.to).toBe('draft');
  });

  it('never reports the scaffold commit, which contains no element at all', () => {
    for (const id of [transitioned, createdOnly]) {
      const { result } = history(repo, id);
      expect(git(repo, ['show', '--stat', '--format=', scaffoldSha])).not.toContain(id);
      expect(result.entries.map((entry) => entry.sha)).not.toContain(scaffoldSha);
    }
  });

  it('prints nothing on stderr while reporting success — the phantom entry was the only thing asking git for a path that was never there', () => {
    // AC7: no stderr suppression was added anywhere by THIS task. The `fatal: path ... exists on
    // disk, but not in <sha>` that `bug-071-read-status-at-leaks-git-stderr` records disappeared
    // here purely as fallout, because the commit that provoked it is no longer part of this
    // element's history — which is why the assertion below could pass while a renamed element still
    // leaked. Both halves were closed afterwards by
    // `task-097-memory-history-reads-each-commit-at-its-historical-path`: `readStatusAt` now reads
    // at each commit's own path (`bug-080`) and its `git show` runs with an explicit `stdio`
    // (`bug-071`), pinned in `test/memory/history-rename-path.test.ts`.
    const { run } = history(repo, transitioned);

    expect([run.status, run.stderr]).toEqual([0, '']);
  });
});
