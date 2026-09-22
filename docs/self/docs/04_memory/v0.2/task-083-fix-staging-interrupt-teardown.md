---
id: "task-083-fix-staging-interrupt-teardown"
type: task
title: "Run `publish:staging` teardown on SIGINT/SIGTERM so an interrupt leaves no orphaned Verdaccio, work dir or live `_authToken`"
status: in-progress
rejection_reason: "A signal arriving after Verdaccio is listening but before startRegistry returns tears down without stopping the child: registry is assigned only from the resolved value, so teardown runs with it undefined, an orphan survives on port 4873 and trips the in-use guard for every later run, while the completion line still states that the registry was stopped. Reproduced twice by the reviewer. Also: the AC7 guard test compares listener counts only before and after the run, so it stays green when handlers are armed unconditionally (demonstrated by mutation); and the notes claim ~/.npmrc does not exist on this machine when it does, though the security conclusion it supports is independently true. Fix the startup window, make the completion message report what teardown actually did, tighten the AC7 guard to assert mid-run, and correct the npmrc sentence."
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
| `SIGTERM` | **yes** | The default signal of bare `kill` and of `timeout(1)` — i.e. the non-interactive way a run gets ended. Verified on this machine rather than recalled: `timeout 1 node -e "process.on('SIGTERM', …)"` printed `GOT SIGTERM` and exited `124`. It is also what a container or service manager sends on stop. **What is deliberately *not* asserted:** the exact signal sequence a GitHub runner uses to cancel a step. That could not be verified from here, and `.github/workflows/publish.yml`'s `stage` job carries no `timeout-minutes` anyway (`dl-057` item (b), deferred by `task-078` until `dl-056` sizes it), so the only things that end that step early are GitHub's default job timeout and a human pressing Cancel. Handling `SIGINT` **and** `SIGTERM` is exactly what makes that unverified detail not matter: whichever the runner sends, teardown runs. |
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

### red — role: developer

> **All the real staging runs in this section and the next were re-executed from scratch on
> 2026-09-22**, after the agent process was killed mid-task by a network error and the scratch
> directory holding the original drivers, logs and tarball was wiped with it. Nothing below is carried
> over on trust from the first pass: every transcript here comes from a run made **after** the second
> merge of `main` (`7e4146e`), against the tree actually being submitted. Where a figure differs from
> the first pass, the second measurement is the one recorded.

**Part 1 — the leak reproduced against the base script, before the fix.** The base file was taken out
of git rather than by reverting the branch, so leak and fix could be measured minutes apart against the
same tarball and the same machine:

```
$ git show 65021c2:scripts/publish-staging.cjs > scripts/publish-staging-BASE.cjs
$ grep -c "process.on" scripts/publish-staging-BASE.cjs
0                                                    # the defect, in one number
```

That copy was deleted immediately after the run and never committed (`git status --porcelain` then
listed only the task file). Driver `scratchpad/run-and-signal.sh`; it `setsid`s the script so the signal
reaches *only* it, exactly as `bug-059`'s `kill -INT <pid>` did. Tarball built once with
`npm pack --pack-destination <scratchpad>/pack` → `wingfoil-0.1.0.tgz`.

```
$ bash run-and-signal.sh INT rerun-before-fix single scripts/publish-staging-BASE.cjs
SCRIPT=scripts/publish-staging-BASE.cjs
SCRIPT_PID=24937
--- registry up after 29s; sending SIGINT to 24937 ---
SCRIPT_WAIT_STATUS=130
SCRIPT_GONE_AFTER=2s
--- log tail ---
[publish:staging] Verdaccio up on http://localhost:4873/          # …and nothing after it: no teardown
```

The three AC1 probes plus two more, run immediately after:

```
$ curl -sS -m 5 http://localhost:4873/-/ping ; echo "CURL_EXIT=$?"
{}
CURL_EXIT=0                                          # the registry answers
$ ss -ltn 'sport = :4873'
LISTEN 0      511        127.0.0.1:4873      0.0.0.0:*
$ ls -d /tmp/wingfoil-staging-*
/tmp/wingfoil-staging-ufyrNI
$ ls -l /tmp/wingfoil-staging-*/npmrc
-rw------- 1 robypomper robypomper 250 set 22 11:13 /tmp/wingfoil-staging-ufyrNI/npmrc
$ ss -ltnp 'sport = :4873'
LISTEN 0 511 127.0.0.1:4873 0.0.0.0:* users:(("verdaccio",pid=25090,fd=26))
```

A trap worth recording, because a cleanup check could be fooled by it: the orphan's argv is the bare
word `verdaccio`, so `pgrep -af 'node .*verdaccio'` printed `(none)` **while that registry was live**.
`pgrep -af verdaccio` and `ss -ltnp` both found it. The port probe is the authority here, not the
process-name pattern.

