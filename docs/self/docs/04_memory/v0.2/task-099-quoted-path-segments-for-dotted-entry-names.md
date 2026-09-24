---
id: "task-099-quoted-path-segments-for-dotted-entry-names"
type: task
title: "Implement `dl-083`'s quoted path segments so an entry named `Node.js` is addressable, and make the three dotted names already in `dna.yaml` a permanent part of the test corpus"
status: approved
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

### red — role: developer

Two suites, written before any `src/` change, committed as the red:

- **`test/dna/path-quoting.test.ts`** — the grammar at the parser and the resolver (AC1–AC4, AC6,
  AC7), on a fixture transcribed from `docs/self/.wingfoil/dna.yaml` at commit `3a350aa6` carrying all
  three live dotted names.
- **`test/core/dna-quoted-path-segments.test.ts`** — the same grammar through the **real registered**
  `dna.set/add/remove/update` `CoreFn`s in a throwaway temp git repo: a write on `Node.js` lands and
  commits, the two refusals are usage errors at exit `2`, and `--value` is untouched (AC5).

`npx jest test/dna/path-quoting.test.ts test/core/dna-quoted-path-segments.test.ts` on the red tree:
**24 failed, 8 passed, 32 total**. The 8 that passed are exactly the ones classified
**characterization** above plus three "still true" guards — 5 + 3 = 8, which is what the run's JSON
shows. (This sentence said *four* against its own list below until the review caught it; corrected in
place, since the number carried nothing and a document that contradicts itself helps no one.)
Enumerated from the run's own JSON rather than asserted:

```
$ npx jest … --json | node -e "…for(const t of s.assertionResults) if(t.status==='passed')…"
AC7 … a document carrying all three live dotted names LOADS
AC7 … the three names survive validation byte-for-byte
AC7 … duplicate names are still refused — `uniquelyNamed` stays exactly as task-093 left it
AC5 … an entry with a dotted name is removed by its bare name in --value
AC5 … a --value carrying WingFoil quotes names an entry that does not exist, rather than being stripped
(+ 3 guards: the bare spelling still does NOT resolve, at the resolver and through dnaUpdate; `..language` still reports its own message)
```

No red was fabricated and no dead code was added to force one: every one of the 24 failed because the
behaviour does not exist (`splitDnaPath is not a function`, then the four refusals measured in the
design step).

### green — role: developer

- **`src/dna/set.ts`** — `splitDnaPath(keyPath)` (the grammar, with its three refusals),
  `quoteDnaSegment(name)` (its inverse), `DnaPathSplit`; `isValidKeyPath` is now
  `splitDnaPath(...).ok`, so the predicate cannot disagree with the parser; `setDnaValueInText` splits
  through it (its separate `isValidKeyPath` guard is gone — it was the same check twice).
- **`src/dna/path.ts`** — `resolveDnaPath` splits through `splitDnaPath` and returns **its** message;
  `prefixOf` maps `quoteDnaSegment` over the prefix, so a refusal under a quoted segment reports
  `'bogus' is not declared under 'stacks.technologies."Node.js"'` rather than the ambiguous
  `stacks.technologies.Node.js`, which re-splits into four segments and names a different node.
- **`src/core/index.ts`** — `dnaPathPositional` throws the parser's own message, so AC3's and AC4's
  messages reach exit `2` instead of a flat `invalid key path`.
- **`src/dna/index.ts`** — the two new symbols and the type re-exported from the pillar barrel.

**Shared-file change, flagged for the merge** (wave brief): `src/core/index.ts` line 30 changes from
`import { DNA_KEY_ALIASES, isValidKeyPath } from '../dna/set';` to
`import { DNA_KEY_ALIASES, splitDnaPath } from '../dna/set';`, and the only other edits in that file
are inside `dnaPathPositional` and two doc comments. That is the entire footprint in a file
`task-095`/`task-096`/`task-098` also touch — this task adds no symbol to `CORE_MODULES` and changes
no operation's registration.

