---
id: "dl-056-first-real-publishing-run"
type: decision-log
title: "The publish pipeline's real effects have never run — who owns a first real staging run before `release-publishing`, and bug-022 now sits inside the release gate"
status: in-discussion
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`task-060-publish-pipeline` (merged `117e95f`) built the spec-015 §3 pipeline so that its orchestration
is unit-tested offline with **injected fake effects**; the real effects cannot run in tests (task
Execution Notes, design point 2: "Real Verdaccio/npm effects cannot run in tests (they contact a
registry)"). Measured on `main` (`8a6a091`):

- `scripts/publish-staging.cjs` `realEffects` (`:181`, through `smoke` at `:241-242`) — Verdaccio
  install and spawn, the throwaway-user HTTP registration, `npm pack`, `npm publish`, global install —
  is referenced only by the script's own `main()` (`grep -rn realEffects test scripts` →
  `scripts/publish-staging.cjs:181,256`). No test executes it.
- `.github/workflows/publish.yml` triggers only on a `vX.Y.Z` tag push. No tag exists
  (`git tag -l | wc -l` → `0`; `git ls-remote --tags origin` → no output), so the workflow has never
  run on GitHub. The file documents a local `act` recipe, but no run of it is recorded in the task.
- What *has* run for real: the dl-023 smoke itself, against `dist/cli.js`, on every `npm test`
  (`test/cli/e2e-smoke.test.ts`).

So the first execution of the staging registry, the throwaway auth flow, the tarball install and the
promote job would be the v0.2 `release-publishing` phase itself
(`docs/self/.wingfoil/workflows/custom/release-publishing.yaml`, phase `publish`, action
`agent.execute # build + npm publish`) — on a tagged release, with the approver waiting.

**A known flake now sits inside that gate.** The `gate` job runs `npm run prepublishOnly`
(`publish.yml`), which is `npm run build && npm test && npm run lint` (`package.json`). `npm test` runs
`test/cli/npm-distribution.test.ts`, whose `:117` calls `npm pack --dry-run --json` **without**
`--ignore-scripts` — `bug-022` (`open`, severity `low`): the `prepack` hook rebuilds `dist/` while other
Jest workers spawn `node dist/cli.js`. No Jest `maxWorkers` is configured (`grep -n maxWorkers
jest.config.* package.json` → no output), so on a multi-core GitHub runner Jest runs several workers
and the race is live. `bug-022` was triaged as a test-suite flake; inside `prepublishOnly` it can fail a
tagged release. This is recorded here as an input for re-triaging `bug-022`, not as a change to it.

## Decision

*Approver to choose.*

**A — The first real run.**

1. **A pre-release staging dry run owned by a named task** (recommended): before the v0.2
   `release-publishing` phase, run `npm run publish:staging` for real on a developer machine and the
   `gate` + `stage` jobs under `act` (promote is skipped under `act` by design), and record the
   commands and output in that task's Execution Notes. Owner candidates: `task-061-publish-secrets`
   (still open, already editing `publish.yml`) or a small dedicated task. Blocks `release-publishing`.
2. **Treat the first tagged release as the dry run**, with a documented rollback (`npm deprecate` +
   patch, spec-015 §5). No extra work; the failure mode is a stuck or broken first release under
   approver watch.
3. **Publish a pre-release tag first** (e.g. `v0.2.0-rc.1`, needing the tag filter widened) to exercise
   the full GitHub path including promote to a `next` dist-tag. Most realistic, most setup.

**B — `bug-022` in the release gate.** Re-triage `bug-022` to at least `medium` and schedule its
one-argument fix (`--ignore-scripts`, as `test/cli/publish-metadata.test.ts:79` already does) before the
first tag — or, alternatively, run `prepublishOnly`'s tests with `--runInBand` in the gate. Recommended:
fix the test, since the flake also affects every developer's `npm test`.

## Rationale

- Every effect that talks to a registry, a network or the GitHub runner is currently unverified; the
  cheapest place to discover a wrong assumption is a run nobody depends on.
- `release-publishing` is an approver-gated, user-visible step; discovering a pipeline bug there costs a
  release slip, and on npm a published version cannot be quietly replaced.
- `bug-022` was severity-`low` only while its blast radius was a local flaky test run.

## Actions

- Owner **approver**: choose A and B.
- If A.1: assign the run (to `task-061` or a new task) and add it as a precondition in the v0.2
  release-publishing plan when that phase's plan is written.
- Re-triage `bug-022` in the next bug sweep with this DL as the input (no edit to `bug-022` here).

Related: `task-060-publish-pipeline`, `task-061-publish-secrets`, `bug-022`, `adr-009`, `spec-015` §3/§5,
`dl-018`, `dl-052` (Verdaccio started by the script), `dl-057` (publish pipeline hardening), `bug-023`
(the Node floor the pipeline must fix before a real publish).
