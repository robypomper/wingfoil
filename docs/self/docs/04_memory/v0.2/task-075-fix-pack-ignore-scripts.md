---
id: "task-075-fix-pack-ignore-scripts"
type: task
title: "Fix bug-022: run npm-distribution's `npm pack` with `--ignore-scripts`, so the release gate cannot rebuild dist/ mid-suite"
status: in-progress
release: "v0.2"
priority: "High"
tags: ["v0.2", "release", "testing"]
ref: "dl-056-first-real-publishing-run"
bug: ["bug-022-npm-pack-prepack-rebuilds-dist"]
depends_on: []
tmpl_version: 260703
---

## Description

Fix **bug-022**: `test/cli/npm-distribution.test.ts:117` runs

```ts
const raw = execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: REPO_ROOT, encoding: 'utf-8' });
```

without `--ignore-scripts`, so npm runs the `prepack` hook — `"prepack": "npm run build"` →
`tsc -p tsconfig.build.json` (`package.json`) — which rewrites the shared `dist/` while other Jest
workers are spawning `node dist/cli.js`. Re-verified on `main` at `8f2bce8` for this task: the line
number, the exact argument list and the `prepack` script all read as quoted above.

**The fix is one argument, and three sibling suites already carry it.** Every other `npm pack` in the
suite passes `--ignore-scripts` — `test/cli/publish-metadata.test.ts:79`,
`test/cli/license-file.test.ts:102` and `test/core/builtin-directive-templates.test.ts:251`
(`grep -rn "execFileSync('npm'" test/` returns exactly those three plus the defective one). Two of them
say why in their header comments; `license-file.test.ts:16` names `bug-022` directly. So
`npm-distribution.test.ts` is the single outlier, not a case the convention has not reached yet.

**It is no longer only a local flake — it sits inside the release gate.** `.github/workflows/publish.yml`'s
`gate` job runs `npm run prepublishOnly` (`:100-101`), and `prepublishOnly` is
`npm run build && npm test && npm run lint`, so `npm test` — and this suite — executes inside the job
that guards a tagged release. No `maxWorkers` is configured (`grep -n maxWorkers jest.config.js
package.json` → no output), so Jest picks a worker count from the runner's cores and the race is live on
a multi-core GitHub runner. The single-build `globalSetup` that closed `bug-003`
(`jest.config.js` → `test/global-setup.cjs`) is exactly what a mid-run rebuild defeats.

Ratified in **`dl-056-first-real-publishing-run` clause B** (approve commit `3655166`): the fix is the
one-argument one, **not** running the gate's tests with `--runInBand`. The approver's reason is recorded
there — the serial workaround "would hide it only in CI", while the flake also affects every developer's
`npm test`.

## Acceptance Criteria

1. **`test/cli/npm-distribution.test.ts`'s `npm pack` call passes `--ignore-scripts`,** and the suite
   still asserts what it asserted before: `dist/cli.js` and `README.md` are in the packed file list, and
   nothing under `docs/self/.wingfoil` or `test/` is. The assertions are unchanged; only the argument
   list moves.
2. **`--ignore-scripts` does not hollow out the test.** The packed list must still be the real one.
   Show that: with `dist/` present (the `globalSetup` build), record the packed paths the suite observes
   with and without the flag and state whether they differ. If they differ, say how, and decide whether
   the suite needs `dist/` guaranteed by something other than `prepack` before it can drop the rebuild —
   do not assume `globalSetup` covers it, open `test/global-setup.cjs` and confirm it actually produces
   the files the assertions name.
3. **No `npm pack` under `test/` runs lifecycle scripts any more.** After the fix,
   `grep -rn "'pack'" test/` shows every occurrence carrying `--ignore-scripts`. Put the command and its
   output in the Execution Notes; the count at the time of writing is four call sites, three of them
   already correct — re-derive it rather than trusting that number.
4. **The reason is written down where the next reader of this file will see it.** Add (or extend) the
   suite's header comment to say why the flag is there, as `publish-metadata.test.ts:29` and
   `license-file.test.ts:16` already do. A bare argument with no comment is how this outlier survived
   three sibling fixes.
