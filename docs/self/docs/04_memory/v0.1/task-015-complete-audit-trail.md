---
id: "task-015-complete-audit-trail"
type: task
title: "Infrastructure: REQ-SEC-02 — Complete, attributable audit trail"
status: in-review
release: "v0.1"
priority: "Blocker"
tags: ["v0.1", "architecture"]
ref: "REQ-SEC-02"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

Ensure that 100% of state changes across every pillar are recorded in git with author and ISO-8601
timestamp, and that approvals/rejections additionally record a reason — with no secondary state
store to keep in sync. Because state is derived directly from each document's own frontmatter
`status:` field (there is no `.wingfoil/state/` index), the git commit *is* the audit trail: every
`memory.add/submit/approve/reject/deprecate` operation produces exactly one commit, scoped to one
element type, whose author + commit timestamp supply attribution, and whose message body carries the
approver identity and reason for gated transitions. As Morgan (the auditor persona), I want to run
`git log` over `.wingfoil/`-managed content and see 0 commits with an unknown author, and be able to
list any element's full transition history with author, timestamp, and reason for every step.

## Acceptance Criteria

Per REQ-SEC-02's fit criterion: "`git log` verification over all `.wingfoil/` changes shows author +
timestamp for every change with **0** \"unknown author\"; `memory history` lists each transition with
author, timestamp, and reason."

Testable breakdown:
- Every commit touching a Memory/DNA/Directives/Workflow file has a non-empty, valid git author
  (name + email) — 0 "unknown author" commits across the managed tree.
- Every commit's timestamp is the git commit timestamp (ISO-8601), never a value written into the
  file content itself.
- `memory.approve`/`memory.reject` commits carry, in the commit body, an explicit `Approver:` line
  (full identity as `Name <email> (role)`) and a `Reason:` line — both mandatory, sourced from the
  invoking `--reason` argument (shared requirement with REQ-SEC-04).
- `memory history <id>` (once implemented) lists every transition for that element in order, each
  annotated with author, ISO-8601 timestamp, and reason (where applicable) — reconstructed entirely
  from git log, not from a separate log file.
- Recomputing an element's state at any historical commit (via frontmatter at that commit) always
  agrees with the transition history derived from git log at that point — no drift between the two
  views (shared grounding with REQ-SYS-03/REQ-STATE-02).
- See BDD `p1-memory/P1.2-versioning-audit-trail.feature`, `p1-memory/P1.7-memory-approve.feature`,
  `p1-memory/P1.8-memory-reject.feature`, `p1-memory/P1.10-memory-history.feature`.

## Implementation Notes

- Architectural backing: `docs/self/docs/04_memory/design/adrs/adr-007-stateless-state-derivation.md`
  — state is derived from frontmatter, not a separate index; git history is the sole audit trail for
  transitions, so there is nothing else to keep consistent with it.
- Storage grounding: `docs/self/docs/04_memory/design/adrs/adr-001-git-backed-storage.md` — every
  state change is a git commit with author + timestamp by construction (REQ-SYS-01); no external
  database or log store.
- Depends on `task-014-git-identity-required` (REQ-SEC-01) for attribution to be possible at all —
  build/verify that task first.
- Related feature tasks that depend on this in this release: `task-019-implement-versioning-audit-trail`
  (backlog `TASK-017`, P1.2); the `memory approve`/`memory reject`/`memory history` feature tasks
  (backlog `TASK-041`/`TASK-042`/`TASK-044`, P1.7/P1.8/P1.10) land in later releases but must build on
  the commit-message conventions fixed here.

## Execution Notes

- **design:** Verified REQ-SEC-02 against `adr-007-stateless-state-derivation` (accepted) and
  `adr-001-git-backed-storage` (accepted) — both already ground this task's scope fully (state lives
  in frontmatter, git history is the sole audit trail). No spec gap found; no new `tech-spec` needed.
- **Scope boundary with task-014-git-identity-required (REQ-SEC-01), running in parallel on its own
  branch:** this task builds only the READ/verify half of the audit trail — auditing and reconstructing
  attribution/history from commits that already exist. It adds **no** git-identity enforcement (no
  "require configured user.name/user.email before commit" check) anywhere; that write-time
  precondition remains entirely task-014's deliverable. No file under `src/` was touched that
  resembles identity-enforcement logic.
- **Foundation reused, not duplicated:** every new function is built on task-011's
  `getMemoryHistory` (`src/memory/history.ts`) — `reconstructMemoryTransitions` calls it directly;
  `auditAttribution` shares its git-log-walk plumbing via a small extracted primitive
  (`src/memory/git-log.ts#walkGitLogFields`), factored out in the refactor phase so the two
  (`history.ts`'s single-document `--follow` walk and `audit.ts`'s multi-pathspec walk) stop
  duplicating the same record-splitting logic. `history.ts`'s public API/behavior is unchanged —
  `test/memory/history.test.ts` passes untouched.
