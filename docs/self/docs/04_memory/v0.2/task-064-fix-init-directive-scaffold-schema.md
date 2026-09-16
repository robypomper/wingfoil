---
id: "task-064-fix-init-directive-scaffold-schema"
type: task
title: "Fix bug-006: `init` must scaffold directive .md that pass the directives schema"
status: in-review
release: "v0.2"
priority: "Low"
tags: ["v0.2", "cli"]
ref: "P5.1.1"
bug: "bug-006-init-directive-scaffold-schema-invalid"
depends_on: []
tmpl_version: 260703
---

## Description

Fix **bug-006**: `wingfoil init`'s `directiveMd()` generator emits `directives/**/*.md` whose frontmatter omits the required `id`, `type: directive`, and `title` fields, so `wingfoil directives list` errors `E_VALIDATION` on a fresh project.

## Acceptance Criteria

From `bug-006`:
- `wingfoil init --template Scrum` then `wingfoil directives list` succeeds (exit 0).
- Generated directive `.md` frontmatter includes `id`, `type: directive`, `title` per `spec-013`.
- Failing-first test (same defect class as bug-005) in `src/storage/templates.ts`.

## Implementation Notes

Source: `bug-006` (triaged). Same generator file as bug-005 (`src/storage/templates.ts`). Coordinate with `task-053` (directives list) + `task-064` schema. dev-loop syncs via `bug: bug-006`.

## Execution Notes

### `design` (architect) — 2026-09-16

**`agent.classify_acs` (T1, `dl-014` + testing directive).**

| # | Acceptance criterion | Class | Why |
|---|---|---|---|
| AC1 | `wingfoil init --template Scrum` then `wingfoil directives list` succeeds (exit 0) | **red-first** | The behavior does not exist: `directiveMd()` emits `name`/`kind`/`ref` only, so `loadDirectives` rejects every scaffolded file. Verified on the real CLI in `red` (below), not assumed. |
| AC2 | Generated directive `.md` frontmatter includes `id`, `type: directive`, `title` per `spec-013` | **red-first** | Same defect, asserted at the generator level: no existing test feeds `templateScaffold`'s directive output through `DirectiveFrontmatter`. |
| AC3 | Failing-first test (same defect class as `bug-005`) in `src/storage/templates.ts` | **process obligation** | Not a behavior; discharged by AC1/AC2's red tests, which target that module's generator (mirroring the `bug-005` block already at the foot of `test/storage/templates.test.ts`). |

No characterization ACs: nothing here pre-exists.

**`agent.read_related` (`dl-015`, hard gate).** `depends_on: []` — the gate is a **no-op** for this
task; there is no upstream task whose Execution Notes must be acknowledged. Read anyway, because
`bug-006`'s Triage Notes point at them: `task-044-builtin-template-integrity`'s shipped code
(`src/storage/templates.ts` `builtinTemplateSources`, `src/core/builtin-integrity.ts`,
`src/core/init.ts` guard 5) and `task-057-builtin-directive-templates`' Implementation Notes (which
now carry `depends_on: [..., task-064-...]`). Facts taken from them and re-verified against the code
in this worktree, not assumed:
- `builtinTemplateSources(files)` derives the checked set from the very `ScaffoldFile[]`
  `initStorage` writes, classifying by **directory** (`.wingfoil/directives/built-in/`,
  `.wingfoil/workflows/built-in/`), skipping dotfiles. Today's scaffold puts a `.gitkeep` only under
  both built-in directories, so the derived list is `[]` and guard 5 is vacuous — a fact about the
  current scaffold **content**, not about the function.
- Guard 5 in `initWingfoilProject` computes `templateScaffold(template)` *before* any write and
  aborts on the first failing source, so the moment `task-057` adds a real file under
  `directives/built-in/`, `directiveMd()`'s output becomes load-bearing for **every** `init`.

**`agent.verify_specs`.** The contract already exists and is approved:
`spec-013-directive-frontmatter-schema` (`status: approved`, scope
`docs/self/.wingfoil/directives/**/*.md frontmatter`) — its field table requires
`id` / `name` / `type: directive` / `kind` / `title` (+ optional `tags`, `ref`), realized verbatim by
`DirectiveFrontmatter` in `src/directives/schema.ts`. `spec-011-storage-layout` (approved) owns the
`built-in`/`custom` split the scaffold writes into. **No missing artefact → no `memory.add(type:
tech-spec)`, no approver gate on this design phase** (pass-through, per plan §3.2).

