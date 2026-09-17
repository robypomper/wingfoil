---
id: "task-065-fix-commander-esm-jest-harness"
type: task
title: "Fix bug-007: make CLI entry-point wiring testable under Jest (commander ESM)"
status: done
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

**red** (developer, `065cbac`) — two new suites, **27 tests, all failing**, both on the single
`bug-007` symptom, verbatim:

```
FAIL test/cli/program.test.ts
  ● buildProgram — the program itself (bug-007: this module is now loadable in-process) › builds a real commander `Command` named `wingfoil`

    TypeError: A dynamic import callback was invoked without --experimental-vm-modules

    > 61 |   const { Command: CommandCtor } = await import('commander');
      at buildProgram (src/cli/program.ts:61:36)

FAIL test/cli/entrypoint.test.ts
  ● src/cli.ts — the `wingfoil` bin entrypoint › builds the program over the production `CORE_MODULES` and parses the real `process.argv`

    TypeError: A dynamic import callback was invoked without --experimental-vm-modules
```

- `test/cli/program.test.ts` — drives `buildProgram` against a **synthetic** `CoreModule[]` covering
  all three command shapes (`<noun> <verb>`, `<noun> <verb>` with value options, flat self-named noun
  with a boolean flag), asserting the wiring `bug-007` left unverified: the five registered global
  options, `--version` output, the derived command tree and its nesting, the shared variadic
  `[positionals...]` argument, per-command `--{flag}` / `--{name} <value>` registration, the
  `format`/`positionals`/`flags`/`options` forwarded into `registrar.run`, the `--format xml` usage
  error, commander's own `unknownCommand` exit code, and the `init`/`mcp` bootstrap registrations
  and their resolve-root failure path. `./init-command.ts` / `./mcp-command.ts` are mocked (they own
  their own suites; running them for real here would write to a repo / open a stdio MCP transport).
- `test/cli/entrypoint.test.ts` — loads `src/cli.ts` with `./cli/program` mocked, which is the only
  way to run the bin entrypoint without handing *jest's* argv to commander. Asserts the whole
  production registry is passed through unfiltered, the real `process.argv` is parsed, `resolveRoot`
  is lazy and resolves via git-root detection, the `buildParams` shape that
  `test/cli/fixtures/cli-harness.cjs` must mirror, and the last-resort `.catch` (message only, never
  the stack — `bug-002` — plus `String(error)` for a non-Error rejection).

**green** (developer, `1b8c8b0` then `9cfe300`) — configuration-only, exactly as designed; **zero**
changes under `src/`, **zero** changes to `package.json` (no dependency added, removed or repinned):

- new `tsconfig.test.json` — `extends: ./tsconfig.json`, overriding only `module: CommonJS`,
  `moduleResolution: Node10`, `ignoreDeprecations: "6.0"`, `allowJs: true`. Read **only** by
  `jest.config.js`; `npm run build`, `npx tsc --noEmit` and `npm run docs:api` keep using
  `tsconfig.build.json` / `tsconfig.json` at `module: Node16`, so the published CLI is byte-for-byte
  what it was.
- `jest.config.js` — `preset: 'ts-jest'` expanded into an explicit `transform` (the preset *is* the
  first entry, minus the `tsconfig` option) pointing both the `.ts` and the `.js` entry at
  `tsconfig.test.json`, plus `transformIgnorePatterns: ['/node_modules/(?!commander/)']` so
  `commander`'s ESM is transformed rather than ignored. `globalSetup`, `collectCoverageFrom` and the
  80 % `coverageThreshold` are untouched.
