---
id: "task-025-implement-dna-set"
type: task
title: "Implement wingfoil dna set (P2.1)"
status: in-progress
release: "v0.1"
priority: "Critical"
tags: ["v0.1", "dna"]
ref: "P2.1"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

As Alex, I want to define/update project DNA with `wingfoil dna set` so that I can set initial modules,
stack, and conventions without hand-editing YAML (US-0A-08, feature P2.1). This task implements the
`wingfoil dna set <dotted.key.path> <value>` CLI command: it resolves a dotted key path (e.g.
`stacks.technologies.0.version` or a top-level section like `project.name`) against the parsed
`.wingfoil/dna.yaml` structure, writes the new value, re-serializes the file, and commits the change to
git. This is the only *mutating* entry point into DNA — `dna show` (task-026) is read-only, and the
`paths`/init commands depend on this command's write path existing first.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p2-dna/P2.1-dna-set.feature`:

- **Set a DNA field**: `wingfoil dna set tech_stack.language python` writes `language: python` under
  the target section in `.wingfoil/dna.yaml`, commits the change to git, and exits `0`.
- **Update an existing DNA field**: setting a key that already has a value overwrites it in place
  (idempotent write, no duplicate keys).
- **Error — invalid dotted key path**: `wingfoil dna set ..language python` leaves `.wingfoil/dna.yaml`
  unchanged and exits `2` with `error: invalid key path: '..language'` (usage error, per the exit-code
  contract below).

## Implementation Notes

- The written file must validate against the `DnaYaml` Zod schema in
  `docs/self/docs/04_memory/design/specs/spec-002-dna-yaml-schema.md` — a `dna set` that would produce
  a schema-invalid file must be rejected before the write is persisted.
- Exit codes / `--format`/error-message shape follow
  `docs/self/docs/04_memory/design/specs/spec-005-cli-command-contract.md` (invalid key path is a usage
  error → exit `2`; a value that fails schema validation is a logic error → exit `1`).
- Invocation grammar (`wingfoil dna set <path> <value>`, global flags position, element-ref conventions)
  follows `docs/self/docs/04_memory/design/specs/spec-008-cli-grammar.md`.
- Depends on `task-001-nodejs-typescript-scaffold` (TS/Node project scaffold) and
  `task-002-validation-id-engine` (shared validation plumbing) as prerequisites.
- The live worked example of the target schema is `docs/self/.wingfoil/dna.yaml` itself (note its
  `stacks.technologies`/`stacks.methodologies` list shape, not a fixed `tech_stack` object — the BDD
  scenario's `tech_stack.language` phrasing predates the spec-002 schema rename to `stacks`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
