# WingFoil Init — Configuration Bootstrap Plan

**Date:** 2026-06-29
**Roles:** Tech Lead
**Workflow:** `docs/self/.wingfoil/workflows/custom/wingfoil-init.yaml`
**Feature refs:** P5.1.1 (init), P2.4 (DNA), P1.13 (Memory schema), P3.5/P3.8 (Directives), P4.1 (Workflow)
**Input:** `docs/01_vision/`, `docs/02_requirements/`, `docs/03_backlog/`

---

## Purpose

This document defines the process for initializing the WingFoil configuration. It is pure
config/tooling bootstrap — **no Memory content of any kind** — and runs exactly **once, ever**,
bridging **specification** (outputs of Lean Inception + Specification Downcast) and the first
release-line:
`specification → init (wingfoil-init) → seed-first-release-line → release-line-cycle`.

The init phase produces one class of output:

1. **Configuration** — the four WingFoil pillars: DNA, Memory schema, Directives, Workflows.

Everything else — the release roadmap, ADRs, Decision Logs, project-wide Technical
Specifications — is **out of scope for this document**. It used to include a `seed-releases`
phase, but that moved to `initial-design` (see `X_initial-design-plan.md`) because it needs to be
**re-runnable per release-line** (once for v1's roadmap, again for v2's, ...) rather than run once
at project bootstrap.

> **Dogfooding note:** The `wingfoil` CLI/MCP is not yet implemented. For the WingFoil project
> itself, this phase is performed **manually**: configuration lives under `docs/self/.wingfoil/`.
> Once `wingfoil` is operational, this step is automated by `wingfoil init` and the directory
> moves to the repository root `.wingfoil/`.

---

## Phase

| Phase                 | Description                                                                | Role      | Optional |
|-----------------------|-----------------------------------------------------------------------------|-----------|----------|
| **1 — init-config**    | Create the four config pillars (DNA, Memory schema, Directives, Workflows) | tech-lead | No       |

> The release roadmap, ADRs, Decision Logs, and tech-specs are recorded next, in `initial-design`
> (see `X_initial-design-plan.md`), once per release-line — not part of this workflow.

---

## Output Structure

```text
docs/self/.wingfoil/                        ← Configuration (this workflow's only output)
├── dna.yaml                                (P2.4: modules, tech stack, team, conventions, paths)
├── memory.yaml                             (P1.13: element types + state machines + templates)
├── memory/
│   └── templates/                          (one Markdown scaffold per element type)
├── directives/
│   ├── built-in/                           (P3.8: official templates — stand-ins in custom/ for now)
│   └── custom/                             (P3.5: project-specific rules)
├── roles.yaml                              (P3.2/P3.7: role → directive bindings)
├── workflows.yaml                          (P4.1: top-level includes)
└── workflows/
    └── custom/                             (sw-life-cycle + sub-workflows + ingest mains)
```

`docs/04_memory/` (Memory content, incl. the first `release-line` and its `release` roadmap) is
populated next — see `X_initial-design-plan.md` and `sw-life-cycle`'s `seed-first-release-line`
phase (that phase is inline in `sw-life-cycle.yaml`, not part of `wingfoil-init.yaml` — see there).

---

## Phase 1 — init-config

**Objective:** Create the four WingFoil configuration pillars from the specification artifacts.

**Required Input:**

- `docs/01_vision/01_product-brief.md` — project identity, north star, tech stack
- `docs/01_vision/04_personas.md` — team personas → roles
- `docs/01_vision/06_features.md` — feature list and pillar map
- `docs/02_requirements/03_sard/01_architecture.md` — REQ-SYS-* (modules, constraints, patterns)
- `docs/02_requirements/02_bdd/` — BDD features (directive requirements, workflow validation rules)

**Responsible:** tech-lead

### 1a — `dna.yaml` (P2.4)

Author the DNA configuration as the authoritative project anatomy:

1. `project:` — identity and north star (from Product Brief).
2. `modules:` — one entry per architectural module (from REQ-SYS-02 / SARD).
3. `tech_stack:` — language, runtime, frameworks (from Product Brief).
4. `team:` — members, roles, agents (roles from Personas + USM + SARD, binding per REQ-SYS-08).
5. `conventions:` — methodology, coverage targets, cadence (from SARD + Sequencer).
6. `paths:` — resource path categories for `wingfoil paths` (P2.5): `sources`, `tests`, `docs`,
   `config`, `governance`.
7. Annotate every field with `[SPEC <ref>]` or `[AUTHORING]` (see `.wingfoil/README.md`).

### 1b — `memory.yaml` (P1.13)

Author the Memory schema — one entry per element type needed by a workflow:

