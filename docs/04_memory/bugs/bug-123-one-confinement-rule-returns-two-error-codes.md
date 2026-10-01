---
id: "bug-123-one-confinement-rule-returns-two-error-codes"
type: bug
title: "The same confinement refusal returns `IO` from `memory add` and `VALIDATION` from the four transition verbs, so a machine-readable consumer sees two codes for one rule"
status: closed
severity: "low"
release-origin: "v0.2"
release: "v0.3"
feature: "P5.1"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

The confinement refusal added by `task-105` and `task-106` surfaces with two different `CoreError`
codes depending on which verb triggered it:

- `memory add` → `IO`, because `memoryAddFn` catches the `StorageError` thrown by
  `resolveConfinedMemoryPath` and maps it that way;
- `memory submit|approve|reject|deprecate` → `VALIDATION`, because `commitMemoryTransition` calls
  `requireConfinedWriteTarget`, which returns a `VALIDATION` `CoreResult`.

Both exit **1**, so `spec-005` §1 holds and the contract is not broken. What differs is the code a
`--format json` consumer reads.

## Steps to Reproduce

Drive either verb against a Memory path that resolves outside the project root, or whose target is a
symlink, with `--format json`, and compare the `code` field.

## Expected Behavior

One rule, one code. A caller branching on `code` should not have to know which verb it used to learn
that it broke the same rule.

## Actual Behavior

Two codes, and neither is wrong in isolation: the resolver genuinely throws a storage error, and the
core guard genuinely returns a validation result.

## Notes

**Inherited, not introduced.** The split comes from `task-105`'s handling of `E_PATH_ESCAPES_ROOT`
rather than from `task-106`, which added the symlink refusal along both existing paths and kept each
one's existing mapping. Neither task was wrong to leave it; changing it is a decision about the error
taxonomy, not a fix inside a blocker's repair.

**Which code is right is the actual question.** `VALIDATION` describes what happened — the request
named a target the rule forbids. `IO` describes where it was detected. `REQ-INT-05` exists so a caller
can parse output, and a caller branching on `code` is the whole reason the field is there, so the
answer should be chosen rather than inherited from a call stack.

**Found by `task-106`'s reviewer**, which recorded it as an observation and explicitly not as grounds
to reject, since the contract each verb honours is intact.

## Triage & Execution Notes

- triage (2026-09-25): **low**. Both exits are 1, both messages are correct, and no human is misled.
  The cost lands on a machine consumer, which today is nobody — `bug-114` already records that the
  parse path does not honour `--format` at all, so the JSON surface these codes belong to is itself
  incomplete. Worth scheduling together.
