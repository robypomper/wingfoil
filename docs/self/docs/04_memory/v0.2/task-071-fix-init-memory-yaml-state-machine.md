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
