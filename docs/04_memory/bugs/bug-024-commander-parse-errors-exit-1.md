---
id: "bug-024-commander-parse-errors-exit-1"
type: bug
title: "commander parse errors exit 1 where spec-008 and REQ-INT-04 require 2"
status: open
severity: "low"
release-origin: "v0.2"
release: ""
feature: "P5.1"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

A missing option value or an unknown option is rejected by commander with exit code **1**, while
`spec-008-cli-grammar` line 39 ("unknown tokens → 2") and line 115 ("Required arg missing → exit 2"),
and REQ-INT-04's Fit Criterion, all require **2**.

## Steps to Reproduce

1. `wingfoil directives list --role` (option declared, value missing) → exit **1**
2. `wingfoil directives list --rol x` (unknown option) → exit **1**
3. `wingfoil memory search --tag` → exit **1** (identical, so this is not specific to one command)

## Expected Behavior

Exit **2** — the usage-error code, as every hand-written usage error in `src/core` already returns
via `UsageError` → `exitCodeForThrow`.

## Actual Behavior

Commander's own parse failure path exits 1 before any core code runs, so `exitCodeForThrow` never
sees it.

## Notes

**Pre-existing and surface-wide**, not introduced by any current task — confirmed identical on
`memory search --tag`. `task-012-cli-exit-code-contract` deferred "unknown-command → 2 /
missing-arg → 2" to owning tasks, and no element was ever opened, so it has been unowned since.

Scope of a fix is the commander layer for **all** value options, not one command: configure
commander's `exitOverride` / error handling so its parse failures map onto the same exit-code
contract as core-originated usage errors.

## Triage & Execution Notes

Raised from `task-053`'s dev-loop review (v0.2). Severity `low`: the error message is correct and
nothing is corrupted; only the exit code contradicts the spec, which matters for scripted consumers
and for REQ-INT-04's Fit Criterion.
