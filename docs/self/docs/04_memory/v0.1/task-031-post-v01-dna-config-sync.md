---
id: "task-031-post-v01-dna-config-sync"
type: task
title: "Post-v0.1 dna.yaml config sync"
status: backlog
release: "v0.1"
priority: "High"
tags: ["v0.1", "dna"]
ref: "spec-002-dna-yaml-schema"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

`docs/self/.wingfoil/dna.yaml` was hand-authored before any v0.1 code existed, so several of its
entries are declared as aspirational (`paths.sources`/`paths.tests`/`paths.config` are explicitly
commented `# planned`, and `stacks.technologies` lists Commander.js/chalk/MCP SDK/Anthropic SDK/Zod/
Jest as intended dependencies rather than confirmed ones). Once `task-025-implement-dna-set`,
`task-026-implement-dna-show`, and `task-027-implement-project-dna` land — the `wingfoil dna set`/
`wingfoil dna show` commands and the `DnaYaml` schema loader itself — this task reconciles the live
`dna.yaml` against what was actually built during v0.1: the real `src/` module layout (`task-001`),
the dependencies actually added to `package.json`, and the resource paths that materialized (`src/`,
`test/`, `package.json`, `tsconfig.json`). The goal is to remove every `# planned` marker that is now
true and correct any entry that drifted from the as-implemented shape, so `dna.yaml` stops being a
forward-looking plan and becomes a truthful map of the repository, per spec-002's framing of `dna.yaml`
as "a structural map of the project ... that lets humans and agents navigate the project without full
codebase scans."

## Acceptance Criteria

- `docs/self/.wingfoil/dna.yaml` parses and validates against the `DnaYaml` Zod schema defined in
  `spec-002-dna-yaml-schema.md` (required top-level fields `version`, `modules`, `stacks`, `team`,
  `paths`; `stacks.technologies[]` entries shaped `{name, category, version?, notes?}`).
- `modules[]` matches the actual `src/` directory tree produced by `task-001` — no module listed that
  doesn't exist on disk, no implemented module missing from the list.
- `stacks.technologies[]` reflects the dependencies actually declared in `package.json` after v0.1
  (Commander.js, chalk, MCP SDK, Anthropic SDK, Zod, Jest — confirmed present, or removed/adjusted if
  the implementation diverged).
- `paths.sources`, `paths.tests`, `paths.config` no longer carry the `# planned` comment — each entry
  points at a real, existing path (`src/`, `test/`, `package.json`, `tsconfig.json`), or is corrected
  to whatever path was actually used.
- `team.roles`/`team.members` still match the canonical role catalogue (`developer, reviewer, qa,
  architect, product-owner, tech-lead, facilitator, approver`) — unchanged unless v0.1 delivery
  revealed a gap in the role set.
- `wingfoil dna show` (once implemented per `task-026`) renders the reconciled file without schema
  errors.

## Implementation Notes

- This is a **gating/closing task**: it must run near the end of v0.1, after `task-025`, `task-026`,
  `task-027` (DNA commands + schema) and ideally after most of the rest of the v0.1 backlog, since it
  depends on the real module/dependency/path shape existing to sync against — syncing early would just
  reintroduce the same "aspirational config" problem it's meant to fix.
- Do not remove or rename any `[SPEC]`-tagged field/value without first checking it against
  `spec-002-dna-yaml-schema.md`'s Consequences section (e.g. `team.roles` is load-bearing for
  REQ-SYS-08 role-name validation and must not be dropped even if unused this release).
- Keep the `[SPEC]`/`[AUTHORING]` inline provenance comments intact when editing — this task updates
  values, not the annotation convention.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
