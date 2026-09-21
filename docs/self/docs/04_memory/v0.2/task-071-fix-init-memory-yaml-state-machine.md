---
id: "task-071-fix-init-memory-yaml-state-machine"
type: task
title: "Fix bug-030: a freshly `wingfoil init`-ed project must be able to run every Memory transition verb"
status: in-review
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

### green — role: developer

Three source files, in the order the design section argues them.

1. **`src/memory/state-machine.ts` — the engine half (the spec-mandated fix).** New exported
   `DEFAULT_STATE_MACHINE`, and `resolveStateMachine` becomes a three-arm resolution:
   `typeEntry.states ?? memoryYaml.defaults?.states ?? DEFAULT_STATE_MACHINE`. The
   "neither declares a machine" throw is **gone with the condition it reported**. The constant is built
   by parsing `{ sequence: [draft, pending, approved], gates: { pending: { reject: draft } } }` through
   the real `StateMachine` Zod schema — so the one machine no config file validates is still held to
   spec-001's structural rules (`gates` keys ⊆ `sequence`, `"deprecated"` never declared) — and then
   frozen through (object, `sequence`, `gates`, and the gate entry), since every falling-back type
   shares the same object.
2. **`src/storage/templates.ts` — the scaffold half.** `memoryYaml()` now emits a `defaults.states`
   block (spec-001's worked example verbatim) above `types:`, and the header comment no longer claims a
   per-type machine that is not there: it says every type shares the `defaults` machine and that a
   `states:` block on a type overrides it. A TSDoc on the generator records why the block is written
   out even though the engine would now cover its absence.
3. **`src/core/memory-transition.ts` — dead code removed.** The `try/catch` that turned the REQ-STATE-08
   throw into a `VALIDATION` refusal is unreachable once the throw is gone (the line above it already
   returns `NOT_FOUND` for the only other throw condition, an unregistered type), so the call is direct
   and the removal is explained in place; the function's own refusal list drops that bullet.

`src/memory/index.ts` re-exports `DEFAULT_STATE_MACHINE` alongside the rest of the state-machine API
(the barrel convention `test/core/module-layout.test.ts` pins).

**One thing the red phase surfaced that the design had not predicted**, recorded because it changes what
AC1's evidence means: on a fresh project, `memory approve`/`reject` also refuse with
`user not authorized to approve type 'task'`. That is REQ-SEC-03 approval authority
(`requireApprovalAuthority`, adr-006): `wingfoil init` scaffolds `team.members: []`, so no git identity
holds the `approver` role yet. It is the verb's **own** rule, applied after the machine resolved — the
boundary AC1 itself draws — not a second instance of bug-030. The end-to-end test and the manual
transcript therefore first register the git identity as a `team.members[]` entry with `roles:
[approver]`, exactly as a real user configures their project, and say so in place. It is reported as a
proposed element (below) rather than changed here: whether `init` should seed the initialising user as
an approver is a product decision this task does not own.

`npx jest test/memory test/storage test/core/memory-submit.test.ts test/cli/fresh-init-transitions.test.ts`
→ **26 suites / 450 tests green** at that point in the branch's history (before the four `main` merges below, which raise the totals in the Gates table); the four previously-red suites all pass, and
the two inverted expectations now assert the fixed behaviour.

### refactor — role: developer

No structural refactor was needed (the change is ~15 lines of logic across three files); this phase was
spent on the documentation the `docs.api.*` gate and the `documentation` directive require, and on the
gates.

- TSDoc written for the new public `DEFAULT_STATE_MACHINE` (why the engine owns the default, why this
  value and not REQ-STATE-08's literal wording, why it is frozen), for the rewritten
  `resolveStateMachine` (the three arms, and what the one remaining throw is and is not reachable
  from), for the module header's "Type resolution (REQ-STATE-08)" paragraph (now naming all three arms
  and which task covered which), and for `memoryYaml()` in `src/storage/templates.ts`.
- No `docs/` prose outside this task file was edited: the two spec-staleness findings this task ran
  into are reported as proposed elements instead (the `doc-versioning` directive's version-bump rule is
  therefore not triggered by this task — no versioned document was edited).

#### Gates

Every number below was produced **after** the final `git merge main` (`a7d783a`) and against a **real
`npm ci`** — the `node_modules` symlink this worktree used while `bug-043` was open was deleted and
`npm ci --prefer-offline --no-audit --no-fund` run in its place (`added 500 packages`), which `task-073`'s
lockfile fix (merged from `main`) makes possible. So these gates exercise the lockfile a fresh clone of
this branch would install from, and `node -v` is `v22.21.0`, inside `task-074`'s new
`engines.node >= 22.12.0` floor (`adr-010`, also merged from `main`).

| Command | Result |
|---|---|
| `npx jest` | **101 suites / 1627 tests, all green** |
| `npx jest --coverage` | **98.54% stmts · 92.29% branch · 98.76% funcs · 99.15% lines** (global) |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0, **0 errors** |
| `npx tsc --noEmit -p tsconfig.json` | 1 error, and it is **only** the pre-existing `bug-026` one: `test/core/directive-create.test.ts(159,19): error TS2339` |
| `npm run lint` | exit 0, **0 errors** (`lint.clean`, dl-034) |
| `npm run docs:api` | exit 0 (`docs.api.*`) |
| `node scripts/e2e-smoke.cjs -- node "$PWD/dist/cli.js"` | **17/17 checks ok**, both templates, working tree clean — script **unmodified** (bug-029's ground) |

**Coverage non-regression — the measured mechanism.** Baseline: a detached worktree at `main`
(`a7d783a`) with `npx jest --coverage --coverageReporters=json-summary`; this branch: the same command.
Both `coverage/coverage-summary.json` files were then compared field by field rather than by eye:

```
$ node -e 'const t=require("./coverage/coverage-summary.json").total;
  for (const k of ["statements","branches","functions","lines"])
    console.log(k, "total="+t[k].total, "covered="+t[k].covered,
                "uncovered="+(t[k].total-t[k].covered), "pct="+t[k].pct)'

main  a7d783a : branches total=1195 covered=1103 uncovered=92 pct=92.3
this branch   : branches total=1194 covered=1102 uncovered=92 pct=92.29
                statements 2268→2270 (covered 2235→2237), functions and lines unchanged
main  a7d783a : 100 suites / 1591 tests      this branch: 101 suites / 1627 tests (+36)
```

**The denominator did not grow — it shrank by one.** An earlier draft of this note said the −0.01pp was
"the denominator growing (the new suites add branch-free assertions)"; that was wrong twice over, and
`task-071` was rejected for it: test files are not instrumented at all (`collectCoverageFrom` is `src/`
only), so no test can move either side of the ratio. The measured cause is a single **source** branch
that this change deletes. Per-file comparison of the two summaries shows exactly one file moving —
`src/memory/state-machine.ts`, branches `49 → 48` total and `46 → 45` covered, every other file
byte-identical in branch counts (`src/core/memory-transition.ts` included: removing a `try`/`catch`
changes no branch count, because Istanbul does not instrument `catch` as a branch). The branch maps say
which branches, counted inside `resolveStateMachine`:

```
main a7d783a  line 141 if          [1,202]        # if (!typeEntry) → throw
              line 144 binary-expr [202,34]       # typeEntry.states ?? defaults?.states   (2 arms)
              line 145 if          [2,200]        # if (!resolved)  → REQ-STATE-08 throw
                                                  #   6 branches in the function, all covered

this branch   line 205 if          [2,299]        # if (!typeEntry) → throw
              line 208 binary-expr [299,131,14]   # … ?? defaults?.states ?? DEFAULT_STATE_MACHINE (3 arms)
                                                  #   5 branches in the function, all covered
```

−2 (the deleted `if (!resolved)` guard, **both** of whose arms were covered — its `true` arm by the
task-010 test this task inverted) +1 (the third `??` arm, covered) = **−1 total and −1 covered**, which
is precisely 1195→1194 and 1103→1102, i.e. 92.30% → 92.29%. **Uncovered branches are 92 on both sides:
nothing that was covered on `main` is uncovered here**, and statements/functions/lines are unchanged —
that conclusion was right in the earlier draft and is restated here on measured grounds. The baseline
worktree was removed and `git worktree prune` run afterwards. Per-file, for the three files touched:
`state-machine.ts` 96.1/93.75/100/97.29 (uncovered: 298-299, the TS-exhaustiveness `default` case —
pre-existing and unreachable), `templates.ts` 100/94.44/100/100 (uncovered branch: the `sort`
comparator's equal-path arm — pre-existing), `memory-transition.ts` 96.96/94.11/100/100 (uncovered:
line 92's non-`ValidationError` rethrow — pre-existing).

### review — role: reviewer

#### review-ready summary

**What changed, and why it is two changes and not one.** `resolveStateMachine` gained a third
resolution arm — the engine's own `DEFAULT_STATE_MACHINE` — because REQ-STATE-08 states its rule over
the *type* ("a Memory type that does not declare its own `states` uses the default machine", Rationale
"reduce config friction") while `spec-001` makes the `defaults` block *optional*: the two only cohere
if the default exists without being declared, and until now a file that declared nothing threw. And
`wingfoil init` now scaffolds that machine explicitly as `defaults.states`, with its header comment
corrected, because the engine fix alone would have left the scaffold promising "(per type) its state
machine" over a file containing none, and would have left a new project's lifecycle invisible in the
only file the user owns. The alternative of scaffolding seven per-type machines was rejected in the
design section: those machines are WingFoil's own dogfooded lifecycles, shipping them as every new
project's process is a product decision beyond bug-030, and it would have contradicted `spec-011`'s
description of the file — which this task may not amend silently.

**Evidence for the headline claim (AC1), first-hand.** Below is the real thing, not a test harness: a
throwaway git repository, `node dist/cli.js init`, then every transition verb. Both templates were run;
the Scrum transcript is shown in full and Kanban was byte-identical in every asserted respect (same
states, same `+1` commit per verb, same subjects, clean tree). Commands and output verbatim:

```
$ node dist/cli.js init --template Scrum
  … 27 scaffolded paths …                                             exit=0
$ grep -n -A6 '^defaults:' .wingfoil/memory.yaml
11:defaults:
12-  states:
13-    sequence: [ draft, pending, approved ]
14-    gates:
15-      pending: { reject: draft }
16-
17-types:
   # (then: register the git identity as a team.members[] entry with roles: [approver]
   #  and commit it — REQ-SEC-03 approval authority, see the green section)
$ node dist/cli.js memory add --type task --title 'Fresh init task' --format json
{"id":"task-001-fresh-init-task","path":"docs/memory/task/task-001-fresh-init-task.md"}
   -> status: draft                                                    commits: 3

$ node dist/cli.js memory submit task-001-fresh-init-task              exit=0
   -> status: pending     commits: +1   subject: wf(task): submit task-001-fresh-init-task
$ node dist/cli.js memory reject --reason needs-work task-001-…        exit=0
   -> status: draft       commits: +1   subject: wf(task): reject task-001-fresh-init-task [pending → draft]
$ node dist/cli.js memory submit task-001-fresh-init-task              exit=0
   -> status: pending     commits: +1   subject: wf(task): submit task-001-fresh-init-task
$ node dist/cli.js memory approve --reason looks-good task-001-…       exit=0
   -> status: approved    commits: +1   subject: wf(task): approve task-001-fresh-init-task [pending → approved]
$ node dist/cli.js memory deprecate --reason end-of-life task-001-…    exit=0
   -> status: deprecated  commits: +1   subject: wf(task): deprecate task-001-fresh-init-task [approved → deprecated]

$ git status --porcelain (expect empty): []
$ git log --oneline | tail -8
afcd4d1 wf(task): deprecate task-001-fresh-init-task [approved → deprecated]
4ee1884 wf(task): approve task-001-fresh-init-task [pending → approved]
0a98060 wf(task): submit task-001-fresh-init-task
9b3788e wf(task): reject task-001-fresh-init-task [pending → draft]
03b08a6 wf(task): submit task-001-fresh-init-task
ba1f8a6 wf(task): add task-001-fresh-init-task
9cc20eb configure approver
de3d6c0 chore(wingfoil): initialize .wingfoil/ with the Scrum template (P5.1.1)
```

Every verb: exit 0, the expected state on disk, **exactly one commit**. The same sequence on `main`
stops at the first verb with `error: type "task" declares no 'states' block and 'defaults.states' is
not set (REQ-STATE-08)` — captured in the red section from the CLI test's own failure output.

The order is `submit → reject → submit → approve → deprecate`, not the `submit → approve → reject …`
the task text suggests, because the scaffolded machine admits no other: its single gate is `pending`,
and `approved` is the terminal `sequence` entry with no edge back. `reject` from `approved` is
exercised too, as a **refusal**, to show the engine (not resolution) is what answers:
`illegal transition approved -> draft for type 'task'`, exit 1, state unchanged.

#### AC-by-AC

| AC | Status | Evidence |
|---|---|---|
| 1 fresh init runs every verb | met | `test/cli/fresh-init-transitions.test.ts` (18 tests, both templates, real `dist/cli.js`) + the transcript above |
| 2 resolver resolves for every scaffolded type | met | `test/storage/templates.test.ts` → "resolveStateMachine returns a machine for EVERY type the scaffold declares"; the type list is **derived from the parsed scaffold**, not copied from bug-030 step 5 |
| 3 red-first against the artefact `init` writes | met | AC3's grep re-run verbatim (no output) and recorded in the red section; the new suites fail on `main`'s scaffold (21 failures) and pass on the fix |
| 4 placement justified; scaffold stops over-promising | met | the design section takes and defends the engine-side reading of REQ-STATE-08 / the BDD ambiguity; the scaffold now *contains* a machine and its header comment describes what it contains |
| 5 failure mode reclassified | met | the REQ-STATE-08 throw no longer exists; the one remaining plain-`Error` (unregistered type) is unreachable from CLI/MCP — `prepareMemoryTransition` returns `NOT_FOUND` (exit 1) first — and the TSDoc says so. No uncaught throw is user-visible; nothing to reclassify against `spec-008` §5/§6 |
| 6 verified on a fresh project, dl-023 path | met | route stated explicitly: own test + transcript; `scripts/e2e-smoke.cjs` **unmodified** (17/17 ok) and **not** used as AC1 evidence — bug-029 remains open and unowned by this task |
| 7 gates green | met | the gate table above |

#### BDD acceptance

`p1-memory/P1.13-memory-element-schema.feature` scenario 2 ("A type with no explicit states uses the
defaults block") is this task's acceptance scenario, and it is now covered on **both** readings of its
ambiguity: with a declared `defaults` block by `test/memory/element-schema.test.ts` → "P1.13 scenario 2
— a type with no `states` block uses the `defaults` machine (REQ-STATE-08)" (pre-existing) and by the
task-010 block in `test/memory/state-machine.test.ts`; **without** one — the reading this task takes —
by the new "REQ-STATE-08 — no `states` AND no `defaults` block resolves the built-in default machine
(bug-030)" block, whose four verbs assert the scenario's `Then` (the default machine, by value) and the
requirement's fit criterion ("accepts exactly the default transitions and rejects any transition
outside them"). Run: `npx jest test/memory/element-schema.test.ts test/memory/state-machine.test.ts
test/storage/templates.test.ts test/cli/fresh-init-transitions.test.ts test/core/memory-submit.test.ts
test/core/memory-approve.test.ts test/core/memory-reject.test.ts test/core/memory-deprecate.test.ts` →
8 suites / 211 tests green.

#### Interactions with the parallel work (checked, not assumed)

- **`task-057`'s built-in directive templates** and **`task-054`'s `built-in`/`custom` split** still
  scaffold correctly: the change is confined to `memoryYaml()`, adds no file and removes none. The
  init transcript above lists all six `directives/built-in/*.md` plus the four `custom/` ones, and
  `npx jest test/storage` (including `builtin-directives.test.ts`) is green.
- **No existing test pinned the old comment-only `memory.yaml`** beyond the two expectations inverted
  in the red section — established by `grep -rn "REQ-STATE-08" test src` (output in the red section)
  and by the full suite passing.
- **Out of bounds, never edited by this task:** `package-lock.json` and `package.json` `engines` —
  both arrived from `main` through the merges below (`task-073`'s lockfile fix, `task-074`'s Node-22
  floor) and neither was touched here; reason/audit handling (`task-072` — `dl-067` arrived on `main`
  during this task, was merged in and was not acted on); `scripts/e2e-smoke.cjs` (`bug-029`); and
  `bug-026`'s `tsc` error, left failing as the brief requires.

#### `git merge main` before submit (dl-035 — merge, never rebase)

`main` moved five times while this task ran, and was merged each time, never rebased: `7aeeb91` →
`f304bf7` (`dl-067` ratified) → `bcc66a9` (`task-073`, the lockfile fix) → `a7d783a` (`task-074` /
`adr-010`, the Node-22 engines floor, plus `dl-068`/`dl-069` and `bug-046..049`) → `7bb95d6`
(`docs/adr-010-cascade`: `CLAUDE.md`, the product brief, `docs/self/.wingfoil/dna.yaml`, `dl-001`).
Every merge was clean — no conflicts in any of them, and none touched a file this task changed. The
last one is **docs-only** (`git diff --stat a7d783a main` → 4 files, none under `src/` or `test/`), so
the Gates table's numbers, measured at `a7d783a`, still describe this tree; `npx jest`
(101 suites / 1627 tests), `npm run lint` (0) and `npx tsc -p tsconfig.build.json --noEmit` (0) were
re-run after it to confirm.

After the final merge the sources these notes cite were re-opened, not assumed:

```
$ sed -n '/### REQ-STATE-08/,/### REQ-STATE-09/p' docs/02_requirements/03_sard/03_state-context.md
  → Description still reads `draft → pending → approved/rejected → deprecated` (unchanged)
$ git log --oneline -3 -- docs/02_requirements/03_sard/03_state-context.md \
    docs/self/docs/04_memory/design/specs/spec-001-memory-yaml-schema.md \
    docs/self/docs/04_memory/design/specs/spec-011-storage-layout.md \
    docs/02_requirements/02_bdd/features/p1-memory/P1.13-memory-element-schema.feature
  → af91cf8 (dl-053: REQ-STATE-01 + spec-004 only), 2cd936f, ba28c2e — none of them spec-001,
    spec-011 or the P1.13 feature
$ grep -m2 "^status:\|^release:" docs/self/docs/04_memory/bugs/bug-029-…md   → status: open · release: ""
$ git log --oneline -2 -- scripts/e2e-smoke.cjs   → last touched by task-060, not by this task
```

So: REQ-STATE-08's text, `spec-001`, `spec-011` and the P1.13 feature are all textually unchanged since
the design section was written, `bug-029` is still `open` and unscheduled, and the smoke script is as
`task-060` left it. The `dl-063`/`dl-053` doc actions that landed on `main` touched `P1.8`, `REQ-SEC-03`
and `REQ-STATE-01`/`spec-004` — REQ-SEC-03's extension to `reject` is consistent with what the
end-to-end test already does (it grants the `approver` role before driving `reject`), and none of them
changes a sentence in these notes. Every gate above was re-run after the final merge, on the real
`npm ci` install.

#### Rework after the first review (rejected at `26a289e`)

The review upheld the substance — the engine-side reading of REQ-STATE-08, the built-in's value, the
overridability of the default, and both arms being independently pinned (its own mutation testing:
engine arm alone 6 red, scaffold arm alone 2 red, both 26 red). Two narrow defects were required to be
fixed, and both are fixed above rather than argued with:

1. **The coverage sentence stated an unmeasured mechanism.** "The denominator growing (the new suites
   add branch-free assertions)" was wrong — test files are not in the denominator, and the denominator
   shrank. The Gates section now derives the −0.01pp from the two `coverage-summary.json` files and the
   two branch maps, and prints the commands. The conclusion it reached is unchanged and now rests on
   the measurement instead of on a guess.
2. **`main` had moved to `bcc66a9`+ with `task-073`'s lockfile fix.** Merged (and then again for
   `a7d783a`), the `node_modules` symlink deleted, a real `npm ci` run, and **every** gate re-run
   against that install — so the branch is now known-installable from its own lockfile, which the
   earlier symlinked runs could not show.

Also re-run first-hand after the merges, not carried over: `scripts/e2e-smoke.cjs` (17/17, unmodified)
and the full manual `init` + five-verb transcript below, for **both** templates — same states, same
`+1` commit per verb, same subjects, clean tree.

`bug-030`'s own state was **left at `in-review`** across this rework rather than walked
`in-review → in-progress → in-review` to mirror the task. The reject commit (`26a289e`) moved the task
only; the bug's state before the rework and after this resubmit is the same `in-review`, and the two
extra commits would have recorded a round trip that carried no information about the bug itself. Noted
here so the choice is visible rather than looking like a missed `bug.sync_state`.

One observation from the rework, reported because it is a gate fact and not a claim about this change:
of **four** full `npx jest --coverage` runs on this branch, one failed a single pre-existing assertion
in `test/cli/program.integration.test.ts:208` (`dna show nonexistent_section` stderr) — a suite that
spawns the compiled CLI out of process. It passed on the immediate targeted re-run (63/63) and on the
three other full coverage runs, and it touches no code this task changes. Recorded as a flake, with a
proposed element below rather than a fix here.

#### Known weak spots a reviewer should check

1. **The reading of REQ-STATE-08 is a judgement call, and it is the whole fix.** If the approver reads
   the BDD scenario's *title* as normative (the default machine exists only when a `defaults` block is
   declared), then the engine arm should be dropped and only the scaffold change kept — in which case
   `test/core/memory-submit.test.ts`'s inverted block must be inverted back. The design section states
   the case; the decision is the approver's.
2. **The built-in machine's value is `spec-001`'s, not REQ-STATE-08's literal text.** They differ
   (`rejected`, `deprecated`), `spec-001` says so deliberately and says REQ-STATE-08 "must be
   reconciled" — but the SARD entry still carries the old wording, so the code and the requirement text
   read differently on their face. Proposed as an element below.
3. **A fresh project still cannot `approve`/`reject` until someone is given the `approver` role** in
   `dna.yaml` (REQ-SEC-03). Correct by design as far as this task is concerned, but it means "a fresh
   init can run every transition verb" is true of `submit`/`deprecate` unconditionally and of
   `approve`/`reject` only after that one config edit. Proposed as an element below.

#### Findings — all four filed as their own elements at the first review (`26a289e`)

Kept here as the record of where they came from, **not** re-proposed: the approver's reject commit
states that these four are being filed as elements of their own, so this list is history, not a queue.
The one finding that post-dates that review is number 5.

1. **bug — `REQ-STATE-08`'s Description still names the pre-`spec-001` default machine.** It says
   `draft → pending → approved/rejected → deprecated`; the approved `spec-001` §Consequences removed
   `rejected` ("no document ever records `status: rejected` again") and makes `deprecated` implicit,
   and says the requirement "must be reconciled". Evidence: `sed -n '/### REQ-STATE-08/,/### REQ-STATE-09/p'
   docs/02_requirements/03_sard/03_state-context.md` (re-run and unchanged as of `a7d783a`) vs `spec-001`
   §Consequences. task-071 implements the `spec-001` machine and documents the discrepancy in TSDoc
   rather than editing the SARD.
2. **bug — `spec-011-storage-layout` still describes `memory.yaml`'s per-type `states` as
   `(values/initial/transitions)`** (line 104), an encoding `spec-001` replaced with
   `sequence`/`gates`/`waiting` (and `initial:` was explicitly "retired"). It also does not mention the
   top-level `defaults` block that `wingfoil init` now scaffolds. Evidence:
   `grep -n "memory.yaml" docs/self/docs/04_memory/design/specs/spec-011-storage-layout.md`.
3. **decision-log — should `wingfoil init` seed the initialising user as an `approver` in
   `dna.yaml`?** As shipped, `init` writes `team.members: []`, so `memory approve`/`reject` refuse
   (`user not authorized to approve type 'task'`, REQ-SEC-03/adr-006) in every new project until the
   user hand-edits `dna.yaml` — with no message saying that is what to do. Options: seed the git
   identity as an `approver` member at `init`; leave it and make the refusal message name the fix; or
   leave as-is deliberately (authority should be an explicit act). Evidence: the green section above,
   and `src/core/approval-authority.ts`.
4. **(follow-up, optional) — should the scaffold ship per-type machines rather than one shared
   `defaults`?** Rejected here as a product decision beyond bug-030 (see the design section), but a
   starter `task` type whose lifecycle is `draft → pending → approved` may be weaker than a user
   expects from a Scrum/Kanban template. Would need `spec-011`/`spec-001` revision and the approver.
5. **bug (new, from the rework) — `test/cli/program.integration.test.ts` can fail intermittently under
   a full `--coverage` run.** One of four full coverage runs on this branch failed
   `test/cli/program.integration.test.ts:208` (`dna show nonexistent_section` — an exact-`stderr`
   assertion); the same suite passed alone (63/63) immediately afterwards and in the three other full
   coverage runs. The suite spawns the compiled `dist/cli.js` out of process, which is the same
   spawn-under-load shape `bug-011`/`bug-003` have hit before in this repository; the assertion is
   unrelated to anything task-071 changes. A flaky assertion in a hard-reject gate is worth its own
   element — nobody should have to guess whether a red gate is real.
