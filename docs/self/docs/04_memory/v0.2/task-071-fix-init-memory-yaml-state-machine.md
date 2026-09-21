---
id: "task-071-fix-init-memory-yaml-state-machine"
type: task
title: "Fix bug-030: a freshly `wingfoil init`-ed project must be able to run every Memory transition verb"
status: in-progress
release: "v0.2"
priority: "High"
tags: ["v0.2", "memory", "init"]
ref: "REQ-STATE-08"
bug: ["bug-030-init-memory-yaml-has-no-state-machine"]
depends_on: []
tmpl_version: 260703
---

## Description

Fix **bug-030**: the `memory.yaml` that `wingfoil init` scaffolds (`src/storage/templates.ts`) declares
neither a per-type `states` block nor a `defaults` block, and `resolveStateMachine`
(`src/memory/state-machine.ts`) has no built-in machine to fall back on — so it throws for every type,
and every Memory transition verb refuses in every project a user creates with `wingfoil init`.

This is no longer latent. All four transition verbs are merged and registered on `main`: `memorySubmit`,
`memoryApprove`, `memoryReject` and `memoryDeprecate` all appear in the `memory` module's operations
table in `CORE_MODULES` (`src/core/index.ts`), so the headline v0.2 verb set is broken for every new
user, not merely prospective.

**Where the fix belongs is this task's design work, not a given.** bug-030 records two readings —
scaffold a machine in `templates.ts`, or give `resolveStateMachine` a built-in default when `defaults`
is absent — and notes they are not exclusive. The acceptance criteria below are therefore framed around
the *behaviour* (a fresh init can run every transition verb end to end), so any placement that delivers
it is acceptable and the choice has to be argued rather than assumed.

## Acceptance Criteria

1. **A freshly initialised project can run every Memory transition verb.** For each template
   `wingfoil init` supports (`Scrum`, `Kanban` — the set `scripts/e2e-smoke.cjs`'s `SMOKE_TEMPLATES`
   declares), in a throwaway git repository: `init`, then `memory add`, then `memory submit`,
   `memory approve`, `memory reject` and `memory deprecate` each complete against the scaffolded
   `memory.yaml` with no `resolveStateMachine` throw. Each verb's own argument requirements still apply
   (`--reason` on `approve`/`reject`, REQ-SEC-04); what must not happen is state-machine resolution
   failing before the verb's own logic runs.
2. **The resolver resolves a machine for every type the scaffold declares.** `resolveStateMachine`
   returns a `StateMachine` for each type present in the scaffolded file. bug-030 step 5 observed that
   set as `adr, bug, decision-log, release, release-line, task, tech-spec`; re-derive it from the file
   the fix produces rather than copying that list, and assert against what is actually there.
3. **Red-first, against the artefact `init` actually writes.** bug-030's Notes state that no test feeds
   the resolver the scaffolded file — `grep -rln 'resolveStateMachine\|resolveTransitionTarget' test |
   xargs grep -ln 'templates\|scaffold\|runInit'` → no output. Re-run that grep, record its result
   verbatim in the Execution Notes, and close the gap it names: the new test must go red on `main`'s
   scaffold and green on the fix. Genuine red-first (`dl-014`/T1), not characterization.
4. **The placement is justified against the specification, and the scaffold stops promising what it does
   not deliver.** Three sources, and they do not settle it between them — that is the design work:
   - **REQ-STATE-08** (`docs/02_requirements/03_sard/03_state-context.md`): "A Memory type that does not
     declare its own `states` uses the default machine `draft → pending → approved/rejected →
     deprecated`", fit criterion "A type defined without a `states` block accepts exactly the default
     transitions" — reads as a property of the *engine*, with no mention of a `defaults` block.
   - **`spec-001-memory-yaml-schema`** makes `defaults` optional in `memory.yaml`.
   - **BDD `p1-memory/P1.13-memory-element-schema.feature`** is ambiguous on exactly this point: its
     scenario is *titled* "A type with no explicit states uses the **defaults block**", but its `Given`
     says only `defines type "note" without a "states" block` and its `Then` names the default machine
     by value, not by reference to a declared block. Say which reading is taken and why.

   Either way the scaffold's own header comment — "One entry per element type: its path pattern, its
   scaffold template, and (per type) its state machine" (`src/storage/templates.ts`, the `memory.yaml`
   builder) — is made true or corrected. It must not be left asserting something the file does not
   contain.
