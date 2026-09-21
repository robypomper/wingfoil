---
id: "task-076-fix-vacuous-assertion-type-error"
type: task
title: "Fix bug-026: clear the TS2339 on main so `tsc --noEmit -p tsconfig.json` exits 0 and stops being a standing exception"
status: approved
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "testing", "tooling"]
ref: "P3.1"
bug: ["bug-026-type-error-on-main-untested-by-any-gate"]
depends_on: []
tmpl_version: 260703
---

## Description

Fix **bug-026**: one TypeScript error sits on `main` and no gate reports it. Re-verified for this task
on `main` at `8f2bce8` (`npx tsc --noEmit -p tsconfig.json`, exit **2**):

```
test/core/directive-create.test.ts(159,19): error TS2339:
  Property 'commit' does not exist on type '{ readonly ok: false; readonly error: CoreError; }'.
```

That is the **only** error the command emits — so this one line is the whole distance between exit 2 and
exit 0.

**The defect.** `test/core/directive-create.test.ts:150-159` (read on `main`): after
`const second = await directiveCreateFn()(…)` the guard `if (second.ok) return;` (`:152`) narrows
`second` to the error variant of `CoreResult<T>`
(`src/core/types.ts:30-36` — `commit` is declared **only** on the `ok: true` arm, and optional there).
So `expect(second.commit).toBeUndefined()` at `:159` does not compile and, semantically, asserts
nothing. Nothing is lost by removing it: `expect(head(repo)).toBe(shaBefore)` on the line above already
proves no second commit was produced.

**Why it matters more than a severity-`low` bug usually does.** The error has become a *standing
exception* that every task in this wave has had to be told about and had to repeat in its own notes.
`grep -rn "bug-026" docs/self/docs/04_memory/` finds it quoted as the allowed `tsc` failure in the
Execution Notes of `task-045`, `046`, `047`, `048`, `052`, `055`, `056`, `060`, `061` and `070`, and in
several approve-commit reasons ("full tsc only bug-026"). A gate whose expected output is "exit 2 with
exactly one known error" cannot distinguish a new error from the old one without a human reading the
output. Clearing it restores a binary answer.

**The general gate is deliberately not in this task.** `dl-044-typecheck-gate-for-test-sources` — which
would add a declared `typecheck.clean` check — is still `in-discussion`, and the approver's decision
(2026-09-17) is to fix the instance now and leave the gate to v0.3 release-planning.

## Acceptance Criteria

1. **`npx tsc --noEmit -p tsconfig.json` exits 0 on the branch.** Not "emits only the known error" —
   exit **0**, no output. Record the command and its real exit code
   (`npx tsc --noEmit -p tsconfig.json; echo $?`) in the Execution Notes. This AC is the point of the
   task: after it, the exception every wave-2 agent had to be briefed about no longer exists.
2. **The assertion is either removed or made to assert something real — and the choice is argued.**
   bug-026 offers two options; **only one of them compiles**, which this task's planning verified
   rather than assumed, at `8f2bce8`, by applying each edit and running the full typecheck:
   - *Delete `:159`* → `tsc --noEmit -p tsconfig.json` exit **0**. Works.
   - *Move `:159` verbatim above the `if (second.ok) return;` guard* → **still fails**, now as
     `test/core/directive-create.test.ts(152,19): error TS2339: Property 'commit' does not exist on
     type 'CoreResult<unknown>'` — because `commit` is absent from the error arm, so it is absent from
     the union too. bug-026's second option does not work as written; do not follow it blindly.
   - A working variant of the same intent, also verified to exit **0**:
     `expect('commit' in second).toBe(false);` placed before the guard.
   Pick one, say why, and re-verify it yourself rather than trusting this note.
3. **Whatever is chosen, the test's coverage of BDD Scenario 2 is not weakened.** The case is
   "Error — creating a directive whose name already exists": it must still assert `ok === false`, the
   exact `CONFLICT` message, exit code 1, that the existing file is byte-identical, and that `HEAD` is
   unmoved. If the vacuous line is deleted, state explicitly which surviving assertion carries the
   "no second commit" claim (it is `expect(head(repo)).toBe(shaBefore)` on `:158` today — confirm it is
   still there).