5. **The change is classified honestly.** `dl-014`/T1: this is a **characterization** change, not
   red-first — the behaviour under test (the packed manifest) is unchanged and correct; what changes is
   a side effect on a shared build artefact that no assertion inside the suite can observe. Say so
   explicitly and do **not** fabricate a red. If a reproduction is attempted (e.g. repeated
   `npx jest --maxWorkers=4` runs before and after), report the real numbers, including "did not
   reproduce in N runs" if that is what happened — an intermittent race that refuses to show up is an
   honest result, and this project rejects notes that claim more than the commands showed.
6. **Gates green:** full Jest suite, coverage >80% and non-regressing, `tsc -p tsconfig.build.json`,
   `npm run docs:api`, `npm run lint` (`lint.clean`, `dl-034`).
7. **Out of scope, deliberately:** (a) `--runInBand` in the `gate` job — the alternative `dl-056`
   clause B explicitly did **not** take; (b) configuring `maxWorkers` in `jest.config.js` — a separate
   decision about suite parallelism that no element has raised, and pinning it would mask this class of
   bug rather than fix it; (c) any other change to `.github/workflows/publish.yml`, which
   `task-078-publish-pipeline-hardening` edits in the same release.

## Implementation Notes

Source: `bug-022-npm-pack-prepack-rebuilds-dist` (`triaged`, severity **medium** — re-graded from `low`
by `dl-056` clause B), `release: "v0.2"`. Ratifying decision: `dl-056-first-real-publishing-run`,
`status: ready`, approve commit **`3655166`**.

- **Why it is scheduled now, ahead of the rest of the publish chain.** `task-060-publish-pipeline` put
  `npm test` inside `prepublishOnly`, and the `gate` job runs `prepublishOnly`, so this flake can fail a
  tagged release — the one situation where the failure is public and the rollback is `npm deprecate`
  (`spec-015` §5). `dl-056`'s approve commit states the ordering constraint directly: "bug-022's fix
  must precede the first tag."
- **`ref: dl-056-first-real-publishing-run`** rather than a `REQ-*` code: no SARD requirement covers
  test-suite hygiene, and `dl-056` clause B is the decision that both re-graded the bug and chose
  between the two candidate fixes. This follows the `task-059`/`060`/`061` precedent of referencing the
  decision-log that authorises the work.
- **`dl-045` back-reference** recorded before the task starts, so `bug.sync_state` can drive
  `bug-022`'s own state from this task.
- **Related but not owned here:** `bug-003-cli-integration-dist-race` (closed) is the same class in a
  different disguise and is why `globalSetup` exists; `task-077-first-real-staging-run` runs the `gate`
  job under `act`, where this flake is one of the things that can produce a misleading failure there.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### design — role: architect

Worktree `/home/robypomper/Workspaces/.wf2-wt/task-075-fix-pack-ignore-scripts`, branch
`task/task-075-fix-pack-ignore-scripts` from `main` at `a7d783a`. Dependencies installed with a real
`npm ci --prefer-offline --no-audit --no-fund` (exit 0, 343 entries in `node_modules/`), not a
symlink to the primary worktree — `bug-043-npm-ci-fails-on-stale-package-lock` is closed and
`task-073` merged, so the lockfile installs cleanly. Toolchain: node `v22.21.0`, npm `11.6.2`.

Directives auto-loaded (`roles.yaml`): architect — architecture, determinism, traceability; developer
(later phases) — code-quality, testing, determinism; global — doc-versioning, documentation,
security-secrets.

**`agent.read_related` (dl-015, HARD gate).** `depends_on: []`, so the task-notes half of the gate is
vacuous — there is no upstream task whose Execution Notes could defer work here. Read and
acknowledged instead, as the elements this task is derived from:

- **`dl-056-first-real-publishing-run`** (`ready`), clause B and its approve commit `3655166`. The
  approver's recorded reason ratifies the **one-argument** fix and rejects the alternative verbatim:
  "the fix is the one-argument one — `--ignore-scripts`, as test/cli/publish-metadata.test.ts already
  does — rather than running the gate's tests serially… the serial workaround would hide it only in
  CI". Same commit: "bug-022's fix must precede the first tag." AC7(a) follows from this, not from a
  preference of mine.
- **`bug-022-npm-pack-prepack-rebuilds-dist`** — the defect report; its severity was lifted
  `low → medium` and `release: "v0.2"` stamped in `cccfa60`, the same commit that took it
  `open → triaged`.
