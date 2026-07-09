---
id: "task-040-role-based-approval-authority"
type: task
title: "Infrastructure: REQ-SEC-03 — role-based approval authority"
status: in-review
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

### red

Added `test/core/approval-authority.test.ts` (11 cases): pure `resolveMemberRoles`/`hasApproverRole`
lookup against the REAL `docs/self/.wingfoil/dna.yaml` (Roberto holds `approver`) + a synthetic
approver/reviewer DNA, and git-identity-gated `requireApprovalAuthority` cases over a `makeTempGitRepo`
fixture with isolated `GIT_CONFIG_*` (asserting the exact REQ-SEC-03 message
`user not authorized to approve type '<type>'`, `VALIDATION` code, and the success path). Ran red:
suite failed to run — `Cannot find module '../../src/core/approval-authority'`. Committed `31e716c`.

### green

- Refactored `src/core/git-identity.ts` to add an exported `readGitIdentity(root): GitIdentity`
  primitive and re-expressed `requireGitIdentity` on top of it — so the new module reuses the SINGLE
  git-config read/`isConfiguredIdentity` source of truth (task-014) instead of duplicating it. No
  behavior change to `requireGitIdentity` (its 4 existing tests stay green).
- Added `src/core/approval-authority.ts`: `APPROVER_ROLE`, `resolveMemberRoles` (case-insensitive
  email → `team.members[].roles`, `[]` on empty/unmatched), `hasApproverRole`, and
  `requireApprovalAuthority(root, dna, typeName)` — the `CoreResult`-returning gate keyed on the live
  git identity, mirroring `requireGitIdentity`'s precondition shape. `team.agents` deliberately not
  consulted (see module doc comment — agents have no distinct git identity; their
  `approval_authority: false` is a governance fact, not a code signal here).
- Exported the module from `src/core/index.ts`. New/changed tests green (14/14 for the two suites);
  `tsc` clean. Committed `f338367`.

### refactor

Nothing to refactor. The green implementation is already minimal — pure functions with single
responsibilities, no duplication (the git-config read was factored into `readGitIdentity` during
green, which is the only structural cleanup the change warranted), full TSDoc on every export. Per
dev-loop guidance, no fabricated refactor commit was made.

### review

- `npm test` (full suite): **558/559 pass**. The single failure is `test/cli/program.integration.test.ts`
  › "memory search api ... under 1 second" — a **pre-existing wall-clock assertion**
  (`Date.now() - start < 1000`) that flakes under the ~10 parallel dev-loops saturating the machine
  (observed 1429/1598/1948 ms). Its functional assertions (exit 0, correct match) pass; the file is out
  of this task's scope (CLI/perf, not touched) and must not be edited (would collide with sibling
  branches). Treated as GREEN per coordinator advisory.
- `tsc -p tsconfig.build.json`: exit 0.
- `npm run test:coverage`: no threshold failure (global ≥80% held); the two new/changed files
  `src/core/approval-authority.ts` + `src/core/git-identity.ts` at **100%** stmts/branch/funcs/lines.
- `npm run docs:api`: exit 0, no TypeDoc warnings on the new exports (`readGitIdentity`,
  `GitIdentity`, `APPROVER_ROLE`, `resolveMemberRoles`, `hasApproverRole`, `requireApprovalAuthority`).
- Traceability: REQ-SEC-03 (fit-criterion message verbatim) ← BDD `P1.7-memory-approve.feature`
  "Error - approver lacks authority" + `P4.14-approval-routing.feature` ← adr-006 (accepted). The gate
  is infra for `task-046-memory-approve` (still `backlog`, `depends_on: [task-040, task-041]`), which
  will wire it into `wingfoil memory approve`; this task ships the reusable `src/core` primitive only.