5. **The failure mode is reclassified if it survives anywhere.** `resolveStateMachine` throws a plain
   `Error`, not a `CoreError`/`ValidationError` — its own TSDoc says so deliberately
   ("caller-programming-error / config-integrity condition, not a document-transition failure"). If any
   reachable path can still hit that throw after the fix (a hand-edited `memory.yaml` with a type and no
   machine, say), state what exit code and message an operator actually gets, and whether that matches
   `spec-008` §5/§6. Do not leave an uncaught throw as user-visible behaviour without saying so.
6. **Verified on a fresh project through the dl-023 e2e-smoke path** (`scripts/e2e-smoke.cjs` — the
   executable form of `.wingfoil/workflows/custom/e2e-smoke.yaml`, reused as `spec-015` §3 stage 3).
   **That script exercises no transition verb today**: its step list is `init`, `dna show`, `dna set`,
   `memory add`, `paths`, `directives list`, `workflow list`, and its header still says `memory submit`
   "does not exist yet (task-045) and is added here when it ships" — now stale, since `task-045` is
   merged and `memorySubmit` is registered. That omission is
   `bug-029-e2e-smoke-omits-memory-submit` (`open`, `low`, `release: ""` — **unscheduled**; a sibling of
   `bug-030`, not owned here). So this task must **state explicitly which route it took**: extend the
   smoke script itself (and say so, since that reaches into `bug-029`'s ground), or drive the verbs
   against an equivalent fresh-init project in its own test and report the smoke script as *not yet*
   covering them. Citing the existing green smoke as evidence for AC1 is not acceptable — it proves
   nothing about transitions.
7. **Gates green:** full Jest suite, coverage >80% and non-regressing, `tsc -p tsconfig.build.json`,
   `npm run docs:api`, `npm run lint` (`lint.clean`, `dl-034`).

## Implementation Notes

Source: `bug-030` (`triaged`, severity `high`, `feature: P1.13`), scheduled into `v0.2` out of band
under `dl-034` point 4's exception — see the scheduling commit for the argument.

- **Traceability:** REQ-STATE-08 (the rule this violates) → P1.13 (US-0A-04) →
  `p1-memory/P1.13-memory-element-schema.feature` → `spec-001-memory-yaml-schema` → this task.
- **The two candidate sites:** `src/storage/templates.ts` (the scaffold) and
  `src/memory/state-machine.ts` (`resolveStateMachine`, created by `task-005-per-type-state-machines`,
  `d65fa91`, and unchanged since). `memory add` is unaffected — it assigns `sequence[0]` directly and
  never transitions — so the fix must not regress it.
- **Why no gate caught it** (bug-030 Notes): `test/memory/state-machine.test.ts` exercises the
  `defaults.states` fallback with fixtures that *declare* `defaults`, and
  `test/memory/element-schema.test.ts` resolves against this repository's own dogfooded `memory.yaml`,
  which declares a machine for every type. Neither ever sees the scaffold. AC3 is that gap.
- **If the chosen fix scaffolds a machine**, it changes what every new project gets, and therefore what
  `spec-001`/`spec-011` describe. Check whether either needs a dated Revision note (`dl-047`:
  tech-specs carry no `version:` field) and scaffold a `tech-spec` or stop for the approver rather than
  amending an `approved` spec silently.
- `dl-045` back-reference: `bug: ["bug-030-init-memory-yaml-has-no-state-machine"]` is recorded here
  **before** the task starts, so `bug.sync_state` can drive the bug's state from this task.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### design — role: architect

#### read_related (dl-015, HARD gate)

`depends_on: []` — no predecessor task's Execution Notes to load. The elements the task instructions
name instead, all read in full before any edit:

- **`bug-030-init-memory-yaml-has-no-state-machine`** (`docs/self/docs/04_memory/bugs/`) — read in
  full. Its two candidate readings ("scaffold a machine" / "give the resolver a built-in default",
  "not exclusive") are the design question resolved below. Its reproduction is re-run first-hand in
  the review section; its `Notes` grep is re-run verbatim under AC3 below.
- **`REQ-STATE-08`** (`docs/02_requirements/03_sard/03_state-context.md`) — quoted verbatim below.
- **`spec-001-memory-yaml-schema`** (`approved`) — §"Top-level shape" (`defaults` optional),
  §"Sub-schema: StateMachine" (`sequence`/`gates`/`waiting`, the reserved implicit `deprecated`
  wildcard), §"Worked examples" (the literal `defaults` machine), §"Consequences" (the deliberate
  loss of the `rejected` status).
- **`task-005-per-type-state-machines`** Execution Notes (v0.1) — it wrote `resolveStateMachine`. Two
  things carried over: (a) its `??` resolution was written as *`types.<name>.states ?? defaults.states`
  and nothing else*, with the "neither declares a machine" arm deliberately left as a throw and left
  uncovered (handed to `task-010`); (b) `task-010-default-state-machine-fallback` then covered the
  fallback **with a fixture that declares `defaults`** — so no test has ever asked what happens when
  `defaults` is *absent*, which is exactly the fresh-`init` shape. bug-030 is the gap between those
  two boundaries, not a regression in either.
- **`bug-029-e2e-smoke-omits-memory-submit`** (`open`, `low`, unscheduled) — read to establish its
  boundary; explicitly **not** fixed here (see AC6 below).

#### verify_specs

Scope is covered by **`spec-001-memory-yaml-schema`** (`approved`) and **`spec-011-storage-layout`**
(`approved`); `REQ-STATE-08` is the requirement. **No new `tech-spec` is needed**, and no approved
spec is amended — the chosen fix (below) stays inside the top-level shape `spec-001` already
specifies (`defaults:` is a documented, optional key, and the block scaffolded is `spec-001`'s own
worked example verbatim). That is a deliberate constraint on the design, not a coincidence: the
alternative placement considered (scaffolding seven per-type machines) would have changed what
`spec-001`/`spec-011` describe and would have needed the approver, per this task's Implementation
Notes. Two spec-text staleness findings surfaced while checking; both are reported as proposed
elements rather than edited here (see "Findings for the orchestrator" at the end of these notes).

#### The design question: where does the fix belong?

The three sources genuinely do not settle it between them, so here is the reading taken and why.

**REQ-STATE-08, verbatim:** *"Description: A Memory type that does not declare its own `states` uses
the default machine `draft → pending → approved/rejected → deprecated`. Rationale: Reduce config
friction for simple types. Fit Criterion: A type defined without a `states` block accepts exactly the
default transitions and rejects any transition outside them."* It is written as a property of the
**engine**, over a property of the **type** ("does not declare its own `states`"). It never mentions
a `defaults` block, and its Rationale — *reduce config friction* — is only served if the friction
reduction requires no config at all. A rule that reads "a type with no `states` uses the default
machine, provided the file separately declares that machine" reduces no friction: it trades one
required block for another.

**`spec-001` makes `defaults` optional** (`defaults: # optional; applies to any type without its own
`states` block (REQ-STATE-08)`; Zod: `defaults: z.object({ states: StateMachine }).optional()`). Take
that together with REQ-STATE-08 and the conclusion is forced: a `memory.yaml` that omits `defaults`
**and** has a type without `states` is a legal file under `spec-001`, and REQ-STATE-08 says that type
still has a machine. Today it has none and `resolveStateMachine` throws — so the file `spec-001`
calls legal is, in fact, unusable. **The engine must own a built-in default machine.** That is the
primary fix, and it is spec-mandated rather than discretionary.

**The BDD ambiguity, resolved.** `p1-memory/P1.13-memory-element-schema.feature` scenario 2 is titled
*"A type with no explicit states uses the defaults block"*, but its `Given` is only
`defines type "note" without a "states" block` — it says nothing about a `defaults` block being
present — and its `Then` names the machine **by value**
(`uses the default machine draft -> pending -> approved/rejected -> deprecated`), not by reference to
a declared block. **Reading taken: the title is a description of the common case, not a
precondition.** The normative content of a scenario is its `Given`/`When`/`Then`, and those describe
exactly the engine-side rule. A declared `defaults.states` remains a legal *per-project override* of
the built-in — it is not the mechanism by which the default exists. Precedence, therefore:
`types.<name>.states` → `defaults.states` → built-in `DEFAULT_STATE_MACHINE`. The existing
`defaults`-declaring fixtures (`test/memory/element-schema.test.ts`, `test/core/memory-submit.test.ts`,
`memory-approve`, `memory-reject`) keep passing unchanged because the second arm is untouched.

**Which machine is the built-in?** Not REQ-STATE-08's literal five-value wording. `spec-001`
§Consequences is explicit that its migration is a *"DELIBERATE BEHAVIOR CHANGE — the default machine
loses its `rejected` state"*, that *"no document ever records `status: rejected` again"*, and that
*"REQ-STATE-08's wording (`draft → pending → approved/rejected → deprecated`) describes the old
behavior and must be reconciled"*. `deprecated` is likewise never a declared state — `spec-001` makes
it the reserved implicit wildcard reachable from any state, and the `StateMachine` schema's own
`.superRefine()` forbids declaring it. So the built-in is `spec-001`'s own worked `defaults` block,
verbatim:

```yaml
sequence: [ draft, pending, approved ]
gates:
  pending: { reject: draft }
```

which yields exactly REQ-STATE-08's fit criterion under the post-`spec-001` encoding: `submit`
draft→pending, `approve` pending→approved, `reject` pending→draft, `deprecate` →deprecated from
anywhere, and nothing else legal. (`REQ-STATE-08`'s own text is still the pre-`spec-001` wording —
that reconciliation is a proposed element below, not a silent edit here.)

**And the scaffold — both, not either.** The engine fix alone would leave `wingfoil init` writing a
file whose header comment says *"One entry per element type: its path pattern, its scaffold template,
and (per type) its state machine. There is NO global state machine — customize each type's states for
your process."* while emitting no machine of any kind — AC4's "must not be left asserting something
the file does not contain". Of the three ways to make it true:

1. **emit seven per-type machines** — rejected. The only per-type machines that exist are
   `spec-001`'s, derived from *WingFoil's own* dogfooded lifecycle (`task`:
   draft→pending→backlog→in-progress→in-review→approved→done, and so on). Shipping those as every new
   project's lifecycle is a product decision well beyond bug-030, and it would put the scaffold at
   odds with `spec-011`'s description of the file (which this task may not amend silently). Proposed
   as a follow-up element instead.
2. **correct the comment only** — rejected. It is honest but leaves the governing machine invisible:
   a user who wants to change their lifecycle has nothing in their own file to edit, and must first
   discover that a built-in exists.
3. **scaffold `defaults.states` + correct the comment — chosen.** Five lines, inside `spec-001`'s
   documented top-level shape, so no spec changes. It makes the default machine *visible and
   editable in the file the user owns*, and it keeps the scaffold's behaviour independent of the
   engine's built-in (a project that later hand-edits the block gets what it wrote). The comment is
   rewritten to describe the real resolution order and to point at the per-type `states:` override.

Both changes are kept genuinely independent, which is what makes the pair testable: the resolver test
uses a config with **no** `defaults`, the scaffold test asserts the emitted file **declares** one, and
neither passes on `main`.

#### Blast radius checked before writing any code

- **An existing test pins the defect.** `test/core/memory-submit.test.ts` →
  `describe('CORE_MODULES memory.memorySubmit — configuration without any state machine')`, whose
  fixture comment is *"The shape `wingfoil init` scaffolds today: types with no `states:` and no
  `defaults:` block"*, asserts `VALIDATION` / message contains `REQ-STATE-08` / exit 1. That is
  bug-030's symptom written down as an expectation by `task-045`. It is **rewritten**, not deleted:
  same fixture, now asserting the submit succeeds `draft → pending` on the built-in machine. A test
  that pins a defect does not outrank the requirement the defect violates.
  (`grep -rn "REQ-STATE-08" test src | grep -v state-machine.ts` was run to find every such pin; the
  full command and output are in the red section.)
- **`prepareMemoryTransition`'s `try/catch` around `resolveStateMachine` becomes unreachable**
  (`src/core/memory-transition.ts`): the only remaining throw is "type not registered", and the line
  immediately above already returns `NOT_FOUND` for an unregistered type. It is removed rather than
  left as dead code (code-quality directive), with the reasoning recorded in the TSDoc — this is also
  AC5's answer (see below).
- **`task-057`'s built-in directive templates / `task-054`'s `built-in` vs `custom` split** — both
  merged and untouched by this change: the edit is confined to `memoryYaml()` inside
  `src/storage/templates.ts` (a zero-argument, template-independent generator) and adds no file, so
  the scaffold file list, `builtinTemplateSources()` and the directive scaffolding are unaffected.
  Verified by the unchanged `templateScaffold` file-list assertions and by
  `test/storage/builtin-directives.test.ts` in the green/refactor runs.
- **`memory add` must not regress**: it never transitions — it reads `id_pattern`/`template` and
  writes `status: draft` from the type's template scaffold (`memoryAddFn`, `src/core/index.ts`), so it
  never calls `resolveStateMachine`. With the scaffolded `defaults` machine, `sequence[0]` is `draft`,
  so the state `memory add` writes is now also the machine's head instead of being unrelated to any
  machine.

#### T1 classification (dl-014 / testing directive)

| AC | Class | Why | Test |
|---|---|---|---|
| 1 — fresh init runs every transition verb | **red-first** | the whole point of bug-030: on `main` every verb refuses on a freshly-`init`-ed project | `test/cli/fresh-init-transitions.test.ts` (real `dist/cli.js`, real `init`, both templates) |
| 2 — resolver resolves a machine for every scaffolded type | **red-first** | `resolveStateMachine` throws for every type of the scaffolded file on `main` | `test/storage/templates.test.ts` → "scaffolded memory.yaml resolves a state machine for every declared type (bug-030)" |
| 3 — red-first against the artefact `init` writes | **red-first** (it *is* the red) | the AC3 grep returns nothing: no test feeds the resolver the scaffold | the two suites above; grep + failing runs recorded in the red section |
| 4 — placement justified, scaffold comment made true | **red-first** for the machine-presence half (`main` emits none), documentation for the argument | the scaffold test asserts a declared `defaults.states`; the argument is this design section | `test/storage/templates.test.ts` → "the scaffolded memory.yaml declares its default machine (bug-030)" |
| 5 — failure mode reclassified if it survives | **characterization** | it does not survive on any reachable path; what is pinned is the behaviour that *replaces* it (an unregistered type is `NOT_FOUND`, exit 1) — that behaviour already exists (`memory-transition.ts`) and passes on first run | `test/core/memory-submit.test.ts` → "an unknown memory type is NOT_FOUND" (pre-existing, re-run) + the rewritten no-machine describe |
| 6 — verified on a fresh project through the dl-023 path | **characterization** for the smoke script (unchanged, must stay green), **red-first** for the transition drive | route taken: own test + first-hand CLI transcript; `scripts/e2e-smoke.cjs` untouched (bug-029's ground) | `test/cli/fresh-init-transitions.test.ts` + `node scripts/e2e-smoke.cjs` run verbatim |
| 7 — gates green | **characterization** | gate runs, not behaviour | the six gate commands, in the review section |

#### AC5 — what an operator actually gets, after the fix

`resolveStateMachine` keeps exactly one plain-`Error` throw: `memory.yaml has no type "<t>"
registered`. **No reachable path can hit it from a transition verb**: `prepareMemoryTransition`
returns `NOT_FOUND` (`unknown memory type '<t>' (not defined in memory.yaml)`, exit 1) for an
unregistered type *before* calling the resolver, and the REQ-STATE-08 arm that used to throw now
returns the built-in machine instead. So there is no longer any config — hand-edited or
scaffolded — that produces an uncaught throw here: a type present with no machine resolves, and a
type absent is a `NOT_FOUND` `CoreResult` (exit 1, `spec-008` §5/§6: a domain failure, not an
integrity one). The remaining throw is a caller-programming-error guard for a direct library call
with an unregistered type name — no CLI or MCP path constructs one — and the TSDoc says so. This is
recorded rather than left implicit because AC5 forbids leaving an uncaught throw as user-visible
behaviour without saying so; the answer here is that it is not user-visible at all.

#### AC6 — route taken, and the bug-029 boundary

`scripts/e2e-smoke.cjs` is **not modified**: adding transition verbs to it is
`bug-029-e2e-smoke-omits-memory-submit` (`open`, `low`, unscheduled), a sibling of bug-030 that this
task does not own. The smoke is run **unchanged** as a regression check on the scaffold edit (a
malformed `memory.yaml` would fail its `memory add` step), and it is explicitly **not** offered as
evidence for AC1 — it exercises no transition verb. AC1's evidence is instead (a)
`test/cli/fresh-init-transitions.test.ts`, which runs the real compiled `dist/cli.js` through
`init` → `memory add` → `submit` → `approve` → `reject` → `submit` → `deprecate` in a throwaway git
repository for each of `SMOKE_TEMPLATES`, asserting the frontmatter state each verb wrote and that
each produced exactly one commit; and (b) the first-hand transcript of the same sequence pasted in
the review section. That test is, deliberately, the thing bug-029 would later automate inside the
smoke script.

### red — role: developer

#### AC3's grep, re-run verbatim on this branch (from the worktree root, before any edit)

```
$ grep -rln 'resolveStateMachine\|resolveTransitionTarget' test | xargs grep -ln 'templates\|scaffold\|runInit'
$ echo "exit=$?"
exit=123
```

No output (xargs exits `123` because the inner `grep` matched nothing in any candidate file). The two
files that mention the resolver at all are:

```
$ grep -rln 'resolveStateMachine\|resolveTransitionTarget' test
test/memory/element-schema.test.ts
test/memory/state-machine.test.ts
```

— confirming bug-030's Notes exactly: the resolver is only ever fed hand-built fixtures and this
repository's own dogfooded `memory.yaml`, never the file `wingfoil init` writes. That is the gap this
phase closes.

#### The pins of the defect, found before writing anything

```
$ grep -rn "REQ-STATE-08" test src | grep -v "src/memory/state-machine.ts" | grep -v "^test/memory/state-machine.test.ts"
test/core/memory-approve.test.ts:180:   'a type falling back to `defaults.states` approves pending → approved (REQ-STATE-08)'
test/core/memory-deprecate.test.ts:12,49,306:  ... falls back to `defaults.states` (REQ-STATE-08)
test/core/memory-reject.test.ts:216:    'a type without its own machine falls back to `defaults.states` (REQ-STATE-08): pending -> draft'
test/core/memory-submit.test.ts:252:    'a type without its own machine falls back to `defaults.states` (REQ-STATE-08)'
test/core/memory-submit.test.ts:318:    'is a VALIDATION error (exit 1) naming REQ-STATE-08, never an escaped throw'
test/memory/element-schema.test.ts:63:  'P1.13 scenario 2 — a type with no `states` block uses the `defaults` machine (REQ-STATE-08)'
src/memory/schema.ts:112,147 · src/core/memory-transition.ts:54,81
```

All but one of these exercise the **`defaults`-declared** fallback, which this change does not touch —
they pass unchanged, which is the point of keeping the three-arm precedence. Exactly **two**
expectations pin the defect, and both are inverted in this phase rather than deleted:

1. `test/core/memory-submit.test.ts:318` — "is a VALIDATION error (exit 1) naming REQ-STATE-08" over a
   fixture its own comment calls *"the shape `wingfoil init` scaffolds today"*.
2. `test/memory/state-machine.test.ts` — "throws when neither the type nor `defaults` declares a
   machine", written by `task-010` as coverage for a branch `task-005` had left uncovered.

`src/memory/schema.ts`'s `superRefine` (line 147, `if (!machine) continue`) needs **no** change: it
only checks that a *declared* machine's `gates`/`waiting` keys are members of its own `sequence`, and a
type with no declared machine has nothing to check (the built-in is valid by construction).

#### Failing tests written (red-first ACs 1/2/3/4, plus AC6's transition drive)

| Suite | What it pins |
|---|---|
| `test/memory/state-machine.test.ts` — new describe *"REQ-STATE-08 — no `states` AND no `defaults` block resolves the built-in default machine (bug-030)"* | the engine half: a file declaring no machine anywhere is Pass-1 valid, resolves `DEFAULT_STATE_MACHINE`, accepts **exactly** the default transitions and rejects everything else (REQ-STATE-08's fit criterion, both halves), agrees with `validateFrontmatterState`, is frozen, and still throws for an *unregistered* type (AC5) |
| same file — the `task-010` block's third case, inverted | `defaults.states`, when declared, still wins over the built-in — asserted by **object identity**, since the two are value-equal |
| `test/storage/templates.test.ts` — new describe *"scaffolded memory.yaml resolves a state machine for every declared type (bug-030)"* | the scaffold half, per template: the emitted bytes parse through the real `MemoryYaml` schema, **declare** a `defaults.states`, resolve a machine for every type present in the file (type list derived from the parsed file, not copied from bug-030's observed list — AC2), and run all four verbs from the chain head |
| `test/cli/fresh-init-transitions.test.ts` — **new file** | AC1 end-to-end: real `dist/cli.js`, real `init`, both registered templates, `memory add` → `submit` → `approve` → `reject` → `submit` → `deprecate`, asserting the state each verb wrote **and** exactly one commit per verb, plus a clean working tree |
| `test/core/memory-submit.test.ts` — the no-machine describe, inverted | the core-op half: the same fixture that used to have to fail now submits `draft → pending`, while an illegal verb on the built-in machine is still refused (`INVALID_TRANSITION`, exit 1, no commit) — the fallback adds a machine, not permissiveness |

#### The failing run (before any `src/` change)

```
$ npx jest test/memory/state-machine.test.ts test/storage/templates.test.ts test/cli/fresh-init-transitions.test.ts
Test Suites: 3 failed, 3 total
Tests:       21 failed, 107 passed, 128 total

$ npx jest test/core/memory-submit.test.ts
Test Suites: 1 failed, 1 total
Tests:       2 failed, 17 passed, 19 total
```

The CLI suite reproduces bug-030's Steps to Reproduce first-hand, through the shipped binary — the
defect's exact signature, from `node dist/cli.js` in a freshly-`init`-ed project:

```
  ● … template Kanban › `memory deprecate` completes from any state: -> deprecated, in exactly one commit
    - Expected: [0, ""]
    + Received: [1, "error: type \"task\" declares no `states` block and `defaults.states` is not set (REQ-STATE-08)\n"]
```

All 23 failures are genuine (no `it.todo`, no fabricated red, no dead code): every one is either the
resolver refusing before the verb's own logic runs, or the scaffold emitting no machine at all.
