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
