---
id: "task-101-route-commander-parse-errors-through-the-exit-code-contract"
type: task
title: "Intercept Commander's own parse errors at the CLI boundary and map them through `src/core`'s existing exit-code decision, so an unknown command and an unknown option exit 2 like every other usage error"
status: pending
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
