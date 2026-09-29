---
id: "task-010-default-state-machine-fallback"
type: task
title: "Infrastructure: REQ-STATE-08 — Default state-machine fallback"
status: done
release: "v0.1"
priority: "Blocker"
tags: ["v0.1", "architecture"]
ref: "REQ-STATE-08"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

REQ-STATE-08 requires that a Memory `type` declared **without its own `states` block** in
`memory.yaml` falls back to a shared `defaults.states` machine, reducing config friction for simple
types that don't need a custom lifecycle. This task implements that fallback resolution in the
state-machine validator: when a `types.<name>` entry has no `states:` key, the validator must resolve
`defaults.states` for that type instead of erroring or silently allowing any transition.

Per `spec-001-memory-yaml-schema` (`docs/self/.wingfoil/memory.yaml` lines 61-65), the current default
machine is encoded as:

```yaml
defaults:
  states:
    sequence: [ draft, pending, approved ]
    gates:
      pending: { reject: draft }
```

i.e. `draft → pending` (via `memory.submit`), then `pending`'s forward edge to `approved` is an
approval gate (`memory.approve`) whose `reject` target is `draft` directly — there is no separate
`rejected` status recorded on disk (the rejection reason lives in the git commit body per P1.7). Note
that REQ-STATE-08's own literal wording, "`draft → pending → approved/rejected → deprecated`", describes
the **old** `transitions` dict-of-arrays encoding; spec-001 explicitly flags this as needing
reconciliation — the requirement's *intent* (a usable default for types with no custom lifecycle)
still holds, but its literal transition list is superseded by the `sequence`/`gates` shape above.
Today all seven declared types (`release-line, release, task, adr, decision-log, tech-spec, bug`)
define their own `states:` block, so the fallback path currently has **no live consumer** — it must be
exercised by a dedicated fixture/test type in the validator's test suite, not by any real Memory type.

## Acceptance Criteria

Per the SARD fit criterion (`docs/02_requirements/03_sard/03_state-context.md`, REQ-STATE-08):

> A type defined without a `states` block accepts exactly the default transitions and rejects any
> transition outside them.

Testable form:
- A fixture type added to `memory.yaml` with no `states:` key resolves to `defaults.states`
  (`sequence: [draft, pending, approved]`, `gates: { pending: { reject: draft } }`) and:
  - `memory.add` sets `status: draft` (chain head).
  - `memory.submit` moves `draft → pending`.
  - `memory.approve` moves `pending → approved`; `memory.reject` moves `pending → draft` (no
    `rejected` status is ever written).
  - Any other transition (e.g. `draft → approved` directly) is rejected and leaves `status` unchanged.
- Removing the type's `states:` block from `memory.yaml` (if it had one) and reloading falls back to
  `defaults.states` with no code change (ties to REQ-SYS-04).

## Implementation Notes

- `spec-001-memory-yaml-schema` is the authoritative source both for the `defaults.states` shape
  (`z.object({ states: StateMachine }).optional()` at the `MemoryYaml` top level) and for the
  reconciliation note above; it also documents that `types.<name>.states` is `.optional()` — "absent ⇒
  `defaults.states` applies (REQ-STATE-08)".
- `spec-009-validation-strategy`'s two-pass pipeline is where the fallback resolution belongs: Pass 1
  (structural) validates whichever `StateMachine` block ends up in play (declared or default); Pass 2
  (semantic) enforces the resolved machine's `sequence`/`gates`/`waiting` against the requested
  transition.
- Since no current type in `docs/self/.wingfoil/memory.yaml` actually omits `states:`, verification for
  this task should add a throwaway fixture type in the test suite (not a change to the real
  `memory.yaml`) to exercise the fallback path end-to-end.
- Related feature work in this release that this infra task unblocks (`related_stories` in
  `docs/03_backlog/04_backlog/by-release/v0.1.json`, backlog `TASK-008`): `TASK-022` "Implement Memory
  Element Schema (memory.yaml)" (memory `task-024-implement-memory-element-schema.md`).

## Execution Notes

- **design:** `agent.verify_specs` against `ref: REQ-STATE-08` and the two specs the task's
  Implementation Notes cite (`spec-001-memory-yaml-schema`, `spec-009-validation-strategy`) — both
  already `approved`, and both already document the exact shape this task exercises (`defaults.states`,
  `types.<name>.states` as `.optional()`, the two-pass pipeline). No gap found; passed straight
  through with no new tech-spec, matching this task's own Implementation Notes' expectation.

