---
id: "bug-103-a-noun-without-a-verb-exits-1-with-no-error-line"
type: bug
title: "`wingfoil dna` and `wingfoil help nosuchnoun` exit `1` printing usage to stderr with no `error:` line, breaking two separate rules of `spec-005` §1 at once"
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

Two invocations reach Commander's **help** path rather than its error path, and so are untouched by
`task-101`'s mapping:

```
wingfoil dna              exit=1   first stderr line: Usage: wingfoil dna [options] [command]
wingfoil help nosuchnoun  exit=1   root usage on stderr
```

Neither prints an `error:` token anywhere. `spec-005` §1 is broken twice over:

1. a malformed invocation — a noun with no verb — is a **usage error**, which the same section
   assigns exit `2`;
2. *"A non-zero exit code (`1` or `2`) is **always** accompanied by an error message on stderr in the
   format defined in §3 — a bare non-zero exit with no message is a contract violation."*

## Steps to Reproduce

Measured on `task-101`'s build at `eb3278f0`, exit codes read from `$?` with stderr redirected to a
file — no pipes.

## Expected Behavior

A missing verb exits `2` and emits an `error:` line naming what was missing.

## Actual Behavior

Exit `1`, usage text, no error line. A script branching on the code is told the request was
well-formed and failed.

## Notes

**The mechanism is why `task-101` did not fix it, and the reasoning is worth keeping.** This is
Commander's `this.help({ error: true })` — the `this.commands.length && this.args.length === 0 &&
!this._actionHandler` branch of `command.js` — reached through `commander.help`, which is a
*non-error* code. `task-101` mapped the nine error-raising codes; `help` is one of the four that are
not, alongside `helpDisplayed`, `version` and `executeSubCommandAsync`, and those four are exactly
the ones that must keep exiting `0` or `1`. Promoting this one means separating "help printed because
the user asked" from "help printed because the invocation was incomplete", which no acceptance
criterion in that task asked for.

**It is pinned, not drifting.** `test/cli/commander-parse-exit-codes.integration.test.ts` asserts the
current value in its AC5 block with the reasoning in the test, so whichever way this is decided, the
change is deliberate and a test moves with it.

**The fix needs a ruling, not just code.** Commander supplies no message here, so somebody has to
decide what the `error:` line says — `missing required argument: wingfoil dna <command>` follows the
shape `task-093` established for missing positionals, but that is a choice, not a lookup.

**`wingfoil help nosuchnoun` is the sibling** and was found by `task-101`'s reviewer. Same root, same
two violations, currently unpinned. Whatever fixes one should cover both.

**A related ambiguity, worth settling in the same pass.** `spec-005` §1 and `spec-008` §5 both
enumerate "unknown command/pillar/verb, unknown flag, missing required argument, invalid flag value".
A *missing verb* is arguably "missing required argument" and arguably its own case, and that
ambiguity is what made `task-101`'s call a judgement rather than a lookup. One sentence in each table
would remove it.

## Triage & Execution Notes

- triage (2026-09-24): **medium**. Same reasoning as `bug-098`, which it survives: the message is
  absent rather than wrong, so a human sees usage and adapts while a script is misled. Not `low`
  because it violates the one rule `spec-005` §1 states in absolute terms — that a non-zero exit is
  *always* accompanied by an error message.
- Found by `task-101` and its reviewer. Deliberately out of that task's scope.
