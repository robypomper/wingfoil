---
id: "task-083-fix-staging-interrupt-teardown"
type: task
title: "Run `publish:staging` teardown on SIGINT/SIGTERM so an interrupt leaves no orphaned Verdaccio, work dir or live `_authToken`"
status: in-progress
release: "v0.2"
priority: "high"
tags: ["v0.2", "release", "distribution", "security"]
ref: "task-077-first-real-staging-run"
bug: ["bug-059-sigint-leaks-staging-registry-and-token"]
depends_on: ["task-078-publish-pipeline-hardening"]
tmpl_version: 260703
---

## Description

`bug-059-sigint-leaks-staging-registry-and-token` (`open`, high): `scripts/publish-staging.cjs`
installs no handler for signals sent **to itself**, so a Ctrl-C terminates it outright and the
`try/catch/finally` its header advertises as running "on success and on every failure" never runs.
What survives an interrupt, measured: a Verdaccio orphan LISTENing on :4873, a ~268 MB work dir, and an
`npmrc` holding an `_authToken` that is live against that orphan. The script's own in-use guard then
refuses every later run, so one Ctrl-C disables staging until a human finds and kills the process.

`task-078-publish-pipeline-hardening` (merged) did **not** fix this: its `stopProcess` adds a
SIGTERM → SIGKILL escalation for a *child* that will not die (`dl-057` item (c)) and adds no handler
for a signal delivered to the script. It is a `depends_on` because it is the current owner of this
file's shape and this change extends its `stop()` path.

**Why this is scheduled into v0.2 rather than deferred.** The leaked token is scoped to a throwaway
localhost registry and is not an npm credential, so the security exposure is narrow — `bug-059` argues
both sides and does not claim otherwise. The release-relevant half is the other one: the same script is
the `stage` job's body, and `dl-056-first-real-publishing-run` makes a green `publish:staging` run the
mandated rehearsal before any tag. A rehearsal that one Ctrl-C disables is a release-procedure hazard.
It is **not** claimed as a release blocker in the sense `bug-056`/`bug-057` are — in CI the container is
discarded, so neither the orphan nor the token outlives the job.

## Acceptance Criteria

1. **AC1 — an interrupt runs teardown.** After `SIGINT` is delivered to a running `publish:staging`
   (post-`startRegistry`): `curl -sS -m 5 http://localhost:4873/-/ping` fails to connect,
   `ss -ltn 'sport = :4873'` shows no LISTEN row, and `ls -d /tmp/wingfoil-staging-*` finds nothing.
   The three commands and their output go in the Execution Notes.
2. **AC2 — the same holds for `SIGTERM`** delivered to the script (not to its child), by the same three
   probes.
3. **AC3 — the exit is honest.** An interrupted run exits non-zero, and its final line says teardown
   ran; it must not exit 0 as if it had completed the flow.
4. **AC4 — no credential material survives.** After AC1's interrupt, no file matching
   `/tmp/wingfoil-staging-*/npmrc` exists. If any teardown path can leave the work dir behind (e.g. a
   second signal during teardown), the `npmrc` is removed or truncated **first**, before the bulk
   removal, so the token is never the thing that outlives the run.
5. **AC5 — a later run is not blocked.** Immediately after AC1, `npm run publish:staging` starts
   normally — i.e. `startRegistry`'s in-use guard does not fire. This is the self-perpetuating half of
   `bug-059` and it is the one a user actually feels.
6. **AC6 — teardown is idempotent and cannot hang.** A second `SIGINT` during teardown does not leave
   the process wedged; teardown reuses `stopProcess`'s bounded SIGTERM → SIGKILL escalation
   (`task-078`, `dl-057` item (c)) rather than a new unbounded wait.
7. **AC7 — the unit tests keep their injected-effects shape.** The orchestration tests must still run
   offline with fake effects; the signal path is covered by a unit test that invokes the installed
   handler directly (no real signal, no real Verdaccio), so the suite stays deterministic and fast.
8. **AC8 — the in-process failure path still tears down.** The existing behaviour verified by
   `task-077` — `--tarball /nonexistent/…` fails after the registry is up and teardown *does* run —
   still holds; a characterization test or a recorded run.
9. **AC9 — the header stops over-promising, or starts being true.** `scripts/publish-staging.cjs`'s
   header claim that teardown runs "on success and on every failure" is either satisfied by this change
   or amended to say exactly which cases are covered.
10. **AC10 — the existing gates stay green**: `npx jest`, `npx jest --coverage` (non-regressing, >80%),
    `npx tsc -p tsconfig.build.json --noEmit`, `npm run lint`, `npm run docs:api` all exit 0.
11. **AC11 — `bug-059` is carried to `resolved`** by `bug.sync_state` off this task's `bug:` field.

## Implementation Notes

- **The handler must be async-safe.** Teardown stops a child process and removes a 268 MB directory;
  a naive `process.on('SIGINT', () => { cleanup(); process.exit(1); })` can exit before the async work
  finishes. Await the same teardown the `finally` awaits, then exit — and guard re-entry (AC6).
- **Do not leave the default disposition in place for the CI path.** In the `stage` job the container is
  discarded, so nothing leaks there; that is a reason this is not a blocker, not a reason to special-case
  CI. One code path, both environments — the script's stated design (`adr-009`: "no debugging CI through
  throwaway commits") depends on dev and CI running the same thing.
- **`SIGKILL` cannot be handled**, and this task does not claim to cover it. Say so in the header
  amendment (AC9) rather than implying total coverage.

**Must be re-verified at execution time, not read from this task:**

1. That `scripts/publish-staging.cjs` still has no `process.on('SIGINT'|'SIGTERM', …)` —
   `grep -n "process.on" scripts/publish-staging.cjs` — since another task may have added one.
2. `stopProcess`'s current shape and its two timeout constants (`:181`-`:203`, `SIGKILL_GRACE_MS` at
   `:47`), pinned to `main` at `b505473`.
3. That the leak still reproduces before the fix (AC1 red-first): interrupt a real run and see the
   orphan. This needs a real `publish:staging`, i.e. network access and ~2 minutes; there is no offline
   substitute for the red.
4. Whether the `_authToken` is still written to `<workdir>/npmrc` at the same path, before writing
   AC4's assertion.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass.
     AC classification (dl-014/T1, `testing` directive): AC1–AC6 are red-first (no signal handling
     exists today); AC7/AC8/AC10 are characterization. -->