The token in the work dir is **live against that orphan**, not merely present — the half of `bug-059`
the reviewer added:

```
$ TOK=$(sed -n 's/.*_authToken=//p' /tmp/wingfoil-staging-*/npmrc)
$ curl -sS -m 5 -H "Authorization: Bearer $TOK" http://localhost:4873/-/whoami
{ "username": "wingfoil-staging" }
$ curl -sS -m 5 http://localhost:4873/-/whoami       # anonymous, for comparison
{}
```

and the leak is self-perpetuating — the counter-measurement AC5 inverts. Run here with the **fixed**
script, which makes the point sharper: the guard fires on the surviving registry, so the fix cannot
rescue a run started after someone else's orphan.

```
$ node scripts/publish-staging.cjs --tarball <the same tarball> ; echo "REAL_EXIT=$?"
[publish:staging] staging FAILED: http://localhost:4873/ is already in use — stop that registry first
REAL_EXIT=1
```

The orphan was then removed by pid (`kill 25090` — never `pkill -f verdaccio`, see the cleanup section)
and `rm -rf /tmp/wingfoil-staging-*`, and the machine re-probed clean before any further run.

**Part 2 — the unit red.** Commit `de5d612`. One suite widened (`test/cli/publish-staging.test.ts`), no
new file. `npx jest test/cli/publish-staging.test.ts` → **`Tests: 7 failed, 20 passed, 27 total`**:

| Failing case | Reason |
|---|---|
| "packs, stages, publishes, installs, smokes, then tears down — in that order" | the expected call list now carries `removeToken /tmp/wf-staging-test` between `smoke` and `stopRegistry` (AC4); teardown does not call it on the base |
| "installs a handler for exactly SIGINT, SIGTERM and SIGHUP…" | `TypeError: (0 , publish_staging_cjs_1.installTeardownHandlers) is not a function` |
| "tears down exactly once and re-raises %s when it arrives mid-run" | `it.each(TEARDOWN_SIGNALS)` — the export is `undefined` on the base, so the row cannot even expand |
| "removes the npmrc before the registry and before the work dir" | same missing export, and `removeToken` is not an effect |
| "absorbs a second signal during teardown…" | `installTeardownHandlers is not a function` |
| "still exits on the signal when teardown itself throws…" | `installTeardownHandlers is not a function` |
| "touches no real process handler when no `interrupts` option is given" | `Cannot read properties of undefined (reading 'map')` — `TEARDOWN_SIGNALS` |

**Passing at red, by design — the AC8 characterization.** The six-row `it.each` "fails (exit 1) when %s
fails, and still tears down" was left **untouched**: its assertions (the last call is `removeWorkDir`,
`stopRegistry` ran iff the registry started) are exactly `task-077`'s in-process-failure finding and
they hold before and after. Fabricating a red there would have meant changing an assertion that was
already true.

### green — role: developer

Commit `dfadd3d`. `npx jest test/cli/publish-staging.test.ts` → **`Tests: 29 passed, 29 total`**.

- `TEARDOWN_SIGNALS = Object.freeze(['SIGINT','SIGTERM','SIGHUP'])` with the per-signal justification
  from `design` in its doc comment, including why `SIGKILL`/`SIGQUIT`/`SIGUSR1` are absent.
- `installTeardownHandlers({ teardown, log, die = raiseSignal, target = process, signals =
  TEARDOWN_SIGNALS })` → returns `uninstall`. One in-flight `interrupting` promise absorbs re-entry;
  `die` runs from a `finally`, so a throwing teardown still ends the process.
- `raiseSignal(signal)`: flush stdout → `process.removeAllListeners(signal)` →
  `process.kill(process.pid, signal)`.
- `runStaging` gains the memoised `teardown()` (`teardownRun ??= …`) and the opt-in `interrupts`
  option; its `finally` is now `await teardown()` then `uninstall()`. The `if (registry)` guard moved
  inside `teardown` unchanged.
- `realEffects.removeToken = (dir) => rmSync(stagingPaths(dir).userconfig, { force: true })` — `force`
  so teardown before `createToken` is a no-op.
- `main()` passes `interrupts: { target: process, die: raiseSignal }`; nothing else does.
- `.d.cts`: `removeToken` on `StagingEffects`, `interrupts` on `StagingOptions`, new `SignalTarget` and
  `TeardownHandlerOptions`, `TEARDOWN_SIGNALS` and `installTeardownHandlers`.
