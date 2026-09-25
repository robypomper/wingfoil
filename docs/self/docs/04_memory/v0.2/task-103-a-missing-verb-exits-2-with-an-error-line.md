---
id: "task-103-a-missing-verb-exits-2-with-an-error-line"
type: task
title: "Give a noun invoked without a verb the exit code and the error line `spec-005` §1 requires, closing the half of the exit-code contract `task-101` could not reach"
status: in-review
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

## Execution Notes

### `dl-015` — `task-101`'s Execution Notes, read before designing anything

`depends_on: [task-101]`, merged at `c0c5c41e`. Three things in its notes decided this
implementation, and one of them reversed the design I would otherwise have written:

1. **`.command()` copies the parent's `_exitCallback` at *registration* time**
   (`Command#copyInheritedSettings`, commander@15.0.0), which is why `program.exitOverride(...)` is
   installed before the first `.command()` call. My first instinct was a per-command callback that
   could name the command it was raised on; that fact makes it a trap — a callback installed per
   command has to be re-installed *after* registration on every node of the tree, and one missed node
   reverts silently. The shipped design keeps the single root install and reads the command path from
   `program.args` instead (below).
2. **The four non-error codes and why they were excluded** — `commander.helpDisplayed`,
   `commander.version`, `commander.help`, `commander.executeSubCommandAsync`. This bug lives in the
   third, and the note that `commander.help` is `0` normally and `1` under `{ error: true }` is the
   discriminator this task is built on.
3. **`commander.excessArguments` is mapped but unreachable in production today.** Untouched here, and
   the reason it stays mapped (the table must be correct for the code, not for today's registration
   shape) is the same reason `classifyParseOutcome`'s default branch keeps its unclassified case.

### T1 — per-AC classification (`dl-014`/T1, `testing` directive)

| AC | Classification | Why |
|----|----------------|-----|
| AC1 | measurement (no test) | Reproduction step: the before/after table below, from the real process exit status. |
| AC2 | **red-first** | A noun with no verb exited `1` with no `error:` token; a genuine red preceded the fix. |
| AC3 | **red-first** | `help <unknown>` — same, and unpinned before this task. |
| AC4 | characterization | `--help`, `--version`, `help`, `help dna` already exit `0`; the tests are the guard on the discriminator. |
| AC5 | characterization (structural) | Verified by construction + the diff evidence below: `src/cli` gained no exit-code literal. |
| AC6 | **red-first** | `task-101`'s pin asserted `1`; it fails until the behaviour moves, and its comment moved with it. |
| AC7 | documentation | Two spec sentences. The substitute for a red is the measured transcript below. |

**Red run, re-taken after an interruption, against the final test files with `src/core/exit-code.ts`
and `src/cli/program.ts` reverted to their pre-fix state** (`git checkout 6b8533d5~1 -- src/core/exit-code.ts
src/cli/program.ts`, `npx tsc -p tsconfig.build.json`, then the four suites):

```
Test Suites: 4 failed, 4 total
Tests:       23 failed, 95 passed, 118 total
```

All 23 failures are the new or changed assertions; every AC4 characterization case passed on first
run, which is what "no fabricated red" means here. `src/` was restored with `git checkout HEAD --`
and `dist/` rebuilt before the gates below.

### AC1 — before and after, measured directly

Built CLI (`npx tsc -p tsconfig.build.json`, then `node dist/cli.js …`) driven in a throwaway
`git init` + `wingfoil init --template Scrum` repository under the session scratchpad. **Exit codes
read from `$?` of the CLI process itself** — the runner assigns `rc=$?` on the line after the call and
redirects stderr to a file; nothing is measured through a pipe. Both columns were taken on the same
runner, and the "after" column was re-taken from scratch after the interruption with identical
results.

