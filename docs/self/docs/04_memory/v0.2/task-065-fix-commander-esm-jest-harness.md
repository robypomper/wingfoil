---
id: "task-065-fix-commander-esm-jest-harness"
type: task
title: "Fix bug-007: make CLI entry-point wiring testable under Jest (commander ESM)"
status: in-progress
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "cli"]
ref: "P5.1"
bug: "bug-007-commander-esm-jest-untestable"
depends_on: []
tmpl_version: 260703
---

## Description

Fix **bug-007**: `commander` v15 is ESM-only, so `src/cli/program.ts` / `src/cli.ts` cannot be loaded by the CommonJS Jest runtime — the CLI wiring is excluded from tests and coverage. Establish an ESM/Jest harness (or equivalent) so the wiring is exercised automatically.

## Acceptance Criteria

From `bug-007`:
- A test can import/exercise `src/cli/program.ts` under the project test runner.
- `tsc --noEmit` clean (no `TS1479` on the ESM `commander`).
- CLI entry-point wiring appears in the coverage report.
- Options: Jest ESM/`ts-jest` ESM preset, a bundling step, or pinning a CommonJS-compatible commander.

## Implementation Notes

Source: `bug-007` (triaged). Root cause: `commander@^15` ESM-only (chosen in task-001). Unblocks automated coverage of the CLI surface for all v0.2 CLI verbs. dev-loop syncs via `bug: bug-007`.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

**start** — `status: backlog → in-progress`; committed (`6d67a8b`). `bug: bug-007-commander-esm-jest-untestable`
→ `bug.sync_state` advanced the bug `planned → in-progress` (`4524604`). `depends_on: []`, so
`agent.read_related` is a no-op — no upstream Execution Notes to acknowledge.

**design** (architect) — **T1 AC classification** (from `bug-007`):

| # | Acceptance criterion | Class |
|---|---|---|
| a | A test can import/exercise `src/cli/program.ts` under the project test runner | **red-first** |
| b | `tsc --noEmit` clean (no `TS1479` on the ESM `commander`) | **characterization** |
| c | CLI entry-point wiring appears in the coverage report | **red-first** |

(a) is the defect itself and must be forced with a failing test. (c) follows from (a) but is a
*separate* observable (the coverage report, not the test result) and is asserted separately.
(b) **pre-exists**: `npx tsc --noEmit` already exits 0 on this branch's HEAD — task-006 removed
`TS1479` by making the `commander` import *dynamic* plus a type-only
`import type { Command } from 'commander' with { 'resolution-mode': 'import' }`. So (b) is a
regression guard, not a red: the fix must not reintroduce `TS1479`, which is checked by the
`refactor` gate `npx tsc -p tsconfig.build.json` plus a full-project `npx tsc --noEmit`.

**Measured starting point** (`npx jest --coverage --maxWorkers=2` on this branch, before any change):
74 suites / 966 tests green; global `98.1 % stmts / 89.65 % branch / 98.33 % funcs / 98.85 % lines`;
`src/cli` group at `93.69 / 85.45 / 77.77 / 94.17`. **Neither `src/cli/program.ts` nor `src/cli.ts`
appears in the report at all** — not even at 0 % — which is (c)'s red.

