---
id: "dl-082-cli-parameter-shape"
type: decision-log
title: "The CLI already states parameters one way — positional for the target, option for its attributes — and the DNA surface is the only place that disagrees"
status: in-discussion
context: "architecture"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`bug-090` asked which of three grammars `dna set` should have: the positional form it ships, the
`--field`/`--value` form the approved vision reference has specified since v1.2, or something else.
Answering it turned out to require naming a rule that **no document states**, although nine of the
eleven `dna`/`memory` commands already follow it.

`dl-081` ratified `dna add|remove|update --field <path> --value <v>` on 2026-09-23 without that rule
in view — it reasoned from Memory's `memory add --type adr --title "..."`, which is a correct
observation about *attributes* generalised to a *target*. This document names the rule, and applies
it.

## Evidence

### E1 — the two surfaces, measured rather than recalled

The vision reference is `docs/01_vision/X_cli-cmds.md` (Version 1.2, Status: Approved). The
implementation column is the compiled CLI's own `--help`, run at `c2102c87`, not a reading of the
source.

| Vision | Implementation | |
|---|---|---|
| `memory add [--type TYPE] [--title "t"] [--tags "a,b"]` | `memory add --type <v> --title <v> [--tags <v>]` | agrees |
| `memory search [keyword] [--type] [--status] [--format]` | `memory search [keyword] [--tag] [--status] [--type]` | agrees (`--tag` is an undocumented addition) |
| `memory submit [document-id] [--notes "t"]` | `memory submit [id]` | agrees; `--notes` not built |
| `memory approve [document-id] [--reason]` | `memory approve [id] --reason <v>` | agrees |
| `memory reject [document-id] [--reason]` | `memory reject [id] --reason <v>` | agrees |
| `memory deprecate [document-id] [--reason]` | `memory deprecate [id] [--reason]` | agrees |
| `memory history [document-id] [--format]` | `memory history [id]` | agrees |
| `memory import [path] [--action copy/move/link]` | not built (`spec-006`: *planned*) | — |
| `paths [category] [--format]` | `paths [category] [--list]` | agrees |
| `dna show [--section SECTION] [--format]` | `dna show [section]` | **disagrees** — option in the vision, positional in the code |
| `dna set [--field FIELD] [--value VALUE]` | `dna set <key> <value>` | **disagrees** — option pair in the vision, positional pair in the code |
| `dna infer [--confirm]` | not built (`spec-006`: *planned*) | — |

### E2 — the rule the agreeing rows follow

In every row that agrees, the split is the same: **a positional carries the identity of the thing the
command acts on** — a document id, a category, a search keyword — and **an option carries a named
attribute of the action** — `--type`, `--title`, `--tags`, `--reason`, `--status`. Nine commands, no
exceptions.

Both disagreeing rows are DNA, and they disagree in *opposite* directions: `dna show` puts the target
in a positional where the vision asked for an option, and `dna set` puts an attribute in a positional
where the vision asked for an option. `dna show` happens to match the rule; `dna set` does not,
because its **second** positional — the value — is an attribute wearing a positional's clothes.

`dl-081`'s `--field <path>` is the third exception, and the only one not yet shipped: it puts the
target in an option.

### E3 — `--format` is declared per-command and implemented once

The vision reference attaches `[--format json/yaml]` to nine rows across four pillars. The
implementation registers it once on the root program, next to `--verbose`, `--no-color` and
`--no-interactive`; no subcommand declares one. This is drift of the same family, recorded in
`bug-090`, and it is **not** re-decided here: one global declaration is the better shape, it cannot
drift row by row, and `task-093` has since shown that a root option silently swallows a subcommand
option of the same name — so `--format` is also one of the names that must never be derivable from
the DNA schema.

### E4 — `dna set` and `dna update` are already the same command

Measured on `task-093`'s build in a throwaway `wingfoil init` repository, against the same leaf:

```
$ wingfoil dna update --field project.license --value MIT
{ "key": "project.license", "value": "MIT" }        exit 0
$ wingfoil dna set project.license Apache-2.0
{ "key": "project.license", "value": "Apache-2.0" } exit 0
```

Both write `project.license`. The grammars differ, so the redundancy is currently invisible; aligning
them makes the two verbs identical in spelling as well as effect. This is a **consequence** of the
decision below, not an argument against it — it exposes an overlap that already exists.

## Decision

