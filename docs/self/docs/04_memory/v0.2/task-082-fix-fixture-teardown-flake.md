---
id: "task-082-fix-fixture-teardown-flake"
type: task
title: "Make `removeTempDir` teardown race-proof so `ENOTEMPTY` on a fixture's `.git` can no longer fail a passing test"
status: in-review
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

### design — role: architect

**read_related (dl-015, HARD gate).** `depends_on: []` — no upstream task notes to load. Acknowledged
the two elements named in the task instead: source bug `bug-058-fixture-teardown-enotempty-flake-under-load`
(read in full; its Notes section records the two disagreeing readings) and its origin
`task-077-first-real-staging-run` finding F4. **The reviewer's reading is the one implemented**: a
load-dependent race, not a deterministic container failure — hence AC3's simulated failure is the
acceptance evidence and AC6 is corroboration only.

**verify_specs.** No new `tech-spec` needed: this is a test-fixture defect with no spec surface. No BDD
feature covers fixture teardown — settled by
`grep -rln 'removeTempDir\|teardown\|fixture' docs/02_requirements/02_bdd/features/` → no matches, so
the "task's BDD acceptance scenarios" gate is vacuous here and the ACs are the contract.

#### What was measured before any code changed

*AC5 — call-site count.* `grep -rn 'removeTempDir' test/ src/` → **156 call sites across 50 test
files** (0 in `src/` — it is test-only).
`grep -rn 'removeTempDir(' test/ src/ | grep -v 'export function' | grep -v "from '" | wc -l` → `156`;
`grep -rln 'removeTempDir' test/ src/ | wc -l` → `50`. This is why the fix goes in the helper and not
in `relevance.test.ts`.

*AC2 — are the fixture's git children awaited?* **Yes, by construction.**
`grep -nE 'exec|spawn|fork|Promise|async|await' test/storage/helpers/git-fixture.ts` returns only
`import { execFileSync } from 'child_process'` and the two `execFileSync` call sites (in `git()` and
`commitAllAs()`). There is no asynchronous spawn to await — `execFileSync` does not return until the
child has exited. So the "still-running `git`" mechanism `bug-058` hypothesises is **not** a
fixture-spawned process the fixture forgot to await.

