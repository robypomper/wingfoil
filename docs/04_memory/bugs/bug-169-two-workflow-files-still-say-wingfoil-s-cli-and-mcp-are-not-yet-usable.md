---
id: bug-169-two-workflow-files-still-say-wingfoil-s-cli-and-mcp-are-not-yet-usable
type: bug
title: "Two workflow files still say WingFoil's CLI and MCP are not yet usable"
status: in-progress
severity: "low"
release-origin: "v0.2.2"
release: "v0.3"
feature: "P4.1"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

The header comments of `.wingfoil/workflows/custom/initial-design.yaml` and `wingfoil-init.yaml`
state that WingFoil's CLI and MCP server are "not yet usable", so their outputs are produced by hand
for this project. That has been false since v0.2 shipped the CLI, and since `task-111` the CLI runs on
this repository's own configuration.

## Steps to Reproduce

1. `grep -rn -i 'not yet usable' .wingfoil/` (on `docs/user_docs_v0.2.2` at `f9d9337c`).
2. Two hits:
   - `initial-design.yaml`, header: *"NOTE: WingFoil's CLI/MCP is not yet usable, so for THIS
     project these outputs are produced MANUALLY"*;
   - `wingfoil-init.yaml`, header: the same sentence, followed by the history of the configuration's
     move. In the same file, the `config.init` action's inline comment reads *"here performed
     manually (this .wingfoil/ is hand-authored)"*.
3. `npm run -s wingfoil -- --version` → `0.2.1`, and `npm run -s wingfoil -- workflow list` answers
   on this repository's configuration.

## Expected Behavior

The comments describe the tool as it is:
- the CLI and the MCP server ship and read this repository's configuration;
- there is no workflow engine yet (`workflow list` is the only workflow command, and it is
  read-only), so a phase's actions are still carried out by hand, against a `plan` (`dl-019`);
- `memory.add` and the transition verbs can be run through the CLI, within the pinned build's limits.

## Actual Behavior

Both comments claim the whole CLI/MCP is unusable. An agent reading the workflow definitions, which
is the path `CLAUDE.md` §6 sends it down, is told to do by hand what the pinned build does.

## Notes

- **Found** by `user-docs-rel-v0.2.2-plan` S2, from `task-111`'s Execution Notes (AC 5), which listed
  these two comments among the `align-agent-docs` items. Neither file is in any phase's
  `produces:` (`user-docs.yaml` v1.1 names `CLAUDE.md` and `.wingfoil/README.md`), so the phase files
  them rather than editing them (`bug-ingest-rel-v0.2.2-user-docs-findings-plan`).
- **Duplicate search:** `grep -rl -i 'not yet usable' docs/04_memory/bugs docs/04_memory/design/dls`
  finds none about these files. `bug-074` (closed) was the same claim in `CLAUDE.md`.
- **Fix size:** two comment blocks and one inline comment. No schema or behaviour change. Editing
  either file bumps its `version:` (`doc-versioning`).

## Triage & Execution Notes

<!-- Filled at triage (bug-ingest) and by the fix task. -->