- `1b8c8b0` corrects two assertions that were written from expectation rather than observation, before
  the config change made them runnable: commander's `program.opts()` carries **only** `{format:
  'console'}` before a parse (the negatable `--no-color`/`--no-interactive` resolve to `true` only
  once argv is read), and `jest.isolateModules` hands the entrypoint its **own** module registry,
  so its `CORE_MODULES` is a different instance of the same declaration — compared structurally now,
  not by identity.

**refactor** (developer, `0fa0fb6`) — no production behaviour touched; two uncovered paths closed and
four stale comments retired:

- `src/cli.ts` reached `100 / 100 / 100 / 100` by covering `resolveRoot` itself (`resolveProjectRoot`
  is pure filesystem walking, so pointing `process.cwd()` at the repo root is deterministic and spawns
  nothing), and `src/cli/program.ts`'s `init` handler gained its `String(error)` non-Error branch.
  The one branch left uncovered in `program.ts` (line 145) is the `= []` / `= {}` **default parameters**
  of the Commander action callback: Commander always passes both arguments, so they are defensive and
  unreachable through any invocation — left as-is rather than faked.
- comments that claimed the wiring *cannot* be tested were true until `9cfe300` and are now false, so
  they were rewritten rather than left to mislead: `src/cli/program.ts`'s module doc (the only `src/`
  edit in this task — comment text only), `test/cli/registrar.test.ts`, `test/cli/program.integration.test.ts`
  and `test/cli/fixtures/cli-harness.cjs`. Each now states what it still uniquely covers: the spawn-based
  pair is the only place the **real ESM `commander`** inside the **real compiled `dist/`** runs.

**Refactor gate results** (all run in this worktree, exit codes observed, not assumed):

| Check | Command | Result |
|---|---|---|
| `tests.passing` | `npx jest --maxWorkers=2` | **exit 0** — 76 suites / 997 tests passed |
| `tests.coverage(min: 80)` | `npx jest --coverage --maxWorkers=2` | **exit 0** — global `98.18 / 89.75 / 98.4 / 98.9` |
| `docs.api.*` | `npm run docs:api` | **exit 0** |
| build typecheck | `npx tsc -p tsconfig.build.json` | **exit 0** |
| AC (b) regression guard | `npx tsc --noEmit` (whole project) | **exit 0** — no `TS1479` |
| `lint.clean` | `npx eslint .` | **exit 0** — 0 errors, 0 warnings |

`npx tsc --noEmit` caught the one real divergence this harness can produce and it was fixed rather
than suppressed: ts-jest (`Node10`) accepted `await import('../../src/cli')` in the entrypoint suite,
while the project's `Node16` resolution rejected it (`TS2835` — it wants a `.js` specifier that jest's
resolver would then not find). The suite uses `jest.isolateModules(() => require(...))` instead, with
a justified `eslint-disable` for `@typescript-eslint/no-require-imports`; the isolated registry is
needed anyway, since the entrypoint must be re-executed per test.

**Coverage — measured before and after, both from `npx jest --coverage --maxWorkers=2`:**

| Scope | Before (`4524604`) | After (`0fa0fb6`) |
|---|---|---|
| **global** | `98.1 / 89.65 / 98.33 / 98.85` | **`98.18 / 89.75 / 98.4 / 98.9`** |
| `src/cli` group | `93.69 / 85.45 / 77.77 / 94.17` | `95.95 / 87.34 / 85.18 / 96.27` |
| `src/cli/program.ts` | **absent from the report** | `100 / 91.66 / 100 / 100` |
| `src/cli.ts` | **absent from the report** | `100 / 100 / 100 / 100` |

(`% Stmts / % Branch / % Funcs / % Lines`.) Both new files entered the denominator, so the global
figure could have moved either way; it moved **up** on all four metrics, because both land at or near
100 %. Two presentation details worth knowing when diffing the two reports: the `cli` group row is now
labelled `src/cli` and a new `src` group row appears, because `src/cli.ts` sits directly under `src/`
and changes the report's common root. The suite/test counts grew 74 → 76 and 966 → 997 (29 new tests
plus the 2 extra `it.each` cases the new files add to `latency-budget-placement.test.ts`'s scan).

**review** (reviewer) — final verification in this worktree, all numbers observed:

- `npx jest --maxWorkers=2` → **exit 0, 76 suites / 997 tests passed** (23.7 s).
- BDD acceptance (`tests.bdd.run`): this task changes no CLI behaviour, so its guard is that the
  behavioural suites still pass untouched. Run explicitly together:
  `test/cli/program.integration.test.ts`, `test/cli/npm-distribution.test.ts`,
  `test/cli/journey-0a.integration.test.ts`, `test/core/latency-budget-placement.test.ts` →
  **4 suites / 122 tests passed**. `bug-003`'s single-build `globalSetup` is intact and untouched
  (`jest.config.js`'s `globalSetup` line is unchanged), so the two `dist/`-spawning suites still share
  one pre-worker build.
- **Left for someone else, deliberately not fixed here** (out of this task's scope):
  - `test/cli/npm-distribution.test.ts` runs `npm pack` **without** `--ignore-scripts` (so its
    `prepack` rebuilds `dist/` mid-run) while `test/cli/publish-metadata.test.ts` (task-059) runs it
    **with**. Both pass, and nothing in this task touches either; but the asymmetry is a latent
    sibling of `bug-003` and deserves its own bug rather than a silent edit here.
  - `package.json` declares `engines: node >= 18`, while the installed `commander@15` declares
    `engines: node >= 22.12`. Unrelated to the harness (and not a test failure), but the two
    manifests disagree about the supported floor.
  - `ignoreDeprecations: "6.0"` in `tsconfig.test.json` is the harness's only debt: TypeScript 7
    removes `node10` resolution, at which point this file needs revisiting. No behaviour depends on
    it today.
  - `src/cli/program.ts` line 145's default-parameter branch stays uncovered by design (unreachable
    through Commander).

### Post-review — the regression this task introduced, and the elements filed from it

Added after the independent review. The instance was recorded during `green`; **the regression it is
an instance of was not**, and that is the more important half.

**`dl-044-typecheck-gate-for-test-sources` — `test/**` lost its only standing typecheck gate.**
Before this change ts-jest read `tsconfig.json` (`module: Node16`), so **`npm test` itself** enforced
the project's real module semantics on test sources. It now reads `tsconfig.test.json`
(`CommonJS`/`Node10`), which is strictly more permissive. The reviewer proved it by dropping one probe
file containing `import { Command } from 'commander'` into each tree:

| | `npx jest` | `npx eslint` | `npx tsc --noEmit` |
|---|---|---|---|
| baseline `d933cbe` | **FAILS** (TS1479) | — | fails |
| head | **PASSES** | exit 0 | **fails** TS1479 |

Nothing else covers the gap: `tsc --noEmit` is not among `dev-loop`'s `refactor.checks.post`
(`dev-loop.yaml:73`), `typedoc.json` reads `tsconfig.build.json` which `exclude`s `test`,
`test/global-setup.cjs:23` builds `src` only, and `eslint.config.js` is not type-aware. Recording
`tsc --noEmit` as a hand-run AC(b) guard — which is what these notes did — is a human habit, not a
gate, and REQ-SYS-07 / the `determinism` directive say to prefer explicit declared config over
inferred behaviour. `dl-044` proposes adding `typecheck.clean`, exactly as `dl-034` added
`lint.clean`. **The `ignoreDeprecations: "6.0"` pin is tracked as an item inside `dl-044`** rather
than as its own bug: it is a loud time-bomb (hard TS5107 error, not silent drift) and is documented
where it lives.

The harness change itself should **not** be reverted to restore the gate. That the old coverage
existed at all was an accident — nobody chose ts-jest as the typecheck gate, which is why nobody
noticed when it stopped being one.

**Bugs filed from the same review:**

- `bug-022-npm-pack-prepack-rebuilds-dist` — `npm-distribution.test.ts:117` runs `npm pack` without
  `--ignore-scripts`, so `prepack` rebuilds the shared `dist/` mid-suite while other workers spawn
  from it. Its sibling `publish-metadata.test.ts:79` already passes the flag. Same class as the closed
  `bug-003`, in a different disguise.
- `bug-023-engines-node-floor-contradicts-commander` — `engines: node >=18` against `commander@15`'s
  `>=22.12`. A **published-contract** defect, not a harness note: `spec-015` §1 pins the wrong floor
  under "Unchanged", `task-059` is `done` and never validated `engines` against the dependency tree,
  and `task-060`'s staging smoke runs on CI's Node ≥22 so it would not catch it. **Scheduled v0.3** by
  the approver; must land before `task-060`/`task-061` publish for real.
- `bug-021-core-index-excluded-from-coverage` — the coverage-discovery mechanism described above,
  originally disclosed by `task-049`. Worth recording what the review **measured rather than
  assumed**: the reported ~98 % is *not* materially overstated. Re-running with the exclusion removed
  moves statements 98.18 → 98.30, branches 89.75 → 90.07 and lines 98.90 → 98.95 — all up. Only
  functions drops (98.40 → 81.64), and that is an artifact: a barrel such as `src/dna/index.ts`
  compiles to 19 `Object.defineProperty(exports, …, { get: … })` thunks, each counted by istanbul as
  an uncovered function. The one genuine hole is `src/core/index.ts`. This branch also **closed** the
  two files that were invisible at baseline (`src/cli/program.ts`, `src/cli.ts`), taking the count of
  glob-selected-but-undiscovered files from two to zero.

**Correction to the counts in these notes:** the two new suites hold **22 + 7 = 29** cases, not
17 + 12. The total is what the reviewer's machine-diff confirms (966 + 29 + 2 = 997, the +2 being
`latency-budget-placement`'s file-scan rows); only the split was misreported.
