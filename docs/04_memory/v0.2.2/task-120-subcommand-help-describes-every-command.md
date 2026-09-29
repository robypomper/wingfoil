---
id: "task-120-subcommand-help-describes-every-command"
type: task
title: "Every command's `--help` describes the command, names its arguments and explains its options"
status: in-progress
release: "v0.2.2"
priority: "medium"
tags: ["v0.2.2", "cli", "help", "first-use"]
ref: "bug-128-subcommand-help-describes-no-command-and-no-argument"
bug: ["bug-128-subcommand-help-describes-no-command-and-no-argument"]
depends_on: []
tmpl_version: 260703
---

## Description

Subcommand `--help` describes nothing (`bug-128`): no command has a description, and every argument
and option reads as a placeholder. The information exists, because `docs/cli-reference.md` carries
it, but the CLI does not show it. The command surface is derived mechanically from `CORE_MODULES`
(`src/core/index.ts`). This closes `bug-128`.

## Acceptance Criteria

1. Every registered command has a one-line description, taken from the same declaration the command
   surface derives from. *Red-first:* a test walks the whole registered command tree and fails on an
   empty description.
2. Every positional argument is named for what it is (`<id>`, `<path>`, `<name>`) and marked required
   where it is. Every option has a description. The same test covers both. *Red-first.*
3. The descriptions agree with `docs/cli-reference.md`. Where they differ, one of the two is
   corrected, and `test/docs/cli-reference.test.ts` stays green.
4. No behaviour changes: parsing and exit codes are identical. *Characterization.*
5. `npm test` green.

## Execution Notes

### design (architect) — 2026-09-29

**`depends_on: []`** — the `dl-015` gate is vacuous. Read anyway, as the orchestrator asked, because
three tasks touched the same seam:
- `task-110` (done) added `CoreOption.repeatable` and `CoreOption.valueName` and gave `memory add
  --set` the first declared description; its notes record that `test/docs/cli-reference.test.ts`
  checks command headings only, not text. This task extends exactly that seam.
- `task-119` (done) built `init --template`'s description from `TEMPLATE_NAMES` in
  `src/cli/program.ts`; `test/cli/program.test.ts` pins `init`'s description string, which this task
  changes (below).
- `task-101`/`task-103` (done): `program.exitOverride` must be installed before the first
  `.command()` because `copyInheritedSettings` copies it at registration time — the same holds for
  `configureHelp`, which this task adds. `commander.excessArguments` is mapped but unreachable in
  production "because every derived command registers a variadic `[positionals...]`"
  (`src/core/exit-code.ts`); this task changes that registration, so the reason must be restated,
  and the behaviour kept (AC 4).

`bug: [bug-128]` synced `planned → in-progress` at `start` (`1c532d5c`).

**Specs.** `grep -m1 '^status:'` → `spec-005-cli-command-contract: approved`,
`spec-006-core-domain-api: approved`, `spec-008-cli-grammar: approved`. `spec-008` §8 is the help
contract: `<noun> --help` lists verbs "with one-line descriptions"; `<noun> <verb> --help` prints
"Synopsis, argument table, flags table, exit codes, one example". The BDD contract
`P5.1.4-cli-ux.feature` ("Help is available for every command") likewise requires "usage, options, and
at least one example". Measured today (`node dist/cli.js memory approve --help`): no description, a
generic `positionals` argument, `--reason <value>  reason value`, **no exit codes and no example**.
The spec is therefore implemented, not revised: the exit codes and the example are the same class of
missing help content and are added in this task (approver's standing same-class rule). No tech-spec
is missing; the design approval is a pass-through.

**Design — one declaration, rendered by the CLI.**
- `src/core/registry.ts`: `CoreModule.description` (the noun line), `CoreOperation.description`
  (the verb line), `CoreOperation.positional` (`{ name, required, description }` — absent means the
  command takes none), `CoreOperation.example` (one invocation), and `CoreOperation.flags` becomes a
  list of `{ name, description }` (it was `string[]`, the only undescribable input). All optional in
  the type, so the synthetic fixtures under `test/` stay valid; the guard test below makes them
  mandatory for `CORE_MODULES`.
- `src/core/index.ts`: every module and operation in `CORE_MODULES` declares them. The wording of
  each verb line is the first sentence of its `docs/cli-reference.md` entry (AC 3).
- `src/cli/program.ts` renders the declaration: `.description()`, the named positional in the
  synopsis (`<id>` when required, `[section]` when optional — a `configureHelp` `subcommandTerm` and a
  per-command `.usage()`, since Commander's own rendering is tied to its enforcement), `(required)` on
  a required option, and an `Example:` + `Exit codes:` block after each leaf command's help.
- **Parsing is untouched (AC 4).** Commander still sees an OPTIONAL variadic argument where a
  positional is declared — marking it required to Commander would move the missing-argument refusal
  from core's message (`missing required argument: memory submit <id>`) to Commander's own. A command
  that declares no positional registers no argument and `allowExcessArguments(true)`, which accepts
  exactly what the variadic accepted; the action reads the operands from the command either way.

**AC classification (T1).**

| AC | Class | Why |
|---|---|---|
| 1 — every command has a one-line description from the declaration | red-first | `node dist/cli.js --help` lists `directive`, `directives`, `dna`, `memory`, `workflow` with no text; `memory --help` lists every verb bare |
| 2 — positionals named and marked required; options described | red-first | `memory add --help` → `positionals  optional positional arguments …`, `--type <value>  type value` |
| 3 — descriptions agree with `docs/cli-reference.md` | red-first | the agreement is new: `test/docs/cli-reference.test.ts` checks headings only (task-110's notes); a check comparing each description to its entry fails today on every command |
| 4 — parsing and exit codes identical | characterization | behaviour exists; pinned by the existing exit-code suites plus a new excess-positional pin, and a before/after transcript |
| 5 — `npm test` green | characterization (gate) | |

The required-ness in AC 2 is checked against behaviour, not just declared: a command whose positional
is declared required must exit `2` naming `<name>` when it is omitted, and an optional one must not
(`node dist/cli.js memory submit` in an empty git repository → `error: missing required argument:
memory submit <id>` [2]; `dna show` → exit `1`, config not found — measured before any change).
