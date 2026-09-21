/**
 * Audit-trail verification & reconstruction (task-015-complete-audit-trail, REQ-SEC-02) — the
 * READ/verify half of "every state change is a git commit with author + timestamp" (ADR-001,
 * ADR-007): git history is the *only* audit trail (no secondary `.wingfoil/state/` log), so this
 * module audits and reconstructs that trail directly from `git log`/`git show`, never from a value
 * written into file content. It builds on task-011's {@link getMemoryHistory} (the raw commit walk)
 * rather than re-implementing it.
 *
 * This module deliberately does **not** enforce attribution at write time (checking that a commit
 * *can* be made) — that precondition belongs to task-014-git-identity-required (REQ-SEC-01,
 * `requireGitIdentity` in `src/core/git-identity.ts`). This module only ever reads commits that
 * already exist and reports on them; nothing here blocks or gates a write. The base "non-empty
 * name and non-empty email" rule the two share lives in exactly one place — the
 * `isConfiguredIdentity` predicate exported by `src/core/git-identity.ts` — which
 * {@link isValidAttribution} below consumes rather than re-deriving; see that function's
 * doc-comment for the read-only augmentations it layers on top for historical commits.
 *
 * REQ-SEC-02's fit criterion, mapped to the functions below:
 *
 * - "`git log` verification ... shows author + timestamp for every change with 0 'unknown
 *   author'" -> {@link auditAttribution} / {@link isValidAttribution}.
 * - Commit timestamp (never file content) supplies the ISO-8601 date -> already true of
 *   `getMemoryHistory`'s `date` field (`%aI`, sourced from git itself); this module never re-derives
 *   a timestamp from anywhere else.
 * - "`approve`/`reject` commits carry an explicit `Approver:`/`Reason:` line" ->
 *   {@link parseApprovalMetadata}.
 * - "`memory history <id>` lists each transition ... author, timestamp, and reason" ->
 *   {@link reconstructMemoryTransitions}.
 * - "Recomputing an element's state at any historical commit ... agrees with the transition history
 *   derived from git log ... no drift" -> {@link verifyTransitionConsistency}.
 */
import { execFileSync } from 'child_process';

import { isConfiguredIdentity } from '../core';
import { parseYaml } from '../validation';

import { parseApproverTrailerLine, parseReasonBlock } from './commit-message';
import { getMemoryHistory } from './history';
import { walkGitLogFields } from './git-log';
import { splitFrontmatter } from '../storage';

// --- Attribution audit -----------------------------------------------------------------------

/** One commit's attribution, as audited against `pathspecs` (REQ-SEC-02's "0 unknown author"). */
export interface AttributionEntry {
  readonly sha: string;
  readonly authorName: string;
  readonly authorEmail: string;
  /** ISO-8601 author date (`git log --format=%aI`) — sourced from git, never file content. */
  readonly date: string;
  readonly subject: string;
  /** Whether this commit's author identity is non-empty and not a git-guessed placeholder. */
  readonly valid: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@()]+$/;
// The literal marker git itself appends to an author email when it falls back to a guessed identity
// (user@hostname) and cannot determine a real domain — e.g. "root@buildhost.(none)". A commit
// carrying this is not a deliberately-configured identity, so it counts as "unknown author".
const GIT_GUESSED_DOMAIN_MARKER = '.(none)';

/**
 * Whether `name`/`email` look like a real, deliberately-configured git identity rather than an
 * empty or git-guessed placeholder, as recorded on a *historical* commit. The base check — non-empty
 * `name` AND non-empty `email` — is NOT re-derived here: it delegates to
 * {@link isConfiguredIdentity} from `src/core/git-identity.ts`, the single source of truth also used
 * by `requireGitIdentity`'s write-time precondition (REQ-SEC-01). On top of that shared base, this
 * audit (REQ-SEC-02) layers two read-only augmentations that only make sense when inspecting
 * *historical* commits rather than live config — `requireGitIdentity` has no need for either, because
 * it only ever looks at the identity a caller is about to write with:
 *
 *  - Rejects the `GIT_GUESSED_DOMAIN_MARKER` (`.(none)`): git appends this to an author email when it
 *    fell back to a guessed identity at commit time. `requireGitIdentity` now PREVENTS this going
 *    forward (task-014), but older history predating that guard can still carry it, so the read audit
 *    must flag it — it is a legacy-history concern, not part of the live write-time rule.
 *  - Rejects a non-empty-but-malformed email (`EMAIL_RE`): `requireGitIdentity` never needs this check
 *    because it only reads a git config value (itself always syntactically well-formed or absent);
 *    historical commit authors, however, can carry hand-edited or otherwise malformed values, so the
 *    audit validates the shape too.
 *
 * Pure predicate — no filesystem/git access.
 */
