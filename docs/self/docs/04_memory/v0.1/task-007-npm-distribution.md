---
id: "task-007-npm-distribution"
type: task
title: "Infrastructure: REQ-SYS-09 — npm distribution"
status: in-review
release: "v0.1"
priority: "Medium"
tags: ["v0.1", "architecture"]
ref: "REQ-SYS-09"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

REQ-SYS-09 requires WingFoil to ship as an installable **npm package** exposing the `wingfoil` CLI —
per the MVP success criterion "Published to npm with documentation" (`08_mvp-canvas.md`). This task
covers the packaging concerns that sit outside any single pillar module: a `package.json` with a `bin`
entry (`"wingfoil": "./dist/cli.js"` or equivalent) so `npm install -g wingfoil` places the command on
`PATH`, a build step that compiles the TypeScript sources under `src/` (per `dna.yaml` tech stack:
TypeScript / Node.js 18+) to a runnable `dist/`, and the published package's shipped documentation
(README + command reference) so `wingfoil --help` and the npm page are self-sufficient for a new user.

Because this is foundational, cross-cutting infrastructure — not the delivery of any single CLI
command's behavior — it is not tied to one feature story; the v0.1 backlog entry (`TASK-005`) notes its
`related_stories` are intentionally empty for exactly this reason.

## Acceptance Criteria

Per the SARD fit criterion (`docs/02_requirements/03_sard/01_architecture.md`, REQ-SYS-09):

> `npm install -g wingfoil` makes the `wingfoil` command available on PATH and `wingfoil --help` exits
> 0; the published package includes README + command docs.

Testable form:
- A global install (`npm install -g wingfoil`, or the local-tarball equivalent in CI) resolves the
  `wingfoil` binary on `PATH`.
- `wingfoil --help` exits with code `0` (per the CLI exit-code contract, `spec-005`) and prints usage.
- The published npm package artifact includes a `README.md` and command documentation (not just
  compiled JS).

## Implementation Notes

- No dedicated tech-spec owns npm packaging specifically among the 12 approved specs; this task should
  follow `spec-005-cli-command-contract` (exit-code contract that `wingfoil --help` must satisfy) and
  `dna.yaml`'s `stacks.technologies` (npm, TypeScript/Node 18+) as the binding constraints, and flag in
  Execution Notes if a dedicated packaging spec turns out to be needed during `dev-loop`'s design gate.
- `spec-011-storage-layout` is relevant background for what the published package must **not** ship
  (the dogfooding `docs/self/.wingfoil/` content is project-local config, not part of the npm artifact).
- Related feature work: none — per backlog `TASK-005` (`docs/03_backlog/04_backlog/by-release/v0.1.json`),
  `related_stories` is intentionally empty: "foundational/cross-cutting infrastructure (npm
  distribution) not tied to a single story."

## Execution Notes

- **design:** `agent.verify_specs` confirmed the Implementation Notes' expectation — no approved
  tech-spec owns npm packaging specifically among `spec-001..013`. Bound the work to
  `spec-005-cli-command-contract` §1 (exit-code contract: `--help` always exits `0`, takes precedence
  over all other flags) and `dna.yaml` `stacks.technologies` (npm, TypeScript/Node.js 18+) instead. Did
  **not** hard-stop, per the task's own instruction. **Design-gap flag (for an `approver` decision, not
  acted on here):** packaging turned out to need a handful of real decisions with no spec backing them
  — the `files` allowlist shape, `prepack` vs `prepublishOnly` as the build-hook, and where the `bin`
  entrypoint lives (`src/cli.ts` vs. e.g. `src/bin/wingfoil.ts`). None of these were hard, but a future
  release with more packaging surface (multiple bins, published `built-in/` directive or workflow
  templates once those ship — see `spec-011`'s note that `directives/built-in/` and `workflows/built-in/`
  are still empty) may warrant a dedicated `spec-014-npm-packaging` before that grows ad hoc.
