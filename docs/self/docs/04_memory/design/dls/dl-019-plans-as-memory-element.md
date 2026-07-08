---
id: "dl-019-plans-as-memory-element"
type: decision-log
title: "Treat phase plans (docs/05_plans/) as a first-class Memory element type"
status: in-discussion
context: "process"
release: "v0.1"
tmpl_version: 260703
---

## Context

The project follows an interim rule for the not-yet-built workflow engine (Workflow pillar, **P4**):
whenever a workflow (main or sub) is started, the agent first writes a plan file under `docs/05_plans/`
that is coherent with the workflow's phases, roles, `actions`, `produces:`, and `checks`, then executes
against that plan. This is not incidental scaffolding — every phase of `sw-life-cycle` executed so far (`init`,
`initial-design`, each `release-cycle` iteration, and now `retrospective`) has produced or consumed a
plan file, and those plans are what an agent actually reads to resume work across sessions.

Despite that load-bearing role, `plan` is not a Memory element. `memory.yaml` declares exactly seven
types — `release-line, release, task, adr, decision-log, tech-spec, bug` — and `plan` is not one of
them; `docs/05_plans/` is not referenced anywhere in `.wingfoil/` config. Concretely, existing files
under `docs/05_plans/` (e.g. `X_wingfoil-init-plan.md`, `X_initial-design-plan.md`, and the per-release
plans) are plain Markdown with no YAML frontmatter, no `id`, no `version`, no `status`, and no lifecycle
— so a plan cannot be queried, versioned, or state-checked the way every other artifact in the project
can (P1.13). This gap surfaced concretely while assembling `retro-v0.1`: the retrospective needed to
enumerate "which plans exist for v0.1 and are they done", and the only way to answer that was to read
each plan file's prose by hand — there is no frontmatter field to grep.

## Decision

*(in-discussion — proposed, not yet ratified)* Make `plan` a first-class Memory element type, on par
with the existing seven, rather than leaving `docs/05_plans/` as informal scaffolding.

Concretely:
- **`memory.yaml`**: add a `plan` type entry —
  ```
  plan:
    path: "docs/05_plans/{workflow}/{id}.md"     # keep existing rl-v1/rel-v0.1/... nesting
    id_pattern: "plan-{workflow}-{phase}"
    name: "Phase plan"
    description: "Interim substitute for the not-yet-built workflow engine (Workflow pillar P4): the
      executable plan for one workflow phase."
    tags: [process, workflow]
    template:
      file: ".wingfoil/memory/templates/plan.md"
      frontmatter:
        required: [id, type, title, status, version, workflow, phase]
    states:
      sequence: [draft, active, done]
      waiting: [active]          # active → done fires once the phase's produces:/checks are satisfied
      # deprecated / superseded reachable via memory.deprecate from any state
  ```
  This is an **[AUTHORING]** field/type — no spec in `docs/01_vision/` or `docs/02_requirements/`
  mandates a `plan` Memory type; this DL is its provenance, per the `dna.yaml`/`memory.yaml`
  `[SPEC]`/`[AUTHORING]` field-provenance convention declared in those files' own headers.
- **New template** `.wingfoil/memory/templates/plan.md`: frontmatter skeleton (`id`, `type: plan`,
  `title`, `status`, `version`, `workflow`, `phase`, `element`, `release`) plus a body skeleton
  (Context / Phases / Handoff) matching the shape existing plans already use ad hoc.
- **Workflow wiring**: in `workflows.yaml` and the relevant sub-workflow files, make the §6-interim
  "write a plan file" step an explicit `memory.add(type: plan)` action bound to the phase that
  currently produces it (e.g. `initial-design`, each `release-planning`/`dev-loop` iteration,
  `retrospective`), instead of a prose instruction agents must remember to follow.
- **Docs**: update the doc-map / element table and the §6 interim-note in the project entry-point doc,
  and update `spec-001-memory-yaml-schema` (the `memory.yaml` schema spec) to include `plan` alongside
  the other seven types.
- **Existing plans**: grandfathered — no forced rewrite. Backfilling frontmatter onto
  `X_wingfoil-init-plan.md`, `X_initial-design-plan.md`, and the per-release plans is optional, tracked
  as a non-blocking follow-up, not a precondition for adopting the type.

## Rationale

- **Determinism and traceability (REQ-SYS-07).** A phase's plan is read by whichever agent resumes the
  workflow later; today that reading is unstructured prose with no declared state, so two agents can
  disagree on whether a plan is "done" with no frontmatter to settle it. A queryable `status` closes
  that gap the same way it already does for `task`/`release`/etc.
- **Consistency — "everything is Memory".** Every other artifact that drives execution (task, release,
  ADR, DL, tech-spec, bug) is a typed, versioned, state-tracked element; plans are currently the one
  exception even though they are equally load-bearing. Folding them in removes a special case rather
  than adding one.
- **Strengthens dogfooding.** WingFoil's own process is the test bed for the tool it is building; an
  ungoverned artifact class inside `.wingfoil/`-adjacent config undercuts the claim that the project
  manages its own development through Memory.
- **Trade-offs considered:**
  - *Leave plans informal* — rejected. They already drive real execution (every phase so far has one)
    and the retrospective's need to enumerate plan status by hand is direct evidence of the cost.
  - *Make `plan` a `[SPEC]` type* — rejected. No requirement or feature mandates plans; they exist only
    because the workflow engine (P4.1) is not yet implemented. Marking it `[AUTHORING]` with this DL as
    provenance is the accurate annotation, and the type can be deprecated outright once a real engine
    makes `docs/05_plans/` unnecessary.

## Actions

- [ ] Ratify this decision (owner: approver).
- [ ] On `ready`, implement as config task(s):
  - [ ] Add the `plan` type block to `memory.yaml` (states, template, id_pattern) as drafted above.
  - [ ] Author `.wingfoil/memory/templates/plan.md`.
  - [ ] Wire `memory.add(type: plan)` into `workflows.yaml` / sub-workflows at each plan-producing
        phase, replacing the prose-only §6 instruction.
  - [ ] Update the project entry-point doc-map / element table / §6 interim-note, and `spec-001` to
        list `plan` as an eighth type.
- [ ] Track frontmatter backfill of existing `docs/05_plans/` files as an optional, non-blocking
      follow-up (not required for adoption).
