---
id: "task-098-align-the-cli-reference-and-specs-to-the-ratified-dna-grammar"
type: task
title: "Bring the approved CLI reference and the DNA specs onto `dl-082`'s grammar — correct the `dna set` row, add the three rows that were never written, and retire two claims that are no longer true"
status: in-review
release: "v0.2"
priority: "medium"
tags: ["v0.2", "dna", "cli", "docs"]
ref: "bug-090-dna-set-grammar-differs-across-three-artefacts"
bug: ["bug-090-dna-set-grammar-differs-across-three-artefacts"]
depends_on: ["task-093-dna-mutation-surface-add-remove-update"]
tmpl_version: 260703
---

## Description

`dl-082-cli-parameter-shape` is `ready`. The DNA surface it ratifies is described in four places and
none of them currently matches it. This task moves the documents; `task-093` moves the code, and this
task must land **after** it so both describe the same thing.

`docs/01_vision/X_cli-cmds.md` is **Version 1.2, Status: Approved**. Correcting it to match the
implementation inverts CLAUDE.md §10.1, under which the vision wins. That inversion is deliberate,
confined to this case, and its justification is written in `dl-082`'s Decision section — read it
before you edit, and do not extend it to anything else.

## Acceptance Criteria

**AC1 — the `dna set` row carries the ratified grammar.** `wingfoil dna set <path> --value <VALUE>`.
The row currently reads `dna set [--field FIELD] [--value VALUE]`.

**AC2 — the three missing rows exist.** The Pillar 2 table has no row for `dna add`, `dna remove` or
`dna update`, which have existed since `dl-081` and ship in `task-093`. Add them in `dl-082`'s
grammar, with actors, journeys and notes consistent with the neighbouring rows. `bug-090`'s
2026-09-24 note records why they were absent and why `P2.1` already authorises them — cite that
reasoning rather than re-deriving it.

**AC3 — the stale example goes.** `--field tech-stack.backend --value nodejs` names a schema
`spec-002` retired: `stacks.technologies` is a list of `{name, category, ...}` entries and there is no
`backend` key. Replace it with an example that resolves against the current schema, and verify it
resolves by running it.

**AC4 — the interactive claim is corrected, not deleted.** The row says "interactive or flag-based".
Measured: the global `--no-interactive` is read only by `src/cli/init-command.ts`, and no command but
`init` prompts. State what is true today. If the intention survives as unbuilt scope, say that
explicitly and name where it is tracked; do not leave a reader unable to tell an aspiration from a
description.

**AC5 — `spec-002` and `spec-008` agree with the reference.** Both describe the DNA path grammar.
Amend each under a dated Revision note in the form `task-093` used. If `task-093` has already brought
one of them onto the new grammar, say so and leave it alone rather than amending it twice.

**AC6 — the `--format` question is answered in writing, either way.** The reference attaches
`[--format json/yaml]` to nine rows across four pillars; the implementation registers it once on the
root program. `bug-090`'s note records this and explicitly leaves the decision to this pass. Either
correct those rows or state in the Execution Notes why they are out of scope — an unremarked
third option is not available.

**AC7 — the document's own version discipline.** `X_cli-cmds.md` is at Version 1.2. Bump it and update
its date per the `doc-versioning` directive, on the first edit after commit.

## Implementation Notes

- Documentation-only. There is no red to write; every AC is **characterization or verification** under
  `dl-014`/T1, and that is legitimate here. What replaces a failing test is *running the examples you
  write* — every command that appears in a corrected row must be executed against a throwaway
  `wingfoil init --template Scrum` repository and its output pasted into the Execution Notes. A row is
  not corrected because it looks right.
- `dl-075` is `ready`: durable citations name a symbol, heading, YAML key path or verbatim quotation
  plus the commit read at. Bare `path:line` offsets belong in Execution Notes only.
- Do not touch the BDD feature files. `bug-089` owns them and `task-100` does the work, sequenced
  after this one so the scenarios are written against the grammar this task records.

