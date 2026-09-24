---
id: "bug-091-entry-names-containing-a-dot-are-unaddressable"
type: bug
title: "An entry whose `name` contains a dot cannot be addressed by the ratified `--field` path, and the schema does not forbid such names"
status: open
severity: "medium"
release-origin: "v0.2"
release: ""
feature: "P2.1"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`dl-081` ratified `--field` as a **full dotted path** with collection entries addressed by their
`name`. The path is split on `.`, so an entry whose `name` itself contains a dot cannot be reached:
`--field modules.a.b.path` resolves `a` as the entry name and then looks for a field `b`, rather than
addressing the entry named `a.b`.

`src/dna/schema.ts` places **no constraint** on the characters a `name` may contain.

## Steps to Reproduce

1. Add an entry whose `name` contains a dot — a module named `core.v2`, a technology named
   `node.js`, a role named `qa.lead`.
2. Try to address one of its fields: `dna update --field modules.core.v2.path --value src/core`.
3. The path resolves `core` as the entry name and `v2` as a field of it, so the command refuses —
   and there is no spelling that reaches the entry.

Names containing dots are ordinary in the domains this schema describes: `node.js`, `socket.io`,
`asp.net` are all plausible `stacks.technologies` entries.

## Expected Behavior

Either the addressing form can reach every entry the schema permits, or the schema forbids the names
it cannot reach — and says so where an author writes one.

## Actual Behavior

The schema permits a name the addressing cannot express, and nothing reports it. An author only finds
out when a command refuses a path that looks correct.

## Notes

**Same family as the uniqueness prerequisite, and the same reasoning applies.** `dl-081` promoted
name uniqueness from an open question to a *prerequisite* once entries were addressed by name, and
`task-093` implemented a `superRefine` enforcing it. Addressability is the other half of that same
decision: by making `name` the addressing key, the ratification made two properties of `name`
load-bearing — that it is unique, and that it is expressible in a dotted path. Only the first was
noticed.

**Three candidate answers, and they are genuinely different:**

1. **Forbid dots in `name`** by extending the refinement `task-093` added. Cheapest, and consistent
   with uniqueness having gone the same way — but it forbids `node.js`, which is a real thing someone
   will want to record.
2. **Quote or escape** in the path (`modules."core.v2".path`, or `\.`). Keeps names free, at the cost
   of a parsing rule in the grammar `spec-008` pins.
3. **Address by index as a fallback** where a name is unexpressible — which `dl-081` explicitly
   rejected as the *primary* form because indices shift, but which as an escape hatch does not carry
   that objection.

Not to be resolved inside a fix task: it changes either the schema or the grammar, both of which are
`dl-081`'s ground, and the answer affects what `--field` means everywhere.

**Found by `task-093`'s reviewer as an observation rather than a defect in the delivered work.** No
entry in this repository's `dna.yaml` or in either `init` template currently carries a dot in a name,
so nothing is broken today — it is a gap between two ratified properties that has not yet been hit.

## Triage & Execution Notes

- triage (2026-09-24): **medium**. Nothing currently fails: no existing entry has a dotted name. It is
  not low because the addressing convention is newly ratified and being built now, so this is the
  cheapest moment to settle it — and because `node.js` in `stacks.technologies` is the first thing a
  real project would write.
- No fix task filed: the three candidates change the schema, the grammar spec, or both, so it is a
  decision before it is work.
