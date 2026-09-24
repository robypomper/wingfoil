---
id: "bug-098-unknown-command-and-unknown-option-exit-1-not-2"
type: bug
title: "An unknown command or unknown option exits `1`, while `spec-005` §1 assigns usage errors exit `2` — Commander's own parse errors never reach the exit-code contract"
status: open
severity: "medium"
release-origin: "v0.2"
release: ""
feature: "P5.1"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`spec-005-cli-command-contract` §1 assigns **exit 2** to usage errors and **exit 1** to validation
failures. The CLI honours that for errors it raises itself, and **not** for the ones Commander raises
before control reaches WingFoil code: an unknown command and an unknown option both exit `1`.

`task-012` built the exit-code contract (REQ-INT-04) and recorded `unknown-command → 2` as deferred
to its owning task. No task ever took it.

## Steps to Reproduce

Measured against `main`'s build at `a42e75a6`, in a throwaway `wingfoil init --template Scrum`
repository. Exit codes captured directly, not through a pipe.

```
wingfoil nosuchpillar                            exit=1  error: unknown command 'nosuchpillar'
wingfoil dna nosuchverb                          exit=1  error: unknown command 'nosuchverb'
wingfoil dna infer                               exit=1  error: unknown command 'infer'
wingfoil dna show --section project              exit=1  error: unknown option '--section'
wingfoil dna set project.license --nosuchflag x  exit=1  error: unknown option '--nosuchflag'
```

The conformant controls, which show the contract is honoured wherever WingFoil owns the error:

```
wingfoil --format nosuchformat dna show project  exit=2   (invalid flag value)
wingfoil dna set                                 exit=2   (missing required argument)
```

## Expected Behavior

Per `spec-005` §1, every usage error exits `2`. An unknown command and an unknown option are usage
errors by any reading — the invocation is malformed, nothing was attempted, no validation ran.

## Actual Behavior

Commander calls `process.exit(1)` from its own error path before the exit-code mapping in `src/core`
is consulted, so two whole classes of usage error bypass the contract. The **messages** are correct;
only the codes are wrong.

## Notes

**The failure is structural, not a missed case.** `task-012` deliberately moved exit-code *selection*
into `src/core` so that one place decides it. Commander's parse errors never arrive there, so no
amount of care inside `src/core` can fix this — the remedy is to intercept at the Commander boundary,
via `exitOverride()` or `configureOutput`, and route those errors through the same mapping.

**It matters more than its severity suggests, in one specific way.** `REQ-INT-04` exists so a script
can branch on the exit code, and `1` versus `2` is exactly the distinction that lets a caller tell
"you asked for something impossible" from "you asked correctly and it failed". A typo'd command
currently reports the second. That is also the failure a user hits most often.

**Unblocked by anything.** `dl-082` has just moved the DNA grammar, so `wingfoil dna set <key> <value>`
now produces an extra-positional error — a case a script written against v0.1 will meet. It exits `2`
correctly (WingFoil raises it), which is worth knowing when scoping: the new grammar's own errors are
conformant.

**Found by `task-098`** while executing every command in the corrected CLI reference — the kind of
defect a documentation task finds precisely because it runs things nobody runs.

## Triage & Execution Notes

- triage (2026-09-24): **medium**. Nothing is destroyed and every message is correct, so a human is
  never misled; a script is. Not `low` because it is a declared contract in an `approved` spec that
  the shipped binary does not honour, on the most frequently-hit error path there is.
- **Whether it blocks `v0.2` is an approver decision and has not been made.** Filed without a
  `release:` stamp so the choice is explicit rather than inherited.
