---
id: "task-020-implement-memory-add"
type: task
title: "Implement wingfoil memory add (P1.3)"
status: in-review
release: "v0.1"
priority: "Critical"
tags: ["v0.1", "memory"]
ref: "P1.3"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

Feature **P1.3 — `wingfoil memory add`**: create/add a document to Memory in
`.wingfoil/memory/{type}/` (or, for WingFoil's own dogfooded layout, under
`docs/04_memory/...`) in draft state.

As Morgan (US-4-01), I want to create/add a document to Memory in draft state so conventions are
git-backed and discoverable.

Concretely this task implements the `memory.add` domain operation and its CLI verb: resolve the
requested `type` against `memory.yaml`'s type registry, generate the document's path from the
type's `path` pattern and a new `id` from its `id_pattern`, copy the type's `template.file`
scaffold verbatim, set `status` to the type's initial state (`draft`), stage only that new file,
and commit it as `wf({type}): add {id}` per the memory-operation commit-format convention (P1.7). Unknown
types and missing required arguments must be rejected before any file is written.

## Acceptance Criteria

See docs/02_requirements/02_bdd/features/p1-memory/P1.3-memory-add.feature. Key scenarios:
- **Add a new Memory document in draft state**: running
  `wingfoil memory add --type decision --title 'Use PostgreSQL'` creates a file under
  `.wingfoil/memory/decision/` with frontmatter `status: draft` and a generated unique id; the
  command exits 0 and prints the new document id.
- **Error — adding a document of an undefined type**: `--type unicorn` creates no file and exits
  with code 1 and message "unknown memory type 'unicorn' (not defined in memory.yaml)".
- **Error — missing required title**: omitting `--title` creates no file and exits with code 2
  and message "missing required argument: --title".

## Implementation Notes

Cross-references `spec-006-core-domain-api` (the shared `memory.add` function behind both CLI and
MCP surfaces per REQ-SYS-05), `spec-001-memory-yaml-schema` (type registry: `path`, `id_pattern`,
`template`, initial state), and `spec-010-memory-frontmatter-schema` (the base frontmatter fields
`add` must populate). Depends on task-001 (Node.js/TypeScript scaffold), task-002
(validation/ID engine — supplies the `id_pattern` generation and type validation this command
calls), and task-018/task-019 (git-backed storage + versioning, since `add` produces exactly one
git commit).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

- **design**: verified against approved specs — spec-006 (`memoryAdd` `mutates: true` → CLI `memory add`
  + Tool `memory.add`), spec-001 (type registry supplies `path`/`id_pattern`/`template`), spec-010
  (base fields `id/type/title/status/tmpl_version`; add sets `id` from `id_pattern`, `status: draft`,
  `title` from `--title`; `tmpl_version` copied from scaffold, never touched), spec-005/spec-008
  (unknown type → exit 1 `unknown memory type '<t>' (not defined in memory.yaml)`; missing `--title` →
  exit 2 `error: missing required argument: --title`). No missing/wrong approved tech-spec — no new
  tech-spec created. `decision`/`decision-log`: the BDD's `--type decision` is a fixture placeholder
  (its Background declares a type literally named `decision`); `add` resolves `--type` verbatim against
  the project's `memory.yaml` `types` registry, so it is type-agnostic (no hardcoded mapping).
  Observed cross-task divergence (NOTE for orchestrator, not this task's fix): task-029's init scaffold
  `memoryTemplateMd` omits `tmpl_version` and uses `id: ""` where spec-010 says the raw scaffold holds
  `id: "{auto}"`; `memory.add` copies whatever scaffold exists verbatim (P1.3 / spec-001 template), so it stays
  correct on its own axis — the scaffold content is init/spec-010's concern.
- **red**: added `test/core/memory-add.test.ts` (real registered `memory.memoryAdd` op over throwaway
  temp repos) + `test/memory/add.test.ts` (pure helpers) + a value-option seam test in
  `test/cli/registrar.test.ts`; updated `parity`/`production-registry`/`read-only-agent-channel` to
  expect `memory.add` ALONGSIDE `dna.set`. Confirmed failing for the right reason (op not registered).
- **green**: `src/memory/add.ts` (slug/sequence/render helpers); `memoryAddFn` + `memory` module
  registration in `src/core/index.ts`; the additive value-option seam (`CoreOption` +
  `CoreOperation.options` + `ParamsContext.options`, threaded through `registrar.run`/`program.ts`/
  `src/cli.ts`). No deviation from the plan. Id generation supports the id engine's numeric `{n}`
  token via a deterministic counter (count of committed siblings + 1) plus the title `{slug}`; a
  `{version}`-only pattern (release-line/release) is out of CLI-add scope (workflow-seeded) and
  surfaces as a VALIDATION error, not a crash.
- **review**: `npx tsc --noEmit` clean; `npx jest` 510/510 green (was 507 before this task's 3 net-new
  suites/assertions). New-code coverage: `src/memory/add.ts` 100% stmts / 95% branch, `src/cli/registrar.ts`
  100%, `memoryAddFn` AC + error-mapping paths covered. `git ls-tree HEAD -- node_modules` empty.
