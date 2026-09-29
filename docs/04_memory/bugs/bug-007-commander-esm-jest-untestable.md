---
id: "bug-007-commander-esm-jest-untestable"
type: bug
title: "commander v15 is ESM-only → CLI wiring untestable under the Jest CommonJS runtime"
status: closed
severity: "medium"
release-origin: "v0.1"
release: "v0.2"
feature: "P5.1"
tmpl_version: 260703
---

## Summary

The CLI entry-point wiring (`src/cli/program.ts`, `src/cli.ts`) cannot be loaded by the project's
CommonJS Jest runtime because `commander` v15 is ESM-only, so it is excluded from automated tests and
coverage and is only ever verified by hand.

## Steps to Reproduce

1. On `main`, with the Jest config (`ts-jest`, CommonJS `module` target).
2. Write a test that statically imports `src/cli/program.ts` (which does a static `import`/`require` of
   `commander`).
3. Run `npx tsc --noEmit` and `jest`.

## Expected Behavior

The CLI entry-point wiring is exercised by automated tests and appears in the coverage report, like the
rest of `src/`.

## Actual Behavior

`tsc` raises `TS1479` on the static `require()` of the ESM-only `commander`, and Jest's runtime has no
ESM interop, so `program.ts`/`cli.ts` are silently dropped from coverage collection rather than shown
at 0%. The wiring was verified only via a throwaway standalone Node scratch script (not kept). See the
Execution Notes of `task-006-dual-interface-shared-core` and `task-007-npm-distribution`.

## Notes

- **Root cause:** `commander@^15` (chosen in `task-001-nodejs-typescript-scaffold`) is ESM-only; the
  project compiles tests to CommonJS.
- **Current mitigation:** `task-006` split the CLI into a Commander-independent registrar (fully
  unit-tested) + a thin dynamic-import `program.ts` (untested). This bug is the *white-box* gap that
  remains.
- **Candidate fixes (v0.2):** migrate Jest to ESM; or pin a CommonJS-compatible `commander`; or keep
  the split and add an out-of-Jest smoke runner for the wiring.
- **Relation to `dl-023`:** the `init`+CLI end-to-end smoke gate (`dl-023`) covers this at the
  *black-box* level (drives the built CLI as a subprocess); `bug-007` is the complementary white-box
  fix so the wiring is unit-testable in-process. Severity `medium`: a structural test-coverage hole at
  the user-facing boundary, not itself a user-visible defect.

## Triage & Execution Notes

- **triage (this retrospective, A1/A3):** surfaced as friction T7b while mining `task-006`/`task-007`
  Execution Notes. Severity `medium`. **Deferred to v0.2** `triage-bugs` → `build-backlog` (per
  `retro-v0.1` + the rel-v0.1 retrospective/config-bootstrap plan). Not fixed in the v0.1 window.
