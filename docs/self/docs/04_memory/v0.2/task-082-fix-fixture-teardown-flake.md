---
id: "task-082-fix-fixture-teardown-flake"
type: task
title: "Make `removeTempDir` teardown race-proof so `ENOTEMPTY` on a fixture's `.git` can no longer fail a passing test"
status: pending
release: "v0.2"
priority: "medium"
tags: ["v0.2", "testing", "release"]
ref: "task-077-first-real-staging-run"
bug: ["bug-058-fixture-teardown-enotempty-flake-under-load"]
depends_on: []
tmpl_version: 260703
---

## Description

`bug-058-fixture-teardown-enotempty-flake-under-load` (`open`, medium): `removeTempDir`
(`test/storage/helpers/git-fixture.ts:72`) is a single unguarded
`rmSync(dir, { recursive: true, force: true })`. Called from `test/core/relevance.test.ts:126`'s
`finally`, it can throw `ENOTEMPTY: directory not empty, rmdir '/tmp/wf-storage-*/.git'` while something
is still writing under the fixture's `.git`, failing a test whose assertions have already passed. It
fires under load in the runner container and did not reproduce in two later runner-image runs — a race,
not a container-specific defect.

It is not a release blocker in its own right, but it fails the gate whenever it fires, because
`prepublishOnly` runs the full suite. Teardown must never be able to fail a green test.

## Acceptance Criteria

1. **AC1 — teardown cannot fail a test.** `removeTempDir` either retries until the directory is gone or
   swallows a removal failure after its best effort; either way it does not propagate `ENOTEMPTY` (or
   `EBUSY`, the sibling failure on the same mechanism) to the caller. Whichever is chosen is stated in
   the function's doc comment with its rationale.
2. **AC2 — the race is closed at the source where it can be.** Any fixture git child process
   `git-fixture.ts` spawns is awaited to exit before `removeTempDir` is called (a still-running `git`
   recreating index/lock files under `.git` is the mechanism `bug-058` identifies). If every spawn is
   already synchronous, record the command that shows it rather than asserting it.
3. **AC3 — demonstrated against the failure, not around it.** A test drives `removeTempDir` against a
   directory that is being written into concurrently (or a stubbed `rmSync` that throws `ENOTEMPTY`
   once, then succeeds) and asserts it does not throw. This is the regression guard; the flake itself
   cannot be scheduled, so a test that merely runs the suite again proves nothing.
4. **AC4 — no silent swallowing of real failures.** If AC1 is met by swallowing, the leftover path is
   reported (a warning line naming the directory), so an accumulating `/tmp` leak stays visible. Assert
   the report in a test.
5. **AC5 — every caller benefits.** `grep -rn 'removeTempDir' test/` lists the call sites; the fix is in
   the helper, not in `relevance.test.ts`, so all of them are covered. Record the call-site count.
6. **AC6 — `test/core/relevance.test.ts` still passes on the host and in the runner image.** Run it in
   `catthehacker/ubuntu:act-24.04`; record the exit code. This is corroboration, not proof — a passing
   run is also what the reviewer got twice *before* any fix.
7. **AC7 — the existing gates stay green**: `npx jest`, `npx jest --coverage` (non-regressing, >80%),
   `npx tsc -p tsconfig.build.json --noEmit`, `npm run lint`, `npm run docs:api` all exit 0.
8. **AC8 — `bug-058` is carried to `resolved`** by `bug.sync_state` off this task's `bug:` field.

## Implementation Notes

- **Do not try to reproduce the flake to start.** `bug-058` records four runner-image runs: two failed
  under load, two passed. An attempt to make it fail on demand will burn the task's time and prove
  nothing either way; AC3 exists precisely so the fix is driven by a deterministic simulation of the
  error rather than by the flake.
- **`force: true` is not a retry.** It suppresses errors for a *missing* path only, which is why the
  current call still throws `ENOTEMPTY`. Node's `rmSync` takes `maxRetries`/`retryDelay`; whether that
  is sufficient on its own, or whether the helper needs its own loop, is a design call for the task —
  state which was chosen and why.
- **Determinism.** Any retry loop must be bounded and must not use wall-clock-dependent behaviour in a
  way that changes test outcomes (`determinism` directive, REQ-SYS-07). A fixed retry count with a
  fixed delay is fine; a deadline read from the clock is not.

**Must be re-verified at execution time, not read from this task:**

1. The two call sites — `test/storage/helpers/git-fixture.ts:72` (the `rmSync`) and
   `test/core/relevance.test.ts:126` (the `finally`) — both pinned to `main` at `b505473`; re-locate by
   content.
2. Whether `git-fixture.ts` spawns anything asynchronously (AC2) — read the file, do not assume from
   `removeTempDir`'s shape.
3. The full list of `removeTempDir` callers (AC5) at the time of the fix.

**Which reading this task implements.** `task-077`'s notes called F4 "reproducible in the runner
container"; its reviewer (`ac10060`) could not reproduce it in two runner-image runs and directed it be
filed as a flake. **The reviewer's measurement is the one followed** — hence AC3's simulated failure
rather than a container-reproduction AC, and hence AC6 being explicitly labelled corroboration. The
code fix is the same under either reading.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass.
     AC classification (dl-014/T1, `testing` directive): AC3/AC4 are red-first (new behaviour, and the
     simulated ENOTEMPTY fails against today's unguarded rmSync); AC5/AC6/AC7 are characterization. -->
