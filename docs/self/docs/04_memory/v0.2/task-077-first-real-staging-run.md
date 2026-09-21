---
id: "task-077-first-real-staging-run"
type: task
title: "First real staging run: execute `npm run publish:staging` and the gate + stage jobs under `act`, and record every command and its output"
status: in-review
release: "v0.2"
priority: "High"
tags: ["v0.2", "release", "distribution"]
ref: "dl-056-first-real-publishing-run"
bug: []
depends_on: ["task-073-fix-stale-package-lock"]
tmpl_version: 260703
---

## Description

The v0.2 publish pipeline has never executed its real effects. `task-060-publish-pipeline` built
`scripts/publish-staging.cjs` and `.github/workflows/publish.yml` so that the **orchestration** is unit
tested offline with injected fake effects; the effects themselves — installing and spawning Verdaccio,
registering a throwaway user over HTTP, `npm pack`, `npm publish` to the staging registry, a global
install from it, the dl-023 smoke against the installed binary, teardown — are reached only from the
script's own `main()`. Re-verified on `main` at `8f2bce8`: `git tag -l | wc -l` → **0**, so
`publish.yml` (trigger: `push` on `tags: ['v[0-9]+.[0-9]+.[0-9]+']`) has never run on GitHub either.

**`dl-056-first-real-publishing-run` clause A, option 1** (approve commit `3655166`) ratifies the
answer: *before* the v0.2 `release-publishing` phase, a named task runs the staging flow for real on a
developer machine and the `gate` + `stage` jobs under `act`, and records the commands and their output
in its Execution Notes. The approver's reason, recorded in that commit: "the alternative is discovering
a defect while a tag is being published, under the one condition where rollback is public." Option 3
(a pre-release tag) was declined as more new surface than a first run should carry.

**This task publishes nothing and needs no credential.** `publish:staging` publishes only to the
localhost Verdaccio it starts, and "ignores any npm credentials in the calling environment"
(`scripts/publish-staging.cjs` header, verified). Under `act`, `promote`'s publish step is guarded by
`if: ${{ !env.ACT }}` (`publish.yml:147`), so a local run cannot reach npmjs. It **does** need network
access to npmjs — to install `verdaccio@6` and to proxy the package's dependencies — which is stated
here so it is not discovered mid-run.

**The evidence is the deliverable.** This task changes no product code. A run whose output is not
recorded has not happened, and cannot be cited by the `release-publishing` plan.

## Acceptance Criteria

1. **`npm run publish:staging` completes on a developer machine, end to end, and every stage is
   evidenced.** For each of the seven stages the script's header declares — pack (or `--tarball`),
   Verdaccio install + start, throwaway user registration, staging `npm publish`, global install from
   staging, the dl-023 smoke against the installed `wingfoil`, teardown — record in the Execution Notes:
   the command as run, the relevant output, and the real exit code. Not a summary; the transcript
   (trimmed of noise, not of results).