- **Why they are invisible (mechanism, measured — extends `task-049`'s disclosure).** It is not
  `collectCoverageFrom`: both files match `src/**/*.ts` and neither is an `index.ts`. Jest discovers
  *untested* files to report at 0 % by crawling `roots`, and `jest.config.js` sets
  `roots: ['<rootDir>/test']` — so `src/` is never crawled and **only src files that some test
  actually `require`s can ever appear**. `src/core/index.ts` (task-049's finding) is additionally
  excluded by the `!src/**/index.ts` glob, but every other unreferenced `src/` file is silently
  absent for this second, broader reason. Consequence for this task: once a test loads `program.ts`
  and `cli.ts` they enter the denominator, so the **global percentage can move in either direction**;
  both figures are recorded in `refactor`/`review` below.

- **Spec verification (`agent.verify_specs`): no new `tech-spec` needed.** No approved spec pins the
  project's *test harness*: `spec-005-cli-command-contract` (exit codes, `--format` envelope) and
  `spec-008-cli-grammar` (`<noun> <verb>` grammar) specify CLI *behaviour*, which is already covered;
  neither says how that behaviour is to be executed under test. `spec-006-core-domain-api` §4 defines
  the registrar both surfaces derive from, and `spec-015-packaging-publishing` covers `dist/`/`bin`,
  not `jest.config.js`. `bug-007` itself carries the contract ("exercised by automated tests and
  appears in the coverage report, like the rest of `src/`"). The one spec text that touches the topic
  is `spec-008` §79's illustrative `import {Command} from 'commander'` snippet, which is a grammar
  illustration, not a module-format requirement. Design passes straight through — no scaffold, so no
  approver gate.

- **Approach decision — configuration-only; no new dependency, no `package.json` change.**
  `dl-010-minimal-dependencies` (`ready`) excludes "secondary frameworks or convenience packages" and
  makes a new dependency a reviewer-gated exemption. Four routes were evaluated against the real
  repository, not from memory:

  | Route | Verdict |
  |---|---|
  | Add an ESM-capable transform (`@swc/jest`, `babel-jest`, a `vitest` migration) | **Rejected** — a new dev dependency, and `dl-010`'s spirit (`task-063` took the no-dependency route on the analogous choice). Not needed: a config-only route exists. |
  | Downgrade to a CommonJS `commander` | **Rejected** — a *production* major downgrade to work around a *test-harness* limitation; `dna.yaml` declares Commander.js as the CLI framework, and `node_modules/` is shared with three concurrent task worktrees, so a `package.json` dependency edit would also collide with them. |
  | `NODE_OPTIONS=--experimental-vm-modules` (jest's documented native-ESM switch) | **Rejected** — *verified working* (the probe below passes with zero code changes), but it only works when the flag is present: plain `npx jest` — the `refactor`-gate invocation — would still fail, and the flag cannot be set from `jest.config.js` (it must be on the node command line). Making the suite pass only under `npm test` and fail under `npx jest` is exactly the kind of invocation-dependent behaviour the determinism directive rules out. |
  | Compile the ESM barrier away **inside the test runtime only** | **Chosen** (see below). |

- **The chosen mechanism, and what it does and does not prove.** Two `jest.config.js` changes, both
  scoped to the test runtime; `tsconfig.json`, `tsconfig.build.json`, `package.json` and every file
  under `src/` are untouched:
  1. ts-jest compiles the TypeScript sources with `module: CommonJS` (via a new `tsconfig.test.json`
     that extends the real one) instead of inheriting `module: Node16`. Under `Node16`, TypeScript
     **preserves** `await import('commander')` in CommonJS output — correct for production Node, but
     jest's CommonJS runtime has no dynamic-import callback, which is the exact failure
     (`TypeError: A dynamic import callback was invoked without --experimental-vm-modules`). Under
     `module: CommonJS` the same source is downleveled to `require('commander')`.
  2. `transformIgnorePatterns: ['/node_modules/(?!commander/)']` lets that `require` resolve:
     `commander`'s own ESM `.js` is transformed to CommonJS by ts-jest on the way in. `commander`
     v15's sources use only static `import`s of node builtins and sibling files — no `import.meta` in
     executable code (verified by grep: the only occurrences are JSDoc examples) — so the transform
     is mechanical.
  - **Fidelity caveat, stated plainly:** the in-process tests therefore exercise `program.ts`'s
    *wiring logic* against a *CommonJS-transpiled copy* of commander, not against the ESM module the
    published CLI loads. The wiring logic is module-format agnostic, and the ESM path itself stays
    covered black-box by the unchanged subprocess suites (`test/cli/program.integration.test.ts`,
    `npm-distribution.test.ts`, `journey-0a.integration.test.ts`), which spawn the compiled `dist/`
    and load the real ESM `commander`. This task closes the *white-box* half of `bug-007`, as the bug
    itself frames it ("the complementary white-box fix so the wiring is unit-testable in-process").
  - **A per-file transform override was tried first and does not work.** Scoping the `module:
    CommonJS` override to just `src/cli/program.ts` (a narrow `transform` key, tried both before and
    after the broad `^.+\.tsx?$` key — the narrow regex was verified to match the absolute path)
    leaves the file compiled with the inherited `Node16` options: ts-jest resolves one shared
    `ConfigSet` per jest config, so per-entry `tsconfig` overrides do not survive alongside a second
    ts-jest entry. The override therefore has to be the single global one. The full suite was run
    under it as a pre-check: **75 suites / 968 tests green** (74 + the throwaway probe suite, which
    also adds one `it.each` case to `latency-budget-placement.test.ts`'s file scan).

- **`src/cli.ts` is brought in by a different seam.** Importing the bin entrypoint executes it
  (`buildProgram(...).then((p) => p.parseAsync(process.argv))`), so under jest it would parse *jest's*
  argv and `process.exit`. It is covered instead by mocking `./cli/program`, which also pins the one
  real drift hazard there: `cli.ts`'s `buildParams` and `test/cli/fixtures/cli-harness.cjs`'s
  `buildParams` must stay in lockstep (the harness's own header says so, and task-021 found them out
  of sync once already).

- **`test/core/latency-budget-placement.test.ts` (task-067) keeps meaning what it meant.** Its rule —
  no single test file both spawns a process and reads the wall clock — is unaffected: the new
  in-process suites spawn nothing and time nothing, and the spawn-based CLI suites are unchanged, so
  the guard still polices a live pattern rather than an empty set. Its `SCANNED_FILES.length > 40`
  self-check keeps holding (the scan grows by the new files).
