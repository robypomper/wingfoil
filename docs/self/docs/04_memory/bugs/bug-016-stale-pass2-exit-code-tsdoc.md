---
id: "bug-016-stale-pass2-exit-code-tsdoc"
type: bug
title: "Two TSDoc blocks in src/validation/errors.ts still encode the Pass-2-always-exits-2 rule that spec-009 §3 now repudiates"
status: open
severity: "low"
release-origin: "v0.2"
release: ""
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`spec-009-validation-strategy` §3 was rewritten (implementing `dl-032`) to key exit codes on the
nature of the failure rather than the detecting pass. Two TSDoc blocks in `src/validation/errors.ts`
still state the old blanket rule — that Pass-2 semantic failures exit `2` — and **no task owns
correcting them**.

## Steps to Reproduce

1. Read `src/validation/errors.ts` around the `EXIT_INTEGRITY` constant (~line 30): *"a parse or
   cross-field / system-integrity failure — `E_YAML_PARSE_ERROR` **and Pass-2 semantic failures**"*.
2. Read the `ValidationError.semantic` factory (~line 74): *"Build a Pass-2 semantic / cross-field
   failure. Exits `2` (integrity) … (spec-009 §1, §3)"*.
3. Compare with `spec-009` §3 as it now reads: *"Exit codes follow the nature of the failure, not the
   pass that detects it"*, with `1` for "every other validation failure … **including business-rule
   failures detected in Pass 2**".

## Expected Behavior

The prose describes the rule the project actually holds. Both blocks cite spec-009 §3 by name, so a
reader has every reason to trust them.

## Actual Behavior

They describe a rule spec-009 §3 explicitly repudiates. `task-036` already shipped a Pass-2 failure
(`E_INVALID_STATE`) that exits `1`, so the codebase now contains a counterexample to its own
documentation.

## Notes

**The ownership gap is the point of this bug.** `task-036` found it and correctly declined to fix it
across a task boundary (`src/validation/` was `task-043`'s area at the time). `task-043`'s acceptance
criteria are secret/credential hygiene (REQ-SEC-08) and do not cover this prose. `dl-032`'s Actions
amend the SARD and spec-009 and hand the code change to `task-045-memory-submit`, but never name these
two blocks. Confirmed independently by both tasks' reviewers.

Note the factory itself is **not** wrong to exist: its six other call sites (`loaders`, `id`, `query`)
are genuine parse/integrity checks that correctly keep `2`. Only the prose generalises.

Cheapest fix: reword both blocks to describe the nature-of-failure rule and note that `semantic()` is
the constructor for integrity failures specifically, not for every Pass-2 check. Natural home is
`task-045-memory-submit`, which already owns the `E_INVALID_TRANSITION` realignment in the same
neighbourhood — folding it there would need an explicit scope addition, since it is not in that task's
acceptance criteria either.

## Triage & Execution Notes

- capture (`bug-ingest`): raised by `task-036`'s second-pass review, corroborated by `task-043`'s.
