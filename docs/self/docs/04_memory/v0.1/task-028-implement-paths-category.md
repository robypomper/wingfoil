---
id: "task-028-implement-paths-category"
type: task
title: "Implement wingfoil paths [category] (P2.5)"
status: pending
release: "v0.1"
priority: "High"
tags: ["v0.1", "dna"]
ref: "P2.5"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

As Alex, I want to query resource paths by category (`wingfoil paths sources/tests/docs/config/
governance`) with drill-down and console/json/yaml output so that I confirm all resources are mapped for
agent navigation (US-0A-22, feature P2.5). This task implements the `wingfoil paths [category]` CLI
command: it reads the `paths` section of the parsed DNA structure (task-027's loader), lists the entries
for a given category (`sources`, `tests`, `docs`, `config`, `governance` — the fixed category names per
`X_cli-cmds.md`), supports `--list` drill-down, and renders in `console`/`json`/`yaml` per the shared
output-format contract.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p2-dna/P2.5-paths.feature`:

- **List paths for a category**: `wingfoil paths sources --list` outputs `src/` (per DNA's `paths.sources`
  mapping) and exits `0`.
- **Output formats are supported**: `wingfoil paths sources --format <console|json|yaml>` produces valid
  output in each of the three formats.
- **Error — querying an undefined category**: `wingfoil paths governance` when no `governance` category
  is mapped in DNA exits `1` with `error: no paths mapped for category 'governance'`.

## Implementation Notes

- Reads the `Paths` node of the `DnaYaml` schema (`sources`, `tests`, `docs`, `config`, `governance`,
  each an optional `string[]`, `.passthrough()` for future categories) as defined in
  `docs/self/docs/04_memory/design/specs/spec-002-dna-yaml-schema.md` §"Categories (P2.5)".
- `--format console|json|yaml` envelope rules and the read-only exit-code restriction (`0`/`1` only, no
  `2` once parsing succeeds) follow
  `docs/self/docs/04_memory/design/specs/spec-005-cli-command-contract.md`; invocation grammar follows
  `docs/self/docs/04_memory/design/specs/spec-008-cli-grammar.md`.
- `docs/self/.wingfoil/dna.yaml`'s own `paths:` block (`sources: [src/]`, `tests: [test/]`, `docs: [...]`,
  `config: [...]`, `governance: [docs/self/.wingfoil/]`) is the reference fixture this command must query
  correctly.
- Depends on `task-001-nodejs-typescript-scaffold`, `task-002-validation-id-engine`, and
  `task-027-implement-project-dna` (the DNA loader/schema this command queries) as prerequisites.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