| Invocation | Before | After | First stderr line | `error:` line |
|---|---|---|---|---|
| `wingfoil dna` | `1` | **`2`** | `Usage: wingfoil dna [options] [command]` | **`error: missing required argument: wingfoil dna <command>`** |
| `wingfoil memory` | `1` | **`2`** | `Usage: wingfoil memory …` | **`error: missing required argument: wingfoil memory <command>`** |
| `wingfoil workflow` | `1` | **`2`** | `Usage: wingfoil workflow …` | **`error: missing required argument: wingfoil workflow <command>`** |
| `wingfoil directive` | `1` | **`2`** | `Usage: wingfoil directive …` | **`error: missing required argument: wingfoil directive <command>`** |
| `wingfoil directives` | `1` | **`2`** | `Usage: wingfoil directives …` | **`error: missing required argument: wingfoil directives <command>`** |
| `wingfoil help nosuchnoun` | `1` | **`2`** | `Usage: wingfoil [options] [command]` | **`error: unknown command 'nosuchnoun'`** |
| `wingfoil` *(no arguments)* | `1` | **`2`** | `Usage: wingfoil [options] [command]` | **`error: missing required argument: wingfoil <command>`** |
| `wingfoil --help` | `0` | `0` | *(empty)* | none |
| `wingfoil dna --help` | `0` | `0` | *(empty)* | none |
| `wingfoil dna set --help` | `0` | `0` | *(empty)* | none |
| `wingfoil init --help` | `0` | `0` | *(empty)* | none |
| `wingfoil --version` | `0` | `0` | *(empty)* | none |
| `wingfoil help` | `0` | `0` | *(empty)* | none |
| `wingfoil help dna` | `0` | `0` | *(empty)* | none |
| `wingfoil nosuchpillar` *(control)* | `2` | `2` | `error: unknown command 'nosuchpillar'` | unchanged |
| `wingfoil dna nosuchverb` *(control)* | `2` | `2` | `error: unknown command 'nosuchverb'` | unchanged |
| `wingfoil dna set` *(control)* | `2` | `2` | `error: missing required argument: wingfoil dna set <path> --value <value>` | unchanged |
| `wingfoil paths` *(control)* | `0` | `0` | *(empty)* | none |

`wingfoil directives` (plural) is in the table because the sweep found it, not because an AC named it:
`spec-008` §1 registers the Directives pillar under two nouns and both carry verbs.

### The trap, and the bit that separates the two halves

`--help`, `--version`, `help`, `help dna`, `wingfoil dna` and `wingfoil help nosuchnoun` all terminate
through Commander's non-error path, and **four of them share one code**. Measured, not recalled — a
probe that rebuilt the real production program and installed a logging `exitOverride` recursively over
the whole command tree:

| Invocation | `code` | suggested `exitCode` | raised on | root `program.args` |
|---|---|---|---|---|
| `wingfoil` | `commander.help` | **1** | `wingfoil` | `[]` |
| `wingfoil dna` | `commander.help` | **1** | `dna` | `["dna"]` |
| `wingfoil help nosuchnoun` | `commander.help` | **1** | `wingfoil` | `["help","nosuchnoun"]` |
| `wingfoil help` | `commander.help` | **0** | `wingfoil` | `["help"]` |
| `wingfoil help dna` | `commander.help` | **0** | `dna` | `["help","dna"]` |
| `wingfoil --help` | `commander.helpDisplayed` | 0 | `wingfoil` | `["--help"]` |
| `wingfoil dna set --help` | `commander.helpDisplayed` | 0 | `set` | `["dna","set","--help"]` |
| `wingfoil --version` | `commander.version` | 0 | `wingfoil` | `[]` |
| `wingfoil nosuchpillar` | `commander.unknownCommand` | 1 | `wingfoil` | `["nosuchpillar"]` |

So the discriminator **is** available in Commander's own outcome, and no argv re-parsing was needed
for it: `Command#help(contextOptions)` computes `exitCode = 1` exactly when it was called as
`help({ error: true })`, which is what its three "there is nothing here to run" call sites do — the
missing-subcommand branch (`lib/command.js` `this.commands.length && this.args.length === 0 &&
!this._actionHandler`), the nothing-hooked-up branch, and `_dispatchSubcommand`'s `if (!subCommand)`,
which is where `help <unknown>` lands via `_dispatchHelpCommand`'s fallback. A user-requested help
suggests `0`.

The **message** needed the command path, which the outcome does not carry — and that is the one place
"what was on the command line" is read. It is read from `program.args`, which is *Commander's own*
parse result (`_parseCommand`'s `this.args = operands.concat(unknown)`, assigned before it dispatches,
global options already stripped), not from `process.argv`. The difference is testable and is tested:
`wingfoil --format json help nosuchnoun` names `nosuchnoun`, where a naive `process.argv.slice(2)`
would have named `--format`.

### What changed

- **`src/core/exit-code.ts`** — `classifyParseOutcome` now holds the rule and returns
  `{ exitCode, needsErrorLine }`; `exitCodeForParseOutcome` *delegates* to it. New branch:
  `commander.help` with a non-zero suggestion → exit `2`, `needsErrorLine: true`. The module doc and
  the function doc record the discriminator and its source line.
- **`src/cli/program.ts`** — the `exitOverride` callback reads the classification, emits the line
  through `emitError(..., { format: 'console' })` when the classification says so, then
  `exitWith(termination.exitCode)`. New private `incompleteInvocationReason(operands)` composes the
  text. Import line changed: `exitCodeForParseOutcome` → `classifyParseOutcome`, same direct module
  path (`../core/exit-code`, not the `../core` barrel).