- Header bullet 7 rewritten (**AC9**) — teardown runs "on success, on every failure, and on an
  interrupt: `SIGINT`, `SIGTERM` or `SIGHUP` … The one case NOT covered is `SIGKILL`, which POSIX
  forbids catching".

**One red that was the test's fault, not the code's**, recorded because it is a real finding about the
design: the three `it.each` rows first failed on `expect(lines).toContain('interrupted by …')` with
`Received string: ""`. Cause — `installTeardownHandlers` is called by `runStaging` as
`{ ...interrupts, teardown, log: effects.log }`, i.e. `teardown` and `log` **override** anything the
caller puts in `interrupts`. That is deliberate (the handler must log through the staging log sink and
must run the run's own teardown, not a substitute), so the test was corrected to set `log` on the
*effects*, not on the interrupts. Worth a reviewer's eye: the option object is not fully caller-controlled
by design.

**Part 3 — the real-run proof, after the fix.** Two runs, both from this worktree **after the second
`main` merge** (`678c326`, carrying `7e4146e`), i.e. against the submitted tree.

**Run A — `SIGINT` to the script alone, sent twice (AC1, AC3, AC4, AC6).**

```
$ bash run-and-signal.sh INT rerun-after-fix-sigint double
SCRIPT=scripts/publish-staging.cjs
SCRIPT_PID=25782
--- registry up after 27s; sending SIGINT to 25782 ---
--- second SIGINT (AC6: re-entry during teardown) ---
SCRIPT_WAIT_STATUS=130
SCRIPT_GONE_AFTER=44s
--- log tail ---
[publish:staging] staged wingfoil@0.1.0 and smoke passed
[publish:staging] interrupted by SIGINT — running teardown
[publish:staging] SIGINT received again — teardown is already running and is bounded; ignoring
[publish:staging] teardown complete after SIGINT: registry stopped, work dir removed — exiting on SIGINT
```

Read this transcript carefully, because it demonstrates three things at once:

1. **The `spawnSync` limitation the design predicted, observed.** The signal went to the script only,
   so the in-flight `npm publish` / `npm install --global` children kept running and the event loop
   stayed blocked until the flow finished — the handler ran ~44 s later (`SCRIPT_GONE_AFTER=44s`),
   after `staged … and smoke passed`. The design note called this out before the run; this is the
   measurement. It is also why the run-B shape below matters: in the realistic Ctrl-C case the whole
   group is signalled, the child dies first, and teardown starts within ~2 s.
2. **The `finally` and the signal path both fired, and teardown still ran once** — exactly one
   `teardown complete` line (`grep -c 'teardown complete' rerun-after-fix-sigint.log` → `1`), which is
   AC6's "does not double-run" in the real process rather than in a fake.
3. **AC3 in its sharpest form.** `runStaging` *returned 0* here — the flow really did complete — and the
   process still died **130**. An interrupted run cannot report success even when the work happened to
   finish, which is precisely the CI hazard the constraint names.

The three AC1 probes plus the AC4 one, immediately after:

```
$ curl -sS -m 5 http://localhost:4873/-/ping ; echo "CURL_EXIT=$?"
curl: (7) Failed to connect to localhost port 4873 after 0 ms: Couldn't connect to server
CURL_EXIT=7
$ ss -ltn 'sport = :4873'
State Recv-Q Send-Q Local Address:Port Peer Address:Port      # no LISTEN row
$ ls -d /tmp/wingfoil-staging-*
(no work dir)
$ ls -l /tmp/wingfoil-staging-*/npmrc
(no npmrc)                                                    # AC4
$ pgrep -af verdaccio
(none)                                                        # the broad pattern, per Part 1's trap
```

**Run B — `npm run publish:staging`, `SIGTERM` to the whole process group (AC2, AC5), started
immediately after run A.** The group signal is what a terminal's Ctrl-C and a CI cancellation actually
do, and it exercises the `npm run` wrapper rather than a bare `node`:

```
$ bash run-npm-and-signal-group.sh TERM rerun-after-fix-sigterm
NPM_PID=26447 (process group 26447)
--- registry up after 24s (so the in-use guard did NOT fire: AC5) ---
--- sending SIGTERM to the whole process group -26447 ---
NPM_WAIT_STATUS=143
GONE_AFTER=2s
--- log tail ---
[publish:staging] Verdaccio up on http://localhost:4873/
[publish:staging] staging FAILED: npm publish … exited undefined
[publish:staging] interrupted by SIGTERM — running teardown
[publish:staging] teardown complete after SIGTERM: registry stopped, work dir removed — exiting on SIGTERM
```

- **AC5 is the first line of this run**, not an extra check: the previous run had just been interrupted,
  and this one reached `Verdaccio up` in 24 s. The guard that fired with `is already in use` under `red`
  did not fire. The driver fails loudly (`IN_USE_GUARD_FIRED — AC5 FAILS`) if it ever does.
- **AC2**: teardown ran on `SIGTERM`, and the probes after it were identical to run A's (no ping, no
  LISTEN row, no work dir, no `npmrc`, no registry process by either `pgrep` pattern).
