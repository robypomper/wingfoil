---
id: "bug-148-directive-global-scope-declared-twice"
type: bug
title: "A directive's `scope: global` frontmatter and `roles.yaml`'s `global:` list are two independent declarations of the same fact, and only the second one is ever consulted"
status: triaged
severity: "low"
release-origin: "v0.2"
release: "v0.3"
feature: "P3.7"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

Whether a directive applies to every role is decided by `roles.yaml`'s `global:` list alone. A
directive file can also carry `scope: global` in its own frontmatter, but `DirectiveFrontmatter`
(`src/directives/schema.ts`) declares no `scope` field at all, so that value is silently dropped:
`directives list` reports `"global": false` for such a directive and its own warnings array says
nothing is wrong, while a separate stderr line most callers will never look at says the field was
ignored.

## Steps to Reproduce

Reproduced against `wingfoil@0.2.1`, fresh project (`init --template Kanban`):

1. `grep -n "id: \|name: \|type: \|kind: \|title: \|tags: \|ref: " src/directives/schema.ts` (the
   `DirectiveFrontmatter` object) → no `scope` key anywhere in the schema.
2. Add `scope: global` to `.wingfoil/directives/built-in/code-quality.md`'s frontmatter (a directive
   `roles.yaml`'s own `global:` list does **not** name — `grep -n "global:" -A2 .wingfoil/roles.yaml`
   confirms `code-quality` is absent from it).
3. `wingfoil directives list --format json 2>err.txt`:
   - stderr (`err.txt`): `Warning: .../directives/built-in/code-quality.md: unknown field(s)
     ignored: scope`
   - stdout: the `code-quality` entry's frontmatter *does* echo back `"scope": "global"`
     (`.passthrough()` keeps the raw value in the printed object), but the entry's own computed
     fields read `"global": false, "assignment": "developer, ..."` — i.e. the value that actually
     drives behaviour ignores the frontmatter completely — and the payload's own `"warnings": []`
     is empty, so nothing in the JSON result itself signals the disagreement.

## Expected Behavior

Either `scope: global` in a directive's frontmatter is a recognized field that reconciles with
`roles.yaml`'s `global:` list (with a defined precedence, or a validation error when the two
disagree), or the field is not accepted as frontmatter at all and `directives list`'s own
`warnings` array — not only a separate stderr line — surfaces the disagreement.

## Actual Behavior

Two independent sites can each claim a directive is (or is not) global, only one of them is load-
bearing, and the JSON contract's own `warnings` field gives no indication that the other site exists
and was ignored.

## Notes

- Root cause: `scope` was apparently intended as a directive-level declaration at some point (it
  appears as frontmatter on directive files) but `roles.yaml`'s `global:` list was chosen as the
  actual resolution mechanism, and the schema was never updated to either accept and reconcile
  `scope`, or reject it as invalid frontmatter outright rather than silently passing it through.
- Gate: `dev-loop`'s directive tests check `roles.yaml`-driven resolution but never assert on a
  directive file carrying `scope:` frontmatter, so the two-sites-disagree shape was never exercised.
- Fix: pick one source of truth. If `roles.yaml` remains authoritative, reject `scope:` frontmatter
  with a schema error (not a swallowed passthrough warning) so an author is told immediately that the
  field does nothing; if frontmatter should instead be authoritative (or additive), teach the
  directive loader to fold it into the same `global` set `roles.yaml` populates.

## Triage & Execution Notes

- capture: filed by the v0.2 retrospective (retro-v0.2); reproduced independently on the stock
  scaffold's own `code-quality` built-in directive.
