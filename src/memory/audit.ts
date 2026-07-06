/**
 * Audit-trail verification & reconstruction (task-015-complete-audit-trail, REQ-SEC-02) — the
 * READ/verify half of "every state change is a git commit with author + timestamp" (ADR-001,
 * ADR-007): git history is the *only* audit trail (no secondary `.wingfoil/state/` log), so this
 * module audits and reconstructs that trail directly from `git log`/`git show`, never from a value
 * written into file content. It builds on task-011's {@link getMemoryHistory} (the raw commit walk)
 * rather than re-implementing it.
 *
 * This module deliberately does **not** enforce attribution at write time (checking that a commit
 * *can* be made) — that precondition belongs to task-014-git-identity-required (REQ-SEC-01), running
 * in parallel on its own branch. This module only ever reads commits that already exist and reports
 * on them; nothing here blocks or gates a write.
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

import { parseYaml } from '../validation';

import { getMemoryHistory } from './history';
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
 * empty or git-guessed placeholder. Pure predicate — no filesystem/git access.
 */
export function isValidAttribution(name: string, email: string): boolean {
  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  if (!trimmedName || !trimmedEmail) return false;
  if (trimmedEmail.includes(GIT_GUESSED_DOMAIN_MARKER)) return false;
  return EMAIL_RE.test(trimmedEmail);
}

// Field separator matching history.ts's own convention (ASCII 0x1f) — a real commit subject never
// contains it, so splitting is unambiguous without escaping.
const FIELD_SEP = '\x1f';
const RECORD_SEP = '\x1e';
const AUDIT_LOG_FORMAT = ['%H', '%an', '%ae', '%aI', '%s'].join(FIELD_SEP) + RECORD_SEP;

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
  let stdout: string;
  try {
    stdout = execFileSync(
      'git',
      ['-C', root, 'log', '--format=' + AUDIT_LOG_FORMAT, '--', ...sortedPathspecs],
      { encoding: 'utf-8' },
    );
  } catch {
    return [];
  }

  const records = stdout
    .split(RECORD_SEP)
    .map((record) => record.replace(/^\n+/, ''))
    .filter((record) => record.length > 0);

  const entries = records.map((record): AttributionEntry => {
    const [sha = '', authorName = '', authorEmail = '', date = '', subject = ''] = record.split(FIELD_SEP);
    return { sha, authorName, authorEmail, date, subject, valid: isValidAttribution(authorName, authorEmail) };
  });

  return entries.reverse();
}

// --- Approver/Reason parsing (CLAUDE.md §5.1) ------------------------------------------------

/** Parsed `Approver:`/`Reason:` lines from an `approve`/`reject` commit body (CLAUDE.md §5.1). */
export interface ApprovalMetadata {
  readonly approverName: string;
  readonly approverEmail: string;
  readonly approverRole: string;
  readonly reason: string;
}

const APPROVER_LINE_RE = /^Approver:\s*(.+?)\s*<([^>]+)>\s*\(([^)]+)\)\s*$/m;
const REASON_LINE_RE = /^Reason:\s*(.+)$/m;

/**
 * Parse a commit body for the mandatory `Approver: Name <email> (role)` and `Reason: ...` lines
 * (CLAUDE.md §5.1; REQ-SEC-02/REQ-SEC-04). Returns `null` when either line is absent — e.g. for a
 * plain `add`/`submit` commit body, which carries neither by convention — rather than a
 * partially-filled object, so a caller never has to guess whether a `null` field means "absent" or
 * "empty string".
 */
export function parseApprovalMetadata(body: string): ApprovalMetadata | null {
  const approverMatch = APPROVER_LINE_RE.exec(body);
  const reasonMatch = REASON_LINE_RE.exec(body);
  if (!approverMatch || !reasonMatch) return null;

  const [, approverName = '', approverEmail = '', approverRole = ''] = approverMatch;
  const [, reason = ''] = reasonMatch;
  return { approverName, approverEmail, approverRole, reason: reason.trim() };
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
 * (ADR-007). This is the derivation a future `wingfoil memory history` CLI/MCP surface (P1.10, a
 * later feature task) renders; this function is the reconstruction itself, not that command's output
 * formatting.
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
