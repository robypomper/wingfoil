---
id: "task-135-make-init-scan-builtin-templates-secrets-refuse-reinitialize"
type: task
title: "Make `init` scan the built-in templates for secrets and refuse to re-initialize storage"
status: pending
release: "v0.3"
kind: "fix"
priority: "high"
tags: ["v0.3", "core", "security", "init"]
ref: "spec-007"
bug: ["bug-037", "bug-038", "bug-088"]
depends_on: []
tmpl_version: 260703
---

## Description

`dotenv-style-secret-line` is anchored at column 0 (`src/validation/secret-scan.ts:116`, and `spec-007` §2), so indented, `export`-ed or list-item credential lines go unseen (`bug-037`); `init` never secret-scans the built-in templates before writing them, as `spec-007` §4 step 5 requires — the scanner has no production caller (`bug-038`); `initWingfoilStorage` has no already-initialized check and overwrites a committed `dna.yaml` (`src/core/init.ts:92-135`; `bug-088`).

## Acceptance Criteria

- (red-first) the pattern matches `  TOKEN=abcd1234`, `export API_SECRET=…`, `- PASSWORD=…`; the existing negatives still pass; `spec-007` §2 carries the regex and the stale "warn patterns are heuristic" note is corrected.
- (red-first) `init` with a built-in template carrying a blocking finding (test seam) refuses before writing, exit 1, naming template and pattern.
- (red-first) `initWingfoilStorage` on an initialized clean repo refuses like `initWingfoilProject`; the committed `dna.yaml` is unchanged.

## Implementation Notes

- **Size:** M · **wave:** 1 · **kind:** fix (`dl-133` Q1 (b)).
- **Implements:** spec-007 §2 (dotenv pattern), §4 step 5 (init pre-write scan); REQ-SEC-08.
- **Features:** P5.1.1, P3.8.
- **Notes:** Proposal key: C33.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