export function isValidAttribution(name: string, email: string): boolean {
  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  if (!isConfiguredIdentity(trimmedName, trimmedEmail)) return false;
  if (trimmedEmail.includes(GIT_GUESSED_DOMAIN_MARKER)) return false;
  return EMAIL_RE.test(trimmedEmail);
}

const AUDIT_LOG_FIELDS = ['%H', '%an', '%ae', '%aI', '%s'];

/**
 * Walk every commit touching any of `pathspecs` under `root`, oldest first, annotated with whether
 * its author attribution is valid ({@link isValidAttribution}) — the audit primitive behind
 * REQ-SEC-02's "0 'unknown author'" fit criterion. `pathspecs` is sorted before being passed to git
 * so the invocation itself is deterministic regardless of caller-supplied order (REQ-SYS-07); a
 * commit touching more than one of the given pathspecs still appears exactly once (git's own log
 * de-duplicates by commit, not by path). Returns `[]` (never throws) when none of `pathspecs` has
 * any history, mirroring {@link getMemoryHistory}.
 */
export function auditAttribution(root: string, pathspecs: readonly string[]): AttributionEntry[] {
  const sortedPathspecs = [...pathspecs].sort();
  const records = walkGitLogFields(root, AUDIT_LOG_FIELDS, sortedPathspecs);

  return records.map(([sha = '', authorName = '', authorEmail = '', date = '', subject = '']) => ({
    sha,
    authorName,
    authorEmail,
    date,
    subject,
    valid: isValidAttribution(authorName, authorEmail),
  }));
}

// --- Approver/Reason parsing (CLAUDE.md §5.1) ------------------------------------------------

/** Parsed `Approver:`/`Reason:` lines from an `approve`/`reject` commit body (CLAUDE.md §5.1). */
export interface ApprovalMetadata {
  readonly approverName: string;
  readonly approverEmail: string;
  readonly approverRole: string;
  /**
   * The `Reason:` block this commit records, or `null` when it records none that can be read
   * (`dl-067-reason-trailer-contract` clause 6). Widened from `string` by
   * `task-072-fix-reason-trailer-contract`: an unreadable reason must not take a successfully parsed
   * approver identity down with it, and `MemoryTransition.reason` was already `string | null`.
   */
  readonly reason: string | null;
}

/**
 * The identity on an `Approver:` trailer line. Applied to that ONE line — located by
 * {@link parseApproverTrailerLine}, which anchors it to the body's first — rather than searched for
 * anywhere in the body with `/m`, so a second `Approver:` line sitting inside some reason's text can
 * never be read as an approval record (`dl-067` clause 5; bug-042 F3).
 */
const APPROVER_LINE_RE = /^Approver:\s*(.+?)\s*<([^>]+)>\s*\(([^)]+)\)\s*$/;

/**
 * The `Reason:` a commit body records, on its own — `null` when the body has none (a plain
 * `add`/`submit` body, which carries no trailer by convention), or carries a bare `Reason:` with no
 * value. Split out of {@link parseApprovalMetadata} by `task-049-memory-history` (P1.10) because the
 * two trailers do not always travel together: an APPROVAL-gate commit (`approve`/`reject`) must carry
 * both `Approver:` and `Reason:` (CLAUDE.md §5.1, P1.7), but a `deprecate` commit records a `Reason:`
 * with **no** `Approver:` line at all — deprecate is explicitly not an approval gate. Reading the
 * reason through `parseApprovalMetadata` would therefore drop every deprecate reason from the audit
 * trail it exists to surface.
 *
 * The reason's extent is NOT decided here: this is a thin alias over `parseReasonBlock`
 * (`./commit-message.ts`), the module that also writes the trailer — one grammar, consumed by both
 * sides, which is `dl-067-reason-trailer-contract` clause 5 and the property that module's doc has
 * claimed for itself since `task-045-memory-submit`.
 *
 * The limitation this function used to document — "a hypothetical multi-paragraph reason would be
 * silently truncated to its first line here" — is gone with the defect
 * (`bug-042-reason-text-has-no-contract-against-commit-trailer`, F1). It was never hypothetical: 79 of
 * `main`'s 171 approve/reject commits carry a reason continuing past line one, and the reader kept as
 * little as 2% of one (dl-067 E1/E2).
 */
