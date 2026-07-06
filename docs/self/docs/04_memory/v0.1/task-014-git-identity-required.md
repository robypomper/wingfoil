---
id: "task-014-git-identity-required"
type: task
title: "Infrastructure: REQ-SEC-01 — Git identity required for state mutations"
status: in-progress
release: "v0.1"
priority: "Blocker"
tags: ["v0.1", "architecture"]
ref: "REQ-SEC-01"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

Implement the pre-flight check, shared by every state-mutating command (`src/core`, invoked
identically by CLI and MCP per REQ-SYS-05), that verifies a configured git identity
(`user.name` + `user.email`) before any Memory/DNA/Directives/Workflow mutation is attempted. Git
identity is WingFoil's sole attribution mechanism — there is no separate authentication layer,
session system, or external IAM/OAuth2 provider; the commit author and commit timestamp *are* the
"who" and "when" of the audit trail. As Morgan (the auditor persona), I want every state-mutating
command to refuse to run at all when git identity is unset so that the audit trail can never contain
a commit with an unattributable author.

## Acceptance Criteria

Per REQ-SEC-01's fit criterion: "With git identity unset, any state-mutating command fails with
`\"git identity not configured (user.name/user.email)\"` and writes nothing."

Testable breakdown:
- With `user.name` and/or `user.email` unset (locally and globally), invoking any state-mutating
  command (`memory add/submit/approve/reject/deprecate`, `workflow start/end/next`, etc.) fails
  before any file is written, with the exact message `git identity not configured
  (user.name/user.email)`.
- The check runs identically whether the mutation is invoked via the CLI or via an MCP Tool call
  (same shared `core` validation path, REQ-SYS-05) — no divergent behaviour between the two
  surfaces.
- Read-only commands (`memory search`, `dna show`, `workflow status`, `paths`, …) are unaffected by
  missing git identity — the check applies only to the state-mutating surface.
- Once identity is configured, the same command proceeds normally and the resulting commit's author
  matches the configured `user.name <user.email>`.
- See BDD `p1-memory/P1.2-versioning-audit-trail.feature`.

## Implementation Notes

- Architectural backing: `docs/self/docs/04_memory/design/adrs/adr-006-git-identity-role-based-authz.md`
  — point 1 fixes git identity as the attribution mechanism for every state change (no external
  IAM/OAuth2/Cognito/Auth0 provider); point 2 (role-based approval authority, REQ-SEC-03) is a
  separate, later concern layered on top of this same identity.
- Storage grounding: `docs/self/docs/04_memory/design/adrs/adr-001-git-backed-storage.md` — git is
  the single source of truth (REQ-SYS-01); attribution rides on the commit author git already
  tracks, with no separate identity/session system to build or operate.
- Implement the check once in `src/core` (not duplicated per CLI command or per MCP Tool) so the
  CLI and MCP surfaces share identical enforcement by construction, per REQ-SYS-05.
- Related feature task that depends on this in this release: `task-019-implement-versioning-audit-trail`
  (backlog `TASK-017`, `wingfoil` Versioning & Audit Trail feature, P1.2).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
