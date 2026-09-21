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

### design — role: architect

Branch `task/task-083-fix-staging-interrupt-teardown`, worktree
`/home/robypomper/Workspaces/.wf2-wt/task-083`, cut from `main` at **`65021c2`**
(`git log --oneline -1` → `65021c2 wf(bug): sync bug-057-timestamp-assertions-reject-zulu-offset
[in-review → resolved → closed]`). `npm ci --prefer-offline --no-audit --no-fund` → `added 500
packages in 10s`, exit 0.

**The four "re-verify at execution time" items from the Implementation Notes, re-verified here.**

1. **No signal handler exists on the base.** Run in the worktree at `65021c2`:

   ```
   $ grep -n "process\.on\|SIGINT\|SIGTERM\|SIGKILL\|SIGHUP" scripts/publish-staging.cjs
   41: * How long a stopped child gets to honour `SIGTERM` before `SIGKILL` (dl-057 item c). An order of
   46:/** How long `SIGKILL` gets before {@link stopProcess} resolves regardless (dl-057 item c). */
   47:const SIGKILL_GRACE_MS = 2_000;
   181: * Stop a child process without ever hanging (dl-057 item c): `SIGTERM`, then — if it has not exited
   182: * within `timeoutMs` — `SIGKILL`, then resolve after `killGraceMs` whether or not an `exit` was seen.
   183: * A child that ignores or stalls on `SIGTERM` can therefore no longer outlive the staging run, on a
   191:    killGraceMs = SIGKILL_GRACE_MS,
   201:    child.kill('SIGTERM');
   203:      child.kill('SIGKILL');
   308:  SIGKILL_GRACE_MS,
   ```

   Every hit is inside `stopProcess` or its two constants — signals the script **sends to its child**.
   `process.on` appears nowhere: zero hits for the `process\.on` half of the alternation. `bug-059`'s
   claim holds at `65021c2` as it did at `b505473`.

2. **`stopProcess`'s shape and bounds, read as they stand** (not from the bug's line offsets, which
   have moved): `stopProcess(child, { hasExited, timeoutMs = REGISTRY_STOP_TIMEOUT_MS, killGraceMs =
   SIGKILL_GRACE_MS })` — returns immediately if `hasExited()`, else `SIGTERM` → wait `timeoutMs`
   (`REGISTRY_STOP_TIMEOUT_MS = 10_000`) → `SIGKILL` → wait `killGraceMs` (`SIGKILL_GRACE_MS = 2_000`)
   → resolve regardless. Both timers `unref()`ed. `startRegistry` returns `{ stop: () =>
   stopProcess(child, { hasExited: () => exited }) }`, so **the registry half of teardown is already
   bounded at ≤ 12 s and can already never hang** — which is exactly what constraint 4 of this task
   asks for and why no new bound is invented here (see "Bounds" below).

3. **The leak still reproduces at `65021c2`** — measured, not assumed. See `red` below for the full
   transcript; summary: `SIGINT` to the script → `wait` status **130**, Verdaccio still LISTENing on
   :4873, `/tmp/wingfoil-staging-6CPzYg` still present with a `chmod 600` `npmrc` in it, the token in
   it still **live** (`curl -H "Authorization: Bearer <tok>" …/-/whoami` → `{"username":
   "wingfoil-staging"}`), and the next run refused with `is already in use`.

4. **The token path is unchanged.** `createToken` still writes `paths.userconfig`, and
   `stagingPaths(root).userconfig` is still `join(root, 'npmrc')` — so AC4's assertion target
   `/tmp/wingfoil-staging-*/npmrc` is correct. Confirmed on disk by the reproduction above
   (`-rw------- … /tmp/wingfoil-staging-6CPzYg/npmrc`).

**`read_related` (`dl-015`, hard gate).** `depends_on: ["task-078-publish-pipeline-hardening"]`, read in
full. What it hands this task:

- `stopProcess` exists **because** `task-078` lifted `startRegistry`'s `stop` closure to module level
  precisely so a test could drive the real code; its design note fixes 10 s "an order of magnitude
  above a healthy Verdaccio's SIGTERM shutdown and two orders below the 60 s
  `REGISTRY_START_TIMEOUT_MS`". This task **reuses** that bound and adds none.
