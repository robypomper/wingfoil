---
id: spec-008-cli-grammar
type: tech-spec
title: "CLI grammar & global options (src/cli)"
status: approved
scope: "src/cli"
supersedes: ""
tmpl_version: 260703
---

## Context

`src/cli` (Commander.js + chalk, `dna.yaml` `tech_stack.cli`) is one of two surfaces that must expose
**identical behaviour** for every WingFoil operation (REQ-SYS-05 — single behaviour behind CLI and MCP).
Every `CLI-*`/`memory.*` command, every workflow step that shells out to `wingfoil`, and every BDD
scenario under `docs/02_requirements/02_bdd/features/p1-memory/` and `p5-interaction/` assumes a single,
shared grammar: how commands are invoked, which flags are global, how a Memory document is referenced on
the command line, and when the CLI prompts interactively versus fails outright. Without one authoritative
definition, individual command implementations would each reinvent flag parsing, error formatting, and
exit-code conventions — producing divergent, non-deterministic CLI behaviour that breaks REQ-INT-04
(exit-code contract), REQ-INT-05 (machine-readable output), and REQ-INT-08 (consistent error format).

## Specification

### 1. Invocation grammar

Two invocation forms, matching the command map in `docs/01_vision/X_cli-cmds.md` and the `CLI-*` command
surface:

```
wingfoil [global-flags] <noun> <verb> [args] [flags]      # pillar/verb form, e.g. `memory add`
wingfoil [global-flags] <noun> [args] [flags]              # flat command, e.g. `init`, `paths`, `audit`
```

- `<noun>` is a pillar namespace (`memory`, `dna`, `directive`, `directives`, `workflow`, `agent`) or a
  flat command (`init`, `paths`, `audit`). The Directives pillar deliberately exposes two nouns —
  singular `directive` (`create`, `assign`, `remove`) and plural `directives` (`list`) — each the
  `CoreModule.name` its operations register under (`spec-006-core-domain-api` §3 `module` column,
  `dl-041-spec-006-module-grouping-vs-core-module-name`).
- Global flags (§2) may appear anywhere after `wingfoil` — before or after `<noun>`/`<verb>`. If a flag is
  repeated, the last occurrence wins.
- Unknown `<noun>` or `<noun> <verb>` tokens produce `E_UNKNOWN_COMMAND` (exit `2`, REQ-INT-04) with a
  closest-match suggestion when Levenshtein distance ≤ 2 (ground-truth BDD:
  `p5-interaction/P5.1.4-cli-ux.feature` — `wingfoil memroy add` → `"unknown command 'memroy'"` suggests
  `"memory"`, exit `2`).

### 2. Global flags

Accepted by every command, in any position, per REQ-INT-04/REQ-INT-05/REQ-INT-08:

