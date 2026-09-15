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

---

## Execution Notes — second pass (review gate rejected, returned to `red`)

### Corrections to the first pass

**1. The blocking defect (the `rejection_reason`) — confirmed real, and it was mine.** The first pass's
`green` note above records the implementation as *"legal iff `status === DEPRECATED_STATE ||
machine.sequence.includes(status)`"*. That is wrong. `spec-001-memory-yaml-schema`'s "Semantic
validation (post-parse)" paragraph constrains only the `gates` **keys** and the `waiting` entries to be
`sequence` members; it is explicit that a `gates.<state>.reject` **target** "need **not** be a member of
`sequence`: it may revert into the chain (e.g. `pending: { reject: draft }`) or name an off-chain
decline state reached by no forward edge". `resolveTransitionTarget`'s `reject` arm already returns that
target verbatim — with its own comment saying so. So for any type declaring an off-chain reject target,
`memory reject` writes a `status` that `validateFrontmatterState` then declares invalid: the tool refuses
a document it wrote itself, and the document cannot be moved again. That is a REQ-SYS-04 failure for a
config shape the spec names by example.

It stayed green because none of the registered types in `docs/self/.wingfoil/memory.yaml` triggers it —
all three reject targets (`task`/`adr`/`tech-spec`/`decision-log`/`release-line` → `draft`, `bug`'s
`open` → `closed`, `bug`'s `in-review`/`resolved` → `in-progress`) happen to be `sequence` members. The
first pass tested only against the real config, so the whole branch was invisible.

**2. A false claim in the first pass's `design` notes — retracted.** Those notes state that rewriting
`resolveTransitionTarget`'s illegal-transition message is out of scope because *"no downstream task
depends on the literal old wording — `task-045-memory-submit`, the next consumer, is Wave 2 and not yet
started"*. **That is factually wrong and is withdrawn.** Two BDD features pin the exact string as an
acceptance contract, independently of any task's schedule:

- `docs/02_requirements/02_bdd/features/p5-interaction/P5.2.3-mcp-tools.feature` line 18 —
  `Then the tool returns error "illegal transition approved -> pending for type 'task'"` (MCP channel).
- `docs/02_requirements/02_bdd/features/p1-memory/P1.6-memory-submit.feature` line 21 —
  `And the command exits with code 1 and message "illegal transition approved -> pending for type 'task'"`
  (CLI channel: the string **and** the exit code).

Two channels pinning the same string is a deliberate cross-channel contract. The correct reasoning for
leaving the message alone was never "nobody depends on it" but "the divergence is a specs-vs-code
conflict no single task may settle unilaterally" — which is what `dl-032-illegal-transition-message-contract`
(`ready`) then did, ratifying option (c) and exit `1`, and assigning the change to `task-045-memory-submit`,
whose acceptance contract `P1.6` is.

### `red` (developer)

Two red-first additions to `test/memory/state-machine.test.ts`, no production code touched.

- A **synthetic fixture machine** with an off-chain reject target — `sequence: [draft, pending,
  approved]`, `gates: { pending: { reject: cancelled } }`, where `cancelled` appears in no `sequence`
  and no `waiting`. Parsed through the real `MemoryYaml` schema first, so the fixture is provably valid
  config under Pass 1 and not an object smuggled past the structural rules — the same throwaway-fixture
  idiom `task-010` uses for the `defaults.states` fallback and `task-005` for the gate+`waiting` dual
  case. Five assertions: the fixture is structurally valid; `resolveTransitionTarget(m, 'pending',
  'reject') === 'cancelled'`; that status validates; a `gates` round-trip (every reject target of every
  gate validates); and a not-over-permissive guard (an unrelated `shipped` is still rejected).
- The exit-code assertion flipped **2 → 1** (see below).

Observed red — **3 failed / 50 passed, 53 total**, verbatim:

```
● validateFrontmatterState — an off-chain `gates.<state>.reject` target is a legal state (spec-001)
  › the status the `reject` verb just wrote validates as a legal state for the type
  ValidationError: E_INVALID_STATE status (): invalid state 'cancelled' for type 'fixture-off-chain-reject'
    at Function.semantic (src/validation/errors.ts:79:12)
    at validateFrontmatterState (src/memory/state-machine.ts:268:25)

● … › round-trip: every reachable target of every declared `gates` entry is itself a legal frontmatter state
  ValidationError: E_INVALID_STATE status (): invalid state 'cancelled' for type 'fixture-off-chain-reject'

● … › exits `1` (EXIT_VALIDATION) …
  expect((err as ValidationError).exitCode).toBe(1);   // received 2