4. **Classified as characterization, not red-first** (`dl-014`/T1). The product behaviour is correct and
   unchanged; the defect is in the test source, and its symptom is a compiler error, not a failing test.
   `npx jest` is green on `main` with the error present — confirm that and say so. Do **not** fabricate
   a red, and do not add a new test whose only purpose is to manufacture one.
5. **No product code changes.** `git diff --stat main...HEAD -- src` prints nothing. If that turns out
   to be impossible, stop and report rather than widening the task.
6. **Gates green:** full Jest suite, coverage >80% and non-regressing, `tsc -p tsconfig.build.json`,
   `npm run docs:api`, `npm run lint` (`lint.clean`, `dl-034`) — and now also AC1's full `tsc`.
7. **Out of scope, deliberately:** the declared typecheck gate. `dl-044-typecheck-gate-for-test-sources`
   is `in-discussion`, `release: ""`, and is left to v0.3 release-planning by approver decision. Do not
   add a `typecheck` npm script, a `checks:` entry in any workflow YAML, or a CI step here — that is
   `dl-044`'s ground and adding it would pre-empt an unratified decision. Note the sequencing honestly
   in the Execution Notes: after this task, `main` is clean but *still ungated*, so the same class of
   error can return; that is exactly what `dl-044` exists to decide.

## Implementation Notes

Source: `bug-026-type-error-on-main-untested-by-any-gate` — **`status: open`, `release: ""`** at the
time this task was written. It has not been triaged or scheduled; the approver's triage commit
(`open → triaged`, then scheduling into `v0.2`) is still outstanding and is the approver's act, not this
task's. Flagged rather than silently assumed.

- **`ref: "P3.1"`** — `directive create`, the feature whose own acceptance test carries the defect
  (`task-050-directive-create` also carries `ref: "P3.1"`). No SARD requirement and no *ratified*
  decision-log mandates this fix: `dl-044`, which would, is `in-discussion`. The authority for doing it
  now is the approver's 2026-09-17 decision to fix the instance and defer the gate — recorded here
  rather than dressed up as a requirement.
- **Traceability of what actually broke:** the error arrived with `task-050-directive-create` and
  survived that task's dev-loop, its independent review and its merge. bug-026 establishes why, and
  corrects `dl-044`'s framing while doing it: `tsconfig.json` sets `isolatedModules: true`, which puts
  ts-jest in transpile-only mode, so `npm test` has **never** semantically type-checked `test/**` —
  before or after `task-065`. That measurement belongs to bug-026 and is not re-litigated here; it is
  the reason AC7 leaves the gate to `dl-044` instead of inventing one.
- **`dl-045` back-reference** recorded before the task starts, so `bug.sync_state` can drive
  `bug-026`'s state from this task — once the approver's triage moves it out of `open`.
- **Do not touch the other tasks' Execution Notes.** Ten merged task documents quote this error as an
  expected result of a gate run at a past commit. Those records are true as of when they were written;
  rewriting them would falsify the history rather than fix anything. If a place where the exception is
  stated as a *standing rule for future work* (rather than a past observation) is found, name it in the
  Execution Notes and let the approver decide — do not edit it here.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### design — role: architect

Branch `task/task-076-fix-vacuous-assertion-type-error`, worktree
`/home/robypomper/Workspaces/.wf2-wt/task-076-fix-vacuous-assertion-type-error`, forked from `main` at
`a7d783a`. Install is a real one: `npm ci --prefer-offline --no-audit --no-fund` → `added 500 packages
in 10s`, exit 0 (`bug-043-npm-ci-fails-on-stale-package-lock` is closed, so the lockfile no longer
rejects `npm ci`; nothing was worked around).

#### `agent.read_related` (`dl-015`, HARD gate)

