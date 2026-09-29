---
id: "task-120-subcommand-help-describes-every-command"
type: task
title: "Every command's `--help` describes the command, names its arguments and explains its options"
status: done
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

### red (developer) — `d1673d23`

Three suites, run together before any rendering code (`npx jest test/cli/help-describes-every-command.test.ts
test/cli/help-positional-required.integration.test.ts test/docs/cli-reference.test.ts`):
**13 failed, 10 passed, 23 total**. `src/core/registry.ts` gained only the optional declaration
fields the tests read (`CoreModule.description`, `CoreOperation.description|positional|example`,
`CorePositional`), because ts-jest refuses to compile a test that reads an undeclared field; nothing
renders them at this commit.
- `test/cli/help-describes-every-command.test.ts` (new) walks the Commander tree built from
  `CORE_MODULES`: empty descriptions (25 commands listed), descriptions not taken from the declaration,
  registered vs declared positional, generic argument names (`positionals`), the synopsis and the
  noun's verb list showing `<name>`/`[name]`, generic option text (`type value`, `list flag`),
  `(required)` on a required option, and an `Example:` + `Exit codes:` footer on every leaf.
- `test/docs/cli-reference.test.ts` (extended, AC 3): each command's description equals its entry's
  first sentence (backticks, first-letter case and final period ignored); each declared positional
  appears as `<name>` in its entry.
- `test/cli/help-positional-required.integration.test.ts` (new): through `dist/`, a positional declared
  required must make the bare command exit `2` naming `<name>`; an optional one must not exit `2`; and
  (AC 4) a read-only command declaring no positional still accepts an extra operand.

The 10 that passed at red, none fabricated: two structural guards (tree size, single-line
descriptions), the existing heading-coverage test, the positional-in-entry test (vacuous with nothing
declared yet — it becomes live at green), and the six AC 4 characterization cases.

### green (developer) — `441eb1b6`

- `CORE_MODULES` declares a description for 5 nouns and 18 operations, a positional for 13 (`id` ×5,
  `path` ×4, `section`, `category`, `keyword`, `name`), an example for 18, and a description and a
  placeholder (`valueName`) for every option; `CoreOperation.flags` became `CoreFlag[]` so `--list`
  could be described. `init`/`mcp` keep their descriptions in `src/cli/program.ts`; `init`'s now
  matches its reference entry.
- `src/cli/program.ts` renders them (`configureHelp({ subcommandTerm })` installed before the first
  `.command()`, `.usage()`, `addHelpText('after', …)`); a required positional or option is rendered,
  never enforced by Commander. A command declaring no positional registers no argument and
  `allowExcessArguments(true)`; the action reads operands from the invoked command, the last callback
  argument, which both shapes share.
- `docs/cli-reference.md`: `mcp`'s summary now matches its help; `paths`: "Without it (or with
  `--list`) the whole map is printed" corrected — `--list` is a no-op (`pathsFn` TSDoc: "currently a
  no-op on the returned value"; measured `node dist/cli.js paths sources --list --format json` →
  `{"category":"sources","paths":["src/"]}`, same as without it). The header states the new check.
- Tests that pinned the bug's shape were rewritten, not deleted: `program.test.ts` (`[positionals...]`
  → the declared name, plus a new case for a command with no positional forwarding its operands),
  `program.integration.test.ts` (`positionals` → `<path>`), `init`'s description string,
  `directive-create`/`directive-assign` option equality → `objectContaining`.
- **One message changed, deliberately.** Commander names an option by its synopsis in its own
  missing-operand error, so `wingfoil memory add --type` now reads `error: option '--type <type>'
  argument missing` (was `<value>`), exit `2` unchanged; `commander-parse-exit-codes` updated.
  `grep -rn "argument missing"` outside Memory/plans → only that test, so no document quoted it.

**AC 4 — parse behaviour, before/after.** 41 invocations (each positional/extra-operand/missing-option
shape of every command, bare nouns, `init`/`mcp extra`) run through `node dist/cli.js` in a fresh
`init --template Scrum` repository per invocation, recording exit code, a hash of stdout and the first
stderr line. Before (`fa3e80b6` build) and after (`441eb1b6` build): `diff` → **identical**, 41/41.
Samples: `memory submit` → `2`, `error: missing required argument: memory submit <id>`; `dna show
project extra` → `0`; `workflow list extra` → `0`; `memory add extra --type task --title T` → `0`;
`init extra` → `2`, `error: too many arguments for 'init'…`.

**End-to-end help, every command** (`node dist/cli.js <cmd> --help`, all 26 exit `0`):

