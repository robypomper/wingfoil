---
id: "task-005-per-type-state-machines"
type: task
title: "Infrastructure: REQ-SYS-04 — Configurable per-type state machines"
status: approved
release: "v0.1"
priority: "Blocker"
tags: ["v0.1", "architecture"]
ref: "REQ-SYS-04"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

REQ-SYS-04 requires that Memory element types and their state machines be **declared in
`.wingfoil/memory.yaml`**, not hardcoded in source. Different element types (`task`, `release`, `adr`,
`decision-log`, `tech-spec`, `bug`, `release-line`) have different lifecycles, and adding a new type
with a custom set of states must be honored by `submit`/`approve`/`reject` with zero source-code change.

Concretely, this task implements the state-machine validator against the `sequence` / `gates` /
`waiting` encoding defined by `spec-001-memory-yaml-schema`: `sequence` is the ordered forward chain
(its first element is the type's initial state, replacing the old explicit `initial:` field), `gates`
marks which forward edges are approval gates (and what `reject` targets), and `waiting` marks states
whose forward edge fires only via a Workflow action, never a CLI verb. The validator reads this purely
from `memory.yaml` — it needs no Workflow-step context to know which edge `approve`/`reject` take
(spec-001 fixed this ambiguity that the old `transitions: {state: [target,...]}` dict-of-arrays shape
left unresolved).

## Acceptance Criteria

Per the SARD fit criterion (`docs/02_requirements/03_sard/01_architecture.md`, REQ-SYS-04):

> Adding a new type with custom states to `memory.yaml` is honored by `submit`/`approve`/`reject` with
> no source-code change; an illegal transition for that type is rejected.

Testable form:
- Adding a new `types.<name>.states` block (its own `sequence`/`gates`/`waiting`) to `memory.yaml`
  makes `memory.add/submit/approve/reject` for that type work immediately, with no code deployed.
- Attempting a transition not on the type's `sequence` chain (or not matching a declared `gates`
  target) is rejected before any file is written and the document's `status` is left unchanged
  (REQ-STATE-01).

## Implementation Notes

- `spec-001-memory-yaml-schema` is the authoritative schema for the `sequence`/`gates`/`waiting`
  encoding this validator consumes — it replaced the ambiguous `transitions` dict-of-arrays precisely
  so state could be validated from `memory.yaml` alone (see spec-001 "Consequences").
- `spec-009-validation-strategy`'s two-pass pipeline (structural Zod pass, then semantic pass) is where
  this state-machine validation slots in as part of Pass 2 for Memory frontmatter mutations.
- Related feature work in this release that this infra task unblocks (`related_stories` in
  `docs/03_backlog/04_backlog/by-release/v0.1.json`, backlog `TASK-003`): `TASK-022` "Implement Memory
  Element Schema (memory.yaml)" (memory `task-024-implement-memory-element-schema.md`).

## Execution Notes

- **design**: `agent.verify_specs` against spec-001-memory-yaml-schema and spec-009-validation-strategy
  (both `approved`) found no gap — both already fully cover this task's scope (spec-001 the
  `sequence`/`gates`/`waiting` encoding and its transition semantics, spec-009 the two-pass pipeline
  this validator slots into as Pass 2). No new tech-spec scaffolded; passed straight through.
- **Reuse of task-004's `StateMachine` schema (no duplication)**: `src/memory/schema.ts` (task-004)
  already owns the *structural* `StateMachine` Zod schema — the `sequence`/`gates`/`waiting` shape
  plus a `.superRefine()` enforcing spec-001's "Semantic validation (post-parse)" rules (gates/waiting
  keys ⊆ sequence, `"deprecated"` reserved everywhere). This task's `src/memory/state-machine.ts`
  imports that type (`import type { StateMachine } from './schema'`) and does not re-implement or
  re-validate any of it — it only adds the runtime layer spec-001 does NOT cover: given an
  already-valid machine + a document's current `status` + a requested verb, what target state (if
  any) is legal. `resolveStateMachine(memoryYaml, typeName)` implements the `types.<name>.states ??
  defaults.states` resolution (REQ-STATE-08); `resolveTransitionTarget(machine, currentState, op)` is
  the transition-legality function.
