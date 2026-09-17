---
id: "dl-060-roles-yaml-binds-by-directive-id"
type: decision-log
title: "roles.yaml binds by directive id, not name: correct spec-011"
status: in-discussion
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`spec-011-storage-layout` (`approved`) states twice that `roles.yaml` binds directives by **name**:

- `:105` — `roles.yaml` holds an "`assignments:` map (role → list of directive names) + a `global:` list
  applied to every role";
- `:118` — "`roles.yaml` binds by directive **name**, independent of which of the two subdirectories
  currently holds the file".

Every implementation binds by **id** (`frontmatter.id`):

- `src/directives/schema.ts:56-60` on `main`, the `RolesYaml` schema's TSDoc: "`assignments` values and
  `global` entries are directive **ids** (`DirectiveFrontmatter.id`), not `name`s".
- `src/core/context.ts` (`main` at `9c83ca2`): `resolveRoleDirectives` selects files through
  `selectDirectivesById`, which deduplicates on `file.frontmatter.id` (`:90-106`).
- `task-053` (`directives list --role`, merged) filters on the same id, per its test header
  (`test/core/directives-list.test.ts:18-21`: role binding "binds on `frontmatter.id`, never `name`").
- `task-051-directive-assign` (branch `task/task-051-directive-assign`, `a74d787`, not merged):
  `src/core/directive-assign.ts:64` — `const known = new Set(directiveFiles.map((file) => file.frontmatter.id))`,
  and its module doc (`:9`) "assignment binds by id".

**The difference is behavioural, not wording.** In this repository's own configuration no directive's
`name` equals its `id` — 10 of 10 differ (`grep -m1 '^id:\|^name:'` over
`docs/self/.wingfoil/directives/custom/*.md`: `code-quality` / "Code Quality", `security-secrets` /
"Security & secrets handling", `traceability` / "Requirement traceability chain", …), and
`docs/self/.wingfoil/roles.yaml` lists ids (`code-quality`, `testing`, …). An implementation that
followed `spec-011` literally would match none of the existing bindings.

## Decision

**The code is right and the spec is wrong.** Recommended: amend `spec-011` `:105` and `:118` to "directive
**ids** (`frontmatter.id`)", keeping the rest of `:118`'s point (a binding is independent of whether the
file sits in `built-in/` or `custom/`, so promoting a stand-in requires no `roles.yaml` change — which
holds for ids exactly as it was argued for names).

Alternative considered: bind by `name` as the spec says. Rejected — it would break every existing binding
here and in every scaffolded project (the `init` scaffold also binds ids), `name` is free text with spaces
and punctuation, and nothing enforces its uniqueness while `id` is the key the loader, the dedup rule
(`dl-037`) and the shadow warning (`dl-051`) all use.

Filed as a decision-log rather than a bug because the correction is to an `approved` specification, whose
amendment the approver ratifies.

## Rationale

- Three merged tasks and one in review agree on id; a spec that contradicts all of them misleads the next
  implementer (the `task-051` review is where it surfaced).
- `id` is the only directive field that is both unique and machine-shaped.

## Actions

- Owner **approver**: ratify.
- Amend `spec-011` `:105` and `:118` in place with a dated Revision note (`dl-047`: tech-specs carry no
  `version:`). The same `spec-011` passage has separate "EMPTY today / not yet implemented" wording that
  becomes stale when `task-057` merges (`bug-040`); fixing both in one edit is cheapest.

Related: `bug-040`, `dl-037`, `dl-051`, `spec-011`, `spec-012` §5, `src/directives/schema.ts`,
`task-051-directive-assign`, `task-053`, `task-057-builtin-directive-templates`.
