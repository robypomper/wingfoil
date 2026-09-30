---
id: "task-138-dna-yaml-declares-team-agents-adapter-runs-paths"
type: task
title: "`dna.yaml` declares `team.agents[].adapter` and the `runs` paths category"
status: pending
release: "v0.3"
kind: "feature"
priority: "high"
tags: ["v0.3", "agent", "dna", "schema"]
ref: "spec-016"
bug: []
depends_on: []
tmpl_version: 260703
---

## Description

`spec-016` needs two DNA declarations that the schema tolerates today but does not validate: - `team.agents[].adapter`, the link from *who* runs to *how* it is launched; - `paths.runs`, a sixth `paths` category holding exactly one directory, the run log. Until `spec-002` declares them, `dna set` / `dna update` refuse the paths (`spec-002` "Unknown keys: accepted on read, refused on write", `adr-012` Consequences), and `wingfoil paths runs` is not a documented category.

## Acceptance Criteria

- (red-first) `AgentEntry` validates an optional `adapter` string in `spec-009`'s id class. `dna update team.agents.<name> --entry-adapter <a>` succeeds; a non-string value is refused.
- (red-first) `Paths` declares `runs` (an array holding exactly one entry). Two entries are a validation error naming `paths.runs`.
- (red-first) `wingfoil paths runs` prints the declared directory, and the positional description at `src/core/index.ts:1833` lists `runs`.
- (red-first) `wingfoil init` scaffolds `paths.runs: [docs/runs/]` (`spec-016` §4.1); `src/storage/templates.ts`.
- (characterization) This repository's `.wingfoil/dna.yaml` still loads (no `adapter`, no `runs` yet: task-206 and task-236 add them).
- (characterization) Docs, each with a `doc-versioning` bump: `spec-002` (both fields, and `runs` in §Categories); `docs/cli-reference.md` `paths` entry.

## Implementation Notes

- **Size:** S · **wave:** 1 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** spec-016 §2.1 (adapter link), §4.1 (`paths.runs`, R18); dl-114 Action 2; dl-135 Action 5 (v0.3 half).
- **Features:** P2.4, P2.5, P5.3.1.
- **Notes:** Proposal key: B04. `src/dna/schema.ts`, `src/storage/templates.ts`, `src/core/index.ts`. The first `team.agents` entry in a project with none meets `bug-126`, which domain A/B's comment-stripping cluster owns; not claimed here. The `X_cli-cmds.md` rows for `runs` / `--entry-adapter` are task-245's (one owner for that file).
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
