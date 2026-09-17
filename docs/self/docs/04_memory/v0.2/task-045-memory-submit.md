---
id: "task-045-memory-submit"
type: task
title: "Implement `wingfoil memory submit`"
status: backlog
release: "v0.2"
priority: "Critical"
tags: ["v0.2", "p1"]
ref: "P1.6"
bug: ["bug-016-stale-pass2-exit-code-tsdoc"]
depends_on: ["task-036-frontmatter-lifecycle-validation"]
tmpl_version: 260703
---

## Description

As Jordan, deliver feature **P1.6** (US-3-09): submit a draft document for approval, moving it to the type's post-submit state and recording the transition in git.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p1-memory/P1.6-memory-submit.feature`.

Key scenario: `wingfoil memory submit task-101` → frontmatter `status: pending`, transition recorded in git, exit 0.


**`bug-016` — correct the two stale TSDoc blocks while you are in this neighbourhood.**
`src/validation/errors.ts` still encodes the blanket "Pass-2 semantic failures exit `2`" rule in two
places — the `EXIT_INTEGRITY` constant (~line 30) and the `ValidationError.semantic` factory (~line 74)
— and both cite `spec-009` §3 by name. That rule was repudiated when `spec-009` §3 was rewritten to key
exit codes on the nature of the failure rather than the detecting pass, and `task-036` already shipped a
Pass-2 failure (`E_INVALID_STATE`) that exits `1`, so the tree contains a counterexample to its own
documentation.

This lands here because you already own `dl-032`'s realignment of `E_INVALID_TRANSITION`'s message and
exit code in the same call path — `illegal()` in `src/memory/state-machine.ts` is what reaches
`ValidationError.semantic`. The factory itself is **not** wrong to exist: its other six call sites
(`loaders`, `id`, `query`) are genuine parse/integrity checks that correctly keep `2`. Only the prose
generalises. `bug-016` needs closing by hand — no `bug:` back-reference from this task.
## Implementation Notes

Depends on REQ-STATE-01 frontmatter lifecycle (`task-036`). First of the v0.2 memory verbs.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
