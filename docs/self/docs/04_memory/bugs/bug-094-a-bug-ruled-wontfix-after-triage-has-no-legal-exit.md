---
id: "bug-094-a-bug-ruled-wontfix-after-triage-has-no-legal-exit"
type: bug
title: "A bug ruled `wontfix` after it is triaged has no legal transition to `closed`, and the release gate does not recognise `deprecated` — so retiring one leaves it blocking the release forever"
status: open
severity: "medium"
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