Traceability for the fix: `bug-006` → `task-064` → `P5.1.1` (init) + `spec-013` (frontmatter shape)
+ `REQ-SEC-10` (the guard-5 abort this unblocks) + `spec-012` §5 (role→directive resolution keys on
`frontmatter.id`).

**Design decision (recorded before `red`).** Strictly **additive** frontmatter: keep the two fields
`directiveMd()` already emits (`name`, `kind`) at their current values and add `id`, `type`, `title`.
`id` is the filename stem (`spec-013`: "Stable directive identifier … matches the filename stem"),
which is also what the scaffolded `roles.yaml` lists in its `assignments`/`global` blocks and what
`resolveRoleDirectives` (`src/core/context.ts`) keys on — so role binding on a fresh project starts
working as a side effect. No layout change: the files stay under `directives/custom/`
(`task-054-project-directives` owns that layout and is not in this group). No digest/manifest
(`dl-031`).

### `red` (developer) — 2026-09-16

**1. Real-CLI reproduction (AC1).** Built `npx tsc -p tsconfig.build.json` (exit 0) and ran the
compiled `dist/cli.js` in a throwaway git repo *outside* the worktree. `init` succeeded (exit 0) and
wrote the ten `directives/custom/*.md`; the generated `architecture.md` frontmatter was, verbatim:

```
---
name: architecture
kind: custom
ref: [P3.8]
---
```

and `wingfoil directives list` then failed, verbatim (paths shortened to `<scratch>`):

```
error: E_VALIDATION id (<scratch>/.wingfoil/directives/custom/architecture.md): Invalid input: expected string, received undefined; E_VALIDATION type (<scratch>/.wingfoil/directives/custom/architecture.md): Invalid input: expected "directive"; E_VALIDATION title (<scratch>/.wingfoil/directives/custom/architecture.md): Invalid input: expected string, received undefined
DIRECTIVES_LIST_EXIT=1
```

Exactly the three fields `bug-006` names, on exactly the file `bug-006` predicts.

**2. Generator-level failing tests (AC2/AC3).** `test/storage/templates.test.ts` — new block
`templateScaffold directive output satisfies the real DirectiveFrontmatter schema (bug-006)`,
alongside the existing `bug-005` block: per template, every scaffolded `directives/**/*.md`
frontmatter must `safeParse` against the real `DirectiveFrontmatter`; must carry `id` equal to the
filename stem, `type: directive`, and a non-empty `title`; and every directive id the scaffolded
`roles.yaml` binds must actually be scaffolded (the `resolveRoleDirectives` key).

**3. The `task-057` ordering hazard, reproduced (`test/core/builtin-integrity.test.ts`).** New block
feeding the REAL `directiveMd()` bytes through the REAL guard: each scaffolded directive is re-homed
under `BUILTIN_DIRECTIVES_DIR`, passed through `builtinTemplateSources` exactly as
`initWingfoilProject` guard 5 does, then `verifyBuiltinTemplates`. Observed failure, verbatim:

```
● verifyBuiltinTemplates accepts the real init directive generator output (bug-006) › Scrum: every generated directive passes the REQ-SEC-10 guard (init does not abort)

    expect(received).toBeNull()

    Received: {"kind": "directive", "message": "built-in directive template integrity check failed: architecture", "name": "architecture"}
```

— character-for-character the message `task-044` and its reviewer reported, and the one
`task-057`'s Implementation Notes quote.

**Red totals (observed):** `npx jest test/storage/templates.test.ts test/core/builtin-integrity.test.ts
--maxWorkers=2` → `Test Suites: 2 failed, 2 total` / `Tests: 8 failed, 34 passed, 42 total`. The 8
failures are 6 in `templates.test.ts` (3 assertions × 2 templates) + 2 in `builtin-integrity.test.ts`
(1 × 2 templates); the `scaffolds at least one directive document to validate` guard passed already
(it only pins that the block is not vacuous).

### `green` (developer) — 2026-09-16

**One change, in one function:** `directiveMd()` in `src/storage/templates.ts` now emits

```
---
id: architecture
name: architecture
type: directive
kind: custom
title: "Architecture"
ref: [P3.8]
---
```

i.e. `id` + `type: directive` + `title` **added**; `name`, `kind`, `ref` keep the exact values they
had. Strictly additive — no existing field changed value, so no consumer that already read the old
frontmatter can regress. The generator stays pure (fixed strings from the `DIRECTIVES` table, no
clock/random), so `init` remains byte-identical run to run (REQ-SYS-07); the existing determinism
tests still pass. Field-by-field against `DirectiveFrontmatter` / `spec-013`: `id` string (filename
stem), `name` string, `type` literal `directive`, `kind` string, `title` string, `ref` optional
string[] — all five required fields present, `tags` legitimately omitted (optional).

