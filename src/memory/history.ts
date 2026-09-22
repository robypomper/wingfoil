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
 *
 * Those `--follow` semantics are this module's real subject, and they are not the ones the flag's
 * name suggests (`task-089-fix-history-walk-attributes-only-real-commits`,
 * `bug-077-history-follow-attributes-template-commits`). `--follow` does not only follow renames:
 * git's path search runs with **copy** detection enabled, so when the path is absent from a parent
 * commit git will accept a source that still exists there. Every Memory element is created by
 * copying its type's template, which `wingfoil init` has already committed — so the walk crossed
 * that copy edge and reported the commit that added the TEMPLATE as an entry of the element's own
 * history, carrying a real sha, author and timestamp with every derived field null. See
 * {@link findElementCreationSha} for the distinction that resolves it and why rename-following is
 * kept rather than traded away.
 */
import { execFileSync } from 'child_process';

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
 * The same `--follow` walk as {@link getMemoryHistory}, narrowed by git to the commits whose edge for
 * this path is a **copy**, and printing nothing but the sha. Deliberately a second `git log`
 * invocation rather than extra output threaded through the first: `walkGitLogFields` recovers
 * records by field arity over a stream of `<field>NUL` groups, so anything git appends outside the
 * `--format` string — `--name-status` output, for instance — would be read as the next record's
 * first field (task-086).
 */
const CREATION_PROBE_ARGS = ['--follow', '--diff-filter=C', '--format=%H'];

/**
 * The sha of the commit that introduced `relativePath` as a COPY of a file that outlives it — the
 * element's own creation — or `null` when the followed chain contains no copy edge at all.
 *
 * This is the distinction the fix turns on. `git log --follow` can change path across two different
 * kinds of edge, and they mean opposite things for an audit trail:
 *
 *  - **`R` (rename)** — the element continuing under a new name. Keep following. This is not a
 *    hypothetical requirement: `docs/self/docs/04_memory/planning/v1/*` became `planning/rl-v1/*` in
 *    one commit in this repository, moving five `release` elements at once, because the `release`
 *    type's `path` pattern interpolates the release-line id (`memory.yaml`). For one of them a plain
 *    `git log -- <path>` returns a single commit where the followed walk returns seven, so dropping
 *    `--follow` would delete five sixths of that element's recorded history.
 *  - **`C` (copy)** — the element being born out of a file that still exists. `wingfoil memory add`
 *    copies the type's template verbatim (CLAUDE.md §5.1), and `wingfoil init` has already committed
 *    that template, so this edge is how every scaffolded element begins. Everything strictly older
 *    than it is the template's history, not the element's.
 *
 * Only the newest copy edge matters — it is the element's own creation; any older one belongs to
 * whatever the source itself was copied from. `git log` prints newest first, so that is the first
 * line.
 *
 * **Throws** — never returns `null` — when git itself fails. "git could not answer" and "this
 * element was never copied from anything" are different answers, and collapsing the first into the
 * second would silently restore the phantom entry; it is also why this cannot borrow
 * `walkGitLogFields`, whose `catch` returns `[]` (`bug-072-oversized-git-log-becomes-empty-history`).
 * {@link getMemoryHistory} calls this only once the main walk has already returned commits, so at
 * that point the repository and the path are both known good and a failure here is genuinely
 * exceptional.
 *
 * @param root - Absolute path of the repository to walk.
 * @param relativePath - The element's root-relative path, as {@link getMemoryHistory} takes it.
 * @returns The creation commit's full sha, or `null` when the chain has no copy edge.
 */
export function findElementCreationSha(root: string, relativePath: string): string | null {
  let stdout: string;
  try {
    stdout = execFileSync('git', ['-C', root, 'log', ...CREATION_PROBE_ARGS, '--', relativePath], {
      encoding: 'utf-8',
    });
  } catch (cause) {
    throw new Error(
      `git log --follow --diff-filter=C failed for ${relativePath}: cannot establish where the element was created`,
      { cause },
    );
  }

  const newestCopy = stdout.split('\n').find((line) => line.trim().length > 0);
  return newestCopy === undefined ? null : newestCopy.trim();
}

/**
 * Drop the part of an oldest-first walk that precedes the element's creation, keeping the creation
 * commit itself — the ancestry `--follow` reached through a copy edge, which belongs to the file the
 * element was copied from. `creationSha` of `null` (no copy edge: the document was authored in
 * place) leaves the walk untouched.
 *
 * Pure: no git, no filesystem. Separated from {@link findElementCreationSha} so the truncation rule
 * and the invariant below are exercised directly rather than through a repository fixture.
 *
 * **Throws** when `creationSha` is absent from `entries`. The two walks are the same walk — one is
 * the other filtered by git — so a sha in the narrower one that is missing from the wider one is a
 * broken invariant, not a case to absorb. Defaulting to "no truncation" there would report the
 * phantom entry again while reporting success.
 *
 * @param entries - The full `--follow` walk, oldest first.
 * @param creationSha - The element's creation commit, from {@link findElementCreationSha}.
 * @returns `entries` from the creation commit onward (a new array; `entries` is not mutated).
 */
export function dropPreCreationAncestry(
  entries: readonly MemoryHistoryEntry[],
  creationSha: string | null,
): MemoryHistoryEntry[] {
  if (creationSha === null) return [...entries];

  const creationIndex = entries.findIndex((entry) => entry.sha === creationSha);
  if (creationIndex === -1) {
    throw new Error(
      `creation commit ${creationSha} is not present in the history walk it was derived from`,
    );
  }
  return entries.slice(creationIndex);
}

/**
 * Walk every commit that touched `relativePath`, oldest first (P1.10-memory-history.feature: "lists
 * ... entries in chronological order") — `git log` itself returns newest-first, reversed by
 * {@link walkGitLogFields} — and only those commits. The walk follows renames, so an element moved on
 * disk keeps its history, but stops at the element's own creation rather than continuing into the
 * template it was copied from ({@link findElementCreationSha}).
 *
 * Returns `[]`, rather than throwing, both when `root` has no commits touching the path at all and
 * when `root` is not a git repository — "document not found" is a caller/feature-layer concern
 * (task-021/026-style CLI error rendering), not this primitive's. That is also why the creation
 * probe runs only on a non-empty walk: on an empty one there is nothing to truncate and nothing to
 * conclude from git's silence.
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
  const entries = records.map((record) => {
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

  if (entries.length === 0) return entries;
  return dropPreCreationAncestry(entries, findElementCreationSha(root, relativePath));
}
