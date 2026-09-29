---
id: "task-117-remove-the-unused-anthropic-sdk"
type: task
title: "`@anthropic-ai/sdk` leaves the runtime dependencies, because nothing in `src/` imports it"
status: backlog
release: "v0.2.2"
priority: "low"
tags: ["v0.2.2", "dependencies", "first-use"]
ref: "bug-138-unused-anthropic-sdk-runtime-dependency"
bug: ["bug-138-unused-anthropic-sdk-runtime-dependency"]
depends_on: ["task-111-configuration-moves-to-the-repository-root"]
tmpl_version: 260703
---

## Description

`package.json` declares `"@anthropic-ai/sdk": "^0.110.0"` in `dependencies`, but no module in `src/`
imports it (`bug-138`). Every install downloads it for nothing. `dna.yaml` already flags the drift
from ADR-004's original framing (the `Anthropic SDK` entry under `stacks.technologies`). This closes
`bug-138`.

## Acceptance Criteria

1. `grep -rn "@anthropic-ai/sdk" src/` returns nothing, checked again when the task runs.
2. The dependency is removed from `package.json`, and `package-lock.json` is regenerated.
   `scripts/check-lockfile-pins.cjs` passes.
3. `dna.yaml`'s `Anthropic SDK` technology entry and its drift note are removed or corrected, with a
   version bump. `CLAUDE.md` §4's sentence on the SDK is left for `align-agent-docs` (`dl-025`) and
   listed in Execution Notes for it.
4. `npm pack --dry-run` shows no change in the file list; `npm test` green.

## Implementation Notes

- **Added 2026-09-29 at `task-112`'s review.** `task-112` pinned `wingfoil-released`
  (`npm:wingfoil@0.2.1`) as a devDependency, and 0.2.1 depends on `@anthropic-ai/sdk`. After this task
  the SDK leaves `package.json`'s `dependencies`, but it stays in `package-lock.json` as a dev-only
  transitive dependency of the alias until the pin advances past a build that still needs it. AC 2
  is about the direct dependency. Check the lock with `npm ls @anthropic-ai/sdk`, expecting it only
  under `wingfoil-released`, not with a "not in the lock" assertion.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