- Its green note states the two existing `stop()` call sites "cannot double-stop — when `startRegistry`
  throws, `registry` is never assigned, so the `finally`'s `if (registry)` is false". This task adds a
  **third** caller (the signal path) for which that argument does *not* hold, which is why
  memoisation (below) is the core of the change rather than an extra.
- Its weak-spot 4 (two `stopProcess` cases spawn real children) is inherited, not worsened: every new
  case here uses fake effects and a fake signal target.
- `task-078` did **not** address signals delivered to the script: its own scope table lists `dl-057`
  items (a), (c), (f), (g) only, and (c) is the child-side escalation. Consistent with item 1 above.

`task-077-first-real-staging-run` is `ref`, not `depends_on`; read for its AC2 failure path (b), which
is where `bug-059` was found, and for its in-process-failure evidence that AC8 characterises.

**`verify_specs`.** No new `tech-spec` needed, and none needs revision *for this change to be correct*.
The governing spec is `spec-015-packaging-publishing` (`approved`) — note the id, the first draft of
this note guessed `spec-015-publishing-pipeline` and was corrected by running the command rather than
by trusting the guess. Searched for what it says about signals:

```
$ grep -n -i 'signal\|sigint\|sigterm\|interrupt' docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md
54:  not — and confirmed by probe install that the shim works either way, so this is signal hygiene, not
237:`SIGINT`, which leaves the registry, the work dir and its live throwaway token behind. Those are
```

