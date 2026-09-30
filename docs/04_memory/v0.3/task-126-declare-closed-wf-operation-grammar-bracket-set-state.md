---
id: "task-126-declare-closed-wf-operation-grammar-bracket-set-state"
type: task
title: "Declare the closed `wf()` operation grammar with its bracket and `set_state` rules, and make `memory history` read every declared verb"
status: in-progress
release: "v0.3"
kind: "feature"
priority: "high"
tags: ["v0.3", "core", "memory", "grammar", "audit"]
ref: "dl-079"
bug: ["bug-155"]
depends_on: []
tmpl_version: 260703
---

## Description

`OPERATION_RE` (`src/memory/audit.ts:195`) accepts only `add|submit|approve|reject|deprecate`, so `memory history` reports `operation: null` for `start`/`finalize`/`sync`, which the workflow commands will emit themselves (`spec-003` verb table). `dl-079` (A) ratified a closed, declared list: the five CLI verbs plus `start`, `finalize`, `sync`, `amend`, `park`, each with its bracket rule. `BRACKET_RE` (`audit.ts:353`) splits at the first arrow, so every multi-hop `sync` bracket reads as drift (`bug-155`); the verb table now declares that `sync` may chain states, which settles `bug-155` as "read as a chain". Non-Memory scopes (`wf(directive): …`, `wf(workflow): create|remove`) are declared and ignored by `memory history`. This lands first so A's emitters and task-127's `amend` write a grammar that is already read back.

## Acceptance Criteria

- (red-first) `memory history` reports `operation` = `start`, `finalize`, `sync`, `amend`, `park` for subjects of those verbs (fixture repo, one commit each); an undeclared verb (`schedule`, `enter-releasing`) still reports `operation: null` (`dl-035`: history is not rewritten).
- (red-first) `verifyTransitionConsistency` reads `[a → b → c]` as from `a`, to `c`, and reports a finding when an intermediate hop is not a legal edge of the type's machine; the `test/memory/audit.test.ts` "multi-hop" case that pins the drift reading is rewritten, in both arrow forms (`bug-155`).
- (red-first) a `wf(workflow): create x` and a `wf(directive): …` commit touching a Memory path are not reported as Memory operations by `memory history`.
- (characterization) the five existing verbs' parsing is unchanged (existing P1.10 scenarios green).
- (characterization) `spec-008` §2 carries the verb list with each verb's bracket rule, matching the `spec-003` verb table; `spec-004` §4.3's "bracket belongs to the approver-gated verbs" sentence is amended to the table; each with a dated Revision note (`dl-047` option 1).
- (red-first) `workflow: finalize …` and `agent: record …` subjects (the non-`wf()` commits spec-017 and spec-016 emit) are not reported by `memory history` as Memory operations (from proposal A16).
- (characterization) `spec-008` §2 also declares the `set_state` verb rule of the `spec-003` verb table and settles `element.set_release`'s verb — `assign` joins the closed list, or the token is rebound — per the approver's ruling (backlog question Q6), recorded in Execution Notes and spec-008 §2; it also records `dl-061` B.1's convention that a `sync` crossing a `gates` reject edge cites the approver's reject sha.
- (characterization) The practised history is not rewritten (`dl-035`); the correction of the swapped counts in `dl-079`'s approve reason (plan Observations) is cited in Execution Notes.

## Implementation Notes

- **Size:** M · **wave:** 0 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** dl-079 (A); spec-008 §2 (subject grammar); spec-003 verb table; spec-004 §4.3; spec-017 Consequences (`wf(workflow): create|remove` as non-Memory scopes); spec-003 verb table `set_state` rule and its `assign` open item; dl-061 B.1 (sync subject/body convention) — merged from proposal A16.
- **Features:** P1.10, P1.2, P4.10 (verbs only).
- **Planning ruling:** Approver ruling 2026-09-30 (plan R20, Q6): `element.set_release` is rebound to an existing declared verb rather than adding `assign` to the closed list; the design phase names the verb.
- **Notes:** Proposal key: C01 (merged: A16). `src/memory/audit.ts`, `test/memory/audit.test.ts`, `spec-008`, `spec-004`. The subject *emitters* for `start`/`finalize`/`sync` are A's (the task implementing `spec-017`'s Memory commits). Merged with proposal A16 (the workflow domain's proposal for the same `dl-079` change): one task, in wave 0, so every emitter written later (task-217, task-226, task-199, task-205, task-206) targets a grammar that is already read back. Its spec-008/spec-004 Revision notes are hand edits because the `amend` verb (task-127) lands after it.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
