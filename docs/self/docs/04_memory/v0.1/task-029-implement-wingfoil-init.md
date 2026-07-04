---
id: "task-029-implement-wingfoil-init"
type: task
title: "Implement wingfoil init (P5.1.1)"
status: backlog
release: "v0.1"
priority: "Critical"
tags: ["v0.1", "interaction"]
ref: "P5.1.1"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

As Alex, I want to initialize WingFoil with an interactive wizard (`wingfoil init`) with methodology
template selection so that I can configure the project in minutes without manual YAML editing
(US-0A-06, feature P5.1.1). This task implements `wingfoil init`: it bootstraps the `.wingfoil/`
directory layout at the git root (per `spec-011-storage-layout.md`) — `dna.yaml`, `memory.yaml`,
`roles.yaml`, `workflows.yaml`, `directives/{built-in,custom}/`, `memory/templates/`,
`workflows/{built-in,custom}/` — either via an interactive wizard (TTY) or non-interactively via
`--template <name>`. Per CLAUDE.md §6, `init` populates **config pillars only** (DNA, Directives,
Workflow) — it never creates Memory **content** (no task/ADR/release files); that is `seed-first-
release-line`'s job, run later in the lifecycle.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p5-interaction/P5.1.1-init.feature`:

- **Initialize with the wizard and a selected template**: `wingfoil init` (in a git repo with no
  `.wingfoil/` yet), selecting e.g. "Scrum" through the wizard, creates a complete `.wingfoil/` structure
  (dna, memory, directives, workflows) with no manual YAML editing required, and exits `0`.
- **Initialize non-interactively via flag**: `wingfoil init --template Kanban` initializes the project
  with the "Kanban" template without prompting.
- **Error — initializing an already-initialized project**: running `wingfoil init` when `.wingfoil/`
  already exists overwrites nothing and exits `1` with `error: WingFoil already initialized (use a
  migration command to change config)`.

## Implementation Notes

- Root/init-marker detection (`findGitRoot`, `detectInitState` → `absent`/`incomplete`/`initialized`)
  and the exact target directory layout to produce follow
  `docs/self/docs/04_memory/design/specs/spec-011-storage-layout.md`.
- Interactive-prompt behaviour (TTY wizard vs. non-interactive `--template`/`--no-interactive` failure)
  follows the prompt-rules matrix in
  `docs/self/docs/04_memory/design/specs/spec-008-cli-grammar.md` §4; exit codes/error format follow
  `docs/self/docs/04_memory/design/specs/spec-005-cli-command-contract.md`.
- The v0.1 scope is the wizard + `--template` param mode only; agent-assisted natural-language setup
  (P5.4.5) and `--template {name}` as its own standalone CLI flag refinement land later (v0.4/v0.3 per
  `docs/01_vision/06_features.md`).
- Depends on `task-001-nodejs-typescript-scaffold` and `task-004-decoupled-pillars` (each pillar's config
  must be independently loadable/writable) as prerequisites; produces the `.wingfoil/dna.yaml` structure
  that `task-025`–`task-028` operate on.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
