---
id: "task-062-typedoc-tsdoc-backfill"
type: task
title: "TypeDoc/TSDoc backfill + flip docs.api.* review gate to hard-reject (dl-014)"
status: in-review
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "docs"]
ref: "dl-014-dev-loop-plan-deltas"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

Carry the **dl-014 B-DECISION Option 2** deferred work: backfill TSDoc across all existing v0.1 public exports, wire TypeDoc + doc-coverage tooling, then flip the `dev-loop` review-gate checks `docs.api.public-complete` / `docs.api.build` from **warn** to **hard-reject** once green.

## Acceptance Criteria

Acceptance:
- Every public/exported symbol in `src/` carries TSDoc; `typedoc` builds clean.
- Doc-coverage tooling wired into the `refactor.checks.post` gate.
- `docs.api.*` checks flipped from warn to hard-reject (`dev-loop.yaml`); the `documentation` directive updated accordingly.
- Suite green, `tsc` 0.

## Implementation Notes

Source: `dl-014` B-DECISION Option 2 (staged posture recorded in the config-bootstrap). Until this lands, `docs.api.*` stay warn-only so v0.2 dev-loops are not blocked from day one. TypeDoc is now in `dna.yaml` stacks.

## Execution Notes

### design (architect) — 2026-07-09

**AC classification (T1, `dl-014` + testing directive):**

| AC | Classification | Rationale |
|----|----------------|-----------|
| AC1 — every public/exported symbol carries TSDoc; `typedoc` builds clean | **red-first** | A doc-coverage check that FAILS today (undocumented exports exist) and PASSES only after the backfill — a real behavioural delta a failing test can capture. |
| AC2 — doc-coverage tooling wired into `refactor.checks.post` (npm script + asserted by a test/check) | **red-first** | Same failing→passing check; the test asserting the gate succeeds fails today (no `typedoc`, undocumented exports). Folded into the one AC1/AC2 doc-coverage test. |
| AC3 — flip `docs.api.*` from warn to hard-reject in `dev-loop.yaml` + update `documentation` directive | **characterization / config** | Edits to workflow config + a directive doc, not runtime code; verified by inspection, applied in `refactor` per the plan's staged-check ramp. No failing unit test to fabricate. |
| AC4 — suite green, `tsc -p tsconfig.build.json` = 0, coverage ≥ 80% | **characterization** | Standing project invariants (already true), re-verified in `refactor`; not a new red test. |

The single enforceable **red-first** piece is the doc-coverage check (AC1+AC2): a Jest test that runs
TypeDoc with `validation.notDocumented: true` + `treatWarningsAsErrors: true` and asserts exit 0. It
fails now (48 undocumented top-level exports) and passes after the TSDoc backfill.

**`depends_on` (`dl-015`):** `[]` — no upstream task Execution Notes to read; no `agent.read_related`
gate to clear.

**Spec verification (`agent.verify_specs`):** No new `tech-spec` needed. Scope (docs tooling +
TSDoc-backfill + gate flip) is already decided by **`dl-014` B-DECISION Option 2** (the staged
`docs.api.*` ramp this task closes) and the API-docs gate defined in **`dl-013`** — both `ready`. `ref`
is `dl-014`. `design` passes through with **no approver gate** (no new spec scaffolded).

**Gate design decision (altitude):** TypeDoc's default `notDocumented` validation descends into every
property, including the ~295 anonymous properties of Zod `z.infer<>` object types (e.g.
`Workflow.__type.phases.__type.name`) — impractical and unmaintainable to hand-TSDoc, since the Zod
schema is their source of truth. The gate is therefore scoped to **exported declarations** via
`requiredToBeDocumented: [Enum, Variable, Function, Class, Interface, TypeAlias, CallSignature]` (drops
`Property`/`Method`), which matches the spirit of "every public/exported symbol carries TSDoc" at the
declaration level and is the standard TypeDoc "document the public API" pattern. `entryPointStrategy:
expand` over `src/` still validates **every file's** exported declarations (not just the barrels).
`disableSources`/`readme: none` keep the run deterministic and warning-free apart from real coverage
gaps. `invalidLink` validation is left off to keep this task scoped to doc *coverage* (pre-existing
cross-module `{@link}` targets to non-exported symbols are a separate concern).

