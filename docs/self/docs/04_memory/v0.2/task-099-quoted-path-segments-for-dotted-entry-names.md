---
id: "task-099-quoted-path-segments-for-dotted-entry-names"
type: task
title: "Implement `dl-083`'s quoted path segments so an entry named `Node.js` is addressable, and make the three dotted names already in `dna.yaml` a permanent part of the test corpus"
status: in-progress
release: "v0.2"
priority: "medium"
tags: ["v0.2", "dna", "cli"]
ref: "dl-083-dotted-entry-names-in-paths"
bug: ["bug-091-entry-names-containing-a-dot-are-unaddressable"]
depends_on: ["task-093-dna-mutation-surface-add-remove-update"]
tmpl_version: 260703
---

## Description

`dl-081` made an entry's `name` the key it is addressed by, which made two properties of `name`
load-bearing: uniqueness, and expressibility inside a dotted path. `task-093` implemented the first.
`dl-083` settles the second: a path segment may be double-quoted, and a quoted segment is taken
verbatim, dots included.

```
wingfoil dna update 'stacks.technologies."Node.js".version' --value 22.14+
```

This is sequenced after `task-093` because it edits `src/dna/path.ts`, which that task creates and is
still changing. Read its Execution Notes before starting (`dl-015`).

## Acceptance Criteria

**AC1 — a quoted segment resolves, dots and all.** `stacks.technologies."Node.js".version` addresses
the entry named `Node.js`. Read paths and write paths behave identically; there is one parser.

**AC2 — the delimiters are not part of the name.** A quoted segment begins and ends with `"`; the
quotes are stripped before the name is matched. Quoting a segment with no dot is legal and means the
same as not quoting it — `team."roberto".roles` and `team.roberto.roles` resolve to one place.

**AC3 — an unterminated quote is a usage error at exit 2**, not a name beginning with `"`.
`spec-005` §1 governs the code; do not invent a third outcome.

**AC4 — a quoted segment may not contain `"`, and that is final.** There is no escape sequence.
`dl-083` accepts the consequence deliberately. Refuse it, with a message that says the name is
unaddressable rather than that the path is malformed.

**AC5 — `--value` is untouched.** It carries an entry's identity directly and never needs WingFoil
quoting: `dna remove stacks.technologies --value "Node.js"` quotes for the shell only. Pin this, since
it is the thing a reader will get wrong.

**AC6 — the three live dotted names enter the test corpus.** `docs/self/.wingfoil/dna.yaml` carries
`Node.js`, `Commander.js` and `AI agent (Claude/Cursor/etc.)`. Build a fixture containing all three
and assert each is addressable. This is the test that makes a future dot-ban impossible to add
silently, which is the point of `dl-083`'s Action 4.

**AC7 — no dot constraint is added to the schema.** `uniquelyNamed` stays; nothing joins it. If you
find yourself tempted, `bug-091`'s Correction explains what that would break.

**AC8 — the grammar is recorded.** `spec-008` gains the quoting rule; `spec-002` gains it where the
path form is described. Dated Revision notes, the shape `task-093` used.

## Implementation Notes

- AC1–AC4 are **red-first** under `dl-014`/T1 — none of this behaviour exists. AC5 and AC7 are
  **characterization**: they pin what is already true so it cannot quietly stop being true.
- The shell/WingFoil quoting overlap will confuse a reader: the outer single quotes in the example are
  the shell's and the inner double quotes are WingFoil's. Say so wherever you document it.
- `dl-082` moved the path from `--field` into a positional. The quoting rule is identical either way,
  but write your examples in the grammar `task-093` actually shipped, not in `dl-081`'s.

## Execution Notes

### design — role: architect

**Baseline.** Worktree `/home/robypomper/Workspaces/.wf2-wt/task-099`, branch
`task/task-099-quoted-path-segments-for-dotted-entry-names`, from `main` at `4a6b5846`. `npm ci` then
`npx jest` before any change: **129 suites / 2125 tests passed**.

