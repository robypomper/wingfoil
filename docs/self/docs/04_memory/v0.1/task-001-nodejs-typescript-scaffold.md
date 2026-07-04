---
id: "task-001-nodejs-typescript-scaffold"
type: task
title: "Node.js/TypeScript project scaffold"
status: done
release: "v0.1"
priority: "Blocker"
tags: ["v0.1"]
ref: "adr-005-typescript-node-stack"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

Initializes the actual Node.js/TypeScript project that every other v0.1 task will build against —
today the repo is spec-only with no `src/` tree. Per `adr-005-typescript-node-stack` and
`docs/self/.wingfoil/dna.yaml`'s `tech_stack.technologies`, this task creates `package.json` (npm as
package manager), `tsconfig.json` targeting Node.js 18+, and the `src/{core,storage,memory,dna,
directives,workflow,cli,mcp-server}` module layout from `dna.yaml`'s `modules:` section. It adds
Commander.js + chalk (CLI surface), the Model Context Protocol SDK + Anthropic SDK (MCP server), and
Zod (validation) as dependencies, plus Jest + ts-jest as the test runner with a coverage threshold,
and wires `npm run build`/`npm run lint`/`npm test` scripts. Without this scaffold no TDD/Jest work
on any other v0.1 task (including `task-002`) has anywhere to live.

## Acceptance Criteria

- On a clean checkout, `npm install && npm run build && npm test` all succeed (empty/placeholder
  test suite is acceptable at this stage).
- `tsconfig.json` compiles under Node.js 18+ with strict mode enabled.
- `package.json` declares Commander.js, chalk, the MCP SDK, Anthropic SDK, and Zod as dependencies,
  and Jest + ts-jest as dev dependencies, matching `dna.yaml`'s `tech_stack.technologies` list.