| Command | Synopsis after | Before |
|---|---|---|
| `wingfoil` | nouns listed with descriptions | `directive`, `directives`, `dna`, `memory`, `workflow` bare; `paths [options] [positionals...]` |
| `dna show` / `set` / `add` / `update` / `remove` | `[section]` / `<path>` ×4 | `[positionals...]` |
| `paths` | `[category]`, `--list` described | `[positionals...]`, `--list  list flag` |
| `memory add` | no argument; `--type <type> … (required)` | `[positionals...]`, `--type <value>  type value` |
| `memory submit` / `approve` / `reject` / `deprecate` / `history` | `<id>` | `[positionals...]`, `--reason <value>  reason value` |
| `memory search` | `[keyword]`, `--tag/--status/--type` described | `[positionals...]`, `tag value` … |
| `directives list` | no argument, `--role <role>` described | `[positionals...]`, `role value` |
| `directive create` / `assign` / `remove` | none / none / `<name>` | `[positionals...]`, `name value` … |
| `workflow list` | no argument | `[positionals...]` |
| `init`, `mcp` | unchanged shape, now with example + exit codes | no example, no exit codes |

`grep -c "positionals\| value$\| flag$"` over the 26 help screens: **68 before, 0 after**; `Example:`
and `Exit codes:` appear 20 times each (18 derived leaves + `init` + `mcp`).

### refactor (developer) — `84097e83`

Claims the change made stale, restated: `src/core/exit-code.ts` said `commander.excessArguments` was
"unreachable in production today" — false before this task too (`init extra` → exit `2`, measured
above); it now says the bootstrap commands reach it and a derived command never does, and a new case
in `commander-parse-exit-codes.integration.test.ts` pins `init|mcp extra` → `2`. `program.ts`'s module
doc no longer says the file "adds no logic of its own"; `registry.ts`'s `ParamsContext` doc no
longer says a `[positional]` is "registered generically on every derived CLI command".

**Same-class sweep** (`grep -rn "positionals\|type value\|reason value\|list flag\|terse\|generic" docs README.md`
plus reading each hit):
- `docs/user-guide.md` §11 and `docs/agents.md` §9 — "Subcommand `--help` is terse/generic" stated
  as a current limitation → now marked as 0.2.1's, fixed in 0.2.2.
- `docs/cli-reference.md` — `mcp` summary, `paths --list`, header (green).
- `README.md` CLI table — uses `[section]`, `[category]`, `<id>`, `[keyword]`, `<n>`: consistent with
  the new synopses, no help output quoted; unchanged.
- `docs/examples/` — `grep -rn -- "--help" docs/examples` → nothing; unchanged.
- `spec-008` §8 — describes the help this task now ships (verb list with one-line descriptions;
  synopsis, argument table, options table, exit codes, one example), and `P5.1.4-cli-ux.feature`'s
  "usage, options, and at least one example": **implemented rather than revised — no spec revision,
  nothing to sign off.**
- Not fixed, reported: `spec-006` §2's `CoreOperation` listing shows only `name`, `mutates`, `fn` —
  it already omitted `flags`/`options` before this task and now also omits
  `description`/`positional`/`example`; an approved-spec edit, left to the approver. `CHANGELOG.md`
  has no 0.2.2 section yet (`grep -n "0.2.2" CHANGELOG.md` → nothing): the entry belongs to v0.2.2's
  `user-docs` phase. `src/cli/program.ts` still calls the `init`/`mcp` registrations
  "un-unit-tested" although `test/cli/program.test.ts` covers `init`'s — pre-existing, not this
  class.

**Checks** (after merging `main` at `24a3d481`, task-124 included — `4dd10b3e`): `npx tsc --noEmit` →
clean; `npm run lint` → exit `0`; `npm run docs:api` → exit `0`; `npm test` → **160 suites, 2624
tests, all passed**. Coverage (`npm run test:coverage`), before (`fa3e80b6`) → after (`84097e83`):
lines 99.47 → 99.47, branches 94.18 → 94.20, functions 93.79 → 93.84, statements 98.62 → 98.63;
`src/cli/program.ts` functions 93.33 → 95.23, no file regressed. Both coverage runs had one failure,
`publish-secrets.test.ts` "publishes (dry run) the tarball…" (an `npm publish --dry-run` under load):
it fails in the baseline too and passes alone (`npx jest test/cli/publish-secrets.test.ts` → 24/24),
and the plain `npm test` run above passed it. Re-measured after the merge (`4dd10b3e`): identical totals, same single flaky failure.

### review (reviewer)

Unit and BDD-contract suites green (above). AC evidence: AC 1 and AC 2 —
`help-describes-every-command.test.ts` + `help-positional-required.integration.test.ts`; AC 3 —
`cli-reference.test.ts` description and positional checks; AC 4 — the 41-invocation identical diff
plus the extra-operand and `init|mcp extra` pins; AC 5 — `npm test` green. Submitted for the
approver's review; `bug-128` synced to `in-review`.

**Approver's ruling at the review gate (2026-09-29).** Approved, after two same-class corrections made
before approval. `src/cli/program.ts`'s comments no longer call the `init` and `mcp` registrations
"un-unit-tested": `test/cli/program.test.ts` pins both (lines 239, 395, 435). `spec-006` §2's
`CoreOperation` listing names `flags`, `options`, `description`, `positional` and `example`, with a
dated revision note signed off with this approval. The flaky `publish-secrets` dry-run test and the
inconsistent missing-positional messages are filed as bugs on `main`.
