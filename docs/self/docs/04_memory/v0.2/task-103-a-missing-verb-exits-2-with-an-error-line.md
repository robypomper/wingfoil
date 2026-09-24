---
id: "task-103-a-missing-verb-exits-2-with-an-error-line"
type: task
title: "Give a noun invoked without a verb the exit code and the error line `spec-005` §1 requires, closing the half of the exit-code contract `task-101` could not reach"
status: in-progress
release: "v0.2"
priority: "medium"
tags: ["v0.2", "cli", "exit-codes"]
ref: "bug-103-a-noun-without-a-verb-exits-1-with-no-error-line"
bug: ["bug-103-a-noun-without-a-verb-exits-1-with-no-error-line"]
depends_on: ["task-101-route-commander-parse-errors-through-the-exit-code-contract"]
tmpl_version: 260703
---

## Description

`wingfoil dna` and `wingfoil help nosuchnoun` print usage to stderr and exit **1**, with no `error:`
token anywhere. `spec-005` §1 is broken twice: a malformed invocation is a usage error at exit `2`,
and *"a non-zero exit code is **always** accompanied by an error message on stderr"* — a bare
non-zero exit with no message is named there as a contract violation.

`task-101` mapped Commander's nine **error** codes. These two reach `commander.help` instead —
`this.help({ error: true })`, the `this.commands.length && this.args.length === 0 &&
!this._actionHandler` branch — which is one of the four **non-error** codes that must keep exiting 0
or 1. It left them alone deliberately, pinned them at their current value, and said so.

## Acceptance Criteria

**AC1 — reproduce both, exit codes from `$?` directly.** `wingfoil dna`, `wingfoil memory`,
`wingfoil workflow`, `wingfoil directive`, and `wingfoil help nosuchnoun`. Never through a pipe.

**AC2 — a noun with no verb exits 2 and emits an `error:` line.** Commander supplies no message here,
so the wording is a decision: follow the shape `task-093` established for a missing positional
(`error: missing required argument: wingfoil dna <command>`) unless you can argue better, and record
the choice.

**AC3 — `help <unknown>` gets the same treatment.** Same root, same two violations.

**AC4 — `--help`, `--version` and an explicit bare `help` still exit 0. This is the trap.** The four
non-error Commander codes share one path, and separating "help printed because the user asked" from
"help printed because the invocation was incomplete" is the whole job. If you cannot distinguish them
by code, distinguish them by what was on the command line — and pin every case either way:
`wingfoil --help`, `dna --help`, `dna set --help`, `init --help`, `--version`, bare `help`,
`help dna`.

**AC5 — one place still decides.** Extend the existing mapping in `src/core/exit-code.ts`; do not add
a second decision site. `task-101`'s AC6 failed a task for that even when everything else passed, and
the reason has not changed.

**AC6 — `task-101`'s pin moves with the behaviour.** `test/cli/commander-parse-exit-codes.integration.test.ts`
asserts today's value in its AC5 block with the reasoning in the test. Update it, and update the
reasoning — a pin whose comment still explains why the old value was right is worse than no comment.

**AC7 — the ambiguity in the specs, settled.** `spec-005` §1 and `spec-008` §5 both enumerate
"unknown command, unknown flag, missing required argument, invalid flag value". A **missing verb** is
arguably the third and arguably its own case, and that ambiguity is what made `task-101`'s call a
judgement rather than a lookup. Add the sentence to both tables under dated Revision notes.

## Implementation Notes

- Read `task-101`'s Execution Notes first (`dl-015`): the ordering of `exitOverride` is load-bearing
  — `.command()` copies the parent's `_exitCallback` at **registration** time — and its notes record
  the four non-error codes and why they are excluded.
- AC1 is measurement; AC2/AC3 are **red-first**; AC4 and the conformant controls are
  **characterization**. No fabricated red.
- Commander writes the usage text itself. Decide whether the `error:` line comes before or after it,
  and whether the usage text should still print at all — and say which, with the reason.
