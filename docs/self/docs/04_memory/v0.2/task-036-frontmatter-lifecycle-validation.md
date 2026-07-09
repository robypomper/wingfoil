---
id: "task-036-frontmatter-lifecycle-validation"
type: task
title: "Infrastructure: REQ-STATE-01 — frontmatter lifecycle, per-type validated"
status: in-review
release: "v0.2"
priority: "Blocker"
tags: ["v0.2", "state"]
ref: "REQ-STATE-01"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

Implement the State constraint **REQ-STATE-01** (document state derived from frontmatter; every transition validated against the per-type state machine).

## Acceptance Criteria

Satisfies the Fit Criterion for **REQ-STATE-01** in `docs/02_requirements/03_sard/03_state-context.md`.

## Implementation Notes

Consumes `memory.yaml` per-type machines (`spec-001`) + frontmatter schema (`spec-010`). Prerequisite for `wingfoil memory submit` (P1.6).

## Execution Notes

### design (architect) — 2026-07-09

**AC classification** (the task's single AC is the REQ-STATE-01 Fit Criterion in
`docs/02_requirements/03_sard/03_state-context.md`: *"A transition not present in the type's
`transitions` graph is rejected with `illegal transition <from> -> <to> for type '<type>'` and leaves
the state unchanged."*):

| Sub-criterion | Classification | Rationale |
|----|----------------|-----------|
| Transition legality per type (`submit`/`approve`/`reject`/`deprecate`, illegal transitions rejected before any write) | **pre-satisfied** | `resolveStateMachine`/`resolveTransitionTarget` (`src/memory/state-machine.ts`, task-005-per-type-state-machines + task-010-default-state-machine-fallback + REQ-STATE-08 fallback) already implement this end-to-end against all 7 real registered types, and throw `ValidationError` *before* returning any target — a caller can never reach a frontmatter-write step on an illegal transition. `test/memory/state-machine.test.ts` (322 lines) already covers every real type's legal edges plus illegal-transition rejection. No new work here. |
| Type-contextualized rejection of an undeclared `gates`/`waiting` transition **target** at `memory.yaml` load time | **pre-satisfied** | `MemoryYaml`'s top-level `.superRefine` (`src/memory/schema.ts`, task-024-implement-memory-element-schema, P1.13) already rejects a type's machine that references an undeclared state, with the exact type-contextualized message `"transition target '<state>' not in declared states for type '<type>'"` — `test/memory/element-schema.test.ts` covers it (P1.13 scenario 3). |
| **Per-type membership check on a document's own frontmatter `status` value** — REQ-STATE-01's "document state derived from frontmatter" half, independent of any transition attempt: is the *current* `status` a legal state for its declared `type` at all? | **red-first — the genuine gap this task closes** | Nothing in `src/` validates this today. `resolveTransitionTarget` only answers "is verb `op` legal FROM `currentState`" — it never asserts that an arbitrary `status` string read off a document's frontmatter is itself a member of the type's declared state set. This is exactly BDD `P4.11-deliverables.feature` scenario 3 (`"invalid state 'shipped' for type 'task'"`) and `P4.13-state-deduction.feature` scenario 3 (`"invalid state 'releasing' for type 'task' in <file>"`), both cited by REQ-STATE-01's own traceability list, and is the literal "frontmatter lifecycle, per-type validated" of this task's title. Implemented as `validateFrontmatterState` in `src/memory/state-machine.ts`, alongside the existing transition engine it shares `resolveStateMachine`'s output with. |

**Stale Fit Criterion wording (reconciled, not changed in code):** the SARD Fit Criterion still says
"transitions graph" and `illegal transition <from> -> <to> for type '<type>'` — this predates
spec-001-memory-yaml-schema's `sequence`/`gates`/`waiting` encoding, which explicitly replaced the
earlier `transitions` dict-of-arrays format (see spec-001's "Sub-schema: StateMachine" +
reconciliation note). task-005 already ships the equivalent (and more
precise — it names *why* a transition is illegal: not-in-sequence / gate-requires-approve /
waiting-requires-workflow / terminal-state) rejection message under the current encoding; rewriting
that established, already-consumed message format is out of this task's scope (no downstream task
depends on the literal old wording — `task-045-memory-submit`, the next consumer, is Wave 2 and not yet
started). Same reconciliation pattern as task-017's REQ-SEC-06 path-wording fix, recorded here rather
than silently diverging from the SARD text.

**`depends_on` (`dl-015`):** `[]` — no upstream task Execution Notes to read; no `agent.read_related`
gate to clear.

