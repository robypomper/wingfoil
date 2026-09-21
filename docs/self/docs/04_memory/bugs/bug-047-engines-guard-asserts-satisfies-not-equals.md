---
id: "bug-047-engines-guard-asserts-satisfies-not-equals"
type: bug
title: "The engines guard task-074 specifies asserts only that our floor SATISFIES every dependency — an over-tight floor passes, and nothing states the equality half"
status: open
severity: "low"
release-origin: "v0.2"
release: ""
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

The regression guard specified by `bug-023` and `task-074` AC3 asserts one direction only — that every
dependency's `engines.node` range is **satisfied by** ours. Nothing asserts the other direction, so a
floor set arbitrarily higher than the dependency tree requires (`>=24`, `>=26`) passes the guard while
needlessly excluding users, and no artefact anywhere states that the floor should **equal** the
highest floor in the production closure.

## Steps to Reproduce

Measured 2026-09-21 in a clean worktree of `main` at `bcc66a9`.

1. Read the guard as specified. `task-074-fix-engines-node-floor` AC3:

   > **The regression guard exists.** An assertion in `test/cli/publish-metadata.test.ts` that
   > **every** dependency's `engines.node` range is satisfied by ours, so the next dependency bump
   > cannot reintroduce the contradiction silently.

   and `bug-023-engines-node-floor-contradicts-commander`, Notes → "Fix shape":

   > pin it with an assertion in `publish-metadata.test.ts` that every dependency's `engines.node`
   > range is satisfied by ours

   Both are one-sided: `ours ⊨ every dependency`. Neither constrains `ours` from above.

2. Confirm the guard does not exist yet, so this is a specification defect, not a code defect:

```
$ grep -n "engines" test/cli/publish-metadata.test.ts
(no output)
$ grep -rn "engines" test/
(no output — no test under test/ makes any engines assertion)
$ wc -l test/cli/publish-metadata.test.ts
158
```

3. Confirm what the guard would *not* catch. The highest floor in the production closure is
   `commander@15.0.0` `>=22.12.0` (85 closure entries, 58 declaring `engines.node`, 2 above
   `>=18.0.0` — see `adr-010-node-22-runtime-floor` E1). Setting `engines.node` to `>=24.0.0`,
   `>=26.0.0` or any higher value satisfies all 58 and passes the guard as written, while excluding
   every user on Node 22 and 23 for no reason the tree supports.

## Expected Behavior

The guard pins the floor from both sides, or an artefact states explicitly that only the lower bound
is contractual and an over-tight floor is a deliberate, reviewable choice.

## Actual Behavior

Only the lower bound is specified. An over-tight floor is indistinguishable from a correct one to
every check the project has or plans.

## Notes

### One received framing did NOT hold, and is corrected here

This bug was raised on the understanding that `spec-015-packaging-publishing` §1 says the floor "must
equal" the highest floor in the production closure, creating a contradiction with the weaker guard.
**It does not.** Checked directly:

```
$ grep -n "engines\|must equal\|highest\|closure\|floor" \
    docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md
24:`bin.wingfoil`, `files`, `main`, `types`, `engines`, `license`, `keywords`, and `build`/`prepack`
60:Unchanged: `name: wingfoil`, `main`, `types`, `engines: node >=18`, `license: MIT`. `version` is
```

spec-015 §1's only statement about `engines` is at `:60`, listing it under **"Unchanged"** with the
literal value `node >=18` — a hard-coded number, not a rule relating it to anything. There is no
"must equal" prose to loosen.

That makes the real defect **worse, not milder**: the project has *no* stated rule for how the
declared floor relates to the dependency tree in either direction. It has a stale literal in an
`approved` spec (`>=18`, which `task-074` AC4 will replace with another literal) and a one-sided
assertion in a task's AC. Nothing says what the floor *means*.

### Two ways to close it — pick one, they are alternatives

1. **Add the equality half.** Assert `ours == max(declared floors in the production closure)` and
   state that rule in `spec-015` §1, replacing the literal with the rule that produces it. This
   removes the hard-coded number from the spec entirely and makes the next dependency bump
   self-documenting. Cost: the assertion fails the moment a transitive dependency raises its floor —
   which is arguably the point, but it makes an unrelated dependency bump a red build.
2. **Loosen the prose deliberately.** Keep the satisfies-only guard and state in `spec-015` §1 that
   the floor is a *lower* bound chosen by the approver, that exceeding the tree's maximum is
   permitted, and why a maintainer would do it (e.g. a runtime API used in `src/` that no dependency
   declares). Cost: nothing catches an accidental over-tightening; it relies on review.

Option 1 is the stricter reading and matches `adr-010`'s actual reasoning, which picks `>=22.12.0`
*because* it is the maximum. Option 2 is honest about the fact that a floor can legitimately be
raised for reasons outside the dependency tree — `bug-049-types-node-pinned-to-superseded-floor` is an
example of the codebase's own API surface being in tension with the declared floor, and no dependency
scan would see it.

### Not a duplicate of its neighbours

- `bug-023` is the *instance*: `>=18.0.0` vs `commander@15`'s `>=22.12.0`. This bug is about the
  *rule* that would prevent the next instance in the opposite direction.
- `bug-046` is the same guard's other blind spot — the lockfile's own root `engines` copy. The two are
  independent: fixing either leaves the other open.

### Suggested fix — do NOT apply as part of this report

Decide between options 1 and 2 **before** `task-074` writes the guard, so the assertion and the spec
prose are authored together rather than the spec being amended twice. If option 1 is chosen it belongs
inside `task-074` (same file, same AC, same commit); if option 2, it is a `spec-015` revision note
only (`dl-047`: dated note + re-ratification, since spec-015 is `approved`).

Severity **low**: no current instance, no user impact, and the failure mode it guards against
(an over-tight floor) requires someone to set a number no evidence supports. It is filed because
`task-074` is about to write the guard, and writing it one-sided is cheaper to prevent than to revisit.

## Triage & Execution Notes

Raised during the v0.2 release-governance ingest (2026-09-21), from the review of
`task-074-fix-engines-node-floor` (`backlog`). Filed unfixed per the ingest plan — the agent stops at
`open`.

The "spec-015 says must equal" premise it was raised on was checked against the file and **did not
hold** (see Notes); the bug is re-stated above against what the spec actually says. Recorded rather
than silently corrected, so the discrepancy is not re-inherited.

Related: `bug-023-engines-node-floor-contradicts-commander` (`planned`, the instance),
`bug-046-lock-root-engines-never-asserted` (the same guard's other blind spot),
`bug-049-types-node-pinned-to-superseded-floor` (why a floor can legitimately exceed the tree),
`adr-010-node-22-runtime-floor` (`pending`, picks the maximum and says so),
`task-074-fix-engines-node-floor` (`backlog`, AC3/AC4), `task-059-publish-metadata` (`done`, owns
`test/cli/publish-metadata.test.ts`), `spec-015-packaging-publishing` `:60`,
`dl-047-tech-specs-carry-no-version-field` (the amendment route for an `approved` spec).
