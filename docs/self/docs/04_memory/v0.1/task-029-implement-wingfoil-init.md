---
id: "task-029-implement-wingfoil-init"
type: task
title: "Implement wingfoil init (P5.1.1)"
status: approved
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
`--template <name>`. Per the `sw-life-cycle` workflow's `init`→`wingfoil-init` phase (REQ-SYS-02),
`init` populates **config pillars only** (DNA, Directives,
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

- **design (no spec gap):** Verified against the three approved specs. `spec-011-storage-layout`
  fully fixes the target `.wingfoil/` tree (top-level `dna/memory/roles/workflows.yaml` +
  `directives/{built-in,custom}/`, `memory/templates/`, `workflows/{built-in,custom}/`) and the
  `detectInitState` init-marker used for the already-initialized guard; `spec-008-cli-grammar` §4
  fixes the wizard-vs-`--template` / non-interactive prompt matrix; `spec-005-cli-command-contract`
  §1 fixes exit codes (0 success / 1 logic / 2 usage). The methodology "template" (Scrum/Kanban, from
  the BDD's `e.g.`) maps to `dna.yaml` `stacks.methodologies` + a methodology-flavored delivery
  workflow — AUTHORING starter content, not a spec-mandated schema, so **no new tech-spec** required.
  Build on task-018's `initStorage(root, files, message)` (its `files` override was left for exactly
  this) rather than writing a second commit path.

- **red/green:** Added `src/storage/templates.ts` (methodology templates Scrum/Kanban → complete
  28-file spec-011 layout, deterministic), `src/core/init.ts` `initWingfoilProject` (git-repo →
  already-initialized guard → template → identity → single-commit write), and `src/cli/init-command.ts`
  `runInit` (spec-008 §4 prompt matrix with an injectable wizard prompt) wired as a dedicated `init`
  command in `program.ts`. No spec gap; the "template" is AUTHORING starter content. Tests: 21 new
  (storage/core/cli). One self-inflicted test fix (fresh repo has no `HEAD` → assert post-init commit
  count == 1). `createReadlinePrompt` left uncovered by design (same un-unit-tested seam as the
  `commander` wiring). End-to-end drive of the built `dist/cli.js` confirmed all three ACs.
- **review:** `tsc --noEmit` exit 0; `jest` 416/416 green; new-code line coverage ≥80% (templates 100%,
  core init 94%, init-command 87%). `init` deliberately NOT added to `CORE_MODULES` (it is a
  pre-config bootstrap command), so the REQ-SYS-05 parity invariant is untouched.
