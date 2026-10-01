---
id: bug-182-a-memory-verb-commits-the-working-tree-bytes-of-its-document-and-silently-drops-a-different-staged-version
type: bug
title: "A Memory verb commits the working-tree bytes of its document and silently drops a different staged version"
status: open
severity: "low"           # REQUIRED — critical | high | medium | low
release-origin: "v0.3"     # optional — release where the bug was FOUND (dl-016), e.g. "v0.1"
release: ""            # optional — fix/implementation release, stamped by release-planning/build-backlog (dl-016)
feature: "P1.2"            # optional — related feature ID, e.g. "P1.6"
contributor: ""        # optional — who originated this contribution, if not the git author (dl-020); credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note (dl-020)
tmpl_version: 260703   # Orignal template version
tags: ["v0.3","test"]
---

## Summary

`commitPaths` (`src/storage/commit.ts`) runs `git add -- <path>` and then `git commit --only`. When a Memory verb runs on a document that has a staged version different from both `HEAD` and the working tree, the commit records the working-tree bytes. The staged version is overwritten in the index without a warning.

## Steps to Reproduce

1. In a project, stage an edit of an amendable element (`git add`), then edit the same file again in the working tree.
2. `memory amend <id> --reason r` (or any content-carrying verb, e.g. `memory submit`).
3. `git show HEAD:<path>`; `git status`.

## Expected Behavior

The verb refuses when the index version differs from both `HEAD` and the working tree, naming the path, as `task-131`'s dirty-target guard does for created paths. Or it states the rule and warns.

## Actual Behavior

The commit holds the working-tree content. The staged content is gone and the tree is clean. Reproduced by `task-127`'s reviewer with `STAGED2` / `WT2` in a scratch repository.

## Notes

- Consistent with the declared "the content is the working tree's". The `bug-076` post-condition holds: one path, `status` unchanged. It is a silent loss of the staged version, not a leak of other files (`bug-027`, closed, covers the latter).
- Optional hardening; proposed for `task-131` (dirty-target guard), which owns the same class of check.

## Triage & Execution Notes

Captured on 2026-10-01 from the independent review of `task-127` (`dev-loop-rel-v0.3-plan`, wave 0),
under `bug-ingest`.
