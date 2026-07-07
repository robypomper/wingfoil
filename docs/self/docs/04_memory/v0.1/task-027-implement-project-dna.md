---
id: "task-027-implement-project-dna"
type: task
title: "Implement Project DNA (structured config) (P2.4)"
status: in-progress
release: "v0.1"
priority: "Critical"
tags: ["v0.1", "dna"]
ref: "P2.4"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

As Alex, I want a structured project map (modules, tech stack, conventions, team) in `.wingfoil/dna.yaml`
so that humans and agents have a shared anatomy (US-0A-05, feature P2.4). This task is the shared
infrastructure task underlying the whole DNA pillar: implement the `DnaYaml` Zod schema and loader that
parses/validates `.wingfoil/dna.yaml` at load time (`project`, `modules`, `stacks`, `team`, `paths`),
exposes it as the single structure both `dna set`/`dna show` (task-025/026), `wingfoil paths`
(task-028), and — later — the MCP `wingfoil://dna` Resource (task-030) all consume, so the CLI and MCP
surfaces cannot drift (REQ-SYS-05). `docs/self/.wingfoil/dna.yaml` is the live, hand-authored worked
example this schema must validate.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p2-dna/P2.4-project-dna-config.feature`:

- **DNA file exists and is schema-valid after init**: validating `.wingfoil/dna.yaml` passes, and the
  file declares the sections `modules`, `tech_stack` (now `stacks`), `team`, `conventions` (now relocated
  per spec-002, see notes below).
- **Agents read DNA as the authoritative project map**: given a module (e.g. `billing`) listed in
  `.wingfoil/dna.yaml`, an agent requesting the project module map gets that module back in the parsed
  structure.
- **Error — malformed YAML in the DNA file**: loading a `.wingfoil/dna.yaml` with invalid YAML syntax
  fails with `invalid DNA: YAML parse error at line <n>`.

## Implementation Notes

- Implement exactly the `DnaYaml` Zod schema pinned in
  `docs/self/docs/04_memory/design/specs/spec-002-dna-yaml-schema.md` — `.passthrough()` on every node
  (forward-compat), `stacks.technologies`/`stacks.methodologies` as flat generic lists (not the BDD's
  legacy fixed-key `tech_stack`), `team.roles` as the canonical role registry (REQ-SYS-08), and no
  top-level `conventions` field (its former values now live in `directives/custom/`, per spec-002
  Consequences table).
- Directory/root-detection rules (where `.wingfoil/dna.yaml` must live, git-root walk-up, init-marker
  check) follow `docs/self/docs/04_memory/design/specs/spec-011-storage-layout.md`.
- `docs/self/.wingfoil/dna.yaml` is the authoritative worked example/fixture for schema tests — the
  loader must accept it as-is.
- Depends on `task-001-nodejs-typescript-scaffold` and `task-002-validation-id-engine` as prerequisites;
  `dna set`/`dna show`/`paths` (task-025/026/028) and the MCP DNA Resource (task-030) all depend on this
  task's loader/schema landing first.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
