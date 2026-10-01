---
id: bug-178-id-allocation-spawns-one-git-ls-tree-per-distinct-ref-commit
type: bug
title: "Id allocation spawns one git ls-tree per distinct ref commit"
status: triaged
severity: "low"           # REQUIRED — critical | high | medium | low
release-origin: "v0.3"     # optional — release where the bug was FOUND (dl-016), e.g. "v0.1"
release: ""            # optional — fix/implementation release, stamped by release-planning/build-backlog (dl-016)
feature: "P1.3"            # optional — related feature ID, e.g. "P1.6"
contributor: ""        # optional — who originated this contribution, if not the git author (dl-020); credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note (dl-020)
tmpl_version: 260703   # Orignal template version
tags: ["v0.3","memory","ids","performance"]
---

## Summary

`memory add`'s id allocation (`nextSequenceNumber`, `src/memory/add.ts`) spawns one `git ls-tree` per distinct ref commit. Its cost grows linearly with the number of branches and remote-tracking refs.

## Steps to Reproduce

1. On this repository: `git for-each-ref refs/heads refs/remotes --format='%(objectname)' | sort -u | wc -l` → 38.
2. Time `nextSequenceNumber` from `dist/memory` for `task`, `decision-log` and `bug`.

## Expected Behavior

One or a constant number of git processes per allocation, whatever the ref count.

## Actual Behavior

About 430–640 ms per call, and 1.4–1.7 s for the three types (`task-128` Execution Notes, review section; `process.hrtime`, three runs). A clone with hundreds of remote branches would take seconds per `memory add`.

## Notes

- Found by `task-128`'s independent review.
- Possible fix: one batched read, e.g. `git cat-file --batch` or `git log --all --name-only` limited to the type's path prefix.
- Same class as `bug-110` (directives at `HEAD`: one git process per file). Proposed for `task-142`, the shared git-read helper.

## Triage & Execution Notes

Captured by `bug-ingest-rel-v0.3-wave0-review-findings-plan` (2026-10-01), from the independent
review of a wave-0 task of `dev-loop-rel-v0.3-plan`.