**A CLI parameter is positional when it identifies the target of the command, and an option when it
names an attribute of the action.** This is the rule nine commands already follow; it is stated here
so that the next command does not have to rediscover it, and so that a reviewer has something to
check a new grammar against.

Applied to the DNA surface, which is where every exception lives:

```
wingfoil dna set    <path> --value <v>
wingfoil dna show   [<section>]
wingfoil dna add    <path> --value <v> [--entry-<field> <v> ...]
wingfoil dna remove <path> --value <v>
wingfoil dna update <path> --value <v>
```

Three changes follow, and nothing else moves:

1. **`dna set`'s second positional becomes `--value`.** The key stays positional; the value was the
   attribute in positional clothing.
2. **`dl-081`'s `--field <path>` becomes a positional `<path>`** on all three new verbs. The path is
   the target; `--value` and the `--entry-<field>` options are attributes and stay options.
   Everything else `dl-081` ratified — entries addressed by name, a path that does not resolve is
   refused rather than created, name uniqueness as a prerequisite — is untouched.
3. **The vision reference is corrected** to the resulting grammar, together with the stale
   `tech-stack.backend` example (`stacks.technologies` is a list; there is no `backend` key), and the
   `interactive or flag-based` claim, which is true of `init` alone — no other command prompts, and
   the global `--no-interactive` is read only by `src/cli/init-command.ts`.

On (3): correcting an **Approved** vision document to match the implementation inverts CLAUDE.md
section 10.1, under which `docs/01_vision/` wins. That inversion is deliberate and is limited to this
case. What makes it legitimate is that the vision row is not describing an unbuilt intention — it is
describing a *grammar*, one of three, against a schema (`tech-stack.backend`) the project retired in
`spec-002`, and the shape it names is not the one this decision adopts either. No layer is being
overruled by the code; all three layers are being moved to a rule none of them stated.

## Rationale

The alternative was to leave `dna set` positional and let the three new verbs keep `--field`. It was
declined because it makes the difference between two commands that take a path and a value depend on
nothing a user can see: `dna set project.license MIT` beside
`dna add --field team.members --value roberto` is two spellings of one idea, and a reader has no way
to derive which applies where. `dl-081` chose its shape by analogy with `memory add --type`, which is
sound for `--type` — a *kind*, an attribute — and unsound for a target, because Memory's own verbs
put the target in a positional (`memory approve <id> --reason`), which is exactly the half of the
analogy that was not carried across.

Stating the rule rather than fixing the three commands is the point. The commands are a day's work;
the rule is what stops the fourth exception. `dl-081` was ratified two days ago by people looking
directly at this question and still produced an exception, because the rule existed only as a pattern
in nine unrelated files.

**The cost is a breaking change to a shipped command.** `dna set <key> <value>` has been in
`CORE_MODULES` since `task-025` and is exercised by `P2.1-dna-set.feature`. The project is pre-1.0
and `minor-v0.2` has not been published, so the change lands before any user has it — but it must
appear in `CHANGELOG.md`, which the `user-docs` phase owns, and `bug-089`'s BDD rewrite must use the
new spelling rather than the current one.

**What this decision does not settle:** E4 shows `dna set` and `dna update` writing the same leaf
through two spellings that alignment makes identical. Whether `set` survives as a scalar-only
convenience, becomes an alias, or is deprecated in favour of `update` is a separate question, and
deciding it inside a grammar decision would bury it.

## Actions

1. Amend `dl-081` in place, dated, to replace `--field <path>` with a positional `<path>` — the
   ratified substance is unchanged, so this is an amendment rather than a superseding decision.
2. Rework `task-093` to the positional form before it lands, rather than shipping `--field` and
   changing it in a follow-up. It is in review; the grammar is the smaller part of its diff.
3. Correct `docs/01_vision/X_cli-cmds.md`, `spec-002` and `spec-008` to the adopted grammar, closing
   `bug-090`. Decide in the same pass whether the `--format` rows (E3) travel with it, and say which.
4. Sequence `bug-089`'s BDD rewrite after (3), so the scenarios are written once.
5. File the `set`/`update` overlap (E4) as its own element; it is out of scope here.

## Relations

- Amends `dl-081-dna-mutation-surface-shape` (ready) — the grammar only.
- Closes `bug-090-dna-set-grammar-differs-across-three-artefacts`.
- Blocks `bug-089-p2-1-bdd-scenarios-contradict-the-ratified-write-rule` (the spelling it must use).
- Constrains `task-093-dna-mutation-surface-add-remove-update` (in review at the time of writing).