- **AC3 again**: `143` = `128 + 15`, the conventional `SIGTERM` status, and `npm` propagated it. Note
  what this status measures: the whole group was signalled, so `npm` itself was signalled too — the
  script's own honest exit is shown by its final log line plus run A's `130`, where nothing but the
  script was signalled.
- Because the whole group was signalled, the in-flight `npm publish` child died first — `run()` threw
  (`exited undefined`, i.e. killed by a signal), the `catch` logged `staging FAILED`, and the handler
  then ran at once rather than after a blocking `spawnSync`. Teardown ran once here too
  (`grep -c 'teardown complete' rerun-after-fix-sigterm.log` → `1`).

**`SIGHUP` is covered by unit test only.** The same handler over the same teardown, asserted by the
`it.each` row above; no real `SIGHUP` run was performed and none is claimed.

### Cleaning up after the experiments

**Including after the interruption.** This task was killed mid-flight by a network error on 2026-09-21
while real staging runs had been made; the first thing done on resuming, before any other work, was to
probe for survivors. There were none — the interruption killed the agent, not a staging run, and no run
was in flight at the time. Every run of the second pass was then accounted for individually.

Six real staging runs were made in total across both passes (pre-fix leak ×2, blocked-guard probe ×2,
post-fix ×2 per pass where applicable, plus two `npm pack`s). Only the **pre-fix** runs leaked — that is
what they were proving — and each was cleaned immediately: the orphan killed **by pid** taken from
`ss -ltnp` (`kill 25090`), then `rm -rf /tmp/wingfoil-staging-*`. Never `pkill -f verdaccio`: that
pattern matches the command line of the very shell running it, and in the first pass it killed that
shell (exit 144). For the same reason the probes live in `scratchpad/probe.sh` rather than being typed
inline — a `ps -eo args | grep verdaccio` on the command line matches itself and reports a phantom.

Final state, `bash scratchpad/probe.sh`, run after the last staging run of this task:

```
curl -sS -m 5 http://localhost:4873/-/ping  → curl: (7) Failed to connect …   # nothing listening
ss -ltn 'sport = :4873'                     → no LISTEN row
ls -d /tmp/wingfoil-staging-*               → (no work dir)
ls -l /tmp/wingfoil-staging-*/npmrc         → (no npmrc)
pgrep -af 'node .*verdaccio'                → (none)
pgrep -af verdaccio                         → (none)            # the broad pattern too
ls -l ~/.npmrc                              → -rw------- 1 robypomper robypomper 36 apr 22 21:00
grep -c '4873' ~/.npmrc                     → 0
```

> **Corrected after reject `8937a51`.** The two `~/.npmrc` lines above replace a single
> `grep -n '4873' ~/.npmrc → (none / no ~/.npmrc)` line, and the sentence below replaces one that
> said the file "does not exist on this machine". **It does exist** — 36 bytes, dated 22 April, months
> before this work, containing exactly `prefix=/home/robypomper/.npm-global` and no reference to
> :4873. The cause was the probe script itself: it ran `grep -n 4873 ~/.npmrc 2>/dev/null || echo
> "(none / no ~/.npmrc)"`, whose one fallback message covers *both* "no match" and "no file", and the
> note then reported the wrong half of that ambiguity. The probe now reports existence and content as
> two separate facts (`ls -l`, then `grep -c`), so the conclusion cannot be read off a message that
> does not distinguish them. The load-bearing claim was true and remains true, but it was true by
> luck of phrasing rather than by measurement — which is exactly the pattern this release keeps
> rejecting.