#### read_related (`dl-015`, HARD gate)

- **`task-093-dna-mutation-surface-add-remove-update`** — the one `depends_on`, `done` and merged at
  `4a6b5846`. Its Execution Notes carry a section titled *"`dl-083`'s seam, left rather than built"*,
  read at that commit, which names the three `split('.')` call sites this task has to unify —
  `isValidKeyPath` and `setDnaValueInText`'s resolver (`src/dna/set.ts`), `resolveDnaPath`
  (`src/dna/path.ts`) — and prescribes the shape: *"a `splitDnaPath(keyPath)` in `src/dna/set.ts`
  returning segments or a refusal, with all three calling it"*. It deliberately did not build it
  ("adding the function now with one caller would be dead code"). That is what this task builds, in
  the file that note names.
  - **Why `src/dna/set.ts` and not `src/dna/path.ts`**, which is the file `dl-083` Action 1 names.
    `src/dna/path.ts` already imports `isValidKeyPath` **from** `src/dna/set.ts`
    (`import { isValidKeyPath } from './set';`), so a parser in `path.ts` would have to be imported
    back by `set.ts` and the two modules would import each other. `dl-083` Action 1's parenthetical is
    a locator written before `task-093` landed; the dependency's own hand-off note is the later and
    better-informed statement, and it is followed. The parser is re-exported from `src/dna/index.ts`,
    so the pillar's public surface is the same either way.
