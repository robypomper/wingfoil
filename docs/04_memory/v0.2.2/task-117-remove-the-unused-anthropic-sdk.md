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

### red (developer) — `c59e5094`

`test/cli/runtime-dependencies.test.ts` (new): every `package.json` `dependencies` entry must be
imported (`import … from`, `import()`, `require()`, bare `import`) by some `src/**/*.ts` file, except
the exact set `KNOWN_UNIMPORTED = ['chalk']`; plus an explicit "`@anthropic-ai/sdk` is not a runtime
dependency" case and two cases pinning that the scanner works (it sees `commander` and
`@modelcontextprotocol/sdk`; `packageOf` maps scoped/sub-path/relative/`node:` specifiers).
`npx jest test/cli/runtime-dependencies.test.ts` → `Tests: 2 failed, 2 passed`, both failures on
`"@anthropic-ai/sdk"` (received `["@anthropic-ai/sdk", "@modelcontextprotocol/sdk", "chalk",
"commander", "js-yaml", "zod"]`).

### green (developer)

- `7f282f2e` — `npm uninstall @anthropic-ai/sdk --no-audit --no-fund` (npm 11.6.2; the ordinary
  command, no hand-edit of the lock). `git show --stat` → `package.json | 1 -`,
  `package-lock.json | 8 +++++++-`. The lock diff is the root `packages[""].dependencies` line removed
  and `"dev": true` added to the seven entries of the SDK's closure, now reachable only through
  `wingfoil-released`: `@anthropic-ai/sdk`, `@babel/runtime`, `@stablelib/base64`, `fast-sha256`,
  `json-schema-to-ts`, `standardwebhooks`, `ts-algebra`. No entry added or removed; the two hoisted
  `@emnapi` entries untouched.
- Stable under a second install: `npm install --no-audit --no-fund` → `up to date`, then `cmp` against
  the committed lock → identical.
- `npm ls @anthropic-ai/sdk` → only `└─┬ wingfoil-released@npm:wingfoil@0.2.1 / └── @anthropic-ai/sdk@0.110.0`
  (before: also `├── @anthropic-ai/sdk@0.110.0` at the root). This is the Implementation Note's
  expectation.
- **Release-gate npm and a consumer-shaped install**, in a `git clone` of the branch at `7f282f2e` in
  the session scratchpad (deleted after): npm 10.9.0 (`npm install --prefix <scratch>/npm109
  npm@10.9.0`, the npm Node 22.12.0 bundles) `ci` → `added 503 packages`, exit 0, `git status --short`
  → empty; `npm run -s check:mcp` → `.mcp.json "wingfoil" runs the pinned wingfoil 0.2.1, advertising
  [prompts, resources] (prompts: 8, resources: 2)`; `npm ci --omit=dev` → `added 102 packages`, and
  `ls node_modules/@anthropic-ai` → No such file or directory.
- `npx jest test/cli/runtime-dependencies.test.ts` → 4 passed.
- `32c57d7b` — `.wingfoil/dna.yaml` 1.1 → 1.2: the `Anthropic SDK` technology entry and its drift
  note removed (AC 3). Its technology values are `[SPEC]` from the Product Brief §Technical Stack,
  which is corrected in the next commit, so the `[SPEC]` source changes with it.
- `e2730b08` — the sweep's fixes (design): `CLAUDE.md` §4 (the SDK sentence now says what happened and
  why the lock still carries it), `docs/01_vision/01_product-brief.md` 1.4 → 1.5 §Technical Stack,
  `spec-006` §Context plus a dated revision note, `src/mcp/index.ts` module TSDoc. After it:
  `git grep -n -i anthropic -- CLAUDE.md README.md docs/01_vision .wingfoil src` → only the new
  `CLAUDE.md` §4 sentence.

### refactor (developer) — checks, after `git merge main` (`7f7df681`, clean)

- After the merge: `npx tsc --noEmit` failed on the new test (`TS2322`/`TS2345`, index
  access may be `undefined` under `noUncheckedIndexedAccess`); fixed in `3e8af643`.
- `npx jest --coverage --coverageReporters=text-summary` → `Test Suites: 156 passed`,
  `Tests: 2540 passed` (baseline 155 / 2535: +4 in the new file, +1 row in
  `test/core/latency-budget-placement.test.ts`, which scans every test file —
  `npx jest test/core/latency-budget-placement.test.ts -t runtime-dependencies` → 1 passed).
  Coverage before (`8d4d434c`) and after identical: Statements 98.62 % (3874/3928), Branches 94.18 %
  (1993/2116), Functions 93.79 % (650/693), Lines 99.47 % (3398/3416). The only `src/` change is a
  TSDoc line.
- `npm run lint` → exit 0; `npx tsc --noEmit` → exit 0; `npm run docs:api` → exit 0.
- `npm run -s check:lockfile` → `package-lock.json carries every pinned entry (2 overrides pin(s),
  1 npm alias(es)) and every required peer edge resolves from the lock`, exit 0.
- `npm run -s check:mcp` → exit 0 (same line as above).
- AC 1 re-checked: `grep -rn "@anthropic-ai" src/ dist/` → nothing (exit 1).
- AC 4: `npm pack --dry-run --json` file list, sorted → 339 paths before and after, `diff` → identical.

### review (reviewer)

Unit and BDD suites green (the full `npx jest` above). Per AC:
1. `grep -rn "@anthropic-ai" src/` → nothing, at the start and at the head.
2. Direct dependency gone (`npm ls` above), lock regenerated by `npm uninstall`, `check:lockfile`
   exit 0; the lock also passes `npm ci` under npm 10.9.0.
3. `dna.yaml` entry removed (v1.2). **Deviation from the AC's wording, on the approver's standing
   rule:** `CLAUDE.md` §4 is fixed here rather than listed for `align-agent-docs`.
4. Pack file list identical; `npm test` green.

Stale descriptions **fixed**: `.wingfoil/dna.yaml`, `CLAUDE.md` §4, Product Brief §Technical Stack,
`spec-006` §Context, `src/mcp/index.ts` TSDoc. **Deliberately left**: `adr-002`, `adr-004`,
`adr-005`, `dl-001`, `dl-010` (decision records: they state what was decided then, not current fact);
`spec-014` §Context (a verbatim quotation of an older `dna.yaml` entry); `dl-089`, `dl-093`,
`bug-138`, `patch-v0.2.2`, `task-112` and plans (they describe the defect or its scheduling);
`CHANGELOG.md` (no unreleased section; its entries are written by `user-docs` from `done` tasks).

Open items for the approver, none fixed here:
- **Sign off `spec-006`'s one-word §Context revision** (revision note 2026-09-29), or reject naming
  the wording.
- **`chalk` is also an unused runtime dependency** (`grep -rn chalk src/` → only the TSDoc line
  `src/cli/index.ts:2`, no import). No element records it. The new guard carries it as the single
  `KNOWN_UNIMPORTED` exception, so removing it (or starting to use it) must drop that exception.
  Same-class stale descriptions stay until then: `CLAUDE.md` §4 "Commander.js + chalk (CLI)",
  `dna.yaml` `chalk` entry, Product Brief "chalk for formatting", `src/cli/index.ts` TSDoc,
  `spec-006` §Context. Needs a bug if it should be scheduled.
- The SDK stays in `package-lock.json` (dev-only, under `wingfoil-released`) until the pin moves
  past a build that depends on it; the next published build no longer will.
