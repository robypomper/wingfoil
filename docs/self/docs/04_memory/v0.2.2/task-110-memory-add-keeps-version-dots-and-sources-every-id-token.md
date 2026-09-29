---
id: "task-110-memory-add-keeps-version-dots-and-sources-every-id-token"
type: task
title: "`memory add` keeps version dots in the slug and gives every `id_pattern` token a declared source"
status: approved
release: "v0.2.2"
priority: "high"
tags: ["v0.2.2", "memory", "id", "cli"]
ref: "dl-107-slug-keeps-version-dots"
bug: []
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here can never leave `triaged`. A single string is still accepted for documents predating dl-045.
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: []
tmpl_version: 260703
---

## Description

`memory add` cannot produce this repository's own version-shaped ids (`dl-107`, reproduced on
`wingfoil@0.2.1`):

- the slug drops dots: `slugifyTitle` (`src/memory/add.ts:26`) turns `v0.2` into `v0-2`, while the id
  validator accepts `[a-z0-9.]`;
- any token other than `{n}` and `{slug}` fails with `missing value for token`. That includes
  `release`'s `{kind}-{version}` (`dl-092`), `release-line`'s `rl-{version}` and `plan`'s
  `{workflow}-{phase}-plan`.

**Why before the root move.** Once `task-111` lands, the verbs run on this repository, and its
`release`, `release-line` and `plan` patterns must be producible. The retrospective pulled `dl-107`
into v0.2.2 for exactly this reason (row 19).

The contract is `spec-001`'s id_pattern section as amended on 2026-09-29 (`0f68c739`, fixed in
`33d89b7c`). It follows `dl-107`'s ratified options: S1 (a), S2 (a)+(c) and S3 (a).

## Acceptance Criteria

1. **S1 (a).** `slugifyTitle` keeps a `.` between two alphanumerics and collapses every other run
   outside `[a-z0-9]` to `-`, so the slugifier and the validator share one rule. `"v0.2"` gives
   `v0.2`, and `"a . b"` gives `a-b`. *Red-first.* Ids that already exist are untouched: an id is
   immutable once added.
2. **S2 (a).** A token `{<field>}` gets its value from a frontmatter field of the same name, given on
   the command line through the option `spec-008` defines. `memory add` also writes that value into
   the field, so the id and the field cannot disagree. A token with no value fails and names the
   token. *Red-first.*
3. **S2 (c).** `{workflow}`, `{phase}` and `{scope}` are accepted the same way from the CLI. Where the
   type has a field of that name (`plan`), one value fills both. *Red-first.*
4. **`spec-008-cli-grammar` amended** (`dl-107` Action 2): the option's name, its repeatable
   `name=value` shape and its error cases.
   - The name is **not** `--field`. `spec-008` retired that name for DNA paths under `dl-082`, so
     reusing it would collide.
   - The amendment is a dated revision note, as `spec-015`'s are, and the approver signs it off at
     review.
   - `docs/cli-reference.md` gets the new option, which keeps `test/docs/cli-reference.test.ts` green.
5. **S3 (a).** A `memory.add` action in a workflow file may carry an `id_pattern` argument. The
   workflow schema validates it like any other pattern. Dotted tokens such as `{release.version}`
   stay undefined until `dl-090`, and their rejection is pinned by a test. *Red-first.*
6. End to end, on a scratch repository configured like this one: `memory add --type release` with
   `kind=patch` and `version=v0.2.3` produces `patch-v0.2.3`, with both fields written.

## Implementation Notes

- The `{version}` row of `spec-001` no longer says "supplied by `--version`". There is one generic
  mechanism, not one option per token.
- Keep the expansion order `spec-001` fixes: `{date}` → `{author}` → field and context tokens →
  `{slug}` → `{n}`.

## Execution Notes

### design (architect) — 2026-09-29

**`depends_on: []`** — no upstream task's Execution Notes to read (`dl-015` gate is vacuous). `bug: []`,
so `bug.sync_state` is a no-op for every transition of this task.

**Specs.** `grep -m1 '^status:'` on the three inputs → `spec-001-memory-yaml-schema: approved`,
`spec-008-cli-grammar: approved`, `dl-107-slug-keeps-version-dots: ready` (approve commit `35d163af`,
S1 (a), S2 (a)+(c), S3 (a)). `spec-001`'s id_pattern section is the contract as amended in `0f68c739`
and fixed in `33d89b7c` (`git log --oneline -- …/spec-001-memory-yaml-schema.md`). `dl-090` (dotted
tokens) is `ready` but unimplemented, so dotted tokens stay undefined here (AC 5).