## Execution Notes

### T1 — per-AC classification (`dl-014`/T1, `testing` directive)

This is a documentation task. **There is no honest red anywhere in it**: every AC asserts something
about a document or about behaviour that already ships, so all seven are **characterization /
verification**, and fabricating a failing test to satisfy the letter of TDD would be exactly the
"dead code to force a red" the directive forbids. The substitute the task mandates is stricter and
was applied: **every command that appears in a corrected row was executed** against a throwaway
`wingfoil init --template Scrum` repository, and the command plus its output is pasted below. No row
was corrected because it looked right.

| AC  | Classification         | What replaced the red                                                                                              |
|-----|------------------------|--------------------------------------------------------------------------------------------------------------------|
| AC1 | characterization       | `dna set project.license --value MIT` executed; the old grammar's example executed and shown refusing               |
| AC2 | characterization       | `dna add` / `dna update` / `dna remove` each executed with the exact example the new row carries                    |
| AC3 | characterization       | `dna set tech-stack.backend --value nodejs` executed → exit `1`; the replacement examples executed → exit `0`       |
| AC4 | characterization       | missing-argument behaviour executed on `dna set` (×2) and `memory add`; `--interactive` readers grepped in `src/`   |
| AC5 | verification (no edit) | both specs re-read at `4a6b5846`; `task-093` had already amended them — evidence below, neither touched             |
| AC6 | characterization       | both `--format` placements executed on four commands; subcommand `--help` read; `spec-008` §2 re-read               |
| AC7 | editorial              | `Version: 1.2 → 1.3`, `Date: 2026-07-02 → 2026-09-24`, first edit after commit (`doc-versioning`)                   |

### Environment

Built from this branch after merging `main` (`bfd1b2a0`): `npm ci && npm run build`, `node dist/cli.js
--version` → `0.1.0`. Throwaway repository: a fresh `git init` with one commit, then `wingfoil init
--template Scrum` (exit `0`, 27 files, commit `chore(wingfoil): initialize .wingfoil/ with the Scrum
template (P5.1.1)`). Every invocation below ran with stdin at `/dev/null`, i.e. not on a TTY.

### AC1–AC3 — the corrected Pillar 2 rows, executed

```
$ wingfoil dna set project.license --value MIT
{ "key": "project.license", "value": "MIT" }                                        exit=0

$ wingfoil dna add stacks.technologies --value TypeScript --entry-category language
{ "key": "stacks.technologies", "value": "TypeScript" }                             exit=0

$ wingfoil dna update stacks.technologies --value TypeScript --entry-version 5.9
{ "key": "stacks.technologies", "value": "TypeScript" }                             exit=0

$ wingfoil dna remove stacks.technologies --value TypeScript
{ "key": "stacks.technologies", "value": "TypeScript" }                             exit=0

$ wingfoil dna add modules --value core --entry-path src
{ "key": "modules", "value": "core" }                                               exit=0

$ wingfoil dna update modules.core.path --value src/core
{ "key": "modules.core.path", "value": "src/core" }                                 exit=0
```

State after the `add`/`update` pair, read back rather than assumed:

```
$ wingfoil dna show modules
[ { "name": "core", "path": "src/core" } ]                                          exit=0
```

And the sections the `dna show [SECTION]` row lists, each executed:

```
$ wingfoil dna show version    → 1                                                  exit=0
$ wingfoil dna show project    → { "name": "", "description": "", "license": "MIT", "methodology": "Scrum" }   exit=0
$ wingfoil dna show stacks     → { "technologies": [], "methodologies": [ {...Scrum}, {...BDD}, {...TDD} ] }   exit=0
$ wingfoil dna show team       → { "members": [], "roles": [ developer … approver ] }                          exit=0
$ wingfoil dna show paths      → { "sources": ["src/**","lib/**"], "tests": [], … }                            exit=0
```

