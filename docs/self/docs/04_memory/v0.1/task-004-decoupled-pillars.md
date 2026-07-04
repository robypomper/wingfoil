---
id: "task-004-decoupled-pillars"
type: task
title: "Infrastructure: REQ-SYS-02 — Decoupled pillars as independent artifacts"
status: in-review
release: "v0.1"
priority: "Blocker"
tags: ["v0.1", "architecture"]
ref: "REQ-SYS-02"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

REQ-SYS-02 requires that WingFoil's four pillars be separate, independently loadable config artifacts:
`.wingfoil/memory.yaml` (Memory), `.wingfoil/dna.yaml` (DNA), `.wingfoil/directives/` (Directives), and
`.wingfoil/workflows.yaml` (Workflow). Editing one artifact and reloading must not raise errors in, or
otherwise require touching, any of the other three — each pillar owns its own schema and its own
validation pass.

This task builds the loader boundary that keeps that decoupling real rather than accidental: each
pillar gets its own Zod schema (`spec-001` for `memory.yaml`, `spec-002` for `dna.yaml`, `spec-003` for
`workflows.yaml`) validated independently through the shared two-pass pipeline (`spec-009`), and the
`core` module (`src/core`) exposes one loader per pillar so that, e.g., adding a new Memory `type` never
requires a change to `dna.yaml` or `workflows.yaml`, and vice versa. It also covers the automated
cross-pillar load test: load all four pillars, mutate one file, reload all four, and assert the other
three are unaffected.

## Acceptance Criteria

Per the SARD fit criterion (`docs/02_requirements/03_sard/01_architecture.md`, REQ-SYS-02):

> Each pillar artifact passes its own schema validation in isolation; editing one artifact and reloading
> does not raise errors in the others (automated cross-pillar load test).

Testable form:
- `memory.yaml`, `dna.yaml`, `directives/*.yaml`, and `workflows.yaml` each validate against their own
  Zod schema independently, with no cross-file schema dependency.
- An automated test that edits `memory.yaml` (e.g. adds a new `type` entry) and reloads all four
  pillars reports zero validation errors in `dna.yaml`, `directives/`, or `workflows.yaml`.

## Implementation Notes

- `spec-001-memory-yaml-schema`, `spec-002-dna-yaml-schema`, and `spec-003-workflows-yaml-schema` are
  the three independent per-pillar schemas this task must keep decoupled.
- `spec-009-validation-strategy` defines the shared two-pass (structural Zod + semantic) pipeline that
  all three schemas run through — the pipeline is shared code, but each pass is still per-artifact and
  failure in one pillar's Pass 1/2 must not block the others' loaders.
- `spec-011-storage-layout` documents the directory separation (`.wingfoil/memory.yaml` vs `dna.yaml`
  vs `directives/` vs `workflows.yaml`) this decoupling is built on.
- Related feature work in this release that this infra task unblocks (`related_stories` in
  `docs/03_backlog/04_backlog/by-release/v0.1.json`, backlog `TASK-002`): `TASK-022` "Implement Memory
  Element Schema (memory.yaml)" (memory `task-024-implement-memory-element-schema.md`) and `TASK-025`
  "Implement Project DNA (structured config)" (memory `task-027-implement-project-dna.md`).

## Execution Notes

- **start.** Branch `task/task-004-decoupled-pillars` + dedicated worktree created from `main`
  (`a47c9ca`, includes task-002's `src/validation/` and task-003's `src/storage/`). Task moved
  `backlog → in-progress`. `bug:` is empty, so `bug.sync_state` was a no-op.

