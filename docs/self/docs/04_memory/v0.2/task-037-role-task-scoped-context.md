---
id: "task-037-role-task-scoped-context"
type: task
title: "Infrastructure: REQ-STATE-05 — role/task-scoped context"
status: approved
release: "v0.2"
priority: "Blocker"
tags: ["v0.2", "state"]
ref: "REQ-STATE-05"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

Implement the State constraint **REQ-STATE-05** (context scoped to the active role and task).

## Acceptance Criteria

Satisfies the Fit Criterion for **REQ-STATE-05** in `docs/02_requirements/03_sard/03_state-context.md`.

## Implementation Notes

Feeds directive auto-load (P3.6) and MCP Prompts (P5.2.2).

## Execution Notes

### design

- **T1 AC classification.** Single AC ("satisfies REQ-STATE-05's Fit Criterion") — **red-first**: no
  context-assembly code exists anywhere in `src/` today (confirmed via `grep -rl "context-builder\|
  ContextRequest\|assembleExecutionContext" src test` — zero hits before this task). Not a
  characterization AC.
- **`depends_on`: `[]`** — no `agent.read_related` gate to satisfy.
- **`verify_specs`.** `spec-012-context-loader-relevance-filtering` (`status: approved`) already covers
  this surface end-to-end (dna-loader / directive-loader / relevance-filter / context-builder, the full
  `ContextRequest` → canonical Markdown envelope pipeline). No new tech-spec needed — **pass-through**,
  no approval gate.
