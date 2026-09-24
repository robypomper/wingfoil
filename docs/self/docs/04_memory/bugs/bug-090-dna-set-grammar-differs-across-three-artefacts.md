---
id: "bug-090-dna-set-grammar-differs-across-three-artefacts"
type: bug
title: "`dna set`'s grammar is specified three different ways — positional in the code and its specs, `--field`/`--value` in the approved vision reference, and the vision layer is the one that wins"
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

`docs/01_vision/X_cli-cmds.md` (**Version 1.2, Status: Approved**) specifies:

> `wingfoil dna set [--field FIELD] [--value VALUE]` — Define/update project DNA field (interactive or
> flag-based) … Supports nested fields (e.g., `--field tech-stack.backend --value nodejs`)

The shipped command is **positional** — `wingfoil dna set <key> <value>` — as `task-025` built it and
as `P2.1`, `spec-002` and `spec-008` codify it. So the same command has two grammars in two
artefacts, and `dl-081` has just ratified the **option** form for three *new* verbs without anyone
noticing the vision layer already used it for `set` itself.

## Steps to Reproduce

```
$ grep -n 'dna set' docs/01_vision/X_cli-cmds.md
→ wingfoil dna set [--field FIELD] [--value VALUE]

$ node dist/cli.js dna set --help
→ positional: dna set <key> <value>
```

`X_cli-cmds.md`'s status line reads `**Status:** Approved`, version 1.2.

## Expected Behavior

One grammar per command, stated once, and the layers agree — or, where they deliberately differ, the
difference is recorded rather than latent.

## Actual Behavior

Three artefacts describe `dna set` and two of them disagree about how it is invoked. The disagreement
has survived the command being built, specified twice, and used throughout this release.

## Notes

**The layer that disagrees is the authoritative one.** CLAUDE.md §10.1 and the project's own golden
rule put `docs/01_vision/` and `docs/02_requirements/` above configuration and code: *specs win*. On
that reading the implementation and its two specs are the ones that diverged, not the vision. That is
uncomfortable and is precisely why this needs a ruling rather than a patch — "fix the vision doc"
is the intuitive move and the one §10.1 forbids doing casually.

**Three questions the ruling has to separate**, because they have different answers:

1. Should `dna set` **also** accept `--field`/`--value`? `dl-081` ratified that form for
   `add|remove|update`, so accepting it for `set` would make the pillar uniform — and the vision doc
   already asks for it. Against: `set` is positional in two approved specs and every existing caller.
2. The reference also carries the **stale shape** `tech-stack.backend`, which the current schema does
   not have (`stacks.technologies` is a list) — the same staleness `bug-089` records in the BDD
   feature. That half is a straightforward correction whichever way (1) goes.
3. It also describes an **interactive mode** (`interactive or flag-based`) that `dna set` does not
   have and that no spec mentions. Is that a dropped requirement or an aspiration that was never
   scheduled? Nobody has established which.

**Read together with `bug-089`, this is one problem seen twice.** That bug has an acceptance contract
describing a shape the schema retired; this one has the vision reference describing a grammar the
implementation never had. The `dna set` contract is stated in at least four places — vision
reference, BDD feature, `spec-002`, `spec-008` — and they have drifted apart without anything
comparing them.

## Triage & Execution Notes

- triage (2026-09-24): **medium**. No user is affected and nothing is broken; the cost is that the
  authoritative description of a shipped command is wrong, and that `dl-081` made a grammar decision
  without the benefit of knowing a higher layer had already made it.
- No fix task filed: question (1) is a ruling, (2) is a correction that follows from it, and (3) is a
  scope question that may belong to v0.3 planning.
