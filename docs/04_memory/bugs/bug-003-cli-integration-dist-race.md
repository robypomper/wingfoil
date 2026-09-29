---
id: "bug-003-cli-integration-dist-race"
type: bug
title: "CLI integration suites race on a shared dist/ rebuild, causing flaky jest failures"
status: closed
severity: low
release-origin: "v0.1"
release: "v0.1"
feature: ""
tmpl_version: 260703
---

## Summary

The two CLI integration suites — `test/cli/program.integration.test.ts` and
`test/cli/npm-distribution.test.ts` — each `rmSync(dist)` and then `tsc`-rebuild the **same** `dist/`
directory in their `beforeAll`, so when jest runs them in parallel workers one suite can delete/rebuild
`dist/` while the other is spawning `node dist/cli.js`, producing an intermittent failure that passes
on a plain re-run.

## Steps to Reproduce

1. From the repo root, run the full suite: `npx jest` (default parallel workers).
2. Repeat a few times (the race is timing-dependent).
3. Occasionally one CLI integration assertion fails — observed as a non-zero/′file not found′ result
   from a spawned `node dist/cli.js` in `npm-distribution.test.ts` — while an isolated run
   (`npx jest test/cli/npm-distribution.test.ts`) is always green.

## Expected Behavior

The full test suite is deterministically green regardless of jest's worker scheduling — no test
outcome depends on the relative timing of two suites that happen to share a build directory
(coherent with the project's determinism north star / REQ-SYS-07 in spirit).

## Actual Behavior

Intermittent: a single CLI integration test fails when the other suite's `beforeAll`
`rmSync(DIST_DIR)` + `tsc` runs concurrently, wiping or half-rebuilding `dist/` between the spawn
target being resolved and executed. Re-running `npx jest` goes green (observed: 1 failed → 248 passed
on immediate re-run).

## Notes

- **Root cause:** both suites define `DIST_DIR = <repo>/dist` and, in `beforeAll`, do
  `rmSync(DIST_DIR, { recursive: true, force: true })` followed by `tsc -p tsconfig.build.json`. Jest
  executes test *files* in parallel worker processes by default, so the two `beforeAll`s (and the
  `node dist/cli.js` spawns that follow) interleave on the same path. Each file's header comment
  explicitly chose to "perform its own clean build rather than share `dist/`" — but they still share
  the same `dist/` **location**, which is exactly what races.
- **Pre-existing:** predates the bug-001/bug-002 fix work; that work only widened the window by adding
  more spawn-based assertions ([[project_cli-bugs-fix]]).
- **Workaround:** re-run the suite, or run the CLI integration files serially
  (`npx jest --runInBand test/cli`).
- **Suggested fixes (pick one):** (a) build `dist/` once in a jest `globalSetup` / `pretest` step and
  have the suites *not* rebuild; (b) give each suite a unique build dir (e.g. `dist-<suite>/`); or
  (c) force these two files onto a single worker (jest `--runInBand` for `test/cli`, or a shared
  serial project config). Option (a) also removes the redundant double `tsc` build cost.

## Triage & Execution Notes

- triage (bug-ingest, 2026-07-05): severity **low** — test-infrastructure flakiness only, no product
  or user impact, and a re-run is green. It does, however, weaken the CI signal and the determinism
  guarantee, so it is worth fixing (cheaply) before it masks a real regression. Awaiting the
  triage-acceptance gate (`open → triaged`).

## Resolution

Fixed on branch `fix/bug-003` (bug-centric flow, no separate fix task — see
`docs/05_plans/X_fix-bug-003-plan.md`). Adopted option (a):

- **`test/global-setup.cjs`** (new) — a jest `globalSetup` that `rmSync(dist)` + `tsc -p
  tsconfig.build.json` **once**, before any worker starts.
- **`jest.config.js`** — registers `globalSetup`.
- **`test/cli/program.integration.test.ts`** — `beforeAll` no longer builds; it only asserts
  `dist/cli/program.js` exists. Removed now-unused `execSync`/`rmSync` imports; header comment updated.
- **`test/cli/npm-distribution.test.ts`** — dropped its build `beforeAll` entirely (the
  `compiles a dist/cli.js bin entrypoint` case still asserts the product); removed the unused
  `execSync` import; header comment updated.

Effect: no shared-directory race (single pre-worker build) **and** one `tsc` build per run instead of
two. Verified green across **3 consecutive full `npx jest` runs** (255 tests each), eslint + tsc clean.
Accepted trade-off: `globalSetup` builds `dist/` on every `npx jest` invocation, including non-CLI-only
runs that previously built nothing — a single ~second `tsc`, and full runs are now faster overall.
