---
id: "task-019-implement-versioning-audit-trail"
type: task
title: "Implement Versioning & Audit Trail (P1.2)"
status: in-review
release: "v0.1"
priority: "Critical"
tags: ["v0.1", "memory"]
ref: "P1.2"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

Feature **P1.2 — Versioning & Audit Trail (all pillars)**: every change to Memory, DNA,
Directives, or Workflow files is tracked via git, recording author, ISO-8601 timestamp, and a
commit message — with no separate audit log to maintain.

As Morgan (US-0A-02), I want every change (Memory, DNA, Directives, Workflow) tracked via git
with author, timestamp, and commit message so the audit trail is complete without manual effort.

Concretely this task implements the commit-per-state-change mechanism that every `wingfoil`
mutation goes through: whenever a document's frontmatter `status` changes (or any pillar file is
written), the change is committed as its own git commit, with the git commit's own timestamp
supplying the ISO-8601 time and the commit author supplying identity (per the commit-format
convention in CLAUDE.md §5.1). It must also fail cleanly rather than silently skip committing when
git identity is not configured.

## Acceptance Criteria

See docs/02_requirements/02_bdd/features/p1-memory/P1.2-versioning-audit-trail.feature. Key
scenarios:
- **Every state change records author and timestamp**: when a Memory document's `status` changes
  from `draft` to `pending`, a git commit is created recording author identity and an ISO-8601
  timestamp, with the commit message referencing the document id and new state.
- **Audit trail completeness across pillars**: after changes to DNA, a directive, and a workflow
  file, 100% of those changes are attributable to an author and timestamp — none reported as
  "unknown author".
- **Error — committing a change with no configured git identity**: if `user.name`/`user.email`
  are not configured, the change is not committed and the system exits with code 1 and message
  "git identity not configured (user.name/user.email)".

## Implementation Notes

Cross-references `spec-011-storage-layout` (where files live) and the memory-operation commit
format conventions (subject/body shape for add/submit/approve/reject/deprecate). Realizes
REQ-SYS-01 (git as source of truth) and the audit-trail half of P1.7/P1.10 (approver identity +
reason surfaced via `wingfoil memory history`). Depends on task-001 (Node.js/TypeScript scaffold)
and task-018 (git-backed storage) for the underlying `.wingfoil/` git repository this commit
mechanism operates against, and task-002 (validation/ID engine) for validating documents before
they are committed.

## Execution Notes

Worked on branch `task/task-019-implement-versioning-audit-trail` (dedicated worktree), parallel to
Batch-B siblings (task-026/028/029).

- **design (scope finding):** checked P1.2 against `spec-011-storage-layout` (approved; describes
  `.wingfoil/` layout, not touched by this task) and CLAUDE.md §5.1 (the commit-format convention).
  No gap: the commit-per-state-change + attribution contract P1.2 asks for is already fully built —
  `commitPaths` (task-018, `src/storage/commit.ts`) is the "one state change = one scoped, attributable
  commit" mechanism; `requireGitIdentity` (task-014, `src/core/git-identity.ts`) is the write-time
  precondition with the exact REQ-SEC-01 refusal message; `auditAttribution`/
  `reconstructMemoryTransitions` (task-015, `src/memory/audit.ts`) are the read-time "0 unknown
  author" / transition-reconstruction verification. No new tech-spec needed.
- **ADR-007 cross-check:** the BDD scenario's "commit message references the document id and new
  state" is satisfied differently per CLAUDE.md §5.1's actual convention: `add`/`submit` subjects
  carry only the doc id (no `[old → new]` bracket — that's reserved for `approve`/`reject`/
  `deprecate`); the new state is derived from the frontmatter actually committed, never from the
  subject text (already documented in `audit.ts`'s module doc, ADR-007). Verified rather than
  re-litigated.
- **red/green (honest TDD note, like task-013):** since every piece already exists and is already
  covered by task-014/015/018's own unit suites, there was no failing state to drive — the value add
  here is a genuinely new **integration** suite,
  `test/memory/versioning-audit-trail.test.ts`, that exercises all three P1.2 BDD scenarios
  end-to-end (real temp git repos, real `commitPaths`/`requireGitIdentity`/`auditAttribution` calls)
  in one place, which didn't exist before (the existing suites test each primitive in isolation, never
  composed together against the literal BDD scenario text). All 4 new tests passed on the first run —
  a characterization/verification suite, not a red→green cycle. No production code change; no
  refactor phase (nothing to refactor).
- **checks:** full suite green (389 tests, up from 385), `npx tsc --noEmit` exit 0, coverage 98.73%
  lines / 87.68% branches overall (> 80% threshold; no new production code, so coverage is
  unaffected by this task).
- **deviations:** none from the plan. P1.2 is a verification-only close, same shape as task-013
  (REQ-INT-05).