- **Key finding (read this before the red/green split below):** task-005-per-type-state-machines
  already shipped the *production* fallback-resolution logic in full —
  `resolveStateMachine` (`src/memory/state-machine.ts` line 72) is exactly
  `typeEntry.states ?? memoryYaml.defaults?.states`, with a throw when neither is set. Its own module
  doc comment said in so many words that the "type declares no `states` block, falls back to
  `defaults`" fixture/coverage was deliberately deferred to this task. Confirmed via `git blame`/reading
  task-005's tests (`test/memory/state-machine.test.ts` pre-existing content) that every one of the 7
  real registered types (`release-line, release, task, adr, decision-log, tech-spec, bug`) declares its
  own `states:` block, so the fallback path had **zero live coverage**. Measured this precisely before
  writing anything: `npx jest --coverage --collectCoverageFrom=src/memory/state-machine.ts
  test/memory/state-machine.test.ts` showed 92.85%/90.9% branch, with the Istanbul branch map (dumped
  via `coverage-final.json`) identifying exactly two uncovered branches: line 72's `??` right-hand side
  (the fallback itself, 0 hits) and line 73's `if (!resolved)` throw (0 hits). This is a genuine,
  precisely-located coverage gap — not a production-logic bug.

- **red:** per the task's TDD nuance (production code already correct, only the fixture/coverage
  missing), wrote the failing-because-absent fixture test suite first: a throwaway `MemoryYaml` fixture
  document (parsed through the real Zod schema, never written to the real
  `docs/self/.wingfoil/memory.yaml`) whose one type, `fixture-no-states`, declares no `states:` key at
  all. Added one `describe` block to `test/memory/state-machine.test.ts` covering every AC bullet:
  Pass-1 structural validity of a states-less type entry; `resolveStateMachine` resolving to
  `defaults.states` (by-reference `toBe`); the `add→draft / submit draft→pending / approve
  pending→approved / reject pending→draft` chain with an explicit assertion that `'rejected'` never
  appears in the default `sequence`; an illegal `draft→approved` direct transition throwing
  `ValidationError` with the document's `status` field observably unchanged afterward (mirrors the
  existing REQ-STATE-01 pattern already in this file); and a same-file "declare `states:`, then remove
  it and reload" pair proving the config→behavior link needs no code change (REQ-SYS-04). Also added a
  fixture-only test for the second uncovered branch (neither type nor `defaults` declares a machine →
  throws). **Honest TDD note:** ran these tests immediately after writing them and all 9 passed on the
  first run — task-005's `?? defaults.states` resolution and the surrounding `resolveTransitionTarget`
  legality engine were already fully correct, so there was no genuine "red" state to observe beyond the
  literal absence of the test file before this commit. Did not fabricate a failure or add any dead code
  to force one; this commit's value is exclusively the new fixture + the coverage of the two
  previously-unexercised branches, not a bug fix.

- **green:** no-op — no production-code change was needed. `resolveStateMachine` already implemented
  REQ-STATE-08 correctly; folded a documentation-only edit (removing the now-stale "intentionally NOT
  built here" sentence from `resolveStateMachine`'s own module doc comment, since this task now builds
  it) into the red commit rather than opening a separate no-content `feat` commit.

- **refactor:** no-op — nothing to refactor; no `refactor` commit created. Re-measured coverage after
  the new tests: `src/memory/state-machine.ts` rose from 92.85%/90.9% to 95.23%/96.96% (stmts/branch);
  the only remaining uncovered lines (166-167, the switch's exhaustive `default:` case) are an
  unreachable TypeScript-exhaustiveness guard given `TransitionOp`'s closed union — not reachable via
  any valid call, and out of this task's scope. Project-wide: 98.85% statements / 91.69% branches / 100%
  functions / 99.3% lines, comfortably above the >80% Jest threshold.

- **review:** no BDD runner is wired into this repo yet (same finding as task-006/008/009 — the
  `docs/02_requirements/02_bdd/features/**/*.feature` files are contracts, not yet executable specs).
  `npx jest` stands in: **264 tests passed, 0 failed** (was 255 before this task; +9 new fixture
  tests), `npx tsc --noEmit` exit 0.

- **Honest summary:** this was a "deferred coverage" task, not a bug fix. task-005's
  `resolveStateMachine`/`resolveTransitionTarget` production logic already satisfied REQ-STATE-08 in
  full; task-010's entire contribution is the dedicated fixture type + the 9 new tests that exercise the
  fallback path end-to-end (Pass 1 parse → Pass 2 transition legality) and close the two branches
  task-005 explicitly left open. No spec gaps, no deviations, no production code touched beyond one
  stale doc-comment correction.
