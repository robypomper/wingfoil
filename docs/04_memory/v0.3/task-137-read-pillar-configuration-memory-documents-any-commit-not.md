---
id: "task-137-read-pillar-configuration-memory-documents-any-commit-not"
type: task
title: "Read the pillar configuration and the Memory documents at any commit, not only at `HEAD` or in the working tree"
status: in-progress
release: "v0.3"
kind: "feature"
priority: "high"
tags: ["v0.3", "agent", "context", "determinism", "storage"]
ref: "spec-012"
bug: []
depends_on: []
tmpl_version: 260703
---

## Description

`spec-012` §2 pins a context to `stateRef`, a commit sha, and `spec-016` §2.4 has the MCP Prompt resolve "at the pinned `state`, not the working tree". The agent commits while it runs, so `state` is an older commit than the `HEAD` of the moment the Prompt is fetched. Today only `…AtHead` readers exist, and nothing lists or reads Memory documents at a revision. This task adds `…AtRev(root, rev)` for DNA, `memory.yaml`, directives and roles. The existing `…AtHead` functions are kept as `rev = 'HEAD'`. It also adds a Memory scan at a revision (`listMemoryDocumentPathsAtRev`, a document summary at rev, and a by-type-and-id lookup at rev), so `task-176` can build the whole context from one commit.

## Acceptance Criteria

- (characterization) Every existing `…AtHead` loader still passes its current suite unchanged after it is re-expressed through `…AtRev(root, 'HEAD')`.
- (red-first) `loadDnaYamlAtRev`, `loadMemoryYamlAtRev`, `loadDirectivesAtRev` and `loadRolesYamlAtRev` return the content committed at a given older sha. They ignore a later commit and a dirty working tree (fixture repo with two commits and an uncommitted edit).
- (red-first) The Memory scan at a revision lists and parses exactly the element documents committed at `rev`, in the same sorted order as `listMemoryDocumentPaths`. A document added after `rev`, or present only in the working tree, is absent. Its by-id lookup returns the frontmatter and body as of `rev`.
- (red-first) An unknown or malformed `rev` fails with a `CoreError` that names the rev. It does not return an empty result: an empty result would hand a wrong context to an agent.
- (characterization) No wall-clock, randomness or unordered iteration appears in these paths (REQ-SYS-07). Two calls with the same `(root, rev)` are deep-equal.

## Implementation Notes

- **Size:** M · **wave:** 1 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** spec-012 §2 (`stateRef`), §8; spec-016 §3.3 step 7; adr-012 point 3.
- **Features:** P5.4.4, P5.4.3.
- **Notes:** Proposal key: B01. touches `src/core/loaders.ts`, `src/memory/query.ts` (or a sibling), and `src/storage/commit.ts` if a batched reader is needed. **Possible overlap with domain A/C:** `spec-017` §1.1 deduction reads Memory at `HEAD` and needs the same scan. Whichever task lands first owns the primitive, and the other one depends on it.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
