---
id: "task-026-implement-dna-show"
type: task
title: "Implement wingfoil dna show (P2.2)"
status: backlog
release: "v0.1"
priority: "Critical"
tags: ["v0.1", "dna"]
ref: "P2.2"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

As Jordan, I want to query and display project DNA with `wingfoil dna show` so that I understand the
team architecture (US-3-03, feature P2.2). This task implements the read-only `wingfoil dna show
[section]` CLI command: with no argument it prints the full parsed `.wingfoil/dna.yaml` structure
(`project`, `modules`, `stacks`, `team`, `paths`); with a `section` argument (e.g. `tech_stack`/`stacks`,
`team`) it prints only that subtree. It is the query counterpart to `dna set` (task-025) and must never
mutate the file.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p2-dna/P2.2-dna-show.feature`:

- **Display the full DNA**: `wingfoil dna show` output includes tech stack, modules, conventions, and
  team sections, and the query returns in under 1 second.
- **Display a single DNA subtree**: `wingfoil dna show tech_stack` prints only that subtree.
- **Error — requesting a non-existent key**: `wingfoil dna show nonexistent_section` exits `1` with
  `error: no DNA key named 'nonexistent_section'` (a read-only command can only exit `0`/`1`, never `2`,
  per the exit-code contract).

## Implementation Notes

- Reads and displays the same `DnaYaml` structure defined in
  `docs/self/docs/04_memory/design/specs/spec-002-dna-yaml-schema.md`; the schema renamed the BDD's
  `tech_stack`/`conventions` wording to `stacks` (technologies + methodologies) — `conventions` no
  longer exists as a top-level section (moved to `directives/custom/`, per spec-002 Consequences), so
  the command should resolve `tech_stack` as an alias for `stacks` for BDD compatibility.
- Output-format switching (`--format console|json|yaml`) and the sub-1-second latency budget follow
  `docs/self/docs/04_memory/design/specs/spec-005-cli-command-contract.md`; invocation grammar (bare
  positional `section` argument, global flags) follows
  `docs/self/docs/04_memory/design/specs/spec-008-cli-grammar.md`.
- Depends on `task-001-nodejs-typescript-scaffold` and `task-002-validation-id-engine` as prerequisites,
  plus a shared DNA loader (introduced alongside task-025/task-027) that both `dna set` and `dna show`
  reuse rather than each re-implementing YAML parsing.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
