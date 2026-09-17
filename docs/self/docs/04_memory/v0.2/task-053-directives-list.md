---
id: "task-053-directives-list"
type: task
title: "Implement `wingfoil directives list`"
status: in-progress
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
