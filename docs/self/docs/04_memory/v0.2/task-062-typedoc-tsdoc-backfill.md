---
id: "task-062-typedoc-tsdoc-backfill"
type: task
title: "TypeDoc/TSDoc backfill + flip docs.api.* review gate to hard-reject (dl-014)"
status: pending
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "docs"]
ref: "dl-014-dev-loop-plan-deltas"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

Carry the **dl-014 B-DECISION Option 2** deferred work: backfill TSDoc across all existing v0.1 public exports, wire TypeDoc + doc-coverage tooling, then flip the `dev-loop` review-gate checks `docs.api.public-complete` / `docs.api.build` from **warn** to **hard-reject** once green.

## Acceptance Criteria

Acceptance:
- Every public/exported symbol in `src/` carries TSDoc; `typedoc` builds clean.
- Doc-coverage tooling wired into the `refactor.checks.post` gate.
- `docs.api.*` checks flipped from warn to hard-reject (`dev-loop.yaml`); the `documentation` directive updated accordingly.
- Suite green, `tsc` 0.

## Implementation Notes

Source: `dl-014` B-DECISION Option 2 (staged posture recorded in the config-bootstrap). Until this lands, `docs.api.*` stay warn-only so v0.2 dev-loops are not blocked from day one. TypeDoc is now in `dna.yaml` stacks.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