**`spec-008` amendment (AC 4, needs the approver's sign-off at review).** New §10 plus a dated
revision note, committed on this branch as content only (status stays `approved`, no `version:` field
to bump — tech-specs carry none, `dl-047`). The option is **`--set <name>=<value>`**, repeatable:
- not `--field` (retired by `dl-082` for DNA paths; `grep -rn -- "--field" src` → nothing);
- not one option per field: the field names are the project's own, and the first one, `version`, is
  `spec-008` §2's global action flag, so `--version v0.2.3` would print the CLI version and exit `0`
  (the collision §9's `entry-` prefix exists for; measured on the built CLI in the AC 6 section);
- no other `set` option exists (`grep -rn "name: 'set'" src` → nothing).
Error cases, exit codes and messages are pinned in §10's table; exit `2` for spelling faults, exit `1`
for faults that need the committed `memory.yaml` (`dl-080` (B)).

**Design.**
- `slugifyTitle` (`src/memory/add.ts`): keep `.` only between two `[a-z0-9]`, collapse the rest.
- New pure helpers in `src/memory/add.ts`: parse the repeatable `--set` list (usage errors), list a
  pattern's tokens, materialize field/context tokens into the `id_pattern` **before** `{slug}`/`{n}`
  (so the counter regexp sees the materialized prefix — spec-001's order `{date}` → `{author}` →
  field/context → `{slug}` → `{n}`), and pick which values are written to frontmatter (context tokens
  only where the committed scaffold declares the key). `{date}`/`{author}` have no implementation
  today (`grep -rn "{date}\|{author}" src` → nothing) and stay out of scope: `--set` refuses them as
  reserved, and a pattern using them keeps failing with `missing value for token`.
- `CoreOption.repeatable` (`src/core/registry.ts`) + Commander collector in `src/cli/program.ts`; the
  option-values record widens to `string | readonly string[]`.
- `memoryAddFn` passes the values to the id, the path (`{release-line}`, `{scope}`) and the document.
- Workflow schema (`src/workflow/schema.ts`): `Phase.actions` gets a refinement that validates the
  `id_pattern:` argument of any `memory.add(...)` action with a new shared
  `idPatternIssues` (`src/validation/id.ts`) — literal characters in `[a-z0-9-.]`, tokens `n…` or
  `[a-z][a-z0-9_-]*`, a dotted token refused naming `dl-090`.

**AC classification (T1).**

| AC | Class | Why |
|---|---|---|
| 1 — slug keeps dots | red-first | `slugifyTitle('v0.2')` returns `v0-2` today (`dl-107` reproduction) |
| 2 — `{<field>}` from `--set`, written back | red-first | no such option; `memory add --help` lists `--type`, `--title`, `--tags` |
| 3 — `{workflow}`/`{phase}`/`{scope}` from the CLI | red-first | same mechanism; `{scope}` is a path token |
| 4 — spec-008 amended, cli-reference documents the option | characterization (docs) | documentation; `test/docs/cli-reference.test.ts` checks command headings only and stays green — the option's own presence is pinned by a red-first CLI test under AC 2 |
| 5 — workflow `id_pattern` argument validated, dotted token rejected | red-first | `Phase.actions` is `z.array(z.string())`, accepts anything |
| 6 — e2e `patch-v0.2.3` | characterization (manual e2e) | end-to-end run of AC 1–3 on a scratch repo, recorded below |

### red (developer) — `9c060b25`

`npx jest --json test/memory/add.test.ts test/core/memory-add-id-tokens.test.ts test/workflow/schema.test.ts test/cli/memory-add-set.integration.test.ts`
→ 29 failed, 30 passed. Per file: `add.test.ts` 1 failed (the dot-keeping slug, AC 1);
`memory-add-id-tokens.test.ts` 22 failed (AC 2/3 and §10's error table); `memory-add-set.integration.test.ts`
4 failed (repeated option through `dist/cli.js`, `--help`); `workflow/schema.test.ts` 2 failed (AC 5).
New tests that passed at red, each a guard of behaviour that already held, not a fabricated red:
"collapses a dot that does not sit between two alphanumerics", "accepts a well-formed undotted
override", "leaves a memory.add action without an id_pattern argument untouched", "{date} stays
unsupported". The first run had a fixture bug (no `template.frontmatter` in the fixture
`memory.yaml` → a registry `VALIDATION` error, not the behaviour under test); fixed before the commit,
after which every failure was the asserted value (`Received: "dl-001-retrospective-v0-2"`,
`"missing value for token {version}"`, …).

### green (developer) — `9025816f`

- `slugifyTitle` keeps a single `.` run between two alphanumerics.
- `src/memory/add.ts`: `parseSetOptions` (§10's spelling faults, first failing occurrence),
  `unknownSetNames`, `expandFieldTokens` (field/context tokens materialized before `{slug}`/`{n}`;
  `{date}`/`{author}` left in place), `writtenFields` (sorted; context tokens only where the scaffold
  declares the key); `renderAddDocument` gains `fields`; `resolveTypeDirectory` takes path values.
- `memoryAddFn`: usage error for a bad `--set`, `VALIDATION` for an unknown name, id from the
  materialized pattern, path values `{...set, id}` for the absence guard and the write.
- `CoreOption.repeatable` / `valueName`; `program.ts` collects a repeatable option's occurrences;
  `ParamsContext.options` values widen to `string | readonly string[]`.
- `src/validation/id.ts`: `idPatternIssues`, `patternTokens`, `isIdPiece`; `src/workflow/schema.ts`
  refines `Phase.actions` with them.
- Docs: `docs/cli-reference.md` (`memory add` option table, the `release` example, error list; the
  row says "New in 0.2.2" because the reference header still reads 0.2.1 — `user-docs` owns the
  header) and `docs/user-guide.md`'s `id_pattern` row.
- Targeted run: `npx jest test/memory/add.test.ts test/core/memory-add-id-tokens.test.ts test/workflow/schema.test.ts test/cli/memory-add-set.integration.test.ts test/core/memory-add.test.ts test/validation`
  → 11 suites, 155 tests passed.

### AC 6 — end to end on a scratch repository

Script `e2e.sh` in the session scratchpad: `git init` in a `mktemp -d` directory outside the repo,
copy `docs/self/.wingfoil/memory.yaml` and `memory/templates/*.md` into `.wingfoil/`, commit, run
the built `dist/cli.js` (built by the jest `globalSetup` of the refactor run below).

**Finding first.** Copied verbatim, this repository's configuration cannot add anything:
```
$ wingfoil memory add --type release --title "WingFoil v0.2.3" --set kind=patch --set version=v0.2.3 --set release-line=v1
error: cannot read the scaffold for memory type 'release': '.wingfoil/.wingfoil/memory/templates/release.md' is not committed at HEAD. …
exit 1
```
`memory.yaml` writes `template.file: ".wingfoil/memory/templates/release.md"` (`grep -n "file:"
docs/self/.wingfoil/memory.yaml`), while the CLI resolves `template.file` against `.wingfoil/`
(`src/core/memory-add-type.ts` at `9025816f`: `templatePath` is `WINGFOIL_DIR` + `/` + `template.file`). Every type is
affected, not only the ones this task touches. `task-111`'s ACs do not mention it. **Not fixed here**
(configuration, and `task-111`'s ground); reported for the approver to file. With the prefix removed
(`sed -i 's#file: ".wingfoil/memory/templates/#file: "memory/templates/#' .wingfoil/memory.yaml`,
committed), the rest of the configuration is unchanged:

```
$ wingfoil memory add --type release --title "WingFoil v0.2.3" --set kind=patch --set version=v0.2.3 --set release-line=v1 --format json
{"id":"patch-v0.2.3","path":"docs/04_memory/planning/v1/patch-v0.2.3.md"}
exit 0
$ git log -1 --format=%s --name-only
wf(release): add patch-v0.2.3
docs/04_memory/planning/v1/patch-v0.2.3.md
$ sed -n 1,14p docs/04_memory/planning/v1/patch-v0.2.3.md   (excerpt)
id: patch-v0.2.3
kind: "patch"
version: "v0.2.3"
release-line: "v1"
$ wingfoil memory add --type plan --title "Dev-loop — rel-v0.2.3" --set workflow=dev-loop --set phase=rel-v0.2.3 --set scope=rl-v1/rel-v0.2.3 --format json
{"id":"dev-loop-rel-v0.2.3-plan","path":"docs/05_plans/rl-v1/rel-v0.2.3/dev-loop-rel-v0.2.3-plan.md"}
   → frontmatter: workflow: "dev-loop", phase: "rel-v0.2.3", no scope: line
$ wingfoil memory add --type release-line --title "WingFoil v2" --set version=v2 --format json
{"id":"rl-v2","path":"docs/04_memory/planning/rl-v2.md"}
$ wingfoil memory add --type decision-log --title "Retrospective v0.2.3" --format json
{"id":"dl-001-retrospective-v0.2.3","path":"docs/04_memory/design/dls/dl-001-retrospective-v0.2.3.md"}
$ wingfoil memory add --type release --title X --set kind=patch --set release-line=v1
error: missing value for token {version}: give it with --set version=<value>
exit 1
$ wingfoil memory add --type release --title X --set version
error: invalid flag value: --set expects <name>=<value>, got "version"
exit 2
$ wingfoil memory add --type release-line --title X --version v3      # the rejected per-field form
0.2.1
exit 0
```
The last run is the measurement `spec-008` §10 cites: `--version` is consumed by the global flag,
prints the package version (the worktree's `package.json` is still `0.2.1`) and writes nothing.

### refactor (developer) — `b02ad53d`

No production refactor. One test commit: the `--set` collector ran only in the spawned `dist/cli.js`,
which coverage does not measure, so `program.ts`'s function coverage dropped; `test/cli/program.test.ts`
now drives it in-process (and pins last-one-wins for a non-repeatable option).

| Check | Command | Result |
|---|---|---|
| unit + BDD | `npx jest --coverage` | 151 suites / 2455 tests, all passing |
| coverage before (main `2e1190a4`, this worktree before any change) | `npx jest --coverage --coverageReporters=text-summary` | stmts 98.58 · branches 94.03 · funcs 98.94 · lines 99.41 |
| coverage after | same | stmts 98.66 · branches 94.25 · funcs 98.98 · lines 99.46 |
| `lint.clean` | `npm run lint` | exit 0 |
| `docs.api.*` | `npm run docs:api` | exit 0 |
| types | `npx tsc --noEmit` | exit 0 |

Remaining uncovered line in new code: `src/workflow/schema.ts` `match[1] ?? match[2] ?? ''` — the
final `''` is unreachable (one of the two groups always matches), kept for the type checker.

### review (reviewer)

- BDD acceptance for `memory add` (`P1.3-memory-add.feature`) plus this task's suites:
  `npx jest $(grep -rl "P1.3-memory-add\|P1\.3" test | sort) test/core/memory-add-id-tokens.test.ts test/cli/memory-add-set.integration.test.ts test/workflow/schema.test.ts`
  → 6 suites, 84 tests passed. The P1.3 scenarios are unchanged: no `--set` means the old behaviour.
- AC 1 — met (`add.test.ts`, the `decision-log` e2e `dl-001-retrospective-v0.2.3`).
- AC 2 — met (`memory-add-id-tokens.test.ts`, CLI integration test, e2e `patch-v0.2.3`).
- AC 3 — met (`plan` e2e: id, `{scope}` folder, `workflow`/`phase` written, `scope` not).
- AC 4 — `spec-008` §10 + dated revision note at `0de025f5`; **pending the approver's sign-off**.
  `docs/cli-reference.md` updated; `test/docs/cli-reference.test.ts` green in the full run.
- AC 5 — met (`workflow/schema.test.ts`; the live workflow files still parse — same file's
  "every referenced workflow-definition file parses" test).
- AC 6 — met, with the `template.file` finding above.

**For the approver.**
1. Sign off `spec-008` §10 (`--set <name>=<value>`), or reject naming another option.
2. `template.file` prefix in this repository's `memory.yaml` (AC 6 finding): after `task-111`'s root
   move `memory add` still cannot add any type here unless the eight `file:` values drop their
   `.wingfoil/` prefix. Needs a bug or a note on `task-111`.
3. Out of this task's ACs, still open from `dl-107`'s Actions: Action 1's `spec-009` §1 slug rule is
   not amended (`spec-001` carries the rule); Action 3 (`retrospective.yaml`'s `capture` action using
   the S3 (a) override) is not done, and cannot be until `dl-090` defines `{release.version}`.
4. `{date}`/`{author}` are in `spec-001`'s table and have no implementation (`grep -rn "{date}\|{author}" src`
   → nothing before this task); `--set` refuses them as reserved. Pre-existing gap, not widened.

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
