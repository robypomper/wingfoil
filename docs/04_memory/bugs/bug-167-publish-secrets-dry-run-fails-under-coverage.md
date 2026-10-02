---
id: bug-167-publish-secrets-dry-run-fails-under-coverage
type: bug
title: "`test/cli/publish-secrets.test.ts`'s \"publishes (dry run) the tarball the step names\" fails under `npx jest --coverage` and passes on its own and under plain `npm test`"
status: closed
severity: "low"
release-origin: "v0.2.2"
release: "v0.3"
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

The case `publishes (dry run) the tarball the step names, without npm ever invoking git`
(`test/cli/publish-secrets.test.ts:303`) runs a real `npm publish --dry-run`. During `task-120` it
failed in all three full `npx jest --coverage` runs, including the baseline run on `main` at
`fa3e80b6` before any change. It passed when run alone (`npx jest test/cli/publish-secrets.test.ts`,
24/24) and in the plain `npm test` run. The pattern is a timing- or load-dependent failure of the
spawned `npm` process under coverage instrumentation and parallel workers.

## Steps to Reproduce

1. On `main` at `b9458ffe` or later, run `npx jest --coverage` (the full suite).
2. Then run `npx jest test/cli/publish-secrets.test.ts` alone.

## Expected Behavior

The case gives the same result under every runner configuration, or it declares the resource it
needs (a timeout, serial execution) so the gate does not depend on machine load.

## Actual Behavior

Step 1 fails that case (three runs out of three, reported by `task-120`'s implementer). Step 2
passes. The failure output was not captured in the report, so the fix task records it first.

## Notes

- Found at `task-120`'s review (2026-09-29). The approver ruled it a bug.
- The same family as `bug-058` (fixture teardown `ENOTEMPTY` flake under load) and `bug-003` (the
  `dist/` race, closed): tests that spawn real processes are sensitive to parallel load.
- The `refactor` gate runs coverage (`tests.coverage(min: 80)`), so a flaky failure there can block
  a task that did not touch publishing.

## Triage & Execution Notes

- fix (`task-146`, 2026-10-02): **not reproduced.** The baseline `npx jest --coverage` on
  `838746fc` passed, 200 suites / 3363 tests, exit 0, at load average ~9–13. This failure is **not**
  `bug-181`'s: only `npm run -s` exports `npm_config_loglevel=silent`. `npm run env | grep -i loglevel`
  and `npx -c env | grep -i loglevel` print nothing (verified at `task-146`'s review). The recorded
  commands are `npm run test:coverage` without `-s` (`task-120`'s Execution Notes) and
  `npx jest --coverage` (this bug), and neither exports the loglevel. The cause stays unknown. What
  guards the remaining hypothesis (a real `npm` spawn outlasting a timeout under load):
  - the case's `beforeEach` runs a real `npm pack` under jest's default 5 s hook timeout, and now
    declares 60 s like the cases;
  - green full coverage runs under heavy parallel load, recorded in `task-146`: 3 consecutive
    `npx jest --coverage` runs at load ~31–73 and one `npm run -s test:coverage` run at ~45–50.

  Closed as **"not reproduced; hypothesis guarded"**. If it recurs, capture the failure output
  first.
