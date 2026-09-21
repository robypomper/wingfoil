---
id: "bug-058-fixture-teardown-enotempty-flake-under-load"
type: bug
title: "`removeTempDir` teardown races the fixture's own git processes: flaky `ENOTEMPTY … rmdir '/tmp/wf-storage-*/.git'` under load"
status: triaged
severity: "medium"
release-origin: "v0.2"
release: ""
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`test/core/relevance.test.ts:126` calls `removeTempDir(root)` in its `finally`, and that teardown can
fail with `ENOTEMPTY: directory not empty, rmdir '/tmp/wf-storage-*/.git'` thrown from
`test/storage/helpers/git-fixture.ts:72`, failing the suite. **This is a flaky teardown race under
load, not a deterministic container failure** — see the two readings below, which disagree.

## Steps to Reproduce

1. Run `npx jest test/core/relevance.test.ts` inside the runner image
   (`catthehacker/ubuntu:act-24.04`) — e.g. via `act push -j gate`, with the gate's `npm ci` step
   stepped past — **while the machine is otherwise loaded**.
2. It does not reproduce on demand. Two later runs in the same runner image passed (reviewer, see
   below), and the suite passes on the host (100/100 suites, recorded under `task-077` AC9).

## Expected Behavior

Fixture teardown must never fail the test whose assertions have already passed. `removeTempDir` is
cleanup, and `test/core/relevance.test.ts`'s REQ-PERF-05 fit criterion had already been satisfied at the
point the error is thrown.

## Actual Behavior

Observed by `task-077-first-real-staging-run` inside the runner container:

```
● filterRelevantMemoryDocuments … › REQ-PERF-05 Fit Criterion — 1,000 Memory documents, K relevant
  ENOTEMPTY: directory not empty, rmdir '/tmp/wf-storage-KaPism/.git'
    at removeTempDir (test/storage/helpers/git-fixture.ts:72:9)
    at Object.<anonymous> (test/core/relevance.test.ts:126:22)
```

Both call sites are exactly where the trace says, read at `b505473`:

```
$ sed -n '125,127p' test/core/relevance.test.ts
      } finally {
        removeTempDir(root);
      }
$ sed -n '70,73p' test/storage/helpers/git-fixture.ts
/** Recursively remove a temp fixture directory. */
export function removeTempDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
```

So the implementation is a single unguarded `rmSync(..., { recursive: true, force: true })`. `force`
suppresses *missing*-path errors; it does not retry, and `ENOTEMPTY` on `.git` means something was still
writing into that directory (a git process the fixture spawned, or an index/lock file recreated) while
the recursive walk was deleting it — a classic teardown race, which load makes likelier.

## Notes

**The two readings, stated plainly, and which one is measured.**

- `task-077-first-real-staging-run` recorded it as *"fails in the runner container, **reproducibly** in
  both runs"* — i.e. a deterministic container-vs-host difference. That was an honest report of two
  consecutive observations during a run in which several other Wave-2 jobs were competing for CPU
  ("the timings are not clean-room … other Wave-2 jobs competing for CPU throughout", its own AC-limits
  note).
- The reviewer, at approve commit `ac10060`, could **not** reproduce it: *"F4 is real but load-dependent
  and did not reproduce in two runner-image runs, so it should be filed as a flake rather than a
  deterministic container failure."*

**The reviewer's is the measured one and this document follows it**: four runner-image runs in total,
two failing under load and two passing, is evidence of a race, not of a container-specific defect. The
defect is real either way — an unguarded `rmSync` in teardown — and the fix does not depend on which
reading is right; the severity and the acceptance criteria do. Filed **medium**, and *not* as a release
blocker in its own right, but it still fails the gate whenever it fires, because `prepublishOnly` runs
the full suite.

**What this rules out.** It is not `bug-022`: `task-077` checked, and the gate's `prepublishOnly`
failures were not in `test/cli/npm-distribution.test.ts`.

## Triage & Execution Notes

Filed from finding **F4** of `task-077-first-real-staging-run` (`done`), at the scheduling act its
approve commit `ac10060` directs, and **retitled** per that commit: "flake", not "reproducible container
failure". Severity **medium**, matching the task's own proposal, which the reviewer did not disturb.
Fix task: `task-082-fix-fixture-teardown-flake`.
