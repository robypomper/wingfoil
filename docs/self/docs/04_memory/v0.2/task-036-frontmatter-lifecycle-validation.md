---
id: "task-036-frontmatter-lifecycle-validation"
type: task
title: "Infrastructure: REQ-STATE-01 — frontmatter lifecycle, per-type validated"
status: in-progress
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
spec-001-memory-yaml-schema's `sequence`/`gates`/`waiting` encoding (CLAUDE.md §5: "This replaced an
earlier `transitions` dict-of-arrays encoding"). task-005 already ships the equivalent (and more
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