- **New module `src/memory/audit.ts`** implements the five REQ-SEC-02 deliverables from the task
  brief:
  a. `auditAttribution(root, pathspecs)` + `isValidAttribution(name, email)` — walks git log over the
     given pathspecs and flags a commit as invalid ("unknown author") when its name/email is empty or
     matches git's own guessed-identity domain marker (`user@host.(none)`, what git appends when it
     can't determine a real domain for an unconfigured identity) — a verification check, not a
     write-time gate.
  b. Timestamp provenance: `AttributionEntry.date`/`MemoryHistoryEntry.date` are both sourced only
     from `%aI` (git's own author-date format) — never read from file content; this was already true
     of `getMemoryHistory` and is preserved, not re-derived, here.
  c. `parseApprovalMetadata(body)` — parses the mandatory `Approver: Name <email> (role)` / `Reason:
     ...` commit-body lines (CLAUDE.md §5.1); returns `null` (not a partial object) when either line
     is missing, e.g. for a plain `add`/`submit` body.
  d. `reconstructMemoryTransitions(root, relativePath)` — the `memory history` derivation: for every
     commit from `getMemoryHistory`, reads the document's frontmatter `status:` at that commit (`git
     show sha:path`, reusing `splitFrontmatter`/`parseYaml` rather than re-parsing YAML by hand) to
     get `fromState`/`toState`, parses the `wf({type}): {verb}` subject for `operation`, and attaches
     `parseApprovalMetadata` for the approval fields — entirely from git, no secondary log.
  e. `verifyTransitionConsistency(root, relativePath)` — cross-checks, for every transition whose
     subject carries CLAUDE.md's `[old → new]` bracket (approve/reject/deprecate), that the bracket's
     declared states agree with the states independently derived from frontmatter
     (`reconstructMemoryTransitions`); returns `[]` when there is no drift. Proven with both a
     well-formed sequence (empty result) and a deliberately inconsistent fixture (bracket says
     `pending → backlog`, frontmatter actually written is `approved` — reported as a mismatch).
- **Assumed task-014 interface (for merge reconciliation):** none needed — this task never calls into
  or assumes a "resolve current git identity" write-time helper; it only reads already-made commits.
  If task-014 later adds a `resolveGitIdentity()`-style primitive, there is no overlap to reconcile:
  task-014 gates writes, this task audits reads.
- **red/green/refactor:** no blockers. All planned tests passed on first implementation; the only
  deviation from a literal first draft was the refactor step (extracting `./git-log`), done to avoid
  two near-identical git-log-parsing blocks in `history.ts` and `audit.ts`.
- **review:** full suite (`npx jest`) 34 suites / 338 tests passing; `npx tsc --noEmit` exit 0;
  `npx jest --coverage` global branch coverage 87.33% (>80% threshold); `audit.ts` itself sits lower
  on branch coverage (~59%, all uncovered branches are unreachable destructuring-default fallbacks,
  the same pattern already present and already uncovered in task-011's `history.ts`) but does not
  drag the project-wide (global) threshold below 80%, which is what `jest.config.js` enforces.
- **Reconciliation with task-014 (post-rebase):** this branch was built before task-014-git-identity-
  required (REQ-SEC-01) landed on `main`. Once rebased, both tasks turned out to define their own
  independent "is this an attributable identity" rule — task-014's `requireGitIdentity`
  (`src/core/git-identity.ts`) inline-checked `name.length === 0 || email.length === 0` on live git
  config, while this task's `isValidAttribution` (`src/memory/audit.ts`) re-derived the same
  non-empty-name/non-empty-email base check on a historical commit's recorded author, then layered its
  own `.(none)`/format rules on top. Per Roberto's explicit instruction the base rule now lives in
  exactly one place: `src/core/git-identity.ts` exports a new pure predicate,
  `isConfiguredIdentity(name, email): boolean`, holding task-014's exact original rule
  (`name.length > 0 && email.length > 0`); `requireGitIdentity` was rewired to call it instead of
  repeating the inline check (REQ-SEC-01's behavior and its `test/core/git-identity.test.ts` suite are
  unchanged — all 4 cases still pass). `isValidAttribution` (REQ-SEC-02) now imports and calls
  `isConfiguredIdentity` from `../core` for that same base check, instead of re-implementing it, and
  keeps two read-only augmentations layered explicitly on top, each documented in `audit.ts` as
  audit-only: (1) rejecting git's own guessed-domain marker `.(none)` — this can only appear on
  commits made *before* task-014's write-time guard existed, so it is a legacy-history concern, not
  part of the live write-time rule; (2) rejecting a non-empty-but-malformed email shape (`EMAIL_RE`) —
  `requireGitIdentity` never needs this because a live git config value is always well-formed or
  empty, but a historical commit author can carry a hand-edited/malformed one. Added a dedicated test
  block (`test/memory/audit.test.ts`, "isValidAttribution reconciled with isConfiguredIdentity") that
  asserts `isValidAttribution` agrees with `isConfiguredIdentity` for both a real identity and the
  fully-empty case, and is strictly narrower than it only on the `.(none)` case — proving the shared
  base plus documented delta rather than two independently-drifting rules. Full suite after
  reconciliation: `npx tsc --noEmit` exit 0; `npx jest` 345/345 passing (342 pre-existing + 3 new).
  Traceability: REQ-SEC-01 (task-014, write-time precondition) ↔ REQ-SEC-02 (task-015, read-time
  audit) now share one base predicate; no other file changed.
