---
id: "task-144-declare-directive-scope-report-when-disagrees-roles-yaml"
type: task
title: "Declare a directive's `scope` and report when it disagrees with `roles.yaml`'s `global:` list"
status: backlog
release: "v0.3"
kind: "fix"
priority: "medium"
tags: ["v0.3", "core", "directives"]
ref: "spec-013"
bug: ["bug-109", "bug-113", "bug-148"]
depends_on: []
tmpl_version: 260703
---

## Description

`DirectiveFrontmatter` (`src/directives/schema.ts:36-44`) has no `scope`, so `directives list` prints "unknown field(s) ignored: scope" for every global directive here (`bug-113`), and a `scope: global` in a directive is silently dropped while `roles.yaml` alone decides (`bug-148`). The module TSDoc calls approved `spec-013` a candidate (`bug-109`).

## Acceptance Criteria

- (red-first) `scope` is a declared optional key (`global`); no unknown-field warning for it.
- (red-first) a directive declaring `scope: global` that `roles.yaml`'s `global:` omits (and the reverse) produces a named entry in `directives list`'s `warnings` array; `roles.yaml` stays the authority (stated in `spec-013` with a Revision note).
- (characterization) the `schema.ts` TSDoc cites `spec-013` as approved.
- (red-first) `version` is a declared optional key (string) of the directive frontmatter, in `spec-013`'s field table and `src/directives/schema.ts`, with a Revision note; a directive carrying `version:` produces no unknown-field warning. `command-baseline.md`'s body `**Version:** 1.1 · **Date:** 2026-09-30` line (written by `task-128` because the key was undeclared) moves into its frontmatter as `version: "1.1"`, and the `doc-versioning` reading for directives is the frontmatter key (approver ruling 2026-10-01, at `task-128`'s review).

- (characterization) `doc-versioning.md` states the committed baseline the bump rule counts from: a document's version is bumped on the first edit after the file was last committed **to `main`**, so a task branch bumps it once, and further edits on the same branch (review fixes) do not bump again (approver ruling 2026-10-01, the practice of every v0.3 task so far).

## Implementation Notes

- **Size:** S · **wave:** 1 · **kind:** fix (`dl-133` Q1 (b)).
- **Implements:** spec-013 (`scope` row); P3.7.
- **Features:** P3.4, P3.7.
- **Notes:** Proposal key: C16.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
