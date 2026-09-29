---
id: "task-109-transition-brackets-accept-the-ascii-arrow"
type: task
title: "A transition bracket is parsed in either arrow form, and one that parses in neither is reported instead of skipped"
status: in-progress
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

### design (architect)

- **`depends_on`** is `[]` (`grep -n '^depends_on' <this file>`), so `dl-015`'s read-related gate has
  nothing to load.
- **Specs.** No tech-spec defines the consistency check's return shape:
  `grep -rn -i 'consistency\|BRACKET_RE' docs/self/docs/04_memory/design/specs/` finds none, and the
  only spec text on the bracket is `spec-004` §4.3 (`status: approved`), which assigns the bracket to
  `approve`/`reject`/`deprecate` and says the audit "parses both shapes" (plain and bracketed) — this
  task does not touch that split. No BDD `.feature` mentions the bracket
  (`grep -rln -i bracket docs/02_requirements/02_bdd/features/` → nothing). The contract of the new
  report therefore lives in `verifyTransitionConsistency`'s TSDoc; no spec is scaffolded.
- **Scope correction (claim-evidence).** The Description says `memory history` reads ASCII-arrow
  transitions as absent. It does not: `grep -rn 'verifyTransitionConsistency\|BRACKET_RE' src` shows
  `BRACKET_RE`'s only consumer is `verifyTransitionConsistency`, whose only other mention is the
  `src/memory/index.ts` barrel; `memory history` (`src/core/index.ts:900`) calls
  `reconstructMemoryTransitions`, which derives both states from frontmatter `status:` and never reads
  the bracket. The defect is confined to the audit's consistency check, as `bug-137` says.
- **Design.** `BRACKET_RE`'s arrow becomes the alternation `(?:→|->)`; the first group turns lazy over
  `[^[\]]` so the first arrow still splits from/to, exactly as the old `[^[\]→]` class did.
  `verifyTransitionConsistency` returns `TransitionFinding[]`, a union discriminated by `kind`:
  `'mismatch'` (the existing `ConsistencyMismatch`, plus the `kind` field) and a new
  `'unparseable'` (`sha`, `subject`). A subject counts as *carrying a bracket* when it is a `wf(`
  subject and contains `[` or `]`; the `wf(` guard keeps ordinary commits that touch a Memory file and
  quote a bracket in prose (`docs(self): implement dl-054 — the [from → to] bracket …`) out of the
  report. `[]` keeps meaning "every bracket was checked and agrees".
- **AC classification (T1).**
  1. `->` parsed as `→` — **red-first**: today an ASCII bracket that disagrees with the frontmatter
     yields `[]`.
  2. `→` parses as today — **characterization**: the Unicode rows pass on first run.
  3. unparseable bracket reported — **red-first**: today `[triaged => planned]` and an unbalanced
     bracket yield `[]`.
  4. multi-hop bracket keeps today's behaviour — **characterization**. Today
     `[in-review → resolved → closed]` splits at the first arrow, so `declared.to` is
     `resolved → closed`, which never equals a frontmatter state: it is reported as a mismatch. The
     test pins that, not a different behaviour.
  5. `npm test` green, coverage not regressing — **verification**.

### red (developer)

- Tests appended to `test/memory/audit.test.ts` (describe `… both arrow forms, and brackets that parse
  in neither (task-109)`), 15 cases. `npx jest test/memory/audit.test.ts --verbose` before any code
  change: **8 failed, 39 passed** (47 in the file). The 8 reds are exactly the red-first rows: the
  `->` mismatch and no-space rows (AC1), the `->` multi-hop row (AC1 applied to AC4's shape), the four
  unparseable shapes and the `kind` discriminant (AC3).
- Passing on first run, as characterization: every `→` row (AC2), the `→` multi-hop pin (AC4), the
  non-`wf(` prose subject (AC3's guard, which is today's behaviour too). The `->` row whose bracket
  *agrees* with the frontmatter also passes today, vacuously — the bracket is skipped and `[]` comes
  back either way; it is kept because after green it is the only row proving an ASCII bracket that
  agrees yields no finding.