export function parseCommitReason(body: string): string | null {
  return parseReasonBlock(body);
}

/**
 * Parse a commit body for the `Approver: Name <email> (role)` and `Reason: ...` trailers
 * (CLAUDE.md §5.1; REQ-SEC-02/REQ-SEC-04). Returns `null` when there is no `Approver:` trailer line —
 * e.g. for a plain `add`/`submit` body, or a `deprecate` one (not an approval gate), neither of which
 * records an approval at all. A caller that wants such a commit's reason wants
 * {@link parseCommitReason} instead.
 *
 * All-or-nothing on the APPROVER, and only on the approver (`dl-067` clause 6,
 * `task-072-fix-reason-trailer-contract`). It used to be all-or-nothing in both directions, so an
 * unreadable `Reason:` discarded the identity this function had already parsed successfully — and
 * since an empty `--reason` was accepted at exit `0` and git's cleanup turned it into a bare
 * `Reason:`, `wingfoil memory history` could report an approval gate crossed by nobody, for no reason
 * (bug-042 F2). Now the record degrades instead of vanishing: the approver stands, `reason` reads
 * `null`. Nothing on `main` reads differently for it — no commit there has a bare `Reason:` or is
 * missing a trailer line (dl-067 E6) — so this is protection for bodies written before the fix.
 */
export function parseApprovalMetadata(body: string): ApprovalMetadata | null {
  const approverLine = parseApproverTrailerLine(body);
  const approverMatch = approverLine === null ? null : APPROVER_LINE_RE.exec(approverLine);
  if (!approverMatch) return null;

  const [, approverName = '', approverEmail = '', approverRole = ''] = approverMatch;
  return { approverName, approverEmail, approverRole, reason: parseCommitReason(body) };
}

// --- Full transition reconstruction (`memory history`, P1.10) --------------------------------

/** The CLAUDE.md §5.1 verb a commit's subject declares, when it matches the `wf({type}): {verb} ...` shape. */
type MemoryOperation = 'add' | 'submit' | 'approve' | 'reject' | 'deprecate';

const OPERATION_RE = /^wf\([^)]+\):\s*(add|submit|approve|reject|deprecate)\b/;

/**
 * One reconstructed transition in a Memory element's history — author/timestamp from git itself,
 * `fromState`/`toState` derived from the document's own frontmatter `status:` field at that commit
 * (ADR-007: state lives in frontmatter, not the commit message), and `approval` parsed from the
 * commit body when present. `fromState` is `null` only for the element's first commit (creation —
 * there is no prior state to name).
 */
export interface MemoryTransition {
  readonly sha: string;
  readonly authorName: string;
  readonly authorEmail: string;
  readonly date: string;
  readonly subject: string;
  readonly operation: MemoryOperation | null;
  readonly fromState: string | null;
  readonly toState: string | null;
  readonly approval: ApprovalMetadata | null;
  /**
   * The `Reason:` this commit's body records, read INDEPENDENTLY of `Approver:`
   * ({@link parseCommitReason}) — `null` when the body records none. Deliberately not the same field
   * as `approval.reason`: `approval` is `null` for a `deprecate` commit (it has no `Approver:` line),
   * yet such a commit does record a reason, and `wingfoil memory history` (P1.10) must surface it.
   * When `approval` is non-null the two always agree, by construction.
   */
  readonly reason: string | null;
}

/**
 * Read `relativePath`'s frontmatter `status:` field as it existed at `sha` (`git show sha:path`),
 * without validating it against any type's Zod schema — this is a historical-snapshot read, not a
 * live document validation. Returns `null` if the path didn't exist at `sha`, has no frontmatter
 * block, or the frontmatter has no string `status` field.
 */
function readStatusAt(root: string, sha: string, relativePath: string): string | null {
  let raw: string;
  try {
    raw = execFileSync('git', ['-C', root, 'show', `${sha}:${relativePath}`], { encoding: 'utf-8' });
  } catch {
    return null;
  }

  const { frontmatter } = splitFrontmatter(raw);
  if (!frontmatter) return null;

  const parsed = parseYaml(frontmatter, `${relativePath}@${sha}`);
  if (parsed === null || typeof parsed !== 'object') return null;

  const status = (parsed as Record<string, unknown>).status;
  return typeof status === 'string' ? status : null;
}

