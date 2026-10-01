---
id: "task-136-validate-workflows-startable-includable-resolve-phase-include-name"
type: task
title: "Validate workflows as startable/includable, resolve phase `include` by name, and emit one ordered diagnostics array"
status: in-review
release: "v0.3"
kind: "feature"
priority: "high"
tags: ["v0.3", "workflow", "schema", "loader"]
ref: "dl-109"
bug: ["bug-144", "bug-145"]
depends_on: []
tmpl_version: 260703
---

## Description

The loader today requires `kind: main|sub` and never resolves a phase's `include`, so the Kanban scaffold's include-by-path passes (`bug-144`) and `workflow list` echoes an unresolvable value (`bug-145`). This task replaces the Layer-1/Layer-2 structural rules with the revised `spec-003`: the `startable`/`includable` booleans with `kind` as alias, the name class for workflows and phases (`adhoc` reserved), phase `include` as a workflow name that must resolve to an includable workflow, element compatibility, include cycles, `fallback.step` existence, and the diagnostics model `{ code, severity, file, path, message }` in `spec-003`'s deterministic order. It fixes the Kanban template in `src/storage/templates.ts` in the same change.

## Acceptance Criteria

- (red-first) Each loader row of `spec-003` § Diagnostics owned here fires on a minimal fixture with its code, severity, `file`, `path` and message: `E_WORKFLOW_INVALID_KIND` (message `invalid workflow kind 'hybrid' (allowed: main, sub)`, BDD P4.1 sc. 3), `E_WORKFLOW_NAME_INVALID`, `E_WORKFLOW_DUPLICATE_NAME`, `E_WORKFLOW_KIND_CONFLICT`, `E_WORKFLOW_NEITHER_STARTABLE_NOR_INCLUDABLE`, `E_NO_MAIN_WORKFLOW` (now "no startable workflow"), `E_PHASE_NAME_INVALID`, `E_PHASE_NAME_RESERVED`, `E_PHASE_DUPLICATE_NAME`, `E_WORKFLOW_INCLUDE_UNRESOLVED` (a path-shaped value included), `E_WORKFLOW_NOT_INCLUDABLE`, `E_WORKFLOW_ELEMENT_MISMATCH`, `E_WORKFLOW_INCLUDE_CYCLE` (message `include cycle: <w1> -> … -> <w1>`), `E_PHASE_FALLBACK_STEP_UNKNOWN` (message `fallback step '<step>' not found in workflow`, BDD P4.15 sc. 3 as amended by spec-017 Consequences).
- (red-first) `kind: main` loads as startable-only and `kind: sub` as includable-only; a workflow declaring only `includable: true` is not startable (BDD P4.1 sc. 1–2).
- (red-first) An absent `.wingfoil/workflows.yaml` loads as an empty registry with no diagnostic (spec-003 Layer 1; BDD P4.6 sc. 4 groundwork).
- (red-first) Diagnostics come out in `spec-003`'s order (manifest, then files in `include` order, workflow-level before phase-level, table order per field); a test loads a fixture with several errors twice and asserts byte-identical arrays (REQ-SYS-07). The first error is the `VALIDATION` reason (exit 1) and every diagnostic is in `details`.
- (red-first) `wingfoil init --template Kanban` writes `include: kanban-delivery` and the scaffold loads with zero errors (`bug-144`); a test asserts every built-in template (default, Scrum, Kanban) loads with zero errors under the new loader (P4.17 integrity unchanged).
- (characterization) Every file under this repository's `.wingfoil/workflows/custom/` loads with no error from this task's rules (spec-003 § Names measured none).
- (characterization) `docs/01_vision/06_features.md` P4.2 and P4.6 descriptions speak of startable/includable workflows (`dl-109` Action 3), with a `doc-versioning` bump.

## Implementation Notes

- **Size:** M · **wave:** 1 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** dl-109 K1 (a), K3; spec-003 Layer 1 (absent manifest, startable rule), Layer 2 top-level fields, § Names, § Diagnostics (shape, order, "runs in").
- **Features:** P4.1, P4.16.
- **Notes:** Proposal key: A01. files `src/workflow/schema.ts`, `src/core/loaders.ts` (semantic checks), `src/validation/` if the diagnostics type lives there, `src/storage/templates.ts`. The `workflow list` payload keeps its shape here; task-204 reshapes it.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

Branch `task/task-136-validate-workflows-startable-includable-resolve-phase-include-name`, worktree
`../.wf2-wt/task-136`, cut from `main` at `c43221c4`. Start `cc0ca67d`; `bug-144` `[planned →
in-progress]` `53f036bf`; `bug-145` `[planned → in-progress]` `96aeba91`.

### design (architect)

**`depends_on` read (dl-015).** `depends_on: []`: no upstream Execution Notes to read.

