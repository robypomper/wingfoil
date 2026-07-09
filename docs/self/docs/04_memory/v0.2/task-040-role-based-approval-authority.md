---
id: "task-040-role-based-approval-authority"
type: task
title: "Infrastructure: REQ-SEC-03 — role-based approval authority"
status: in-progress
release: "v0.2"
priority: "Blocker"
tags: ["v0.2", "security"]
ref: "REQ-SEC-03"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

Implement the Security constraint **REQ-SEC-03** (only the `approver` role may approve; agents never self-approve).

## Acceptance Criteria

Satisfies the Fit Criterion for **REQ-SEC-03** in `docs/02_requirements/03_sard/05_security-compliance.md`.

## Implementation Notes

Grounds `adr-006`. Gates `wingfoil memory approve` (P1.7).

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### design

AC classification (T1): single AC, red-first (new behavior, no pre-existing code implements REQ-SEC-03).
`verify_specs`: the design input this task grounds already exists and is `accepted`/approved —
`adr-006-git-identity-role-based-authz` (`accepted`, cites `REQ-SEC-01, REQ-SEC-03, REQ-SYS-08`),
`REQ-SEC-03` in `docs/02_requirements/03_sard/05_security-compliance.md`, and BDD
`p1-memory/P1.7-memory-approve.feature` (Scenario "Error - approver lacks authority for the type",
exact message `user not authorized to approve type '<type>'`, exit 1) +
`p4-workflow/P4.14-approval-routing.feature`. No new tech-spec needed — proceeding straight to `red`.

Design decision: this is infra like `task-014-git-identity-required`'s `requireGitIdentity` — a
reusable `src/core` building block, not a wired-up `wingfoil memory approve` (that is
`task-046-memory-approve`, `depends_on: [task-040, task-041]`, still `backlog`). Scope:

- Extend `src/core/git-identity.ts` with an exported `readGitIdentity(root)` (name+email pair),
  factoring `requireGitIdentity`'s existing two `readGitConfig` calls out to a reusable primitive
  instead of duplicating git-config reads in the new module (single identity source of truth, per
  this task's brief).
- New `src/core/approval-authority.ts`: `resolveMemberRoles(dna, email)` (case-insensitive match
  against `dna.team.members[].email`), `hasApproverRole(dna, email)` (role membership check against
  the fixed `'approver'` role — role is uniform across every Memory type per `adr-006`/`dna.yaml`;
  every workflow approval step in `workflows/custom/*.yaml` already gates on the single
  `by_role: approver`, there is no per-type approver-role field anywhere in `memory.yaml`/`dna.yaml`
  to key off), and `requireApprovalAuthority(root, dna, typeName)` (the `CoreResult`-returning gate,
  mirroring `requireGitIdentity`'s shape so `task-046` can call it as the same kind of pre-flight).
  `team.agents` is deliberately NOT consulted — agents have no independent git identity/email distinct
  from whichever human account runs the command, so role resolution is git-identity → `team.members`
  only (agents' `approval_authority: false` in `dna.yaml` is enforced by process/CLAUDE.md governance,
  not by a code path this git-identity-keyed check could distinguish).
- Tests: pure-function cases against the REAL `docs/self/.wingfoil/dna.yaml` (`DnaYaml.parse`, mirrors
  `test/memory/state-machine.test.ts`'s real-`memory.yaml` pattern) plus a `makeTempGitRepo`
  integration case for `requireApprovalAuthority`'s git-identity resolution (mirrors
  `test/core/git-identity.test.ts`).
