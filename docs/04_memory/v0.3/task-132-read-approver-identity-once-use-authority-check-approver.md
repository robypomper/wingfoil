---
id: "task-132-read-approver-identity-once-use-authority-check-approver"
type: task
title: "Read the approver's identity once and use it for the authority check, the `Approver:` line and the commit author"
status: in-progress
release: "v0.3"
kind: "fix"
priority: "high"
tags: ["v0.3", "core", "security", "memory"]
ref: "dl-064"
bug: ["bug-142", "bug-149", "bug-153"]
depends_on: []
tmpl_version: 260703
---

## Description

`readGitIdentity` (`src/core/git-identity.ts:61`) reads `git config`, but the commit is authored by git's own precedence (`GIT_AUTHOR_*` first), so the approved identity and the recorded one can differ (`bug-149`). `dl-064` B.1 gives this task the change: `requireGitIdentity` returns the identity and it feeds authority, `Approver:` and `--author`. The identity → prepare-transition preamble is copied in four verbs (`bug-142`), which is where the single read belongs; `isValidAttribution` accepts RFC 2606 reserved domains (`bug-153`).

## Acceptance Criteria

- (red-first) with `GIT_AUTHOR_EMAIL` set to an address other than `user.email`, `memory approve` either uses one identity for the check, the `Approver:` line and the author, or refuses; never two (the rule chosen in design, stated in `spec-006`).
- (red-first) one shared preamble helper is called by submit/approve/reject/deprecate (and `amend` from task-127, `park` from task-180 when present); a structural test asserts no verb calls `requireGitIdentity` directly.
- (red-first) `isValidAttribution` rejects `.invalid`, `.example`, `.test`, `.localhost` domains.
- (characterization) `spec-006` states the order usage checks → identity → transition legality → authority, scoped to `approve`/`reject` (A.1), with a Revision note.

## Implementation Notes

- **Size:** M · **wave:** 1 · **kind:** fix (`dl-133` Q1 (b)).
- **Implements:** dl-064 A.1 (pre-flight order in spec-006, approve/reject), B.1; REQ-SEC-01; REQ-SEC-03.
- **Features:** P1.7, P1.8.
- **Notes:** Proposal key: C13.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
