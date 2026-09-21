---
id: "task-073-fix-stale-package-lock"
type: task
title: "Fix bug-043: refresh package-lock.json so `npm ci` succeeds in a fresh clone"
status: in-review
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "tooling", "ci", "distribution"]
ref: "REQ-SYS-09"
bug: ["bug-043-npm-ci-fails-on-stale-package-lock"]
depends_on: []
tmpl_version: 260703
---

## Description

Fix **bug-043**: `package-lock.json` is internally inconsistent, so `npm ci` fails outright in a fresh
clone of `main`:

```
npm error `npm ci` can only install packages when your package.json and package-lock.json or
npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
npm error Invalid: lock file's @emnapi/wasi-threads@1.2.2 does not satisfy @emnapi/wasi-threads@1.2.3
```

Re-verified for this task on 2026-09-21 by cloning `main` at `91258a7` into a throwaway directory
outside every worktree and running `npm ci` there: exit **1**, nothing installed. Still reproducible,
unchanged since the report (`package-lock.json`'s last commit remains `63a1a4d`, `task-062`).

What it blocks:

- **Every fresh clone and every new worktree.** The dev-loop convention symlinks `node_modules` from
  the primary checkout, which masks this entirely — until someone clones properly, at which point the
  first setup command fails.
- **Every GitHub Actions job of the publish pipeline** `task-060`/`task-061` built:
  `.github/workflows/publish.yml` runs `npm ci`, and `spec-015-packaging-publishing` specifies the same
  first step ("**build + gate** — `npm ci`, then `prepublishOnly` … + `npm publish --dry-run`"). The
  pipeline `adr-009` and `spec-015` define cannot complete its first step on a runner today, and it has
  never run against a clean runner (`dl-056-first-real-publishing-run`), so nothing has caught it.
- The `dl-023` e2e-smoke / fresh-install gate, which inherits the same first step.

Root cause per bug-043, dev-only and transitive: `@napi-rs/wasm-runtime` declares peer ranges
`@emnapi/core: ^1.7.1` / `@emnapi/runtime: ^1.7.1`, and the lock records **no** `node_modules/@emnapi/core`
and **no** `node_modules/@emnapi/runtime` to satisfy them, so npm resolves them at install time and
collides with the single `@emnapi/wasi-threads@1.2.2` entry the lock does hold. Nothing in the runtime
dependency set is involved, which is why the installed tree keeps working and only a *clean* install
breaks.

## Acceptance Criteria

1. **`npm ci` exits `0` in a throwaway clone.** Clone the fix branch into a directory **outside every
   existing worktree** and run `npm ci` there — a worktree whose `node_modules` is symlinked does not
   exercise the failure and is not acceptable evidence (bug-043 says so explicitly). Record the clone
   command, the `npm`/`node` versions, and the real exit code (`npm ci >/dev/null 2>&1; echo $?`) in the
   Execution Notes.
2. **The refresh is its own commit, touching only `package-lock.json`.** Nothing else rides it: a lock
   refresh is reviewable only when it is the whole diff. `git show --stat <sha>` must list exactly one
   file. (This task's own Memory document and any test it adds are separate commits.)
3. **The lock diff is characterized, not asserted.** Diff the lock and **say what moved**: enumerate
   every package whose `version`/`resolved` changed, old → new, and separate them into (a) entries
   added/changed because of the `@emnapi` drift and (b) anything else. No **direct** dependency's
   resolved version may move beyond what the drift requires. The direct set at the time of writing is
   `@anthropic-ai/sdk ^0.110.0`, `@modelcontextprotocol/sdk ^1.29.0`, `chalk ^4.1.2`, `commander ^15.0.0`,
   `js-yaml ^4.3.0`, `zod ^4.4.3` (dependencies) plus the devDependencies `@eslint/js`, `@types/jest`,
   `@types/js-yaml`, `@types/node`, `eslint`, `jest`, `ts-jest`, `typedoc`, `typescript`,
   `typescript-eslint` — re-derive it from `package.json` at execution time rather than trusting this
   list, and if any of them does move, justify it explicitly or pin it back.
4. **The reported gap is actually closed, or the real outcome is reported instead.** bug-043 predicts the
   refreshed lock gains `node_modules/@emnapi/core` and `node_modules/@emnapi/runtime` entries
   satisfying the `^1.7.1` peers. Check whether npm did that; if it resolved differently, **state what it
   actually did** rather than repeating the prediction. (This project rejects tasks for asserting file
   state without opening the file — put the command that settles it in the note.)
5. **The refreshed tree is still green.** A lock refresh can move dev-tool versions, so re-run the full
   gate set on the refreshed tree: `npm run build`, full Jest suite, coverage >80% and non-regressing,
   `tsc -p tsconfig.build.json`, `npm run docs:api`, `npm run lint`. Run them in the throwaway clone
   from AC1 (a real `npm ci` tree), not only in a symlinked worktree.
6. **No product code changes.** `src/` is untouched; `git diff --stat main...HEAD -- src` prints
   nothing. If that turns out to be impossible, stop and report rather than widening the task.
7. **Out of scope, and deliberately so:** the CI guard bug-043 suggests ("worth pairing with a CI job
   that runs `npm ci` on push, so the next drift is caught by the pipeline instead of by the next person
   to clone"). It edits `.github/workflows/publish.yml`, which `task-060-publish-pipeline` owns, and it
   is a new gate rather than this defect's fix. The suggestion already lives in `bug-043`; if the task
   decides it should be scheduled, file an element for it rather than doing it here.

## Implementation Notes

Source: `bug-043` (`triaged`, severity `medium`, no `feature:` — it is an infrastructure defect),
scheduled into `v0.2` out of band under `dl-034` point 4's exception. `ref: REQ-SYS-09` — distribution
as an installable npm package, the requirement `adr-009` itself cites as its `sard_ref`, and the
contract the broken pipeline serves.

- **The fix shape bug-043 prescribes** (and explicitly tells the reporter *not* to apply):
  `npm install` to rewrite the lock, then `npm ci` in a fresh clone to prove it, as a standalone `chore`
  commit touching only `package-lock.json`.
- **Not introduced by a task branch.** bug-043 swept every branch for commits ahead of `main` touching
  the file and found none; the lock has four commits in its whole history, the most recent being
  `63a1a4d` (`task-062-typedoc-tsdoc-backfill`) on `main`. Registry metadata moved under a lock that was
  already missing two entries. Re-check before assuming a concurrent branch owns the file.
- **Characterization, not red-first** (`dl-014`/T1): the failure is in a build artefact, not in product
  behaviour, and the natural "test" is running `npm ci` in a clean clone. If a repository-level
  assertion is added (e.g. a test that the lock is self-consistent), classify it honestly and do not
  fabricate a red.
- `dl-045` back-reference recorded before the task starts, so `bug.sync_state` can drive `bug-043`.
- Practical note for whoever picks this up: until it lands, a new worktree cannot `npm ci`. The
  established workaround is symlinking `node_modules` from the primary checkout — which is exactly why
  AC1 forbids using such a worktree as evidence.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### design — role: architect

Branch `task/task-073-fix-stale-package-lock`, worktree
`/home/robypomper/Workspaces/.wf2-wt/task-073-fix-stale-package-lock`, created from `main` at `8f2bce8`.
Environment for every command below: `node v22.21.0`, `npm 11.6.2`, Linux — the same pair bug-043
reports, so the reproduction is like-for-like.

**`agent.read_related` (dl-015, HARD gate).** `depends_on: []` — no predecessor task's Execution Notes to
acknowledge. Verified, not assumed:
`grep -n '^depends_on:' docs/self/docs/04_memory/v0.2/task-073-fix-stale-package-lock.md` → `depends_on: []`.
The related elements named in the task/bug (`adr-009`, `spec-015`, `dl-056`, `dl-023`, `bug-022`) were read
directly; their bearing is recorded under *Scope boundaries* below.

**`agent.verify_specs`.** No new `tech-spec` needed. This task changes one build artefact
(`package-lock.json`) to match a contract that is already specified:
`spec-015-packaging-publishing` §2/§3 (the gate is "`npm ci`, then `prepublishOnly` … +
`npm publish --dry-run`") and `REQ-SYS-09` (distribution as an installable npm package). `REQ-SYS-09`
itself states there is **no behavioural BDD feature** for it —
`docs/02_requirements/03_sard/01_architecture.md:101-102`: "distribution requirement with no behavioral BDD
feature; verified directly against the npm-publish acceptance test". So the dev-loop `review` BDD gate has
no scenario to run for this task; the acceptance evidence is the recorded `npm ci` exit code plus the
existing packaging suites (`test/cli/npm-distribution.test.ts`, `test/cli/publish-pipeline.test.ts`),
which run green in the proof tree below.

**T1 acceptance-criterion classification (dl-014 / testing directive).**

| AC | Class | Evidence / test |
|---|---|---|
| AC1 — `npm ci` exits 0 in a throwaway clone | **red-first**, but the red is an *executable reproduction*, not a Jest test (see "Why no Jest test" below) | `npm ci` in a clone of `main` → exit **1** (recorded below); the same command in a clone of this branch → exit **0** |
| AC2 — refresh is its own commit, only `package-lock.json` | characterization | `git show --stat 0f54871` → exactly one file, `3 insertions(+), 3 deletions(-)` |
| AC3 — lock diff characterized; no direct dependency moves | characterization | scripted `packages{}` diff of the before/after lock + a re-derived direct-dependency comparison (both below) |
| AC4 — the predicted gap is closed, or the real outcome reported | characterization | `grep -n '"node_modules/@emnapi' package-lock.json` + `npm ls @emnapi/wasi-threads --all` on the refreshed tree — **the prediction is falsified**; see below |
| AC5 — the refreshed tree is still green | characterization | full gate set re-run **inside the `npm ci` clone of this branch**, not in the warm worktree |
| AC6 — no product code changes | characterization | `git diff --stat main...HEAD -- src` → empty |
| AC7 — CI `npm ci` guard stays out of scope | characterization (nothing built) | filed as a proposed element for the orchestrator instead (below) |

**Why no Jest test is added.** A Jest assertion that "the lock is self-consistent" can only be written by
shelling out to `npm ci` / `npm install --dry-run`, which computes an ideal tree and therefore contacts the
registry — it would be non-deterministic and network-dependent, which the `testing` directive ("tests are
deterministic and isolated; no reliance on external services") and the `determinism` directive both forbid.
The purely offline alternatives were considered and rejected on evidence, not taste: an "every lock entry is
reachable from the root graph" check would fail **both before and after** the fix, because the offending
entry is an orphan in either case (`npm ls @emnapi/wasi-threads --all` reports it `extraneous` on the
*refreshed* tree too). The honest coverage for this defect is a CI job that runs `npm ci` on push — which
AC7 puts out of scope because it edits `.github/workflows/publish.yml`, owned by `task-060`. Filed as a
proposed element rather than built here. Per the testing directive: no fabricated red, no dead code.

**Scope boundaries held.** `package.json` untouched — its `engines.node` floor belongs to `task-074`,
running in parallel; `.github/workflows/publish.yml` untouched — owned by `task-060`; `bug-026` untouched.

### red — the reproduction (executable, not a Jest suite)

Cloned `main` into a throwaway directory **outside every worktree** (the scratchpad), so no symlinked
`node_modules` could mask the failure:

```
$ git clone -q --branch main /home/robypomper/Workspaces/WingFoil2 mainclone && cd mainclone
$ git log --oneline -1
8f2bce8 wf(decision-log): approve dl-063-p1-8-reject-message-and-authority-trace [in-discussion → ready]
$ node -v && npm -v
v22.21.0
11.6.2
$ npm ci
npm error code EUSAGE
npm error `npm ci` can only install packages when your package.json and package-lock.json or
npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
npm error Invalid: lock file's @emnapi/wasi-threads@1.2.2 does not satisfy @emnapi/wasi-threads@1.2.3
$ npm ci >/dev/null 2>&1; echo "REAL_EXIT=$?"
REAL_EXIT=1
```

Reproduced verbatim, at `main`'s current head rather than the `b7e39f9`/`91258a7` heads the bug and the task
description recorded — the defect is head-independent, exactly as bug-043 argued.

### green — the lock refresh (`0f54871`)

Plain `npm install`, no argument, no `package.json` edit, run in the worktree:

```
$ npm install --no-audit --no-fund
added 500 packages in 9s          # exit 0
$ git status --porcelain
 M package-lock.json
```

**The whole diff** (`git show --stat 0f54871` → `package-lock.json | 6 +++---`, 1 file changed):

```
 "node_modules/@emnapi/wasi-threads": {
-  "version": "1.2.2",
-  "resolved": ".../wasi-threads-1.2.2.tgz",
-  "integrity": "sha512-c95qOXkHdydNKhscBTebqEC1CVAZpyqOfVfBzQ1qgzyl3gfeldUjIggDbIZgDKsHLgnsM+igH7TJ/eAasaVuMA==",
+  "version": "1.2.3",
+  "resolved": ".../wasi-threads-1.2.3.tgz",
+  "integrity": "sha512-ELEBe8PsLvvJ6QMr0zLt8ffvOHW/dc1m3CEzNMg7aJUv3bMaoDtw2TXyDAwkYBuroxxuHEwhRTLJSe5sya547g==",
   "dev": true, "license": "MIT", "optional": true,
```

**AC3 — what moved, exhaustively.** Machine-diffed the two lock files' `packages{}` maps entry by entry
(`node lockdiff.cjs <before> <after>`, comparing `version`/`resolved` and flagging any other field change):

```
ADDED (0):
REMOVED (0):
VERSION/RESOLVED CHANGED (1):
  ~ node_modules/@emnapi/wasi-threads: 1.2.2 -> 1.2.3
OTHER FIELD CHANGES (0):
```

(a) **The drifted chain:** that single entry — dev, optional, transitive. (b) **Anything else: nothing.** No
package was added or removed, no other entry's `version`, `resolved` or any other field changed, and
`lockfileVersion` stays `3`.

Direct dependencies re-derived from `package.json` at execution time (not trusted from the task text) and
compared one by one — all 16 identical, `version` and `resolved` both:

```
same @anthropic-ai/sdk 0.110.0 · @eslint/js 10.0.1 · @modelcontextprotocol/sdk 1.29.0 · @types/jest 30.0.0
     @types/js-yaml 4.0.9 · @types/node 18.19.130 · chalk 4.1.2 · commander 15.0.0 · eslint 10.6.0
     jest 30.4.2 · js-yaml 4.3.0 · ts-jest 29.4.11 · typedoc 0.28.20 · typescript 6.0.3
     typescript-eslint 8.62.1 · zod 4.4.3
direct deps checked: 16, moved: 0
```

**AC4 — bug-043's prediction is falsified; here is what npm actually did.** bug-043 expected the refreshed
lock to gain `node_modules/@emnapi/core` and `node_modules/@emnapi/runtime` entries satisfying
`@napi-rs/wasm-runtime`'s `^1.7.1` peers. It did **not**:

```
$ grep -n '"node_modules/@emnapi' package-lock.json      # on the refreshed lock
565:    "node_modules/@emnapi/wasi-threads": {           # ← still the only hoisted @emnapi entry
$ npm ls @emnapi/wasi-threads --all                      # on the tree npm install produced
wingfoil@0.1.0 /home/robypomper/Workspaces/.wf2-wt/task-073-fix-stale-package-lock
└── @emnapi/wasi-threads@1.2.3 extraneous
```

npm left the two unmet optional peers unlocked and simply re-pinned the **orphan** hoisted
`@emnapi/wasi-threads` to the version its install-time peer resolution now computes. Why `1.2.3`, confirmed
against the registry rather than inferred:

```
$ npm view @emnapi/core@latest version dependencies
version = '1.11.3'
dependencies = { tslib: '^2.4.0', '@emnapi/wasi-threads': '1.2.3' }
$ npm view @emnapi/wasi-threads time --json | tail
  "1.2.2": "2026-06-08T03:01:05.029Z",  "1.2.3": "2026-07-25T06:53:39.713Z",  "2.1.0": "2026-09-04T07:44:12.206Z"
```

`@emnapi/core@latest` moved from a release depending on `wasi-threads@1.2.2` to `1.11.3`, which depends on
`1.2.3` (published 2026-07-25, after the lock's last commit `63a1a4d`). Because the peers are resolved from
the registry at install time and not recorded in the lock, the hoisted orphan's pinned version must track
`@emnapi/core@latest`'s dependency — so `npm ci` fails the moment they disagree. **The structural cause is
therefore not fixed by this commit, only its current instance** (see the proposed elements in the review
summary): the next `@emnapi/core` release that bumps `wasi-threads` reintroduces the identical failure.
That is also why no narrower fix exists — the diff is already the minimum (one entry, three lines) — and why
a *durable* fix would have to change `package.json` (e.g. an `overrides` pin), which AC6/the task scope
forbid here.

### refactor — gates, run in a real `npm ci` tree

AC1 + AC5 in one run: cloned **this branch** into a throwaway directory outside every worktree, installed
with `npm ci`, and ran the whole gate set there — so these numbers describe what a fresh CI runner would
see, not a warm worktree.

```
$ git clone -q --branch task/task-073-fix-stale-package-lock /home/robypomper/Workspaces/WingFoil2 fixclone
$ cd fixclone && git log --oneline -1
0f54871 chore(deps): task-073-fix-stale-package-lock — refresh package-lock.json so npm ci is self-consistent
$ npm ci --no-audit --no-fund       # added 500 packages in 12s
$ rm -rf node_modules; npm ci >/dev/null 2>&1; echo "REAL_EXIT=$?"
REAL_EXIT=0
$ git status --porcelain            # (empty) — npm ci leaves the lock untouched
```

| Gate (run in `fixclone`) | Result |
|---|---|
| `npm run build` | exit 0 |
| `npx jest` | exit 0 — **100 suites / 1555 tests passed** |
| `npx jest --coverage` | exit 0 — All files **98.54 %** stmts / 92.3 % branch / 98.76 % funcs / 99.15 % lines (≥ 80 %, and unchanged by definition: `src/` is byte-identical to `main`) |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` | exit 2 — **only** the pre-existing bug-026 error: `test/core/directive-create.test.ts(159,19): error TS2339` |
| `npm run lint` | exit 0 (`lint.clean`) |
| `npm run docs:api` | exit 0 (`docs.api.*`) |

**AC6** — `git diff --stat main...HEAD -- src` prints nothing; the branch's entire diff against `main` is
the lock (3 lines) plus this task file and `bug-043`'s status line.

**Does anything assert on the lock or the installed tree?** Checked, not assumed:
`grep -rn "package-lock\|lockfileVersion\|npm ci\|npm install\|node_modules" test/ src/ .github/ scripts/`
— **no test asserts anything about `package-lock.json` or the installed tree**. The only matches are
`test/cli/publish-pipeline.test.ts:128`, which asserts the *string* `npm ci` appears in the workflow's gate
script in the right order, and `test/cli/publish-staging.test.ts:154,169`, which assert `npm install`
appears in the staging script — both are text assertions about scripts, not about resolution. In
`.github/workflows/publish.yml`, `npm ci` appears in exactly **one** job: `gate` (`:99`, step "Install");
`stage` and `promote` never install dependencies — they consume the tarball artifact `gate` uploads
(`stage` runs `npm run publish:staging`, a script that requires only node builtins and `scripts/e2e-smoke.cjs`).
So the defect blocked the pipeline at its first job, and that first job is the one this fix unblocks.

### review-ready summary — role: reviewer

**What landed:** one three-line change to `package-lock.json` (`0f54871`), re-pinning the hoisted dev +
optional + transitive `@emnapi/wasi-threads` orphan from `1.2.2` to `1.2.3`. Nothing else in the lock moved;
no direct dependency moved; `src/` is untouched. `npm ci` now exits `0` in a fresh clone of this branch
(exit `1` on `main` under the identical command and environment), and the full gate set passes **inside that
`npm ci` tree** — 100 suites / 1555 tests, coverage 98.54 %, `build`/`lint`/`docs:api`/`tsc -p
tsconfig.build.json` all exit 0, and `tsc -p tsconfig.json` reports only the pre-existing bug-026 error.

**AC status:** AC1 ✅ (exit 0, throwaway clone outside every worktree, `npm 11.6.2` / `node v22.21.0`);
AC2 ✅ (`git show --stat 0f54871` → 1 file); AC3 ✅ (full `packages{}` diff enumerated — 1 entry changed,
0 added, 0 removed; all 16 direct deps re-derived from `package.json` and verified unmoved); AC4 ✅ —
answered by **falsifying** bug-043's prediction with the grep + `npm ls` output rather than repeating it;
AC5 ✅ (gates re-run in the `npm ci` clone); AC6 ✅ (`git diff --stat main...HEAD -- src` empty); AC7 ✅
(guard not built; filed as a proposed element for the orchestrator instead).

**Weak spot a reviewer should weigh — the fix is a point-in-time patch, and deliberately so.** The lock is
consistent *today*; it is not structurally protected. `@napi-rs/wasm-runtime`'s optional peers
(`@emnapi/core`/`@emnapi/runtime ^1.7.1`) are still absent from the lock, so npm resolves them from the
registry on every install and the orphan entry's pinned version must equal whatever `@emnapi/core@latest`
depends on. The next `@emnapi/core` release that bumps that dependency reproduces bug-043 verbatim, with no
commit to this repository in between. Hardening it would mean editing `package.json` (an `overrides` pin) or
adding a CI `npm ci` job — both outside this task's scope (AC6, AC7). Proposed as an element, not smuggled
in here.

**Proposed elements** (not created here — parallel worktrees would collide on ids; handed to the
orchestrator in the final report): (1) a `decision-log` on guarding lockfile drift — the CI `npm ci`-on-push
job bug-043 suggests and AC7 defers, plus whether to pin the unlocked `@emnapi` peers via `overrides`;
evidence is the registry timeline above. No second element for bug-022: it already names
`test/cli/npm-distribution.test.ts:117` exactly and is `triaged` — re-checked, still the only `npm pack`
call in the suite without `--ignore-scripts`; untouched here.

**Process deviation, recorded rather than hidden:** the evidence-gathering for `design` (read_related,
verify_specs, T1) was performed before the `green` commit, but written to this file and committed *after*
it (`ea3fbf3` follows `0f54871`). AC2 forces the lock refresh to be the whole diff of its commit, so the
design section could not ride it, and committing a notes-only commit first would have split the log in two
for no benefit. No claim in the `design` section was written after the fact — each is backed by a command
recorded above.
