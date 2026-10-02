---
id: "bug-113-directives-list-warns-on-the-documented-scope-field"
type: bug
title: "`directives list` prints `unknown field(s) ignored: scope` for every global directive on every run, although `spec-013` documents `scope` as a frontmatter field"
status: closed
severity: "low"
release-origin: "v0.2"
release: "v0.3"
feature: "P3.5"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`spec-013-directive-frontmatter-schema`'s frontmatter table documents `scope`. `DirectiveFrontmatter`
does not declare it. So every directive carrying `scope: global` trips the unknown-field warning, and
`wingfoil directives list` prints

```
unknown field(s) ignored: scope
```

once per such directive, on every run — three of them today (`claim-evidence`, `doc-versioning`,
`security-secrets`).

## Steps to Reproduce

`wingfoil directives list` in any project scaffolded from a template carrying global directives.

## Expected Behavior

Either the schema declares `scope` and the warning stops, or `spec-013` stops documenting a field the
schema rejects.

## Actual Behavior

The spec and the schema disagree, and the user sees the disagreement as noise on a read-only command.

## Notes

**Decide which side moves before writing code.** The warning is not spurious — it is doing its job,
correctly, on a field nothing told the schema about. `spec-013` is `approved`, so if the field is real
the schema is the side that is wrong; if it is not real the spec is. That is a one-line change either
way and a governance question in between.

**The noise is worse than it looks on a read-only verb.** `directives list` is one of the commands a
new user runs first to see what the tool has installed, and its first output is three warnings about
the tool's own configuration. That is a bad first impression of a correctness claim the tool is
otherwise careful about.

**`bug-109` is adjacent and should probably be scheduled with it** — that one is the `src/directives/`
module TSDoc claiming `spec-013` does not exist as an approved spec. Both are the same spec and the
same file family, and both are read by whoever touches the pillar next.

## Triage & Execution Notes

- triage (2026-09-25): **low**. Nothing is wrong with the output beyond the warning, and no field is
  lost — `scope` is read from `roles.yaml`'s `global` list, not from the directive's frontmatter.
- Found by `task-094` while verifying its own binding with a live CLI run.
