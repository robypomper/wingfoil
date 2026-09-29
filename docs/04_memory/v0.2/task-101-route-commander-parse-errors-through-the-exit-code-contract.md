---
id: "task-101-route-commander-parse-errors-through-the-exit-code-contract"
type: task
title: "Intercept Commander's own parse errors at the CLI boundary and map them through `src/core`'s existing exit-code decision, so an unknown command and an unknown option exit 2 like every other usage error"
status: done
release: "v0.2"
priority: "high"
tags: ["v0.2", "cli", "exit-codes"]
ref: "bug-098-unknown-command-and-unknown-option-exit-1-not-2"
bug: ["bug-098-unknown-command-and-unknown-option-exit-1-not-2"]
depends_on: []
tmpl_version: 260703
---

## Description

`spec-005-cli-command-contract` §1 assigns **exit 2** to usage errors and **exit 1** to validation
failures. `task-012` moved exit-code selection into `src/core` (`src/core/exit-code.ts`,
`exitCodeForResult` / `exitCodeForThrow`) precisely so one place decides it, and `REQ-INT-04` exists so
a script can branch on the result.

Commander never reaches that place. It calls `process.exit(1)` from its own error path, so an unknown
command and an unknown option exit `1` — the code that means *your request was well-formed and
failed*, for a request that was never well-formed. Errors WingFoil raises itself are conformant, which
is what makes the inconsistency sharp rather than uniform.

`task-012` recorded `unknown-command → 2` as deferred to its owning task. No task took it. This is it.

## Acceptance Criteria