No approver gate: `design` passed through (no new spec).

### red (developer) — 2026-07-09

Installed **`typedoc@0.28.20`** (`--save-dev`; TypeScript 6.0.3). Added `typedoc.json` (the gate config:
`entryPointStrategy: expand` over `src/`, `tsconfig.build.json`, `validation.notDocumented: true`,
`treatWarningsAsErrors: true`, `requiredToBeDocumented` = exported-declaration kinds, `emit: none`,
`disableSources`/`readme: none` for a deterministic, warning-free run apart from real gaps) and
`test/docs/api-docs.test.ts` (spawns the exact `typedoc --options typedoc.json` invocation
out-of-process and asserts exit 0). The test **failed** as required — **48** undocumented exported
declarations across `src/`. Verified the gate actually catches gaps by injecting a throwaway
undocumented export (caught) before removing it. `test(docs)` commit.

### green (developer) — 2026-07-09

Backfilled TSDoc on all **48** previously-undocumented exported declarations, across **21 source
files**: `cli/{error,exit,output,program,registrar}.ts`, `core/{index,registry,types}.ts`,
`directives/schema.ts`, `dna/schema.ts` (7 Zod schema const+type pairs), `workflow/schema.ts` (`Phase`),
`validation/{error-mapper,two-pass,warning}.ts`, `memory/git-log.ts`, and
`mcp/{index,registrar,dna-resource,memory-resource,workflow-resource}.ts` (the `Register*Options`
option bags + their `resolveRoot`). Comments match the existing altitude/style and cite the same
specs/tasks the surrounding code does; no fabricated behaviour. Added the `docs:api` npm script +
`typedoc` devDependency. Gate now clean (`typedoc` exit 0), `npm run docs:api` exit 0, **full suite
549/549 green**. `feat(docs)` commit (source + `package.json`/`package-lock.json`).

### refactor (developer) — 2026-07-09

Flipped the staged check to active: `dev-loop.yaml` `refactor.checks.post` `docs.api.*` annotation and
the `documentation` directive now state the checks **enforce as hard-reject** (closing the `dl-014`
B-DECISION Option 2 warn/new-code-only ramp). No `version:` bump on the `documentation` directive —
no custom directive file carries a `version:`/date field, and the `doc-versioning` directive applies
only to docs that carry one; adding one would break the established convention. `dev-loop.yaml`
`version` left at 1.1 (this is the planned activation the v1.1 annotation already anticipated, not a
new workflow revision). Verified: `tsc -p tsconfig.build.json` exit **0**, `npm run test:coverage`
**97.91% branches / 98.33% lines** (≥ 80), suite green, `docs.api` build + public-complete pass.
`refactor(docs)` commit.

### review (reviewer) — 2026-07-09

No dedicated BDD `.feature` exists for this docs-tooling task (`ref: dl-014`); the executable
acceptance surface is the full Jest suite (**549/549 passing**), which now includes the doc-coverage
gate test. Final numbers: `tsc` = 0, coverage 97.91% br / 98.33% ln, `npm run docs:api` = 0. All four
ACs met (AC3/AC4 verified by inspection + the checks above). Task moved `in-progress → in-review`.

**Out-of-scope note for reviewer/approver:** `npx eslint .` reports one **pre-existing**
`@typescript-eslint/no-require-imports` error in `test/storage/git-backed-storage.test.ts:90` (a file
this task never touched; present on the branch base). Not fixed here — eslint is not part of the
`dev-loop` `refactor` gate and the issue is unrelated to task-062. Candidate for a follow-up
lint-hygiene bug.