`depends_on: []` — there is no upstream task whose Execution Notes must be acknowledged, so the gate is
satisfied vacuously. The elements this task's own instructions name were read instead, on `main`:

| Element | State read | What it changes here |
|---|---|---|
| `bug-026-type-error-on-main-untested-by-any-gate` | `triaged`, `release: "v0.2"` | The source bug. Its two suggested fixes are re-verified below rather than trusted; **one of them does not compile**. |
| `dl-044-typecheck-gate-for-test-sources` | `in-discussion`, `release: ""` | The general gate. **Out of scope by AC7** — see the sequencing note below. Its `Actions` list (`typecheck.clean` in `dev-loop.yaml` `refactor.checks.post` + an asserting suite under `test/lint/`) is exactly what this task must NOT do. |
| `dl-045-absorbed-bug-back-reference` | `ready` | Makes `task.bug` a list; it is why `bug: ["bug-026-…"]` is well-formed and why `bug.sync_state` can drive bug-026 from this task. |

#### `agent.verify_specs`

No new `tech-spec` is needed and none was scaffolded. The task changes one assertion in one existing
test; the behaviour under test is `directive create`'s conflict path, whose contract is
`docs/02_requirements/02_bdd/features/p3-directives/P3.1-directive-create.feature` (Scenario 2, read in
full below) and `src/core/types.ts`'s `CoreResult<T>` union (`spec-006 §2`, already approved). Design
gate is therefore **pass-through**: no approver decision is required at `design`.

#### T1 — AC classification (`dl-014` / testing directive)

Every AC is **characterization**. The product behaves correctly and is not changed; the defect lives in
a test source and its symptom is a *compiler* error, not a failing test. AC4 of this task mandates that
reading, and the measurement below confirms it: `npx jest` is green on `main` with the error present.
A red is therefore impossible to produce honestly — and AC7 forbids the one construct that could
manufacture one (a Jest assertion that shells out to `tsc`). No red was fabricated and no dead code was
added.

| AC | Class | Evidence / what settles it |
|---|---|---|
| AC1 `tsc --noEmit -p tsconfig.json` exits 0 | characterization | Not a Jest test by construction (AC7). Settled by the recorded command `npx tsc --noEmit -p tsconfig.json; echo $?` — exit **2** before, exit **0** after. |
| AC2 assertion removed or made real, choice argued | characterization | The three-variant matrix below: each edit applied to a real working tree and typechecked. |
| AC3 BDD Scenario 2 coverage not weakened | characterization | `test/core/directive-create.test.ts` → `AC2: a second create with the same name exits 1 with the exact message and overwrites nothing` — passes before and after, with every Scenario-2 assertion intact. |
| AC4 classified characterization, `npx jest` green on `main` with the error present | characterization | Baseline full-suite run recorded in `### red`. |
| AC5 no product code changes | characterization | `git diff --stat main...HEAD -- src` → empty. |
| AC6 gates green | characterization | Gate table in `### refactor`. |
| AC7 no typecheck gate added | characterization (negative) | `git diff main...HEAD` touches no `package.json`, no workflow YAML, no `.github/`, no `test/lint/`. |

#### The defect, re-read on the branch rather than taken from the bug

`test/core/directive-create.test.ts:150-159` (verbatim, absolute line numbers, at `a7d783a`):

```
150:     const second = await directiveCreateFn()({ root: repo, options: { name: NAME } });
151:     expect(second.ok).toBe(false);
152:     if (second.ok) return;
153:     expect(second.error).toEqual({ code: 'CONFLICT', message: `directive already exists: ${NAME}` });
154:     expect(exitCodeForResult(second)).toBe(1);
155:
156:     // "no file is overwritten" — and no second commit was produced.
157:     expect(readFileSync(filePath, 'utf-8')).toBe(contentBefore);
158:     expect(head(repo)).toBe(shaBefore);
159:     expect(second.commit).toBeUndefined();
```

`src/core/types.ts:30-36` declares `commit` **only** on the `ok: true` arm of `CoreResult<T>` (and
optional there). `:152` narrows `second` to `{ ok: false; error: CoreError }`, so `:159` reads a
property that arm does not have.

