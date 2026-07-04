---
id: "task-002-validation-id-engine"
type: task
title: "Zod validation pipeline + ID generation engine"
status: in-review
release: "v0.1"
priority: "Blocker"
tags: ["v0.1"]
ref: "spec-009-validation-strategy"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

Implements the shared `src/validation` module defined by `spec-009-validation-strategy`: the
two-pass Zod pipeline (`runValidation()` in `src/validation/two-pass.ts` — structural Pass 1, then
semantic/cross-field Pass 2 only if Pass 1 succeeds), the `.passthrough()` unknown-field warning
(`emitUnknownFieldWarning`, diffed against each schema's declared `shape`, per spec-009 §2), the
shared `E_*` error-code mapper (`toValidationError`, spec-009 §3), and the ID-generation engine that
produces IDs conforming to each Memory type's `id_pattern` in `memory.yaml`. This module is the
single validation entry point every other v0.1 task must call when it reads or writes
`memory.yaml`, `dna.yaml`, `workflows.yaml`, or any Memory document's frontmatter — spec-009's
Context section is explicit that without one shared module, `spec-001/002/003`'s schemas would each
reinvent parsing, error-code naming, and unknown-field handling.

## Acceptance Criteria

- `runValidation()` implements the two-pass model exactly as specified in spec-009 §1: Pass 1
  (Zod `schema.safeParse`) failures are fatal and collect all `ZodError.issues` (not just the
  first); Pass 2 semantic checks execute only when Pass 1 succeeds, and never otherwise.
- The unknown-field warning diffs the *raw* input keys against the schema's declared `shape` (not
  against the `.passthrough()`-parsed output), reproducing the "Correct mechanism" in spec-009 §2 —
  the known-defective raw-vs-parsed diff described there must not appear in the implementation.
- Error mapping follows spec-009 §3's three code families exactly: `E_INVALID_<SCHEMA>_SCHEMA` for
  whole-document Pass-1 failures, `E_INVALID_<X>` for named field/constraint failures, and
  `E_YAML_PARSE_ERROR` for pre-parse YAML failures — with the documented exit codes (`2` for
  parse/cross-field-integrity failures, `1` for mapped/generic validation failures).
- Any Zod issue with no `ErrorMap` entry for its dot-path falls back to `E_VALIDATION`, per
  spec-009 §3's generic-fallback rule — no failure is silently dropped.
- ID generation produces IDs matching each type's `id_pattern` from `memory.yaml` (e.g.
  `task-{nnn}-{slug}`), and rejects any literal pattern character outside `[a-z0-9-.]`.
- Unit tests cover both passes independently (Pass 2 never invoked when Pass 1 fails) and the
  unknown-field warning against a schema with genuinely unknown keys.

## Implementation Notes

- This module is a dependency of `spec-001-memory-yaml-schema`, `spec-002-dna-yaml-schema`,
  `spec-003-workflows-yaml-schema`, and the not-yet-authored Memory-frontmatter schema spec, per
  spec-009's Context and Consequences sections — do not let any of those schemas call
  `schema.safeParse()` directly or duplicate parsing/error-mapping logic per-schema.
- Every schema consuming this module must be built as `.passthrough()` (spec-009 Consequences),
  since the unknown-field warning depends on `.passthrough()` semantics to preserve unknown keys.
- Depends on `task-001-nodejs-typescript-scaffold` for the base TypeScript/Jest project the module
  is built and tested in.

## Execution Notes

- **start.** Branch `task/task-002-validation-id-engine` + dedicated worktree created from `main`
  (forced `task/`-prefix + worktree convention, per dev-loop plan §2 / dl-014 G1–G2). Task moved
  `backlog → in-progress`. `bug:` is empty, so `bug.sync_state` was a no-op.

- **design (architect safety net).** No new tech-spec authored — design passed straight through, as
  the plan expected. The task's `ref: spec-009-validation-strategy` (`approved`) literally specifies
  the two-pass pipeline, passthrough-warning, and `E_*` error mapper (with code listings). The one
  part spec-009 does not itself detail — the ID-generation engine — needs no new spec because
  (a) `memory.yaml` already declares every type's `id_pattern` literally, (b) spec-009 §1 already
  anchors the `[a-z0-9-.]` ID character class as a Pass-2 rule owned by "the shared ID constants",
  and (c) `memory.yaml` explicitly declares numbering/padding "an ID-generation-engine detail, not
  fixed here". ID generation is therefore mechanical pattern-matching against already-declared
  patterns, not a new design decision.