**Spec verification (`agent.verify_specs`):** No new `tech-spec` needed. The contract is already fully
specified by two `approved` specs: `spec-001-memory-yaml-schema` (per-type `states` machine shape,
consumed via `resolveStateMachine`) and `spec-010-memory-frontmatter-schema` ("Validation rules" table:
*"`status` must be a value in the type's `states.values`" → failure "invalid state for type"*, and
`status` as sole state carrier per REQ-STATE-01/REQ-STATE-02). `ref` is `REQ-STATE-01`, which both specs
trace back to. `design` passes through with **no approver gate** (no new spec scaffolded).

### red (developer) — 2026-07-09

Added a `validateFrontmatterState` `describe` block to `test/memory/state-machine.test.ts` (import of
the not-yet-existing `validateFrontmatterState` + `E_INVALID_STATE`), asserting: every declared
`sequence` state of all 7 real registered types passes silently; the implicit `deprecated` state passes
on every type (never in any `sequence`); BDD `P4.11` scenario 3 rejects `shipped` on `task` with the
exact `E_INVALID_STATE` / `path: status` / message `invalid state 'shipped' for type 'task'`; BDD
`P4.13` scenario 3 rejects a cross-type valid state (`releasing`, legal for `release`) on `task` and
threads the optional `file` field through; and the throw exits `2` (EXIT_INTEGRITY), matching
`resolveTransitionTarget`'s illegal-transition exit code. Ran red: 5 failed / 35 passed
(`TypeError: validateFrontmatterState is not a function` + missing `E_INVALID_STATE`), as expected.
Commit `98755e8`.

### green (developer) — 2026-07-09

Implemented `validateFrontmatterState(machine, typeName, status, filePath='')` + the `E_INVALID_STATE`
code constant in `src/memory/state-machine.ts`, exported both from the `src/memory` barrel. Minimal
body: legal iff `status === DEPRECATED_STATE || machine.sequence.includes(status)`, else throw
`ValidationError.semantic([{ code: E_INVALID_STATE, path: 'status', file: filePath, message: ... }])`.
Reuses the existing engine's `resolveStateMachine` output (`StateMachine`) and `DEPRECATED_STATE`
constant — no reimplementation of the transition engine. Full TSDoc on both new exported declarations
(docs:api hard-reject gate). Target suite: 40/40 green; `tsc -p tsconfig.build.json` exit 0. Commit
`2a6f17b`.

### refactor (developer) — 2026-07-09

No refactor commit. The green implementation is a single membership guard + one throw that already
reuses `resolveStateMachine`'s output, `DEPRECATED_STATE`, and the shared `ValidationError.semantic`
factory — no duplication to extract, no dead code, nothing to tidy. Fabricating a refactor commit here
would add churn without value (same red→green→submit shape as task-024).

### review (reviewer) — 2026-07-09

Traceability intact: REQ-STATE-01 → feature P1.6/P4.11/P4.13 → BDD `P4.11-deliverables.feature` sc.3 +
`P4.13-state-deduction.feature` sc.3 (both directly asserted) → this task. Determinism: pure function
of `(machine, typeName, status)`, no wall-clock / randomness / unordered iteration. No secrets.
Corrected a `CLAUDE.md §5` self-citation in the design notes to cite spec-001 directly (self-config
docs must not cite CLAUDE.md).

**Final gate numbers:**
- `npm test` (full suite, no coverage): **554 / 554 passed**, 58/58 suites GREEN.
- `tsc -p tsconfig.build.json`: exit **0**.
- `npm run test:coverage`: all metrics ≥ 80% — Statements 97.92%, Branches 88.06%, Functions 97.58%,
  Lines 98.34%. Touched file `src/memory/state-machine.ts`: 97.36% branch / 100% func; the only
  uncovered lines (187–188) are the pre-existing `default`/`never` exhaustive-switch arm of
  `resolveTransitionTarget`, not this task's code.
- `npm run docs:api`: exit **0** (TSDoc present on both new exported declarations).

**Known pre-existing flake (not a regression):** under the coverage run (and under heavy parallel
dev-loop load) `test/cli/program.integration.test.ts`'s `memory search api ... under 1 second`
wall-clock assertion can fail (observed 2735ms). It is task-021's out-of-process CLI-spawn timing test
(bug-003 dist-race lineage), unrelated to this task (which touches no CLI/search path); it passes in
isolation and in the un-instrumented full-suite run above. Per coordinator advisory, left untouched.