`--value`'s comma-separated list form, claimed in the `--value` parameter row, executed:

```
$ wingfoil dna add paths.sources --value "src/**,lib/**"
{ "key": "paths.sources", "value": "src/**,lib/**" }                                exit=0
# read back: paths.sources == [ "src/**", "lib/**" ]  — two entries, not one string
```

Each write made its own commit, which is why the `dna set` row now says so:

```
$ git log --oneline
2856b3c wf(dna): update modules.core.path src/core
1871864 wf(dna): add modules core
07de93a wf(dna): remove stacks.technologies TypeScript
9c7b262 wf(dna): update stacks.technologies TypeScript
f1dd286 wf(dna): add stacks.technologies TypeScript
eea1908 wf(dna): set project.license
b1f8dd7 chore(wingfoil): initialize .wingfoil/ with the Scrum template (P5.1.1)
```

**The refusals the corrected rows cite**, also executed rather than inferred:

```
$ wingfoil dna set tech-stack.backend --value nodejs        # the v1.2 example (AC3)
error: unknown DNA field 'tech-stack.backend': 'tech-stack' is not declared under the dna.yaml schema   exit=1

$ wingfoil dna show stacks.technologies                     # `dna show` takes a section, not a path
error: no DNA key named 'stacks.technologies'                                       exit=1

$ wingfoil dna show --section project                       # the v1.2 `dna show` grammar
error: unknown option '--section'
(Did you mean --version?)                                                           exit=1
```

So the v1.2 Pillar 2 table specified two grammars that no build accepts (`dna set --field …`,
`dna show --section …`) and one example that the schema refuses. That is the state AC1/AC3 describe,
measured, not recalled.

### AC4 — the "interactive or flag-based" claim

Measured two ways.

*Source.* `--no-interactive` is declared once and read once:

```
$ grep -rn "noInteractive\|no-interactive" src/
src/cli/program.ts:77:    .option('--no-interactive', 'fail on missing args instead of prompting');
src/cli/init-command.ts:32:  /** The negatable global `--interactive` … */

$ grep -rn "isTTY" src/
src/cli/program.ts:100:        { root, isTTY: Boolean(process.stdout.isTTY), prompt: createReadlinePrompt() },
src/cli/init-command.ts:43:  readonly isTTY: boolean;
src/cli/init-command.ts:73:  if (!options.interactive || !deps.isTTY) {
```

`program.ts`'s single `createReadlinePrompt()` call site is the `init` handler. No other command is
given a prompt or a TTY flag, so **the behaviour does not depend on being on a TTY** — the
non-`init` commands have no prompt branch at all.

*Behaviour.*

```
$ wingfoil dna set
error: missing required argument: wingfoil dna set <path> --value <value>            exit=2

$ wingfoil dna set project.license
error: missing required argument: --value                                            exit=2

$ wingfoil memory add
error: missing required argument: --type                                             exit=2
```

The intention **survives as specified scope**, so it was corrected rather than deleted, as AC4
requires: `spec-008-cli-grammar` §4 ("Interactive-prompt rules") still specifies, for every command,
"Required arg missing, stdout is a TTY, `--interactive` (default) → Readline prompt for each missing
arg", and §2 still declares `--interactive` as a negatable global. The reference now says both things
and labels which is which — in the Pillar 2 note, and in the "Interactive mode" bullet under
Command-Line Syntax Conventions, which stated the same claim generally and gave `wingfoil memory add`
as its example. That bullet's two shipped lines were executed above.

### AC5 — `spec-002` and `spec-008` were already amended by `task-093`; neither was touched

Read at `4a6b5846` (the merge of `task-093`). **Both already carry the `dl-082` grammar under a dated
Revision note, so amending them again would have been a second, redundant amendment** — which is
precisely what AC5 says to avoid.