**What `:159` was trying to express, and whether it still says it.** The intent is legible from the
comment on `:156`: *no second commit was produced*. `:159` does not express that, and could not: at
runtime the value comes from `coreErr`, which returns `{ ok: false, error }` and never attaches a
`commit` key, so `second.commit` is `undefined` **whatever the implementation under test does**. The
assertion cannot fail — it is unfalsifiable, not merely redundant. The claim it was reaching for is
carried, and carried properly, by `:158` `expect(head(repo)).toBe(shaBefore)`, which reads the fixture
repository's real `HEAD` and *would* fail if a second commit had been made. **`:158` is present and is
left untouched** (AC3) — confirmed by reading the file, not assumed.

#### The three candidate fixes, each applied and typechecked (AC2)

Each variant was written into the real working tree, `npx tsc --noEmit -p tsconfig.json` was run, and
the tree was restored before the next one. Baseline first.

| # | Edit | `npx tsc --noEmit -p tsconfig.json` |
|---|---|---|
| 0 | baseline, unmodified branch | exit **2** — `test/core/directive-create.test.ts(159,19): error TS2339: Property 'commit' does not exist on type '{ readonly ok: false; readonly error: CoreError; }'.` (the **only** error) |
| A | delete `:159` | exit **0**, no output |
| B | move `:159` **verbatim** above the guard (bug-026's second suggestion) | exit **2** — `test/core/directive-create.test.ts(152,19): error TS2339: Property 'commit' does not exist on type 'CoreResult<unknown>'.` / `Property 'commit' does not exist on type '{ readonly ok: false; readonly error: CoreError; }'.` |
| C | `expect('commit' in second).toBe(false);` above the guard | exit **0**, no output |

**Variant B does not compile.** bug-026's Notes say "Delete the vacuous line, or move it before the
narrowing guard"; the second half of that sentence is wrong, and this run reproduces the reason rather
than citing it: above the guard `second` is the full `CoreResult<unknown>` union, and a property
declared on only one arm of a union is not accessible on the union. Moving the line does not widen the
type into something that has `commit` — it widens it into something that has *fewer* accessible
properties. The bug's suggestion is corrected here, in this task's notes, rather than edited into
bug-026 (which is not this branch's to rewrite).

#### Decision: **variant A — delete `:159`**

Argued against C, the only other candidate that compiles:

1. **C asserts a different proposition than the one intended, and a weaker one.** `'commit' in second`
   is a claim about the *shape of the returned object* — really a claim about `coreErr` in
   `src/core/types.ts` — not about whether `directive create` wrote a commit. The intended claim ("no
   second commit") is about git state, and `:158` already makes it against the real repository. Keeping
   C would leave the test asserting the weaker proxy next to the strong original, which invites a
   future reader to mistake the proxy for the check.
2. **C is near-tautological for the same reason `:159` was.** Once `:151` has established
   `second.ok === false`, TypeScript *statically* proves `commit` is absent from that arm — that is
   precisely why `:159` fails to compile. A runtime assertion that the compiler already proves adds no
   defect-detection power; it would only fire if someone hand-built an error result bypassing
   `coreErr`, which is a `src/core/types.ts` concern and belongs in a types test, not in P3.1's
   acceptance suite.
3. **The code-quality directive forbids dead code.** An assertion that cannot fail is dead code that
   reads as coverage. Deleting it makes the test's real coverage visible instead of padded.
4. **Scenario 2 needs neither line.** The BDD contract (read in full below) asks for "no file is
   overwritten" and "exits with code 1 and message …". `:158`'s HEAD check is already *more* than the
   scenario requires; `:159` was more than that again, and empty.

The comment on `:156` is kept as-is: after the deletion it still maps onto exactly the two lines under
it — `:157` for "no file is overwritten", `:158` for "no second commit was produced".

#### BDD Scenario 2, read in full (AC3)

`docs/02_requirements/02_bdd/features/p3-directives/P3.1-directive-create.feature:14-18`:

```
Scenario: Error - creating a directive whose name already exists
  Given a custom directive "no-direct-db-access" already exists
  When I run "wingfoil directive create --name no-direct-db-access"
  Then no file is overwritten
  And the command exits with code 1 and message "directive already exists: no-direct-db-access"
```

Assertions that must survive, and do — all of them are above the deleted line and none is touched:
`expect(second.ok).toBe(false)` (`:151`), the exact `CONFLICT` message (`:153`),
`expect(exitCodeForResult(second)).toBe(1)` (`:154`), byte-identical file (`:157`), unmoved `HEAD`
(`:158`).

#### AC7 — sequencing, stated plainly

After this task `main` is **clean but still ungated**. Nothing in the repository runs
`npx tsc --noEmit -p tsconfig.json`: `tsconfig.json` sets `isolatedModules: true`, which keeps ts-jest
in transpile-only mode, so `npm test` never semantically typechecks `test/**`; `tsconfig.build.json`
excludes `test/`; `npm run lint` is eslint, which does not do type-aware checking of this kind. So the
same class of error can return tomorrow and would again reach `main` unnoticed. **Do not read this
task's green typecheck as protection** — it is a one-time cleanup, not a guard. The guard is
`dl-044-typecheck-gate-for-test-sources`, `in-discussion`, deliberately left to v0.3 release-planning
by the approver's 2026-09-17 decision. No `typecheck` npm script, no `checks:` entry in any workflow
YAML, no CI step and no asserting suite under `test/lint/` is added here.

#### Standing-rule sweep (Implementation Notes' last bullet)

`grep -rn "bug-026" --include="*.md" --include="*.yaml" --include="*.json" --include="*.ts" .` over the
repository (node_modules excluded, and this task's own file excluded since its notes add hits of their
own) returns **36** hits — re-run after the `main` merge at `7bb95d6`, which is the number that counts.
Every one of them is either (a) a
**past observation** inside a merged task's Execution Notes or approve-commit reason — `task-045`,
`046`, `047`, `048`, `051`, `052`, `055`, `056`, `057`, `058`, `060`, `061`, `070`, `073`, `074` — true
as of when it was written and **not edited here**; or (b) a cross-reference from `dl-044`, `bug-044`,
`bug-045`, `bug-049` and this task's own file. **No governing document states the exception as a
standing rule for future work**: no workflow YAML, no plan under `docs/05_plans/`, and no `CLAUDE.md`
sentence names it. The one place it *is* stated as a standing rule for future work is the
orchestrator's per-wave agent brief, which lives outside the repository and is not this branch's to
edit — flagged for the approver rather than changed.

### red — role: developer

**No test was authored and no `test(...)` red commit exists.** Every AC classified characterization at
`design`, so `red`'s `tests.failing(for: red-first ACs)` check is satisfied over an empty set. The two
baseline measurements that stand in for it were taken on the branch at `a7d783a` **before** any edit:

| Command | Result |
|---|---|
| `npx jest --maxWorkers=2` | exit **0** — `Test Suites: 100 passed, 100 total` · `Tests: 1591 passed, 1591 total` · `Time: 200.714 s` |
| `npx tsc --noEmit -p tsconfig.json; echo $?` | exit **2**, one line: `test/core/directive-create.test.ts(159,19): error TS2339: Property 'commit' does not exist on type '{ readonly ok: false; readonly error: CoreError; }'.` |

That pair is AC4's evidence, measured rather than assumed: the suite is **green with the error
present**, which is the whole reason this defect survived `task-050`'s dev-loop, its review and its
merge. A failing Jest test for AC1 could only be produced by adding an assertion that shells out to
`tsc` — which is exactly the gate AC7 reserves for `dl-044`. No red was fabricated; no dead code was
added to force one.

### green — role: developer

Variant **A** applied: `test/core/directive-create.test.ts:159`
`expect(second.commit).toBeUndefined();` deleted. One line removed, nothing else — the full diff of the
change is `-    expect(second.commit).toBeUndefined();`.

```
$ npx tsc --noEmit -p tsconfig.json; echo $?
0
```

**Exit 0, no output** (AC1). The standing exception every wave-2 agent has had to be briefed on — "only
the pre-existing `bug-026` error is allowed" — no longer has an instance to name. The gate is binary
again: any output at all from that command is now a new defect. It is, to be plain about it, *not* a
gate anyone runs automatically (see the AC7 sequencing note at `design`); it is simply readable now.

AC3 re-checked on the edited file rather than on memory: `:158`
`expect(head(repo)).toBe(shaBefore);` is present and untouched, and it is the assertion that carries
the "no second commit was produced" claim. `:151`/`:153`/`:154`/`:157` — `ok === false`, the exact
`CONFLICT` message, exit code 1, byte-identical file — are all present and untouched too.

### refactor — role: developer

Nothing to refactor: the change is a single deletion, so there is no new code to tidy and no structure
to improve. All gates were run in the worktree after the deletion, on `bfdff78`.

| Gate | Command | Result |
|---|---|---|
| tests | `npx jest --maxWorkers=2` (as part of the coverage run) | exit **0** — 100 suites / **1591** tests passed, identical to the pre-edit baseline |
| coverage | `npx jest --coverage --maxWorkers=2` | exit **0** — statements **98.54%** (2235/2268), branches **92.30%** (1103/1195), functions **98.76%** (399/404), lines **99.15%** (2001/2018); threshold 80 met on all four |
| **full types (AC1)** | `npx tsc --noEmit -p tsconfig.json; echo $?` | exit **0**, no output — was exit 2 before |
| build types | `npx tsc -p tsconfig.build.json --noEmit` | exit **0** |
| lint (`lint.clean`, `dl-034`) | `npm run lint` | exit **0** |
| API docs (`docs.api.*`, `dl-013`) | `npm run docs:api` | exit **0** |

**Coverage is non-regressing and, to the digit, unchanged.** The same four numbers are recorded in
`task-074-fix-engines-node-floor`'s notes for `main` (98.54 / 92.30 / 98.76 / 99.15). That is the
expected outcome and a small confirmation of the diagnosis: the deleted line exercised no `src/` code
path, because it could not — it read a property off an object without executing anything.

A note on the coverage run's stderr, so nobody reads it as a break: it contains
`fatal: unable to auto-detect email address` and `fatal: not a git repository` lines. Those come from
fixtures that deliberately exercise `requireGitIdentity`'s failure path (`task-014`, REQ-SEC-01) and
the no-repo path; the run exits 0 with every suite passing.

AC5 and AC7 verified by diff rather than by assertion:

```
$ git diff --stat main...HEAD -- src
                                   # (no output)
$ git diff --name-only main...HEAD
docs/self/docs/04_memory/bugs/bug-026-type-error-on-main-untested-by-any-gate.md
docs/self/docs/04_memory/v0.2/task-076-fix-vacuous-assertion-type-error.md
test/core/directive-create.test.ts
$ git diff main...HEAD -- package.json .github docs/self/.wingfoil/workflows test/lint docs/05_plans | wc -l
0
$ grep -n '"typecheck"' package.json
                                   # (no match — no typecheck script exists, and none was added)
```

No product code (AC5). No `typecheck` npm script, no CI step, no `checks:` entry in any workflow YAML,
no asserting suite under `test/lint/` (AC7) — `dl-044` keeps that ground.

### review-ready summary — role: reviewer

**The change is one deleted line.** `test/core/directive-create.test.ts:159`,
`expect(second.commit).toBeUndefined();`, is gone. Nothing else in `test/`, nothing at all in `src/`.
The branch touches three files: that test, this task document, and `bug-026`'s frontmatter status.

**AC1 is the point and it is met.** `npx tsc --noEmit -p tsconfig.json` exits **0** with no output on
this branch, re-verified after the `main` merge at `7bb95d6`. On `main` the same command exits **2**
with exactly one error. The standing exception — "only the pre-existing bug-026 TS2339 is allowed" —
that every wave-2 agent had to be briefed about in order to read its own typecheck gate no longer has
an instance, so the command is binary again: any output is a new defect.

**Read this next sentence before treating that as progress in the safety sense.** `main` is now clean
but **still ungated** (AC7). No gate anywhere runs `tsc --noEmit -p tsconfig.json`: `tsconfig.json`'s
`isolatedModules: true` keeps ts-jest transpile-only so `npm test` never semantically typechecks
`test/**`; `tsconfig.build.json` excludes `test/`; eslint is not type-aware in this way. The same class
of error can land tomorrow and reach `main` unnoticed, exactly as this one did through `task-050`'s
dev-loop, review and merge. Declaring the gate is `dl-044-typecheck-gate-for-test-sources`
(`in-discussion`, `release: ""`), left to v0.3 by the approver's 2026-09-17 decision; this task adds no
`typecheck` script, no CI step, no `checks:` entry and no asserting suite, and the diff proves it.

**Why deletion rather than repair.** The line was not merely redundant, it was **unfalsifiable**: after
`if (second.ok) return;` the value is `coreErr`'s `{ ok: false, error }`, which never carries a `commit`
key regardless of what `directive create` does, so the assertion could not fail for any implementation.
Its intent — the `:156` comment's "no second commit was produced" — is carried by the line above it,
`expect(head(repo)).toBe(shaBefore)`, which reads the fixture repo's real HEAD and *would* fail. The
one repair that compiles, `expect('commit' in second).toBe(false)` before the guard, asserts the shape
of `coreErr`'s return rather than the absence of a commit, and the compiler proves that statically
already — that is precisely why the original fails to compile. It would be the same dead weight in a
different spelling, and it would sit in P3.1's acceptance suite asserting a `src/core/types.ts`
invariant. Full argument and the three-variant typecheck matrix are under `### design`.

**bug-026's own suggested fix is wrong, and that is now on the record.** Its Notes read "Delete the
vacuous line, or move it before the narrowing guard." Moving it fails — `tsc` reports
`(152,19) TS2339: Property 'commit' does not exist on type 'CoreResult<unknown>'` — because a property
declared on one arm of a union is not accessible on the union. Reproduced here rather than cited.
`bug-026`'s body is **not** edited by this branch (only its `status`); the correction lives in these
notes for the approver to place if it should live in the bug.

**BDD acceptance.** P3.1 Scenario 2, "Error - creating a directive whose name already exists"
(`docs/02_requirements/02_bdd/features/p3-directives/P3.1-directive-create.feature:14-18`), is covered
by `test/core/directive-create.test.ts` →
`AC2: a second create with the same name exits 1 with the exact message and overwrites nothing`.
Run in isolation on the merged branch:
`npx jest test/core/directive-create.test.ts -t "a second create with the same name exits 1 with the exact message and overwrites nothing"` →
**1 passed**, 14 skipped. Whole file: **15 passed / 15**. Every assertion the scenario requires — and
the two that exceed it, the byte-identical file and the unmoved `HEAD` — survives; only the empty one
was removed.

**Gates, re-run after `git merge main` (`7bb95d6`, docs-only: CLAUDE.md, product-brief, dna.yaml,
dl-001):**

| Gate | Result |
|---|---|
| `npx jest --coverage --maxWorkers=2` | exit **0** — 100 suites / **1591** tests |
| coverage | statements **98.54%**, branches **92.30%**, functions **98.76%**, lines **99.15%** — identical to `main`'s recorded figures, threshold 80 met |
| `npx tsc --noEmit -p tsconfig.json` | exit **0** ← AC1 |
| `npx tsc -p tsconfig.build.json --noEmit` | exit **0** |
| `npm run lint` | exit **0** |
| `npm run docs:api` | exit **0** |

Cited elements re-read after the merge: `dl-044` still `in-discussion` / `release: ""` (so AC7's
premise holds), `dl-045` still `ready`, `bug-026`'s body untouched by `main`. The standing-rule sweep
was re-run post-merge and its conclusion is unchanged — no governing document (no workflow YAML, no
plan, no `CLAUDE.md` sentence) states the exception as a rule for future work.

**For the approver.** One thing is not this branch's to settle: the only place the bug-026 exception is
written as a *standing instruction for future work* is the orchestrator's per-wave agent brief, which
lives outside the repository. Now that the error is gone, that sentence is not merely stale but
actively misleading — it tells the next agent to tolerate output from a command that should produce
none. Removing it is an orchestration act, flagged here rather than attempted.

**State left by this branch.** `task-076` `in-progress → in-review`; `bug-026`
`triaged → planned → in-progress` at `start` and `in-progress → in-review` here. The
`triaged → planned` hop is a `waiting` edge that `release-planning` normally drives; v0.2's
release-planning had already run when the bug was filed, the approver scheduled it out of band by
stamping `release: "v0.2"`, and no phase was left to move the status — so the fix task drove it, with
the reasoning in that commit's body. Left there, the bug could never have advanced: `triaged`/`planned`
have no CLI verb and the only reject edge to `closed` starts from `open`.

#### post-merge re-verification — `main` at `ba2cad0`

`main` moved again between the review-ready summary and the submit, so it was merged a second time
(`dl-035` — merge, never rebase) and **every gate was re-run on the merged tree**, not carried over.
The second merge brought exactly one file, a new task document
(`docs/self/docs/04_memory/v0.2/task-079-spec-015-staging-and-node-floor-corrections.md`); no conflict,
and nothing these notes cite.

```
$ npx tsc --noEmit -p tsconfig.json; echo $?
0
```

**That is the headline, and it is the reason to read it twice: this is the first clean full typecheck
in the release.** Every other agent's brief still lists
`test/core/directive-create.test.ts(159,19) TS2339` as an allowed exception; on this branch the command
produces no output at all, so that allowance now describes nothing and any future output is a genuine
new defect.

| Gate | Command | Result at `ba2cad0` merged |
|---|---|---|
| **full types (AC1)** | `npx tsc --noEmit -p tsconfig.json; echo $?` | exit **0**, no output |
| build types | `npx tsc -p tsconfig.build.json --noEmit` | exit **0** |
| tests + coverage | `npx jest --coverage --maxWorkers=2` | exit **0** — 100 suites / **1591** tests; statements **98.54%**, branches **92.30%**, functions **98.76%**, lines **99.15%** (unchanged from `main`, threshold 80 met) |
| lint (`lint.clean`) | `npm run lint` | exit **0** |
| API docs (`docs.api.*`) | `npm run docs:api` | exit **0** |
| BDD P3.1 Scenario 2 | `npx jest test/core/directive-create.test.ts -t "a second create with the same name exits 1 with the exact message and overwrites nothing"` | **1 passed**, 14 skipped |

Cited elements re-read on the merged tree: `dl-044` still `in-discussion` with `release: ""` — so AC7's
premise holds and the gate remains v0.3's to decide; `dl-045` still `ready`; `bug-026`'s body untouched
by `main`. The standing-rule sweep re-run post-merge still returns **36** hits outside this task's own
file, and `grep -rn "bug-026\|directive-create.test" CLAUDE.md docs/05_plans docs/self/.wingfoil
docs/01_vision` returns **no match** — no governing document states the exception as a rule for future
work.

**Unchanged by any of this: `main` becomes clean but stays ungated.** Nothing in the repository runs
`npx tsc --noEmit -p tsconfig.json` — not `npm test` (`isolatedModules: true` keeps ts-jest
transpile-only over `test/**`), not `tsconfig.build.json` (it excludes `test/`), not eslint. This task
adds no `typecheck` script, no CI step, no `checks:` entry and no Jest assertion that shells out to
`tsc`; that is `dl-044`'s ground, deferred to v0.3 by approver decision. A clean run here is a cleared
instance, **not** a guard against the next one.
