---
id: "bug-084-dna-key-alias-writes-unschemad-keys"
type: bug
title: "`DNA_KEY_ALIASES` rewrites only a path's first segment, so an old-shape key path lands as an unschema'd key inside `stacks` and is committed at exit 0"
status: in-review
severity: "medium"
release-origin: "v0.2"
release: "v0.2"
feature: "P2.1"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`DNA_KEY_ALIASES` maps `tech_stack` to `stacks` and is applied to **the first path segment only**. It
exists because `stacks` replaced the old fixed-key `tech_stack` object — a change of *shape*, not just
of name — so translating the first segment and leaving the rest of an old path untouched produces a
path that resolves nowhere in the new schema.

It is not rejected. `Stacks` passes unknown keys through, so the write validates, commits, and leaves
a key that no schema defines inside the pillar every other pillar reads.

## Steps to Reproduce

Measured on a scratch project on 2026-09-23 against the CLI built from `main`:

```
$ wingfoil dna set 'tech_stack.cli.framework' 'Commander'
→ exit 0, commits `wf(dna): set tech_stack.cli.framework`

$ # read the file back
stacks keys: ['technologies', 'methodologies', 'cli']
stacks.cli: {'framework': 'Commander'}
```

`stacks.cli.framework` exists in no schema. The value was accepted because the object is a
pass-through, and `setDnaValue` creates intermediate objects for any segment it cannot descend into.

## Expected Behavior

Either the alias translates the old *shape* as well as the old name — `tech_stack.cli.framework` was a
fixed-key lookup and its successor is an entry in the `stacks.technologies` list, which is not a path
rewrite at all — or the alias is removed and the old path is rejected as the unknown key it is.

`spec-002` §Migration records the rename and says plainly that "any consumer that read
`tech_stack.<key>` must now scan" the lists. A first-segment alias cannot honour that sentence, and
silently pretending it can is worse than not aliasing.

## Actual Behavior

The command succeeds, commits, and the file grows a key nothing reads and nothing validates.

## Notes

**Two defects meet here and both are worth separating.**

The first is the alias itself: a one-entry table doing a job that needs a shape migration. It could be
removed outright — `tech_stack` is an old path that no current document uses — and the failure would
then be an honest "unknown key" rather than a silent success.

The second is that **an unknown key is writable at all**, which is `passthrough()` doing what it is
for. Pass-through on *read* is deliberate and defensible: a document carrying fields a newer WingFoil
does not know should still load. Pass-through on *write* means `dna set` can invent any key it likes,
in any section, and commit it. `dna set nonsense.at.any.depth value` is the general case; the alias
merely makes it reachable by accident rather than by typo. Whichever way the alias is settled, the
write path deserves its own answer.

**Where this sits among the open DNA work.** It is not the baseline class (`dl-080`): nothing here
depends on the working tree versus the committed state, and `dl-080`'s rule would not have prevented
it. It belongs with `bug-083` and `dl-081-dna-mutation-surface-shape`, which is deciding what the DNA
mutation surface should be — and `dl-081` records this measurement under its option (E) discussion,
because a `--field` that accepts a path would inherit exactly this traversal unless the traversal is
made structure-aware first. That prerequisite is shared with option (B).

## Triage & Execution Notes

- triage (2026-09-23): **medium**. No audit record is corrupted and no authority fabricated, and the
  only paths that reach it are an obsolete prefix or a typo. It is not low because it succeeds
  *silently* in the pillar every other pillar reads, and because the general form — any unknown key is
  writable and committable — is wider than the alias that exposed it.
- No fix task filed: the alias half is a few lines, but the pass-through-on-write half is a decision
  about `dna set`'s contract and belongs under `dl-081`.
