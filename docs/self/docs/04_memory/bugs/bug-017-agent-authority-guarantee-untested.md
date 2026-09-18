---
id: "bug-017-agent-authority-guarantee-untested"
type: bug
title: "No test anywhere pins the guarantee that an AI agent holding `approver` via executes_as gains no approval authority"
status: in-review
severity: "medium"
release-origin: "v0.2"
release: "v0.2"
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`dl-033-canonical-role-resolver` draws its boundary on one load-bearing guarantee: an entry in
`team.agents[]` whose `executes_as` includes `approver` must gain **no** approval authority. That
guarantee is true by construction in `src/core/approval-authority.ts` — and is pinned by no test
anywhere in the repository.

## Steps to Reproduce

1. `grep -rn "team.agents\|executes_as" test/core/approval-authority.test.ts` — no fixture in that
   suite contains a `team.agents` entry at all.
2. There is therefore no case asserting `hasApproverRole(dnaWithAgentHoldingApprover, …) === false`.

## Expected Behavior

The guarantee has a regression test. It is the exact defect `task-034` was rejected for on its first
pass (`resolveApprover` falling back to `agents[0]`), so it is a proven failure mode, not a
hypothetical one.

## Actual Behavior

`resolveMemberRoles` reads `dna.team.members` only and never mentions `team.agents`, so the property
holds structurally — but nothing would fail if a future edit introduced an agent fallback, which is
precisely what happened once already.

## Notes

The natural home is `test/core/approval-authority.test.ts`, whose module (`task-040`) is `done` and
merged. A single characterization case would close it: a `DnaYaml` fixture with
`team.agents: [{ executes_as: ['approver'], approval_authority: true }]` and no member holding
`approver`, asserting `requireApprovalAuthority` refuses.

Note the deliberately adversarial fixture shape — `approval_authority: true` — because of the related
fact `task-034`'s second rejection turned on: **no code anywhere reads `approval_authority`**. It is a
declarative `dna.yaml` marker enforced by governance (ADR-006, CLAUDE.md §4/§8), so a test that sets
it to `true` and still expects refusal pins both halves at once: agents get nothing from
`executes_as`, and nothing from the marker either.

Raised by `task-034`'s second-pass review.

## Triage & Execution Notes

- capture (`bug-ingest`): raised by `task-034`'s second-pass review.