The staging environment points npm's `userconfig`, `globalconfig`, `cache` and `prefix` into the work
dir, so the global install the smoke performs went with it; the user's `~/.npmrc` is a pre-existing
`prefix=` line that these runs never read (npm's userconfig was redirected) and never wrote —
`grep -c '4873'` on it returns `0` before and after. The temporary
`scripts/publish-staging-BASE.cjs` used for the pre-fix measurement was deleted and never committed
(`git status --porcelain` → only the task file). The in-use guard is **not** left tripped, which
matters: other task agents share this machine and port 4873.

### refactor — role: developer

No structural refactor was needed and none was invented: the change is one new module-level function,
one memoised closure inside `runStaging`, one new effect and a header rewrite, all authored in their
final shape at `green` (the `code-quality` directive asks for the smallest coherent change, not for a
second pass to justify the phase). What this phase did do:

- **No new constant, no new bound.** The registry half of teardown is `stopProcess`'s existing
  `REGISTRY_STOP_TIMEOUT_MS` → `SIGKILL_GRACE_MS` escalation, reused unchanged (constraint 4 of the
  task brief). The task explicitly allows inventing new bounds only with an explanation; none was
  needed, so none exists.
- **No eslint globals change.** `task-078` had to add `clearTimeout` to `eslint.config.js`'s allowlist
  for `scripts/**/*.cjs`; this change uses only `process`, already allowed — `npm run lint` exits 0
  with `eslint.config.js` untouched (`git diff main...HEAD --stat` lists no `eslint.config.js`).
- **Gates re-run after the second `main` merge**, not before (table below).

### review-ready summary — role: developer → reviewer

**What landed.** `scripts/publish-staging.cjs` now tears down on an interrupt, not only on the success
and failure paths:

| AC | Delivered by | Proof |
|---|---|---|
| 1 `SIGINT` runs teardown | `installTeardownHandlers` + memoised `teardown()` | real run A probes (no ping / no LISTEN / no work dir) + `it.each` row |
| 2 `SIGTERM` too | same handler, `TEARDOWN_SIGNALS` | real run B (`npm run`, group signal) + `it.each` row |
| 3 honest exit | `raiseSignal`: flush → `removeAllListeners` → `process.kill(self)` | run A `SCRIPT_WAIT_STATUS=130` *while `runStaging` returned 0*; run B `143` |
| 4 no credential survives | new `removeToken` effect, **first** in teardown | `ls /tmp/wingfoil-staging-*/npmrc` → none, both runs; ordering case |
| 5 later run not blocked | follows from 1 | run B reached `Verdaccio up` in 24 s right after run A's interrupt |
| 6 idempotent, bounded | one memoised promise; re-entry absorbed; `die` in a `finally`; `stopProcess`'s bounds | one `teardown complete` line per run; three unit cases |
| 7 injected-effects shape kept | `interrupts` is opt-in; fake signal target in tests | suite is offline; `process.listenerCount` case |
| 8 in-process failure still tears down | untouched | the six pre-existing `it.each` rows still pass |
| 9 header truthful | bullet 7 rewritten, `SIGKILL` named as uncoverable | the file |
| 10 gates | — | table below |
| 11 `bug-059` synced | `wf(bug): sync … [in-progress → in-review]` | this branch |

**Sync with `main` — twice.** First `git merge main` (`aa688fc`) at `8f5f1df`, second (`7e4146e`) at
`678c326`, both clean, no conflicts — merge, never rebase (`dl-035`). The second brought `task-082`
(`test/storage/helpers/git-fixture.ts`, new `test/storage/git-fixture-teardown.test.ts`), `bug-058`
closed and `bug-063` filed; the first brought `task-080`'s `package.json`/`package-lock.json` peer
overrides, so `npm ci` was re-run after each merge before the gates. Documents re-opened after the
merges: `spec-015-packaging-publishing` (unchanged by either merge — `git log --oneline main..HEAD --
docs/self/docs/04_memory/design/specs/` is empty, and the `verify_specs` grep above still returns the
same two lines), and the newly landed **`dl-076-toolchain-divergence-unexercised-until-tag`**
(`in-discussion`), which names `bug-059` three times. Its claim — "**No** — CI sends no SIGINT", i.e.
an ordinary CI run would never have *found* this bug — is about discovery, not about disposition, and
nothing in this change contradicts it; the design note was tightened after reading it so that it no
longer asserts anything about a GitHub runner's signal sequence that could not be verified from this
machine.

**BDD acceptance.** `grep -rln 'publish\|staging\|signal' docs/02_requirements/02_bdd/features/`
returns nothing for the publishing pipeline — the same finding `task-078` recorded: `spec-015`,
`adr-009` and `REQ-SYS-09` are its contract, and the asserting suites are `test/cli/publish-staging.test.ts`
(29 cases, 7 of them this task's), `test/cli/publish-secrets.test.ts` and `test/cli/publish-pipeline.test.ts`.

**Gates — after the second merge, in this worktree.**

| Command | Result |
|---|---|
| `npx jest` | `Test Suites: 106 passed · Tests: 1723 passed` |
| `npx jest --coverage` | `All files 98.58 % stmts · 92.58 % branch · 98.81 % funcs · 99.18 % lines` — non-regressing (`task-078` recorded 98.54 / 92.30 / 98.76 / 99.15) |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 — **no output at all**; `bug-026`'s exception is gone since `task-076` |
| `npm run lint` | exit 0 |
| `npm run docs:api` | exit 0 |

`scripts/**` is outside `collectCoverageFrom` (`src/**/*.ts` only), so this change neither raises nor
lowers the coverage figure; the movement above is `main`'s, carried in by the merges.

**Known weak spots a reviewer should check.**

1. **The `spawnSync` gap is real and is not closed here.** A signal delivered *only* to the script
   while an npm child is running is honoured when that child exits — measured at 44 s in run A. The
   interactive and CI cases both signal the whole process group, where the child dies first and
   teardown starts in ~2 s (run B), so the leak `bug-059` describes is closed in the paths that
   actually occur. Forwarding signals to the in-flight child would close the remaining one; that is a
   change to `run()`/`stopProcess`'s contract, larger than these ACs, and is raised as a proposed
   element rather than smuggled in.
2. **`SIGHUP` was never really sent.** Unit-tested as the identical handler; no real-run probe. Stated
   here and in the design table rather than implied by "three signals handled".
3. **`installTeardownHandlers`'s options are not fully caller-controlled.** `runStaging` overrides
   `teardown` and `log` from anything passed in `interrupts` — deliberate, but a reader could be
   surprised; it cost one wrong assertion during `green` (recorded above).
4. **The re-entry guard absorbs a second Ctrl-C.** A user hammering Ctrl-C waits out teardown (bounded
   at ≤ 12 s + one `rm`). The alternative was rejected on purpose; if a reviewer prefers "second signal
   exits at once", AC4's npmrc-first ordering is already in place to make that survivable, but the
   change would be theirs to ask for.
5. **`spec-015`'s revision paragraph now reads as history.** It records `task-077`'s finding that
   teardown does not run on `SIGINT`. True of what was found; no longer true of the file. Amending an
   `approved` spec needs its own dated Revision note (`dl-047`) and is not a dev-loop act — proposed
   element, not done here.

---

## Second pass — after reject `8937a51`

### red — role: developer (second pass)

**The rejection's blocking defect, reproduced here before touching it.** The reviewer found it; this
section does not take that on trust. Three drivers, all in
`/home/robypomper/Workspaces/.wf2-wt-scratch-083/` (the previous scratch path under `/tmp` was
destroyed by the overnight sweep, which is why it moved):

**Attempts 1 and 2 — the honest misses.** Watching the log for Verdaccio's `http address` line with a
`grep`/`sleep 0.02` loop and signalling on sight: `WINDOW_HIT=no` both times — the poll had already
returned, the message was correct, and teardown worked. Recorded because they bound how narrow the
window is: a 10–20 ms detection loop loses the race often enough that two attempts hit nothing. An
implementer who tried twice and stopped would have concluded the defect was not real.

**Attempt 3 — deterministic, via the blocking install.** `startRegistry` does, in order: the in-use
guard `await`; `run('npm', [install verdaccio])`, a **`spawnSync` that blocks the event loop for ~25
s**; `spawn(child)`; then the readiness poll. Node cannot run a signal handler while the loop is
blocked, so a signal delivered *during the install* is queued and handled at the first `await` of the
poll — **after the spawn, before `startRegistry` resolves**, every time, with no race:

```
$ bash run-and-signal-startup.sh INT before-startup 10
SCRIPT_PID=131790 · SCRIPT_WAIT_STATUS=130
WINDOW_HIT=yes (startRegistry never resolved: the handler ran inside the start-up window)
--- log tail ---
    at ModuleJob._link (node:internal/modules/esm/module_job:182:49) { code: 'ERR_MODULE_NOT_FOUND' }
[publish:staging] teardown complete after SIGINT: registry stopped, work dir removed — exiting on SIGINT
```

The `ERR_MODULE_NOT_FOUND` stack is the **child's own output**: it was spawned, and it died only
because teardown deleted the work dir out from under the modules it was still loading. `stop()` was
never called — and the last line claims it was.

**Attempt 4 — the reviewer's exact case, with the orphan.** Same window, later in it: signal the
instant the port starts listening, detected by `tail -f` (~1 ms) instead of a grep loop (~10–20 ms).
The child is fully booted, so it survives the work-dir removal:

```
$ bash run-and-signal-listening.sh INT before-listening
SCRIPT_PID=132019 · SCRIPT_WAIT_STATUS=130
--- listener line seen; SIGINT sent immediately ---
WINDOW_HIT=yes (the handler ran before startRegistry resolved)
[publish:staging] interrupted by SIGINT — running teardown
[publish:staging] teardown complete after SIGINT: registry stopped, work dir removed — exiting on SIGINT
```

```
$ bash probe.sh
curl … /-/ping                → {}   CURL_EXIT=0                     # the registry answers
ss -ltnp 'sport = :4873'      → LISTEN … users:(("verdaccio",pid=132081,fd=26))
ls -d /tmp/wingfoil-staging-* → (no work dir)                        # AC4 held: the token is gone
ls /tmp/wingfoil-staging-*/npmrc → (no npmrc)
pgrep -x verdaccio            → 132081
$ node scripts/publish-staging.cjs --tarball … ; echo "REAL_EXIT=$?"
[publish:staging] staging FAILED: http://localhost:4873/ is already in use — stop that registry first
REAL_EXIT=1
```

Exactly the rejection: orphan on :4873, guard tripped for every later run, work dir and token
correctly gone (the security half was never in question), and the completion line stating that the
registry was stopped when nothing had been. Cleaned immediately — `kill 132081`, `rm -rf
/tmp/wingfoil-staging-*`, re-probed clean — before any further run.

**The unit red.** Three cases added, and the production file stashed back to the rejected state to
show them fail (`git stash push scripts/publish-staging.cjs`; `git stash pop` after):

```
$ npx jest test/cli/publish-staging.test.ts          # production file at the rejected state
● … the start-up window (reject 8937a51) › stops a registry that is still coming up when the signal lands mid-poll
● … the start-up window (reject 8937a51) › reports what teardown actually did, and says the registry was stopped only when it was
● … the start-up window (reject 8937a51) › does not claim a registry was stopped when none had been started
Tests: 3 failed, 29 passed, 32 total
```

The middle case needed strengthening before it was worth anything. Its first draft asserted the
message contained `registry stopped` — which the **rejected** fixed sentence also contained, so it
passed against the defect. Caught by running the stash-back rather than by reading it: the first run
showed `2 failed`, not 3. It now asserts the whole ordered list, `token removed, registry stopped,
work dir removed`, and the token step is what proves the line is derived rather than fixed — the old
sentence never mentioned it.

**AC7's guard — the mutation, run twice, in both directions.** The rejection states the old guard was
not load-bearing; verified rather than accepted. Mutation: `const uninstall = interrupts ? install… :
undefined` → `const uninstall = installTeardownHandlers({ ...interrupts, … })`, i.e. handlers armed
on the real `process` unconditionally.

| Guard shape | Under the mutation |
|---|---|
| old — `listenerCount` before and after `runStaging` only | `Tests: 32 passed` — **green, as the rejection said** |
| new — sampled mid-run inside `createToken` and `smoke` | `Tests: 1 failed, 31 passed` — the AC7 case, and only it |

Both rows were produced by applying the mutation for real and restoring afterwards
(`git status --porcelain` clean between runs). The old shape cannot distinguish "never installed" from
"installed and removed" because `uninstall()` always runs in the `finally`; the new one samples while
the handlers would still be armed.

### green — role: developer (second pass)

Commit `2733a1f`. Three changes, all in `scripts/publish-staging.cjs` (+ `.d.cts`):

1. **`startRegistry(paths, env, onSpawn)`.** `realEffects` calls `onSpawn({ stop })` immediately after
   `spawn(...)` and `child.on('exit')`, **before** the readiness poll; `runStaging` passes
   `(spawned) => { registry = spawned; }` and still assigns the resolved value as before. From the
   instant the child exists, teardown can stop it. The handle is the same `stop` closure the resolved
   value carries, so there is no second stop path and `stopProcess`'s bounds are unchanged.
2. **`teardown` returns what it did.** It accumulates `token removed` / `registry stopped` *or*
   `no registry to stop` / `work dir removed`, and the handler prints that list. The nested `finally`s
   are unchanged and still load-bearing: a throwing `removeToken` must not cost the registry its
   `stop()`, and neither failure may cost the work dir its removal.
3. **AC7's guard samples mid-run** from inside two fake effects.

`npx jest test/cli/publish-staging.test.ts` → `Tests: 32 passed, 32 total`.

**Field verification, after merging `main` (`7a65580`) — the same commands as the red, same drivers.**

| Run | Command | Result |
|---|---|---|
| A | `run-and-signal-listening.sh INT after-listening` | `WINDOW_HIT=yes`, status **130**, line: `teardown complete after SIGINT: token removed, registry stopped, work dir removed` |
| B | `run-and-signal-startup.sh INT after-startup 10` | `WINDOW_HIT=yes`, line: `token removed, registry stopped, work dir removed` — the child was stopped deliberately this time, instead of dying of its own accord with `ERR_MODULE_NOT_FOUND` |
| C | `run-npm-and-signal-group.sh TERM after-npm-sigterm`, started right after B | registry up in **29 s** — the in-use guard did **not** fire (AC5) — status **143**, same derived line |

Run A is the rejected case, same driver and same marker, and `WINDOW_HIT=yes` says the window was
genuinely entered rather than missed. Probe after each, `bash probe.sh`:

```
curl … /-/ping                   → curl: (7) Failed to connect …
ss -ltn / ss -ltnp 'sport = :4873' → no LISTEN row, no owner
ls -d /tmp/wingfoil-staging-*    → (no work dir)
ls -l /tmp/wingfoil-staging-*/npmrc → (no npmrc)
pgrep -af verdaccio              → (none)
ls -l ~/.npmrc                   → -rw------- … 36 apr 22 21:00
grep -c '4873' ~/.npmrc          → 0
```

`grep -c 'teardown complete'` → `1` in each of the three logs: teardown still runs exactly once.

**Run B's outcome is worth one sentence, because it changes what the message means.** Pre-fix, a
signal during the install left a freshly-spawned child that died on its own when its files vanished —
the leak did not show, but only by accident. Post-fix the same run reports `registry stopped`, and
that report is now *evidence* the `onSpawn` handle was in place: had it not been, the line would read
`no registry to stop`. The message and the fix check each other.

### review-ready summary — second pass

**The four rejection items.**

| Item | Fixed by | Proof |
|---|---|---|
| Start-up window: `stop()` never called | `onSpawn` hands out `{stop}` at spawn time | reproduced with an orphan (pid 132081) and re-run clean on the same driver; unit case red→green |
| The completion line lied | teardown returns its step list; handler prints it | `token removed, registry stopped, work dir removed` in all three field runs; `no registry to stop` case unit-tested |
| AC7 guard not load-bearing | sample `listenerCount` mid-run | mutation table above: old shape 32 passed, new shape 1 failed |
| `~/.npmrc` claim false | sentence rewritten in place + probe split into two facts | `ls -l ~/.npmrc` → 36 bytes, 22 April; `grep -c '4873'` → 0 |

**Untouched, as instructed.** The signal death and its 130/143 statuses, teardown memoisation and
bounds, second-signal absorption, exit-despite-throwing, the npmrc-first ordering and `SIGHUP` are all
exactly as approved — no line of any of them was edited this pass. `git diff` between the two
submissions touches `startRegistry`'s signature, `teardown`'s return value, one log line and one test.

**`spec-015` was NOT edited**, and the first pass's finding 5 is now `task-085-retense-spec-015-sigint-
sentence` (`backlog`, `depends_on: [task-083, task-084]`), which arrived in this merge. The first pass
left that finding as a proposal inside these Execution Notes, where nothing reschedules it — the exact
failure `bug-062` was opened about. It is a filed task now, and amending an `approved` spec is not a
dev-loop act (`dl-047`).

**Sync with `main` — third merge.** `7a65580`, clean. It carried `task-084` (which rewrote `spec-015`
§3's stage-1 claims and kept the SIGINT sentence citing `bug-059`), `task-085`, `bug-062` closed and
`bug-064/065/066`. No `package.json` or lockfile change, so `npm ci` was not re-run; re-read after
merging: `spec-015` §3 now states the SIGINT gap with an explicit bound and a `bug-059` citation, which
`task-085` will re-tense — nothing in these notes depends on its tense.

**Gates — after that merge.**

| Command | Result |
|---|---|
| `npx jest` | `Test Suites: 106 passed · Tests: 1726 passed` |
| `npx jest --coverage` | `All files 98.58 % stmts · 92.58 % branch · 98.81 % funcs · 99.18 % lines` (unchanged; `scripts/**` is outside `collectCoverageFrom`) |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` | exit 0, no output |
| `npm run lint` | exit 0 |
| `npm run docs:api` | exit 0 |

**Weak spots, second pass.**

1. **The `spawnSync` gap is still open and still out of scope.** A signal delivered *only* to the
   script during a blocking npm step is honoured when that step returns. It no longer leaks — the
   handler now stops the child — but it can be slow (44 s measured in the first pass). Proposed
   element, unchanged.
2. **The window is narrow and my first two attempts missed it.** Anyone re-verifying should use the
   `tail -f` driver or the during-install variant, not a grep/sleep loop; a miss looks exactly like a
   pass. Both drivers print `WINDOW_HIT=yes|no` so the distinction cannot be lost.
3. **`onSpawn` is optional in the type.** A future effects implementation that ignores it silently
   reopens the window; the unit case covers `runStaging`'s side, not a third-party effect's. Making it
   required would be a wider change to the interface than this fix needs.
4. **`SIGHUP` still has no real-run probe** — unchanged from the first pass, and explicitly kept by the
   approver.
