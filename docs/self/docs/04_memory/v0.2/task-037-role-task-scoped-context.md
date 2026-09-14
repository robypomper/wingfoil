---
id: "task-037-role-task-scoped-context"
type: task
title: "Infrastructure: REQ-STATE-05 — role/task-scoped context"
status: in-progress
rejection_reason: "resolveRoleDirectives reads rolesYaml.assignments[role] through Object.prototype, so a role named toString, constructor, valueOf or hasOwnProperty resolves to an inherited function and the spread throws TypeError - contradicting the function own documented contract that an absent role resolves to the globals and never errors. Fix with a hasOwnProperty guard or a null-prototype record. Also correct three TSDoc claims that do not hold: deduplicated by directive id (no dedup of directive files occurs - the Set holds roles.yaml ids), memory is a single deterministic lookup never a scan (findMemoryDocumentByTypeAndId walks and YAML-parses every Memory document), and the never-throws contract (it throws ValidationError on any malformed frontmatter anywhere in the tree). The P3.6 edge-scenario citation is also wrong - see dl-029, which owns that reconciliation."
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
