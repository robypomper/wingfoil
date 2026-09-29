---
id: "bug-092-dna-set-and-dna-update-are-indistinguishable"
type: bug
title: "`dna set` and `dna update` agree on success, on refusal, on message and on exit code — the only behaviour that separated them was `bug-084`, which has been removed"
status: closed
severity: "medium"
release-origin: "v0.2"
release: "v0.2.2"
feature: "P2.1"
contributor: ""
credit: ""
tmpl_version: 260703
rejection_reason: "Closed as won't-fix on 2026-09-29 through the triaged → closed edge that dl-123 added and task-114 implemented. On 2026-09-24 the approver ruled that dna set and dna update both stay, so there is nothing to fix (480b3233, dl-123 Action 4)."
---

## Summary

Two verbs of the DNA pillar now do the same thing. `dna set` was the pillar's only writer and reached
scalar leaves by creating whatever intermediate objects its path named; `dna update` was added by
`dl-081` to reach every field including those leaves. The one behaviour that distinguished them — `set`
creating a path that does not resolve — is `bug-084`, and `task-093` removed it. What is left is one
command with two names.

The differing grammars hide this today. `dl-082` aligns them, at which point the two spellings become
identical and the overlap becomes literal rather than merely behavioural.

## Steps to Reproduce

Measured on `task-093`'s build (`9809c10d`) in a throwaway `wingfoil init --template Scrum`
repository, committed clean before each run.

1. Write an existing scalar leaf with each verb:

```
$ wingfoil dna update --field project.license --value MIT
{ "key": "project.license", "value": "MIT" }               exit 0

$ wingfoil dna set project.license Apache-2.0
{ "key": "project.license", "value": "Apache-2.0" }        exit 0
```

2. Address a path that does not resolve, with each verb:

```
$ wingfoil dna set    nonsense.deep.key val
$ wingfoil dna update --field nonsense.deep.key --value val
error: unknown DNA field 'nonsense.deep.key': 'nonsense' is not declared
under the dna.yaml schema                                  exit 1, both
```

3. Confirm nothing was created: `grep -n nonsense .wingfoil/dna.yaml` finds nothing after either run.

## Expected Behavior

Two verbs in the same pillar either do different things, or one of them does not exist. A user reading
`wingfoil dna --help` should be able to tell which to reach for.

## Actual Behavior

They are interchangeable on every axis tested: the value written, the output document, the refusal
message and the exit code. No input has been found that distinguishes them.

## Notes

**This is a consequence of two correct decisions meeting, not a mistake in either.** `dl-081` specified
`update` against a surface where `set` still created paths, so the overlap was partial at the time it
was ratified. `bug-084`'s repair — which `dl-081` made a precondition of its own shape — closed the
gap from the other side. Neither decision could see the result alone.

**Three candidate answers, and they are genuinely different:**

1. **Deprecate `set` in favour of `update`.** The smallest surface, and `update` is the more accurate
   name for what both do. It costs a breaking change to the only DNA writer that has ever shipped, and
   `P2.1` names `dna set` explicitly in `docs/01_vision/06_features.md` — so the feature list moves
   too, not only the CLI reference.
2. **Keep `set` as an alias of `update`.** No breakage, and `P2.1` keeps its name. It costs a permanent
   second spelling that every future reader must learn is redundant, and two Tools on the MCP surface
   (`spec-006` §3 pairs each core function with one) doing the same thing.
3. **Give them different scopes** — `set` restricted to scalar leaves, `update` to everything else.
   Keeps both names meaningful, at the cost of a boundary that is arbitrary from the user's side and
   that someone must enforce in code and document in `spec-008`.

**Not to be resolved inside a fix task**, and not inside `dl-082` either: the answer moves the feature
list, the CLI reference, `spec-006`'s Tool table and the shipped command surface, and deciding it as a
side effect of a grammar change would bury it. `dl-082` records the measurement and leaves the question
open on purpose.

## Triage & Execution Notes

- triage (2026-09-24): **medium**. Nothing is broken and no user can be harmed by it — the failure mode
  is confusion, not error. It is not low because the redundancy is about to become visible: `dl-082`
  makes the two spellings identical, and shipping a CLI in which `dna set X --value Y` and
  `dna update X --value Y` are two names for one command invites the question at exactly the moment
  `v0.2` is published and the answer becomes expensive.
- Found by measuring `dl-082`'s evidence rather than by a failure. Recorded as `E4` there.

## Correction (2026-09-24) — "indistinguishable" overstates it: they differ at a collection

This bug was filed on two measurements — a scalar leaf and a path that does not resolve — and both
happen to be cases where the two verbs agree. A third case was never run, and it is the one where they
differ. Measured against `task-093`'s build in a throwaway `wingfoil init --template Scrum` repository,
in the grammar `dl-082` ratified:

```
$ wingfoil dna set    team.members --value roberto
error: 'team.members' does not hold a single value: reach it with
`dna add|remove|update team.members --value <v>` (dl-081)          exit 1

$ wingfoil dna update team.members --value roberto
error: no entry named 'roberto' in 'team.members'                   exit 1
```

