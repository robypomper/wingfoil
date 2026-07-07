---
id: "task-019-implement-versioning-audit-trail"
type: task
title: "Implement Versioning & Audit Trail (P1.2)"
status: in-progress
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

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
