---
id: "task-063-fix-dna-set-comment-preservation"
type: task
title: "Fix bug-004: `dna set` must preserve YAML comments ([SPEC]/[AUTHORING])"
status: backlog
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "dna"]
ref: "P2.1"
bug: "bug-004-dna-set-strips-yaml-comments"
depends_on: []
tmpl_version: 260703
---

## Description

Fix **bug-004**: `wingfoil dna set` re-serializes `dna.yaml` via `js-yaml dump()`, stripping all comments and losing the `[SPEC]`/`[AUTHORING]` provenance annotations. Make `dna set` a minimal, comment-preserving in-place edit.

## Acceptance Criteria

From `bug-004`:
- `wingfoil dna set <key> <value>` on a comment-rich `dna.yaml` updates only the target value.
- All unrelated content — comments (incl. `[SPEC]`/`[AUTHORING]`) and formatting — is preserved.
- Deterministic output; existing `dna set` tests still green.

## Implementation Notes

Source: `bug-004` (triaged). Surfaced by task-025 review. Likely needs a comment-preserving YAML editor (e.g. `yaml`/eemeli) instead of `js-yaml dump`. dev-loop keeps the bug state in sync via `bug: bug-004`.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
