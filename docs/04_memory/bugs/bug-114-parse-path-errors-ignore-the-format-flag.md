---
id: "bug-114-parse-path-errors-ignore-the-format-flag"
type: bug
title: "Every error on the parse path prints console text regardless of `--format json|yaml`, while WingFoil's own errors honour `spec-005` §3.2 — so one command's stderr changes shape depending on which layer refused it"
status: planned
severity: "medium"
release-origin: "v0.2"
release: "v0.3"
feature: "P5.1"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`spec-005` §3.2 requires an error payload under `--format json|yaml` to be the `{"error": "<reason>"}`
shape on stderr. WingFoil's own errors honour it. **Nothing on the parse path does.**

```
$ wingfoil --format json dna set
{"error":"missing required argument: wingfoil dna set <path> --value <value>"}   exit 2

$ wingfoil --format json nosuchpillar
error: unknown command 'nosuchpillar'                                            exit 2
$ wingfoil --format json dna
error: missing required argument: wingfoil dna <command>                         exit 2
```

Same flag, same exit code, two different stderr shapes — decided by **which layer refused**, which is
not something a caller can predict.

## Steps to Reproduce

The three commands above, measured on `task-103`'s build.

## Expected Behavior

A machine-readable format applies to every error the tool emits, or `spec-005` §3.2 says which errors
it does not cover.

## Actual Behavior

It applies to errors raised inside `src/core` and to none of the nine Commander parse codes, nor to
the missing-verb line `task-103` added.

## Notes

**Two pre-existing sites and one new one, and the new one is the reason this is filed now.**
`src/cli/program.ts` hard-codes `{ format: 'console' }` at the `emitError` call `task-103` added, and
at a second pre-existing call; Commander's own parse errors were console-shaped before either.
`task-101` established the pattern by mapping exit codes without touching output shape, and
`task-103` followed it deliberately — the right call, since inventing a third convention inside a fix
task would have been worse. But `task-103` recorded three rulings and this fourth one silently.

**The honest counter-argument, and it should be weighed rather than dismissed.** JSON-shaping one line
under a wall of Commander-printed help text does not make stderr parseable — so a fix that only wraps
the line achieves the appearance of the contract and not the contract. Getting this right may mean
suppressing the usage text under a machine format, which is a behaviour change with its own argument.

**Consolidates two findings**: `task-103` proposed the parse-path half; its reviewer found the new
line joins the same pattern. They are one defect seen from two sides.

## Triage & Execution Notes

- triage (2026-09-25): **medium**. Nothing fails and every message is correct English; the cost is that
  `--format json` is a contract a caller cannot rely on, on exactly the paths a script hits when its
  invocation is wrong. Not `low` because `REQ-INT-05` exists so a caller can parse output, and half a
  parseable surface is what a caller discovers at the worst moment.