`title` is quoted, `id`/`name` are not — the same style the ten real stand-ins under
`docs/self/.wingfoil/directives/custom/` use.

**Observed after the change (no other file touched):**
- `npx jest test/storage/templates.test.ts test/core/builtin-integrity.test.ts --maxWorkers=2` →
  `Test Suites: 2 passed, 2 total` / `Tests: 42 passed, 42 total` (was 8 failed).
- Full suite `npx jest --maxWorkers=2` → `Test Suites: 69 passed, 69 total` /
  `Tests: 889 passed, 889 total`.

**End-to-end on the real compiled CLI** (rebuilt `dist/`, fresh `git init` repo outside the worktree,
transcript trimmed to the shape — the full listing is in the task report):

```
$ wingfoil init --template Scrum
INIT_EXIT=0
$ wingfoil directives list
[
  {
    "path": "directives/custom/architecture.md",
    "frontmatter": { "id": "architecture", "name": "architecture", "type": "directive",
                     "kind": "custom", "title": "Architecture", "ref": ["P3.8"] }
  },
  ... all ten directives, architecture → traceability ...
]
DIRECTIVES_LIST_EXIT=0
```

All ten scaffolded directives listed; exit 0. AC1 met on the real binary, not only in Jest.

### `refactor` (developer) — 2026-09-16

No structural refactor: the fix is six lines inside one pure generator, and the surrounding code was
already reworked by `task-044` hours ago — reshaping it again would only collide with `task-057`.

One documentation correction, in the file this task touches: `builtinTemplateSources`' doc comment
still said the ordering hazard means "`bug-006`/`task-064` must land first". That sentence is stale
the moment this branch lands, and a stale pointer is exactly what the next reader of that function
(`task-057`) would rely on. Rewritten to state the hazard's CURRENT status and to name the test that
proves it, with the residual caveat kept explicit (a built-in asset authored some other way still has
to satisfy its own pillar schema). `directiveMd()` also gained a doc comment carrying the spec-013 /
`resolveRoleDirectives` rationale, so the `id = filename stem = roles.yaml key` coupling is stated
where the next editor will see it.

**Gates — all observed, in this worktree, after the change:**

| Check | Command | Result |
|---|---|---|
| `tests.passing` | `npx jest --maxWorkers=2` | `Test Suites: 69 passed, 69 total` / `Tests: 889 passed, 889 total` |
| `tests.coverage(min: 80)` | `npx jest --coverage --maxWorkers=2` | global **98.17 %** stmts / 88.88 % branch / 98.2 % funcs / 98.73 % lines; touched files `storage/templates.ts` 100 % stmts, 95 % branch (the one uncovered branch is the pre-existing path-sort comparator) and `core/builtin-integrity.ts` 100 % across the board |
| `docs.api.build` + `docs.api.public-complete` | `npm run docs:api` | exit **0**, no TypeDoc warning or error emitted |
| (build) | `npx tsc -p tsconfig.build.json` | exit **0** |
| `lint.clean` (`dl-034`, hard-reject) | `npx eslint .` | exit **0**, no output |

### `review` (developer side) — 2026-09-16

**`tests.bdd.run`.** Acceptance suites for the features this task touches —
`P5.1.1-init.feature` (`test/cli/init-command.test.ts`, `test/core/init-project.test.ts`,
`test/cli/journey-0a.integration.test.ts`), `P3.4-directives-list` / `P3.5-project-directives`
(`test/directives/schema.test.ts`, `test/core/loaders.test.ts`, `test/core/context.test.ts`),
`P3.8`/`P4.17` integrity (`test/core/builtin-integrity.test.ts`) and the generator itself
(`test/storage/templates.test.ts`): `Test Suites: 8 passed, 8 total` / `Tests: 124 passed, 124
total`. (The `error: unknown command 'agent'` / `E_VALIDATION paths.sources` lines in that output are
pre-existing negative-path fixtures printing on stderr inside passing tests, not failures.)

**Full suite, final run:** `npx jest --maxWorkers=2` → `Test Suites: 69 passed, 69 total` /
`Tests: 889 passed, 889 total`, 0 failed, 0 skipped.

**AC status (observed, not inferred):**
- AC1 — real CLI, fresh repo: `init --template Scrum` exit 0, `directives list` exit 0 listing all
  ten directives. **Met.**
