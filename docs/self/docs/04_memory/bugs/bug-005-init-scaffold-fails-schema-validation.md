---
id: "bug-005-init-scaffold-fails-schema-validation"
type: bug
title: "wingfoil init scaffolds a dna.yaml/memory.yaml that immediately fail their own schemas — dna show/set, paths, and memory add all error on a freshly-initialized project"
status: resolved
severity: "critical"
release-origin: "v0.1"
release: "v0.1"
feature: "P5.1.1"
tmpl_version: 260703
---

## Summary

`wingfoil init` (any template — Scrum or Kanban) scaffolds a `.wingfoil/dna.yaml` that fails
`spec-002-dna-yaml-schema`'s own `DnaYaml` Zod schema, and a `.wingfoil/memory.yaml` whose types
carry no `id_pattern` — so every subsequent read/write command on a freshly-initialized project
(`dna show`, `dna set`, `paths`, `memory add`) errors immediately, exit `1`. Only `memory search`
(which never loads `dna.yaml`) works out of the box. Discovered while writing `task-032`'s
README quick-start: the documented `init → dna show → dna set → memory add → memory search →
paths` cycle (the AC's own required walkthrough) cannot complete as shipped.

## Steps to Reproduce

1. Build the CLI: `npm run build` (produces `dist/cli.js`).
2. In a fresh temp git repo (with a git identity configured): `node dist/cli.js init --template Scrum`
   (exit 0, `.wingfoil/` scaffolded).
3. `node dist/cli.js dna show` → errors (see below), exit `1`.
4. `node dist/cli.js paths` → errors the same way, exit `1` (it also loads `dna.yaml`).
5. `node dist/cli.js memory add --type task --title "My first task"` → errors (see below), exit `1`.

## Expected Behavior

Per `spec-011-storage-layout`/P5.1.1, `wingfoil init`'s output is meant to be immediately usable:
`dna show`, `dna set`, `paths`, and `memory add` should all succeed against the freshly-scaffolded
`.wingfoil/` with no manual repair step.

## Actual Behavior

`dna show`/`paths` (both load `.wingfoil/dna.yaml` through the real `DnaYaml` schema,
`src/dna/schema.ts`):

```
error: E_VALIDATION stacks.methodologies.0 (.../.wingfoil/dna.yaml): Invalid input: expected object, received string; E_VALIDATION stacks.methodologies.1 (...): Invalid input: expected object, received string; E_VALIDATION stacks.methodologies.2 (...): Invalid input: expected object, received string; E_VALIDATION team.members (...): Invalid input: expected array, received undefined; E_VALIDATION team.roles.0 (...): Invalid input: expected object, received string; ... (team.roles.1 .. team.roles.6 likewise)
```

`memory add --type task --title "..."`:

```
error: memory type 'task' has no id_pattern/template in memory.yaml
```

(and identically for every other type — `adr`, `bug`, `decision-log`, `release`, `release-line`,
`tech-spec` — since none of the seven scaffolded type entries declares `id_pattern`.)

`dna set` cannot repair either defect: it only overwrites a single dotted key path with a **string**
leaf value (`src/dna/set.ts`'s `setDnaValue`), so it has no way to turn an already-present
`stacks.methodologies: [Scrum, ...]` (strings) into `[{name: Scrum}, ...]` (objects), or to populate
the missing `team.members: []` array, or `memory.yaml`'s missing `id_pattern` keys — there is no
`dna set`/`memory` workaround available to the end user.

## Notes

- **Root cause (two independent generator bugs, same file, same function-shape mistake — the
  generator was never round-trip-validated against the schema/consumer it feeds):**
  `src/storage/templates.ts`:
  - `dnaYaml(def)` writes `stacks.methodologies` as a bare string list
    (`def.methodologies.map((m) => \`    - ${m}\`)`) where `DnaYaml`'s `Stacks.methodologies` is
    `z.array(MethodologyEntry)` — `MethodologyEntry = {name, phase?, notes?}` (`src/dna/schema.ts`).
    It also writes `team.roles` as a bare string list where `Team.roles` is `z.array(RoleEntry)`
    (`RoleEntry = {name, description?}`), and never writes `team.members` at all, though
    `Team.members` is a **required** (if possibly empty) array.
  - `memoryYaml()` writes each type's `path`/`template` block but never an `id_pattern` — required by
    `memoryAddFn` (`src/core/index.ts`) even though the `memory.yaml` schema itself
    (`src/memory/schema.ts`) marks `id_pattern` merely `.optional()`.
- **Suggested fix:** make `dnaYaml(def)` emit `stacks.methodologies` as `- name: <m>` entries,
  `team.roles` as `- name: <role>` entries, and add `team.members: []` (valid empty array — the
  `Team` schema's `.superRefine()` role cross-check is vacuous over an empty `members`); make
  `memoryYaml()` emit an `id_pattern` per type (e.g. mirroring this repo's own dogfooded scheme:
  `task-{n}-{slug}`, `adr-{n}-{slug}`, `bug-{n}-{slug}`, `dl-{n}-{slug}`, `release-{n}`, `rl-{n}`,
  `spec-{n}-{slug}`). Add a regression test asserting `templateScaffold(...)`'s generated
  `dna.yaml` round-trips through `DnaYaml.safeParse` and every `memory.yaml` type entry declares
  `id_pattern`, for every registered template (`test/storage/templates.test.ts`) — the gap this bug
  reports is exactly the assertion that test suite never made.
- Neither `task-018-storage-scaffold-skeleton` (minimal skeleton) nor `task-029-implement-wingfoil-init`
  (this complete layout) exercised `templateScaffold`'s output against `src/dna/schema.ts` or
  `memoryAddFn`'s `id_pattern` requirement — each pillar's own unit tests use hand-written, already-valid
  fixtures (e.g. `test/core/dna-set.test.ts`'s `DNA_FIXTURE`), so this integration gap between
  `src/storage` and `src/dna`/`src/core` was never exercised end-to-end until this task's manual
  CLI walkthrough.
- Fixed inline as part of `task-032` (see that task's Execution Notes) rather than deferred to a
  separate fix task: the change is a narrow, mechanical correction to two pure string-template
  generator functions (no design change, no new schema), and `task-032`'s own AC — a genuinely
  working `init → dna show → memory add → memory search → paths` quick-start — is not achievable
  at all without it. Flagged here for the record and for the reviewer to confirm that scope call.

## Triage & Execution Notes

- 2026-07-07 (open): raised from `task-032-readme-cli-quickstart`'s manual end-to-end CLI
  verification. Severity **critical** — blocks the documented v0.1 quick-start for every fresh
  project, on every template, with no available workaround. Fixed inline in the same branch as
  `task-032` (see that task's Execution Notes for the commit); this record exists for traceability
  and so the reviewer can independently assess the scope decision.
- 2026-07-08 (triaged): confirmed **critical**. Retroactive `bug.sync_state` catch-up — the fix
  was made opportunistically inside `task-032` (a docs task with no `bug:` binding), so dev-loop's
  `bug.sync_state` never fired and the per-phase bug transition commits were missed at the time.
  Re-emitting the lifecycle now (`open → triaged → planned → in-progress → in-review → resolved`)
  so the audit trail is complete; `resolved → closed` left to the approver.
