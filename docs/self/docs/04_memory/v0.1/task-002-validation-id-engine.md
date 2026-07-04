---
id: "task-002-validation-id-engine"
type: task
title: "Zod validation pipeline + ID generation engine"
status: in-progress
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

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
