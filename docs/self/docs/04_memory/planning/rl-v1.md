---
id: "rl-v1"
type: release-line
title: "WingFoil v1 — MVP"
status: active
version: "v1"
tmpl_version: 260703   # Orignal template version
---

## Scope

WingFoil's MVP arc, delivered as five weekly minor releases (v0.1 → v1.0), each centered on one
pillar per `docs/01_vision/07_sequencer.md`:

- **v0.1 — Project Memory + DNA**: git-backed storage, Memory CRUD, DNA config.
- **v0.2 — Project Directives**: custom/built-in directives, role-based auto-load.
- **v0.3 — Project Workflow**: workflow config, command surface, agent execution.
- **v0.4 — Polish & Documentation**: MCP full endpoints, `dna infer`, CLI UX.
- **v1.0 — MVP Complete**: atomic step execution, workflow checks, built-in templates hardened.

By the end of this release-line, all 5 pillars (Memory, DNA, Directives, Workflow, MCP/Agent
integration) are integrated and stable, and WingFoil is dogfooding itself
(`docs/self/.wingfoil/` → repository-root `.wingfoil/`).

## Success Criteria

From `docs/01_vision/08_mvp-canvas.md` ("MVP Success Criteria (v1.0)"):

- All 8 user journeys executable and tested (0a, 0b, 1–6).
- Data integrity preserved (git versioning + audit trail work).
- CLI is intuitive and documented (help text, examples).
- MCP server is stable (<1 sec queries).
- All 5 pillars integrated and stable.
- Published to npm with documentation.
- North Star: **Determinism Index** — two independent development runs from the same base
  (specs + WingFoil config) using different AI agents produce substantially equivalent software.

## Execution Notes

<!-- Running log of what actually happened across this release-line's workflow — filled in
     incrementally, not written after the fact. Raw material for future planning of the next
     release-line, not a retrospective itself (each release still has its own). -->

### Initial Design (seed-adrs / seed-dls / seed-specs)

Executed per `docs/05_plans/rl-v1/initial-design-rl-v1-plan.md` on 2026-07-03 (branch
`design/initial-design`). Phase 1 (seed-releases): 5 release files created (`minor-v0.1`…`minor-v1.0`,
`status: draft`). Phases 2–4: 8 ADRs, 12 Decision Logs, 12 Tech-Specs authored via 33 parallel
sub-agents, cross-checking two unmerged prior-art sources (`_backup/` and branch
`task/task-109-validation-id-engine`) against this line's current config rather than copying them
verbatim — several factual corrections were needed (stale pre-release-line path examples, an
`includes:`→`include:` rename). As part of `spec-001`/`spec-003`, `docs/self/.wingfoil/memory.yaml`
was migrated from a `transitions` dict-of-arrays state encoding to `sequence`/`gates`/`waiting`
(removes an approve/reject ambiguity; the default machine, `adr`, and `tech-spec` lose their separate
`rejected` status as a result) and `decision-log` gained its own custom lifecycle
(`draft→in-discussion→ready→in-develop→done`, per `dl-012`); `workflows.yaml`'s `includes:` key was
renamed to `include:`, with downstream documentation updated to match. `spec-002` initially declined
the branch's proposed `dna.yaml` restructuring (generic `stacks` list, dropped `conventions`, dropped
`team.roles`) as out of scope; that decision was later reversed on explicit instruction — `dna.yaml`
was restructured to the generic `stacks.technologies`/`stacks.methodologies` shape, `conventions`
values were relocated into the matching `directives/custom/*.md` files (each relocation target listed
in `spec-002`'s Consequences), and `team.roles` was kept as the canonical role catalogue (`roles.yaml`
only binds directives to roles, it doesn't enumerate them). A later validation pass (subagent,
comparing this line's `spec-001`/`spec-002`/`spec-003` against `task/task-109-validation-id-engine`'s
own real `dna.yaml`/`memory.yaml`/`workflows.yaml`) found no defects in these specs — every divergence
was either this line being ahead of that branch (`release-line`/`release` split, `decision-log`'s
custom lifecycle, the `include:` rename) or a branch-only, unrelated authoring gap (its `bug` machine
has no legal path to `closed`). A `rejection_reason` frontmatter field (optional, set by
`memory.reject`, cleared by the next `memory.submit`) was also added to `spec-010`/`spec-001` and to
the operational `memory.reject` procedure.

All 32 ADR/DL/Tech-Spec documents are `submit`-ted (`status: pending`/`in-discussion`) but **not yet
approved** — held for human review before `memory.approve` runs (agents do not self-approve; see
`dna.yaml`'s team & roles section, REQ-SYS-08).

<!-- Anything discovered late that should have been seeded here instead of during a release's
     identify-specs. -->

### Delivery (per release)

<!-- Cross-release patterns: recurring blockers, releases that slipped and why, whether the
     release roadmap seeded here needed revision mid-line. -->