- **design (architect safety net).** `spec-001-memory-yaml-schema`, `spec-002-dna-yaml-schema`,
  `spec-003-workflows-yaml-schema`, and `spec-009-validation-strategy` are all `approved` and fully
  cover this task's Implementation Notes scope (three per-pillar schemas + the shared two-pass
  pipeline they run through) — no gap found for those four, design passed straight through as
  expected.
  - **Design-gap noted, not stopped on.** The task's own Acceptance Criteria names a *fourth* pillar
    ("`memory.yaml`, `dna.yaml`, `directives/*.yaml`, and `workflows.yaml` each validate against
    their own Zod schema independently... reloads all four pillars reports zero validation errors")
    but no approved tech-spec defines the Directives pillar's own file shape —
    `spec-010-memory-frontmatter-schema`'s scope is explicitly `docs/self/docs/04_memory/**/*.md`
    (Memory documents), not `.wingfoil/directives/**`. The AC's "directives/*.yaml" phrasing is also
    literally wrong: real directive files are `.md` with YAML frontmatter, not `.yaml`. I did not
    treat this as a hard STOP because (a) this task's own Implementation Notes — the more specific,
    task-authored content — enumerate only three schemas ("spec-001, spec-002, and spec-003 are the
    three independent per-pillar schemas this task must keep decoupled"), never claiming a fourth
    approved spec exists; (b) stopping the whole task over AC wording would block delivering the
    actual REQ-SYS-02 cross-pillar isolation test, which is this task's central deliverable; (c) the
    real gap is narrow and mechanical — every one of the ten real directive files shares one flat,
    simple shape. I built `src/directives/schema.ts` (`DirectiveFrontmatter`) as an explicit
    [AUTHORING]-level minimal schema grounded in the real files (`id`, `name`, `type: directive`,
    `kind`, `title`, `tags`, `ref`) rather than any spec transcription, documented inline as such,
    and additionally traced one field's requiredness to the BDD layer:
    `p3-directives/P3.5-project-directives.feature`'s "Error - a directive file missing required
    header fields" scenario requires `name`, so `name` is required (not merely observed) in the
    schema. **Flagging for the approver:** whether to retroactively author a
    `spec-013-directive-frontmatter-schema` covering this shape formally is a decision left to the
    reviewer/approver, not made unilaterally here.
  - **Unrelated BDD/spec drift noticed while cross-checking traceability (not fixed, out of scope):**
    `p2-dna/P2.4-project-dna-config.feature` still says the DNA file "declares the sections
    `modules`, `tech_stack`, `team`, `conventions`" — spec-002 renamed `tech_stack` → `stacks` and
    removed `conventions` entirely (Consequences section). `p1-memory/P1.13-memory-element-schema.feature`
    still describes the default machine as `draft -> pending -> approved/rejected -> deprecated` —
    spec-001's Consequences section explicitly collapses this (no more `rejected` status). Both
    `.feature` files predate their respective spec's rewrite; same category of drift already noted
    against task-002 (spec-009's stale code listing). Not fixed here — updating `.feature` files is a
    spec/BDD-authoring change, out of this task's code scope.

- **red.** Wrote 7 failing suites (`test/validation/yaml.test.ts`,
  `test/{memory,dna,workflow,directives}/schema.test.ts`, `test/core/loaders.test.ts`,
  `test/core/pillar-isolation.test.ts`) against not-yet-created `src/{validation/yaml,memory/schema,
  dna/schema,workflow/schema,directives/schema,core/loaders}.ts` — genuine "cannot find module" red
  (confirmed via `npx jest`). Added `js-yaml` (`^4.3.0`) + `@types/js-yaml` as explicit dependencies:
  it was previously only an *undeclared* transitive dependency (`@istanbuljs/load-nyc-config` pulls
  `js-yaml@3.15.0`), and every pillar needs real YAML parsing (not just frontmatter-block extraction,
  which `src/storage/frontmatter.ts` already does) to turn file bytes into the data structure Zod
  validates. Running `npm install js-yaml`/`@types/js-yaml` replaced this worktree's symlinked
  `node_modules` with a real local install (npm's own behavior when installing into a symlinked
  target) — noted here since it deviates from the setup note that `node_modules` is symlinked;
  `node_modules/` stays gitignored either way, and `npx tsc`/`jest`/`eslint` all still work from it.

- **green — per-pillar schemas + loaders.**
  - `src/validation/yaml.ts` (`parseYaml`) — the shared Pass-1-step-1 YAML parse spec-009 §1
    describes, wrapping `js-yaml`'s `load` and mapping any parse failure to
    `ValidationError.yamlParse` (`E_YAML_PARSE_ERROR`, exit 2) — this is the first real caller of
    that previously-dead-code static method.
  - `src/memory/schema.ts` (`MemoryYaml`) — spec-001's `sequence`/`gates`/`waiting` `StateMachine`,
    with the "every `gates` key / `waiting` entry must be in `sequence`" and reserved-`"deprecated"`
    rules embedded as a `.superRefine()` (spec-009 §1 frames exactly this same-document cross-field
    shape as expressible inside the Zod schema, "logically Pass 2"). Validated clean against the
    real, live `docs/self/.wingfoil/memory.yaml`.
  - `src/dna/schema.ts` (`DnaYaml`) — spec-002's `Project`/`Module`/`Stacks`/`Team`/`Paths`, with the
    REQ-SYS-08 role-binding check (`team.members[].roles` / `team.agents[].executes_as` must
    reference a name in `team.roles`) as a `Team`-level `.superRefine()`. Validated clean against the
    real, live `docs/self/.wingfoil/dna.yaml`.
  - `src/workflow/schema.ts` (`WorkflowsYaml` + `Workflow`) — spec-003's Layer 1 manifest
    (`include`, canonical singular) and Layer 2 per-file DSL (phases, free-form `actions`/`checks`
    strings, `include`/`iterate_over`/`where` composition, `approval`/`fallback` gates). The two
    genuinely cross-file checks spec-003 itself calls out — `include` path must exist
    (`E_WORKFLOW_FILE_NOT_FOUND`) and at least one loaded workflow must be `kind: main`
    (`E_NO_MAIN_WORKFLOW`, REQ-STATE-03) — live in the loader (`src/core/loaders.ts`), not the schema
    module, per spec-009 §1's "Cross-file... run as caller-supplied SemanticCheck functions" guidance.
  - **Real bug found and fixed while validating the live workflow files.** Two workflow files had an
    unquoted action string shaped like `key: value`, which YAML parses as a one-key mapping instead
    of the intended plain string (`actions` must be `string[]` per spec-003):
    `docs/self/.wingfoil/workflows/custom/dev-loop.yaml`'s `done` phase (`git.merge(to: main)`) and
    `end-of-life.yaml`'s `archive` phase (`git.commit("end-of-life: archive")`). Both quoted, matching
    the convention already used elsewhere in the same files for action strings containing `:`/`{}`
    (e.g. `'bug.sync_state(where: { id: task.bug })'`). This is exactly the class of drift this
    task's schemas exist to catch.
  - `src/directives/schema.ts` (`DirectiveFrontmatter`) — see the design-gap note above.
  - `src/core/loaders.ts` — `loadMemoryYaml`/`loadDnaYaml`/`loadWorkflowsYaml`/`loadDirectives`, one
    per pillar, each independently: `storage.readDocument` (bytes) → `validation.parseYaml` (YAML) →
    `validation.runValidation` (Zod). No loader imports another pillar's schema module or reads
    another pillar's file(s) — that is the structural guarantee the cross-pillar isolation test
    exercises, not an accident of the fixture data. `loadDirectives` walks
    `.wingfoil/directives/**/*.md` (built-in + custom) sorted deterministically (REQ-SYS-07 — mirrors
    `src/storage/snapshot.ts`'s `listFilesSorted`).
  - `npx tsc --noEmit` and `npx eslint .` both clean; full `npx jest` green (132 tests, 18 suites —
    the pre-existing task-001/002/003 suites plus 8 new ones).

- **Module placement.** Followed `dna.yaml`'s `modules:` map exactly, per this task's own framing:
  `memory.yaml`'s schema → `src/memory`, `dna.yaml`'s schema → `src/dna`, `workflows.yaml`'s two-layer
  schema → `src/workflow`, the (spec-less) Directives frontmatter schema → `src/directives`
  (natural home even without a dedicated tech-spec — it's still that pillar's own file shape), and
  the per-pillar loader boundary/orchestration → `src/core` (`core`'s `dna.yaml` description: "single
  behavior behind both CLI and MCP surfaces"). `parseYaml` went into `src/validation` alongside the
  rest of the shared two-pass machinery it extends (Pass 1 step 1), not `src/storage` — storage's own
  `frontmatter.ts` already documents that "parsing that text against a type's schema is the
  validation module's job... keeping the two concerns separate."

- **Commit-scope note.** Per this task's own orchestrator instructions (not the fixed `(core)`
  convention task-002/003 used), code commits use the *actual* predominantly-touched module —
  `(validation)`, `(memory)`, `(dna)`, `(workflow)`, `(directives)`, `(core)` — rather than a
  hardcoded scope. One process slip: a broad `git add -A` early on caused the first `test(validation)`
  commit and one `feat(validation)` commit to also carry along already-written test/source files for
  other modules (visible in those commits' diffs); the commit *messages* undersell their full
  contents, but no test or source content was lost or misattributed — every file landed in the
  repository exactly once, just not always in the single most-precisely-scoped commit.

- **refactor.** Closed the one coverage gap `npx jest --coverage` found
  (`src/core/loaders.ts`'s `E_MISSING_FRONTMATTER` throw, for a `.md` file with no frontmatter block
  at all) with one more test. Whole-suite coverage: **98.86% statements / 91.87% branches / 100%
  functions / 99.4% lines** (`npx jest --coverage`, default `collectCoverageFrom`), comfortably over
  the >80% (Jest) threshold. `npx tsc --noEmit` and `npx eslint .` both clean throughout.

- **review (mechanical part).** No dedicated automated BDD runner is wired yet (same situation
  task-002/task-003 recorded — `.feature` files are contracts, not yet executable). This task instead
  targets the SARD fit criterion directly: REQ-SYS-02's own fit criterion ("Each pillar artifact
  passes its own schema validation in isolation; editing one artifact and reloading does not raise
  errors in the others (automated cross-pillar load test)") is executed literally, not paraphrased,
  by `test/core/pillar-isolation.test.ts` — it edits `memory.yaml` (adds a `note` type, the AC's own
  example), reloads all four pillars, and asserts the other three raise zero errors, plus the
  reverse for each of the other three pillars in turn. Acceptance Criteria: both bullets satisfied —
  each pillar has its own independent Zod schema with no cross-file dependency (verified by unit
  tests per schema, including against the real live config), and the cross-pillar load test asserts
  zero errors in the other three pillars after mutating any one. Task moved `in-progress → in-review`;
  approval gate + merge are the approver's, not performed here.