**AC1 — reproduce first, before changing anything.** Drive the built CLI in a throwaway
`wingfoil init --template Scrum` repository and record exit codes **directly**, not through a pipe (a
pipe reports the last command's status, which is how this class of measurement goes wrong):

```
wingfoil nosuchpillar                            expect 1 today
wingfoil dna nosuchverb                          expect 1 today
wingfoil dna show --section project              expect 1 today
wingfoil --format nosuchformat dna show project  expect 2 today (control)
wingfoil dna set                                 expect 2 today (control)
```

**AC2 — an unknown command exits 2**, at every level: a bare unknown noun, and an unknown verb under
a known noun.

**AC3 — an unknown option exits 2**, on any command, including one that carries derived
`--entry-<field>` options.

**AC4 — the messages do not change.** They are correct today (`error: unknown command 'x'`,
`error: unknown option '--x'`). This task changes codes, not text. Pin the messages so a future
refactor cannot quietly reword them.

**AC5 — `--help` and `--version` still exit 0. This is the trap; treat it as the main risk.**
Commander implements `--help` and `--version` through the *same* exit path as its errors
(`commander.helpDisplayed`, `commander.version`, `commander.help`). An `exitOverride()` written
carelessly turns `wingfoil --help` into exit 2. Cover `wingfoil --help`, `wingfoil dna --help`,
`wingfoil dna set --help`, `wingfoil --version`, and a subcommand invoked with no arguments where
Commander prints help.

**AC6 — one place still decides.** The interception must route through the existing mapping in
`src/core/exit-code.ts`, not introduce a second decision site. If Commander's error codes need a
translation table, it belongs in `src/core` beside the others. Recreating the condition `task-012`
removed — exit codes decided in more than one place — fails this AC even if every other one passes.

**AC7 — the conformant cases stay conformant.** Invalid flag value → 2, missing required argument → 2,
validation failure → 1, successful command → 0. Characterize them so this change cannot move them.

**AC8 — the whole surface, not the cases in AC1.** Enumerate the commands from `CORE_MODULES` and
assert the unknown-option behaviour across them rather than on a sample. A test that checks three
commands is the "verified where it cannot fail" pattern this release has rejected repeatedly.

## Implementation Notes

- **AC1, AC2, AC3 are red-first** under `dl-014`/T1 — the behaviour is wrong today and a genuine red
  precedes the fix. **AC5 and AC7 are characterization**: they are correct now and the test exists to
  keep them correct through this change. Record the classification per AC.
- The likely mechanism is `program.exitOverride()` plus `configureOutput`, catching
  `CommanderError` and reading its `.code` (`commander.unknownCommand`, `commander.unknownOption`,
  `commander.helpDisplayed`, …). Confirm the code strings against the installed Commander version
  rather than from memory — `dna.yaml` pins Commander.js as a declared technology and the codes are
  version-surface.
- `src/cli/program.ts` builds the program; `src/cli/registrar.ts` already calls
  `exitWith(exitCodeForResult(result))`; `src/cli/exit.ts` owns the process-exit seam. Read all three
  before choosing where to intercept — `exit.ts`'s own TSDoc states the policy split that AC6 protects.
- `init` and `mcp` are hand-wired bootstrap commands, not derived from `CORE_MODULES`. Check them
  explicitly; they are the two that a `CORE_MODULES`-driven test will not cover.
- Nothing here depends on another in-flight task. `src/cli/program.ts` was last touched by `task-093`,
  which is merged.

## Execution Notes

### T1 — per-AC classification (`dl-014`/T1, `testing` directive)

| AC | Classification | Why |
|----|----------------|-----|
| AC1 | measurement (no test) | Reproduction step: the before/after table below, taken from the real process exit status. |
| AC2 | **red-first** | An unknown command exited `1`; a genuine red preceded the fix. |
| AC3 | **red-first** | An unknown option exited `1`; same. |
| AC4 | characterization | The messages are correct today; the test exists so this change (and a later refactor) cannot reword them. |
| AC5 | characterization | `--help`/`--version` already exit `0`; the test is the guard against the `exitOverride` trap. |
| AC6 | characterization (structural) | Verified by construction + `test/core/exit-code.test.ts`: the CLI holds no exit-code literal of its own for a parse outcome. |
| AC7 | characterization | The conformant cases are correct today; pinned so this change cannot move them. |
| AC8 | **red-first** | The sweep is driven from `CORE_MODULES`; all 18 derived commands were red at exit `1` before the fix. |

Red run of `test/cli/commander-parse-exit-codes.integration.test.ts` before any `src/` change:
**26 failed, 13 passed, 39 total** (commit `2a18c0a7`). The 13 that passed on first run are exactly
the characterization cases (AC4, AC5, AC7's already-conformant controls) — no fabricated red, and no
dead code was added to force one.

`depends_on` is empty, so `dl-015`'s `read_related` gate has nothing to acknowledge.

### AC1 — before and after, measured directly

Built CLI (`npx tsc -p tsconfig.build.json`, then `node dist/cli.js …`) driven in a throwaway
`git init` + `wingfoil init --template Scrum` repository under the session scratchpad. **Exit codes
captured from `$?` of the CLI process itself** — the runner assigns `rc=$?` immediately after the
call and redirects stderr to a file; nothing is measured through a pipe.

| Invocation | Before | After | stderr (unchanged both sides) |
|---|---|---|---|
| `wingfoil nosuchpillar` | `1` | **`2`** | `error: unknown command 'nosuchpillar'` |
| `wingfoil dna nosuchverb` | `1` | **`2`** | `error: unknown command 'nosuchverb'` |
| `wingfoil dna infer` | `1` | **`2`** | `error: unknown command 'infer'` |
| `wingfoil dna show --section project` | `1` | **`2`** | `error: unknown option '--section'` |
| `wingfoil dna set project.license --nosuchflag x` | `1` | **`2`** | `error: unknown option '--nosuchflag'` |
| `wingfoil --format nosuchformat dna show project` *(control)* | `2` | `2` | `error: invalid --format value "nosuchformat", …` |
| `wingfoil dna set` *(control)* | `2` | `2` | `error: missing required argument: wingfoil dna set <path> --value <value>` |

Cases beyond AC1's list, measured in the same run:

| Invocation | Before | After | Note |
|---|---|---|---|
| `wingfoil --help` / `dna --help` / `dna set --help` / `init --help` | `0` | `0` | AC5 — the trap; unchanged. |
| `wingfoil --version` | `0` | `0` | AC5. |
| `wingfoil dna` / `wingfoil memory` (bare noun) | `1` | `1` | Deliberately unchanged — see "The one case left alone". |
| `wingfoil init --nosuchopt` | `1` | **`2`** | Hand-wired bootstrap command, outside `CORE_MODULES`. |
| `wingfoil mcp --nosuchopt` | `1` | **`2`** | Same. |
| `wingfoil dna show project` | `0` | `0` | AC7 success. |
| `wingfoil memory approve nosuch-id --reason x` | `1` | `1` | AC7 logic error. |
| `wingfoil memory add --type` (operand missing) | `1` | **`2`** | `commander.optionMissingArgument` — a missing required argument, which `spec-005` §1 assigns `2`. |

### What changed

- **`src/core/exit-code.ts`** — new `ParseOutcome` interface (structural `{ code, exitCode }`, so
  `core` gains no dependency on the CLI's parser) and `exitCodeForParseOutcome`. `USAGE_ERROR_PARSE_CODES`
  lists the nine Commander codes that are usage errors under `spec-005` §1 → exit `2`; every other
  outcome keeps the parser's own suggestion narrowed to the three-code contract (`0` stays `0`,
  non-zero becomes `1`). The module doc's old sentence — "Usage errors (`2`) are deliberately NOT
  produced here" — is now false and was rewritten rather than left standing.
- **`src/cli/program.ts`** — `program.exitOverride((error) => exitWith(exitCodeForParseOutcome(error)))`,
  installed immediately after `new CommandCtor('wingfoil')`. Import added:
  `import { exitCodeForParseOutcome } from '../core/exit-code';` — the direct module path
  `./registrar.ts` already uses, not the `../core` barrel, to stay off the barrel's merge surface.
- **Tests** — new `test/cli/commander-parse-exit-codes.integration.test.ts` (39 cases, spawned against
  the compiled `dist/`); `test/core/exit-code.test.ts` extended with the mapping's own unit cases.
- **Four pre-existing assertions that recorded the old `1`**, each with its prose: `test/cli/program.test.ts`,
  `test/cli/program.integration.test.ts` (its module header explained at length why an unknown command
  exits `1`), `test/cli/journey-0a.integration.test.ts`, `test/cli/derived-option-namespace.test.ts`.
- **`spec-008-cli-grammar` §9** — its first unprefixed-option bullet recorded the measured `exit 1`,
  which this task makes false, so it now reads `exit 2`, with a revision note. Edited in place per the
  precedent the spec itself states (`dl-047-tech-specs-carry-no-version-field`). §5's table needed no
  change: it already assigned `2` to an unknown command/flag — the spec was right and the binary was
  not, which is `bug-098` in one line.

### AC6 — why this is still one decision site

`task-012` moved exit-code *selection* into `src/core`; the risk here was adding a second place that
decides. The interception decides nothing: `program.ts` passes Commander's `{ code, exitCode }`
straight to `exitCodeForParseOutcome` in `src/core/exit-code.ts` — beside `exitCodeForError`,
`exitCodeForResult` and `exitCodeForThrow` — and then ends the process through `exitWith`,
`src/cli/exit.ts`'s single seam. `src/cli` does hold exit-code literals, but every one of them is
WingFoil's own pre-existing check rather than a parse-outcome decision, and this task changed none of
them:

```
$ grep -rn "exitWith(2\|exitWith(1\|exitWith(0" src/cli/
src/cli/registrar.ts:92:          exitWith(2, `error: invalid --format value "${formatValue}", expected one of: console, json, yaml`);
src/cli/init-command.ts:66:      exitWith(2);
src/cli/init-command.ts:75:    exitWith(2);
src/cli/init-command.ts:85:    exitWith(2);
src/cli/init-command.ts:99:    exitWith(2, `error: invalid --format value "${options.format}", expected one of: console, json, yaml`);
src/cli/program.ts:115:        exitWith(1);
src/cli/mcp-command.ts:47:    exitWith(1);
```

`registrar.ts:92` is the `--format` check (`task-006`); `init-command.ts` is `init`'s own
wizard/argument validation (`task-029`); `program.ts:115` and `mcp-command.ts:47` are the
resolve-root failures of the two bootstrap commands. That this task added no literal of its own is
the check that actually settles AC6:

```
$ git diff main...HEAD -- src/cli/ | grep -E "^[+-].*exitWith"
+  // and the process ends through `exitWith`, the single exit seam of `./exit.ts`, like every other
+  // before calling this, so `exitWith` is deliberately called with no message of its own.
+  program.exitOverride((error) => exitWith(exitCodeForParseOutcome(error)));
```

One added call, and its argument is a function call into `src/core`, not a number.

### AC5 — the trap, and why the interception does not spring it

Commander routes `--help` and `--version` through the **same** `_exit` path as its errors, so an
`exitOverride` that answered `2` unconditionally would turn `wingfoil --help` into exit `2` while every
obvious test stayed green. Two things prevent it: the mapping is keyed on the outcome **code**, not on
"the parser terminated"; and the non-usage branch keeps Commander's own suggestion, which is `0` for
`commander.helpDisplayed` and `commander.version`. Covered at three depths (`wingfoil --help`,
`wingfoil dna --help`, `wingfoil dna set --help`), plus `init --help`, `--version`, and the built-in
`help` / `help dna` command — each asserted on the real process exit status.

A second trap, found while reading the installed Commander rather than from memory: **`.command()`
copies the parent's `_exitCallback` into each subcommand at registration time**
(`Command#copyInheritedSettings`, `node_modules/commander/lib/command.js`, commander@15.0.0). Installed
after the `.command()` calls, the override would have covered the root only, and `wingfoil dna nosuchverb`
— raised on the `dna` subcommand — would still have exited `1`. It is installed first, and the reason
is a comment in `program.ts` so a later edit does not reorder it silently. The same fact is why
`test/cli/program.test.ts`'s helper now applies commander's default override **recursively** instead of
to the root alone.

### Commander's error codes, confirmed against the installed version

`commander@15.0.0` (`node -e "…JSON.parse(readFileSync('node_modules/commander/package.json'))…"` →
`15.0.0`; `require('commander/package.json')` fails, the package exports no `./package.json`). Codes
read out of `node_modules/commander/lib/command.js` and `lib/error.js`, not from memory:

| Code | Raised by | Suggested | Contract |
|---|---|---|---|
| `commander.unknownCommand` | `unknownCommand()` | `1` | **2** |
| `commander.unknownOption` | `unknownOption()` | `1` | **2** |
| `commander.excessArguments` | `excessArguments()` | `1` | **2** |
| `commander.missingArgument` | `missingArgument()` | `1` | **2** |
| `commander.optionMissingArgument` | `optionMissingArgument()` | `1` | **2** |
| `commander.missingMandatoryOptionValue` | `missingMandatoryOptionValue()` | `1` | **2** |
| `commander.conflictingOption` | `conflictingOption()` | `1` | **2** |
| `commander.invalidArgument` | `InvalidArgumentError` (`lib/error.js`) | `1` | **2** |
| `commander.error` | `error()`'s own default `config.code` | `1` | **2** |
| `commander.helpDisplayed` | `_outputHelpIfRequested()` | `0` | 0 |
| `commander.version` | `version()`'s action | `0` | 0 |
| `commander.help` | `help()` — `0` normally, `1` under `{ error: true }` | `0`/`1` | 0 / 1 |
| `commander.executeSubCommandAsync` | executable subcommands (WingFoil registers none) | `1` | 1 |

They are version surface, so `test/core/exit-code.test.ts` drives every one of the nine by name: a
Commander upgrade that renames one fails there rather than silently reverting an exit code in
production.

### A side effect worth recording: `P5.1.4-cli-ux` scenario 1, as literally written, now passes

`P5.1.4-cli-ux.feature`'s "unknown command yields an actionable error" asks for three things: the
message, a suggestion naming `memory`, and a non-zero exit. All three now hold, and only the exit code
was ever missing — commander writes message and suggestion before calling the exit callback, so the
interception cannot drop either. Measured on the built CLI:

```
$ node dist/cli.js memroy add ; echo "exit=$?"
error: unknown command 'memroy'
(Did you mean memory?)
exit=2
```

**That is the scenario, not the contract, and the distinction is the whole of the claim.** `spec-008`
§1 asks for the suggestion in `spec-005` §3.1's form — `hint: did you mean "memory"?`, emitted through
`src/cli/error.ts` — at Levenshtein distance <= 2. What ships is commander's own
`(Did you mean memory?)`, produced by `node_modules/commander/lib/suggestSimilar.js` (Damerau-
Levenshtein, `maxDistance = 3`, a 0.4 similarity ratio) on a path WingFoil's emitter never touches. So
this task closes the **exit-code** half of §1's `E_UNKNOWN_COMMAND` and nothing else; the format
divergence is `bug-104`.

The pin in the new suite asserts commander's exact suffix, which is more than the contract guarantees.
That is deliberate and its comment says so: a commander upgrade that rewords the suffix should fail
there and be resolved by re-reading the line — or by `bug-104`'s fix replacing it — never by inferring
that the contract moved.

### The one case left alone — and why deliberately

A noun invoked with no verb (`wingfoil dna`) prints its help **to stderr** and exits `1`. That is
`commander.help` reached through `this.help({ error: true })` (`lib/command.js`, the
`this.commands.length && this.args.length === 0 && !this._actionHandler` branch), not one of
Commander's errors, and the mapping leaves it at `1` on purpose — `exitCodeForParseOutcome` promotes
only the codes shown to be usage errors, and the unit test pins that a non-usage outcome with a
non-zero suggestion stays `1`.

Registered since as **`bug-103`**, together with `wingfoil help nosuchnoun`, which the reviewer found
and which has the same root and the same two violations.

Left alone because changing it is a separate question with a separate answer: `spec-005` §1 also says
a non-zero exit is **always** accompanied by an `error: <reason>` line on stderr, and this path writes
none, so the honest fix is "exit `2` **and** emit an error line", which is a behaviour change no AC
here asks for. Filed as a proposal in the final report rather than smuggled in. Pinned as-is in AC5's
suite so whichever way it is decided, it is decided rather than drifting.

### Gates (re-run in full on the review pass, at merge commit `147145be` — `main` merged in three times: `51eac46b`, `9642ab5f`, `147145be`)

| Gate | Result |
|---|---|
| `npx jest` | **138 suites / 2292 tests, all passing** (up from 136/2258 — `task-099`'s suites arrived with the third merge) |
| `npx jest --coverage` | **All files 98.56 % stmts / 94.00 % branch / 98.75 % funcs / 99.40 % lines** (≥ 80) |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| `npx tsc -p tsconfig.build.json` (**emitting**) | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` (full, `test/**` included) | exit 0, **no output** (`bug-026` stays closed) |
| `npm run lint` | exit 0 |
| `npm run docs:api` | exit 0 |

Coverage of the two files this task touched: `src/core/exit-code.ts` 100 % stmts / 100 % lines,
`src/cli/program.ts` 100 % lines. The two uncovered branch markers reported in them
(`exit-code.ts:138`, `program.ts:170`) are both inside code this task did not write —
`exitCodeForThrow`'s `ValidationError` branch (`task-025`) and the derived-command action callback
(`task-025`/`task-028`) — so nothing added here is unexercised.

### Note for the orchestrator's merge (superseded — see the review pass below)

This branch touches **no `index.ts` barrel** and no file `task-096`/`task-098`/`task-099` is working
in. The one import line added to a shared file is `src/cli/program.ts`'s
`import { exitCodeForParseOutcome } from '../core/exit-code';`, deliberately routed around the
`../core` barrel. `main` was merged in twice with no conflict: at `51eac46b` (carrying `task-096`'s
`src/core/index.ts` and `src/core/loaders.ts` changes) and again at `9642ab5f` (`task-098`, docs only
— `git diff --stat` on that merge shows five `.md` files and nothing under `src/` or `test/`). The
**emitting** build and the full suite were re-run after each, not only `--noEmit`. `task-098`'s
rewritten `docs/01_vision/X_cli-cmds.md` was read for exit-code claims this task could have made
stale: its three (`dna show` on a dotted path → `1`, an undeclared write path → `1`, a missing
required argument → `2`) are all errors WingFoil raises itself and none of them moves.

## Execution Notes — review pass (2026-09-24)

The reviewer stressed every claim and found **no code defect**; two prose claims overreached, plus one
observation worth recording. No behaviour changed in this pass.

### 1. The merge note was false, and `git merge-tree` proved it

It said this branch touches no file `task-096`/`task-098`/`task-099` is working in. `task-099` edits
`spec-008-cli-grammar.md` — the same file — and has since landed on `main`:

```
$ git merge-tree --write-tree main HEAD ; echo "rc=$?"
CONFLICT (content): Merge conflict in docs/self/docs/04_memory/design/specs/spec-008-cli-grammar.md
rc=1
```

One conflict, docs only: `task-099` and this task each appended a Revision block at EOF. **Resolved
here rather than left for the orchestrator** — `main` merged in a third time (merge commit
`147145be`, `main` at `2cbc93d8`) keeping both blocks in the order they landed, `task-099`'s
quoted-segment revision first, then this task's exit-code one. Each closes with the file's own
"Edited in place without a supersede or a state change" paragraph, per its convention. §9's
unprefixed-option bullet (this task's one-word edit, `exit 1` → `exit 2`) survives the merge intact,
at line 254.

The lesson is not that the claim was careless when written — it was true at `9642ab5f` — but that
**a merge claim goes stale the moment a sibling lands**, so `merge-tree` belongs in the last minute
before reporting, not in the sync step. That is where it ran this time.

*Corrected state:* no `index.ts` barrel touched; the only import line added to a shared file is
`src/cli/program.ts`'s `from '../core/exit-code'`, deliberately routed around the `../core` barrel;
three `main` merges (`51eac46b`, `9642ab5f`, `147145be`), one docs-only conflict, resolved.

*Measured last, immediately before reporting,* per the lesson above — `main` had moved on again to
`11757e5b` (three new `bug` documents, docs only) and this branch was **not** re-merged, because it
does not need to be:

```
$ git merge-tree --write-tree main HEAD ; echo "rc=$?"
rc=0
```

Clean, no conflict. That is the claim as of this report and it can go stale the same way — a sibling
landing in `spec-008-cli-grammar.md` or `src/core/exit-code.ts` is the thing to re-check.

### 2. "Completes `spec-008` §1's `E_UNKNOWN_COMMAND`" claimed more than was measured

Only the **exit-code** half is done. The suggestion half diverges from the contract in two ways, both
checked against the files rather than recalled:

| | `spec-008` §1 / `spec-005` §3.1 asks | the binary emits |
|---|---|---|
| Line | `hint: did you mean "memory"?` via `src/cli/error.ts` (`spec-005` §3.1, and `hint` as a field in the §3.2 JSON/YAML shape) | `(Did you mean memory?)`, written by commander, never through that emitter |
| Matcher | Levenshtein distance <= 2 (`spec-008` §1) | Damerau-Levenshtein, `maxDistance = 3`, `minSimilarity = 0.4` (`node_modules/commander/lib/suggestSimilar.js`) |

That divergence is **`bug-104`**, on `main`. The claim is narrowed to what was measured in the notes
above, in `test/cli/program.integration.test.ts`'s header, and in the new suite's own case comment —
the last of which matters most, because that case asserts commander's exact suffix and a reader has to
know the assertion is a **pin on today's wording, not a statement of the contract**. What survives,
and is worth stating, is the narrower fact: `P5.1.4-cli-ux.feature` as literally written — the
message, a suggestion naming `memory`, a non-zero exit — now passes in full, and did not before.

### 3. `commander.excessArguments` is mapped but unreachable in production today

Every derived command registers a variadic `[positionals...]` (`src/cli/program.ts`), so Commander
never has an excess argument to refuse. Measured on the build at `147145be`:

```
wingfoil dna show project extra                    exit=0   (accepted silently)
wingfoil memory search extra1 extra2               exit=0   (accepted silently)
wingfoil dna set project.license --value MIT extra exit=2   error: wingfoil dna set takes one positional <path>; the value travels in --value (got 2 positionals)
```

So of the nine codes mapped to exit `2`, that one is dead today — an extra positional is either
swallowed by the variadic or refused by WingFoil's own check, which already exits `2`. Pre-existing
and untouched here. Recorded beside the mapping in `src/core/exit-code.ts` as well as here, so the
next reader finds an explanation rather than an apparent mistake. It stays mapped: the table has to be
correct for the code, not for today's registration shape.

### Also in this pass

- The bare-noun finding is registered as **`bug-103`** (with its sibling `wingfoil help nosuchnoun`,
  which the reviewer found — same root, same two `spec-005` §1 violations). Both it and `bug-104` are
  cited from this task's `spec-008` revision block, so the spec now names what it does not answer.
- Nothing was filed by this task; both elements were already on `main`.
