---
id: "task-052-directive-remove"
type: task
title: "Implement `wingfoil directive remove`"
status: backlog
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "p3"]
ref: "P3.3"
bug: ""
depends_on: ["task-042-immutable-builtin-assets"]
tmpl_version: 260703
---

## Description

As Morgan, deliver feature **P3.3** (US-6-07): remove an unreferenced custom directive; file deleted, removal committed.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p3-directives/P3.3-directive-remove.feature`.

Key scenario: `wingfoil directive remove legacy-rule` (unassigned) → file deleted; committed; exit 0.

**REQ-SEC-07 clause (b) — assigned to this task by `dl-030-req-sec-07-referenced-asset-ownership`.**
REQ-SEC-07's Fit Criterion has two halves. `task-042-immutable-builtin-assets` ships only the first
(a built-in cannot be removed). The second — *"removal of a still-referenced custom asset is rejected
naming the referrer"* — is this task's for the directive surface: removing a directive still assigned
to a role must be rejected with `cannot remove 'legacy-rule': still assigned to role 'developer'`
(P3.3, exact string). The workflow surface (P4.9, `cannot remove 'arch-review': included by
'release-cycle'`) has no owner in v0.2 and is carried to the next `release-planning` run.

Also per `dl-042`'s review: `task-042`'s `requireCustomAsset` primitive is a pre-flight over a path
string. Confirm before use that its built-in classification is an allow-list on the `custom` segment
and not a `'built-in'` substring deny-list — the latter was the defect that returned `task-042` to
`red`.

## Implementation Notes

Depends on REQ-SEC-07 immutable built-ins (`task-042`) — must refuse to remove built-in assets.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
