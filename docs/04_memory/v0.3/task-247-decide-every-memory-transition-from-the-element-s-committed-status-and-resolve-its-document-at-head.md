---
id: task-247-decide-every-memory-transition-from-the-element-s-committed-status-and-resolve-its-document-at-head
type: task
title: "Decide every memory transition from the element's committed status and resolve its document at HEAD"
status: backlog
release: "v0.3"
kind: "fix"
priority: "high"           # optional — high | medium | low
tags: ["v0.3","core","memory","baseline"]
ref: "bug-187"                # optional — backlog item ID, e.g. "TASK-001"
bug: ["bug-187"]                # optional — LIST of bug ids this task closes (dl-045). Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`, dl-123). A single string is still accepted for documents predating dl-045.
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-137-read-pillar-configuration-memory-documents-any-commit-not"]         # optional — ids of tasks whose Execution Notes constrain this one (dl-015); authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

`memory submit` finds its document by scanning the working tree (`findMemoryDocumentById`, called from
`prepareMemoryTransition`, `src/core/memory-transition.ts`) and reads the current `status` from the
working-tree frontmatter (`bug-187`). It can therefore:
- submit again an element already past `draft` at `HEAD`;
- submit a hand-made document that has no `add` commit;
- refuse a document deleted in the working tree that `HEAD` still holds.

The other transition verbs resolve the id the same way, the shape of `bug-108`. `spec-006` §6 item 1
(approved) states that a transition reads the element's committed `status`, and §6's table, as amended
by `task-161`, records these reads as working-tree deviations owed to `HEAD`. `task-137` provides the
readers at a commit.

## Acceptance Criteria

- (red-first) `memory submit` decides the transition from the `status` committed at `HEAD`. With
  `HEAD` at `open` and the working tree edited back to `draft`, it is refused as an illegal
  transition from `open`, exit 1, and nothing is written.
- (red-first) A document with no commit at `HEAD`, created by hand, is refused by every transition
  verb (submit, approve, reject, deprecate, amend) with a message naming `memory add`, exit 1.
- (red-first) Every transition verb resolves the id against the documents at `HEAD`. The edited
  working-tree file is still what `submit` and `amend` commit: content from the working tree, state
  from `HEAD`.
- (characterization) The existing transition suites stay green. `spec-006` §6's table no longer lists
  these reads as deviations, and `spec-008` §11 likewise; both are amended with a dated Revision note.

## Implementation Notes

- **kind:** fix · **wave:** 1 (added after `commit-backlog`, from `task-161`'s independent review).
- **Implements:** `spec-006` §6 item 1; `dl-080`; closes `bug-187`.
- **Features:** P1.6–P1.9.
- **Notes:**
  - Use `findMemoryDocumentByTypeAndIdAtRev` and `loadMemoryYamlAtRev` from `task-137` at the sha
    resolved once.
  - `task-132`'s `beginMemoryTransition` is the single preamble to change.
  - `bug-108` (`directive remove` resolves its name in the working tree) is the same class but a
    different command, not in scope.
- Added on 2026-10-02 by the approver's triage of `bug-187`
  (`bug-ingest-rel-v0.3-w1b2-review-findings-plan`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop. -->