Both refuse, but for different reasons and with different meanings: `set` refuses *the shape of the
target*, while `update` accepts it and refuses because no such entry exists — it read `--value` as an
entry identity, which is what `dl-081` says it means at a collection. Add the entry first and `update`
succeeds where `set` never can.

The mechanism, read at `c160072e`: `dnaSetFn` delegates to the shared pipeline as
`runDnaMutation(root, { verb: 'update', field: keyPath, value }, subject, true)`. That fourth argument
is `scalarOnly`, and it is the whole difference — `dna set` **is** `dna update` with a pre-check that
the path resolves to a scalar.

Entry fields are *not* excluded by it, which is the other thing the original filing implied without
testing: `dna set team.members.roberto.email --value r@x.it` succeeds at exit 0, because that path
resolves to a scalar. `set` is not confined to the seven `project` fields.

**What survives.** `set` still has no behaviour `update` lacks — it is a strict restriction, identical
to `update` on every input where it succeeds, refusing on a subset of the rest. So the redundancy
question is real. But the accurate statement is *"`set` is a guard-railed subset of `update`"*, not
*"they are the same command"*, and that difference matters to the decision: the guard rail is a design
worth weighing, not an accident to be removed.

The failure here is the one this release has rejected four tasks for — a claim written from the cases
that were run rather than from the cases that would settle it. Recorded rather than edited away,
because the title and the Summary above were both argued from it.

## Ruling (2026-09-24) — both commands stay

The approver ruled on 2026-09-24: **`dna set` and `dna update` both remain.** There is no defect to
fix, and the redundancy this document describes is accepted as a design.

What makes it a design rather than an accident is the measurement in the Correction above. `dna set`
is `dna update` with `scalarOnly` set, and that pre-check is a guard rail with a teaching error: a
user who aims `set` at a collection is refused at exit 1 by a message that names the three verbs that
would work. Removing `set` would take that away; removing `update` would take away the collection case
entirely, which is what `bug-083` exists to provide.

**The proposal that was declined, and why it is worth recording.** The approver first considered
deprecating `update` on the ground that it does not appear in the vision reference. Two objections
settled it. The provenance argument does not isolate `update`: neither `add` nor `remove` appears
there either, all three come from `dl-081`, and all three trace to `P2.1`'s "Basic CRUD operations" —
applied consistently it would delete `add`, which is the verb `bug-083` was filed to obtain. And
giving `set` the full behaviour would leave a name that describes the wrong thing: `set` implies
create-or-replace, while the ratified rule is replace-only — a path that does not resolve is refused,
never created, which is `bug-084`'s repair and the precondition `dl-081` rests on.

**`release:` is cleared and this bug no longer blocks `v0.2`.** The follow-up it leaves is
documentation and it is scheduled into the retrospective phase, which runs after `release-publishing`;
a bug stamped `v0.2` would block `release-submit` waiting for work that by design happens later.

**Status.** This is a wontfix, and the `bug` machine cannot express one after `triaged` — the only
`reject: closed` gate sits on `open`. That gap is now `bug-094`. Until it is resolved this document
stays at `triaged` with no release, which understates it: it is decided, not merely unscheduled, and
this section is the only place that says so.

## Follow-up scheduled into the retrospective

`docs/01_vision/06_features.md` lists `P2.1` as `wingfoil dna set` alone, and its prioritisation row
calls it "Basic CRUD operations". The DNA surface is now four commands. `task-098` corrects
`docs/01_vision/X_cli-cmds.md`, which is the command reference; **nothing corrects the feature list**,
and it is the artefact that decides what `P2.1` is understood to be.

That correction is recorded in `docs/05_plans/rl-v1/rel-v0.2/retrospective-rel-v0.2-plan.md` rather
than done here, because it is a vision-layer edit and the retrospective is where this release's
vision-layer conclusions are gathered.

## Note (2026-09-25) — the ruling has a documentation cost, and it is now visible

Raised by `task-098` while correcting the CLI reference, and recorded here because it is a consequence
of this bug's ruling rather than a separate defect.

Before `dl-082` the two verbs were spelled differently — `dna set <key> <value>` against
`dna update --field <path> --value <v>` — and the difference in grammar concealed the overlap. They
are now both `<path> --value <v>`, so `docs/01_vision/X_cli-cmds.md` carries **two rows a reader
cannot choose between from the rows alone**.

The ruling of 2026-09-24 keeps both commands, so the rows must both stay. What is needed is that each
says what distinguishes it: `set` refuses a target that is not a scalar, with a message naming the
verbs that reach it; `update` accepts a collection and reads `--value` as an entry identity. That is
one clause per row.

`task-098` wrote the rows so any resolution is a small edit, and did not make it, because the ruling
had not been given when it wrote them.

**Where the work lands:** with `bug-099` and `bug-100`, in the `user-docs` phase. All three are
residual accuracy work on the same document, and the person correcting one is already reading the
others.