- **`test/cli/missing-verb-exit-code.integration.test.ts`** (new, 16 cases) — AC2/AC3/AC4 against the
  compiled `dist/`, with the per-noun sweep driven from `CORE_MODULES`.
- **`test/cli/program.test.ts`** — a new white-box block driving `buildProgram`'s *real* exit callback
  (every other test in that file replaces it), plus two helpers.
- **`test/core/exit-code.test.ts`** — the `commander.help`-at-1 unit case flipped from `1` to `2` with
  its comment rewritten, and a new `classifyParseOutcome` describe block.
- **`test/cli/commander-parse-exit-codes.integration.test.ts`** — AC6: `task-101`'s pin.
- **`spec-005` §1 and `spec-008` §5** — AC7, below.

### AC5 — still one decision site

The risk this AC names is a second place deciding an exit code. What was added decides nothing in
`src/cli`: the callback passes Commander's `{ code, exitCode }` into `classifyParseOutcome` and exits
with the value it returns. The check that settles it is that this task added **no exit-code literal to
`src/cli`**:

```
$ git diff main...HEAD -- src/ | grep -E "^[+-].*(exitWith|return \{ exitCode)"
-  // before calling this, so `exitWith` is deliberately called with no message of its own.
-  program.exitOverride((error) => exitWith(exitCodeForParseOutcome(error)));
+    exitWith(termination.exitCode);
+  if (USAGE_ERROR_PARSE_CODES.has(outcome.code)) return { exitCode: 2, needsErrorLine: false };
+    return { exitCode: 2, needsErrorLine: true };
+  return { exitCode: outcome.exitCode === 0 ? 0 : 1, needsErrorLine: false };
```

Every added literal is inside `src/core/exit-code.ts`; the one added `src/cli` call takes a value. The
pre-existing literals in `src/cli` are untouched and unchanged in number:

```
$ grep -rn "exitWith(2\|exitWith(1\|exitWith(0" src/cli/
src/cli/init-command.ts:66,75,85,99   init's own wizard/argument validation (task-029)
src/cli/mcp-command.ts:47             mcp's resolve-root failure
src/cli/program.ts:128                init's resolve-root failure
src/cli/registrar.ts:92               the --format check (task-006)
```

A second thing *was* added to the rule — who owes the `error:` line — and it deliberately went into
the same function rather than beside it. `exitCodeForParseOutcome` no longer holds a table of its own,
so the code and the message obligation cannot be answered from two tables that disagree; a unit test
asserts the two agree across six outcomes.

### AC6 — the pin moved, and so did its reasoning

`test/cli/commander-parse-exit-codes.integration.test.ts`'s AC5 block asserted `expect(result.status).toBe(1)`
under a comment explaining that promoting it "would be an unrequested behaviour change riding along
with this one". Both moved: the assertion now reads `2` plus `toContain('error: ')`, and the comment
now explains why the same Commander code splits two ways and why this case deliberately stays filed
next to the `help` case it must move in the opposite direction from. The detailed wording assertions
and the sweep live in this task's own suite, which the comment points at.

### AC7 — the ambiguity, settled in both specs

Neither table said which of its enumerated cases a *missing verb* is. Both now do, in both directions,
under dated Revision notes (2026-09-25):

- **`spec-005` §1 Rules** — two bullets: a noun without its verb (and `wingfoil` with no command, and
  `help <unknown>`) is **"missing required argument"**, the case already enumerated, so exit `2` with
  an `error: ` line — "Printing that usage is not itself the error message"; and an explicit
  `wingfoil help` / `help <known>` is a success at `0`, distinct from the incomplete invocation "even
  when the two print the same text". `spec-005` had no Revision-notes section; one was added before
  `## Process Notes`.
- **`spec-008` §5** — the same ruling in the grammar's voice, placed beside §5's existing
  malformed-path paragraph, plus a revision block recording that the two cases share one Commander
  code and are separated only by its suggested exit code.

**A sentence this pass made stale, fixed in the same pass:** `task-101`'s own revision block in
`spec-008` said "A noun invoked with no verb (`wingfoil dna`) **also keeps its current exit `1`**"
— present tense, and false the moment this task landed. It is corrected to past tense with a pointer
to the revision that answers it. The `bug-104` sentence in the same block is still true and untouched.

### Three rulings, recorded because they are rulings and not lookups

1. **The wording.** `missing required argument: wingfoil <noun> <command>` — the key `spec-005` §1
   already uses, in the shape WingFoil already emits for a missing positional (`src/core/index.ts`'s
   `missing required argument: wingfoil dna set <path> --value <value>`, task-093): the incomplete
   invocation echoed back with the token that completes it. `<command>` rather than `<verb>` matches
   Commander's own placeholder in the usage line printed directly above it. For `help <unknown>` the
   line is `unknown command '<name>'` — **byte-for-byte what `wingfoil <unknown>` already emits**, so
   a script greps one shape for one mistake. Single quotes are Commander's; `spec-005` §4's example
   uses double ones, and reconciling the two spellings (with the missing `hint:` line) is `bug-104`'s,
   which owns both lines at once — picking a third spelling here would make that harder.
