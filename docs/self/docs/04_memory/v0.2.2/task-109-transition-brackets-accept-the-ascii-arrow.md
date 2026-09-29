---
id: "task-109-transition-brackets-accept-the-ascii-arrow"
type: task
title: "A transition bracket is parsed in either arrow form, and one that parses in neither is reported instead of skipped"
status: pending
release: "v0.2.2"
priority: "high"
tags: ["v0.2.2", "memory", "history", "audit"]
ref: "bug-137-bracket-regex-skips-ascii-arrow-transitions"
bug: ["bug-137-bracket-regex-skips-ascii-arrow-transitions"]
depends_on: []
tmpl_version: 260703
---

## Description

`BRACKET_RE` (`src/memory/audit.ts:333`) matches a transition bracket only with the Unicode arrow
`→`. A commit subject written with the ASCII arrow — `wf(bug): sync bug-135-… [triaged -> planned]`,
a form this repository's own history carries — is silently passed over by
`verifyTransitionConsistency`, so `memory history` and the audit read those transitions as absent.

**Why it is in v0.2.2, and first.** It is a prerequisite of the configuration move (`task-111`,
`bug-075`): once the verbs can read this repository's Memory, its ASCII-arrow transitions must be
read, not skipped (`retrospective-rel-v0.2-plan` §6.8 step 1). This closes `bug-137`.

## Acceptance Criteria

1. A subject whose bracket uses `->` is parsed exactly as the same subject with `→` (same from/to
   states). *Red-first.*
2. A subject with `→` parses as today. *Characterization.*
3. A subject that carries a bracket parsing in neither form (e.g. `[triaged => planned]`, or an
   unbalanced bracket) is reported as an unparseable transition, not passed over in silence.
   *Red-first.*
4. A multi-hop bracket already in the history (e.g. `[in-review → resolved → closed]`) keeps the
   behaviour it has today, pinned by a test whichever that is. *Characterization.*
5. `npm test` green; coverage not regressing.

## Implementation Notes

- The fix belongs in the regex and its one consumer; no subject is rewritten in the history.
- Count the ASCII-arrow subjects before and after (`git log --format=%s | grep -c -- '->]'` style)
  and record the numbers in Execution Notes, so the effect on this repository's history is measured.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
