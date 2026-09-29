---
id: "task-117-remove-the-unused-anthropic-sdk"
type: task
title: "`@anthropic-ai/sdk` leaves the runtime dependencies, because nothing in `src/` imports it"
status: in-progress
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

Branch `task/task-117-remove-the-unused-anthropic-sdk`, worktree `../.wf2-wt/task-117`, cut from
`main` at `a6e4e9f4` (W4 of `dev-loop-rel-v0.2.2-plan`). Node 22.21.0, npm 11.6.2 (`node -v`,
`npm -v`).

### design (architect)

**`depends_on` read (dl-015).** `task-111` is `done` (`grep -m1 '^status:'
docs/04_memory/v0.2.2/task-111-*.md` → `done`). What this task takes from its notes: the
configuration is at the root, so `dna.yaml` is `.wingfoil/dna.yaml` and this task's file is under
`docs/04_memory/v0.2.2/`; `task-111`'s AC 5 left `CLAUDE.md` staleness to `align-agent-docs`, but its
approver ruling (point 4) already carved out `CLAUDE.md` and `README.md` to be fixed in-task, which is
the rule applied here too (below). Also read, although not in `depends_on`, `task-112` (`done`),
which owns the other half of `package-lock.json`: its review item states that `wingfoil@0.2.1`
depends on `@anthropic-ai/sdk ^0.110.0`, so the SDK stays in the lock as a dev-only transitive of the
alias `wingfoil-released`; and `scripts/check-lockfile-pins.cjs` now has a fourth (alias) property,
which must still pass after the lock is regenerated.

**Baseline, measured at `8d4d434c` after `npm ci`.**
- AC 1: `grep -rn "@anthropic-ai" src/` → nothing (exit 1). `grep -rn anthropic src/ scripts/ test/`
  finds only `src/mcp/index.ts` line 2, a TSDoc sentence ("MCP over stdio, Anthropic SDK") — prose,
  not an import (fixed below).
- `npm ls @anthropic-ai/sdk` →
  `├── @anthropic-ai/sdk@0.110.0` and `└─┬ wingfoil-released@npm:wingfoil@0.2.1 / └── @anthropic-ai/sdk@0.110.0 deduped`.
- `npm pack --dry-run --json` file list: 339 paths.
- `npx jest --coverage --coverageReporters=text-summary` → 155 suites / 2535 tests passed; Statements
  98.62 % (3874/3928), Branches 94.18 % (1993/2116), Functions 93.79 % (650/693), Lines 99.47 %
  (3398/3416).

**Specs.** `spec-015-packaging-publishing` `approved` (`grep -m1 '^status:'`): its tarball closure is
`dist` plus `dependencies` transitively, so dropping a dependency narrows what a consumer installs and
contradicts nothing. `dl-093` (`ready`) names this removal as part of the v0.2.2 patch. No new spec.

**A guard, and what it found.** Nothing checks that a runtime dependency is actually used, which is
how `bug-138` survived two releases. A test that reads `package.json` `dependencies` and requires each
to be imported by some `src/**/*.ts` file is a genuine red today (it fails on `@anthropic-ai/sdk`).
Run by hand before writing it, it also finds **`chalk`** unimported (`grep -rn chalk src/` → one
TSDoc line in `src/cli/index.ts`, no import; `grep -rhoE "from '[^.][^']*'" src | sort -u` lists
`commander`, `js-yaml`, `zod`, `@modelcontextprotocol/sdk/*` and node builtins only). Removing
`chalk` is not this task's scope (its AC and bug name the SDK; `dl-010` lists chalk as a chosen
dependency), so the guard carries an explicit, exact exception set `{chalk}` that must equal the set
actually unimported — it fails if `chalk` gets imported or removed without the exception going too.
Reported at review as a finding with no element.

**Stale-description sweep (approver's standing rule; deviates from AC 3's "left for
`align-agent-docs`").** `git grep -n -i "anthropic"` outside the lock and the v0.1/v0.2 task files:
- fix — `.wingfoil/dna.yaml` `stacks.technologies` `Anthropic SDK` entry (AC 3): removed, version bump;
- fix — `CLAUDE.md` §4, the sentence "The Anthropic SDK is a declared dependency but is **not**
  imported…";
- fix — `docs/01_vision/01_product-brief.md` §Technical Stack, "MCP Server: … Anthropic SDK" (stated as
  current stack), version bump;
- fix — `src/mcp/index.ts` module TSDoc, "(MCP over stdio, Anthropic SDK)";
- fix, pending approver sign-off — `spec-006-core-domain-api` §Context parenthetical "(via the MCP
  server, stdio transport, Anthropic SDK)", with a dated revision note (the `spec-001` precedent);
- leave — `adr-002`, `adr-004`, `adr-005`, `dl-001`, `dl-010`: decision records, historical by nature;
  `spec-014` §Context quotes an older `dna.yaml` entry verbatim; `dl-089`, `dl-093`, `bug-138`,
  `patch-v0.2.2`, `task-112` and the two plans describe the defect or its scheduling.
`README.md` has no mention (`git grep -n -i anthropic README.md` → nothing).

**AC classification (T1).**

| AC | Class | Why |
|---|---|---|
| 1 — no `src/` import | characterization | holds today (baseline above); re-checked after the change |
| 2 — removed from `dependencies`, lock regenerated, lockfile check passes | **red-first** via the guard test | the guard fails on `@anthropic-ai/sdk` today; `check:lockfile` is characterization |
| 3 — `dna.yaml` entry, `CLAUDE.md` §4 and the sweep | configuration / documentation | no behaviour |
| 4 — pack list unchanged, `npm test` green | verification | before/after diff and the suite |