**Two red fixes that were the test's fault, not the code's**, both recorded because each is a claim
that would otherwise be wrong:

- `DnaPathTarget.path` is the path **as given** and is deliberately never rewritten (it is what the
  commit subject echoes), so `team."members".roberto.roles` and `team.members.roberto.roles` resolve
  to targets that differ in `path` and in nothing else. The AC2 test compares the rest and says why.
- the first `team.agents` fixture had no `reviewer` in `team.roles`, so the add failed `Team`'s
  referential refinement (`references undefined role "reviewer"`) — a fixture bug that had nothing to
  do with quoting. Diagnosed by printing the `CoreResult` rather than by guessing.

### refactor — role: developer

Documentation only — AC8 — plus the doc comments listed above:

- **`spec-008` §9** gains a *Quoting a segment* subsection: the three worked invocations, the
  shell-versus-WingFoil overlap stated outright (outer single quotes the shell's, inner double quotes
  WingFoil's — and `--value "Node.js"` the other way round), and the rules in full. §5 names the two
  new usage errors beside `..language`, and the `<path>` row points at the subsection.
- **`spec-002`** gains a Revision recording both halves: the path may quote a segment, and **no dot
  constraint joins `uniquelyNamed`** — with `bug-091`'s Correction's measurement and `dl-083`'s ground
  for declining it even on a clean corpus.

Both are dated Revisions edited in place, no supersede, no state change — the shape `task-093` used
and `dl-047-tech-specs-carry-no-version-field` allows.

**Checked and deliberately not changed.** `src/dna/edit.ts`'s `insertMissingScalarPath` rebuilds a key
path with `edit.path.map(step => step.key).join('.')` — the inverse of the parser, without
`quoteDnaSegment`. It cannot produce a wrong path today and the reason is structural, not lucky: the
line above it is `if (!edit.path.every((step) => 'key' in step)) return undefined;`, so every step is a
**mapping key**, and mapping keys come from `DnaYaml`'s own shape (`project`, `license`, `version`) —
a collection entry, the only place a dotted name can occur, arrives as an `{ index }` step and is
filtered out one line earlier. Left alone rather than "hardened", which would have been dead code.

### Gates — run on the final tree, after merging `main`

`git merge main` (`dl-035`: merge, never rebase) brought `4a6b5846..66ef6304` — 27 commits including
`task-095`'s merge — into the branch before these were run, so they are the numbers for the tree that
will be merged back, not for an isolated one. No conflict, textual or semantic.

| Gate | Result |
|---|---|
| `npx jest` | **134 suites / 2189 tests passed** |
| `npx jest --coverage` | `98.57 stmts · 93.94 branch · 98.91 funcs · 99.39 lines` — over the 80% floor, and non-regressing against `task-093`'s `98.50 / 93.65 / 98.89 / 99.38` |
| `npx tsc -p tsconfig.build.json --noEmit` | exit `0` |
| `npx tsc -p tsconfig.build.json` (**emitting**) | exit `0` |
| `npx tsc --noEmit -p tsconfig.json` (full, tests included) | exit `0` |
| `npm run lint` | exit `0` |
| `npm run docs:api` | exit `0` |

Before the merge, on this branch alone: 131 suites / 2159 tests, `98.55 / 93.87 / 98.90 / 99.39`. One
run of the full suite reported `test/mcp/resource-latency.test.ts` failing its latency-growth trend
assertion (`lastMean 129.5 < 110.3` expected); re-run alone it passed `4 passed`, and every subsequent
full run passed it too. A timing-sensitive REQ-PERF-04 assertion under machine load, untouched by this
task, which changes no code that suite reaches.

### The CLI, driven for real (not inferred from the unit tests)

The gates above exercise `CoreFn`s. WingFoil is experimental, so the shipped binary was driven too, on
a throwaway git repo carrying the fixture — `node dist/cli.js`, built from this tree:

```
$ node …/dist/cli.js dna update 'stacks.technologies."Node.js".version' --value 22.14+
{ "key": "stacks.technologies.\"Node.js\".version", "value": "22.14+" }        exit 0
$ git log -1 --format=%s
wf(dna): update stacks.technologies."Node.js".version 22.14+
$ grep -A2 'name: Node.js' .wingfoil/dna.yaml
    - name: Node.js
      category: runtime
      version: 22.14+     # [SPEC] Product Brief §Technical Stack      ← comment preserved and realigned

$ node …/dist/cli.js dna set 'stacks."Node.js' --value x
error: invalid key path: 'stacks."Node.js': unterminated quote — a segment that opens with " must close with "     exit 2
$ node …/dist/cli.js dna set 'stacks."say "hi""' --value x
error: unaddressable entry name in key path 'stacks."say "hi""': a segment may not contain " and there is
no escape sequence, so an entry whose name contains " cannot be addressed                                  exit 2
$ node …/dist/cli.js dna remove stacks.technologies --value "Commander.js"
{ "key": "stacks.technologies", "value": "Commander.js" }                      exit 0   (entry gone: grep -c → 0)
```

The last two lines are the AC5 point in its natural habitat: those double quotes are the **shell's**,
they never reach WingFoil, and the entry named `Commander.js` is removed by its bare name.

### Per-AC outcome

| AC | Where it is pinned |
|---|---|
| AC1 | `path-quoting.test.ts` "a quoted segment is taken verbatim" + `resolveDnaPath` block; `dna-quoted-path-segments.test.ts` update/set end to end. One parser: the resolver, the predicate and the text editor all call `splitDnaPath`. |
| AC2 | "the delimiters are dropped…" and "a quoted dot-free segment resolves to the same place as the bare spelling"; end to end via `team."members".roberto.roles`. |
| AC3 | `splitError('stacks.technologies."Node.js')` + `exitCodeForThrow(...).exitCode === 2` on all four verbs; driven on the real CLI above. |
| AC4 | "a `"` the delimiters cannot account for…" — message asserted to say *unaddressable*, to mention *escape*, and **not** to say *invalid key path*; plus the deliberate split from the malformed `"Node.js"x` case, so the unaddressable message is true whenever it prints. |
| AC5 | the `--value` describe block: removal by bare `Node.js`, a WingFoil-quoted `--value` naming nothing, and an entry added by `--value` then reached by a quoted segment. |
| AC6 | `DOTTED_DNA` in `path-quoting.test.ts` carries `Node.js`, `Commander.js` and `AI agent (Claude/Cursor/etc.)`, and each is asserted addressable; the core suite's fixture carries them too. |
| AC7 | the AC7 describe block: the document **loads**, the names survive byte-for-byte, and `uniquelyNamed` still refuses duplicates. A dot refinement attached inside `DnaYaml` fails the first of those on read. |
| AC8 | `spec-008` §9 + §5 + the `<path>` row; `spec-002`'s *Unknown keys* ground, both with dated Revisions. |

### Found, not fixed — proposed to the orchestrator, not filed here

Parallel worktrees would collide on ids, so these are **proposals**; registering them is the
orchestrator's act.

1. **`dna show` takes a top-level section name, not a path — so `dl-083`'s own `dna show` example
   cannot work.** `dl-083`'s Decision shows `wingfoil dna show 'stacks.technologies."Commander.js"'`,
   but `dnaShowFn` (`src/core/index.ts`) resolves one key —
   `const key = DNA_KEY_ALIASES[section] ?? section; if (!(key in dna))` — and never splits. Measured
   on the real CLI built from this branch, on a scratch project:

   ```
   $ node …/dist/cli.js dna show 'stacks.technologies."Commander.js"'
   error: no DNA key named 'stacks.technologies."Commander.js"'      exit 1
   $ node …/dist/cli.js dna show stacks.technologies
   error: no DNA key named 'stacks.technologies'                     exit 1
   $ node …/dist/cli.js dna show stacks                              exit 0
   ```

   Quoting is **not** what is missing there: the bare dotted path fails identically, so this is a read
   surface that never grew the path grammar the write surface has, and AC1's "read paths and write
   paths behave identically" holds only within the resolver. Widening `dna show` is a new read surface
   with its own refusal rules (what does a path landing on a `collection` print? on an absent optional
   section?) and its own BDD scenario, which is why it was not done inside this task. Proposed as a
   **bug** against P2.2 (the spec example does not run), or a **decision-log** if the answer is instead
   to correct `dl-083`'s example.

2. **Nothing prevents a future reader of a DNA path from splitting it itself.** `splitDnaPath` is now
   the only splitter in `src/` — `grep -rn "split('\.')" src/` now returns exactly one line, the
   sentence in `splitDnaPath`'s own doc comment that says so — but
   that is a fact about today's code, not an invariant anything enforces — the same shape as the
   `bug-084` alias trap, where one call site diverged from the rule. A guard test in the spirit of
   `test/cli/derived-option-namespace.test.ts` (derive the invariant, do not hand-list it) would keep
   it. Low severity, no current defect. Proposed as a **bug** or left as a note, the orchestrator's
   call.

### review corrections (2026-09-24) — four sentences, no code

The review found nothing to change in `src/` and reproduced every gate, the red at 24/8 with the same
eight, the three live names resolving on the shipped binary, and all three refusals at exit `2`. It
also attacked the malformed-vs-unaddressable split with a dozen inputs I had not chosen (a quote
mid-segment, a segment that is only a quote, an empty quoted segment, a trailing quote,
`"Node.js"x"y"`) and found it holds on all of them, and it added a hypothetical dot ban inside
`uniquelyNamed` and got **10 red, including both AC7 pins failing on read** — which is what `dl-083`
Action 4 asked the AC6 fixture to guarantee.

What it found were four false or imprecise **sentences of mine**. Each is corrected below; two were
corrected in place because they sit in contracts other work reads, and the one that carried a decision
is retracted here rather than edited away, per `bug-091`'s own precedent.

**C1 — "nothing already written changes meaning" was false, and it was in a ratified spec.** The
`spec-008` Revision and `splitDnaPath`'s TSDoc both claimed a `"` could not appear in a resolving path
before this rule. Measured by running `main`'s `src/dna/set.ts` and `src/dna/path.ts` side by side with
this branch's (both copied out with `git show main:…`, in one jest run, against one document):

```
isValidKeyPath('modules.co"re')                 main = true    branch = false
resolveDnaPath(doc, 'stacks.technologies."a".category')   # doc has entries named `a` AND `"a"`
  main   = OK value="y"  segments=["stacks","technologies","\"a\"","category"]
  branch = OK value="x"  segments=["stacks","technologies","a","category"]
```

The second is the sharper one: not a refusal but a **silent redirection** to a different entry, and
`uniquelyNamed` permits both names to coexist. The narrowing is intended — `dl-083` accepts that
quote-bearing names become unaddressable — but "nothing changes" is a compatibility guarantee, and it
was untrue. Corrected **in place** in both places, with the measurement beside it, because a grammar
contract is where the next reader looks for exactly this.

**C2 — the reason I gave for homing the parser in `set.ts` was false; the placement is right.** My
design note said a parser in `path.ts` "would have to be imported back by `set.ts` and the two modules
would import each other". That is wrong, and one look at the imports settles it: `set.ts` imports
**only `js-yaml`**, and `path.ts`'s only import from `set.ts` is the parser family itself. Moving
`splitDnaPath`, `quoteDnaSegment` and `isValidKeyPath` together would reverse that edge, not close a
cycle. The sentence stands above, retracted here rather than erased, because it is the reason a later
reader would weigh when deciding whether to move this code — and a false reason points them at a
constraint that does not exist.

**The real argument, which I should have made:** `set.ts` is a **leaf** — `js-yaml`, no zod, no
schema — and it is the pure, comment-preserving text writer. `path.ts` is schema-aware: it imports
`DnaYaml` and reads zod's introspection surface. Homing the parser in `path.ts` would make the text
writer depend at runtime on the schema-aware resolver and, through it, on zod, to answer a question
that is purely about the shape of a string. The dependency direction is the substance; the cycle was
not. Two supports for the placement beyond that: `task-093`'s `dl-015` hand-off names `set.ts`
explicitly ("a `splitDnaPath(keyPath)` in `src/dna/set.ts` … with all three calling it"), written by
the task that owns both files; and `dl-083` Action 1's "(`src/dna/path.ts`)" is a **locator**, not the
substance of the decision — the substance is the quoted-segment rule and the exit-`2` refusal, both
met. Today's Correction on `dl-083` is the reason to weigh that parenthetical lightly: its `dna show`
example was written by analogy and never run, and the same hand wrote both parentheses.

**C3 — `quoteDnaSegment` is not the exact inverse of `splitDnaPath`, and I documented it as one.**
Brute-forced over the alphabet `{a, ., "}` up to five characters, 363 names:

```
total=363   roundtrip=62   refused=294   different=7
"a"    -> "a"      -> ["a"]          # no dot, so returned bare, re-parses as the OTHER name `a`
a"."a  -> "a"."a"  -> ["a","a"]      # two segments
(+ 4 more, every one of them a name containing a `"`)
segments returned by splitDnaPath that contain a `"`, over the same 363:  0
```

Unreachable at its one call site, and structurally so rather than by luck — which is the same argument
I made for `edit.ts`'s `insertMissingScalarPath` and failed to make for an **exported** symbol.
`prefixOf` is fed `DnaPathTarget.segments`, which comes from `splitDnaPath`, and a segment it returns
can never contain a `"`: a bare segment carrying one is refused as unaddressable, and a quoted segment
ends at the *first* `"`. The `0` above is that precondition measured rather than asserted. The TSDoc
now states the precondition and the 62/294/7 split instead of claiming an inverse, and no hardening
was added — it would be unreachable code.

**C4 — a count.** "plus four 'still true' guards" against a list of three; 5 + 3 = 8 is what the JSON
shows. Corrected in place.

**One lesson worth keeping, which the reviewer named.** The AC4 message survived every attack because
it is phrased as a **rule** — *a segment may not contain `"` and there is no escape sequence* — rather
than as a claim about the input in hand, and a message phrased as a rule cannot be false when it
prints. C1, C2 and C3 are all sentences that made a claim about the world ("nothing changes", "would
import each other", "the inverse") where a rule, or a measurement, was available. C1 and C3 now carry
the measurement; C2 now carries the dependency rule.

**Not filed by me:** `bug-101` (an all-digit name stays unaddressable even quoted — the index guard in
`resolveDnaPath` runs after the delimiters are stripped, so `modules."0".path` is still refused as an
index; my class of defect, surviving my fix) and `bug-102` (nothing enforces that `splitDnaPath` stays
the only splitter — the proposal I made above) are already registered by the orchestrator.

### Gates — re-run after the corrections

Documentation and comments only; no `src/` behaviour changed, and the tree is otherwise the one the
review read.

| Gate | Result |
|---|---|
| `npx jest` | **134 suites / 2189 tests passed** |
| `npx jest --coverage` | `98.57 stmts · 93.94 branch · 98.91 funcs · 99.39 lines` — unchanged, over the floor, non-regressing |
| `npx tsc -p tsconfig.build.json --noEmit` | exit `0` |
| `npx tsc -p tsconfig.build.json` (**emitting**) | exit `0` |
| `npx tsc --noEmit -p tsconfig.json` (full, tests included) | exit `0` |
| `npm run lint` | exit `0` |
| `npm run docs:api` | exit `0` |
