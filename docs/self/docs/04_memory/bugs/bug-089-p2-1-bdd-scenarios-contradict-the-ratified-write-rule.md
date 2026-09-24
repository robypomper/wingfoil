---
id: "bug-089-p2-1-bdd-scenarios-contradict-the-ratified-write-rule"
type: bug
title: "`P2.1-dna-set.feature`'s first two scenarios assert a write the ratified rule refuses, and they pass today only because of the defect `bug-084` files"
status: in-progress
severity: "high"
release-origin: "v0.2"
release: "v0.2"
feature: "P2.1"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`docs/02_requirements/02_bdd/features/p2-dna/P2.1-dna-set.feature` scenarios 1 and 2 run
`wingfoil dna set tech_stack.language python` and assert the key lands under `tech_stack`. That
write passes on `main` **only** through the first-segment alias plus `Stacks`'s pass-through — the
mechanism `bug-084` records as a defect — and `dl-081`'s ratified rule refuses it: a path that does
not resolve against the schema is refused, never created.

The two cannot both hold. An acceptance contract and a ratified decision disagree.

## Steps to Reproduce

The scenarios, verbatim:

```
Scenario: Set a DNA field
  When I run "wingfoil dna set tech_stack.language python"
  Then ".wingfoil/dna.yaml" contains "language: python" under "tech_stack"
  And the change is committed to git
  And the command exits with code 0

Scenario: Update an existing DNA field
  Given ".wingfoil/dna.yaml" has "language: python"
  When I run "wingfoil dna set tech_stack.language go"
  Then the value becomes "go"
```

Run literally on `main` (`b82356e`): exit 0 and a commit — but the key lands at **`stacks.language`**,
not under `tech_stack`. The `Then` is satisfied only if `tech_stack` is read as an alias, and only
because the object passes unknown keys through.

Run on `task-093`'s branch, which implements the ratified rule: **exit 1**,
`error: unknown DNA field 'tech_stack.language': 'tech_stack' is not declared under the dna.yaml
schema`, nothing written. Both scenarios fail as written. Scenario 3 (invalid dotted path, exit 2)
still passes.

## Expected Behavior

The acceptance contract and the ratified rule describe the same behaviour.

## Actual Behavior

They describe opposite behaviours, and **no gate says so**: this repository has no automated BDD
runner — `.feature` files are prose contracts hand-mapped into Jest suites — so the contradiction is
latent. Nothing goes red; it surfaces only when someone reads both.

## Notes

**The scenarios are stale independently of `bug-084`, which is the strongest argument for which side
moves.** They are written against a schema shape `spec-002` (`approved`) has already migrated away
from: `stacks.technologies` is a **list of entries**, and there is **no `language` key anywhere in the
current schema**. `spec-002`'s own Consequences section says "any consumer that read
`tech_stack.<key>` must now scan" the lists. So the feature file encodes a shape the approved spec
retired, and it survives only because the alias and the pass-through together simulate the old shape.

**What each direction costs.** Moving the BDD means amending an acceptance contract under
`docs/02_requirements/`, which CLAUDE.md §10.1 makes authoritative over configuration — so it is a
ruling and an element, never a quiet edit, and `task-093` was right to leave it alone. Moving the rule
instead means keeping pass-through on write, which re-opens `bug-084` and unpicks the precondition
`dl-081`'s whole ratified shape rests on.

**This is not a test that needs updating — it is a contract that needs a decision.** Filing it as a
bug rather than fixing it in passing is deliberate: the same reasoning `task-093` used when it
declined to edit the file.

Related: `bug-090` records that a *third* artefact, the approved CLI reference, specifies yet another
grammar for the same command. Between them they suggest the `dna set` contract is stated in three
places that have drifted apart, which is worth seeing as one problem.

## Triage & Execution Notes

- triage (2026-09-24): **high**. Nothing is broken at runtime and no user is affected, but an
  acceptance contract that contradicts a ratified decision is exactly the kind of divergence the
  traceability chain exists to prevent — and with no BDD runner, nothing will ever report it.
- No fix task filed: the direction is the approver's to rule. Once ruled, the edit is small either
  way.

## Ruling (2026-09-24) — the acceptance contract moves

The approver ruled on 2026-09-24: **the BDD contract moves, not the ratified rule.**

The reasoning worth preserving is that this is not code-against-spec, so CLAUDE.md section 10.1 is
not in tension. The two scenarios are stale *independently* of `bug-084`: `spec-002` retired the
fixed-key `tech_stack` object in favour of two flat lists, so `stacks.technologies` is an array of
`{name, category, ...}` entries and the schema declares no `language` key anywhere. The scenarios
assert a shape no layer still describes. It is spec-against-spec, with the later and more specific
one winning.

Moving the rule instead would have meant keeping pass-through on write, which re-opens `bug-084` and
unpicks the precondition `dl-081`'s whole ratified shape rests on. That was the alternative, and it
was declined.

**The fix depends on `bug-090` and must not be scheduled before it.** What the rewritten scenarios
should *say* is settled; how they should *spell it* is not, because `bug-090` decides `dna set`'s
grammar. Rewriting them against today's positional spelling would make them stale a second time in
the same release. Sequence the two so the BDD rewrite reads the grammar `bug-090` lands.
