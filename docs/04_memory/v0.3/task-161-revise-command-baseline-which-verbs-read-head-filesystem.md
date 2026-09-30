---
id: "task-161-revise-command-baseline-which-verbs-read-head-filesystem"
type: task
title: "Revise `command-baseline`: which verbs read HEAD, the filesystem-effect exception, the workflow-read exception, and its audience"
status: pending
release: "v0.3"
kind: "feature"
priority: "high"
tags: ["v0.3", "core", "directives", "docs"]
ref: "dl-084"
bug: []
depends_on: ["task-128-allocate-element-ids-highest-number-ref-across-folder"]
tmpl_version: 260703
---

## Description

One directive revision for the `dl-080` family. `docs/cli-reference.md` says every command reads config "as committed at HEAD", false for `memory search` and the MCP Resources (`dl-084`); `command-baseline`/`claim-evidence` reach only agents bound by this repository's roles and must state their audience, with `spec-006` §6 normative (`dl-085`); five source sites cite `dl-086` as `in-discussion` while `command-baseline.md:39` says "There is no third category of read" (`dl-086`). R15 declares the workflow/agent read commands a HEAD-reading exception to `dl-084` (A) and `spec-006` §6 item 4.

## Acceptance Criteria

- (characterization) `command-baseline.md` states the filesystem-effect category (with the TOCTOU residual named as a limit and `bug-108` still owed to HEAD), the R15 exception, task-128's allocator baseline, and its audience; `claim-evidence.md` states its audience; both `version:` bumped.
- (characterization) `spec-006` §6 and `spec-008` list which verbs read HEAD and which the working tree; `docs/cli-reference.md` matches (its parity gate green).
- (red-first) a test enumerates the source sites citing `dl-086` and fails if one still says `in-discussion` (or the citations drop the status word).
- (characterization) `command-baseline.md` names `spec-006` §6 as the normative text (dl-085 (B)); (C) is not done.
- (characterization) `spec-006` §6 gains, as a dated Revision note, the sentence declaring the `HEAD`-read exception (R15) for `workflow status|list|show`, `agent list|show` and the two v0.3 workflow Resources — the one owner of that sentence (task-204 and task-240 depend on this task).

## Implementation Notes

- **Size:** S · **wave:** 1 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** dl-084 (A)+(D delivered by task-095); dl-085 (A)+(B); dl-086 (adopt); R15 exception; spec-006 §6; spec-008; dl-085 (B) — `spec-006` §6 named normative; spec-006 §6 R15 sentence (single owner for task-204 and task-240).
- **Features:** P3.5.
- **Notes:** Proposal key: C35. Merged with the `dl-085`/`dl-086` half of task-191 and the R15-sentence ACs of task-204 and task-240. task-191 (claim-evidence falsifiability, determinism) follows on the same `claim-evidence.md`.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
