---
id: "task-120-subcommand-help-describes-every-command"
type: task
title: "Every command's `--help` describes the command, names its arguments and explains its options"
status: pending
release: "v0.2.2"
priority: "medium"
tags: ["v0.2.2", "cli", "help", "first-use"]
ref: "bug-128-subcommand-help-describes-no-command-and-no-argument"
bug: ["bug-128-subcommand-help-describes-no-command-and-no-argument"]
depends_on: []
tmpl_version: 260703
---

## Description

Subcommand `--help` describes nothing (`bug-128`): no command has a description, and every argument
and option reads as a placeholder. The information exists, because `docs/cli-reference.md` carries
it, but the CLI does not show it. The command surface is derived mechanically from `CORE_MODULES`
(`src/core/index.ts`). This closes `bug-128`.

## Acceptance Criteria

1. Every registered command has a one-line description, taken from the same declaration the command
   surface derives from. *Red-first:* a test walks the whole registered command tree and fails on an
   empty description.
2. Every positional argument is named for what it is (`<id>`, `<path>`, `<name>`) and marked required
   where it is. Every option has a description. The same test covers both. *Red-first.*
3. The descriptions agree with `docs/cli-reference.md`. Where they differ, one of the two is
   corrected, and `test/docs/cli-reference.test.ts` stays green.
4. No behaviour changes: parsing and exit codes are identical. *Characterization.*
5. `npm test` green.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
