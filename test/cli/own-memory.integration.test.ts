/**
 * task-111-configuration-moves-to-the-repository-root (AC 2, `bug-075`) — the Memory read verbs,
 * run through the REAL compiled `dist/cli.js` at THIS repository's root, answer on this repository's
 * own Memory.
 *
 * Every other `memory history` / `memory search` suite builds a throwaway git repository, so none of
 * them would notice that the tool cannot be pointed at the project that builds it — which is exactly
 * what `bug-075` records: the configuration lived in a nested dogfooding folder while the CLI resolves
 * `.wingfoil/` at the git root, so from the root both verbs failed on a missing `memory.yaml`.
 *
 * The element read back is `bug-077-history-follow-attributes-template-commits`: `closed` since
 * v0.2, so its recorded transitions no longer change, and its trail carries `wf()` subjects in both
 * arrow forms — `[in-progress → in-review]` and `[in-review -> resolved -> closed]` (`task-109`). Its
 * creation predates the configuration move, so reading the creation entry back also shows the
 * `--follow` walk crossing that rename (AC 1). Assertions name states and subjects, never shas, so a
 * history rewrite that keeps the subjects does not break them.
 *
 * The history assertions need the history: in a shallow checkout (`actions/checkout`'s default depth
 * is 1) they cannot hold, so — as `test/memory/reason-trailer.test.ts` does — the case asserts that
 * shallowness is the reason rather than skipping quietly. `dist/` is built once by jest's
 * `globalSetup`.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..');
const CLI = join(REPO_ROOT, 'dist', 'cli.js');
const BUG_ID = 'bug-077-history-follow-attributes-template-commits';

interface CliRun {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface HistoryEntry {
  readonly operation: string | null;
  readonly from: string | null;
  readonly to: string | null;
  readonly subject: string;
}

function wingfoil(...args: readonly string[]): CliRun {
  const run = spawnSync('node', [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf-8' });
  if (run.error) throw run.error;
  return { status: run.status ?? 1, stdout: run.stdout, stderr: run.stderr };
}

/** Whether this checkout carries the full history the history assertions read. */
function isShallow(): boolean {
  return (
    execFileSync('git', ['-C', REPO_ROOT, 'rev-parse', '--is-shallow-repository'], { encoding: 'utf-8' }).trim() ===
    'true'
  );
}

describe("wingfoil memory verbs at this repository's root read its own Memory (task-111, bug-075)", () => {
  it('memory history <id> resolves the element under docs/04_memory/ and reads its wf() trail in both arrow forms', () => {
    const run = wingfoil('memory', 'history', BUG_ID, '--format', 'json');

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    const result = JSON.parse(run.stdout) as { id: string; path: string; entries: HistoryEntry[] };
    expect(result.id).toBe(BUG_ID);
    expect(result.path).toBe(`docs/04_memory/bugs/${BUG_ID}.md`);

    if (isShallow()) {
      // Not a quiet skip: the only legitimate reason the trail is short is a history-less checkout.
      expect(result.entries.length).toBeGreaterThanOrEqual(1);
      return;
    }

    const creation = result.entries[0];
    expect(creation?.operation).toBe('add');
    expect(creation?.from).toBeNull();
    expect(creation?.to).toBe('draft');

    const unicode = result.entries.find((e) => e.subject.endsWith('[in-progress → in-review]'));
    expect(unicode).toMatchObject({ from: 'in-progress', to: 'in-review' });

    const ascii = result.entries.find((e) => e.subject.endsWith('[in-review -> resolved -> closed]'));
    expect(ascii).toMatchObject({ from: 'in-review', to: 'closed' });
  });

  it('memory search finds the element by type and by keyword, with its frontmatter state', () => {
    const byType = wingfoil('memory', 'search', '--type', 'bug', '--format', 'json');
    expect(byType.stderr).toBe('');
    expect(byType.status).toBe(0);
    const typed = JSON.parse(byType.stdout) as { matches: { id?: string; path: string; status?: string }[] };
    expect(typed.matches.length).toBeGreaterThan(100);
    expect(typed.matches).toContainEqual(
      expect.objectContaining({ id: BUG_ID, path: `docs/04_memory/bugs/${BUG_ID}.md`, status: 'closed' }),
    );

    const byKeyword = wingfoil('memory', 'search', 'history-follow-attributes-template-commits', '--format', 'json');
    expect(byKeyword.status).toBe(0);
    const keyed = JSON.parse(byKeyword.stdout) as { matches: { id?: string }[] };
    expect(keyed.matches.map((m) => m.id)).toContain(BUG_ID);
  });
});