- **red:** `test/cli/npm-distribution.test.ts` added — three cases: (1) `dist/cli.js` exists after a
  clean build, (2) spawning it with `--help` exits `0`/prints usage/empty stderr, (3) `npm pack
  --dry-run --json`'s file list includes `dist/cli.js` + `README.md` and excludes
  `docs/self/.wingfoil/*` + `test/*`. Confirmed all three FAIL pre-implementation: no `src/cli.ts`
  existed (so no `dist/cli.js` to spawn), and `package.json` had neither a `bin` nor a `files` field —
  a plain `npm pack --dry-run --json` at that point actually shipped **the entire repository**
  (`docs/`, `test/`, `CLAUDE.md`, `docs/self/.wingfoil/`, everything — 441 entries), because npm's
  `.gitignore`-fallback packing (no `.npmignore` present) does not exclude the gitignored `dist/`
  either once it exists on disk from a prior build; verified this by hand with `npm pack --dry-run
  --json` before writing the fix.
- **green:** Added `src/cli.ts` — the real `bin` entrypoint, the production counterpart of task-006's
  `test/cli/fixtures/cli-harness.cjs`: calls `buildProgram(CORE_MODULES, { resolveRoot: () =>
  resolveProjectRoot(process.cwd()), buildParams: (ctx) => ({ root: ctx.root }) })` then
  `.parseAsync(process.argv)`. Compiles to `dist/cli.js` (shebang `#!/usr/bin/env node` preserved
  verbatim by `tsc`, confirmed by inspecting the compiled output). `resolveRoot` is only invoked
  lazily, per dispatched command (`src/cli/registrar.ts`'s `run`), so `--help`/`--version` — handled by
  `commander` itself before any handler runs — exit `0` even outside a git repository; this is what
  lets `wingfoil --help` satisfy spec-005 §1 unconditionally. `package.json` gained: `"bin": {
  "wingfoil": "./dist/cli.js" }`; `"files": ["dist", "README.md"]` (an explicit allowlist, not a
  `.npmignore` — deliberately excludes `docs/`, `test/`, `docs/self/.wingfoil/`, and
  source-only cruft regardless of `.gitignore` quirks); a `"prepack": "npm run build"` script so both
  `npm pack` and `npm publish` always ship a freshly-compiled `dist/` (verified empirically that
  `prepack` — not `prepublishOnly` — is the hook that actually runs on a bare `npm pack`). `main`/
  `types`/`engines` were already correct from task-001/task-006 and were left untouched.
- **README boundary:** a repo-root `README.md` already existed before this task (written during the
  Lean Inception / vision phase, not by a prior dev-loop task) — it already covers project identity,
  install instructions, and a CLI command listing, satisfying this task's AC ("published package
  includes README + command docs"). It was left unchanged: its command listing documents the full,
  eventual v0.1+ surface (`memory add`, `dna set`, `directive create`, `workflow status`, …), most of
  which is not implemented yet (`src/core/index.ts`'s `CORE_MODULES` today only wires `dna show`,
  `directives list`, `workflow list` — task-006's deliberate scope). Reconciling the README with the
  *actual* implemented command surface, flags, and exit-code examples is `task-032-readme-cli-quickstart`'s
  explicit, later scope (it is gated on `task-020/023/025/026/028/029` landing first) — not duplicated
  here.
- **refactor:** `npx eslint .` initially failed on the new test file (`no-useless-assignment` on a
  `let stdout = ''` that was always overwritten before being read); refactored the `--help` spawn
  assertion into a small `runBin()` helper mirroring `program.integration.test.ts`'s existing
  `runCli()` pattern instead of inlining a second try/catch shape. `npx jest --coverage`: 214/214
  passing across 26 suites, 98.38% statements / 91.1% branches / 100% functions / 98.94% lines overall
  (threshold 80% met). `src/cli.ts` (and pre-existing `src/cli/program.ts`) do not appear in the
  coverage report at all rather than as 0% — same platform limitation `program.ts`'s own module doc
  already documents (`commander` v15 is ESM-only; Jest's forced-empty-coverage collection silently
  drops files it cannot safely load, rather than scoring them 0%), not something introduced or gamed by
  this task — `collectCoverageFrom` in `jest.config.js` was left untouched, no new exclusion added for
  `cli.ts`. `npx tsc --noEmit` and `npx eslint .` both exit `0`.
- **review:** Full `npx jest` (214/214) + `npx tsc --noEmit` + `npx eslint .` all clean immediately
  before submit. Manually re-verified the AC end-to-end: `node dist/cli.js --help` exits `0` and prints
  usage; `npm pack --dry-run --json` on the final tree lists exactly `README.md`, `package.json`, and
  every `dist/**` file (150 entries total) — no `docs/`, no `test/`, no `docs/self/.wingfoil/`. No
  rejection this pass.
