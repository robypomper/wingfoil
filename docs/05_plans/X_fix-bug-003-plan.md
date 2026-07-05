# Plan — Fix bug-003-cli-integration-dist-race

> Interim workflow-plan (CLAUDE.md §6 / golden rule #7): stands in for the `bug`-resolution flow,
> executed by hand on branch `fix/bug-003` (dedicated worktree `.claude/worktrees/fix-bug-003`).

## Scope

Remove the flaky race between the two CLI integration suites
(`test/cli/program.integration.test.ts`, `test/cli/npm-distribution.test.ts`) that each `rmSync(dist)`
+ `tsc`-rebuild the **same** `dist/` in `beforeAll`, so parallel jest workers can wipe `dist/` mid-run
(bug-003).

## Fix (option (a) from the bug: build once, don't rebuild per suite)

- **Add `test/global-setup.cjs`** — a jest `globalSetup` that does `rmSync(dist)` + `tsc -p
  tsconfig.build.json` **exactly once**, before any worker starts.
- **`jest.config.js`** — register `globalSetup: '<rootDir>/test/global-setup.cjs'`.
- **`test/cli/program.integration.test.ts`** — drop the `rmSync`+`execSync` build from `beforeAll`;
  keep only the `existsSync(dist/cli/program.js)` sanity assertion (now guaranteed by globalSetup).
- **`test/cli/npm-distribution.test.ts`** — drop the `beforeAll` build entirely; the existing
  `it('compiles a dist/cli.js bin entrypoint')` already asserts the build product exists.
- Update both files' header comments that describe the now-removed "build in `beforeAll`" behavior so
  committed docs don't drift (documentation directive).

Net effect: no shared-dir race (single pre-worker build) **and** one build per run instead of two.

## Why not TDD red-first

This is test-infrastructure flakiness; there is no product code path and no deterministic unit test
that can assert "no cross-worker race." Verification is behavioral: run the full suite repeatedly and
confirm it is green with a single build. Traceability: bug-003; determinism directive (REQ-SYS-07 in
spirit — deterministic test outcomes).

## Checks

- `npx jest` green across **3 consecutive full runs** (no intermittent CLI failure).
- Exactly one `tsc` build per run (verify only one build log line).
- `npx tsc -p tsconfig.build.json` clean; eslint clean on changed files.

## Trade-off (accepted, documented)

`globalSetup` builds `dist/` on **every** `npx jest` invocation, including runs that target only
non-CLI tests (which previously triggered no build). Acceptable: full runs get faster (one build vs
two), and the cost is a single ~second `tsc`. Can be scoped later if it becomes a nuisance.
