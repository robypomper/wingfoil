---
id: "task-112-a-pinned-released-build-develops-wingfoil"
type: task
title: "A pinned, published WingFoil build manages the project, and `.mcp.json` registers its MCP server"
status: in-progress
release: "v0.2.2"
priority: "high"
tags: ["v0.2.2", "dogfooding", "mcp", "tooling"]
ref: "dl-095-which-wingfoil-build-develops-wingfoil"
bug: []
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here can never leave `triaged`. A single string is still accepted for documents predating dl-045.
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-111-configuration-moves-to-the-repository-root"]
tmpl_version: 260703
---

## Description

Once the configuration is at the root (`task-111`), the project is managed by a WingFoil build. That
build must be a **published, pinned** one, not the one under development (`dl-095`, ratified Q1 (a),
Q2 (i), Q3 (B)). This task also delivers `dl-026`, the MCP server registered in the repository so
agents consume WingFoil's own server. `dl-095` Q2 (i) amends `dl-026`'s registration command: the
pinned build needs no build step, so `dl-026`'s option (b) `prepare` hook is no longer needed.

## Acceptance Criteria

1. **Q1 (a).** `package.json` has the devDependency `"wingfoil-released": "npm:wingfoil@0.2.1"`,
   exact, recorded in `package-lock.json`, and covered by `scripts/check-lockfile-pins.cjs`. `dl-095`
   asks for two behaviours to be confirmed before they are relied on:
   - npm installs the alias although the package is itself named `wingfoil`;
   - inside the repository, a command reaches the pinned binary and not the local `bin`. This
     package's own name is `wingfoil`, so check which binary `npx wingfoil` resolves to.

   Both results go in Execution Notes. If `npx wingfoil` resolves to the local package, the documented
   command is the alias's binary path or an npm script, and the precondition in AC 4 uses that.
2. **Q2 (i) with `dl-026`.** A root `.mcp.json` registers the pinned build's `mcp` command. A fresh
   clone followed by `npm ci` gives a working server with no build step. `COLLABORATION.md` gets the
   contributor setup and the equivalent registration for other MCP clients, as `dl-026`'s ratification
   requires.
3. **`dl-026`'s re-verification.** The `e2e-smoke` workflow's checks gain the step that verifies the
   registered server's channel set. `dl-026` placed it in that gate.
4. **Q3 (B).** `release-planning.yaml` gains a precondition step: the pin moves forward only, to
   published builds, one commit per switch. Every phase plan's preconditions gain "the build in use is
   the pinned one" (`dl-095` Actions), using the command established in AC 1.
5. `npm test` green.

## Implementation Notes

- The switch to `0.2.2` after the `v0.2.2` tag is **not** this task. It is the first application of
  Q3 (B), in v0.3, at §6.8 step 7.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