*The one detached process git can still leave.* `git commit` may spawn auto-maintenance, and
`gc.autoDetach` defaults to **true** — a genuinely detached child that keeps writing `.git` after
`execFileSync` returns. Measured on the real fixture shape (1,000 documents + `commitAll`, the
`relevance.test.ts` REQ-PERF-05 fixture): `pgrep -a -f "$D"` immediately after `git commit` returns →
**no process referencing the fixture**, and the fixture holds **1002 loose objects** against
`gc.auto`'s default threshold of **6700**. So auto-gc does **not** fire at today's fixture size. It is
nonetheless the only real detached-writer path that exists, and nothing pins the fixture below 6700
forever, so `makeTempGitRepo` now sets `gc.auto=0` to close it at the source (AC2's "where it can be").

*AC1 / Implementation-Note question — is `maxRetries` sufficient on its own?* **No. Measured, not
assumed.** Probe (`probe-rm2.mjs`, node v22.21.0): a directory whose `.git` is continuously repopulated
by a background writer, removed with the current options vs. with Node's retry options.

| `rmSync` options | outcome |
|---|---|
| `{recursive, force}` (today) | `THREW ENOTEMPTY … rmdir '…/.git'` in 1 of 4 runs, ~40ms |
| `{recursive, force, maxRetries:10, retryDelay:50}` | `THREW ENOTEMPTY` in **4 of 4** runs, ~2.8s each |

Two conclusions, both load-bearing:

1. Node's `maxRetries`/`retryDelay` **do** cover `ENOTEMPTY` on this platform — the run time rising
   from ~40ms to ~2.8s is the linear backoff (50+100+…+500 = 2750ms) actually being spent retrying.
   This had to be verified rather than taken from the docs, and it is why the probe measures elapsed
   time and not just the error code.
2. **Retry alone does not close the defect — it converts a fast failure into a slow one.** Against a
   writer that keeps winning, every retry is exhausted and the error still propagates. Scaling the
   retry budget up until it passes is precisely the silent-hang anti-pattern: it would trade a visible
   teardown failure for a multi-second stall at 156 call sites.

**Design chosen, and why.** Two layers with different jobs:

- **Bounded retry (`maxRetries: 5, retryDelay: 20`, worst case 20+40+60+80+100 = 300ms)** closes the
  *transient* case — a writer that finishes within a few hundred ms, which is what a real git process
  completing its write looks like. The budget is deliberately small because layer 2, not the retry, is
  what guarantees AC1; a larger budget buys nothing and costs seconds.
- **Catch + warn** is the actual guarantee that teardown can never fail a passing test (AC1). Because
  AC1 is met by swallowing, AC4 applies: the leftover path is reported on `console.warn` so an
  accumulating `/tmp` leak stays visible, and that report is asserted by a test.

*Determinism (REQ-SYS-07, `determinism` directive).* Fixed retry count and fixed delay; no deadline
read from the clock, no randomness. The retry budget cannot change a test outcome — the outcome is
"never throws" either way.

#### T1 AC classification (dl-014 / `testing` directive)

| AC | Class | Why | Test |
|---|---|---|---|
| AC1 teardown cannot fail a test | **red-first** | today's unguarded `rmSync` propagates; simulated `ENOTEMPTY`/`EBUSY` fail against it | `does not propagate ENOTEMPTY …` / `… EBUSY …` |
| AC2 race closed at source | **split** — see below | the "already awaited" half pre-exists; the `gc.auto=0` half is new | `spawns git only through execFileSync` (characterization) / `disables git auto-gc` (red-first) |
| AC3 demonstrated against the failure | **red-first** | new behaviour; stubbed `ENOTEMPTY` and a real concurrent writer both throw today | `does not propagate ENOTEMPTY …` / `survives a directory written into concurrently` |
| AC4 no silent swallowing | **red-first** | no warning exists today | `reports the leftover path on console.warn` |
| AC5 every caller benefits | **characterization** | fix is in the helper; call-site count recorded above | covered by the helper-level fix (156 sites) |
| AC6 runner-image corroboration | **characterization** | corroboration, not proof (the task's own wording) | recorded in the review notes |
| AC7 gates stay green | **characterization** | pre-existing gates | gate run in the review notes |
| AC8 `bug-058` carried | **characterization** | `bug.sync_state` commits | start / submit sync commits |

No fabricated red: the characterization ACs pin behaviour that already holds, and no dead code was
added to force a failure.

**AC2 correction, recorded rather than quietly amended.** This table first classified AC2 as wholly
characterization. The red run disproved half of it: `spawns git only through execFileSync` passed
immediately (the fixture really did already await every child), but `disables git auto-gc` failed
with `Command failed: git config --get gc.auto` — `gc.auto` was simply unset, so that half is new
behaviour and red-first. The design reasoning did not change; only the classification was wrong.

### red — role: developer

`npx jest test/storage/git-fixture-teardown.test.ts` → **4 failed, 4 passed, 8 total**. The four
red-first failures, with the reason each gave:

```
● does not propagate ENOTEMPTY …   expect(received).not.toThrow()
                                   Error message: "ENOTEMPTY: directory not empty, rmdir '…/.git'"
● does not propagate EBUSY either  expect(received).not.toThrow()
                                   Error message: "EBUSY: directory not empty, rmdir '…/.git'"
● reports the leftover path …      ENOTEMPTY: directory not empty, rmdir '…/.git'  (no warning emitted)
● disables git auto-gc …           Command failed: git config --get gc.auto
```

The four that passed on first run are the characterization ones (happy-path removal, absent-path
no-op, the `execFileSync`-only scan) plus the concurrent-writer test — which passed *pre-fix*, which
is exactly why the notes label it corroboration and not the guard. A background writer that does not
happen to win the race leaves that test green against broken code; the stubbed `ENOTEMPTY`/`EBUSY`
tests are the ones that cannot.

**Stubbing note (a real obstacle, not a detail).** `jest.spyOn(fs, 'rmSync')` fails on Node 22 with
`TypeError: Cannot redefine property: rmSync` — the property is non-configurable. The suite uses
`jest.mock('fs', …)` spreading `jest.requireActual('fs')` and replacing only `rmSync`, so every other
`fs` call keeps its real behaviour.

### green — role: developer

`removeTempDir` is now bounded retry + `catch`/`console.warn`; `makeTempGitRepo` sets `gc.auto=0`.
`npx jest test/storage/git-fixture-teardown.test.ts` → **8 passed, 8 total**.

*Does the fix actually hold against the real failure?* Measured with `probe-fix.mjs` — the shipped
`rmSync` options plus the `catch`, run 10× against a directory whose `.git` is continuously
repopulated by a background process:

```
threw out of removeTempDir: 0/10 ; slowest teardown: 458ms
  (4 of 10 removals succeeded outright; 6 gave up and warned, leftover=true)
```

Three things this settles, none of which a single green run would have:

1. **0/10 propagated** — AC1 holds against a writer that genuinely wins.
2. **458ms worst case**, against a ~300ms retry budget (the remainder is the recursive walk itself).
   The fix does not turn a visible failure into a silent stall, which was the explicit risk.
3. The give-up path is **exercised, not theoretical**: 6 of 10 runs took it, each leaving the
   directory behind and warning — so AC4's visibility is load-bearing rather than decorative.

### refactor — role: developer

One correction, from a gate rather than from taste. The full suite failed on
`test/core/latency-budget-placement.test.ts` (the `bug-011` structural guard): **no test file may
both start a child process and read the wall clock**, checked textually, comments included. The
concurrent-writer test bounded its child with `Date.now()`. Rebounded it by iteration count, with
the parent killing the writer in `finally` either way — nothing in that test is timed, so the clock
was never needed. Complied rather than seeking an exception: a determinism guard is worth more than
the two characters it cost.

`grep -n 'Date\.now(\|performance\.now(\|process\.hrtime' test/storage/git-fixture-teardown.test.ts`
→ no matches.

### review-ready summary — role: reviewer

**Gates**, all in the worktree at this branch's HEAD:

| Command | Result |
|---|---|
| `npx jest` | **105 suites / 1706 tests passed**, exit 0 |
| `npx jest --coverage` | passed; `All files` **98.58 % stmts / 92.58 % branch / 98.81 % funcs / 99.18 % lines** |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 (bug-026 gate clean) |
| `npm run lint` | exit 0 |
| `npm run docs:api` | exit 0 |

Coverage is **non-regressing by construction**: `jest.config.js` sets
`collectCoverageFrom: ['src/**/*.ts', '!src/**/index.ts']`, and this task changes only `test/**`, so
no measured file was touched.

**BDD scenarios.** None apply.
`grep -rln 'removeTempDir\|teardown\|fixture' docs/02_requirements/02_bdd/features/` → no matches; no
feature file covers fixture teardown, so the ACs are the whole contract here.

**AC6 — corroboration, explicitly not proof.** Two independent populations, neither of which can
prove a race absent:

- *Host, under load:* 15 consecutive runs of `test/core/relevance.test.ts` + the new suite while 12
  busy-loops saturated all 12 cores → **15 pass / 0 fail**.
- *Runner image `catthehacker/ubuntu:act-24.04`:* `docker run … npx jest test/core/relevance.test.ts
  test/storage/git-fixture-teardown.test.ts` → exit **0**; repeated 3× → **3 pass / 0 fail**
  (33 tests). Container carries **node v24.19.0 / git 2.55.0**, against the host's **v22.21.0 /
  2.43.0**.

The reviewer got two clean runner-image runs *before* any fix existed, so these 18 green runs are
worth exactly as much — which is why AC1 rests on the stubbed-failure tests and the 10-run
persistent-writer probe, where the failure is present by construction, and not on this.

**Warning for anyone repeating the AC6 container runs.** The `docker run -v <worktree>:/w` above
executes as **root**, and jest's `globalSetup` (`test/global-setup.cjs`) rebuilds `dist/` as its
first act. That leaves `dist/` owned by `root:root`, after which the next run on the host fails
before any test executes:

```
Jest: Got error running globalSetup … reason:
EACCES: permission denied, rmdir '…/dist/cli'   (at test/global-setup.cjs:22)
```

This happened here and was diagnosed rather than worked around: `ls -ld dist` showed `root root`,
and `git check-ignore -v dist` → `.gitignore:3:dist/` confirmed it is an ignored local artifact, so
no commit was affected (`git status --porcelain` was empty throughout). Cleared by removing `dist/`
from inside the same image, after which `npx jest` returned **105 suites / 1706 tests passed**. Pass
`--user $(id -u):$(id -g)` to the container to avoid it. Worth knowing because the symptom appears
on the *host* run that follows, with nothing pointing back at the container as the cause.

**One honest limit on the measurements.** The "Node's `maxRetries` covers `ENOTEMPTY`" timing
evidence was taken on the host's Node 22.21.0. It was not re-measured on the container's Node 24, and
nothing here depends on it: the retry is an optimisation for the transient case, and the `catch` —
which is version-independent — is what guarantees AC1.

**Scope.** Test-fixture only; no `src/` file changed, so no runtime behaviour of the shipped package
is affected.