1. `defaults:` block — the default state machine (draft→pending→approved/rejected, REQ-STATE-08).
2. `types:` block — declare only types a workflow action produces or consumes:
    - `release-line` — one per major version (v1, v2, ...); the first one seeded inline by
      `sw-life-cycle` (`seed-first-release-line`); each following one self-seeded by its own
      `release-line-cycle` (`plan-next-release-line`); custom states
      (draft→planning→active→done).
    - `release` — a minor release wave belonging to a `release-line`; produced by
      `release-line-cycle`'s `initial-design` (`seed-releases`); iterated by `release-line-cycle` /
      `release-cycle`; custom states (draft→planning→in-development→releasing→released).
    - `task` — produced by `release-planning`; iterated by `dev-loop`; custom states
      (draft→pending→backlog→in-progress→in-review→approved→done).
    - `adr` — created by `initial-design` / `release-planning` / `adr-ingest`; custom states
      (draft→pending→accepted/rejected→superseded).
    - `decision-log` — produced by `retrospective` / `end-of-life` / `decision-log-ingest`;
      uses default machine.
    - `bug` — created by `bug-ingest`; custom states
      (draft→open→triaged→planned→in-progress→in-review→resolved→closed).
    - `tech-spec` — created by `initial-design/seed-specs` (per release-line, before its delivery
      starts), `release-planning/identify-specs` (proactive, per release scope), and, as a
      fallback, by `dev-loop/design` (reactive, per task); custom states
      (draft→pending→approved/rejected→superseded), mirrors `adr`.
3. Mark `path` and `states` (structure) as `[SPEC]`; `name`, `description`, `tags`, `template`, and
   state vocabulary choices as `[AUTHORING]`.
4. **No `status:` fields at type or phase level** — state is derived from Memory frontmatter
   (REQ-SYS-03).
5. **Templates** — for each type declare a `template:` block: `frontmatter.required` (fields the
   scaffold must carry, validated on submit per P4.12) and `file:` pointing to a Markdown scaffold
   under `.wingfoil/memory/templates/{type}.md`. Author one scaffold file per type.

### 1c — `directives/` (P3.5 / P3.8)

Author the directive files:

1. `built-in/` — placeholder for official P3.8 templates (empty until the tool implements them).
2. `custom/` — project rules. Minimum set:
    - **P3.8 stand-ins** (mark `kind: custom, ref: [P3.8]` until built-ins exist):
      `code-quality.md`, `testing.md`, `code-review.md`, `architecture.md`, `security.md`,
      `documentation.md`.
    - **WingFoil-specific**: `determinism.md`, `doc-versioning.md`, `security-secrets.md`,
      `traceability.md`.
3. `roles.yaml` — bind each directive to the roles that need it (P3.2/P3.7). Only roles
   defined in `dna.yaml` may appear here (REQ-SYS-08).

### 1d — `workflows.yaml` + `workflows/custom/` (P4.1 / ADR-005)

Author the workflow configuration:

1. `workflows.yaml` — top-level includes list (no inline content).
2. `sw-life-cycle.yaml` — the `kind: main` lifecycle workflow; phases:
   `inception → specification → init → seed-first-release-line → release-line-cycle → sunset`.
   `seed-first-release-line` is inline (`role:`/`actions:` directly on the phase, no `include:`).
3. Sub-workflows (all `kind: sub`): `lean-inception`, `specification-downcast`,
   `user-story-mapping`, `specification-by-examples`, `volere-requirements`, `backlog-export`,
   `wingfoil-init`, `initial-design`, `release-line-cycle`, `release-cycle`, `release-planning`,
   `dev-loop`, `release-submit`, `release-publishing`, `retrospective`, `end-of-life`.
4. Ingest mains (all `kind: main`, startable on demand per REQ-STATE-03):
   `bug-ingest`, `decision-log-ingest`, `adr-ingest`.
5. **No `status:` fields** in any workflow YAML (state is derived from Memory, REQ-SYS-03).
6. Every `include:` references a workflow by its `name:` field; no circular includes.

**Validation Criterion (Stop-Check):**

- Each pillar file passes schema validation in isolation (REQ-SYS-02 Fit Criterion).
- No `status:` fields in any workflow YAML file.
- Every `[SPEC]` field in `dna.yaml` and `memory.yaml` cites an inline reference.
- All roles in `roles.yaml` and workflow `role:` fields are declared in `dna.yaml`.
- Only types used by a workflow exist in `memory.yaml` (provenance policy).
- One scaffold file exists in `.wingfoil/memory/templates/{type}.md` for every declared type.
- For each type, `template.frontmatter.required` matches the `checks.post: ["frontmatter.required:
  [...]"]` declared in the workflow step that produces it (P4.12 alignment rule).

---

## Launch Checklist

- [ ] All input documents available and up-to-date:
    - [ ] `docs/01_vision/` (product-brief, personas, features, sequencer, mvp-canvas)
    - [ ] `docs/02_requirements/03_sard/` (architecture, state, integrations, security)
    - [ ] `docs/03_backlog/04_backlog/by-release/` (v0.1 → v1.0 JSON files)
- [ ] **Phase 1 — init-config:**
    - [ ] Author `dna.yaml` — all sections, `[SPEC]`/`[AUTHORING]` annotations complete
    - [ ] Author `memory.yaml` — only workflow-needed types, no `status:` fields, `template:` block per type
    - [ ] Author template scaffold files in `.wingfoil/memory/templates/` — one `.md` per type
    - [ ] Author directive files — built-in placeholder + custom rules + `roles.yaml`
    - [ ] Author `workflows.yaml` and all workflow YAML files — no `status:` fields
    - [ ] **Stop-Check:** schema validation passes per pillar in isolation
    - [ ] **Stop-Check:** all `[SPEC]` fields cite inline references; all roles declared in DNA

Next: `sw-life-cycle`'s `seed-first-release-line` phase, then `release-line-cycle`
(`initial-design` → `delivery` → `plan-next-release-line`) — see `X_initial-design-plan.md`.