- Jest is configured with a coverage threshold of >80%, per `dna.yaml`'s Jest `notes: coverage
  target >80%` and the `testing` directive (`docs/self/.wingfoil/directives/custom/`).
- The `src/` module directories match `dna.yaml`'s `modules:` list (`core, storage, memory, dna,
  directives, workflow, cli, mcp-server`), even if most start as empty stubs.
- `npm run lint` runs cleanly against the empty scaffold (no lint errors on generated boilerplate).

## Implementation Notes

- Scope is limited to the local dev scaffold — CI pipeline and npm-registry publish config are out
  of scope here and belong to a later packaging/release-automation task (tracked against
  `REQ-SYS-09`), not this one.
- Follow `adr-005-typescript-node-stack`'s Decision section literally: TypeScript, Node.js 18+, npm,
  semantic versioning — do not substitute an alternate runtime or package manager.
- Keep the module boundaries in `src/` aligned with `dna.yaml`'s `modules:` list from the start, so
  later tasks (e.g. `task-002`'s `src/validation`) drop into an already-coherent layout rather than
  forcing a restructure.

## Execution Notes

- **design:** Checked scope against `adr-005-typescript-node-stack` and `dna.yaml`. Both already pin
  every scaffold decision this task needs (language, runtime floor, package manager, exact dependency
  list, module layout, coverage target) — no gap found, no new `tech-spec` needed. Phase passed
  straight through, as expected.
- **red:** Bootstrapped just enough to make `npm test` runnable — `package.json` (name `wingfoil`,
  scripts, `engines.node >=18.0.0`), `tsconfig.json`/`tsconfig.build.json`, `jest.config.js` (ts-jest
  preset), `.gitignore` — then added `test/core/module-layout.test.ts` asserting the 8 `src/` module
  directories from `dna.yaml`'s `modules:` list exist. Ran red (8/8 failing, `src/` didn't exist yet),
  then committed.
- **green:** Built the full scaffold: `src/{core,storage,memory,dna,directives,workflow,cli,mcp}`
  (see path deviation below) with stub `index.ts` files; installed all `dna.yaml` dependencies
  (`commander`, `zod`, `@modelcontextprotocol/sdk`, `@anthropic-ai/sdk`) and dev dependencies
  (`typescript`, `jest`, `ts-jest`, `@types/jest`, `@types/node`), plus ESLint (`eslint`, `@eslint/js`,
  `typescript-eslint`) since no lint tool was already implied anywhere and flat-config ESLint + the
  `typescript-eslint` recommended ruleset is the standard choice for this stack. Ran
  `npm install && npm run build && npm test && npm run lint` on a clean checkout (`rm -rf node_modules
  dist coverage && npm install ...`) — all four passed. Deviations/judgement calls:
  - **`mcp-server` module path.** The task's own Description prose lists `src/mcp-server`, but
    `dna.yaml`'s `modules:` entry for that module sets `name: mcp-server` with `path: src/mcp`
    explicitly. Followed `dna.yaml`'s literal `path:` field (the cited, authoritative source) rather
    than the name-derived path implied by the prose — created `src/mcp/index.ts`, and the test
    asserts `src/mcp`, not `src/mcp-server`. Documented on the stub file itself.
  - **`chalk` pinned to `^4.1.2`, not latest (`^5.x`).** `chalk@5+` is ESM-only; this project's
    `tsconfig.json` compiles to `module: Node16` and `package.json` has no `"type": "module"`, so a
    `require('chalk')` at runtime (from compiled CommonJS output) would fail against `chalk@5`.
    `chalk@4` is the last CJS-compatible major and keeps the whole toolchain on one module system
    without forcing an ESM migration this task doesn't own.
  - **`tsconfig.json` uses `module`/`moduleResolution: Node16`, not the classic `CommonJS`/`node`
    pair.** TypeScript 6.0 (current on npm) deprecates `moduleResolution: node` (a.k.a. `node10`) as a
    hard error without an explicit `ignoreDeprecations` escape hatch; `Node16` is the modern,
    non-deprecated equivalent for a plain Node/CommonJS project. Added `isolatedModules: true`
    alongside it — ts-jest otherwise warns (TS151002) that the `Node16` "hybrid module kind" requires
    it.
  - **`@types/node` pinned to `^18` (not latest `^2x`)**, matching the `engines.node >=18.0.0` floor,
    so stub/future code doesn't typecheck against Node APIs newer than the minimum supported runtime.
  - **Coverage threshold vs. the empty-stub problem** (per the acceptance criteria's explicit
    allowance): `jest.config.js` declares `coverageThreshold.global` at 80/80/80/80 (satisfies the
    "Jest is configured with a coverage threshold of >80%" criterion) and scopes
    `collectCoverageFrom` to `src/**/*.ts` excluding `src/**/index.ts` (today's stub files are *all*
    bare `index.ts` re-export placeholders with no real logic). Coverage collection itself is **not**
    part of the default `npm test` script — it's opt-in via a separate `npm run test:coverage`
    (`jest --coverage`) script — so `npm test` never spuriously fails on an empty suite. Verified
    `npm run test:coverage` currently exits `0` (collectCoverageFrom matches zero files at this stage,
    so the threshold is vacuously satisfied rather than actively enforced). As soon as a later task
    adds real logic files under `src/**` with tests, both the scoping and the threshold become live.
- **refactor:** Only cleanup found: dropped the empty `"author": ""` placeholder field `npm init`
  left in `package.json` (dead/unset field). Re-ran `npm run build && npm test && npm run lint` — all
  still green; no functional change.
- **review:** Checked `docs/02_requirements/02_bdd/features/` — no BDD feature applies to this task
  (it's pure infra/tooling scaffolding, not a user-facing behavior any P1–P5 feature scenario
  exercises); not blocking. `npm install && npm run build && npm test && npm run lint` all pass on
  HEAD of `task/task-001-nodejs-typescript-scaffold`. Moving to `in-review` for the `approver` gate.