- **`dl-083-dotted-entry-names-in-paths`** (`ready`) — the decision implemented, read in full
  including its Rationale: the two declined alternatives (a dot ban; index addressing) and the two
  accepted costs (no escape sequence; a parsing rule in `spec-008`'s grammar).
- **`bug-091-entry-names-containing-a-dot-are-unaddressable`** (`planned` → `in-progress` here) — and
  in particular its **Correction (2026-09-24)**, which is what makes AC7 a refusal rather than an
  omission: `uniquelyNamed` is attached inside `DnaYaml`, so it runs on every `loadDnaYaml`, and a dot
  refinement added the same way would reject this repository's own `dna.yaml` **on read**.
- **`dl-082-cli-parameter-shape`** (`ready`) and **`dl-081-dna-mutation-surface-shape`** (`ready`) —
  read for the grammar the examples must be written in: `dna set <path> --value <v>` /
  `dna add|remove|update <path> --value <v>`, the path a positional and the only one the verb reads.

#### The measurement that fixes AC1–AC4 as red-first

Run against `dist/` built from `4a6b5846` (the branch point), on an in-memory schema-valid document
carrying the three real dotted names:

```
$ node -e "const {resolveDnaPath}=require('./dist/dna/path'); …"
"stacks.technologies.\"Node.js\".version"        => REFUSED: no entry named '"Node' in 'stacks.technologies' (path …)
"stacks.technologies.Node.js.version"            => REFUSED: no entry named 'Node' in 'stacks.technologies' (path …)
"team.agents.\"AI agent (Claude/Cursor/etc.)\""  => REFUSED: no entry named '"AI agent (Claude/Cursor/etc' in 'team.agents' (path …)
"team.\"members\".roberto.roles"                 => REFUSED: unknown DNA field …: '"members"' is not declared under 'team'
```

Two things this settles rather than assumes. The quote is **not** stripped today — it is taken as part
of the name, which is exactly the outcome AC3 forbids for the unterminated case and AC2 forbids for
the terminated one. And the three live names are unreachable by *any* spelling, quoted or bare, which
is `bug-091`'s Actual Behavior reproduced at the resolver rather than at the CLI.

#### Per-AC T1 classification (`dl-014`/T1)

| AC | Class | Why |
|---|---|---|
| AC1 quoted segment resolves | **red-first** | measured above: refused at `4a6b5846`. |
| AC2 delimiters are not part of the name | **red-first** | `team."members".roberto.roles` refuses at `4a6b5846`. |
| AC3 unterminated quote → exit 2 | **red-first** | today `."Node` is a *name* starting with `"`, refused at exit 1 by the resolver, never as a usage error. |
| AC4 `"` inside a quoted segment refused as unaddressable | **red-first** | no such refusal exists; there is no code path that mentions a quote. |
| AC5 `--value` is untouched | **characterization** | `test/core/dna-mutation-surface.test.ts` already adds an entry named `Node.js` through `--value`; the new test pins `remove`/`update` on a *dotted* name through `--value` alone, which nothing covered. |
| AC6 the three live names in the corpus | **red-first** | the fixture resolves nothing today (measured above); it is the test `dl-083` Action 3 asks for. |
| AC7 no dot constraint in the schema | **characterization** | `uniquelyNamed` is the only per-collection refinement today; the test pins that a document carrying the three names *loads*, so adding a dot ban goes red on read. |

#### Design — what changes, and where

1. **`src/dna/set.ts`** gains `splitDnaPath(keyPath)` → `{ ok: true, segments }` | `{ ok: false, message }`,
   and `quoteDnaSegment(name)` (the inverse, for error messages). `isValidKeyPath` becomes
   `splitDnaPath(...).ok` — the predicate is kept because `setDnaValueInText` and the schema of the
   existing call sites read better as a boolean, and because removing an exported symbol is a
   breaking change this task has no reason to make.
2. **`src/dna/path.ts`** — `resolveDnaPath` splits through `splitDnaPath`, and `prefixOf` re-quotes a
   segment containing a dot so a refusal names a path that can be copied back into the shell.
3. **`src/core/index.ts`** — `dnaPathPositional` throws the parser's own message instead of a flat
   `invalid key path`, so AC3's and AC4's messages reach exit 2. This is the one line of a
   **shared, contended file** this task touches: its `import { DNA_KEY_ALIASES, isValidKeyPath } from '../dna/set';`
   becomes `import { DNA_KEY_ALIASES, splitDnaPath } from '../dna/set';`. Flagged for the merge, per
   the wave brief.
4. **`src/dna/index.ts`** — re-export the two new symbols (the pillar barrel is the public surface).
5. **Docs** — `spec-008` §9 gains the quoting rule and a dated Revision; `spec-002` gains one where the
   path form is described (its *Unknown keys* section) plus a dated Revision.

**The grammar the parser implements**, stated once so the tests and the specs cannot drift:

- a segment that **begins** with `"` is quoted and ends at the **next** `"`; the delimiters are dropped
  and every character between them, `.` included, is part of the name;
- the closing `"` must be followed by `.` or by end-of-path;
- a segment that does not begin with `"` ends at the next `.`, and may not contain `"`;
- an empty segment, quoted or not, is `invalid key path: '<path>'` — the message
  `P2.1-dna-set.feature` scenario 3 pins for `..language`, unchanged;
- a `"` that opens a segment and never closes is **unterminated** (AC3);
- a `"` anywhere else means the name the author is reaching for contains a `"`, which has no spelling
  (AC4) — refused as *unaddressable*, not as *malformed*.

All three refusals are usage errors at **exit 2** (`spec-005` §1): they are properties of how the
argument is spelled, decided before anything is read, which is the same family as `..language`. AC3
pins 2 explicitly; AC4 leaves the code open and inherits it rather than inventing a third outcome.

**Not in scope, and deliberately not built.** `dna show` takes a **top-level section name**, not a
dotted path (`src/core/index.ts`, `dnaShowFn`: `const key = DNA_KEY_ALIASES[section] ?? section; if (!(key in dna))`),
so `dna show 'stacks.technologies."Commander.js"'` — one of `dl-083`'s own Decision examples — cannot
work, and quoting is not what is missing from it. Proposed as a separate element rather than widened
into here, where it would be a new read surface with its own refusal rules.
