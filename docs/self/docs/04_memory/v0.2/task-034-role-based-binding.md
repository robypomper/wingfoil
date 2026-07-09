---
id: "task-034-role-based-binding"
type: task
title: "Infrastructure: REQ-SYS-08 — role-based directive/approval binding"
status: in-progress
release: "v0.2"
priority: "Blocker"
tags: ["v0.2", "architecture"]
ref: "REQ-SYS-08"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

Implement the Architecture constraint **REQ-SYS-08** (role-based binding: directives and approval authority reference roles, never named persons). Foundation for the Directives pillar (P3) and the memory approval verbs.

## Acceptance Criteria

Satisfies the measurable Fit Criterion for **REQ-SYS-08** in `docs/02_requirements/03_sard/01_architecture.md`.

## Implementation Notes

Grounds `adr-006` (git identity + role-based authority). Enables P3.2/P3.7 assignment and P1.7 approval gating.

## Execution Notes

### design

AC classification (T1, `dl-014`) — the task's single generic AC ("Satisfies the measurable Fit
Criterion for REQ-SYS-08") is broken into three concrete, testable sub-ACs, all **red-first** (no
existing resolver code covers any of them today):

- **AC-1** — `isRoleDefined`/`assertRoleDefined`: a role name is checked against `dna.yaml`'s
  `team.roles` catalogue; an undefined role is rejected with the exact message
  `unknown role '<role>' (not defined in dna.yaml)` (BDD `p5-interaction/P5.4.2-role-directives-binding.feature`
  Scenario "Error - binding references an undefined role").
- **AC-2** — `resolveRoleHolders`: resolves the humans (`team.members`) and agents (`team.agents`)
  currently holding a role by reading `dna.yaml` alone — no directive or workflow file is read to
  compute it. Directly exercises the ADR-006/REQ-SYS-08 Fit Criterion ("reassigning a person's role in
  DNA changes their effective directives and approval authority with zero edits to directive or
  workflow files"): a test changes only the role assignment inside a `DnaYaml` fixture and shows the
  resolved holders change accordingly.
- **AC-3** — `resolveApprover`: routes to the role holder (BDD `p4-workflow/P4.14-approval-routing.feature`
  Scenario "Route a pending approval to the role holder") and fails with the exact message
  `no approver found for role '<role>' in dna.yaml` when nobody currently holds the role (P4.14
  Scenario "Error - the approval role has no member in DNA").

Not in scope (left to the tasks that already own them, all `depends_on: ["task-034-role-based-binding"]`
or otherwise grounded in the same ADR): P4.14's `by_person` override branch and any CLI/MCP wiring
(`memory approve`, task-040/045/046); `directive assign`/`directive bind` verbs that call these
primitives (task-051, task-056); REQ-SEC-03's "agents never self-approve" enforcement (task-040,
`depends_on: []` but conceptually layers on this task's `resolveRoleHolders`/`resolveApprover`). This
task ships the pure, DNA-only resolver those build on — no `CORE_MODULES` operation is registered here
(none of Wave 1's sibling infra tasks — task-035..044 — register one either).

`depends_on: []` → no `agent.read_related` (dl-015 hard gate is a no-op here).

`agent.verify_specs` — no new tech-spec needed: this is a pure code-level utility over the already
`spec-002-dna-yaml-schema`-approved `DnaYaml`/`Team`/`RoleEntry`/`TeamMember`/`AgentEntry` shapes; no
new file format, schema, or constant set is introduced. `design` passes straight through — no approver
gate.

Side observation (not actioned — out of this task's scope, config already committed/approved):
`docs/self/.wingfoil/dna.yaml`'s `team.roles` comment cites `[SPEC: REQ-SYS-08 / BDD P4.20 "role
'...' not defined in dna.yaml"]` — `P4.20` is `p4-workflow/P4.20-template-customization.feature`
(unrelated). The quoted message actually matches `P5.4.2`'s "unknown role '...' (not defined in
dna.yaml)" almost verbatim, so this reads as a stale/mistyped BDD citation in the DNA config comment,
not a functional gap. Flagged for the approver; not corrected here since it is a citation typo in an
already-`accepted`-adjacent config file, not part of this task's AC.