- **`dl-045-absorbed-bug-back-reference`** (`ready`), sub-question 2 — see the state-edge note below.
- **`dl-034-lint-gate-in-dev-loop`** (`ready`), point 6 — the exception that does *not* apply here.
- **`dl-014`/T1** via the `testing` directive — the classification rule applied below.

**Which bug edges this task drove, and why.** `bug-022` was `triaged` at task start, **not**
`planned` — `memory.yaml`'s `bug.states.waiting` is `[triaged, planned]`, and `triaged → planned` is
the edge `release-planning`'s `build-backlog` drives when it schedules a bug into a release. v0.2's
release-planning had already run when `dl-056` clause B re-graded `bug-022`, so the scheduling act
happened out of band: it is `cccfa60`, which stamped `release: "v0.2"` and the new severity in one
commit. That is a real scheduling event, so **`dl-045` sub-question 2 governs — "`planned` is
required, with no exception… the commit that assigns the bug and stamps its `release:` **is** the
scheduling act" — and `dl-034` point 6 (which allows skipping `planned`) does **not**, because that
exception is explicitly limited to bugs "scheduled under this authorisation", where no scheduling act
had occurred at all. So `start` drove **two** waiting edges in one sync commit,
`[triaged → planned → in-progress]`, with the out-of-band origin named in the commit body — the shape
`f16d57d` used for `bug-026`/`task-076` two days earlier.

**`agent.verify_specs`.** No new `tech-spec` is needed; the design gate passes through without an
approver.

- `grep -rn "ignore-scripts" docs/self/docs/04_memory/design/specs/ docs/02_requirements/` → no
  output. No approved spec legislates lifecycle scripts in the test suite, which is why the task
  carries `ref: dl-056-first-real-publishing-run` rather than a `REQ-*`.
- `spec-015` (`approved`) covers the published manifest (§1) and the pipeline stages (§3–§5); the
  packed file list this suite asserts is unchanged by this task (measured below), so nothing in
  `spec-015` is touched or contradicted.

**BDD acceptance scenarios: none exist for this task, and that is a fact, not an omission.**
`grep -rln "npm pack\|npm install -g\|distribut" docs/02_requirements/02_bdd/features/` → no output;
`grep -rn "REQ-SYS-09" docs/02_requirements/02_bdd/` → no output. The five pillar directories cover
P1–P5 command surface only. `test/cli/npm-distribution.test.ts` **is** the executable acceptance test
for REQ-SYS-09's fit criterion (its own header says so), so the `review` gate's `tests.bdd.passing`
check reduces here to "that suite, and the full suite, green".

**The race, measured rather than asserted.** `bug-022`'s text names the mechanism; these are the
commands that settle it, all run in this worktree with `dist/` already built exactly as jest's
`globalSetup` builds it (`npx tsc -p tsconfig.build.json`).

1. *The pack really does rewrite `dist/`.* `stat -c '%n %Y %i' dist/cli.js dist/core/index.js`,
   then `npm pack --dry-run --json`, then the same `stat`:

   ```
   before : dist/cli.js 1789981693 9728190 | dist/core/index.js 1789981693 9728133
   after  : dist/cli.js 1789981709 9728190 | dist/core/index.js 1789981709 9728133
   stderr : > wingfoil@0.1.0 build
            > tsc -p tsconfig.build.json
   ```

   mtimes move, inodes do not — `tsc` truncates and rewrites in place, so a concurrent reader is not
   protected by an atomic rename. With `--ignore-scripts` added, the same measurement leaves both
   mtimes at `1789981709` and prints nothing on stderr.

2. *The window is observable.* A probe (`scratchpad/tear-probe.cjs`) records the final size of all 77
   `dist/**/*.js`, starts the pack, and polls every 1 ms for any file that is absent or shorter than
   its final size:

   ```
   mode=noflag packExit=0 filesWatched=77 samples=8907 anomalies=12
     core/index.js: final=70428 observed=0
     validation/secret-scan.js: final=18152 observed=8192
     storage/index.js: final=6579 observed=0   (+9 more)
   mode=noflag packExit=0 filesWatched=77 samples=8489 anomalies=9
   mode=flag   packExit=0 filesWatched=77 samples=1462 anomalies=0
   ```

   `dist/core/index.js` — required by every `node dist/cli.js` spawn — is observed at **0 bytes**
   while the pack runs. That is the failure window, and `--ignore-scripts` closes it (0 anomalies).

