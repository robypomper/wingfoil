---
id: "bug-018-init-storage-bypasses-integrity-guard"
type: bug
title: "initWingfoilStorage is the one write path that calls initStorage without the built-in integrity guard"
status: closed
severity: "low"
release-origin: "v0.2"
release: "v0.2"
feature: "P5.1.1"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`task-044` made `initWingfoilProject` derive its integrity-checked set from the very `ScaffoldFile[]`
it is about to write, so "installed but unchecked" is unrepresentable there. `initWingfoilStorage` —
the other write path — calls `initStorage` **without** that guard.

## Steps to Reproduce

Not reproducible as a failure today. `initWingfoilStorage` writes `scaffoldFiles()`
(`src/storage/layout.ts`), which contains no `built-in/` directory at all, so there is nothing for the
guard to check and nothing can escape it.

## Expected Behavior

Both write paths run the same check, so the guarantee is structural rather than contingent on what a
particular scaffold happens to contain.

## Actual Behavior

Only `initWingfoilProject` computes `templateScaffold(...)` and runs guard 5 before writing. The
P1.1-level skeleton path writes directly.

## Notes

Raised by `task-044`'s second-pass reviewer, who judged it correctly out of that task's scope —
REQ-SEC-10 traces to P5.1.1 `init` plus P3.8/P4.17, i.e. `initWingfoilProject`, so the narrower
wiring is defensible as delivered.

The reason to record it anyway: it is the **last structural asymmetry** in a guarantee that `task-044`
otherwise made total. The whole point of choosing derivation over a coupling test was that a coupling
test "asserts an omission has not happened yet", while derivation makes the bad state
unrepresentable — and that reasoning applies equally here. If a future task ever places a built-in
asset into the minimal skeleton, it reproduces exactly the shape `task-044` was rejected for, and no
test would catch it.

Cheap to close: `builtinTemplateSources` is generic over `ScaffoldFile[]`, so running the same
derivation plus guard over `scaffoldFiles()` in `initWingfoilStorage` is roughly a one-line change
plus a test. Worth pairing with a test asserting **both** write paths check, so the symmetry itself is
pinned rather than re-derived.

## Triage & Execution Notes

- capture (`bug-ingest`): raised by `task-044`'s second-pass review. Severity `low` — no live defect,
  no user-facing symptom; it is a latent gap in an otherwise total guarantee.