- `spec-002-dna-yaml-schema` — "**Revision (2026-09-24) — the write-path examples are respelled to
  `dl-082-cli-parameter-shape`'s grammar.**" Its three write-path invocations now read
  `dna update team.members.roberto.roles --value …`, `dna set nonsense.at.any.depth --value v` and
  `dna set tech_stack.<key> --value <v>` — positional path, `--value` option, as ratified.
- `spec-008-cli-grammar` — "**Revision (2026-09-24) — §9 is rewritten to `dl-082-cli-parameter-shape`'s
  grammar, and its unprefixed-option claim is corrected.**" §9 is titled "DNA field paths (`<path>` /
  `--value`)" and its eight worked invocations are all positional-path.

Checked for residue rather than assumed: `grep -rn -- "--field"` over both specs returns six lines,
every one of them *narrating* the change or quoting an invocation measured before it — `"the path in
a --field option; dl-082 amended that one point and left its semantics untouched"`, and the Revision
notes themselves. **No live invocation in either spec still uses `--field`.** The only live `--field`
left anywhere under `docs/` was `X_cli-cmds.md`'s `dna set` row, which this task removed; the one
occurrence that remains in that file is the new Revision history quoting the v1.2 spelling it
replaced.

`spec-006-core-domain-api` was checked too (not named by AC5): its `dnaAdd`/`dnaRemove`/`dnaUpdate`
rows and its 2026-09-24 prose correction are already on the new grammar. Nothing to do there either.

The reference's new Pillar 2 rows were written *from* `spec-008` §9 and then executed, so the three
documents now say the same thing and the sentence each of them says has been run.

### AC6 — the `--format` rows: **not corrected, and here is the measurement that decides it**

The task forbids leaving this unremarked, so: **the nine `[--format json/yaml]` row annotations are
left as they are.** The reason is not "out of scope by assertion" — it is that the premise recorded in
`bug-090`'s 2026-09-24 note is narrower than what the build does.

That note says `--format` is registered once on the root program, "so `wingfoil --format json memory
search foo` is the shape that works". The first half is true; the second half implies the trailing
placement does not work. It does:

```
$ wingfoil --format json dna show project
{"name":"","description":"","license":"MIT","methodology":"Scrum"}                   exit=0
$ wingfoil dna show project --format json
{"name":"","description":"","license":"MIT","methodology":"Scrum"}                   exit=0

$ wingfoil memory search foo --format json
{"query":"foo","matches":[],"message":"no documents matched the query"}              exit=0
$ wingfoil paths config --format json
{"category":"config","paths":[".wingfoil"]}                                          exit=0
```

Commander does not enable positional options, so a root-declared option is accepted after the
subcommand as well as before it. **So the row annotations are not false about what a user may type** —
`memory search [keyword] … [--format json/yaml]` is a usage string that works verbatim. Three further
reasons against carrying them in this pass:

1. `spec-008-cli-grammar` §2 already rules on the declaration site, in the implementation's favour and
   against a per-command declaration: "the flag is registered globally so every command honours it
   uniformly (REQ-SYS-05)". There is nothing left to decide, and nothing in the reference contradicts
   it once one knows that.
2. Six of the ten rows carrying `--format` belong to commands that **do not exist** (`memory import`,
   `dna infer`, `workflow status`, `workflow next`, `workflow show`, `agent execute`). Editing their
   signatures asserts a future grammar, which is exactly what `dl-082` E3 declined to re-decide
   ("it is **not** re-decided here").
3. `bug-090` is about one command's grammar; `dl-082` E3 warns that absorbing a ten-row, four-pillar
   change here "would silently widen the ruling".

**What is genuinely wrong survives as a residue**, and is proposed as its own element rather than
buried here: a subcommand's `--help` does not list `--format`, so the one place a user looks for a
command's options omits an option that command accepts:

```
$ wingfoil memory search --help
Options:
  --tag <value>     tag value
  --status <value>  status value
  --type <value>    type value
  -h, --help        display help for command