- AC2 — every scaffolded directive frontmatter carries `id` (= filename stem), `type: directive`,
  `title`, and validates against the real `DirectiveFrontmatter`/`spec-013`. **Met.**
- AC3 — failing-first tests for that generator (`src/storage/templates.ts`) exist and were observed
  red before the fix. **Met.**

**`bug.sync_state`.** `bug-006-init-directive-scaffold-schema-invalid` moved `in-progress →
in-review` in the same commit as this submit; it is this bug's only fix task, so its state tracks
this task 1:1 (plan §2).

---

### For `task-057-builtin-directive-templates` (read via the `dl-015` gate)

**Is the ordering hazard closed? YES — for anything `directiveMd()` generates, and that is proven,
not asserted.**

What was true before this task: `wingfoil init` computes `templateScaffold(...)`, derives its
built-in sources from it (`builtinTemplateSources`), and schema-checks them in guard 5 of
`initWingfoilProject` **before writing anything**. Feeding the real generator output through that
guard failed on the first directive with
`built-in directive template integrity check failed: architecture` — so adding any
`directiveMd()`-generated file under `.wingfoil/directives/built-in/` would have aborted `init` for
every user. Reproduced here in `red`, verbatim, before touching the generator.

What is true now: that same property test — `test/core/builtin-integrity.test.ts`,
`verifyBuiltinTemplates accepts the real init directive generator output (bug-006)` — re-homes every
scaffolded directive under `BUILTIN_DIRECTIVES_DIR`, derives sources exactly as guard 5 does, and
asserts `verifyBuiltinTemplates(...) === null`. It passes, for every registered template, and it is
written as a property over `TEMPLATES` so it keeps biting if a directive or template is added later.

**Three things it does NOT cover — your job, not this task's:**
1. **`kind`.** `directiveMd()` hard-codes `kind: custom`, correct for the only place the scaffold
   writes directives today (`directives/custom/`). A P3.8 built-in template should carry
   `kind: built-in`; `spec-013` keeps `kind` a plain `string` so that needs no schema change, but the
   generator needs a `kind` input (or its own built-in generator) if you reuse it. Schema-valid either
   way — this will not abort `init` — but `kind: custom` on a built-in file would be semantically
   wrong.
2. **Frontmatter you author some other way.** The guard checks the bytes actually scaffolded. A
   built-in `.md` written by hand or by a new generator must satisfy `DirectiveFrontmatter`
   (`id`, `name`, `type: directive`, `kind`, `title`) on its own — the guard classifies by
   **directory**, not extension, so anything non-dotfile you drop under `directives/built-in/` is
   checked.
3. **Duplicate ids across `built-in/` + `custom/`.** The scaffold currently ships the six P3.8
   category names (`architecture`, `code-quality`, `code-review`, `documentation`, `security`,
   `testing`) as `custom/` stand-ins with `id` = the stem. If you install built-ins under the same
   ids, `resolveRoleDirectives` (`src/core/context.ts`, spec-012 §5) deduplicates by id keeping the
   **smallest path**, i.e. `directives/built-in/...` wins over `directives/custom/...` — that is an
   explicitly *unspecified* precedence in spec-012 (it notes no built-in-vs-custom override rule was
   ever ratified), not a decision this task made. Decide it deliberately (and probably drop or rename
   the stand-ins the built-ins replace, per `CLAUDE.md` §3) rather than inheriting it by string order.

### Deviations / left for others

- **`name` kept as the slug.** `spec-013` describes `name` as the "human-readable directive name",
  and the ten real stand-ins under `docs/self/.wingfoil/directives/custom/` use `name: "Architecture"`
  with `id: architecture`. The scaffold emits `name: architecture` (slug) for both. Deliberately left
  unchanged: the fix is additive by design, `name` was already present and schema-valid
  (`z.string()`), and the generated `roles.yaml` header says it binds "by NAME" — with
  `id === name === stem` that comment stays true under either reading, whereas changing `name` alone
  would have made it false. Flagged rather than silently changed; a follow-up may align it with the
  stand-ins, and would then want to reword that generated comment (which in fact describes the
  resolver's `id` lookup).
- **Storage layout untouched.** `directives/{built-in,custom}` and their git-tracking are
  `task-054-project-directives`' (P3.5) scope; nothing here required a layout change, so none was
  made.
- **No digest/manifest/checksum** anywhere near `builtin-integrity` — `dl-031` ratified schema
  validation *as* the REQ-SEC-10 contract.
- **Not touched** (concurrent tasks): `src/core/index.ts`, `src/mcp/`, `package.json`.