3. *An end-to-end jest failure did **not** reproduce here, and I am not claiming one.* Two attempts:
   - 6 × `npx jest --maxWorkers=4` over the six suites that spawn `node dist/cli.js`
     (`npm-distribution`, `program.integration`, `journey-0a.integration`, `entrypoint`,
     `core/query-latency`, `core/latency-budget-placement`) → **189/189 passed, 6/6 runs, 0
     failures**.
   - A tighter probe (`scratchpad/spawn-race.cjs`) keeping 6 concurrent `node dist/cli.js --version`
     processes in flight for the whole pack → **374 spawns over 3 runs, 0 failures**.

   So: the corruption window is demonstrated directly (2), but landing a `require()` inside it on
   this 12-core machine did not happen in ~374 attempts. The honest reading is that the flake is
   low-probability per run and depends on worker scheduling — which is exactly why it is worth
   removing rather than waiting to observe in a tagged release, where `publish.yml`'s `gate` job runs
   `npm run prepublishOnly` → `npm test` (`.github/workflows/publish.yml:105-107`;
   `grep -n maxWorkers jest.config.js package.json` → no output, so the worker count is the runner's
   core count). A first probe using `node dist/cli.js paths` was **discarded as invalid**: it fails
   identically with and without the flag because there is no `.wingfoil/` at the repo root
   (CLAUDE.md §3), so it measured nothing.

**T1 classification (`dl-014` / `testing` directive).**

| AC | Class | Why | Test |
|---|---|---|---|
| 1 — the call carries `--ignore-scripts`, assertions unchanged | **characterization** | the packed manifest is unchanged and already correct; what changes is a side effect on `dist/` that no assertion inside the suite can observe. No red is available without fabricating one. | `test/cli/npm-distribution.test.ts` — `` `npm pack --dry-run --json` includes the compiled dist/ bin + README.md… `` (passes before and after) |
| 2 — the flag does not hollow out the test | **characterization** (measurement, not code) | evidence, recorded below under `green` | same test + the recorded path-set comparison |
| 3 — no `npm pack` under `test/` runs lifecycle scripts any more | **red-first** | the *standing property* is new: nothing checked it, which is how this outlier survived three sibling fixes. A guard that cannot fail before the fix would be worthless, and this one does fail. | `test/lint/pack-ignore-scripts.test.ts` (new) |
| 4 — the reason is written in the suite header | **characterization** (documentation) | prose; asserted by review, not by a runtime check | n/a |
| 5 — honest classification, no fabricated red | **n/a** (process) | this table plus the reproduction report above | n/a |
| 6 — gates green | **characterization** | pre-existing gates | recorded under `refactor` |

AC3 is the only genuine red in this task. It is not scope creep: AC3 asks for a standing property
("**no** `npm pack` under `test/` runs lifecycle scripts **any more**"), and a grep pasted into a
Markdown file cannot hold that property — the next author who copies the three-argument form gets no
signal. The guard lives in `test/lint/`, the repo-hygiene home established by
`test/lint/lint-clean.test.ts` (`dl-034`).

### red — role: developer

`test/lint/pack-ignore-scripts.test.ts` (new). It walks `test/**/*.ts` in sorted order, matches
`execFileSync|spawnSync|execFile|spawn('npm', [ … ])` argument-array literals whose first element is
`'pack'` or `'publish'`, and asserts every one contains `'--ignore-scripts'`. A companion case asserts
the scan found ≥ 5 call sites (≥ 4 of them `pack`) and that `cli/npm-distribution.test.ts` is among
them, so a change of call shape fails the gate instead of quietly making it vacuous.

`npx jest test/lint/pack-ignore-scripts.test.ts` on the pre-fix tree — a real red, naming the
offender:

```
● … › runs every one of them with --ignore-scripts, so none rebuilds the shared dist/
    - Array []
    + Array [
    +   "cli/npm-distribution.test.ts: npm pack — ['pack', '--dry-run', '--json']",
    + ]
Tests: 1 failed, 1 passed, 2 total
```

The AC1/AC2/AC4 characterization ACs contributed no red, by design (T1): the pre-existing
`npm-distribution` assertions pass before and after.

