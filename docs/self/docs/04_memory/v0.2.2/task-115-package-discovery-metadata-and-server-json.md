---
id: "task-115-package-discovery-metadata-and-server-json"
type: task
title: "The package carries its discovery metadata and a `server.json`, and the tag gate keeps every copy of the version equal"
status: pending
release: "v0.2.2"
priority: "high"
tags: ["v0.2.2", "publishing", "metadata", "mcp"]
ref: "dl-093-package-metadata-for-discovery"
bug: []
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here can never leave `triaged`. A single string is still accepted for documents predating dl-045.
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: []
tmpl_version: 260703
---

## Description

The published package carries no discovery metadata (`dl-093`, ratified (a)). `dl-091` fixed the
identity it needs:
- display name WingFoil;
- MCP namespace `io.github.wingfoil/wingfoil`;
- category line "The repo-native intent layer for AI-native software engineering".

The file-level contract is `spec-015` §1, §1a and §4 as amended on 2026-09-29.

## Acceptance Criteria

1. `package.json` gets three fields:
   - `description`: one line that a registry listing shows whole, with the display name. It may carry
     the category line.
   - `keywords`: at least `spec-015` §1's list, starting from the union with the visibility session's
     list (`release-planning-rel-v0.2.2-plan`, *Visibility session outcome* §D). The approver settles
     the final list at review.
   - `mcpName`: `"io.github.wingfoil/wingfoil"`.
2. `server.json` at the root: `name` equal to `mcpName`, the description, the repository URL, and one
   `packages[]` entry for npm `wingfoil` over `stdio` with the argument `mcp`. It is not in `files`.
   The shape is checked against the MCP Registry's published schema, with its source and the date
   read recorded in Execution Notes.
3. `checkReleaseTag` (`scripts/check-release-tag.cjs`) also asserts that `server.json` `version` and
   every `packages[].version` equal `package.json` `version`. The cases are pinned in
   `test/cli/publish-metadata.test.ts`. *Red-first.*
4. `npm publish --dry-run` shows the same file manifest as before.
5. `npm test` green.

## Implementation Notes

- The repository URL is the one current when the task runs. The switch to `wingfoil/wingfoil` is
  `task-116`, including `server.json` if it names the repository.
- Publishing to the MCP Registry is not in this task: it happens with the approver at publication
  time (`dl-093` point 6, `dl-130`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
