---
id: "task-077-first-real-staging-run"
type: task
title: "First real staging run: execute `npm run publish:staging` and the gate + stage jobs under `act`, and record every command and its output"
status: in-progress
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
