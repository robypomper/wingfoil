---
id: "dl-084-which-baseline-a-read-only-verb-reports-from"
type: decision-log
title: "A user refused by `memory add` will check with `memory search --type`, and the two answer from different baselines — so the tool can tell someone a type both does and does not exist"
status: in-discussion
context: "architecture"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`dl-080` ratified option (B): **a read that gates an operation resolves at `HEAD`; a read that gates
nothing may read the working tree.** `task-095` applied it to `memory add`, which now refuses a type
that no commit defines. The read-only verbs were correctly left alone — `memory search --type` and
`memory history` gate nothing, and the MCP Memory Resources are read-only by construction
(REQ-SEC-05).

The gap is not in either decision. It is in what happens **between** them, and it was raised by
`task-095`'s implementer and confirmed by its reviewer.

## Evidence

### E1 — the two surfaces disagree, and the disagreement is reachable by an ordinary sequence

Add a type to `.wingfoil/memory.yaml` and do not commit it. Then:

```
$ wingfoil memory add --type fabricated --title 'Probe'
error: type 'fabricated' is not defined in the committed memory.yaml     exit 1

$ wingfoil memory search --type fabricated
(answers from the working tree — the type exists)
```

The first verb is right by `dl-080` and the second is right by `dl-080`, and a user who runs them in
that order is told the type both does and does not exist. The sequence is not contrived: checking
with `search` is exactly what someone does after a refusal that names a type.

### E2 — the refusal message does not say which baseline it used

`memory add`'s refusal names the type and the file. It does not say *committed*, so the user has no
way to know the two verbs are answering different questions rather than contradicting each other.

### E3 — the same shape exists on the MCP surface

`src/mcp/memory-resource.ts` reads `loadMemoryYaml` (working tree). An agent reading the Resource and
then calling the `memory.add` Tool meets the same disagreement, without a human to notice it.

## Decision

Three options. The north star makes this more than cosmetic: two agents given the same repository
should reach the same conclusion about what it contains, and today the conclusion depends on which
verb they asked.

### (A) Leave the behaviour, document it

Read-only verbs keep reading the working tree. `spec-008` and the CLI reference state, once, which
verbs answer from `HEAD` and which from disk. Cheapest, and consistent with `dl-080` as ratified — a
read that gates nothing genuinely does not need the committed baseline, and forcing it there would
make `search` unable to find a document you just wrote.

That last point is the strongest argument for (A): **a draft you have not committed is exactly what
you want `search` to find.** Moving it to `HEAD` would break the verb's purpose.

### (B) Read-only verbs resolve at `HEAD` too

One baseline for the whole CLI. Removes the disagreement outright and makes the rule "everything reads
the committed repository" with no exception to remember. Costs the case above: `memory search` stops
finding uncommitted work, which is a real and frequent use.

### (C) Report the baseline in the output

Behaviour unchanged; each verb says which baseline it answered from — a field in `--format json`, a
line in console output, and the same in the refusal message so the two can be compared. The
disagreement stops being invisible without either verb becoming less useful.

The cost is a change to the output contract on several verbs (`spec-005` §4, `spec-008`), which is
not free, and one more thing in every response that most users will never read.

### (D) (C) narrowed to the refusal message only

`memory add`'s refusal says it resolved at `HEAD` and points at what to check. Nothing else changes. A
fraction of (C)'s cost; leaves the MCP case (E3) unaddressed, where there is no human to read the
sentence.

## Rationale

Recorded before a choice is made, because the framing is the substance here: this is **not** a defect
in `dl-080`, and it should not be fixed by reopening it. Both verbs behave as ratified. What is
missing is that a user or agent meeting both has nothing that tells them the two are answering
different questions — which is a *communication* gap, not a baseline gap, and (B) is the only option
that treats it as the latter.

`bug-075` keeps this out of WingFoil's own dogfooding — the CLI cannot be aimed at our Memory — so
every instance is on someone else's project, which is an argument for deciding it before `v0.2`
ships rather than after.

## Actions

1. Decide among (A)–(D).
2. Whichever is chosen, record it in `spec-008` and in the CLI reference, so the next verb added does
   not have to rediscover which baseline it should use.
3. If (C) or (D): the refusal message is the first thing to change, since `memory add`'s is already
   shipped and already silent about it.

## Relations

- Extends `dl-080-which-baseline-each-command-reads` (ready) — does not amend it.
- Raised by `task-095-memory-add-resolves-its-type-at-head` and confirmed by its reviewer.
- Touches `spec-008-cli-grammar`, `spec-005-cli-command-contract` §4, and the MCP Resources
  (`spec-014`), depending on the option chosen.