**Specs.** `spec-003-workflows-yaml-schema` and `spec-017-workflow-commands-and-state-deduction` are
`approved`, and `dl-109` is `ready` (`grep -m1 "^status"` over the three files). The loader rows of
spec-003 § "Diagnostics" fix every code, severity and message this task emits. Two messages are
pinned by BDD (P4.1 sc. 3; P4.15 sc. 3 as spec-017 Consequences amend it). The others are worded
here, lower-case and without a trailing period (spec-005 §3.1). The table does not say on which file
and path a cross-file diagnostic is reported, nor what happens when a file is missing or
structurally invalid. That is settled in a pending spec-003 amendment (below) rather than left to
the code.

**Design.**
- `Diagnostic` `{ code, severity, file, path, message }` and `DiagnosticsError` live in
  `src/validation/diagnostic.ts`. A `Diagnostic` is a `ValidationIssue` with a `severity`, so the
  error is a `ValidationError` (exit `1`, `EXIT_VALIDATION`) whose `message` is the first error's.
  `loadOrError` (`src/core/index.ts`) maps it to `VALIDATION` with `details: { diagnostics }`, the
  array name spec-003 uses.
- `src/workflow/schema.ts` stays structural: `kind` optional with BDD P4.1 sc. 3's message on the
  enum, `startable` / `includable` optional booleans, `workflowFacts()` for the `kind` alias, and
  the name class `WORKFLOW_NAME_RE` / `RESERVED_PHASE_NAMES`. The name class is a loader check, not
  a Zod regex, so a bad name has its own code and the rest of the file is still checked.
- The loader checks live in `src/core/workflow-diagnostics.ts`, called by `loadWorkflowsYaml`. This
  keeps `src/core/loaders.ts`'s diff small for `task-137` / `task-143`. The loader collects instead
  of throwing at the first failure. Order: the manifest's diagnostics (`E_WORKFLOW_FILE_NOT_FOUND`,
  then `E_NO_MAIN_WORKFLOW`), then each file in `include` order (structural, workflow-level,
  phase-level, rows in table order). A YAML parse failure, or a manifest that fails its own
  structural pass, still throws as before (spec-009).
- Absent `workflows.yaml`: `{ manifest: null, workflows: [] }`. On success the payload keeps its
  `{ manifest, workflows }` shape. No warning row is owned here, so no `diagnostics` key is added to
  it; `task-204` reshapes the payload.

**AC classification (T1).**

| AC | Class | Why |
|---|---|---|
| 1 — each loader row fires with code/severity/file/path/message | **red-first** | none of the 14 codes is emitted today except `E_NO_MAIN_WORKFLOW` / `E_WORKFLOW_FILE_NOT_FOUND`, with another shape |
| 2 — `kind` alias, `includable: true` not startable | **red-first** | `kind` is required today and the booleans do not exist |
| 3 — absent manifest is an empty registry | **red-first** | today it is `ENOENT` → `NOT_FOUND` |
| 4 — deterministic order, byte-identical, first error as reason, all in `details` | **red-first** | no array exists |
| 5 — Kanban writes `include: kanban-delivery`; every template loads with zero errors | **red-first** for the content; the load tests are characterization on `main` (no include resolution) and fail once AC 1 lands without the template fix (see red) |
| 6 — this repository's workflows load with no error | characterization | spec-003 § Names measured none |
| 7 — `06_features.md` P4.2 / P4.6 | characterization (documentation) | — |

### red (developer)

`test/core/workflow-diagnostics.test.ts` (`2cce7084`).
`npx jest test/core/workflow-diagnostics.test.ts` → **28 failed, 5 passed, 33 total**. The 5 that
pass are the guard that legal element bindings are accepted, the three template-load tests and the
live-repository test (AC 5 load half, AC 6). Each of the 28 fails on its assertion
(`--json` per-test status), not on a compile error. The template-load half of AC 5 was shown red
after green: with the green code and `src/storage/templates.ts` reverted (`git checkout
src/storage/templates.ts`), `npx jest … -t template` → **4 failed**, each with `include
'workflows/custom/<slug>-delivery.yaml' names no loaded workflow (a phase include is a workflow
name, not a file path)`.

### green (developer)

`27514535` (`feat(workflow)`, bug-144, bug-145): `src/validation/diagnostic.ts`,
`src/core/workflow-diagnostics.ts`, `src/workflow/schema.ts`, `src/core/loaders.ts`,
`src/core/index.ts` (`loadOrError`), and `src/storage/templates.ts`. The template change is one
line in `templateScaffold`'s `sw-life-cycle` (`include: ${def.slug}-delivery`); it fixes Scrum
too, which had the same path include. Two existing tests read `manifest.include`, which is now
`manifest?.include` (`test/core/loaders.test.ts`, `test/core/service-memory-type.test.ts`).
`npx jest test/core/workflow-diagnostics.test.ts` → 33 passed.
`1b448bdc` (`docs(vision)`): `06_features.md` v1.5 → **v1.6**, date 2026-10-01 (first edit since
`2a7ee7e7` committed v1.5). The P4.2 and P4.6 rows and the "Context-aware `list`" bullet speak of
startable and includable workflows.