- **Scope decision (recorded, not a spec gap).** spec-012's full pipeline (byte-for-byte canonical
  Markdown serialization §7, `ContextRequest`/`stateRef` pinning, T1–T4 tiered relevance ranking +
  bounding §6, `agent execute` wiring) is NOT this task's scope — those land as their own backlog items:
  `docs/03_backlog/04_backlog/by-release/v0.3.json` carries REQ-SYS-07 (deterministic context assembly),
  REQ-PERF-01 (context load time), REQ-STATE-09 (context determinism), P5.4.3/P5.4.4 (the actual
  `agent execute` / execution-context CLI features) as separate v0.3 tasks. This task's own `ref` is
  narrowly **REQ-STATE-05** only ("assembled context object exposes separate `dna`, `memory`,
  `directives` sections; 100% of the role's directives, 0% of other roles'") — confirmed against the
  sibling Wave-1 v0.2 tasks that split the rest of spec-012: task-038 owns REQ-STATE-06 (deprecated
  exclusion), task-035 owns REQ-PERF-05 (relevance-filter bounding/performance). Implemented here: the
  `directive-loader` (role→directives resolution via a new, minimal `roles.yaml` schema/loader, mirroring
  `loadDirectives`) + a `context-builder`-shaped `assembleExecutionContext` that returns a plain
  `{ dna, directives, memory }` object with `memory` scoped to the single named task element (via the
  existing `findMemoryDocumentByTypeAndId` primitive, task-011) — no tiered ranking, no canonical
  Markdown serialization, no bounding caps (those are task-035/038/v0.3's scope). Module: `core`
  (spec-012 §1: "Context Loader lives in the `core` module").
- Directives auto-loaded: architecture, determinism, traceability. No approval needed — pass-through.

### red

Failing tests written first (all red before any impl — confirmed the `RolesYaml` schema,
`loadRolesYaml` loader, and `resolveRoleDirectives`/`assembleExecutionContext` did not yet exist):

- `test/core/context.test.ts` (new) — the REQ-STATE-05 Fit Criterion, verbatim: distinct addressable
  `dna`/`memory`/`directives` sections; **100%** of a role's assigned directives + global present, **0%**
  of another role's; role-with-no-assignments resolves to only globals (P3.6 edge case); task-scoped
  `memory` contains the named element and NOT an unrelated task; unresolvable element → empty (not
  thrown) memory; deterministic (assemble twice → deep-equal; resolve with reversed file input →
  identical sorted output).
- `test/core/loaders.test.ts` — `loadRolesYaml` fixture + live-config parse; missing `assignments` →
  `ValidationError`; added `.wingfoil/roles.yaml` to the shared four-pillar fixture writer.
- `test/directives/schema.test.ts` — `RolesYaml` structural shape (assignments+global accepted;
  missing `assignments` rejected; `global` defaults to `[]`; non-array assignment value rejected) +
  live `docs/self/.wingfoil/roles.yaml` parse.

### green

Minimum implementation to pass — wraps existing primitives, reimplements no scan/parse logic:

- `src/directives/schema.ts` — added `RolesYaml` Zod schema (`version?`, `assignments: record<string,
  string[]>`, `global: string[].default([])`, `.passthrough()`); exported via `src/directives/index.ts`.
  Role-name-vs-`team.roles` validation is deliberately NOT here (kept independent per REQ-SYS-02; that
  cross-pillar check is REQ-SYS-08/task-034's).
- `src/core/loaders.ts` — added `loadRolesYaml`, same shared two-pass pipeline as every sibling loader.
- `src/core/context.ts` (new) — `resolveRoleDirectives` (role `assignments` + `global`, dedup by id,
  **sorted ascending by id** per spec-012 §5 / REQ-SYS-07) and `assembleExecutionContext` (returns
  `{ dna, directives, memory }`; `memory` = the element resolved by `findMemoryDocumentByTypeAndId`,
  task-011, as a 0-or-1 array). Pure function — no wall-clock/randomness/unordered iteration.
- `src/core/index.ts` — append-only exports (`loadRolesYaml`, `assembleExecutionContext`,
  `resolveRoleDirectives` + their types); no `CORE_MODULES` op registered (this is infra a later P3.6
  feature task — task-055, which `depends_on` this task — wires into a surface).

### refactor

- Dropped the redundant `.slice()` before `.sort()` in `resolveRoleDirectives` (`.filter` already
  returns a fresh array, so the in-place sort never mutates the caller's input) and expanded the
  determinism-intent comment. Tests stayed green.

### review

- **Gates (all pass):**
  - `npm test` — **566/567** under 10-way parallel load; the sole failure is
    `test/cli/program.integration.test.ts:352` "memory search api ... under 1 second" — a **pre-existing
    wall-clock flake** (task-021's perf assertion; observed ~4.3s under saturation). Re-ran that suite in
    isolation: **28/28 green**. Not touched (out of scope; editing it would collide with 9 sibling
    branches). Full suite treated as GREEN. Every other suite (59 total) passes; my three suites 33/33.
  - `tsc -p tsconfig.build.json` — exit 0.
  - `npm run test:coverage` — global threshold met (no threshold error); `src/core/context.ts` 100%
    stmts/funcs/lines (87.5% branch), `src/directives/schema.ts` 100%, `loadRolesYaml` covered.
  - `npm run docs:api` — exit 0 (TSDoc present on every new exported declaration; ACTIVE hard-reject
    regime satisfied).
- **Traceability:** REQ-STATE-05 Fit Criterion → `spec-012` §1/§5 → `context.test.ts` (100%/0% directive
  assertions, distinct sections) + `p3-directives/P3.6-auto-load-by-role.feature` (role-with-no-directives
  edge) + `P5.4.4-execution-context.feature` (distinct addressable sections, determinism).
- **Deviations / scope notes:** implements only REQ-STATE-05's narrow slice of spec-012 (directive-loader
  + a distinct-sections context-builder) — no tiered relevance ranking, bounding, deprecated-exclusion,
  `stateRef` pinning, or canonical Markdown serialization (task-035/038 + v0.3's REQ-SYS-07/PERF-01/
  STATE-09; see the design note). No new spec required; no blockers.

---

## Execution Notes — second pass (review-gate reject → `red`)

Returned to `red` by the review gate; the first-pass sections above are left as written, corrections
are recorded here. `main` was already merged into the branch before this pass (`8bdb257`, per
`dl-035-task-branch-sync-with-main`) — no further sync performed.

### Inputs taken as binding

- The `rejection_reason` that was on this file (now cleared by `memory.submit`, per `spec-010`).
- **`dl-029-role-with-no-directive-assignments`** (`ready`) — ratified **option (c)**, the hybrid.
- **`p3-directives/P3.6-auto-load-by-role.feature`**, already amended on `main` to dl-029's outcome:
  the edge scenario now reads *"the agent context contains only the global directives"* **and**
  *"a warning `no directives assigned to role 'intern'` is emitted"*. Implemented against that text.

### red (second pass) — `b170880`

Observed failures before any implementation change: **19 failed / 7 passed** in
`test/core/context.test.ts`. Three distinct verbatim failure modes:

- `TypeError: (rolesYaml.assignments[role] ?? []) is not iterable` at `src/core/context.ts:44` — the
  prototype-key defect, reproduced for `toString`, `constructor`, `valueOf`, `hasOwnProperty`,
  `isPrototypeOf` and `__proto__`, both through `resolveRoleDirectives` and through
  `assembleExecutionContext`.
- `TypeError: Cannot read properties of undefined (reading 'map')` — the existing assertions, rewritten
  against the new `{ directives, warnings }` resolution shape, which did not exist yet.
- `expect(received).toThrow(expected) … Received function did not throw` for the Memory
  malformed-frontmatter contract, and `Expected: [] / Received: undefined` for `context.warnings`.

One red test had to be corrected *while still red*: the malformed-frontmatter document was first
written as `task-103-broken.md` and the assertion did not throw, because
`findMemoryDocumentByTypeAndId` returns at the **first** match and `task-101-alpha` sorts ahead of it.
Renaming the fixture to `task-100-broken.md` (visited before the target) made it fail as intended.
That is itself the evidence for TSDoc correction (2) below — the primitive is an ordered walk with an
early exit, not an addressed read.

### green — `73df7be`

1. **Prototype-key defect.** New module-private `ownAssignments(rolesYaml, role)` does the lookup via
   `Object.prototype.hasOwnProperty.call(...)` and returns `undefined` for any role that is not an own
   key. A `hasOwnProperty` guard was chosen over a null-prototype record because the record arrives
   from Zod's `z.record(...)` in `loadRolesYaml` and from arbitrary callers of the exported
   `resolveRoleDirectives` — the guard fixes the defect at the read site, for every caller, without
   depending on how the object was constructed. Proven by
   `test/core/context.test.ts` › *"Object.prototype role names … role %p resolves to the globals
   instead of throwing"* (`it.each` over all six names) plus the `assembleExecutionContext`-level case.
   A companion test pins the mirror-image mistake: a role literally named `global` must not borrow the
   `global` list as its assignments.
2. **dl-029 option (c).** `resolveRoleDirectives` now returns `RoleDirectiveResolution`
   `{ directives, warnings }`, and `ExecutionContext` carries a fourth `warnings` property.
   **How the warning surfaces — and why:** a returned array, not `stderr` and not a logger. This is a
   context-building path, where REQ-SYS-07 requires output to be a pure function of the inputs;
   writing to a process stream would put an observable side-effect into exactly the path the
   determinism requirement protects, and would force stream capture to test it. A return value is
   deterministic, directly assertable, and leaves rendering to the CLI/MCP surface that will consume
   it (`task-055-auto-load-directives-by-role`). The warning fires when the role contributes no
   assignments *of its own* — absent key **or** explicitly empty list — matching dl-029's wording;
   both cases are tested, as is the negative (a bound role warns not at all). `warnings` is
   deliberately documented as a diagnostic *about* the context, not content *of* it: spec-012 §7's
   canonical envelope has no warnings section, so it must not enter the serialized payload.
3. **Directive-id dedup — implemented, not just re-worded.** spec-012 §5's "deduplicate by directive
   id" is now performed on the directive **files**: a `Map<id, DirectiveFile>` keeps one file per id,
   tie-breaking on the lexicographically smallest `path` so the winner is independent of the order
   `directiveFiles` arrives in. The scenario is real rather than hypothetical — CLAUDE.md §3 records
   that the P3.8 built-ins will eventually ship alongside the `custom/` stand-ins that currently carry
   the same ids. spec-012 defines **no** built-in-vs-custom override precedence, so none was invented;
   that is stated in the TSDoc and left as a config-hygiene concern.
4. `src/core/index.ts` — append-only: added the `RoleDirectiveResolution` type export.

### TSDoc corrections (the three disproved claims)

| First-pass claim | Second pass |
|---|---|
| *"deduplicated by directive id"* | **Implemented** (green §3). The old `allowedIds` Set held `roles.yaml` ids and deduped nothing about files; dedup now happens on `DirectiveFile` by `frontmatter.id`. Verified by two tests, one of which asserts the *same* duplicate survives when the input array is reversed. |
| *"`memory` is a single deterministic lookup, never a scan"* | **Corrected.** The TSDoc now states that `findMemoryDocumentByTypeAndId` walks the Memory document paths derived from `memoryYaml` in sorted order and YAML-parses each frontmatter until it matches, so cost grows with the tree; bounding it is task-035's REQ-PERF-05, not this task's. Verified by reading `src/memory/query.ts` and by the fixture-ordering behaviour observed in `red`. |
| *"never-throws contract"* | **Corrected.** A missing element still yields an empty `memory` array, but a `ValidationError` (`E_YAML_PARSE_ERROR`, raised by `parseYaml` in `src/validation/yaml.ts` via `loadMemoryDocumentSummary`) propagates out of assembly when a document *visited during the walk* has unparseable frontmatter. Pinned by a test. The scope is stated precisely — documents after the match are never read. |

The P3.6 citation is now accurate: with dl-029 ratified and the `.feature` amended, the edge scenario
does specify globals-plus-warning, which is what the code does. The citation appears alongside its
dl-029 provenance rather than standing alone.

### refactor — `a54d73c`

Coverage on `src/core/context.ts` showed two branches unreachable *by type*: an `Array.isArray`
re-check inside `ownAssignments` (Zod already types every own value as `string[]`) and the `=== 0`
arm of the id comparator (the `Map` is keyed by id, so no tie can reach it). Both removed;
`src/core/context.ts` goes to **100% stmts / branch / funcs / lines**. Tests stayed green.

### review (second pass)

- **Gates — real observed numbers, this branch, this pass:**
  - `npx jest --maxWorkers=2` — **778/778 passed, 66/66 suites**, 18.7 s. No failures, no flakes; the
    v0.1-era `program.integration.test.ts` wall-clock flake noted in the first pass did not reproduce
    at `--maxWorkers=2` (it is `bug-011-cli-latency-assertion-measures-spawn-contention`'s scope).
  - `npx jest --coverage --maxWorkers=2` — global **98.07% stmts / 88.21% branch / 98.09% funcs /
    98.66% lines**, over the 80% floor; touched files: `src/core/context.ts` 100/100/100/100,
    `src/core/index.ts` and `src/directives/schema.ts` unchanged in coverage terms.
  - `npm run docs:api` — exit **0**.
  - `npx tsc -p tsconfig.build.json` — exit **0** (also `tsc --noEmit -p tsconfig.json`, exit 0).
  - `npx eslint .` — exit **0** (`lint.clean`, ACTIVE hard-reject per `dl-034` / `dev-loop.yaml` v1.2,
    asserted by `test/lint/lint-clean.test.ts`, which is inside the 66 green suites).
- **Traceability:** REQ-STATE-05 Fit Criterion → `spec-012` §1/§5 → `test/core/context.test.ts`;
  `dl-029` → `P3.6-auto-load-by-role.feature` edge scenario → the `dl-029 option (c)` describe block.
- **Deliberately out of scope, and why:**
  - **`bug-010-deprecated-reaches-agent-context`** (`triaged`) — `assembleExecutionContext` still does
    **not** filter archived documents, so a `deprecated`/`superseded` element assembles into the
    context. Not fixed and not half-fixed here: that bug owns both this surface and the MCP collection
    Resource, and must be fixed against `dl-028`'s ratified set via the shared `isArchivedStatus`
    (`src/memory/state-machine.ts`). The gap is now stated explicitly in `assembleExecutionContext`'s
    TSDoc and in the module header rather than left silent.
  - spec-012 §4's per-scope `dna-loader` selection and §7's canonical envelope remain unimplemented,
    as in the first pass (v0.3 / REQ-SYS-07).
- **Breaking-change note for `task-055`:** `resolveRoleDirectives` returns
  `RoleDirectiveResolution` rather than `DirectiveFile[]`. Nothing outside `src/core/context.ts` and
  its test consumed it (verified by grep across `src/` and `test/`), and the module is registered in no
  `CORE_MODULES` op, so there is no CLI/MCP surface to migrate.
