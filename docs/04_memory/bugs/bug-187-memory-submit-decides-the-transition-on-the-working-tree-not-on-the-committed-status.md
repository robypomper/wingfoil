---
id: bug-187-memory-submit-decides-the-transition-on-the-working-tree-not-on-the-committed-status
type: bug
title: "memory submit decides the transition on the working tree, not on the committed status"
status: planned
severity: "high"           # REQUIRED — critical | high | medium | low
release-origin: "v0.3"     # optional — release where the bug was FOUND (dl-016), e.g. "v0.1"
release: "v0.3"            # optional — fix/implementation release, stamped by release-planning/build-backlog (dl-016)
feature: "P1.6"            # optional — related feature ID, e.g. "P1.6"
contributor: ""        # optional — who originated this contribution, if not the git author (dl-020); credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note (dl-020)
tmpl_version: 260703   # Orignal template version
tags: ["v0.3"]
---

## Summary

`memory submit` finds its document by scanning the working tree (`findMemoryDocumentById`, called from `prepareMemoryTransition` in `src/core/memory-transition.ts`) and reads the current `status` from the working-tree frontmatter. It decides the transition from state the commit did not record. The other transition verbs also look up the id in the working tree, the same shape as `bug-108`.

## Steps to Reproduce

1. In a project, `memory add` a bug and `memory submit` it (`HEAD`: `status: open`).
2. Edit the file in the working tree back to `status: draft`.
3. `memory submit <id>`.
4. Separately: create an untracked bug file by hand at the type's path with `status: draft`, then `memory submit` it.

## Expected Behavior

The transition is decided from the element's committed `status` at `HEAD`, as `spec-006` §6 item 1 (approved) states, and a document with no `add` commit is refused.

## Actual Behavior

Step 3 exits 0 and writes a second `wf(bug): submit` on an element already past `draft` at `HEAD`. Step 4 exits 0 with no `add` commit. A document deleted in the working tree but present at `HEAD` gives `document not found`. Reproduced by `task-161`'s independent reviewer.

## Notes

- `dl-080` names this exact hazard (an uncommitted `status` drives the declared transition); `bug-076` was closed for the gated verbs only.
- `spec-006` §6's table (amended by `task-161`) now records it as a working-tree deviation owed to `HEAD`.
- `task-137` provides the readers at a commit (`findMemoryDocumentByTypeAndIdAtRev`) the fix can use.

## Triage & Execution Notes

Captured on 2026-10-02 by `bug-ingest-rel-v0.3-w1b2-review-findings-plan`, from the independent reviews of wave 1
batch B2 (`dev-loop-rel-v0.3-plan`).
