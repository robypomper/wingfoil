/**
 * Memory history primitive (task-008-dna-memory-query-latency, REQ-PERF-02) — the git-log walk a
 * future `wingfoil memory history` feature task (P1.10; not yet scheduled in v0.1, see
 * task-015-complete-audit-trail's Implementation Notes) renders. Per ADR-007
 * (stateless-state-derivation), git history is the sole audit trail for a Memory element's
 * transitions — there is no secondary `.wingfoil/state/` log to query instead — so this walks
 * `git log` directly over the element's file.
 *
 * Scope (see task-008's Execution Notes): this returns *structured commit records* (sha, author
 * name/email, ISO-8601 author date, subject, body) — the walk itself. Deriving a human-facing
 * "state change" (e.g. "pending -> backlog") from the commit body's `Approver:`/`Reason:` lines
 * (CLAUDE.md §5.1) is the feature task's rendering concern, not this primitive's; the raw `body`
 * field already carries that text verbatim for a caller to parse.
 */
import { execFileSync } from 'child_process';

/** One commit touching a Memory document, in the shape `wingfoil memory history` will render from. */
export interface MemoryHistoryEntry {
  readonly sha: string;
  readonly authorName: string;
  readonly authorEmail: string;
  /** Author date, ISO-8601 (`git log --format=%aI`) — never the commit/system date. */
  readonly date: string;
  readonly subject: string;
  readonly body: string;
}

// Unit/record separators (ASCII 0x1f/0x1e) — control characters a real commit subject/body never
// contains, so splitting on them is unambiguous without escaping.
const FIELD_SEP = '\x1f';
const RECORD_SEP = '\x1e';
const LOG_FORMAT = ['%H', '%an', '%ae', '%aI', '%s', '%b'].join(FIELD_SEP) + RECORD_SEP;

/**
 * Walk every commit that touched `relativePath`, oldest first (P1.10-memory-history.feature: "lists
 * ... entries in chronological order") — `git log` itself returns newest-first, reversed here.
 *
 * Returns `[]`, rather than throwing, both when `root` has no commits touching the path at all and
 * when `root` is not a git repository — "document not found" is a caller/feature-layer concern
 * (task-021/026-style CLI error rendering), not this primitive's.
 */
export function getMemoryHistory(root: string, relativePath: string): MemoryHistoryEntry[] {
  let stdout: string;
  try {
    stdout = execFileSync(
      'git',
      ['-C', root, 'log', '--follow', `--format=${LOG_FORMAT}`, '--', relativePath],
      { encoding: 'utf-8' },
    );
  } catch {
    return [];
  }

  const records = stdout
    .split(RECORD_SEP)
    .map((record) => record.replace(/^\n+/, ''))
    .filter((record) => record.length > 0);

  const entries = records.map((record): MemoryHistoryEntry => {
    const [sha = '', authorName = '', authorEmail = '', date = '', subject = '', ...bodyParts] =
      record.split(FIELD_SEP);
    return { sha, authorName, authorEmail, date, subject, body: bodyParts.join(FIELD_SEP).trim() };
  });

  return entries.reverse();
}