### green — role: developer

Two edits to `test/cli/npm-distribution.test.ts`, both inside the one test file the bug names:

1. `['pack', '--dry-run', '--json']` → `['pack', '--dry-run', '--json', '--ignore-scripts']` (now at
   `:129` after the header grew). The four assertions are byte-identical — `dist/cli.js` and
   `README.md` present, nothing under `docs/self/.wingfoil` or `test/`.
2. The header comment gained a "**Why `npm pack` carries `--ignore-scripts`**" paragraph (AC4),
   naming `bug-022`, `dl-056` clause B, the measured truncation window and the release-gate exposure —
   matching what `publish-metadata.test.ts:29` and `license-file.test.ts:16` already do.

`npx jest test/lint/pack-ignore-scripts.test.ts test/cli/npm-distribution.test.ts` → **2 suites, 7
tests passed**.

**AC2 — the flag does not hollow out the test.** `test/global-setup.cjs` opened and read: it is
`rmSync(dist)` + `execSync('npx tsc -p tsconfig.build.json')`, run once before the worker pool exists.
It therefore produces `dist/cli.js` (confirmed by `ls dist/` after running exactly that command:
`cli.js`, `cli.d.ts`, `cli.js.map` plus the nine module directories); `README.md`, the other asserted
path, is a committed file and needs no build at all. So the suite's assertions have their inputs
without `prepack`. Measured rather than assumed — same working tree, `dist/` present, both forms of
the command, packed path sets compared as sorted arrays:

```
count no-flag: 311  count flag: 311
only in NO-FLAG: []   only in FLAG: []
identical: true
has dist/cli.js: true | has README.md: true
any docs/self/.wingfoil: false | any test/: false
```

The lists are **identical**, so nothing is hollowed out and no alternative guarantee for `dist/` is
needed beyond the `globalSetup` build the suite already relies on.

**AC3 — re-derived after the fix, not copied from the bug text.**

```
$ grep -rn "'pack'" test/
test/core/builtin-directive-templates.test.ts:251:  … ['pack', '--dry-run', '--json', '--ignore-scripts'], {
test/lint/pack-ignore-scripts.test.ts:41:          const LIFECYCLE_SUBCOMMANDS = ['pack', 'publish'];
test/lint/pack-ignore-scripts.test.ts:90:          expect(sites.filter((s) => s.subcommand === 'pack')…
test/cli/publish-metadata.test.ts:86:              … ['pack', '--dry-run', '--json', '--ignore-scripts'], {
test/cli/license-file.test.ts:102:                … ['pack', '--dry-run', '--json', '--ignore-scripts'], {
test/cli/npm-distribution.test.ts:129:             … ['pack', '--dry-run', '--json', '--ignore-scripts'], {
```

Six hits, of which **four** are real `npm pack` call sites (the other two are the new guard's own
literals) — the count of four the Description predicted, re-derived rather than trusted. All four
carry the flag.

**The wider sweep the bug text did not do** — every npm invocation in `test/` and `scripts/`:

```
$ grep -rnE "(execFileSync|spawnSync|execFile|spawn)\('npm'" test/ scripts/
test/core/builtin-directive-templates.test.ts:251  pack     --ignore-scripts  OK
test/cli/publish-metadata.test.ts:86               pack     --ignore-scripts  OK
test/cli/npm-distribution.test.ts:129              pack     --ignore-scripts  OK  (this task)
test/cli/license-file.test.ts:102                  pack     --ignore-scripts  OK
scripts/publish-staging.cjs:187                    pack     (none)            --  outside test/
```

Plus, in `test/`, two matches that a grep for "npm" also surfaces and that run no lifecycle script:
`test/cli/publish-pipeline.test.ts:92` spawns `npm publish --dry-run --offline --ignore-scripts …`
(already compliant, and counted by the guard), and `test/cli/publish-secrets.test.ts:90` *writes* a
fake `npm` shell script into a temp dir rather than calling npm. `test/cli/publish-staging.test.ts`
asserts against injected fakes. `grep -n "npm" scripts/e2e-smoke.cjs scripts/check-release-tag.cjs`
→ no output: neither script invokes npm.