2. **The teardown is verified, not assumed.** After the run: no process is listening on
   `http://localhost:4873/`, and the work directory (`mkdtemp` under the system temp dir, prefix
   `wingfoil-staging-`) is gone. Put the commands that establish both, and their output, in the notes.
   Also run the failure path at least once — interrupt or force a failure after Verdaccio starts — and
   report whether teardown still ran. If it did not, that is a finding: file it as a bug rather than
   fixing it here (`scripts/publish-staging.cjs` is `task-078`'s file this release).
3. **`act -j gate` runs, and its result is reported truthfully.** Follow the recipe in
   `publish.yml:50-62`. Two preconditions the recipe names, both re-checked at planning time and both
   real:
   - The tag event's `ref_name` must equal `v<package.json version>` or `scripts/check-release-tag.cjs`
     correctly refuses. `package.json` is at **`0.1.0`** today, so the header's literal example
     (`v0.2.0`) is not the value to copy — the parenthetical beside it says as much. Record which
     version was used and why.
   - The gate's first check runs `git fetch --no-tags origin main` and
     `git merge-base --is-ancestor "$GITHUB_SHA" origin/main`, so it needs the branch under test
     reachable from `origin/main`. Say how that was satisfied (or that the check was exercised against
     `main` rather than the task branch).
   `act` is **not installed** on the development machine as of `8f2bce8` (`command -v act` → nothing);
   installing it is part of this task and needs network.
4. **`act -j stage` runs, and hands on the gate's tarball.** Use
   `--artifact-server-path` as the recipe specifies, so `upload-artifact`/`download-artifact` actually
   round-trip. Record whether the artifact handoff worked under `act`, which is one of the things this
   run exists to discover.
5. **`promote` is confirmed inert under `act`, not assumed inert.** Run it (or the full
   `act push`) and show from the output that the publish step was skipped by `if: ${{ !env.ACT }}` —
   `publish.yml:146-157`. If anything in `promote` executes beyond `setup-node` and
   `download-artifact`, say exactly what.
6. **Every deviation from what the code and specs promise is written down and filed.** This is the
   task's real output. For each mismatch between the run and `spec-015` §3/§4, `adr-009`,
   `publish.yml`'s header or `publish-staging.cjs`'s header, record what was promised, what happened,
   and file a `bug` or `decision-log` for it. Do **not** fix pipeline defects inside this task: it must
   report on the pipeline as it stands, and `task-078-publish-pipeline-hardening` is editing the same
   two files in this release.
7. **The unblocking is explicit.** End the Execution Notes with a plain statement of whether the v0.2
   `release-publishing` phase is cleared to proceed, and list what it is still waiting on. Known
   candidates at planning time, to be re-checked rather than copied: `bug-023-engines-node-floor-
   contradicts-commander` (`planned`, v0.2, owned by `task-074`) — `publish.yml:45-48` says it "must
   land before a real publish"; `bug-022` (owned by `task-075`) — `dl-056` says its fix "must precede
   the first tag"; and `dl-057`'s items (b) `timeout-minutes` and (d) the annotated-tag question, which
   are **sequenced after this run** and whose inputs this run is supposed to produce (see below).
8. **No product code changes, and no Memory-element status changes.** `git diff --stat main...HEAD`
   lists this task's own document and nothing else, unless AC6 produces new `bug`/`decision-log` files,
   which are their own commits. This task holds no approval authority over the bugs and DLs it cites.
9. **Gates:** this task adds no tests and changes no source, so the dev-loop gate set applies to the
   tree unchanged. Run it anyway and record it, so the notes show the tree was green at the commit the
   run was made from.

## Implementation Notes

Source: `dl-056-first-real-publishing-run`, `status: ready`, clause **A option 1**, approve commit
**`3655166`**. `ref: dl-056-…` follows the `task-059`/`060`/`061` precedent of referencing the
authorising decision-log; the requirement behind the whole chain is **REQ-SYS-09** (distribution as an
installable npm package), which is also `adr-009`'s `sard_ref`.

- **This task BLOCKS the v0.2 `release-publishing` phase** — by construction, per the approve commit.
  When that phase's plan is written under `docs/05_plans/`, it must cite this task as a precondition
  (`dl-056`'s Actions say so). Recorded here so the dependency survives even if the plan is written by
  someone who never read the DL.
- **`depends_on: ["task-073-fix-stale-package-lock"]` is a real edge, not a formality.** The `gate` job
  runs `npm ci` (`publish.yml:98-99`), which fails outright on `main` today (`bug-043`), so `act -j gate`
  cannot get past its Install step until `task-073` lands. It also bites the developer-machine half:
  `realEffects.packTarball` (`scripts/publish-staging.cjs:185-196`) runs `npm pack` **without**
  `--ignore-scripts`, so `prepack` → `npm run build` → `tsc` runs, which needs a real `node_modules`.
  A worktree with a symlinked `node_modules` is the workaround this project uses while `bug-043` is
  open, and it is **not** acceptable evidence for a clean-room run — read `task-073`'s Execution Notes
  (that is what `dl-015`'s `depends_on` is for) before starting, and run from a tree that `npm ci`
  actually produced.
- **`task-075` is a soft ordering, not a `depends_on`.** `act -j gate` runs `npm test`, which includes
  `test/cli/npm-distribution.test.ts` — `bug-022`'s flake. If the gate fails inside that suite, that is
  `bug-022`, not a pipeline defect: re-run after `task-075` lands rather than filing a new element. No
  `depends_on` edge is declared because `task-075`'s Execution Notes do not constrain this task's work
  (`dl-015`), and serialising the two would delay this run for a probabilistic failure.
- **What this run is expected to produce for other elements.** `dl-057` items (b) and (d) are
  deliberately sequenced *after* this task and are **not** in `task-078`:
  - **(b) `timeout-minutes` on every job** — ratified option 1 is "sized from the first real run". The
    per-job wall-clock timings this run records are that sizing input. Record them.
  - **(d) the annotated-tag question** — ratified option 2 *for now* (relax `spec-015` §4 to "a
    `vX.Y.Z` tag"), to be revisited once it is known what `actions/checkout@v4` does with an annotated
    tag on a tag-push checkout. `act` may or may not answer this; if the run can observe it
    (`git cat-file -t "refs/tags/$GITHUB_REF_NAME"` inside the job), record the answer — that is the
    fact (d) is waiting on.
  Both are for v0.3 release-planning to schedule with this run's evidence in hand. Do not implement
  either here.
- **Credential posture (`REQ-SEC-08`, `adr-006`).** No npm token is needed, requested or handled by this
  task. If any step appears to want one, stop and report: that is a finding about the pipeline, not a
  reason to supply a credential. Agents never handle the publish token (`publish.yml`'s approver
  runbook, `:23-24`).
- **Related:** `task-060-publish-pipeline` (built the pipeline), `task-061-publish-secrets` (`done` —
  note `dl-057`'s Context describes it as unmerged, which was true when that DL was written and is no
  longer), `dl-052` (Verdaccio started by the staging script in CI), `dl-023` (the e2e-smoke the staging
  run reuses as `spec-015` §3 stage 3), `spec-015` §3/§5, `adr-009`.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### design — role: architect

Branch `task/task-077-first-real-staging-run`, worktree
`/home/robypomper/Workspaces/.wf2-wt/task-077-first-real-staging-run`, created from `main` at
**`a7d783a`** (`wf(adr): deprecate adr-005-typescript-node-stack`). Dependencies installed with a real
`npm ci`, not a symlinked `node_modules` — which the task's Implementation Notes make a precondition:

```
$ npm ci --prefer-offline --no-audit --no-fund
added 500 packages in 9s
$ echo "EXIT=$?"
EXIT=0
```

Environment: `node v22.21.0`, `npm 11.6.2`, Linux 6.8.0-139-generic (Ubuntu 24.04), `docker 29.1.3`.

**The exact bytes under test.** `task-078-publish-pipeline-hardening` edits the same two files in
parallel, so this run pins what it ran against by blob sha, not by description:

```
$ git rev-parse main:.github/workflows/publish.yml   → 78b9665 (last touched by 659b42e, task-074)
$ git rev-parse main:scripts/publish-staging.cjs     → 10d21ff
$ git rev-parse main:scripts/check-release-tag.cjs   → bf2131f
```

**`agent.read_related` (dl-015, HARD gate) — `depends_on: ["task-073-fix-stale-package-lock"]`.** Read
in full and acknowledged; three of its findings bear directly on this run:

1. *`npm ci` is green again, and that is what unblocks this task.* task-073 refreshed one lock entry
   (`@emnapi/wasi-threads` 1.2.2 → 1.2.3, commit `0f54871`) and measured `npm ci` exit `0` in a
   throwaway clone. My own `npm ci` above reproduces that on `main` at `a7d783a` — so the
   `depends_on` edge is discharged by observation, not by trusting the predecessor's note. This
   matters twice over: the `gate` job's `Install` step is `npm ci` (`publish.yml:98-99`), and
   `realEffects.packTarball` runs `npm pack` **without** `--ignore-scripts`, so `prepack → build →
   tsc` needs a genuine `node_modules`.
2. *The fix is point-in-time, not structural.* task-073's review summary is explicit that the next
   `@emnapi/core` release bumping that dependency reproduces the failure with no commit in between.
   For this run the consequence is narrow but real: **if `act -j gate` fails at `Install` with
   `EUSAGE … does not satisfy`, that is bug-043 recurring, not a pipeline defect.** Recorded so the
   distinction is made from evidence rather than guessed at. (It did not recur — see the gate run.)
3. *task-073 verified that `npm ci` appears in exactly one job.* Its notes record
   `grep -rn ... .github/` showing `npm ci` only in `gate` (`:99`); `stage` and `promote` never
   install. That shapes what a failure in each job can mean and is re-verified below against the file
   I actually ran.

`dl-056` (`ready`, clause A option 1, approve `3655166`), `dl-057` items (b)/(d), `dl-068`, `dl-069`,
`bug-022`, `spec-015` §2/§3/§4/§5, `adr-009` and both script headers were read directly; their bearing
appears at the point each is tested below.

**`agent.verify_specs`.** No new `tech-spec` is needed and none is scaffolded — the design gate passes
through. This task builds nothing; it *executes* artefacts already specified by `spec-015` §3 (the four
pipeline stages) and §4 (the tag scheme), architected by `adr-009`, and traced to **REQ-SYS-09**
(distribution as an installable npm package). REQ-SYS-09 carries **no behavioural BDD feature** —
`docs/02_requirements/03_sard/01_architecture.md:101-102`: "distribution requirement with no behavioral
BDD feature; verified directly against the npm-publish acceptance test" — so the dev-loop `review` BDD
gate has no scenario to name for this task, exactly as task-073 recorded for the same requirement.
Verified rather than copied:

```
$ grep -rn "REQ-SYS-09" docs/02_requirements/03_sard/01_architecture.md
```

**T1 acceptance-criterion classification (dl-014 / testing directive).** Every AC here is
**characterization**, and the reason is structural rather than a judgement call: AC8 forbids product
code changes, so there is no new behaviour for a red to precede. What this task produces is a
*transcript*, not a test. Fabricating a failing Jest test to satisfy the letter of `red` would be
precisely the "no fabricated red, no dead code" the testing directive forbids — and a test that shelled
out to `npm run publish:staging` would contact npmjs, which the `determinism` and `testing` directives
both rule out (task-073 reached the same conclusion for the same reason on the same pipeline).

| AC | Class | How it is settled (the command is the evidence) |
|---|---|---|
| AC1 — staging run end to end, 7 stages evidenced | characterization | `npm run publish:staging`, real, transcript recorded per stage + real exit code |
| AC2 — teardown verified, incl. a forced-failure path | characterization (a deliberately induced failure is an experiment, not a fabricated red) | `ss -ltnp 'sport = :4873'` + `ls /tmp/wingfoil-staging-*` after both a clean and a failed run |
| AC3 — `act -j gate` runs, result reported truthfully | characterization | `act` installed during this task; recipe from `publish.yml:50-62` |
| AC4 — `act -j stage` runs and receives the gate's tarball | characterization | `act` with `--artifact-server-path`, artifact round-trip observed |
| AC5 — `promote` confirmed inert under `act` | characterization | `act ... -j promote` output showing the `if: ${{ !env.ACT }}` skip |
| AC6 — every deviation written down and filed | characterization | each mismatch stated as promised-vs-observed, filed as a proposed element |
| AC7 — unblocking statement for `release-publishing` | characterization | re-checked element statuses, not copied from the task text |
| AC8 — no product code, no Memory status changes | characterization | `git diff --stat main...HEAD` |
| AC9 — the tree was green at the commit the run was made from | characterization | the six dev-loop gates, run in this worktree |

**Scope boundaries held (the task says report, do not repair).** `.github/workflows/publish.yml`,
`scripts/publish-staging.cjs`, `scripts/check-release-tag.cjs`, `package.json` and `src/` are all
`task-078`'s or another task's ground this release and are **not** edited here; every defect this run
surfaced is a proposed element in the review summary instead. `bug-026` untouched. No npm token was
requested, supplied or handled at any point, and nothing was pushed or tagged on `origin`.

### red — nothing to fail, and why that is the honest answer

No test is added and no red is manufactured (see the T1 table's preamble). The executable artefact this
phase would normally produce is instead the **run itself**, recorded below. Two of the runs below are
genuine failures produced on purpose — AC2's failure path — but they are *experiments on existing
behaviour*, not a fabricated red: they were predicted, run, and one of them falsified the script's own
header claim.

### green / refactor — the run

Everything below was executed in the worktree at commit `71ad967` (the design-notes commit), with the
tree byte-identical to `main`'s `src/`, `scripts/` and `.github/`.

#### AC9 — the tree was green at the commit the run was made from

Run first, so the transcript that follows describes a green tree rather than an unknown one.

| Gate | Result |
|---|---|
| `npx jest` | exit **0** — 100 suites / **1591 tests** passed, 78.285 s |
| `npx jest --coverage` | exit **0** — All files **98.54 %** stmts / **92.3 %** branch / **98.76 %** funcs / **99.15 %** lines (≥ 80 %; `src/` is unchanged, so non-regressing by construction) |
| `npx tsc -p tsconfig.build.json --noEmit` | exit **0** |
| `npx tsc --noEmit -p tsconfig.json` | exit **2** — **only** the pre-existing bug-026 error: `test/core/directive-create.test.ts(159,19): error TS2339: Property 'commit' does not exist on type '{ readonly ok: false; readonly error: CoreError; }'` |
| `npm run lint` | exit **0** (`lint.clean`) |
| `npm run docs:api` | exit **0** (`docs.api.*`) |

`git status --porcelain` → empty after all six, and again after every run below: nothing in this task
left an uncommitted artefact in the repository.

#### AC1 — `npm run publish:staging`, for real, end to end

```
$ date -Is; /usr/bin/time -f "WALL=%e s" npm run publish:staging; echo "REAL_EXIT=$?"; date -Is
2026-09-21T11:14:16+02:00
...
WALL=113.01 s
REAL_EXIT=0
2026-09-21T11:16:09+02:00
```

**Exit code 0, wall clock 113 s.** The seven stages the script's header declares, each with the output
that evidences it (trimmed of the per-request `warn --- Password for user "wingfoil-staging" took NNNms
to verify` lines Verdaccio emits — there are ~170 of them, and they are themselves a finding: see F4):

**Stage 1 — pack.** No `--tarball` was passed, so the script packed the repository itself. `npm pack`
runs **without** `--ignore-scripts`, so `prepack → build → tsc` ran first — this is `bug-022` visible in
the developer-machine path, not only in the test suite:

```
> wingfoil@0.1.0 publish:staging
> node scripts/publish-staging.cjs

> wingfoil@0.1.0 prepack
> npm run build

> wingfoil@0.1.0 build
> tsc -p tsconfig.build.json
```

The manifest it produced (`npm notice` block, lines 338-345 of the transcript):

```
npm notice name: wingfoil
npm notice version: 0.1.0
npm notice filename: wingfoil-0.1.0.tgz
npm notice package size: 303.3 kB
npm notice unpacked size: 1.1 MB
npm notice shasum: 73271127091f9df076b94d15fa45cb5556b069f9
npm notice total files: 311
```

**The manifest matches `spec-015` §3 stage 1** ("exactly `dist` + docs per `files`") — checked rather
than eyeballed, by extracting every path from the `Tarball Contents` block and removing `dist/`:

```
$ sed -n '/npm notice Tarball Contents/,/npm notice Tarball Details/p' staging1.log \
    | sed 's/^npm notice //' | awk '{print $2}' | grep -v "^dist/"
LICENSE
README.md
package.json
```

i.e. `dist/**` + `README.md` (the `files` field is `["dist","README.md"]`) + the two npm always adds.
Nothing stray.

**Stage 2 — Verdaccio install + start.**

```
added 315 packages in 11s
warn --- you are using Node.js v22.21.0, Verdaccio recommends Node.js v24 or higher, please consider upgrading your Node.js distribution
warn --- http address - http://localhost:4873/ - verdaccio/6.10.4
[publish:staging] Verdaccio up on http://localhost:4873/
```

`verdaccio@6` resolved to **6.10.4**. The Node warning is F3 below.

**Stage 3 — throwaway user registration.** No stdout of its own (the script registers over HTTP and
writes the token to the work dir). Evidenced negatively-then-positively: the publish in stage 4
succeeded, which the Verdaccio config only allows for `$authenticated`; and the token file was later
observed directly in the leaked work dir (AC2 below): `-rw------- … //localhost:4873/:_authToken=…`,
mode `0600`, inside the work dir — never in the repository and never in `~`, exactly as the header
promises.

**Stage 4 — staging `npm publish`.**

```
npm notice Publishing to http://localhost:4873/ with tag latest and public access
+ wingfoil@0.1.0
```

Published to `http://localhost:4873/` and nowhere else. `publishConfig.registry`
(`https://registry.npmjs.org/`) was overridden by the script's explicit `--registry`, and
`--provenance=false` suppressed `publishConfig.provenance: true` — the two things that keep a staging
run off npmjs, both observed working.

**Stage 5 — clean global install from staging.**

```
added 111 packages in 1m
```

into the work-dir prefix (`npm_config_prefix`), with the work-dir cache — nothing touched the
developer's real global prefix or `~/.npm`.

**Stage 6 — the dl-023 smoke against the installed `wingfoil`.** All 18 assertions passed:

```
[publish:staging]   ok   wingfoil --help — exit 0
[publish:staging]   ok   wingfoil --version = 0.1.0 — match
[publish:staging]   ok   [Scrum] wingfoil init --template Scrum — exit 0
[publish:staging]   ok   [Scrum] wingfoil dna show --format json — exit 0
[publish:staging]   ok   [Scrum] wingfoil dna set project.name WingFoil smoke — exit 0
[publish:staging]   ok   [Scrum] wingfoil memory add --type task --title Smoke task --format json — exit 0
[publish:staging]   ok   [Scrum] wingfoil paths config --list --format json — exit 0
[publish:staging]   ok   [Scrum] wingfoil directives list --format json — exit 0
[publish:staging]   ok   [Scrum] wingfoil workflow list --format json — exit 0
[publish:staging]   ok   [Scrum] working tree clean after every mutation — clean
[publish:staging]   ok   [Kanban] wingfoil init --template Kanban — exit 0
[publish:staging]   ok   [Kanban] wingfoil dna show --format json — exit 0
[publish:staging]   ok   [Kanban] wingfoil dna set project.name WingFoil smoke — exit 0
[publish:staging]   ok   [Kanban] wingfoil memory add --type task --title Smoke task --format json — exit 0
[publish:staging]   ok   [Kanban] wingfoil paths config --list --format json — exit 0
[publish:staging]   ok   [Kanban] wingfoil directives list --format json — exit 0
[publish:staging]   ok   [Kanban] wingfoil workflow list --format json — exit 0
[publish:staging]   ok   [Kanban] working tree clean after every mutation — clean
[publish:staging] staged wingfoil@0.1.0 and smoke passed
```

**This is the first time REQ-SYS-09's fit criterion has actually been met by an installed artefact** —
"`npm install -g wingfoil` makes the `wingfoil` command available on PATH and `wingfoil --help` exits 0"
— rather than asserted against `dist/cli.js` in the repository.

**Stage 7 — teardown.** See AC2.

#### AC2 — teardown, verified rather than assumed (and one path where it does not run)

**After the successful run** (commands and their real output):

```
$ ss -ltn 'sport = :4873'
State Recv-Q Send-Q Local Address:Port Peer Address:Port
                                                            # no LISTEN row
$ curl -sS -m 5 http://localhost:4873/-/ping; echo "EXIT=$?"
curl: (7) Failed to connect to localhost port 4873 after 0 ms: Couldn't connect to server
EXIT=7
$ ls -d /tmp/wingfoil-staging-*; echo "EXIT=$?"
ls: cannot access '/tmp/wingfoil-staging-*': No such file or directory
EXIT=2
```

(`node -p 'require("node:os").tmpdir()'` → `/tmp`, so that glob is the right place to look.)
Clean: registry stopped, work dir gone.

**Failure path (a) — an in-process failure after Verdaccio is up.** Forced without touching the script,
by handing it a tarball that does not exist, which fails at stage 4 — i.e. after `startRegistry` has
already succeeded, which is what AC2 asks for:

```
$ date -Is; npm run publish:staging -- --tarball /nonexistent/no-such-tarball.tgz; echo "REAL_EXIT=$?"; date -Is
2026-09-21T11:16:38+02:00
added 315 packages in 22s
warn --- http address - http://localhost:4873/ - verdaccio/6.10.4
[publish:staging] Verdaccio up on http://localhost:4873/
npm error code ENOENT
npm error path /nonexistent/no-such-tarball.tgz
npm error enoent ENOENT: no such file or directory, open '/nonexistent/no-such-tarball.tgz'
[publish:staging] staging FAILED: npm publish /nonexistent/no-such-tarball.tgz --registry http://localhost:4873/ --provenance=false exited 254
REAL_EXIT=1
2026-09-21T11:17:05+02:00
```

Teardown **did** run:

```
$ curl -sS -m 5 http://localhost:4873/-/ping; echo "EXIT=$?"
curl: (7) Failed to connect to localhost port 4873 after 0 ms: Couldn't connect to server
EXIT=7
$ ls -d /tmp/wingfoil-staging-*; echo "EXIT=$?"
ls: cannot access '/tmp/wingfoil-staging-*': No such file or directory
EXIT=2
```

So the `try/catch/finally` in `runStaging` works as the header claims — **for errors**.

**Failure path (b) — an interrupt. This is where the promise breaks (finding F1).** The header says
teardown runs "on success and on every failure"; `dl-057` item (c) already anticipated a *stalled*
`SIGTERM`, but not this. A plain Ctrl-C — the single most likely way a developer ends a run that is
taking a minute to install 111 packages — is not a failure the `finally` ever sees, because the script
installs no `SIGINT`/`SIGTERM` handler and Node's default disposition terminates the process outright:

```
$ npm run publish:staging -- --tarball .../wingfoil-0.1.0.tgz &      # a valid tarball this time
... [publish:staging] Verdaccio up on http://localhost:4873/          # after 13s
$ curl -sS -m 5 http://localhost:4873/-/ping                          # registry answers
{}
$ pgrep -f "^node scripts/publish-staging.cjs"
2033038
$ kill -INT 2033038                                                   # the Ctrl-C
```

Five seconds later:

```
$ ps -o pid,args -p 2033038 --no-headers; echo "SCRIPT_ALIVE_EXIT=$?"
SCRIPT_ALIVE_EXIT=1                                  # the script is gone
$ curl -sS -m 5 http://localhost:4873/-/ping; echo "EXIT=$?"
{}
EXIT=0                                               # …but Verdaccio is NOT
$ ss -ltn 'sport = :4873'
LISTEN 0  511  127.0.0.1:4873  0.0.0.0:*
$ ls -d /tmp/wingfoil-staging-*; echo "EXIT=$?"
/tmp/wingfoil-staging-WU1PFY
EXIT=0                                               # …and neither is the work dir
$ ps -eo pid,args | grep "[v]erdaccio"
2033741 verdaccio
```

What was left behind, measured:

```
$ du -sh /tmp/wingfoil-staging-WU1PFY
268M    /tmp/wingfoil-staging-WU1PFY
$ ls -l /tmp/wingfoil-staging-WU1PFY/npmrc
-rw------- 1 robypomper robypomper 250 set 21 11:18 /tmp/wingfoil-staging-WU1PFY/npmrc
$ sed 's/=.*/=<REDACTED>/' /tmp/wingfoil-staging-WU1PFY/npmrc
//localhost:4873/:_authToken=<REDACTED>
```

268 MB, an orphaned daemon holding port 4873, and a live registry auth token on disk. (The token is
worthless once the registry dies — but the registry did not die, which is the point.)

**And the leak is self-perpetuating**, because `startRegistry`'s own in-use guard then refuses every
later run — one Ctrl-C bricks staging until a human finds and kills the orphan:

```
$ npm run publish:staging -- --tarball .../wingfoil-0.1.0.tgz; echo "REAL_EXIT=$?"
[publish:staging] staging FAILED: http://localhost:4873/ is already in use — stop that registry first
REAL_EXIT=1
```

Cleaned up by hand afterwards (`kill -TERM 2033741`, `rm -rf /tmp/wingfoil-staging-WU1PFY`), and
re-verified clean:

```
$ curl -sS -m 5 http://localhost:4873/-/ping; echo "EXIT=$?"
curl: (7) Failed to connect to localhost port 4873 after 0 ms: Couldn't connect to server
EXIT=7
$ ls -d /tmp/wingfoil-staging-*; echo "EXIT=$?"
ls: cannot access '/tmp/wingfoil-staging-*': No such file or directory
EXIT=2
```

**Filed, not fixed** (`scripts/publish-staging.cjs` is `task-078`'s file this release): finding **F1**
in the review summary.

#### `act` — installed during this task, as AC3 anticipated

`act` was **not** installed (the task recorded `command -v act` → nothing at `8f2bce8`; still true at
`a7d783a`). Installed into the session scratchpad rather than onto the system, so the developer machine
is not mutated by a task whose job is to observe:

```
$ curl -sSL -o act.tgz https://github.com/nektos/act/releases/download/v0.2.84/act_Linux_x86_64.tar.gz
$ ls -l act.tgz
-rw-rw-r-- 1 robypomper robypomper 7896600 set 21 11:09 act.tgz
$ tar xzf act.tgz && ./act --version
act version 0.2.84
$ docker info --format '{{.ServerVersion}} {{.OperatingSystem}}'
29.1.3 Ubuntu 24.04.5 LTS
$ docker pull catthehacker/ubuntu:act-24.04       # 1.63GB
Status: Downloaded newer image for catthehacker/ubuntu:act-24.04
```

Runner mapping was given in an `actrc` under a scratchpad `XDG_CONFIG_HOME`, so neither `~/.actrc` nor
the repository gained a file:
`-P ubuntu-24.04=catthehacker/ubuntu:act-24.04`.

The event file, per the recipe in `publish.yml:50-62` — **`v0.1.0`, not the header's literal `v0.2.0`**,
because `scripts/check-release-tag.cjs` compares the tag to `package.json` `version` exactly and that is
`0.1.0` today (`node -p 'require("./package.json").version'` → `0.1.0`). The header's parenthetical says
to use the current version; the literal example is stale:

```
$ cat tag-event.json
{"ref": "refs/tags/v0.1.0", "ref_name": "v0.1.0", "ref_type": "tag"}
```

**No tag was created, locally or remotely.** None was needed: the gate reads `$GITHUB_REF_NAME` from the
event file and `check-release-tag.cjs` is a pure string comparison, so no git tag object is involved at
any point. `git tag -l | wc -l` → `0` before and after. Nothing was pushed.

#### AC3 — `act -j gate`: what the remote's state made possible, and when

**The remote changed under this run, and that is itself evidence.** Both states were measured here, not
taken on report.

*State 1 — at 11:09, when this task started: the remote was empty*, exactly as `dl-068` E2 records:

```
$ git remote -v
origin  git@github.com:robypomper/wingfoil.git (fetch)
origin  git@github.com:robypomper/wingfoil.git (push)
$ git ls-remote --heads origin; echo "EXIT=$?"
EXIT=0                      # exit 0, no refs — the repository exists and holds nothing
$ git ls-remote --tags origin; echo "EXIT=$?"
EXIT=0
```

*State 2 — by 11:22, mid-run, the history had been pushed* (`dl-068` Action 3, executed by the approver
while this task was running). Re-verified over both protocols, since the SSH probe is what returned
empty the first time:

```
$ git ls-remote --heads https://github.com/robypomper/wingfoil.git
7bb95d6eb92acfc7a358de07cb5137ca308b210c        refs/heads/main
$ git ls-remote --heads git@github.com:robypomper/wingfoil.git
7bb95d6eb92acfc7a358de07cb5137ca308b210c        refs/heads/main
$ git ls-remote --tags https://github.com/robypomper/wingfoil.git      # still no tags
```

So the first `act -j gate` run of this task is a measurement of the *pre-push* world and the later ones
of the *post-push* world. Both are reported.

**Run 1 — the worktree, unmodified `publish.yml`.** Result: `Job failed`, `exitcode 128`, at the third
step. But **not for the reason the task predicted**, and the difference matters:

```
[publish/gate] ⭐ Run Main Tag commit is on main (dl-024)
[publish/gate]   | fatal: not a git repository: (null)
[publish/gate]   ❌  Failure - Main Tag commit is on main (dl-024) [116.676061ms]
[publish/gate] exitcode '128': failure
```

Cause, established rather than inferred: a git **worktree**'s `.git` is a file, not a directory, and it
names an absolute host path that does not exist inside the container —

```
$ ls -l .git
-rw-rw-r-- 1 robypomper robypomper 93 set 21 11:08 .git
$ cat .git
gitdir: /home/robypomper/Workspaces/WingFoil2/.git/worktrees/task-077-first-real-staging-run
```

— so **`act` cannot exercise any git-dependent step from a worktree at all**. This is a finding in its
own right (**F5**) because the whole Wave-2 process runs tasks in worktrees: anyone following
`publish.yml`'s own `act` recipe from a task worktree gets this confusing `fatal: not a git repository`
instead of the check they meant to test.

**What Run 1 did settle, at the `actions/checkout` step — the answer to `dl-057` item (d):**

```
[publish/gate] ⭐ Run Main actions/checkout@v4
[publish/gate]   🐳  docker cp src=/home/robypomper/Workspaces/.wf2-wt/task-077-first-real-staging-run/. dst=...
[publish/gate]   ✅  Success - Main actions/checkout@v4 [128.419891ms]
```

`act` **does not run `actions/checkout` at all** — it substitutes a `docker cp` of the host working
directory (128 ms; a real checkout of this repository cannot be that fast). Therefore **`act` cannot
answer dl-057 (d)**: there is no tag-push checkout under `act`, so `git cat-file -t
"refs/tags/$GITHUB_REF_NAME"` inside the job would describe `act`'s copy, not `actions/checkout@v4`'s
behaviour. Recorded as a *negative* result, which is the honest one: **(d) still needs a real GitHub
tag-push run**, and this task cannot supply it. dl-057's ratified option 2 (relax `spec-015` §4) should
stand for now on exactly the grounds it was chosen.

**Run 2 — a real clone, unmodified `publish.yml`, HEAD on `origin/main`.** To get past F5 and to satisfy
AC3's second precondition honestly, the gate was re-run from a throwaway **clone** (real `.git`
directory) with `origin` set to the public HTTPS URL, checked out at **`a7d783a`** — the commit this
task's worktree branched from, which *is* on `origin/main`. Per AC3's wording, the ancestor check was
therefore **exercised against a commit on `main`, not against the task branch**:

```
$ git clone -q --branch task/task-077-first-real-staging-run /home/robypomper/Workspaces/WingFoil2 gateclone
$ cd gateclone && git remote set-url origin https://github.com/robypomper/wingfoil.git
$ git checkout -q a7d783a && git rev-parse HEAD
a7d783aac8718c3aca8e05e6199da7958f284703
$ act push --eventpath tag-event.json --artifact-server-path act-artifacts -j gate
```

The two preconditions AC3 names **both passed**:

```
[publish/gate] ⭐ Run Main Tag commit is on main (dl-024)
[publish/gate]   | From https://github.com/robypomper/wingfoil
[publish/gate]   |  * branch            main       -> FETCH_HEAD
[publish/gate]   ✅  Success - Main Tag commit is on main (dl-024) [793.559894ms]
[publish/gate] ⭐ Run Main Tag matches package.json version (spec-015 §4)
[publish/gate]   | tag v0.1.0 matches package.json version 0.1.0
[publish/gate]   ✅  Success - Main Tag matches package.json version (spec-015 §4) [292.090899ms]
```

The unauthenticated `git fetch --no-tags origin main` works against the now-public, now-populated
repository, with no credential in the container — `task-061`'s "works for a public repository, fails
closed" note, confirmed by execution.

**But it would NOT pass for a tag created today**, because `origin/main` is *behind* local `main`. This
is the distinction the check's value turns on, measured:

```
$ git rev-parse origin/main                                   # 7bb95d6
$ git -C /home/robypomper/Workspaces/WingFoil2 rev-parse main # ba2cad0  (local)
$ git merge-base --is-ancestor a7d783a origin/main; echo "EXIT=$?"
EXIT=0            # the commit this run tested — passes
$ git merge-base --is-ancestor ba2cad0 origin/main; echo "EXIT=$?"
EXIT=1            # today's local main — FAILS the gate
$ git rev-list --count origin/main..ba2cad0
4                 # four commits on local main that have never been pushed
```

**So the gate asserts "the tag is on the *pushed* `main`", not "on `main`".** A `vX.Y.Z` tag cut from
today's local `main` and pushed would be rejected by its own gate until those four commits are pushed
too. That is arguably correct behaviour — but it is a release-procedure precondition that no document
states, and `dl-024`/`spec-015` §4 both say "on `main`" without qualification (**F6**).

**Then the gate failed at `Install` — `npm ci` does not work on the pinned CI Node.** This is the single
most consequential result of the whole task:

```
[publish/gate] ⭐ Run Main Install
[publish/gate]   | npm error code EUSAGE
[publish/gate]   | npm error `npm ci` can only install packages when your package.json and package-lock.json
[publish/gate]   |   or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
[publish/gate]   | npm error Missing: @emnapi/core@1.11.3 from lock file
[publish/gate]   | npm error Missing: @emnapi/runtime@1.11.3 from lock file
[publish/gate]   ❌  Failure - Main Install [5.00168344s]
[publish/gate] exitcode '1': failure
```

The same lockfile, the same commit, **passes** `npm ci` on the developer machine:

```
$ npm -v && node -v                      # developer machine
11.6.2
v22.21.0
$ npm ci --dry-run --no-audit --no-fund >/dev/null 2>&1; echo "EXIT=$?"
EXIT=0
```

The difference is the npm version, and the gate's own `NODE_VERSION` pin chooses it. From the same run's
`setup-node` output:

```
[publish/gate]   ❓  ::group::Environment details
[publish/gate]   | node: v22.12.0
[publish/gate]   | npm: 10.9.0
```

**Node 22.12.0 ships npm 10.9.0**, and npm 10.9 requires the unmet optional peers
(`@emnapi/core`, `@emnapi/runtime`) to be present in the lock, where npm 11.6 tolerates their absence.
task-073 closed `bug-043` by measuring `npm ci` exit 0 under npm 11.6.2 — correctly, for the npm it had
— but the lock it produced **is not installable by the npm the pipeline actually uses**. The lock still
contains no hoisted entry for either peer, which is exactly the structural gap task-073's own review
summary flagged as unfixed:

```
$ grep -n '"node_modules/@emnapi' package-lock.json
565:    "node_modules/@emnapi/wasi-threads": {          # still the only hoisted @emnapi entry
```

Filed as **F2**. Incidentally this also **verifies one of `dl-057` item (e)'s explicitly unverified
premises** — "That Node 22.12.0 bundles npm 10.9 … [is] **not verified here** … [it] come[s] from the
Wave 2 brief" (`dl-057:52-53`). It is now verified by measurement: `npm: 10.9.0`. Since npm trusted
publishing needs npm ≥ 11.5.1 (that half remains unverified here), the current pin cannot use it — (e)'s
recommended option 1 ("keep `NPM_TOKEN` for the first publish") is the only one available today.

**Two more gate failures, behind the `npm ci` one.** Because a failed step ends the job, each blocker
had to be stepped past to see the next. Every step past a blocker was done in a **scratchpad copy of
the workflow** — `.github/workflows/publish.yml` in the repository was never edited (`git status
--porcelain` clean throughout; `git diff --stat main...HEAD` lists only this task file). Each probe is
named with exactly what it changed.

*Probe A — `npm ci` → `npm install --no-audit --no-fund`, nothing else* (the one-line diff is recorded
above). `Install` then succeeded in **10.7 s**, which is itself the proof that the lock is *resolvable*
by npm 10.9 and merely not *`ci`-installable* — npm repairs it on the fly and `npm ci` refuses to.
The gate then failed at `prepublishOnly`:

```
[publish/gate]   | Test Suites: 3 failed, 97 passed, 100 total
[publish/gate]   | Tests:       3 failed, 1588 passed, 1591 total
[publish/gate]   ❌  Failure - Main prepublishOnly gate — build, test, lint [1m39.786262053s]
```

Two of the three are one bug, and it is a **UTC-runner** bug — not an `act` artefact:

```
● CORE_MODULES memory.memoryApprove — P1.7 fit criteria › P1.7 sc.1: approves a pending document …
  Expected pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/
  Received string:  "2026-09-21T09:25:53Z"
    at test/core/memory-approve.test.ts:168:57

● P1.2 — Every state change records author and timestamp (BDD scenario 1) › …
  Expected pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/
  Received string:  "2026-09-21T09:26:05Z"
    at test/memory/versioning-audit-trail.test.ts:61:26
```

Root cause isolated by measurement, in both environments, rather than guessed:

```
# developer machine — git 2.43.0
$ git log -1 --format=%aI                       # TZ=Europe/Rome
2026-09-21T13:43:28+02:00
$ TZ=UTC git commit …; git log -1 --format=%aI
2026-09-21T11:43:28+00:00                       # +00:00 — the regex matches

# the runner image — git 2.55.0
$ docker run --rm catthehacker/ubuntu:act-24.04 bash -lc '…'
git version 2.55.0
TZ unset -> 2026-09-21T11:43:39Z
TZ=UTC   -> 2026-09-21T11:43:39Z                # Z — the regex does NOT match
TZ=Rome  -> 2026-09-21T13:43:39+02:00
```

So **git ≥ 2.55 renders a zero UTC offset as `Z`** for `%aI`, and both tests' regexes demand a
`[+-]HH:MM` offset. `Z` is valid ISO-8601/RFC-3339, so the *tests* are wrong, not git — and the trigger
is "runner in UTC", which is the normal state of a CI runner. Confirmed by elimination: re-running the
same probe with `--env TZ=Europe/Rome` and changing nothing else took the failures from 3 to 1:

```
[publish/gate]   | Test Suites: 1 failed, 99 passed, 100 total
[publish/gate]   | Tests:       1 failed, 1590 passed, 1591 total
```

Filed as **F3**. (What remains unverified here: the git version on GitHub's own `ubuntu-24.04` image.
The *condition* is "UTC runner + git that emits `Z`", and only the first half is certain for GitHub.)

*The third failure is independent and reproducible* — same suite, same error, in both container runs,
while the identical suite passes on the developer machine (100/100, recorded under AC9):

```
● filterRelevantMemoryDocuments … › REQ-PERF-05 Fit Criterion — 1,000 Memory documents, K relevant
  ENOTEMPTY: directory not empty, rmdir '/tmp/wf-storage-KaPism/.git'
    at removeTempDir (test/storage/helpers/git-fixture.ts:72:9)
    at Object.<anonymous> (test/core/relevance.test.ts:126:22)
```

A fixture-teardown race in `removeTempDir`'s `rmSync(..., {recursive: true, force: true})` against
whatever still holds files under the fixture's `.git`. Filed as **F4**.

#### AC4 — `act -j stage`, and whether the artifact actually round-trips

*Probe B — probe A plus `npm run prepublishOnly` → `npm run build && npm run lint`* (i.e. the gate
minus the test suite, whose three failures are already reported above as F2/F3/F4), with
`--env TZ=Europe/Rome`, run as a full `act push` so all three jobs execute in order. **All three jobs
succeeded**, which is what made AC4 and AC5 observable at all:

```
$ act push --eventpath tag-event.json --artifact-server-path act-artifacts \
      -W publish-probe2.yml --env TZ=Europe/Rome
2026-09-21T13:47:29+02:00
[publish/gate]    🏁  Job succeeded
[publish/stage]   🏁  Job succeeded
[publish/promote] 🏁  Job succeeded
REAL_EXIT=0
2026-09-21T13:51:15+02:00
```

**The artifact handoff works under `act` — verified by digest, not by the absence of an error.** The
gate uploads and both downstream jobs download *the same bytes*:

```
[publish/gate]    | Finished uploading artifact content to blob storage!
[publish/gate]    | SHA256 digest of uploaded artifact zip is f796c6525d963b5446020ec002f9c07b12afbf49fc9fbf46e04356ebf3978547
[publish/gate]    | Artifact download URL: https://github.com/robypomper/wingfoil/actions/runs/1/artifacts/2249856667
[publish/stage]   | - wingfoil-tarball (ID: 2249856667, Size: 4096, Expected Digest: undefined)
[publish/stage]   | SHA256 digest of downloaded artifact is f796c6525d963b5446020ec002f9c07b12afbf49fc9fbf46e04356ebf3978547
[publish/promote] | SHA256 digest of downloaded artifact is f796c6525d963b5446020ec002f9c07b12afbf49fc9fbf46e04356ebf3978547
$ find act-artifacts -type f
act-artifacts/1/wingfoil-tarball/wingfoil-tarball.zip
```

Identical digest in all three jobs. `task-060`'s "same tarball end to end" design (its note 5) holds
under execution — **the tarball `promote` would publish is byte-identical to the one `stage` smoked.**

One caveat worth recording for whoever reads the artifact-id in a future log: `Expected Digest:
undefined` — `act`'s artifact server does not populate the digest field the action would verify
against, so under `act` the digest is *reported* but not *enforced*. On GitHub it is.

**And the `stage` job passed for real, inside the container** — the same script, the same 18 smoke
assertions as the developer-machine run, against the gate's tarball rather than its own pack:

```
[publish/stage]   | [publish:staging] Verdaccio up on http://localhost:4873/
[publish/stage]   | [publish:staging]   ok   wingfoil --help — exit 0
[publish/stage]   | …                                                   (18 `ok` lines in total)
[publish/stage]   | [publish:staging] staged wingfoil@0.1.0 and smoke passed
[publish/stage]   ✅  Success - Main Stage on ephemeral Verdaccio + dl-023 smoke [1m35.393469967s]
```

`grep -c "publish:staging\]   ok"` → **18**, the same count as the host run. And the container's
Verdaccio bound `localhost:4873` **inside its own network namespace** — the host's port stayed free
throughout, and nothing leaked onto the host afterwards:

```
$ ls -d /tmp/wingfoil-staging-*        # host
ls: cannot access '/tmp/wingfoil-staging-*': No such file or directory
$ ss -ltn 'sport = :4873'              # host — no LISTEN row
```

#### AC5 — `promote` is inert under `act`, shown rather than assumed

`promote` ran to completion. Its **complete** step list, with every `docker`/`git clone` line filtered
out and nothing else removed:

```
[publish/promote] ⭐ Run Set up job
[publish/promote]   ✅  Success - Set up job
[publish/promote] ⭐ Run Main actions/setup-node@v4
[publish/promote]   | node: v22.12.0
[publish/promote]   | npm: 10.9.0
[publish/promote]   ✅  Success - Main actions/setup-node@v4 [2.277876771s]
[publish/promote] ⭐ Run Main actions/download-artifact@v4
[publish/promote]   | Total of 1 artifact(s) downloaded
[publish/promote]   ✅  Success - Main actions/download-artifact@v4 [1.266075005s]
[publish/promote] ⭐ Run Post actions/setup-node@v4
[publish/promote]   ✅  Success - Post actions/setup-node@v4 [629.171111ms]
[publish/promote] ⭐ Run Complete job
[publish/promote]   ✅  Success - Complete job
[publish/promote] 🏁  Job succeeded
```

**The publish step does not appear at all** — `act` evaluated `if: ${{ !env.ACT }}`
(`publish.yml:147`) to false and never created the step. AC5 asks specifically whether anything beyond
`setup-node` and `download-artifact` executed: **nothing did** (only `act`'s own `Set up job`,
`Post actions/setup-node` and `Complete job` wrappers). Checked positively as well as by reading the
list — a search of every `promote` line for anything publish-shaped returns nothing:

```
$ grep -E "publish/promote" act-all3.log | grep -iE "registry.npmjs|npm publish|NPM_TOKEN|provenance|npmrc"
                                        # (no output)
```

No `npm publish` ran, no `.npmrc` was written, no token was read or requested, and no provenance
attestation was attempted, in this or in any other run of this task. **Nothing reached npmjs.**

**But `act` does not exercise the approval gate, and that must not be mistaken for a passing test.**
`promote` carries `environment: npm-publish` (`publish.yml:134`), whose required-reviewer rule is the
whole human control on a release (`adr-006`, `task-061`'s runbook). `act` ignores `environment:`
entirely — the job simply started after `stage`, with no wait and no approval. So the **one mechanism
this pipeline relies on to keep an agent from publishing is the one mechanism `act` cannot test**
(**F7**). It can only be verified on GitHub, by a real tag push, which is outside this task.

#### `dl-057` item (b) — the per-job timings, which is what this run owes that DL

Measured on this developer machine (Docker 29.1.3, warm image and npm caches, other Wave-2 jobs running
concurrently — so these are *not* clean-room numbers, and a GitHub-hosted runner is typically slower and
has cold caches). Per-job wall clock is bracketed by `act`'s own `Set up job` → `🏁` lines; step times
are `act`'s.

| Job | Slowest steps (measured) | Job wall clock | Suggested `timeout-minutes` |
|---|---|---|---|
| `gate` | `prepublishOnly` **2m13s** (full suite, probe A+TZ) or 27s (build+lint only, probe B) · `npm ci`/`npm install` 10–25s · dry-run 3.7s · pack 3.0s · upload-artifact 1.8s · setup-node 2.8s | ≈ **1m20s** with the suite replaced; ≈ **3m** with the real suite | **15** |
| `stage` | staging step **1m35s** (Verdaccio install 22s + publish + global install + 18 smoke assertions) · download-artifact 1.3s · checkout 0.9s · setup-node 2.4s | ≈ **1m45s** | **20** |
| `promote` | setup-node 2.3s · download-artifact 1.3s · (publish step skipped under `act`) | ≈ **5s** of work | **30** — dominated by the human approval wait, not by compute |

Whole `act push`, all three jobs: **13:47:29 → 13:51:15 = 3m46s**. The equivalent host-only staging run
was **113 s** (AC1), so the container adds roughly 20 s of overhead to that stage.

Two sizing cautions for whoever implements (b): `gate`'s figure above **excludes** the three failing
suites' real cost once F2/F3/F4 are fixed (the full suite took 2m13s in the container vs 78 s on the
host — assume CI is ~1.7× slower), and `promote`'s timeout must cover the `npm-publish` approval wait,
which is human latency and unbounded by anything measured here. The table's suggestions are therefore
"generous enough not to flake", not "tight".

#### AC6 — every deviation, as promised-vs-observed

Each row below is a mismatch between what an artefact promises and what executing it did. None was
fixed here (`publish.yml` and `publish-staging.cjs` are `task-078`'s files this release; the test files
belong to their own owners). Every one is handed to the orchestrator as a proposed element in the
review summary, with the evidence already recorded above.

| # | Promised, and where | Observed | Proposed |
|---|---|---|---|
| **F1** | `publish-staging.cjs:19` — teardown runs "on success and on **every** failure"; `dl-057` (c) anticipates only a *stalled* SIGTERM | A `SIGINT` (Ctrl-C) kills the script outright — no handler is installed — orphaning Verdaccio on :4873 and leaving a 268 MB work dir containing a live `_authToken`. The in-use guard then blocks every later run | `bug`, **high** |
| **F2** | `spec-015` §3 stage 1 / `publish.yml:98-99` — the gate begins with `npm ci`; `bug-043` is `closed` and `task-073` `done` | `npm ci` **fails** under npm 10.9.0 (what `NODE_VERSION: '22.12.0'` installs): `Missing: @emnapi/core@1.11.3` / `@emnapi/runtime@1.11.3 from lock file`. Passes under the developer's npm 11.6.2. The release gate cannot get past its Install step | `bug`, **high** — blocks the release |
| **F3** | `spec-015` §2 — `prepublishOnly` "must exit non-zero on any failure", i.e. it must be passable on CI | Two tests assert a `[+-]HH:MM` git timestamp offset; git ≥ 2.55 emits `Z` for a zero offset, so `memory-approve.test.ts:168` and `versioning-audit-trail.test.ts:61` fail on any UTC runner. `Z` is valid ISO-8601 — the assertions are wrong | `bug`, **high** — blocks the release |
| **F4** | same | `test/core/relevance.test.ts:126` fails in the runner container, reproducibly in both runs, with `ENOTEMPTY … rmdir '/tmp/wf-storage-*/.git'` from `removeTempDir`; passes on the host | `bug`, **medium** |
| **F5** | `publish.yml:50-62` — the `act` recipe, offered to any developer | From a **git worktree** every git-dependent step dies with `fatal: not a git repository: (null)`, because a worktree's `.git` is a file naming a host path absent in the container. The recipe gives no warning, and Wave-2 tasks all run in worktrees | `bug`, **low** (doc/recipe defect) |
| **F6** | `spec-015` §4 and `dl-024` — the tag is "created **on `main`**" | The gate asserts the commit is an ancestor of **`origin/main`**, i.e. of the *pushed* main. Measured: `a7d783a` passes, today's local `main` `ba2cad0` **fails** (4 unpushed commits). A correct check, but a release precondition — "push `main` before tagging" — that no document states | `decision-log` |
| **F7** | `adr-006` / `task-061` runbook — the approver's required-reviewer gate on `environment: npm-publish` is the sole human control on a release | `act` ignores `environment:` entirely: `promote` started straight after `stage`, unapproved. The gate is therefore **unverifiable by any local means** — only a real tag push can exercise it | recorded (feeds `dl-068`/`dl-057`); no new element |
| **F8** | — | Two low-severity noise observations, not worth their own elements: Verdaccio 6.10.4 warns `you are using Node.js v22.21.0, Verdaccio recommends Node.js v24 or higher`; and a passing run emits ~170 `Password for user "wingfoil-staging" took NNNms to verify` lines plus a `ConflictError: this package is already present` stack (a benign uplink-cache race) — which makes a real failure harder to find in the log | recorded only |

**Not re-filed, as instructed, and re-checked rather than assumed:** `bug-022` (`triaged`) — the gate's
`prepublishOnly` failures were **not** in `test/cli/npm-distribution.test.ts`, so none of F2/F3/F4 is
bug-022; but bug-022 *was* observed in the developer path, where `npm run publish:staging` ran
`prepack → build` during its pack (AC1 stage 1). `bug-046`, `bug-048` (its `EBADENGINE` warnings appear
verbatim in the gate log) and `dl-069` are filed and untouched. `dl-068`'s **Action 3 is now done** —
the history was pushed mid-run — which that DL should record; not filed as new.

#### AC7 — is the v0.2 `release-publishing` phase cleared to proceed?

**No. This run does not clear it, and that is the useful answer.** `dl-056` clause A option 1 exists so
that a defect is found here rather than "while a tag is being published, under the one condition where
rollback is public" (the approver's reason, `3655166`). Three blockers were found, two of them fatal to
the pipeline's very first job, and none of them would have been visible without executing it.

**What this run does clear** — each of these was unknown or unverified before and is now evidenced:

- The **developer-machine staging flow works end to end**: `npm run publish:staging` → exit 0 in 113 s,
  all seven stages, 18/18 dl-023 smoke assertions against a genuinely `npm install -g`-installed
  binary. `REQ-SYS-09`'s fit criterion is met by a real artefact for the first time.
- The **packaged manifest is exactly what `spec-015` §3 stage 1 specifies** (`dist/**` + `README.md` +
  `LICENSE` + `package.json`, 311 files, 303.3 kB).
- **`gate` → `stage` → `promote` orchestration is sound**: the artifact round-trips by identical
  SHA-256 into both downstream jobs, and the `stage` job passes inside a real runner container.
- **`promote` is inert under `act`**, by the `if: ${{ !env.ACT }}` guard, shown step-by-step.
- **Nothing in the pipeline asks for a credential** before the promote publish step; no token was
  needed, requested or handled anywhere in this task (`REQ-SEC-08`, `adr-006` — clean).
- The gate's **tag-on-main and tag-matches-version checks both pass** now that `origin` has a `main`.

**What `release-publishing` is still waiting on**, re-checked at this commit rather than copied from the
task text:

| Blocker | Status now | Why it blocks |
|---|---|---|
| **F2** — `npm ci` fails on npm 10.9 | proposed `bug`, unfiled | `gate` dies at step 5 of 9. **Nothing can be published until this is fixed.** Note `bug-043` is `closed` and `task-073` `done`: the fix was correct for npm 11.6 and does not cover the npm the pipeline pins |
| **F3** — UTC timestamp assertions | proposed `bug`, unfiled | `prepublishOnly` fails on a UTC runner, i.e. on GitHub |
| **F4** — `relevance.test.ts` container teardown | proposed `bug`, unfiled | same gate step; reproducible in the runner image |
| `bug-022` | `triaged`; `task-075` `backlog` | `dl-056` says its fix "must precede the first tag"; unchanged by this run |
| `dl-068` Action 3 — push `main` | **done** (remote at `7bb95d6`) | no longer a blocker, but see **F6**: `origin/main` is 4 commits *behind* local `main`, so `main` must be pushed again immediately before tagging |
| `dl-068` Actions 1/2/4/5 | `dl-068` `in-discussion` | approver-owned: amend `adr-009`/`spec-015`, verify the three vendor-policy premises, confirm the environment's branch policy |
| `dl-057` (b) | `ready`, unscheduled | **input now supplied** by this run — the timings table above |
| `dl-057` (d) | `ready`, unscheduled | **input NOT supplied, and cannot be by `act`** — `act` substitutes a `docker cp` for `actions/checkout`, so there is no tag-push checkout to observe. Option 2 (relax `spec-015` §4) should stand |
| `dl-057` (e) | `ready`, unscheduled | **half-resolved**: Node 22.12.0 ships npm **10.9.0**, measured. Trusted publishing's npm ≥ 11.5.1 requirement remains unverified here, but the pin cannot meet it |
| **F7** — the approval gate is untestable locally | recorded | the first real tag push is also the first test of the only human control on publishing. The approver should expect that |

`bug-023` (`closed`, `task-074` `done`) is no longer a blocker: `publish.yml`'s "must land before a real
publish" note is satisfied, and the gate ran with `engines.node >= 22.12.0` in place.

### review-ready summary — role: reviewer

**Sync with `main` (dl-035 — merge, never rebase).** `git merge main --no-edit` → `8f7facb`, clean. The
merge brought `CLAUDE.md`, `docs/01_vision/01_product-brief.md`, `docs/self/.wingfoil/dna.yaml`,
`dl-001` and the new `task-079`. Checked, not assumed, that it invalidates nothing recorded above:

```
$ git diff --name-only HEAD^1 HEAD -- src test scripts .github package.json package-lock.json
                                                        # (empty)
$ git rev-parse HEAD:.github/workflows/publish.yml HEAD:scripts/publish-staging.cjs
78b96651128708c6ca9bd3be748a40e58d4871b2                # unchanged — the bytes this run tested
10d21ff09f530ad78a95d2937aa34ed2e371cc21                # unchanged
```

`dna.yaml` did move, and several suites load it, so **the full gate set was re-run after the merge**:

| Gate (post-merge, at `8f7facb`) | Result |
|---|---|
| `npx jest` | exit **0** — 100 suites / 1591 tests |
| `npx jest --coverage` | exit **0** — All files **98.54 %** / 92.3 % / 98.76 % / 99.15 % (identical to pre-merge; `src/` untouched) |
| `npx tsc -p tsconfig.build.json --noEmit` | exit **0** |
| `npx tsc --noEmit -p tsconfig.json` | exit **2** — only the permitted bug-026 error |
| `npm run lint` | exit **0** |
| `npm run docs:api` | exit **0** |
| `git status --porcelain` | empty |

`task-079` (new, `backlog`) is adjacent but not in conflict: it amends `spec-015` §3 stage 2 to the
Verdaccio the script actually starts (`dl-052`) — which this run confirms is `verdaccio@6` → **6.10.4**
installed into a throwaway prefix, not "the official image as a CI service" — and §1's Node caveat.
Neither amendment is made here.

**What was run, in one place.** Everything in this task is a real execution; nothing is simulated.

| # | Command | Exit | Outcome |
|---|---|---|---|
| 1 | `npm run publish:staging` (host) | **0** | 7/7 stages, 18/18 smoke, 113 s |
| 2 | teardown probes after 1 | — | registry down, work dir gone |
| 3 | `npm run publish:staging -- --tarball /nonexistent/…` | **1** | failure after registry start → **teardown ran** |
| 4 | `kill -INT` mid-run | — | **teardown did NOT run** → F1 |
| 5 | `npm run publish:staging` again, with the orphan alive | **1** | "already in use" → the leak is self-perpetuating |
| 6 | `act -j gate` (worktree, workflow verbatim) | **1** | `fatal: not a git repository` → F5 |
| 7 | `act -j gate` (clone at `a7d783a`, workflow verbatim) | **1** | tag + ancestor checks **pass**; `npm ci` fails → **F2** |
| 8 | `act push` (probe A: `npm ci`→`npm install`) | **1** | 3 suites fail → **F3** (×2), **F4** |
| 9 | `act push` (probe A + `TZ=Europe/Rome`) | **1** | 1 suite fails → isolates F3 from F4 |
| 10 | `act push` (probe B: also gate-minus-tests) | **0** | **all three jobs succeed** → AC4, AC5 |
| 11 | the six dev-loop gates, twice (pre- and post-merge) | — | green both times |

**AC status.** AC1 ✅ · AC2 ✅ (both paths run; the interrupt path *fails*, which is the finding) ·
AC3 ✅ (`act` installed and run; the honest result is that the gate cannot pass) · AC4 ✅ (handoff
works, verified by SHA-256) · AC5 ✅ (promote inert, shown by its complete step list) · AC6 ✅ (8
deviations, 6 proposed as elements) · AC7 ✅ (**not cleared**, with the list) · AC8 ✅
(`git diff --stat main...HEAD` → this file only, 1 file changed) · AC9 ✅ (twice).

**The headline, stated plainly so it cannot be missed:** *the v0.2 publish pipeline cannot complete a
release today.* Its first job dies at `npm ci` under the npm its own `NODE_VERSION` pin installs (F2),
and if that were fixed it would die at `prepublishOnly` on any UTC runner (F3) and in the runner
container (F4). None of these is visible from a developer machine, from the unit tests, or from
reading the workflow — only from running it. That is precisely the outcome `dl-056` clause A option 1
was chosen to buy, and it was bought before a tag existed rather than during a public release.

**Honest limits of this run — what a reviewer should not read into it.**

1. **Three of the four `act` runs used a modified copy of the workflow.** The repository file was never
   touched; each probe's one-line diff is recorded verbatim, and every *failure* above (F2/F3/F4) came
   from a run of the **unmodified** workflow or from a probe that changed nothing bearing on that
   failure. But run 10 — the only one where all three jobs succeed — is **not** the gate as written: it
   ran `npm install` instead of `npm ci` and `build && lint` instead of the test suite. It proves the
   *plumbing*, not the gate.
2. **`act` is not GitHub.** It substitutes `docker cp` for `actions/checkout`, ignores `environment:`
   (so the approval gate is untested — F7), and does not enforce the artifact digest. Anything this run
   says about those three is a statement about `act`.
3. **F3's CI relevance rests on one unverified fact**: git's version on GitHub's own `ubuntu-24.04`
   image. The failing condition is "UTC runner + git ≥ 2.55"; GitHub runners are UTC, and the image
   here ships 2.55.0. If GitHub's image ships an older git, F3 does not fire there — worth one command
   on the first real run.
4. **The timings are not clean-room.** Warm caches, and other Wave-2 jobs competing for CPU throughout.
   Use them as lower bounds.
5. **Nothing was published, pushed or tagged.** `git tag -l | wc -l` → 0 before and after; no `git
   push` was run; the only network writes were to `http://localhost:4873/` inside a throwaway
   Verdaccio (and, in run 10, inside a container's own namespace). No npm token was requested,
   supplied, read or written at any point.

**Proposed elements** (not created here — parallel worktrees would collide on ids; handed to the
orchestrator): **F1** bug/high (SIGINT leaks Verdaccio + work dir + token, and bricks later runs);
**F2** bug/high (`npm ci` fails under the pinned Node's npm 10.9 — release blocker); **F3** bug/high
(two tests assert a `[+-]HH:MM` git offset; git ≥ 2.55 emits `Z` on a UTC runner); **F4** bug/medium
(`relevance.test.ts` fixture-teardown `ENOTEMPTY` in the runner container); **F5** bug/low (the `act`
recipe in `publish.yml`'s header cannot work from a git worktree and does not say so); **F6**
decision-log (the gate asserts "on `origin/main`", i.e. push `main` before tagging — a release
precondition no document states). **F7** and **F8** are recorded in the notes only, by design.
Already filed, re-checked, and deliberately **not** re-filed: `bug-022`, `bug-046`, `bug-048`,
`dl-069`, `dl-068` (whose Action 3 is now done), and the GitHub push-protection allowlisting of the
`secret-scan.test.ts` fixtures, which the orchestrator reports is being filed separately.
