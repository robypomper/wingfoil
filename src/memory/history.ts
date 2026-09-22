/**
 * Memory history primitive (task-008-dna-memory-query-latency, REQ-PERF-02) — the git-log walk
 * underneath `wingfoil memory history` (P1.10), which shipped in `task-049-memory-history` as
 * `src/core`'s `memoryHistory` operation. Per ADR-007 (stateless-state-derivation), git history is
 * the sole audit trail for a Memory element's transitions — there is no secondary `.wingfoil/state/`
 * log to query instead — so this walks `git log` directly over the element's file.
 *
 * Scope (see task-008's Execution Notes): this returns *structured commit records* (sha, author
 * name/email, ISO-8601 author date, subject, body) — the walk itself. Deriving a human-facing
 * "state change" (e.g. "pending -> backlog") from the commit body's `Approver:`/`Reason:` lines
 * (CLAUDE.md §5.1) is not this primitive's concern; the raw `body` field carries that text verbatim
 * for a caller to parse, and `./audit`'s `reconstructMemoryTransitions` is the caller that does — the
 * `memoryHistory` operation projects that reconstruction rather than re-reading this walk itself.
 *
 * The `git log` walk/record-splitting plumbing itself lives in `./git-log` (factored out by
 * task-015-complete-audit-trail, which needs the same plumbing for its own attribution audit) — this
 * module owns only the `MemoryHistoryEntry` shape and the `--follow` single-document semantics.
 */
import { walkGitLogFields } from './git-log';

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

const LOG_FIELDS = ['%H', '%an', '%ae', '%aI', '%s', '%b'];

/**
 * Walk every commit that touched `relativePath`, oldest first (P1.10-memory-history.feature: "lists
 * ... entries in chronological order") — `git log` itself returns newest-first, reversed by
 * {@link walkGitLogFields}.
 *
 * Returns `[]`, rather than throwing, both when `root` has no commits touching the path at all and
 * when `root` is not a git repository — "document not found" is a caller/feature-layer concern
 * (task-021/026-style CLI error rendering), not this primitive's.
 */
export function getMemoryHistory(root: string, relativePath: string): MemoryHistoryEntry[] {
  const records = walkGitLogFields(root, LOG_FIELDS, [relativePath], ['--follow']);

  // One field per slot, `%b` included. Two consequences of task-086's arity-based framing, both
  // deliberate:
  //
  //  - The body arrives WHOLE even when it carries a character that used to look like a delimiter.
  //    `%b` being LAST was the only thing that made a `0x1f` in a reason survive before, via an
  //    explicit `bodyParts.join(FIELD_SEP)` that undid the split it had just caused; that accident
  //    and the reassembly compensating for it are both gone (bug-050).
  //  - Every record has exactly `LOG_FIELDS.length` entries — `walkGitLogFields` emits whole groups
  //    or none — so the per-slot `= ''` defaults this used to carry could never fire. They are read
  //    as the cast below instead of kept as six permanently-unreachable branches.
  return records.map((record) => {
    const [sha, authorName, authorEmail, date, subject, body] = record as [
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    return { sha, authorName, authorEmail, date, subject, body: body.trim() };
  });
}