| Flag              | Type                   | Default   | Behaviour                                                                                             |
|-------------------|------------------------|-----------|---------------------------------------------------------------------------------------------------------|
| `--help`, `-h`    | flag                   | —         | Print context-sensitive help (synopsis, args, flags, example) and exit `0`. Takes precedence over all other flags. |
| `--version`       | flag                   | —         | Print CLI version and exit `0`. Takes precedence over all other flags except `--help`.                |
| `--format <fmt>`  | `console\|json\|yaml`  | `console` | Output encoding. `console` for humans (colour, `✓`/`⚠`/`✗` prefixes); `json`/`yaml` for scripting/CI (REQ-INT-05). An unsupported value exits `2` with `error: invalid --format value "<value>"`. |
| `--reason <text>` | string                 | —         | **Required** on approval-gate commands (`memory approve`, `memory reject`); optional elsewhere (e.g. `memory deprecate`). Recorded in the resulting git commit body (P1.7) as a `Reason:` **block** — the remainder of the `Reason:` line plus every following body line, up to (exclusive) git's trailing trailer paragraph or the end of the body — in the **declared normal form**, not as the raw argument (`dl-067-reason-trailer-contract`; see the Notes). Omitted where required exits `2` with `error: missing required argument: --reason` (ground-truth BDD `P1.7-memory-approve.feature`). |
| `--reason` (unrecordable value) | —        | —         | A reason that cannot be recorded faithfully in the trailer is refused at the CLI boundary with exit `2`, before anything is read or written, on **every** verb that takes the flag — `memory deprecate` included, where the flag is optional but a declared-and-empty value is still a usage error (`dl-067` S2). Three cases, each with its own message, none of them `missing required argument: --reason` (which answers the *omitted* case above): blank or whitespace-only → `error: invalid flag value: --reason must not be blank`; a line starting `Approver:` or `Reason:` → `error: invalid flag value: --reason must not contain a line starting with "Approver:" or "Reason:"`; a final paragraph made entirely of `Key: value` lines → `error: invalid flag value: --reason must not end in a paragraph of "Key: value" lines`. |
| `--verbose`       | flag                   | `false`   | Emit diagnostic logs to stderr in plain text, even under `--format json`/`yaml`. Never alters stdout.  |
| `--color` (negatable) | boolean flag        | `true`    | ANSI colour on stdout. Pass `--no-color` to disable; also disabled automatically when `NO_COLOR` is set to any non-empty string (https://no-color.org/) — an explicitly empty `NO_COLOR=` does **not** disable colour. |
| `--interactive` (negatable) | boolean flag  | `true`    | Whether missing required args may trigger a readline prompt in a TTY (§4). Pass `--no-interactive` to force immediate failure instead. |

Notes:

- `--format` values are `console`/`json`/`yaml`; the fit criterion in REQ-INT-05 calls these out
  explicitly for `wingfoil paths` and `wingfoil workflow status`, but the flag is registered globally so
  every command honours it uniformly (REQ-SYS-05).
- `--color`/`--interactive` are **negatable booleans**, not independent `--no-*` flags with their own
  default — see §3 for why this distinction matters and how Commander.js models it.
- **`--reason`'s declared normal form** (`dl-067-reason-trailer-contract`, ratified), in two parts:
  - **What git already does, and would do whether or not this row existed** — per-line trailing
    whitespace stripped, runs of blank lines collapsed to one, leading and trailing blank lines
    dropped. That is git's own `cleanup=whitespace`, which `git commit -m` applies to every message.
    Stating it here does not add a transformation; it makes the outcome declared instead of incidental.
  - **What WingFoil adds** — the first line's leading whitespace is trimmed. git does **not** do this;
    it is the writer's own step, and it exists because that line sits after `Reason: ` on the same
    physical line and the reader consumes the key with its following whitespace. Without it, a reason
    beginning with spaces would round-trip unequally.

  Interior indentation is preserved by both parts. The rule is enforced once, where the trailer is
  built, and the reader consumes the same grammar, so what is read back out of the commit equals what
  the writer declared rather than approximately equalling what the caller typed.
- **Why not "verbatim".** This row said "Recorded verbatim in the resulting git commit body" until
  `dl-067`. That was never achievable for multi-line text — git normalizes on the way in — and the gap
  between the promise and the behaviour was `bug-042`: a blank reason was accepted at exit `0` and
  destroyed the whole approval record, a multi-line one was truncated to its first line on read, and
  one shaped like a trailer could forge a second `Approver:` line into the audit record.

### 3. Commander.js negatable-boolean pattern (`--no-color`, `--no-interactive`)

A naive implementation might register `.option('--no-color', ..., false)` and then read
`flags.noColor`. That is wrong on two counts — Commander's negatable-boolean convention exposes the
**positive** property (`color`, default `true`), so `flags.noColor` is `undefined` and the check never
fires; and passing an explicit `false` default flips the *positive* property's default to disabled,
inverting the intended "colour on unless opted out" contract. This spec mandates the correct pattern
below instead.

**Correct pattern** — register the flag with no default, and read the *positive*, auto-negated property
Commander creates from any `--no-<name>` option:

```ts
import {Command} from 'commander'

const program = new Command('wingfoil')

program
    .option('--format <format>', 'output format (console|json|yaml)', 'console')
    .option('--verbose', 'emit diagnostic logs to stderr')
    .option('--no-color', 'disable ANSI colors')          // -> opts().color, default true
    .option('--no-interactive', 'fail on missing args instead of prompting') // -> opts().interactive, default true

const opts = program.opts()
// opts.color        === true unless --no-color was passed (then false)
// opts.interactive   === true unless --no-interactive was passed (then false)

const colorEnabled = opts.color && !isNoColorEnvSet()
const interactiveAllowed = opts.interactive
```

```ts
function isNoColorEnvSet(): boolean {
    const env = process.env['NO_COLOR']
    return env !== undefined && env !== ''
}
```

Key rule: **never** declare a manual default on a `--no-*` option and **never** invent a `noColor`/
`noInteractive` property — Commander derives `color`/`interactive` automatically from the flag's name,
defaulting to `true`; only check `opts().color === false` / `opts().interactive === false` (or the
truthy/negated form shown above).

### 4. Interactive-prompt rules

| Condition                                                        | Behaviour                                                          |
|--------------------------------------------------------------------|------------------------------------------------------------------------|
| All required args present (flags or positionals)                 | Direct execution; no prompt                                          |
| Required arg missing, stdout is a TTY, `--interactive` (default)  | Readline prompt for each missing arg, one at a time                  |
| Required arg missing, stdout is **not** a TTY (CI/pipe/non-interactive) | Fail immediately: exit `2`, `error: missing required argument: --<name>` |
| `--no-interactive` passed (any TTY state)                         | Fail immediately, same as the non-TTY case — no prompt is attempted  |

Wizard-style multi-step collection (`wingfoil init` with no `--mode params` flags) is command-specific:
it runs the same present/missing × TTY/non-TTY matrix per field, in the field order the command defines.
Optional flags never trigger a prompt — an omitted optional flag simply keeps its default.

### 5. Exit-code contract (REQ-INT-04)

| Code | Name              | When                                                                                     |
|------|-------------------|-------------------------------------------------------------------------------------------|
| `0`  | Success            | Command completed (including a no-op `--dry-run` simulation)                             |
| `1`  | User/logic error   | Valid invocation, but the operation itself failed: unknown Memory type, illegal state transition, document not found, unauthorized approver |
| `2`  | Usage/argument error | Malformed invocation: unknown command/flag, missing required argument, invalid `--format` value |

This table is the single source of truth for exit codes; ground-truth BDD scenarios (`P1.3-memory-add`,
`P1.6-memory-submit`, `P1.7-memory-approve`, `P5.1.4-cli-ux`) exercise exactly these three codes and no
others.

### 6. Error format (REQ-INT-08)

Every user-facing error, on stderr, in `--format console` (default):

```
error: <reason>
```

Example:

```
$ wingfoil memory add --type unicorn --title "X"
error: unknown memory type 'unicorn' (not defined in memory.yaml)
```

For `--format json` / `--format yaml`, the same `<reason>` is carried as a structured field:

```json
{"error": "<reason>"}
```

`--verbose` appends diagnostic lines (stack trace, underlying git output) to stderr after the error line;
it never changes the error line itself or the exit code.

### 7. Element-ref syntax

A Memory document is referenced on the command line as `<type>:<id>` (colon separator):

```
task:task-101
adr:adr-004
release-line:rl-v1
```

Used consistently in every context that names a document *by type*:

| Context                                    | Syntax        | Example              |
|---------------------------------------------|---------------|-----------------------|
| `--element` flag (`agent execute`)          | `<type>:<id>` | `--element task:202` |

Commands whose noun already scopes the type (`memory submit <id>`, `memory approve <id> --reason ...`,
`memory reject <id> --reason ...`, `memory deprecate <id>`) take the **bare `<id>`** as the positional
argument — the type is not repeated because IDs are globally unique (`id_pattern` per type in
`memory.yaml`) and the type is redundant once written out that way. `memory add` supplies the type via
`--type <type>` instead of an element-ref, since the document does not exist yet.

### 8. Help system

| Invocation                    | Output                                                              |
|--------------------------------|-----------------------------------------------------------------------|
| `wingfoil --help`               | Binary synopsis, noun list (pillars + flat commands), global flags table |
| `wingfoil <noun> --help`        | Noun synopsis, list of verbs with one-line descriptions               |
| `wingfoil <noun> <verb> --help` | Synopsis, argument table, flags table, exit codes, one example        |

Help output always renders as `--format console` regardless of the ambient `--format` flag, and always
exits `0`.

## Consequences

- Every command implementation under `src/cli` registers global flags exactly once, on the root
  `Command`, using the negatable-boolean pattern in §3 — no per-command `noColor`/`noInteractive`
  re-implementation.
- `src/core` owns exit-code selection and error-message formatting (single behaviour shared with
  `src/mcp-server`, REQ-SYS-05); `src/cli` only maps `core` results onto stdout/stderr + `process.exit`.
- Any future command (`CLI-01`…`CLI-06` equivalents) inherits this grammar by construction and must not
  redefine flag names, exit codes, or the error format.
- If REQ-INT-04/REQ-INT-05/REQ-INT-08 are revised (e.g. a new global flag or exit code is added), this
  spec must be updated first — command implementations trace back to it.

## Process Notes

Cross-checked every claim against `docs/self/.wingfoil/dna.yaml` (`tech_stack.cli` = Commander.js +
chalk) and `docs/02_requirements/03_sard/04_integrations.md` (REQ-INT-04, REQ-INT-05, REQ-INT-08).

**Revision (2026-09-17) — `directives` added to §1's noun list, per
`dl-041-spec-006-module-grouping-vs-core-module-name`.** The list named only the singular `directive`,
although `wingfoil directives list` (BDD `P3.4-directives-list.feature`) has shipped on the `directives`
module since `task-006`. Edited in place without a supersede or a state change (the `spec-001`
precedent `dl-041` cites).

**Revision (2026-09-21) — §2's `--reason` contract, per `dl-067-reason-trailer-contract` (`ready`),
carried out by `task-072-fix-reason-trailer-contract` (fixing `bug-042`).** The row promised the value
was "Recorded verbatim in the resulting git commit body (P1.7)" and said nothing about emptiness or
newlines, while the trailer it lands in is read and written as single lines. The row now states the
block extent, the declared normal form, and the narrow refusals, and a second row pins the
unrecordable-value messages and their exit `2`. Ratified by `dl-067`'s approve commit, whose `Reason:`
records the option chosen and the sub-decisions taken with it; edited in place without a supersede or
a state change, per `dl-047-tech-specs-carry-no-version-field` and the same `spec-001` precedent the
2026-09-17 revision cites.
