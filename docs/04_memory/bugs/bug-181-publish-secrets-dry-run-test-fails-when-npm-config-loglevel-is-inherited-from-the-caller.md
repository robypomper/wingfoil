---
id: bug-181-publish-secrets-dry-run-test-fails-when-npm-config-loglevel-is-inherited-from-the-caller
type: bug
title: "publish-secrets dry-run test fails when npm_config_loglevel is inherited from the caller"
status: planned
severity: "low"           # REQUIRED — critical | high | medium | low
release-origin: "v0.3"     # optional — release where the bug was FOUND (dl-016), e.g. "v0.1"
release: "v0.3"            # optional — fix/implementation release, stamped by release-planning/build-backlog (dl-016)
feature: "P5.2"            # optional — related feature ID, e.g. "P1.6"
contributor: ""        # optional — who originated this contribution, if not the git author (dl-020); credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note (dl-020)
tmpl_version: 260703   # Orignal template version
tags: ["v0.3","test"]
---

## Summary

`test/cli/publish-secrets.test.ts`'s dry-run test fails when the suite is started with `npm run -s`. Its helper `npmEnv()` spreads `process.env`, so the inner `npm publish` inherits `npm_config_loglevel=silent` and prints nothing.

## Steps to Reproduce

1. `npm_config_loglevel=silent npx jest test/cli/publish-secrets.test.ts -t "dry run"`.
2. Run the same command without the variable.

## Expected Behavior

The test's result does not depend on the caller's npm environment.

## Actual Behavior

Step 1 fails with `Received string: ""` where `+ wf-fixture@1.0.0` is expected. Step 2 passes. `npm run -s test:coverage` therefore fails while `npm run test:coverage` passes.

## Notes

- Found by `task-127`'s developer and confirmed by its independent reviewer (`test/cli/publish-secrets.test.ts:291`, `npmEnv`).
- Fix: drop `npm_config_loglevel` (and any other `npm_config_*` that changes output) from `npmEnv()`.
- Same class as `bug-095`/`bug-167`: the suite's result depends on its environment. `task-146` owns that class.

## Triage & Execution Notes

Captured on 2026-10-01 from the independent review of `task-127` (`dev-loop-rel-v0.3-plan`, wave 0),
under `bug-ingest`.
