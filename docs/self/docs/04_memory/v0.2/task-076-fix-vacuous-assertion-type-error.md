---
id: "task-076-fix-vacuous-assertion-type-error"
type: task
title: "Fix bug-026: clear the TS2339 on main so `tsc --noEmit -p tsconfig.json` exits 0 and stops being a standing exception"
status: in-progress
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
repository (run on `main`, node_modules excluded) returns 40 hits. Every one of them is either (a) a
**past observation** inside a merged task's Execution Notes or approve-commit reason — `task-045`,
`046`, `047`, `048`, `051`, `052`, `055`, `056`, `057`, `058`, `060`, `061`, `070`, `073`, `074` — true
as of when it was written and **not edited here**; or (b) a cross-reference from `dl-044`, `bug-044`,
`bug-045`, `bug-049` and this task's own file. **No governing document states the exception as a
standing rule for future work**: no workflow YAML, no plan under `docs/05_plans/`, and no `CLAUDE.md`
sentence names it. The one place it *is* stated as a standing rule for future work is the
orchestrator's per-wave agent brief, which lives outside the repository and is not this branch's to
edit — flagged for the approver rather than changed.