So **`test/` is now clean, and exactly one call site outside it still runs lifecycle scripts**:
`scripts/publish-staging.cjs:187`, `spawnSync('npm', ['pack', '--json', '--pack-destination', …])`.
It is **not** a second instance of `bug-022` — it runs from `npm run publish:staging`, never under
jest, so no concurrent worker is reading `dist/`. It is left untouched deliberately: AC7(c) puts the
publish pipeline out of scope and `task-078-publish-pipeline-hardening` is editing that same script in
parallel. Reported to the orchestrator as an observation rather than fixed here — see the review
summary.

### refactor — role: developer

No restructuring step was needed: the change is one argument, one header paragraph and one
self-contained guard file, and nothing in `src/` moved
(`git diff --name-only main...HEAD | grep '^src/'` → no output). Gate results are in the review
summary below.

### review-ready summary — role: reviewer

**What changed.** One argument, one header paragraph, one new guard suite:

| File | Change |
|---|---|
| `test/cli/npm-distribution.test.ts` | `--ignore-scripts` added to the `npm pack` argv (`:129`); header gains the "why" paragraph (AC4). Assertions untouched. |
| `test/lint/pack-ignore-scripts.test.ts` | **new** — repo-hygiene gate holding AC3's standing property, plus a non-vacuity case. |
| `docs/self/docs/04_memory/v0.2/task-075-…md` | these Execution Notes. |
| `docs/self/docs/04_memory/bugs/bug-022-…md` | `status` only, via `bug.sync_state`. |

No `src/` file, no `package.json`, no `jest.config.js`, no `.github/workflows/publish.yml`, no
`scripts/` file — AC7(a)/(b)/(c) all held: no `--runInBand`, no `maxWorkers`, no workflow edit.

**Sync with `main`** (`dl-035` — merge, never rebase): `git merge main` at `ba2cad0` (task-079 +
the adr-010 cascade) merged cleanly, no conflicts, no overlap with the files above. Re-read after the
merge: `task-079-spec-015-staging-and-node-floor-corrections` is `backlog` and documentation-only on
`spec-015`, so the `verify_specs` sentence in the design section (spec-015 covers the manifest and the
pipeline, and this task touches neither) is still accurate. Gates below were all run **after** the
merge.

**Gates** (run in the worktree at `e92724d`, node v22.21.0 / npm 11.6.2):

| Command | Result |
|---|---|
| `npx jest` | **exit 0** — 101 suites / **1594 tests** passed (was 100 / 1591 on `main`; +1 suite, +3 tests, all mine) |
| `npx jest --coverage` | **exit 0** — All files **98.54 %** stmts / **92.3 %** branch / **98.76 %** funcs / **99.15 %** lines, threshold 80 met |
| `npx tsc -p tsconfig.build.json --noEmit` | **exit 0** |
| `npx tsc --noEmit -p tsconfig.json` | exit 2 — **only** `test/core/directive-create.test.ts(159,19) TS2339`, the pre-existing `bug-026` error owned by `task-076`. Nothing from this branch. |
| `npm run lint` | **exit 0** (`lint.clean`, `dl-034`) |
| `npm run docs:api` | **exit 0** |

Coverage is non-regressing by construction, not by comparison alone: no `src/` file changed and the
new suite imports nothing from `src/`, so the set of production lines executed is identical to
`main`'s.

**BDD.** No BDD feature covers npm packaging — `grep -rln "npm pack\|npm install -g\|distribut"
docs/02_requirements/02_bdd/features/` and `grep -rn "REQ-SYS-09" docs/02_requirements/02_bdd/` both
return nothing. `test/cli/npm-distribution.test.ts` *is* REQ-SYS-09's executable acceptance test, and
it passes.

**Honest weak spot for the approver.** The end-to-end flake was **not** reproduced: 6/6 clean runs of
the six `dist/`-spawning suites at `--maxWorkers=4`, and 374 concurrent `node dist/cli.js --version`
spawns across 3 probe runs, all green. What *is* demonstrated directly is the corruption window the
flake needs — `dist/core/index.js` observed at 0 bytes mid-pack, 12 and 9 such observations in two
runs, 0 with the flag (design section, item 2). So the justification here is "the unsafe window is
real and measured, and it now sits inside the release gate", not "I watched a test fail". A reviewer
who wants a stronger claim would have to run the suite under artificial CPU pressure; I did not, and
I am not asserting a result I did not observe.