- **red.** Wrote 4 failing suites under `test/validation/` (28 tests): `two-pass` (Pass-2 never runs
  when Pass 1 fails — asserted with a `jest.fn()` call-count spy, not just output; all Zod issues
  collected; warning fires after Pass 1 and before Pass 2), `warning` (the known-defective trap —
  see below), `error-mapper` (three `E_*` families + `E_VALIDATION` fallback + exit codes 1/2), and
  `id` (each `memory.yaml` id_pattern renders to its expected ID + rejects invalid pattern chars).
  Suites failed to resolve the not-yet-created modules — genuine red.

- **green.** Implemented `src/validation/{errors,error-mapper,warning,two-pass,id}.ts` + a barrel
  `index.ts`, matching spec-009's listings.
  - `two-pass.ts`/`warning.ts`/`error-mapper.ts` follow spec-009 §1/§2/§3 verbatim in behavior.
  - **Deviation (Zod 4 API).** spec-009's listings type the schema as `ZodSchema<T>` / `AnyZodObject`,
    both of which `zod@4.4.3` (the version pinned in `dna.yaml`/`package.json`) no longer exports.
    Used `ZodType<T>` for `runValidation` and a minimal structural `HasShape = { shape: Record<...> }`
    for `emitUnknownFieldWarning` — same runtime behavior (`schema.safeParse`, `Object.keys(schema.shape)`),
    version-robust, and no `any` (eslint `no-explicit-any` is an error here).
  - **Known-defective trap (spec-009 §2).** `emitUnknownFieldWarning` diffs raw keys against
    `schema.shape` (the schema's declared key set), NOT against the `.passthrough()`-parsed object.
    `warning.test.ts` proves the avoidance: it parses a `.passthrough()` schema, shows the *defective*
    `Object.keys(raw).filter(k => !(k in parsed))` diff is `[]` (passthrough copied the unknown key
    onto `parsed`), then asserts the correct implementation still emits the warning naming the unknown
    key. That test would fail if the raw-vs-parsed diff were ever reintroduced.
  - **ID engine location.** Placed at `src/validation/id.ts` (not `src/core`) because spec-009 §1
    co-locates the id character-class rule with the validation module; `ID_CHAR_CLASS` is exported
    from here as the single source of truth a future Pass-2 id_pattern check will also consume.
    `generateId(pattern, values)` is pattern-driven (caller supplies the pattern read from
    `memory.yaml`); it does not itself parse `memory.yaml` — that stays the memory-config-loader
    task's job. Padding: numeric `{n}` tokens zero-pad to `max(3, tokenWidth)` (→ `task-002`,
    `spec-009`), never truncating wider numbers. Bad pattern literals → `E_INVALID_ID_PATTERN_CHARS`
    (exit 2, per §1's Pass-2 classification); bad/missing values → `E_INVALID_ID` (exit 1).
  - `npm install && npm run build && npm test && npm run lint` all green.

- **refactor.** Added 4 id-engine edge tests (missing token value, negative number, non-numeric
  value, leading-hyphen slug hitting the final pattern safety net) to exercise the value-rejection
  branches. Coverage over `src/validation/**` (default `collectCoverageFrom: src/**/*.ts` minus
  `index.ts` picks it up): **98.29% stmts, 89.83% branch, 100% funcs, 98.23% lines** — all above the
  80% threshold; the two-pass branches (Pass-1-fail-skips-Pass-2, warning fire/no-fire, each error
  family, ID match/reject) are all exercised. Remaining uncovered lines are trivial defensive
  fallbacks (empty-issues message, `?? []` default).

- **review (mechanical part).** No dedicated validation `.feature` file exists — `src/validation` is
  a shared internal module, not a CLI-surface feature, so no BDD acceptance suite targets it directly
  (and there is no BDD runner wired yet — the `.feature` files are contracts, not executable). The
  related scenarios are owned by the *consuming* schema tasks that call this module: P2.4 "malformed
  YAML in the DNA file" → this module's `E_YAML_PARSE_ERROR`/exit-2 family; P1.13 "transition
  references an undeclared state" → a Pass-2 `E_INVALID_*` semantic check run via `runValidation`;
  P4.1 "unknown workflow kind" → a field-level `E_INVALID_*`. Those wirings land in spec-001/002/003's
  own tasks. Commit scope choice: code commits use the `core` module scope (dna.yaml has no
  `validation` module entry; `src/validation` is cross-cutting shared logic that `core` best fits).
  Task moved `in-progress → in-review`; approval gate + merge are the approver's, not performed here.
