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

**`minor-v0.1` — `release-planning` (2026-07-04, plan:
`docs/05_plans/rl-v1/rel-v0.1/release-planning-rel-v0.1-plan.md`, branch
`design/release_planning_v0.1`):** `define-scope`/`record-adrs`/`identify-specs` all found nothing
to add — this line's `initial-design` had already seeded enough (`seed-releases` submitted releases
one step ahead of the model doc; `adr-001..008`/`spec-001..012` fully covered v0.1's scope). The
substantive work was in `build-backlog`: 28 tasks derived from `v0.1.json`, renumbered
`task-001..033` independent of the backlog JSON's own `TASK-NNN` numbering (backlog content/count is
a suggestion, not authoritative — see auto-memory
`feedback_backlog_json_not_authoritative`), plus 5 tasks added proactively (repo scaffold,
validation/ID engine, `dna.yaml` sync, README/CLI docs, manual E2E journey validation) —
cross-checked against a prior, abandoned attempt at this same phase (branch
`design/rel_v0.1_planning`, commit `9d1752b…`) that had discovered the same scaffold/validation-
engine gap only reactively, mid-planning, and had to invent two ad hoc SARD requirements
(`REQ-SYS-10`/`11`) to justify it; this time `adr-005`/`spec-009` (already `accepted`/`approved`)
justified the equivalent tasks directly, no new requirement needed. All 33 tasks approved into
`backlog` and `minor-v0.1` approved `planning → in-development`. **Open point for future releases:**
whether `release-planning` work should live on a branch merged to `main` (as `initial-design` did) is
still undecided — an unprompted merge was tried once here and reverted by the approver; no workflow
yaml or decision-log currently specifies branching for this phase (`dl-002` only covers `dev-loop`
per-task branches).

**`minor-v0.1` — `implementation` phase preparation (2026-07-04, on `main`):** before the phase's 33
`dev-loop` runs start, two ad-hoc decision-logs and two plans were produced.

`dl-013-documentation-process-gate` (add+submit, `in-discussion`) decides the text of two
documentation rules — TSDoc/TypeDoc on every public/exported symbol, and user-facing docs
(README/user-guide/CLI-reference/examples/CHANGELOG) written before `release-submit` — plus a new
`user-docs` `release-cycle` phase between `implementation` and `submit` to enforce the second rule.
Neither is wired into config yet.

`dl-014-dev-loop-plan-deltas` (add+submit, `in-discussion`) went through two revisions the same day.
Its first draft proposed a `task/` branch prefix, per-task git worktrees, and `--no-ff` merges for
`dev-loop.yaml`, plus a `done`-phase merge-conflict fallback and wiring `dl-013`'s API-docs rule into
`refactor.checks.post`. Checking it against `dl-002-git-branching-trunk-based` (already `ready`)
found a direct conflict: `dl-002` explicitly names that same branch-prefix/worktree/`--no-ff` trio as
"considered and deferred". The first fix dropped those three to avoid the conflict; the approver
corrected that — the right resolution was to keep them and frame them as an explicit **supersession**
of `dl-002` (new fact: `minor-v0.1`'s `implementation` phase needs to run tasks in parallel, which
`dl-002` didn't anticipate), not a silent retreat. `dl-014` now proposes overriding `dl-002` on
branch/worktree/merge-strategy specifically, with an Action to `memory.deprecate(dl-002, ...)` once
`dl-014` itself is approved; `dl-002` remains the governing, `ready` decision until then.

Two plans were written for the `implementation` phase, both citing content from abandoned,
never-merged branches as prior art (re-derived against current config, not copied) without naming
those branches inside the plans' own decision-adjacent sections:
- `docs/05_plans/rl-v1/rel-v0.1/dev-loop-rel-v0.1-plan.md` — the per-task contract, mirroring all 7
  `dev-loop.yaml` phases (`start/design/red/green/refactor/review/done`). On the approver's explicit
  instruction, it **force-adopts** `task/{task.id}`-prefixed branches and per-task git worktrees ahead
  of `dl-014`'s approval — a deliberate, flagged divergence from `dev-loop.yaml`/`dl-002` as currently
  configured, not an oversight. Merge strategy and the conflict fallback were **not** forced.
- `docs/05_plans/rl-v1/rel-v0.1/release-implementation-rel-v0.1-plan.md` — the orchestration layer
  above it: 5 waves over the 33-task registry (0=`task-001`, 1=`task-002`, 2=`task-003..017` ×15,
  3=`task-018..030` ×13, 4=`task-031..033` ×3), per-task model assignment, a human-checkpoint table
  extracted from `dev-loop.yaml`/`release-submit.yaml`/`release-publishing.yaml`/`retrospective.yaml`,
  and an illustrative (not executed) sketch of using Claude Code's own `Workflow` tool
  (`agent()`/`parallel()`, `isolation: 'worktree'`) as the fleet-execution mechanism for running
  multiple tasks' dev-loops concurrently — explicitly distinguished from the (still nonexistent)
  `wingfoil` workflow engine.

**Neither plan has been executed** — no task has moved past `backlog`; Wave 0
(`task-001-nodejs-typescript-scaffold`) has not started.
