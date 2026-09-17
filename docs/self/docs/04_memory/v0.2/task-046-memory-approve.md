---
id: "task-046-memory-approve"
type: task
title: "Implement `wingfoil memory approve`"
status: in-progress
release: "v0.2"
priority: "Critical"
tags: ["v0.2", "p1"]
ref: "P1.7"
bug: ["bug-017-agent-authority-guarantee-untested"]
depends_on: ["task-040-role-based-approval-authority", "task-041-mandatory-reason-on-verbs"]
tmpl_version: 260703
---

## Description

As Sam, deliver feature **P1.7** (US-2-10): approve a pending document with a mandatory reason; the commit records approver identity, ISO-8601 timestamp, and reason.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p1-memory/P1.7-memory-approve.feature`.

Key scenario: `wingfoil memory approve task-101 --reason 'meets standards'` → advances to approved state; commit records approver + timestamp + reason; exit 0.


**`bug-017` — pin the guarantee this task's whole authority model rests on.** Nothing anywhere asserts
that an AI agent holding `approver` via `team.agents[].executes_as` gains **no** approval authority.
`resolveMemberRoles` reads `dna.team.members` only and never mentions `team.agents`, so the property
holds structurally — but nothing would fail if a future edit introduced an agent fallback, which is
exactly what `task-034` shipped on its first pass and was rejected for.

One characterization case in `test/core/approval-authority.test.ts` closes it: a `DnaYaml` fixture with
`team.agents: [{ executes_as: ['approver'], approval_authority: true }]` and **no** member holding
`approver`, asserting `requireApprovalAuthority` refuses. Use `approval_authority: true` deliberately —
`task-034`'s second rejection turned on the fact that **no code anywhere reads that field**; it is a
declarative `dna.yaml` marker enforced by governance (`adr-006`, CLAUDE.md §4/§8). A test that sets it
`true` and still expects refusal pins both halves at once: agents get nothing from `executes_as`, and
nothing from the marker either. `bug-017` needs closing by hand — no `bug:` back-reference.
## Implementation Notes

Depends on REQ-SEC-03 approval authority (`task-040`) + REQ-SEC-04 mandatory reason (`task-041`). Mirrors the manual `wf(...): approve` commit convention this planning phase used.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