Line 54 is about the `bin` shim and unrelated. Line 237 is inside the spec's 2026-09-21 revision note,
an explicitly **out-of-scope** paragraph recording that `task-077` "found that the staging run's
teardown … executes on the success and failure paths (`runStaging`'s `finally`) but **not** on
`SIGINT` … Those are `task-077`'s findings and are tracked there; this revision changes nothing about
them." So the spec **describes** the defect as a tracked finding and prescribes nothing about signal
disposition anywhere — there is no normative sentence this change contradicts, and nothing to amend
for the change to be legal. `adr-009` §3/§5 likewise fix *what* staging does and that dev and CI run
the one script, not how it dies. This is robustness inside the shape they already fix — the same
judgement `task-078` recorded for `dl-057` items (a)/(c)/(f)/(g). The design gate passes through (no
approver needed).

That out-of-scope paragraph does become a *historical* statement once this lands ("found that … but
not on `SIGINT`" stays true of what `task-077` found; it is no longer true of the file). Editing an
`approved` tech-spec needs its own dated Revision note (`dl-047`) and is a separate act from a
dev-loop, per the `task-078` precedent — so it is **not** done here and is raised as a proposed
element in the final report instead of being buried.

**Which signals, and why — argued from what actually delivers them, not from a list.**

| Signal | Handled | Why |
|---|---|---|
| `SIGINT` | **yes** | Ctrl-C from the terminal, i.e. `bug-059`'s own case and the one a developer hits after waiting a minute for Verdaccio to install. Reproduced above. |
| `SIGTERM` | **yes** | The default of bare `kill`, of `timeout(1)`, of `docker stop`, and of systemd's unit stop — i.e. every non-interactive way this run gets ended. It is also the escalation a CI runner uses when a cancelled or timed-out step does not die: `.github/workflows/publish.yml`'s `stage` job carries **no** `timeout-minutes` (`dl-057` item (b), deliberately deferred by `task-078` until `dl-056` sizes it), so the only bounds on that step are GitHub's default job timeout and a human pressing Cancel — both of which end the step by signalling it. Handling `SIGINT` **and** `SIGTERM` means the exact escalation order the runner uses does not have to be settled from memory: whichever arrives first, teardown runs. |
| `SIGHUP` | **yes** | A dropped SSH session or a closed terminal delivers `SIGHUP` to the foreground group. It produces *precisely* the leak `bug-059` describes, and unlike Ctrl-C nobody is present to notice the orphan. It is one more entry in `TEARDOWN_SIGNALS` and the same handler; there is no case in which a hung-up staging run should keep a registry alive. **Evidence caveat, stated rather than implied:** the real-run probes below cover `SIGINT` (AC1) and `SIGTERM` (AC2) only. `SIGHUP` is covered by unit test — it is the identical handler over the identical teardown — and is *not* claimed to have been interrupted for real. |
| `SIGKILL` | **no — impossible** | POSIX: it cannot be caught, blocked or ignored. Nothing here can cover it, which is why AC9's header amendment says so explicitly instead of letting "on every failure" imply total coverage. A `SIGKILL` (or a power cut) is also the one case in which the work dir can survive teardown, which is the argument for AC4's ordering below. |
| `SIGQUIT` | **no — on purpose** | Ctrl-`\`'s documented contract is *terminate immediately and dump core*. A user who sends it is asking for the non-graceful exit; honouring that is correct, not a gap. It is not sent by any CI or container path. |
| `SIGUSR1` | **no** | Node reserves it to start the inspector; installing a listener would silently disable that. Nothing sends it here. |
| everything else | **no** | Nothing in the two delivery paths that exist — an interactive terminal and a CI runner — sends them. |

**Design decisions (these are decisions, not mechanics).**

- **One memoised teardown, awaited by both paths (AC6, constraint 2).** `runStaging` gains a single
  `teardown()` closure memoised in a `teardownRun` promise variable (`teardownRun ??= (async () => …)()`).
  The `finally` awaits it; the signal handler awaits the same one. Whoever arrives second awaits an
  already-running promise instead of starting a second stop-and-delete over the same child and the
  same directory. This is the deterministic answer constraint 2 asks to be *shown*: the unit case
  "does not tear down twice when the finally and a signal race" asserts `stopRegistry` /
  `removeWorkDir` appear **exactly once** in the recorded call list.
- **Re-entry: the second signal is absorbed, not raced (AC6).** A second `SIGINT` while teardown is in
  flight logs one line and returns the in-flight promise. The alternative — "second Ctrl-C exits at
  once" — was rejected because teardown is already bounded at ≤ 12 s + one `rm`, so the impatience
  path buys a few seconds and costs the guarantee; and because a forced exit mid-teardown is exactly
  the state AC4 is written to make survivable, not one to create on purpose.
- **Bounds: reused, not invented (constraint 4, AC6).** The only unbounded thing teardown could wait
  on is the registry child, and `registry.stop()` is already `stopProcess(child, …)` with
  `REGISTRY_STOP_TIMEOUT_MS` (10 s) → `SIGKILL` → `SIGKILL_GRACE_MS` (2 s) → resolve regardless. No new
  constant is added and no new timeout wraps the handler: a new outer bound would either be shorter
  than 12 s (cutting off a stop that is about to succeed) or longer (dead weight). The remaining work —
  `rmSync` of the npmrc and of the work dir — is filesystem-bounded and was already on the `finally`
  path.
- **AC4 ordering: the token dies first.** Teardown becomes *remove `npmrc` → stop registry → remove
  work dir*, as a new `removeToken(dir)` effect. With the re-entry guard above, no signal path this
  task handles can leave the work dir behind, so AC4's conditional is strictly not triggered — the
  ordering is taken anyway because it costs three lines and covers the two cases nothing can handle:
  `SIGKILL` and a machine losing power mid-teardown. After this change the credential is the
  *shortest*-lived artefact of a run rather than the longest.
- **Exit: re-raise the signal, do not translate it (AC3, constraint 3).** After teardown the handler
  removes its own listener and re-sends the signal to itself (`process.kill(process.pid, signal)`), so
  the process dies *by* the signal and a shell reports the conventional `128 + N` (130 for `SIGINT`) with
  `WIFSIGNALED` true — indistinguishable from the un-handled death a caller already expects. Chosen over
  `process.exit(130)`, which is also non-zero but reports a normal exit that happens to carry that number,
  and over `process.exitCode = 1`, which would make an interrupt look like a staging failure. The
  pre-fix run measured `wait` status **130**; the post-fix runs must still measure 130, and do.
- **The final line must survive the exit.** `process.stdout.write` is synchronous to a TTY or a file but
  **asynchronous to a pipe** — which is what CI gives the step — so dying immediately after logging can
  truncate the very line AC3 requires. The default exit path therefore flushes (`process.stdout.write('',
  cb)`) before re-raising. One line, and without it AC3 would hold on a developer terminal and quietly
  fail in the environment that matters.
- **Handlers are opt-in, so AC7's shape is preserved.** `runStaging` installs nothing unless given an
  `interrupts` option; `main()` passes the real one. Unit tests either omit it (every pre-existing
  orchestration case, untouched) or pass a **fake signal target** that records handlers and a fake
  `die` — so the new coverage needs no real signal, no real Verdaccio and no network, exactly as AC7
  requires. This mirrors the injected-`effects` design the file already has rather than introducing a
  second style.

**Known limitation, recorded now rather than discovered by a reviewer.** Node runs a signal handler
only when the event loop can turn, and this script's npm steps go through `spawnSync` (`run()`), which
blocks the loop until the child exits. So a signal delivered *only to the script* (`kill -INT <pid>`)
while `npm install --global` is running is honoured when that npm returns, not at once. In the
interactive case this is invisible: Ctrl-C signals the whole foreground process group, so the npm
child dies first and `spawnSync` returns immediately — which is what the post-fix `npm run` +
process-group probe below measures. Forwarding signals to the in-flight child would close the
`kill -INT <pid>`-only gap, but it is a larger change to `run()`/`stopProcess` than this task's ACs
describe; it is reported as a proposed element instead of being smuggled in here.

**T1 — acceptance-criterion classification** (`dl-014` T1, `testing` directive).

| AC | Class | Evidence / test |
|---|---|---|
| 1 — SIGINT runs teardown | **red-first** | `publish-staging.test.ts` › "tears down and exits on the signal when SIGINT arrives mid-run" — imports `installTeardownHandlers`, which does not exist on the base, so the case fails before the edit. Plus the real-run probe transcript (before: leak; after: clean). |
| 2 — same for SIGTERM | **red-first** | same suite, the `it.each` row for `SIGTERM` over the same handler; plus the second real-run probe (`npm run` + `kill -TERM` on the process group). |
| 3 — exit is honest (non-zero, says teardown ran) | **red-first** | "re-raises the signal instead of exiting 0" (asserts the injected `die` is called with the signal, and that nothing sets a 0 exit); real-run `wait` status 130 both times. No pre-existing behaviour to characterise: the code path does not exist. |
| 4 — no credential survives; npmrc removed first | **red-first** | "removes the npmrc before it removes the work dir" — `removeToken` is a new effect, absent on the base; plus `ls /tmp/wingfoil-staging-*/npmrc` in both post-fix probes. |
| 5 — a later run is not blocked | **red-first** | Real-run only, and deliberately so: the in-use guard is `startRegistry`'s live `fetch` against :4873, which no offline test may exercise. Probe: post-fix run B starts immediately after run A's interrupt and gets past the guard. The pre-fix counter-measurement (`is already in use`, exit 1) is recorded under `red`. |
| 6 — idempotent, cannot hang | **red-first** | "does not tear down twice when the finally and a signal race" and "a second signal during teardown neither re-runs teardown nor wedges the process"; bounds are `stopProcess`'s, covered by `task-078`'s five existing cases (unchanged). |
| 7 — tests keep their injected-effects shape | **characterization** | The nine pre-existing `runStaging` orchestration cases must keep passing with **no `interrupts` option**; the new signal cases use a fake target. Verified by the full `npx jest` run, not asserted by prose. |
| 8 — the in-process failure path still tears down | **characterization** | The pre-existing `it.each` "fails (exit 1) when %s fails, and still tears down" (six rows) — passes on first run, no fabricated red; its expected call list gains `removeToken` because teardown's content changed on purpose. |
| 9 — header stops over-promising | **n/a — documentation** | The header bullet 7 amendment; `SIGKILL` named as not covered. |
| 10 — gates green | **characterization** | The six gate commands, run and pasted under `refactor`. |
| 11 — `bug-059` carried to `resolved` | **n/a — process** | `bug.sync_state`: `planned → in-progress` at `start` (`8e6b9f0`), `→ in-review` at `review`. `resolved`/`closed` belong to `done`, which this run does not reach. |