```

Commit `a014b7f`.

### `green` (developer)

Extracted a module-private `isDeclaredState(machine, status)` in `src/memory/state-machine.ts` and made
`validateFrontmatterState` delegate to it. A type's legal frontmatter state set is now the machine's
**full reachable set** — `sequence` ∪ every `gates.<state>.reject` target ∪ `deprecated` — instead of
`sequence` ∪ `deprecated`. `waiting` contributes nothing: its entries are already constrained to be
`sequence` members, so they are covered by the first arm. The `gates` traversal is `Object.keys(...).sort()`
(REQ-SYS-07 — the boolean result is order-independent, but the traversal stays deterministic under any
future change that reports *which* source matched). The extraction keeps the public function a single
guard + throw and gives the three-source rule one documented home.

The new arm is deliberately the *mirror* of `resolveTransitionTarget`'s `reject` case rather than an
independent re-derivation: the invariant being protected is "any state the transition engine can
return must validate here". A real-config test asserting exactly that invariant was added in `refactor`.

**Exit code — `E_INVALID_STATE` moved from `2` to `1`.** `spec-009-validation-strategy` §3 has been
rewritten (under `dl-032`) to key the exit code on *the nature of the failure, not the pass that detects
it*: `2` is reserved for parse and system-integrity failures ("the input could not be understood, or the
installation is inconsistent"); `1` covers "every other validation failure: any mapped `E_INVALID_*` …
**including business-rule failures detected in Pass 2**". An unrecognised frontmatter `status` is
understood input that a rule refused — a `1`. The first pass's `2` came only from reaching for
`ValidationError.semantic(...)`, which hard-codes `EXIT_INTEGRITY`; the throw now uses the
`ValidationError` constructor directly (default `EXIT_VALIDATION`). `ValidationError.semantic` itself is
**not** touched — its other six call sites (`loaders`, `id`, `query`) are genuine integrity checks that
correctly keep `2`, and `src/validation/` is `task-043`'s area this pass. No BDD scenario opposes the
change: `P4.11` sc.3 and `P4.13` sc.3 pin the message text only, never an exit code, and
`validateFrontmatterState` has no consumer outside its own test yet — blast radius zero.

Commit `73f1e81`.

### `refactor` (developer)

Test-side only, behaviour unchanged — closing the first pass's reviewer note that three loops iterated a
hard-coded list of 7 type names while `memory.yaml` registers 8 (`plan`, added by `dl-019`, was never
exercised).

- `REGISTERED_TYPE_NAMES = Object.keys(memoryYaml.types).sort()`, derived from the already-parsed config.
  Deterministic under REQ-SYS-07 regardless of YAML key order, and it cannot drift as types are added.
- A guard test on the derivation itself (length ≥ 8, contains `plan`) so the loops can never pass
  vacuously on an empty or truncated set.
- A **real-config invariant test**: for every registered type, every `gates.<state>.reject` target
  returned by `resolveTransitionTarget` must validate. Today every such target is a `sequence` member, so
  this asserts the invariant rather than the off-chain branch — but it is the regression guard that would
  have caught this pass's defect the moment the real config grew an off-chain reject target.

Commit `0987fe9`.

### `review` (developer side)

**Gate numbers — observed this pass, on this branch (post-`main`-merge `bc1d240`):**

- `npx jest --maxWorkers=2`: **692 / 692 passed**, **63 / 63 suites** GREEN.
- `npx jest --coverage --maxWorkers=2`: 692/692 green; global **Statements 98.07 % · Branches 87.83 % ·
  Functions 97.81 % · Lines 98.50 %** — all ≥ 80. Touched file `src/memory/state-machine.ts`:
  96.42 % stmts / **95.45 % branch** / 100 % funcs / 96.42 % lines; the only uncovered lines, 234–235,
  are the pre-existing `default`/`never` exhaustive-switch arm of `resolveTransitionTarget` — not this
  task's code (the same arm the first pass reported as lines 187–188; the numbering shifted when
  `main`'s `isArchivedStatus`/`ARCHIVED_STATUSES` block merged in above it). The first pass's known
  `program.integration.test.ts` wall-clock flake did **not** reproduce in either run.
- `npm run docs:api`: exit **0** (TSDoc present on every exported declaration; `isDeclaredState` is
  module-private but fully documented).
- `npx tsc -p tsconfig.build.json`: exit **0**.
- `npx eslint .`: exit **0** — now an ACTIVE hard-reject `refactor` check (`dev-loop.yaml` v1.2,
  `dl-034`), asserted by `test/lint/lint-clean.test.ts` inside the suite above.

**Scope deliberately held (not done here):**

- `dl-032`'s ratified option (c) — making `illegal transition <from> -> <to> for type '<type>'` the
  message of `E_INVALID_TRANSITION` with the richer diagnostic as detail, at exit `1`. `resolveTransitionTarget`
  is **unchanged**. `P1.6-memory-submit.feature` is `task-045-memory-submit`'s acceptance contract, and
  `dl-032` names that task as the owner. The two changes are not entangled: `E_INVALID_STATE` is a
  distinct code on a distinct function with no shared call path, so the fix above needed nothing from it.
- `ValidationError.semantic`'s own TSDoc still says Pass-2 semantic failures exit `2`, which the rewritten
  `spec-009` §3 no longer supports as a blanket rule. It is stale prose in `src/validation/` —
  `task-043`'s area this pass — and is left for whoever owns that file next. Flagged here rather than
  silently corrected across a task boundary.
- REQ-STATE-01's Fit Criterion still says "`transitions` graph", the encoding `spec-001` replaced.
  `dl-032` assigns that amendment ("not contentious") to its own Actions list, not to this task.
