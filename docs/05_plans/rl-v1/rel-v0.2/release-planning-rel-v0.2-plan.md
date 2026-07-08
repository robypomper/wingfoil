---
id: "release-planning-rel-v0.2-plan"
type: plan
title: "Release-planning — v0.2 (Project Directives + publishing pipeline)"
status: active
version: "1.0"
workflow: "release-planning"
phase: "rel-v0.2"
element: "minor-v0.2"
release: "v0.2"
tmpl_version: 260703
---

## Context

`minor-v0.2` (`docs/self/docs/04_memory/planning/rl-v1/minor-v0.2.md`) is `planning`. The normal
`sw-life-cycle` → `release-line-cycle/delivery` resumes and picks it up, running its `release-cycle`
(`.wingfoil/workflows/custom/release-cycle.yaml`) starting at `release-planning`
(`.wingfoil/workflows/custom/release-planning.yaml`, v1.1).

This is the **first real exercise of `dl-016`'s reconcile machinery** — the updated 7-phase
`release-planning`: `define-scope → triage-bugs → reconcile-governance → record-adrs →
identify-specs → build-backlog → commit-backlog`. Per CLAUDE.md §6-interim + `dl-019`, this `plan`
element is that phase's coherent execution scaffold.

**Preconditions (verified on `main@9930c40`):** `minor-v0.2` `planning`;
`dl-018-release-publishing-strategy` `in-discussion` (release `v0.2`); `bug-004`/`bug-006`/`bug-007`
`open` (release `""`); `bug-005` `resolved` (release `v0.1`, fixed by task-032); all other DLs
`ready`, all 8 ADRs `accepted`. Next free IDs: `task-034`, `adr-009`, `spec-015`.

**Produces:** `minor-v0.2` → `in-development`; `dl-018` → `ready`; a publishing ADR (`adr-009`,
REQ-SYS-09) and tech-spec (`spec-015`, REQ-SYS-09); 32 `backlog` tasks tagged `v0.2`; `bug-004/006/007`
→ `planned` with fix-tasks; `bug-005` → `closed`.

**Locked decisions (approver, Roberto):** full 32-task backlog (25 P3/Memory feature tasks from
`docs/03_backlog/04_backlog/by-release/v0.2.json`, as fresh `task-0NN` IDs, + 7 governance/publishing/
bug tasks); publish flow = **CI/CD via GitHub Actions**; staging = a **free/open-source registry**
(recommend ephemeral **Verdaccio** in CI, GitHub Packages as alternative) with **npm provenance/OIDC**
on the prod publish.

## Phases / Steps

Executed on branch `design/release_planning_v0.2` (`dl-024` branch-per-phase); `git merge --ff=false`
into `main` at the end. Every memory op = one scoped `wf({type}): {verb} {ids}` commit (§5.1); no
`Co-Authored-By` on `wf(...)` commits. Approver gates run only on Roberto's explicit instruction with
`Approver:` + `Reason:` in the commit body.

1. **define-scope** (product-owner) — `minor-v0.2` already `planning` with all required frontmatter;
   `memory.submit` is a no-op, **verify only**. Confirm pillar P3 + feature set.
2. **triage-bugs** (tech-lead, ⛔ approver gate) — `where {type: bug, status: [open], release: ["", v0.2]}`
   → `bug-004, bug-006, bug-007`. `memory.approve` `[open → triaged]`. Separately confirm task-032 fix
   on `main` and `memory.approve bug-005 [resolved → closed]`.
3. **reconcile-governance** (product-owner, ⛔ approver gate, idempotent) — in-scope not-ready governance
   = **only `dl-018`**. `memory.approve dl-018 [in-discussion → ready]` (status-only; body untouched —
   open questions resolved by `adr-009`).
4. **record-adrs** (architect, `dl-022` spec-review + ⛔ approver gate) — `adr-009` (REQ-SYS-09):
   CI/CD via GitHub Actions, ephemeral Verdaccio staging → promote to npm prod w/ provenance/OIDC,
   `prepublishOnly` + `npm publish --dry-run` gate, token in CI secret store. `add → submit (pending)`
   → spec-review → `approve [pending → accepted]`.
5. **identify-specs** (architect, `dl-022` spec-review + ⛔ approver gate) — `spec-015` (REQ-SYS-09):
   package.json publish metadata + `.github/workflows` publish pipeline contract (stages, staging
   registry, dry-run gate, secrets, version/tag scheme, rollback). Feature-side artefacts already
   covered by approved `spec-013`/`spec-004`. `add → submit (pending)` → spec-review →
   `approve [pending → approved]`.
6. **build-backlog** (product-owner, no gate) — create 32 tasks (`task-034..065`): 25 feature (from
   `v0.2.json`), 3 publishing (`dl-018` T1/T3/T4), 1 TypeDoc/TSDoc backfill (`dl-014` B-DECISION Opt 2),
   3 bug-fix (`bug-004/006/007`). `add → submit (pending)` grouped by provenance. `bug.set_state(planned)`
   for the three bugs (`[triaged → planned]`, `waiting`, no gate) stamping `release: v0.2`. Stamp
   `release: v0.2` on `adr-009` + `spec-015` (dl-016 §4). `dl-018` and tasks already carry `release: v0.2`.
7. **commit-backlog** (tech-lead, ⛔ approver gate) — `memory.approve` all 32 tasks `[pending → backlog]`;
   `memory.approve minor-v0.2 [planning → in-development]`.

## Handoff

- **Approver (Roberto):** the four in-phase gates (triage-bugs, reconcile-governance, record-adrs,
  identify-specs) + the final commit-backlog gate + the go-ahead to merge to `main`. Each is presented
  and **waited on** — agents never self-approve (CLAUDE.md §4/§8).
- **Agent:** all authoring (plan, ADR, tech-spec, 32 tasks), the non-gated define-scope/build-backlog
  mechanics, spec-review preparation, and commit hygiene.
- **Completion criteria:** `minor-v0.2` `in-development`; `dl-018` `ready`; `adr-009` `accepted`;
  `spec-015` `approved`; 32 tasks `backlog`; `bug-004/006/007` `planned` (release `v0.2`); `bug-005`
  `closed`. **Stop at commit-backlog** — the dev-loop (`implementation`) is the next phase, not this one.
