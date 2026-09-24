---
id: "bug-094-a-bug-ruled-wontfix-after-triage-has-no-legal-exit"
type: bug
title: "A bug ruled `wontfix` after it is triaged has no legal transition to `closed`, and the release gate does not recognise `deprecated` — so retiring one leaves it blocking the release forever"
status: open
severity: "low"
release-origin: "v0.2"
release: ""
feature: "P1.13"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`memory.yaml`'s `bug` machine offers exactly one wontfix path, and it is on `open`:

```yaml
sequence: [ draft, open, triaged, planned, in-progress, in-review, resolved, closed ]
gates:
  open:      { reject: closed }        # wontfix/dup
  in-review: { reject: in-progress }
  resolved:  { reject: in-progress }
waiting: [ triaged, planned ]
```

Once a bug reaches `triaged`, the only forward route to `closed` runs through `planned`,
`in-progress`, `in-review` and `resolved` — i.e. through *doing the work*. A bug that is triaged in
good faith and then ruled "not a defect" has nowhere legal to go.

The wildcard `deprecate` is the apparent escape, and it fails for a second, independent reason: the
release-submit gate's **C2** check reads

```sh
[ "$r" = "v0.2" ] && [ "$s" != "closed" ] && [ "$s" != "resolved" ] && echo "NOT RESOLVED: ..."
```

`deprecated` is neither, so a deprecated bug carrying `release: v0.2` blocks the release permanently.

## Steps to Reproduce

Reached on 2026-09-24 with `bug-092`. It was filed, triaged and stamped `release: v0.2` on the
premise that the redundancy it describes needed a fix. The approver then ruled that both commands
stay, which makes it a wontfix — with the element already past the only state from which wontfix is
expressible.

1. Take any bug at `triaged`.
2. Rule it wontfix.
3. There is no transition that records that outcome. `deprecate` records "retired", not "considered
   and consciously accepted", and it leaves C2 failing while the `release:` stamp remains.

## Expected Behavior

An outcome the process actually produces should be expressible in the machine that models the
process. Ruling a triaged or planned bug wontfix is ordinary — it is what happens whenever
investigation turns a suspected defect into an accepted design — so there should be a transition for
it, and the release gate should agree with the machine about which states mean "needs no more work".

## Actual Behavior

The outcome is recorded by leaving the `release:` field empty and the status at `triaged`, which is
indistinguishable from the forty-odd bugs that are merely unscheduled. The decision is legible only in
the bug's own prose and in a commit body.

## Notes

**Two defects, one symptom, and they need separating by whoever fixes this.** The machine is missing a
transition; the gate script is missing a state. Either alone still leaves the outcome unrecordable.

**`deprecated` is probably not the answer even if C2 learned it.** CLAUDE.md describes `deprecate` as
retiring an element and naming its replacement. A bug that was investigated and consciously accepted
has not been retired — the investigation is the value, and a reader who finds it marked `deprecated`
learns nothing about why. `closed` with the reason in the commit body is what `open → closed` already
means, and that meaning is what `triaged` cannot reach.

**Scope note.** This is `memory.yaml`'s own modelling, so it touches `spec-001-memory-yaml-schema`
and the state-machine engine, not just this project's configuration. Any other project's bug machine
inherits the same shape from the same template.

## Triage & Execution Notes

- triage (2026-09-24): **medium**. Nothing is broken at runtime and no user is affected; the cost is
  that a real process outcome cannot be recorded, so it is recorded incorrectly instead. It is not low
  because the workaround silently converts a decided bug into one that looks merely unscheduled, which
  is exactly the confusion the Memory pillar exists to prevent.
- Found while recording the approver's ruling on `bug-092`, not by a failure.

## Correction (2026-09-24) — the first half overstates it: `deprecate` IS a legal exit

This bug's Summary says a wontfix after `triage` "has nowhere legal to go". That is wrong, and it was
written from the `sequence`/`gates` block alone without reading what CLAUDE.md §5.1 says about the
verb that is deliberately *not* in that block.

`memory.deprecate` is callable **from any state, on any type**; `deprecated` is a reserved implicit
wildcard target that a machine never declares and that `src/memory/schema.ts` rejects if declared. So
`triaged → deprecated` is legal today, and it is semantically defensible for a bug ruled not-a-defect:
the document is retired, and the `Reason:` carries the ruling. Whether `deprecated` or a `closed`
reachable from `triaged` is the *better* record is a design question, not a defect, and it does not
belong in a bug.

**What survives is the second half, and it is real.** The release gate does not recognise the one
legal exit. `docs/self/.wingfoil/workflows/custom/release-submit.yaml`, phase `pre-release-checks`,
declares:

```yaml
- "all bugs where tags=[{release.version}] are status: [resolved, closed]"
```

`deprecated` is neither. So a bug retired through the only transition available to it still fails the
release's own pre-check, permanently. The same gap is reproduced in this release's plan
(`docs/05_plans/rl-v1/rel-v0.2/release-submit-rel-v0.2-plan.md` §2.1, check C2), which is the form
actually executed today since no engine evaluates the declared string.

**Severity lowered from medium to low.** With the first half withdrawn, what is left needs a bug
tagged for the release *and* deprecated to fire, and no bug is in that state — `bug-092` had its
`release:` field cleared instead, which is a one-field workaround that costs nothing.

**One thing the fix must not do quietly.** Adding `deprecated` to the accepted list would let anyone
clear a release gate by deprecating the bug in front of it. The gate should *report* retired bugs for
deliberate confirmation rather than silently accept them — a distinction worth deciding before the
string is edited.