/**
 * Reconstruct every transition `relativePath` went through, oldest first, entirely from git log
 * (`getMemoryHistory`) plus a frontmatter read at each commit (`git show`) — no separate log file
 * (ADR-007). This is the derivation `wingfoil memory history` (P1.10) renders — `src/core`'s
 * `memoryHistory` operation (`task-049-memory-history`) renames and string-formats these fields into
 * its own entry shape, deriving no further state of its own; this function is the reconstruction
 * itself, not that command's output formatting.
 *
 * Known limitation: `getMemoryHistory` walks with `git log --follow` (rename-following), but
 * `readStatusAt` reads `git show sha:{relativePath}` using the CURRENT path. For a commit that predates
 * a rename, the current path won't resolve at that `sha`, yielding a spurious `toState: null` for those
 * pre-rename commits. Memory files are not renamed in practice (their path pattern is fixed by
 * `memory.yaml`, spec-011), and the `null` toState is handled gracefully downstream, so this is a
 * documented edge case, not a live defect; resolve by threading each commit's historical path (from
 * `--name-status`/`--follow`) into `readStatusAt` if renames ever occur.
 */
export function reconstructMemoryTransitions(root: string, relativePath: string): MemoryTransition[] {
  const history = getMemoryHistory(root, relativePath); // oldest first already

  const transitions: MemoryTransition[] = [];
  let previousState: string | null = null;
  for (const entry of history) {
    const toState = readStatusAt(root, entry.sha, relativePath);
    const operationMatch = OPERATION_RE.exec(entry.subject);
    transitions.push({
      sha: entry.sha,
      authorName: entry.authorName,
      authorEmail: entry.authorEmail,
      date: entry.date,
      subject: entry.subject,
      operation: (operationMatch?.[1] as MemoryOperation | undefined) ?? null,
      fromState: previousState,
      toState,
      approval: parseApprovalMetadata(entry.body),
      reason: parseCommitReason(entry.body),
    });
    previousState = toState;
  }
  return transitions;
}

// --- Frontmatter-vs-commit-message consistency (no drift) -----------------------------------

/** One disagreement between the commit subject's `[old → new]` bracket and the frontmatter actually committed. */
export interface ConsistencyMismatch {
  readonly sha: string;
  readonly subject: string;
  readonly declared: { readonly from: string; readonly to: string };
  readonly derived: { readonly from: string | null; readonly to: string | null };
}

// Matches the `[old-state → new-state]` bracket CLAUDE.md §5.1 mandates on approve/reject/deprecate
// subjects (the arrow is the U+2192 character used throughout CLAUDE.md/the memory templates).
const BRACKET_RE = /\[([^[\]→]+?)\s*→\s*([^[\]]+?)\]\s*$/;

/**
 * Cross-check, for every transition that carries a `[old → new]` bracket in its subject (`approve`/
 * `reject`/`deprecate`, per CLAUDE.md §5.1 — a plain `add`/`submit` subject has no bracket and is
 * skipped), that the bracket's declared states agree with the states independently derived from the
 * document's own frontmatter at that commit ({@link reconstructMemoryTransitions}). Returns `[]` when
 * every bracketed transition agrees — REQ-SEC-02/REQ-STATE-02's "no drift between the two views";
 * any entry in the returned array is a genuine inconsistency (e.g. a hand-edited commit message that
 * doesn't match what was actually written to disk).
 */
export function verifyTransitionConsistency(root: string, relativePath: string): ConsistencyMismatch[] {
  const transitions = reconstructMemoryTransitions(root, relativePath);
  const mismatches: ConsistencyMismatch[] = [];

  for (const transition of transitions) {
    const match = BRACKET_RE.exec(transition.subject);
    if (!match) continue;

    const [, declaredFromRaw = '', declaredToRaw = ''] = match;
    const declaredFrom = declaredFromRaw.trim();
    const declaredTo = declaredToRaw.trim();

    if (declaredFrom !== transition.fromState || declaredTo !== transition.toState) {
      mismatches.push({
        sha: transition.sha,
        subject: transition.subject,
        declared: { from: declaredFrom, to: declaredTo },
        derived: { from: transition.fromState, to: transition.toState },
      });
    }
  }

  return mismatches;
}
