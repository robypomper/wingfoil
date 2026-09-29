---
id: "bug-026-type-error-on-main-untested-by-any-gate"
type: bug
title: "A TypeScript error sits on main in test/core/directive-create.test.ts, and no gate reports it"
status: closed
severity: "low"
release-origin: "v0.2"
release: "v0.2"
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`npx tsc --noEmit -p tsconfig.json` fails on `main`:

```
test/core/directive-create.test.ts(159,19): error TS2339:
  Property 'commit' does not exist on type '{ readonly ok: false; readonly error: CoreError; }'
```

It arrived with `task-050-directive-create` and survived that task's dev-loop, its independent review
and its merge, because **no gate in the project runs a semantic type check over `test/**`**.

## Steps to Reproduce

1. On `main` (`a3ddf1e` or later): `npx tsc --noEmit -p tsconfig.json` → exit 2, the error above.
2. `npx jest --maxWorkers=2` → 79 suites / 1071 tests, all green.
3. `npx eslint .` → 0. `npx tsc -p tsconfig.build.json` → 0 (that config `exclude`s `test`).

## Expected Behavior

A type error in a test file is caught before merge.

## Actual Behavior

Every declared gate passes. The error is only visible to a command nothing runs.

## Notes

**The defect itself is trivial and the fix is one line.** At
`test/core/directive-create.test.ts:150-159`, the guard `if (second.ok) return;` narrows `second` to
the error variant, which has no `commit` property — so `expect(second.commit).toBeUndefined()` does
not compile and, semantically, asserts nothing. Nothing is lost behaviourally: the adjacent
`expect(head(repo)).toBe(shaBefore)` on the previous line already proves no second commit was
produced. Delete the vacuous line, or move it before the narrowing guard.

**The reason it reached `main` is the part worth keeping, and it corrects `dl-044`'s framing.**
`tsconfig.json` sets `isolatedModules: true`, which puts ts-jest in **transpile-only** mode. So
`npm test` has **never** semantically type-checked `test/**` — not before `task-065`, not after.
Measured on both sides rather than inferred: a file containing a blatant
`const n: number = "definitely not a number"` passes `npx jest` at `ab19a05` (pre-task-065) **and** at
`a3ddf1e` (post), while `npx tsc --noEmit -p tsconfig.json` reports it in both.

What ts-jest *did* enforce is **emit-level** diagnostics, which transpile-only still reports — which is
why `dl-044`'s probe, a TS1479 module-resolution error, changed behaviour across `task-065` while a
TS2322 does not. So `task-065` narrowed which **emit** errors surface; it did not remove a type-check
gate, because none existed. The gap `dl-044` describes is therefore **wider and older** than that
decision-log states, and this bug is the live instance proving it.

That strengthens `dl-044`'s recommendation rather than weakening it: a declared `typecheck.clean`
check running `npx tsc --noEmit -p tsconfig.json` would have caught this at `task-050`'s `refactor`
step.

- **CORRECTION (task-076, 2026-09-21): the second remedy suggested above does not compile.** Moving the
  assertion above the narrowing guard fails as `test/core/directive-create.test.ts(152,19) TS2339 …
  Property 'commit' does not exist on type 'CoreResult<unknown>'` — `commit` is declared only on the
  `ok: true` arm of `CoreResult` (`src/core/types.ts:30-36`), so it is absent from the union too, and
  widening the type makes *fewer* properties accessible, not more. Reproduced by task-076's author and
  again by its reviewer, each applying all three variants to a real tree. The remedy applied was the
  first one, deletion, and the reviewer proved it removes no coverage: mutating the conflict path to
  produce a real second commit turns the adjacent `expect(head(repo)).toBe(shaBefore)` red, while an
  `'commit' in second` assertion would have stayed green.

## Triage & Execution Notes

Found while verifying the `task-050` / `task-053` merges (v0.2). Severity `low`: no shipped behaviour
is affected, the vacuous assertion is redundant with the line above it, and `tsconfig.build.json` —
the config that governs the published artifact — is clean. It is filed anyway because it is the
evidence for `dl-044`, and because a type error on `main` decays: the next one will be harder to spot
in the noise.

Fix belongs with whatever task implements `dl-044`, or as a one-line correction in any task that next
touches this file.
