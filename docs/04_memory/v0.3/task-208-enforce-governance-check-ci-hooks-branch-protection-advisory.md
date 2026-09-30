---
id: "task-208-enforce-governance-check-ci-hooks-branch-protection-advisory"
type: task
title: "Enforce the governance check in CI, with hooks, branch protection and the advisory lints"
status: pending
release: "v0.3"
kind: "feature"
priority: "high"
tags: ["v0.3", "process", "governance", "ci"]
ref: "dl-103"
bug: []
depends_on: ["task-139-extend-documentation-doc-versioning-testing-directives-ratified-clauses", "task-167-build-governance-check-over-pushed-wf-commits", "task-201-add-claim-rerun-rereview-items-code-review-task"]
tmpl_version: 260703
---

## Description

`governance.yml` runs task-167 on push/PR to `main`; a tracked hook directory runs the same script locally; branch protection makes it binding. The claim-shape lint (dl-097 (b)) runs warn-only;

## Acceptance Criteria

- (characterization) `.github/workflows/governance.yml` on push and pull_request to `main`, SHA-pinned, read-only permissions; a test pins trigger and steps.
- (characterization) a tracked hooks directory (`core.hooksPath` opt-in, documented in `git-conventions.md`) runs the same script.
- (red-first) the claim lint flags a state-claim phrase with no command in the same item, and an empty-output block with no positive case; warn-only (exit 0 with annotations); fixtures.
- (characterization) `code-review.md` states policy (i): no gated transition by an unattended run.
- (characterization) approver, in session: branch protection on `main` requiring the check, recorded as a `service` element through `service-ingest` (`kind: setting`, `verify:` a `gh api` command).

## Implementation Notes

- **Size:** M · **wave:** 3 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** dl-103 §1 (A)+(C) with (B), §2 (i); dl-097 (b) warn-only lint; dl-099 §4 (c) host.
- **Features:** P4.14.
- **Planning ruling:** Approver ruling 2026-09-30 (plan R19): `dl-103` §2 (iii), signed approvals, is out of v0.3 (v0.4 at the earliest, possibly v1.0).
- **Notes:** Proposal key: D22. dl-103 §2 (iii) signed approvals was to be "evaluated at v0.3 planning"; the plan records no evaluation — the approver should rule (recommend: defer to v0.4) at commit-backlog. The config version-bump check (`bug-143`) is task-183's `test/lint/` suite, which `governance.yml` runs with the rest of the suite.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
