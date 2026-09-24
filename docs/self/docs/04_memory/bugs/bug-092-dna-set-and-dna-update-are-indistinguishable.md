---
id: "bug-092-dna-set-and-dna-update-are-indistinguishable"
type: bug
title: "`dna set` and `dna update` agree on success, on refusal, on message and on exit code — the only behaviour that separated them was `bug-084`, which has been removed"
status: triaged
severity: "medium"
release-origin: "v0.2"
release: "v0.2"
feature: "P2.1"
contributor: ""
credit: ""
tmpl_version: 260703
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
