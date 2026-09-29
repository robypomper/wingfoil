---
id: "task-053-directives-list"
type: task
title: "Implement `wingfoil directives list`"
status: done
release: "v0.2"
priority: "High"
tags: ["v0.2", "p3"]
ref: "P3.4"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

As Morgan, deliver feature **P3.4** (US-4-04): list all directives with their role assignments.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p3-directives/P3.4-directives-list.feature`.

Key scenario: `wingfoil directives list` → 6 built-ins + customs, each with assigned roles or `unassigned`.

## Implementation Notes

Must not repeat `bug-006` (init-scaffolded directive .md failing the schema) — see `task-064`.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### design — role: architect (directives: architecture, determinism, traceability)

**`agent.read_related` (dl-015).** `depends_on: []` — no upstream task's Execution Notes to load.
No-op, gate satisfied vacuously.

**`agent.classify_acs` (T1).** The ACs are the three scenarios of
`docs/02_requirements/02_bdd/features/p3-directives/P3.4-directives-list.feature`. `directivesList`
is **already registered** in `CORE_MODULES` (`src/core/index.ts`, `directives` module) as
`wrapReadOnly(loadDirectives)`, returning one `{path, frontmatter}` per `.md` file found under
`.wingfoil/directives/**`, so part of the contract pre-exists:

| # | AC (BDD scenario / line) | class | why |
|---|---|---|---|
| AC-1 | Sc.1 — "the output includes the 6 built-in directives and `no-direct-db-access`" | **characterization** | `loadDirectives` already walks `.wingfoil/directives/**` recursively (`listMarkdownFilesSorted`, `src/core/loaders.ts`) and returns every `.md` it finds, `built-in/` and `custom/` alike. Guarded today by `test/core/production-registry.test.ts` and `test/cli/program.integration.test.ts`. No red required. |
| AC-2 | Sc.1 — "each directive shows its assigned roles (or `unassigned`)" | **red-first** | Nothing in the current payload reads `roles.yaml`. The entry shape has no role field at all. |
| AC-3 | Sc.2 — `--role developer` lists only developer's directives, incl. `testing` | **red-first** | `directivesList` declares no `CoreOperation.options`, so `--role` is not even a registrable Commander option today; passing it errors. |
| AC-4 | Sc.3 (edge) — only built-ins exist ⇒ exactly those listed | **characterization** | Same enumeration as AC-1; an empty `custom/` tree simply contributes no entries. Kept as an explicit regression assertion rather than a fabricated red. |

**`agent.verify_specs`.** Checked this task's scope against the existing `tech-spec`/`decision-log`
elements. **No new spec scaffolded** — every rule this task needs is already ratified:

- `spec-006-core-domain-api` (`approved`) §3 pins the operation: `directivesList`, `mutates: false`,
  CLI `wingfoil directives list`, MCP Resource `wingfoil://directives/list`. Already satisfied; this
  task changes the operation's *value*, not its identity or surface placement.
- `spec-008-cli-grammar` (`approved`) §2/§5 pins the global flags and the 0/1/2 exit contract. A
  read-only command can only exit 0 or 1, so an unusable `--role` value must not be exit 2.
- `spec-012-context-loader-relevance-filtering` (`approved`) §5 is the single ratified statement of
  role → directive binding: look the role up in `roles.yaml` `assignments`, **plus** the `global`
  directives "applied to all roles". This task's role computation is read off that section, and
  binds on `frontmatter.id` (not `name`) exactly as `resolveRoleDirectives` (`src/core/context.ts`)
  does — `roles.yaml` `assignments` values and `global` entries are directive ids
  (`src/directives/schema.ts`'s `RolesYaml` doc).
- `dl-029-role-with-no-directive-assignments` (`ready`) settles the unbound-role case: never an
  error, the role still gets the globals. So `--role <unknown>` here lists the global directives and
  exits 0 — not `NOT_FOUND`.
- `dl-037-builtin-vs-custom-directive-precedence` (`ready`) + `spec-012` §5's amended precedence
  paragraph are **explicitly not implemented here** — that gap is `task-055-auto-load-directives-by-role`'s
  (see the shadowing decision below).

**Design decision 1 — the listing shows every file on disk, never the resolved set.**
`resolveRoleDirectives` deduplicates by directive id and returns one file per id. This command does
**not** reuse it, and `--role` filters the per-file listing instead. Reasons:

1. P3.4's own framing is inventory ("so I manage rules with visibility"), and AC-4 counts *files
   installed*, not ids resolved. A listing that answers "what rules exist here" must not drop a file
   that exists.
2. `spec-012` §5 (as amended by `dl-037` option B.1) states a shadowed directive is "reported, never
   silently dropped". A listing that silently hid the shadowed file would be a second instance of
   exactly the defect `dl-037` was raised about — this time in the one command whose whole purpose
   is making the directive set visible.
3. Dedup + precedence is a *context-assembly* rule (spec-012 §5 governs the `directive-loader`),
   not an inventory rule. Keeping them separate means `task-055` can fix the precedence/warning gap
   in `resolveRoleDirectives` without this command's output shape changing at all.

Consequence, stated plainly: once `task-057` ships built-ins with ids matching the `custom/`
stand-ins, `directives list` will show **both** files (two entries, same id, different `path`), each
with the same roles. No shadow warning is emitted from here — `warnings` is
`resolveRoleDirectives`'s channel and `task-055` owns wiring it to a surface.

**Design decision 2 — `unassigned` is a payload field, not console chrome.** `--format console`
currently renders pretty-printed JSON of the payload (`renderSuccess`, `src/cli/output.ts`), whose
own contract says a human-facing console shape is owned by "each command's own spec (none exists
yet)". There is no approved per-command console renderer and inventing one is outside this task. So
the BDD's `unassigned` wording is carried **in the value**, as a dedicated `assignment` string, and
is therefore identical under `console`, `json` and `yaml`. The machine-readable `roles: string[]` /
`global: boolean` fields carry the same fact structurally, so nothing is display-only.

**Design decision 3 — the change is purely additive.** `path` and `frontmatter` stay verbatim on
every entry, so the two existing characterization tests keep asserting the same thing. Like
`src/directives/schema.ts` (task-004), there is **no approved tech-spec for this pillar's output
shape**; the added fields are grounded in `spec-012` §5 and the BDD wording rather than invented.
Follow-up left for the reviewer: a candidate `spec-*-directives-list-output` covering the entry
shape and the `--built-in/--custom/--all` filters that `docs/01_vision/X_cli-cmds.md` sketches but
no BDD scenario requires (deliberately out of scope here).

**Design decision 4 — a missing `roles.yaml` is "no bindings", not `NOT_FOUND`.** The Directives
files and `roles.yaml` are separate artefacts (REQ-SYS-02 pillar isolation); a project can hold
directives before anyone binds them. A missing file therefore yields every directive `unassigned`
and exit 0. A *malformed* `roles.yaml` still surfaces as `VALIDATION` (exit 1) — only `ENOENT` is
tolerated. This also keeps `test/cli/fixtures/wingfoil-root/`, which has directives but no
`roles.yaml`, a valid fixture.

**Design decision 5 — placement.** The new logic goes in `src/core/directives-list.ts`, next to
`src/core/context.ts`'s `resolveRoleDirectives` — the existing precedent for role→directive binding
logic. Putting it in `src/directives/` would create a `core → directives → core` import cycle,
because the `DirectiveFile` shape it operates on is declared in `src/core/loaders.ts`. The edit to
`src/core/index.ts` is confined to the `directivesList` operation entry plus its imports
(`task-050-directive-create` is editing the same module block concurrently).

**Checks (post).** `frontmatter.required: [title, scope]` is the check on a tech-spec **scaffolded
by this phase**; none was, so it does not apply. (For the record, `memory.yaml` declares
`types.task.template.frontmatter.required: [title, release]`, and this task file carries both.)
`tech-spec.approved` — spec-006/008/012 all `approved`, `dl-029`/`dl-037` `ready`.
`depends_on.acknowledged` — vacuous, `depends_on: []`.
**Approval:** pass-through (no new spec scaffolded).

### red — role: developer (directives: code-quality, testing, determinism)

**New suite** `test/core/directives-list.test.ts` (17 cases), driven through the **registered**
`directives.directivesList` operation in `CORE_MODULES` rather than an internal helper — so the
assertions are on what `wingfoil directives list` and `wingfoil://directives/list` actually return
(spec-006 §3). Driving the registered op also means the characterization cases were **green at
red**, keeping the red evidence honest: no fabricated failure.

`npx jest test/core/directives-list.test.ts --maxWorkers=2` at red:
**`Tests: 11 failed, 6 passed, 17 total`** — the 6 passing are exactly the T1 characterization
cases (enumeration of both trees, the 6-built-ins edge case, `path`/`frontmatter` preserved,
determinism, the shadowed-pair listing, invalid-directive VALIDATION); all 11 failures are the
red-first role/`--role` cases. First failure, verbatim:

```
● directivesList — P3.4 Scenario 1: list all directives with assignments › each directive shows its assigned roles

  expect(received).toEqual(expected) // deep equality

  Expected: ["developer", "qa"]
  Received: undefined

    > 122 |     expect(byId.get('testing')?.roles).toEqual(['developer', 'qa']);
```

**End-to-end red** in `test/cli/program.integration.test.ts` (compiled `dist/` + spawned `node`):
`Tests: 3 failed, 30 passed, 33 total`. `directives list --role developer` exited **1** instead of
0 (the option is not declared on the derived command), and without `--role` every entry rendered
`assignment=undefined`.

Cases pinned: roles per directive; the character-exact `unassigned`; an assigned directive rendering
its roles; a `global` directive flagged `global: true`; `--role developer` including `testing` and
the globals and excluding `code-review`/`architecture`; `--role <unbound role>` succeeding with just
the globals (dl-029); a directive id colliding with an `Object.prototype` member resolving to
`unassigned`; missing `roles.yaml` ⇒ all `unassigned`, exit 0; schema-invalid `roles.yaml` ⇒
`VALIDATION`; and both halves of a shadowed id staying visible, with and without `--role`.

### green — role: developer (directives: code-quality, testing, determinism)

New module **`src/core/directives-list.ts`** — `buildDirectiveListing` (pure: files + `roles.yaml` →
annotated entries, with the optional `role` filter) and `loadDirectiveListing` (the filesystem half).
Placed in `src/core` for the same reason `resolveRoleDirectives` is: `DirectiveFile` is declared in
`src/core/loaders.ts`, so `src/directives` would have needed a `core → directives → core` cycle.

`src/core/index.ts` edit is confined to `directivesList`: the operation now declares
`options: [{ name: 'role' }]` and calls a new `directivesListFn` (same `loadOrError` mapping every
other read-only pillar query uses) instead of `wrapReadOnly(loadDirectives)`; the now-unused
`loadDirectives`/`DirectiveFile` names were dropped from that file's `./loaders` **import** (their
`export ... from './loaders'` re-export lines are untouched, so nothing downstream lost a symbol).
No other operation, and no other part of the `directives` module block, was touched
(`task-050-directive-create` is editing that block concurrently).

Behaviour, point by point:

- `roles` is built by inverting `roles.yaml` `assignments` into a **`Map` keyed by directive id** —
  a `Map`, not an object, because ids come from files on disk and one named `constructor` /
  `__proto__` would otherwise resolve through `Object.prototype` (the same hazard `ownAssignments`
  guards from the other direction in `src/core/context.ts`). Role names are walked in sorted order,
  so each `roles` array is ascending without a second sort (REQ-SYS-07).
- `global: true` for an id in `roles.yaml` `global`; its `roles` stays `[]` because enumerating "every
  role" would mean reading `dna.yaml`'s role catalogue — a different pillar (REQ-SYS-02) — and would
  still miss a role with no `assignments` entry of its own.
- `assignment` = `roles.join(', ')`, prefixed by `global (all roles)` when global, and exactly
  `unassigned` when neither binds.
- `--role R` keeps an entry when `R`'s own assignments name it **or** it is global (`spec-012` §5).
- `roles.yaml` is read only when present; when present it goes through the validating `loadRolesYaml`,
  so a schema-invalid file is still `VALIDATION` / exit 1.

`npx tsc --noEmit -p tsconfig.json` → exit 0.
`npx jest test/core/directives-list.test.ts test/cli/program.integration.test.ts --maxWorkers=2` →
**`Tests: 50 passed, 50 total`** (2 suites).
Full suite `npx jest --maxWorkers=2` → **`Test Suites: 75 passed, 75 total`, `Tests: 986 passed, 986
total`**.

### refactor — role: developer (directives: code-quality, testing, determinism)

Two changes, both driven by the coverage report rather than taste:

1. `rolesByDirectiveId` now walks `Object.entries(assignments).sort(...)` instead of
   `Object.keys(...).sort()` + an index read. The index read forced a `?? []` fallback on a key that
   by construction exists (`noUncheckedIndexedAccess`), which showed up as a permanently-uncovered
   branch — a dead path, now gone rather than merely untested.
2. Added a case for a role listing the same directive id twice (`roles.yaml` hygiene): the role is
   reported once. That was the second uncovered branch (`!roles.includes(role)`), and it is real
   behaviour worth pinning, not coverage theatre.

`src/core/directives-list.ts` went 91.3% → **100% branch** (100% stmts/funcs/lines throughout).

**Checks (post), all observed:**

| check | command | result |
|---|---|---|
| `tests.passing` | `npx jest --maxWorkers=2` | `Test Suites: 75 passed, 75 total` · `Tests: 987 passed, 987 total` |
| `tests.coverage(min: 80)` | `npx jest --coverage --maxWorkers=2` | All files **98.14% stmts / 89.92% branch / 98.36% funcs / 98.87% lines**; `src/core` 98.55/91.07/100/99.18; `directives-list.ts` **100/100/100/100** |
| `docs.api.build` | `npm run docs:api` | exit 0 |
| `docs.api.public-complete` | `npx tsc -p tsconfig.build.json` | exit 0; every new export (`DirectiveListEntry` and its fields, `buildDirectiveListing`, `loadDirectiveListing`, `GLOBAL_ASSIGNMENT`, `UNASSIGNED_ASSIGNMENT`, `DirectivesListParams`) carries TSDoc |
| `lint.clean` (dl-034) | `npx eslint .` | exit 0 |

**End-to-end on the real compiled CLI** (`node dist/cli.js`, run in throwaway repos **outside** the
worktree, after `npx tsc -p tsconfig.build.json`).

*Scenario 1 + 3 — a repo with the six P3.8 ids under `built-in/` and one custom
`no-direct-db-access`, `roles.yaml` binding `testing`→developer+qa, `no-direct-db-access`→developer,
`code-review`→reviewer, `documentation` global:*

```
$ wingfoil directives list --format json     # ids and assignment only, for brevity
architecture        -> unassigned
code-quality        -> unassigned
code-review         -> reviewer
documentation       -> global (all roles)
security            -> unassigned
testing             -> developer, qa
no-direct-db-access -> developer
exit=0
```

*Scenario 2 — the `--role` filter, and dl-029's unbound role:*

```
$ wingfoil directives list --role developer --format json
documentation       -> global (all roles)
testing             -> developer, qa
no-direct-db-access -> developer
exit=0

$ wingfoil directives list --role architect --format json
documentation       -> global (all roles)
exit=0
```

*Scenario 3 (edge) — after deleting `custom/`, exactly the six built-ins are listed, exit 0.*

*Against WingFoil's own `docs/self/.wingfoil/` (copied into a scratch repo):*

```
$ wingfoil directives list --format json
directives/custom/architecture.md          architect, tech-lead
directives/custom/code-quality.md          developer
directives/custom/code-review.md           reviewer, tech-lead
directives/custom/determinism.md           architect, developer
directives/custom/doc-versioning.md        global (all roles)
directives/custom/documentation.md         global (all roles)
directives/custom/security-secrets.md      global (all roles)
directives/custom/security.md              unassigned
directives/custom/testing.md               developer, qa
directives/custom/traceability.md          architect, product-owner, reviewer
```

That reproduces `roles.yaml` exactly, including its own comment that the generic `security` stand-in
is deliberately left unbound — the `unassigned` case, on real data.

### review (developer side) — handover to the reviewer

**`tests.bdd.run` — P3.4 scenario-by-scenario, with the test that proves each.**

| BDD scenario / clause | met | proving test |
|---|---|---|
| Sc.1 "the output includes the 6 built-in directives and `no-direct-db-access`" | yes | `test/core/directives-list.test.ts` › *the output includes the 6 built-in directives and "no-direct-db-access"* (T1 characterization) |
| Sc.1 "each directive shows its assigned roles" | yes | *each directive shows its assigned roles* — `testing → ['developer','qa']`, `code-review → ['reviewer']`, `no-direct-db-access → ['developer']` |
| Sc.1 "(or `unassigned`)" | yes, **character-exact** | *a directive no role names shows the exact string "unassigned"* asserts `toBe('unassigned')` — lowercase, single word, no punctuation, exactly the feature file's token. Also asserted end-to-end in `test/cli/program.integration.test.ts` against the compiled CLI. |
| Sc.2 "only directives assigned to `developer` are listed, including `testing`" | yes | *only directives assigned to "developer" are listed, including "testing"* + *includes the `global` directives…* (the full result is exactly `no-direct-db-access`, `security-secrets`, `testing`); end-to-end in `program.integration.test.ts` › *lists only the developer-assigned directives (incl. globals), exit 0* |
| Sc.3 (edge) "exactly the 6 built-in directives are listed" | yes | *exactly the 6 built-in directives are listed* (T1 characterization) |

`--format json` / `--format yaml` / `console` all carry the same payload, so `unassigned` reads
identically in every format (spec-005 §2 / REQ-INT-05).

**How the "6 built-in directives" clause is satisfied *today*, and what changes with `task-057`.**
`.wingfoil/directives/built-in/` in this repository holds only a `.gitkeep`; the six P3.8 stand-ins
(`architecture`, `code-quality`, `code-review`, `documentation`, `security`, `testing`) live under
`custom/`, and `task-057-builtin-directive-templates` ships the real built-ins later. Nothing in this
implementation assumes a built-in set exists, or counts to six, or reads the `built-in/` directory by
name: it lists **whatever `.md` files `loadDirectives` finds under `.wingfoil/directives/**`**, in
either subtree. So the clause is satisfied *structurally* — the tests seed six files under
`built-in/` in a throwaway repo and get six entries back — while against the live self-config the
same command returns the ten `custom/` files (transcript in the refactor notes above).

When `task-057` lands, two things happen and neither needs a change here: the six built-ins simply
appear as six more entries; and because their ids are *exactly* the six `custom/` stand-in ids, each
becomes a **shadowed pair** — both files listed, same id, different `path`, same roles. Pinned by
`test/core/directives-list.test.ts` › *lists both files sharing an id, each with its own path*, so
the day `task-057` merges, the behaviour is already specified rather than discovered.

**Shadowed files: the listing shows every file on disk, not the resolved set.** Reasoning in the
design notes above; restated because it is the one judgement call in this task. `resolveRoleDirectives`
deduplicates by id for *context assembly*; this command is an *inventory* and must not hide a file
that exists — `spec-012` §5 (as amended by `dl-037` option B.1) requires a shadowed directive be
"reported, never silently dropped", and hiding one here would be that defect in the one command whose
purpose is directive visibility. **`dl-037`'s precedence rule and its shadow warning are NOT
implemented in this task** — that gap is still `task-055-auto-load-directives-by-role`'s, and
`src/core/context.ts:110`'s smallest-path tie-break is untouched.

**Observed final numbers** (all re-run on this branch at `refactor` head):

- `npx jest --maxWorkers=2` → **`Test Suites: 75 passed, 75 total`**, **`Tests: 987 passed, 987 total`**
- `npx jest --coverage --maxWorkers=2` → All files **98.14% stmts / 89.92% branch / 98.36% funcs /
  98.87% lines** (≥80 global); `src/core/directives-list.ts` **100/100/100/100**
- `npm run docs:api` exit 0 · `npx tsc -p tsconfig.build.json` exit 0 · `npx eslint .` exit 0

**Concurrency.** `src/core/index.ts` was edited in three places only: the `./loaders` import (dropped
the two names that became unused), the export block (added the new module's exports), and the
`directivesList` operation entry + its new `directivesListFn` above `CORE_MODULES`. Nothing else in
the `directives` module block was reordered or reformatted (`task-050-directive-create`).
`src/storage/layout.ts` (`task-054`), `package.json` and `jest.config.js` (`task-065`) were not
touched.

**Left for someone else — CONVERTED, each item below now resolves to an element id.** Filed after
the independent review, per the project rule that a finding must not survive as prose in a `done`
task's notes:

| item below | element |
|---|---|
| 1, 2, 3 (output shape, type filters, `console` table) | `dl-042-directives-list-output-contract` (1, 2) and `dl-043-console-format-human-rendering` (3 — it is cross-cutting, not this command's: `renderSuccess` falls back to JSON for *every* read-only command, against `spec-008` §2) |
| 4 (dl-037 precedence + shadow warning) | already `dl-037` + `task-055`; **plus** `dl-042` question A, on whether this listing should *mark* a shadowed pair rather than leave the user to infer it from `path` |
| 5 (MCP loses `--role`) | `dl-040`, amended to name this as its third occurrence — and to record that it is a *capability gap*, not a URI divergence |

**One correction to the reasoning below, from the review — the citations are weaker than item 4 and
the SHADOWED FILES note claim.** `spec-012` §5 and `dl-037` B.1 are scoped to the `directive-loader`
inside **context assembly** (dl-037's Actions assign the work to `task-055` and `src/core/context.ts`),
so they neither require nor forbid what `directives list` does. The decision to list every file on
disk is still right, but its authority is **P3.4's own scenarios**, which count *files installed*
("the 6 built-in directives **and** `no-direct-db-access`"; "exactly the 6 built-in directives"),
never ids resolved.

**And one gap this task did not record.** `dl-029`'s ratified outcome is option **(c)**, the hybrid:
globals always **plus** the warning `no directives assigned to role '<role>'`. That warning is
implemented in the sibling path (`src/core/context.ts:98-101`). `directives list --role ghost` returns
the globals **silently**, reproducing exactly the harm dl-029's rationale names — a role never bound
is indistinguishable from one deliberately bound to globals only. dl-029 was cited here for half its
decision. The other half is `dl-042` question D; adding a `warnings` channel to a bare
`DirectiveListEntry[]` is a shape decision correctly outside this task.

Separately, `bug-024-commander-parse-errors-exit-1` was filed from this review: `directives list
--role` (value missing) and `--rol x` (unknown option) exit **1** where `spec-008` and REQ-INT-04
require **2**. Pre-existing and identical on `memory search --tag`, so not introduced here.

Original list, kept for context:


1. **No approved tech-spec covers this command's output shape.** The added fields are grounded in
   `spec-012` §5 and the BDD's own wording, and the pre-existing `path`/`frontmatter` pair is
   preserved verbatim, but the entry shape itself is [AUTHORING]-level — the same position
   `src/directives/schema.ts` has held since task-004. Candidate follow-up: a
   `spec-*-directives-list-output` pinning `DirectiveListEntry` and the `unassigned` /
   `global (all roles)` tokens.
2. **`--built-in` / `--custom` / `--all` filters are not implemented.** `docs/01_vision/X_cli-cmds.md`
   sketches them (and a `scope` column) for `directives list`; **no BDD scenario requires them**, so
   they were deliberately left out rather than invented. Same document also lists `directive id, name,
   type (built-in/custom), roles assigned, scope` as the display columns — `id`/`name`/`tags`/`ref`
   arrive inside `frontmatter`, but there is no derived `built-in`-vs-`custom` field on the entry
   today (the `path` prefix and `frontmatter.kind` both carry it, and picking one of them as
   *the* source is exactly what item 1's spec should decide).
3. **A `console` rendering for this command.** `--format console` prints pretty JSON, per
   `renderSuccess`'s documented fallback. A human-facing table is a reasonable ask and needs the same
   spec as item 1.