- **Spec-001 transition rules implemented, verified against the spec text** ("Which verb drives each
  forward edge — fully determined by the schema"):
  - state **not** in `gates`, **not** in `waiting`, with a next `sequence` entry → `submit` legal,
    target = next in `sequence`. (Illegal otherwise: not a `sequence` member at all, is a `gates` key,
    is a `waiting` state, or is the terminal `sequence` entry.)
  - state **is** a `gates` key **and not also** in `waiting` → `approve` legal, target = next in
    `sequence` (never read from `gates`, matching spec-001: "never written out — by construction there
    is exactly one"). `reject` legal, target = `gates.<state>.reject`, taken verbatim (need not be a
    `sequence` member — the `bug.open → closed` and `task/adr/tech-spec.pending → draft` cases both
    exercise this).
  - state **is both** a `gates` key **and** in `waiting` (spec-001's explicit dual case: "its forward
    edge is verb-less (picked up automatically) while it still exposes a manual `reject`/decline
    path") → `approve` illegal (verb-less; a Workflow action drives it), `reject` still legal. None of
    the 7 real types in `docs/self/.wingfoil/memory.yaml` currently construct a machine this way, but
    the structural schema explicitly allows it (`test/memory/schema.test.ts`: "allows a state to be
    both in `waiting` and a `gates` key") and spec-001 gives it explicit semantics, so a synthetic
    machine covers it in `test/memory/state-machine.test.ts` rather than skipping it.
  - `deprecate` → always legal, from any current state (including states not even in `sequence`),
    target the reserved `"deprecated"` — the implicit wildcard edge (spec-001: "reachable from any
    state... always legal").
  - No divergence found between the spec text and the task's summary in this respect.
- **REQ-STATE-01 (illegal transition ⇒ no write, status unchanged)**: `resolveTransitionTarget` never
  returns a value on an illegal transition — it throws `ValidationError.semantic([...])`
  (`E_INVALID_TRANSITION`, exit code 2 per spec-009 §3's Pass-2/cross-file family) before any target
  is computed/returned. A dedicated test (`test/memory/state-machine.test.ts`, "an illegal transition
  throws before any target is returned") simulates a document object, attempts the illegal
  `submit`/assignment in one expression, and asserts the document's `status` field is unchanged after
  the catch — proving no caller can reach a frontmatter write on an illegal transition.
- **task-010-default-state-machine-fallback boundary respected**: `resolveStateMachine` implements the
  full `types.<name>.states ?? defaults.states` resolution (one line), but no test exercises "a type
  declares no `states` block at all, falls back to `defaults.states`" — that fixture/coverage is
  task-010's scope. This task's tests only exercise types that declare their own `states` block (all 7
  real types) plus the `defaults` machine accessed directly (not via fallback). Coverage gap this
  leaves: `src/memory/state-machine.ts` line 74 (the "neither the type nor `defaults` declares a
  machine" error branch) and the fallback-selection branch of the `??` on line 72 are not exercised by
  this task's tests — both left for task-010 to cover, consistent with the assigned boundary.
- **Placement**: `src/memory/state-machine.ts` + `test/memory/state-machine.test.ts` — the `memory`
  module per `dna.yaml`'s module map (P1.13, state machines are a Project Memory pillar concern);
  re-exported from `src/memory/index.ts` alongside the schema, matching the other pillars' barrel
  convention (`test/core/module-layout.test.ts`).
- **Deviation / pre-existing environment gap noted, not fixed**: `npx tsc --noEmit` reports
  `TS7016: Could not find a declaration file for module 'js-yaml'` in six files, including this task's
  own new `test/memory/state-machine.test.ts` — but the identical error already exists on `main` for
  task-004's own `test/memory/schema.test.ts`, `test/dna/schema.test.ts`, `test/workflow/schema.test.ts`,
  `test/directives/schema.test.ts`, and `src/validation/yaml.ts` (verified by running `tsc --noEmit`
  directly on `main`, unrelated to this task's worktree). Root cause: `@types/js-yaml` is listed in
  `package.json` `devDependencies` but is not actually present under the installed `node_modules`
  (shared/symlinked across worktrees) — a pre-existing package-installation gap, not something this
  task introduces or is in scope to fix. `npx jest` is unaffected (ts-jest transpiles per-file and this
  gap does not fail any test); `npx eslint` is clean.
- **Final verification**: `npx jest --coverage` — 19 suites / 158 tests, all passing; global coverage
  98.22% statements / 91.7% branches / 100% functions / 98.68% lines (`memory` module: 95.31%/93.87%/
  100%/95.31%; `state-machine.ts` itself: 92.85%/90.9%/100%/92.85%, the only uncovered lines being the
  task-010 fallback-error branch noted above and an unreachable TS-exhaustiveness `default` case).
  `npx eslint .` clean.