```

### AC7 — version discipline

`X_cli-cmds.md` was at `**Version:** 1.2` / `**Date:** 2026-07-02`, last committed long before this
branch, so this is the first edit after commit: bumped to `**Version:** 1.3` / `**Date:** 2026-09-24`
per the `doc-versioning` directive. `**Status:** Approved` is left as it is — `dl-082` sanctions
correcting the document, not demoting it.

A `## Revision history` section was added at the end of the file recording what changed and, in its
own paragraph, **why an Approved vision document was corrected to match the implementation** — with
the confinement `dl-082` attaches to it, in the document itself, so a reader who never opens `dl-082`
cannot mistake this for a general precedent.

### Edits beyond the literal ACs, and why

Three, all inside the ruling `dl-082` Action 3 states ("Correct `docs/01_vision/X_cli-cmds.md` … to
the adopted grammar"), each measured above:

1. **The `dna show` row** was respelled `dna show [SECTION]`. No AC names it, but `dl-082`'s Decision
   block lists `wingfoil dna show [<section>]` in the adopted grammar and E1 marks the row as one of
   the two that disagree. `dna show --section project` exits `1`. Leaving it would have shipped a
   corrected row beside a measurably false one in the same table.
2. **The Pillar 2 Philosophy paragraph and the `SECTION`/`FIELD` parameter rows** named `tech-stack`
   and `conventions`. `spec-002` renamed the first and removed the second; `dna show tech-stack` and
   `dna show conventions` both exit `1`. This is the same staleness AC3 names, in the same section.
3. **The "Interactive mode" and "Required vs. optional arguments" bullets** under Command-Line Syntax
   Conventions — see AC4. The bullet's own example (`wingfoil memory add`) was the thing measured. The
   notation half of the second bullet had to be reconciled because the new Pillar 2 rows use `<PATH>`
   while the rest of the document brackets a required positional; the bullet now states the
   convention and says plainly which rows do not yet follow it, rather than silently contradicting
   itself. `memory approve [document-id]` was executed to confirm the id really is required:
   `wingfoil memory approve` → `error: missing required argument: memory approve <id>`, exit `2`.

The `Release Timeline by Command` section gained a Pillar 2 line for v0.2 and the "State and commits"
bullet gained the three new write verbs — without them the document would list three commands with no
release and describe a set of state-changing commands that is now incomplete.

**Deliberately left alone**, each proposed as an element instead: the *Sync Process* paragraphs in
Pillars 2/3/4, the `--dry-run` row under Global Options, the `--format` annotations (AC6), and the
`(interactive or flag-based)` phrase on the Pillar 3 `directive create` and Pillar 4 `workflow create`
rows. The BDD feature files were not touched: `bug-089` owns them and `task-100` rewrites them after
this task, so the scenarios are written once against the grammar recorded here.

### Gates — run on this branch after merging `main` (`bfd1b2a0`)

| Gate | Command | Result |
|---|---|---|
| unit + BDD | `npx jest` | **129 suites / 2125 tests, all passing** |
| coverage | `npx jest --coverage` | **98.54 % statements**, 93.75 branches, 98.90 functions, 99.38 lines — ≥ 80, non-regressing |
| build typecheck | `npx tsc -p tsconfig.build.json --noEmit` | 0 errors |
| **emitting build** | `npx tsc -p tsconfig.build.json` | 0 errors |
| full typecheck (incl. `test/**`) | `npx tsc --noEmit -p tsconfig.json` | **0 errors, no exception** (`bug-026` stays closed) |
| lint | `npm run lint` | 0 problems |
| API docs | `npm run docs:api` | 0 errors |

`main` was merged into this branch before the gates ran (`f3b34044`); the merge brought only
`docs/` changes, so no barrel or import line in `src/` was touched by it. **This task changes no file
under `src/` or `test/`** — the diff is one vision document plus this Memory file — so it cannot
produce the semantic-merge hazard the wave brief warns about.

### Proposed elements (measured here, out of this task's scope — the orchestrator files them)

1. **bug — unknown command and unknown option exit `1`, where `spec-005` §1 mandates `2`.**
   `spec-005-cli-command-contract` §1's exit-code table reserves `2` for "unknown command/pillar/verb,
   unknown flag, missing required argument, invalid flag value". Measured on this build:
   `wingfoil nosuchpillar`, `wingfoil dna nosuchverb`, `wingfoil dna infer`, `wingfoil dna show
   --section project` and `wingfoil dna set project.license --value MIT --nosuchflag x` all print the
   right message and exit **`1`**. Only the invalid-flag-value case is conformant
   (`wingfoil --format nosuchformat dna show project` → exit `2`). Missing required argument is
   conformant too (exit `2`). So Commander's own parse errors are the ones falling through to the
   wrong code. `task-012`'s notes record `unknown-command → 2` as deferred to "their owning tasks";
   nothing appears to own it.

2. **bug — a subcommand's `--help` does not list `--format`.** The residue of AC6. `--format` is
   registered on the root program (`spec-008` §2, deliberately), is honoured by every subcommand, and
   is accepted in trailing position — but `wingfoil memory search --help` lists only `--tag`,
   `--status`, `--type`, so the one place a user looks for a command's options omits one it accepts.
   Commander can be told to show global options in subcommand help. Decide and record, rather than
   leaving `X_cli-cmds.md`'s nine `[--format json/yaml]` annotations reading as a competing
   declaration.

3. **bug — `X_cli-cmds.md` Global Options declares `--dry-run`, which neither the build nor
   `spec-008` §2 has.** `wingfoil --dry-run dna show project` → `error: unknown option '--dry-run'`,
   exit `1`. `spec-008` §2's global-flag table lists `--help`, `--version`, `--format`, `--reason`,
   `--verbose`, `--color`, `--interactive` — no `--dry-run`. `spec-005` §1 mentions it only
   hypothetically ("a command that adds a `--dry-run` mode"). Left untouched here because it is a
   Global Options question spanning every pillar, not a Pillar 2 grammar question.

4. **bug — the DNA *Sync Process* paragraphs describe unbuilt behaviour and name a retired key.**
   `X_cli-cmds.md` Pillar 3 ("When `wingfoil dna set` updates `tech-stack` or `methodology`, WingFoil
   automatically: installs new built-in directives … removes directives … updates role→directive
   assignments"), Pillar 4 ("When `wingfoil dna set methodology` updates …") and the Pillar 2
   Philosophy sentence retained above all state a synchronisation that nothing implements, using the
   `tech-stack` key `spec-002` renamed to `stacks`. Same family as AC3/AC4 — a retired schema name and
   an aspiration written as a description — but in pillars this task does not own.

5. **bug — `(interactive or flag-based)` survives on the Pillar 3 `directive create` and Pillar 4
   `workflow create` rows.** Exactly the AC4 claim, one pillar over. Measured:
   `wingfoil workflow --help` lists `list` as its only subcommand, so `workflow create` is not built
   at all; `wingfoil directive create` is built and exits `2` with
   `error: missing required argument: --name` rather than prompting. AC4 scoped me to the DNA row and
   the general conventions bullet; these two rows were left so that a reviewer sees the boundary
   rather than an unexplained partial sweep.

6. **decision-log — `bug-092`'s `set`/`update` overlap now has a documentation cost as well.** With
   both verbs spelled `<path> --value <v>`, the reference carries two rows a reader cannot choose
   between from the rows alone: `dna set` is `dna update` restricted to a scalar. `bug-092` already
   records the behavioural half (`dl-082` E4, Action 5). Worth noting that whichever way it is
   resolved — alias, deprecation, or keeping `set` as a scalar-only convenience — `X_cli-cmds.md`
   Pillar 2 changes again, and this pass wrote the rows so that either outcome is a small edit.