2. **The order, and whether the usage text should print at all.** It still prints, and the `error:`
   line comes **after** it. Commander writes the help before it calls the exit callback, so an
   `error:`-first ordering would require intercepting Commander's output stream — which would also put
   the nine already-correct messages `task-101` pinned behind an interception, for no contract gain.
   The help is the right diagnostic for exactly this error (it lists the verbs that were missing), and
   §3.1 requires the `error:` line to be *on* stderr, not to be alone there. A test pins that stderr
   opens with `Usage:` and closes with the `error:` line.
3. **`wingfoil` with no arguments at all.** Not named in any AC, reached through the identical
   `help({ error: true })` branch, and given the same answer (`2` + `error: missing required argument:
   wingfoil <command>`). Leaving it alone would have left the one rule §1 states in absolute terms
   broken in this repository the moment the rest of this task landed. A user who wants the help types
   `wingfoil --help` or `wingfoil help`, both still `0`.

### A harness artefact, found and not pinned

The new white-box block in `program.test.ts` first asserted against that suite's existing no-op
`process.exit` spy, and `wingfoil help` came back having written
`error: missing required argument: wingfoil help <command>` — an apparent regression in the exact case
AC4 protects. It is not one. With `process.exit` mocked to return, Commander resumes after its own
`_exit`, `_dispatchHelpCommand` falls through to `_findCommand(undefined)`, and a **second**
termination is raised, this time an incomplete invocation. The real binary exits at the first one:
`wingfoil help` → exit `0`, empty stderr (AC1 table). Asserting on the two-termination output would
have pinned a fiction, so the block's `beforeEach` replaces the spy with one that throws, leaving one
termination per invocation as in the real process. The reason is written into the helper's doc so the
next reader does not re-discover it as a bug.

### Gates — all re-run after the interruption, at `a3a5490a`

| Gate | Result |
|---|---|
| `npx jest` | **139 suites / 2323 tests, all passing** |
| `npx jest --coverage` | **All files 98.59 % stmts / 94.04 % branch / 98.93 % funcs / 99.40 % lines** (≥ 80, and above the 98.56/94.00/98.75/99.40 `task-101` reported) |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| `npx tsc -p tsconfig.build.json` (**emitting**) | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` (full, `test/**` included) | exit 0, **no output** (`bug-026` stays closed) |
| `npm run lint` | exit 0 |
| `npm run docs:api` | exit 0 |

The full typecheck earned its place: it caught `TS2322` in the new integration suite
(`.map(([noun]) => noun)` under `noUncheckedIndexedAccess`) that the green jest run did not, exactly
as the brief warns — `test/**` is not type-checked by jest.

Coverage of the two files touched: `src/core/exit-code.ts` 100 % stmts / 100 % lines,
`src/cli/program.ts` 98.64 % stmts / **100 % lines**. The two uncovered branch markers reported in
them (`exit-code.ts:200`, `program.ts:183`) are both in code this task did not write —
`exitCodeForThrow`'s `ValidationError` branch (task-025) and the derived-command action callback's
default parameters (task-025/task-028) — the same two `task-101` recorded. Nothing added here is
unexercised.

### Note for the orchestrator's merge

This branch touches **no `index.ts` barrel** (`src/core/index.ts` already carries
`export * from './exit-code'`, so the two new exports need no barrel edit). The one import line
changed in a shared file is `src/cli/program.ts`'s
`import { classifyParseOutcome } from '../core/exit-code';` — the symbol changed, the module path did
not, and it stays off the `../core` barrel's merge surface.

Files a sibling could collide in: `src/core/exit-code.ts`, `src/cli/program.ts`,
`test/cli/program.test.ts`, `test/cli/commander-parse-exit-codes.integration.test.ts`,
`test/core/exit-code.test.ts`, `spec-005-cli-command-contract.md`, `spec-008-cli-grammar.md` (a
revision block appended at EOF — the same place `task-099` and `task-101` collided, so expect it).

`main` has not moved since this branch was cut: `git log --oneline main ^HEAD` is empty and
`git merge-tree --write-tree main HEAD` exits `0`. Nothing was merged in because there was nothing to
merge. `task-102` and `task-104` are in flight and unmerged; **that claim goes stale the moment one of
them lands**, which is `task-101`'s own lesson — re-run `merge-tree` at merge time rather than
trusting this paragraph.
