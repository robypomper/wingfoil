---
id: "bug-112-live-config-tests-assert-role-bindings-by-exact-array"
type: bug
title: "Two suites assert this repository's live `roles.yaml` bindings by exact array, so every future binding change fails them as though it were a regression"
status: in-review
severity: "low"
release-origin: "v0.2"
release: "v0.3"
feature: "P3.2"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`test/directives/schema.test.ts` and `test/core/loaders.test.ts` each assert
`assignments.developer` against the **live** `.wingfoil/roles.yaml` with an exact-array
`toEqual`. Adding a binding therefore fails both suites with `Received +1: "<name>"`, which is
indistinguishable in the output from a genuine regression.

`task-094` hit exactly this when it bound `command-baseline`, and updated both — correctly, by
**adding** to the assertions rather than loosening them.

## Steps to Reproduce

Bind any new directive to `developer` in `.wingfoil/roles.yaml` and run
`npx jest test/directives/schema.test.ts test/core/loaders.test.ts`.

## Expected Behavior

A test over live configuration asserts the property it cares about — that the loader reads bindings
correctly, that a known binding is present — not the exact contents of a file that is expected to
change.

## Actual Behavior

It pins the configuration itself, so a legitimate change and a loader regression produce the same
failure.

## Notes

**The exact-array assertion is not simply wrong, which is why this is `low` and needs judgement
rather than a blanket loosening.** It is what catches a loader that drops or duplicates an entry. The
shape that keeps both properties is one membership assertion for the bindings that matter plus one
shape assertion — the count, or that every value is a known directive id — rather than an enumeration
of today's file.

**`task-094`'s reviewer specifically checked that these were strengthened rather than weakened**, and
they were: the exact `toEqual` stayed and `toContain` assertions were added beside it. So the current
state is better than before, and this element is about the *next* change, not about undoing that one.

**The cost is a false signal at exactly the wrong moment.** Whoever next edits `roles.yaml` — the
`reconcile-governance` phase does this by design — sees two red suites and has to decide whether they
broke something. That decision should not be necessary.

## Triage & Execution Notes

- triage (2026-09-25): **low**. No shipped behaviour is involved and the failure is loud rather than
  silent. Filed because the next `roles.yaml` change is a scheduled workflow phase, not a hypothetical.
