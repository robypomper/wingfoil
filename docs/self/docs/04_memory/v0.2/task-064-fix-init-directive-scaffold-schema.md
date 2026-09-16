---
id: "task-064-fix-init-directive-scaffold-schema"
type: task
title: "Fix bug-006: `init` must scaffold directive .md that pass the directives schema"
status: in-progress
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