Changes in behaviour beyond the ACs:
- `E_WORKFLOW_FILE_NOT_FOUND` and `E_NO_MAIN_WORKFLOW` used to be `ValidationError.semantic`
  (exit `2`). They now exit `1` with every other spec-003 error (spec-003 § Diagnostics: "an error
  makes the operation fail with `VALIDATION` (exit `1`)"; spec-017 §10).
- A missing manifest used to be `NOT_FOUND` (exit `1`); it is now an empty registry (exit `0`).

### refactor (developer)

`085720b0` adds the tests that coverage asked for: a three-workflow cycle, structural failures that
do not cascade, and `DiagnosticsError`'s reason (`test/validation/diagnostic.test.ts`).

| Command | Result |
|---|---|
| `npm test` (with the pending spec-003 amendment in the working tree) | exit 0; 168 suites / 2799 tests |
| `npx jest --coverage --coverageReporters=json-summary` | 98.73 / 94.75 / 94.23 / 99.51 (stmts / branches / funcs / lines). `main` `c43221c4`, the same command in a temporary detached worktree: 98.73 / 94.58 / 94.01 / 99.49. No regression. Per file, the only change on existing files is `src/validation/errors.ts` branches 4/5 → 5/5. New: `workflow-diagnostics.ts` 117/119 stmts, `diagnostic.ts` 9/9 |
| `npm run lint` | exit 0 |
| `npm run docs:api` | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| `npm run build && node dist/cli.js workflow list --format json` on this repository | exit 0; 23 workflows, 85 phases (AC 6, same counts as spec-003's measurement) |
| scratch repo: `node dist/cli.js init --template Kanban`, then `workflow list --format json` | `include: kanban-delivery` at `sw-life-cycle.yaml:9`; exit 0. With the include rewritten to the old path: `error: include 'workflows/custom/kanban-delivery.yaml' names no loaded workflow (…)`, exit 1 |

During a full run, one perf test (`test/core/query-latency.test.ts`, REQ-PERF-02) failed under
parallel load. `npx jest test/core/query-latency.test.ts` run alone → 4 passed. The threshold was not
touched.

BDD: no test in `test/` runs the P4.1 / P4.15 feature files (`grep -rn "P4.1-workflow-config\|P4.15"
test/` → nothing). The behaviours of P4.1 sc. 1–3 and P4.15 sc. 3 (message) are covered by
`workflow-diagnostics.test.ts`. The P4.15 feature-file amendment (sc. 3 as a `workflow list`
failure) is `task-225`'s AC, so it is not edited here.

### review (reviewer, self)

- AC 1: all 14 codes, one `toEqual` on the whole diagnostic each (the element-mismatch variants and
  the cycle variants check code, path and message).
- AC 2: `kind: sub` only → `E_NO_MAIN_WORKFLOW`; including a `kind: main` → `E_WORKFLOW_NOT_INCLUDABLE`;
  `includable: true` only → `E_NO_MAIN_WORKFLOW`; both booleans → loads and is includable.
- AC 3: `toEqual({ manifest: null, workflows: [] })`, no throw.
- AC 4: an eight-diagnostic fixture over three files (one missing) in the expected order; two loads
  `JSON.stringify`-identical. `exitCode` 1, `message` is the first error. Through `workflowList`:
  `VALIDATION`, the same message, `details` `{ diagnostics }`.
- AC 5, 6, 7: as above.
- Determinism (directive): the checks iterate arrays and insertion-ordered `Map` / `Set` only. The
  cycle path is a breadth-first search with neighbours in phase order.
- `src/storage/templates.ts`: only the `sw-life-cycle` include line changes, away from `rolesYaml`
  (`task-133`).
- Same-class instance fixed: the Scrum scaffold had the same path include as Kanban.

### Pending amendments (approver)

- `spec-003-workflows-yaml-schema` (uncommitted in the worktree). Proposed `--reason`:
  "task-136 implemented the loader rows of § Diagnostics. Two line citations into
  src/core/loaders.ts stopped resolving and now name the files. A paragraph states where a
  cross-file diagnostic is reported and which diagnostics are not decided while an included file is
  missing or structurally invalid, so that every implementation emits the same array. No code,
  severity or message changes."

### Decisions for the approver

1. Spec-003 says commands carry the array as `diagnostics`. `details` here is `{ diagnostics }`,
   not the `{ issues }` every other `VALIDATION` carries. `DiagnosticsError.issues` holds the same
   array for code that reads `issues`.
2. `E_WORKFLOW_FILE_NOT_FOUND` / `E_NO_MAIN_WORKFLOW` now exit `1`, not `2` (spec-003, spec-017 §10).
3. A YAML parse error in an included workflow file still throws `E_YAML_PARSE_ERROR` (exit `2`)
   instead of joining the array, as in every other pillar loader.
4. A structurally invalid file contributes its Zod issues as `E_VALIDATION` diagnostics, with paths
   in spec-003's `phases[3].include` form.
