---
id: "dl-123-a-bug-ruled-wontfix-has-a-legal-exit"
type: decision-log
title: "A bug ruled not-to-be-fixed after triage has no approver-gated exit, and the only legal one (`deprecate`) hides the ruling and fails the release gate — which exit the bug machine offers"
status: in-discussion
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`). It retypes
`bug-094-a-bug-ruled-wontfix-after-triage-has-no-legal-exit` (`open`), which describes a choice of
state machine rather than a defect. The approver ruled on 2026-09-28 that it becomes a
decision-log, and that it comes first in the v0.3 clean-up of the unscheduled population.

**The machine.** `memory.yaml` `types.bug.states`, at `a20b346c`:

```yaml
sequence: [ draft, open, triaged, planned, in-progress, in-review, resolved, closed ]
gates:
  open:      { reject: closed }        # approve: open->triaged · reject: ->closed (wontfix/dup)
  in-review: { reject: in-progress }
  resolved:  { reject: in-progress }
waiting: [ triaged, planned ]
```

A wontfix is expressible only on `open`. Once a bug is `triaged` or `planned`, the only forward route
to `closed` runs through doing the work. `deprecate` remains, because it is legal from any state.
`bug-094`'s own 2026-09-24 correction withdrew its first claim that there is "nowhere legal to go".

**Measured on the published engine.** In a throw-away directory:

```
npm init -y >/dev/null && npm i wingfoil@0.2.1
node -e "const sm=require('wingfoil/dist/memory/state-machine.js');
  const m={sequence:['draft','open','triaged','planned','in-progress','in-review','resolved','closed'],
    gates:{open:{reject:'closed'},'in-review':{reject:'in-progress'},resolved:{reject:'in-progress'}},
    waiting:['triaged','planned']};
  for (const s of ['open','triaged','planned']) for (const op of ['reject','approve','submit','deprecate'])
    { let r; try { r=sm.resolveTransitionTarget(m,s,op) } catch { r='illegal' } console.log(s,op,r) }"
```

It prints:

| from | `reject` | `approve` | `submit` | `deprecate` |
|---|---|---|---|---|
| `open` | `closed` | `triaged` | illegal | `deprecated` |
| `triaged` | illegal | illegal | illegal | `deprecated` |
| `planned` | illegal | illegal | illegal | `deprecated` |

The same call, with `triaged: { reject: closed }` and `planned: { reject: closed }` added to `gates`,
returns `closed` for `reject` from both states. `approve` and `submit` from them stay illegal, so
their forward edges remain engine-driven, as `waiting` intends. `StateMachine.safeParse` from
`wingfoil/dist/memory/schema.js` accepts that machine (`true`). It refuses one whose reject target is
`deprecated` (`false`). `spec-001` already allows a state that is both a gate and waiting: it "still
exposes a manual `reject`/decline path".

**Why `deprecate` is a poor exit for a ruling.** Three facts, each read at `a20b346c`:

- **It runs no authority check.** `memoryApproveFn` and `memoryRejectFn` in `src/core/index.ts` both
  call `requireApprovalAuthority` (REQ-SEC-03). The `deprecate` verb's TSDoc says "Deliberately
  absent: no `Approver:` line and no `requireApprovalAuthority` call" (`dl-027`). Anyone can retire a
  bug.
- **It archives the ruling.** `ARCHIVED_STATUSES` in `src/memory/state-machine.ts` is `deprecated`
  and `superseded`. `isArchivedStatus` removes archived elements from default `memory search`
  (REQ-STATE-06) and from agent context (`spec-012` §6). A ruling such as "both commands stay" is
  exactly what an agent should find.
- **The release gate rejects it.** `release-submit.yaml`, phase `pre-release-checks`, declares
  `"all bugs where tags=[{release.version}] are status: [resolved, closed]"`. A deprecated bug still
  carrying the release fails it permanently (`bug-094`, second half).

**The live case: `bug-092-dna-set-and-dna-update-are-indistinguishable`** (`triaged`, `release: ""`).
The approver ruled on 2026-09-24 that both commands stay, so there is nothing to fix. The
retrospective's dispositions schedule closing it, with a pointer to the ruling, into v0.2.2. From
`triaged`, `closed` is not reachable today (table above). It is sitting at `triaged` with its
`release` cleared. That is the workaround `bug-094` describes: the bug is indistinguishable from the
bugs that are merely unscheduled.

**Scope.** The bug machine is this project's configuration. A project made by `wingfoil init` gets
only the scaffold's default machine, `sequence: [ draft, pending, approved ]` (`memoryYaml` in
`src/storage/templates.ts`). `git grep -n triaged a20b346c -- src` finds only a sentence about lint
warnings in `src/storage/builtin-directives.ts`, and no machine. So none of the options below needs
an engine or `spec-001` change. `bug-094`'s scope note expected one.

## Decision

The bug machine gains a legal, approver-gated exit for a bug ruled not-to-be-fixed before its fix
has started. The open question is which exit.

- **(A) `reject` to `closed` from `triaged` and `planned`.** Add `triaged: { reject: closed }` and
  `planned: { reject: closed }` to `gates`. A wontfix after triage means what `open → closed`
  already means: considered, and closed without a fix. The reason lives in the `Reason:` block and
  in `rejection_reason`. This is a configuration change only, and the release gate needs no change.
- **(B) A distinct `wontfix` state.** Make `wontfix` the reject target of `open`, `triaged` and
  `planned`, keeping `open → closed` for duplicates or moving them too. The status tells "fixed" from
  "not fixed" without reading the commit. The cost: the release gate's accepted list and every reader
  that treats `closed` as the terminal state learn a new state.
  `wontfix` is not archived, so the ruling stays visible.
- **(C) Keep the machine; teach the release gate `deprecated`.** The gate *reports* deprecated bugs
  for the approver's explicit confirmation, rather than silently accepting them, as `bug-094`'s
  correction proposes. This leaves the missing authority check and the archiving described above.
- **(D) No change.** Clear `release:` and leave the bug at `triaged`. This is today's workaround,
  listed for completeness.

**Recommendation: (A).** It is the smallest change that makes the outcome recordable. It reuses the
wontfix meaning the machine already gives `open → closed`, and it puts the ruling behind the same
authority check as every other gate. It needs no gate edit and no engine edit, and it leaves the
ruling visible to search and context. (B) is the better record if the project later wants to count
wontfix separately. It can be adopted from (A) without breaking anything, by changing the reject
targets.

**Sequencing question — `bug-092` in v0.2.2.** This decision targets v0.3, but `bug-092`'s closure
is scheduled for v0.2.2.

- **(i)** Ratify this decision early, and land the `gates` edit in v0.2.2. It is a configuration
  edit that changes no command's behaviour, which fits v0.2.2's stated scope. `bug-092` then closes
  by `reject`.
- **(ii)** Move `bug-092`'s closure to v0.3, after this decision.
- **(iii)** Deprecate `bug-092` in v0.2.2, and accept that its ruling is archived.

**Recommendation: (i),** under (A).

## Rationale

- **The machine should model outcomes the process produces.** Ruling a triaged bug not-a-defect is
  ordinary. It happens whenever investigation turns a suspected defect into an accepted design, as
  `bug-092` did. An outcome with no transition gets recorded as something else, here as "unscheduled".
- **A ruling belongs behind the approver's gate.** Deciding that a triaged defect will not be fixed
  is an approval-shaped act. (A) and (B) put it under `requireApprovalAuthority` and an `Approver:`
  line. (C) and (D) do not.
- **Archiving a ruling defeats the reason for recording it.** A retired document drops out of the
  context an agent is given. The next agent to meet the redundancy `bug-092` describes would not see
  why it was accepted.
- **The engine already supports (A).** A gate on a waiting state is specified by `spec-001` and
  implemented by `resolveTransitionTarget`, as the table above shows. The cost is two lines of
  configuration.

## Actions

1. **Ratify, choosing (A)–(D) and (i)–(iii).** Owner: approver. The choice goes in the approve
   commit's `Reason:`.
2. **On ratification, `docs/self/.wingfoil/memory.yaml` `types.bug.states` changes** per the chosen
   option, and its `version` is bumped. The file is at the repository root if the configuration move
   has landed by then. Under (B) or (C), `docs/self/.wingfoil/workflows/custom/release-submit.yaml`'s
   `pre-release-checks` string changes too.
3. **Close `bug-094` as retyped.** It goes through the existing `open → closed` edge (`reject`, the
   wontfix/duplicate path), with a `Reason:` citing this decision-log. It is not deprecated.
4. **Close `bug-092`** by the route and in the release the sequencing question settles, with a
   `Reason:` pointing at its 2026-09-24 ruling.
5. Tasks are derived by v0.3 `release-planning` (`build-backlog`), or by v0.2.2's under (i), not
   created here.

## Relations

- **Retypes:** `bug-094-a-bug-ruled-wontfix-after-triage-has-no-legal-exit`, under
  `dl-118-choosing-between-decision-log-bug-and-directive`, rule 2.
- **Live case:** `bug-092-dna-set-and-dna-update-are-indistinguishable`.
- **Related:** `spec-001-memory-yaml-schema` (gate and waiting states); `dl-027-req-sec-04-deprecate-reason-scope`
  (why `deprecate` carries no authority check); `dl-028` (the archived set); `dl-016` (the `release`
  field that the release gate selects on);
  `dl-100-governance-debt-resweep-and-capacity` (the clean-up this comes first in).
- **Traceability:** P1.13 (Memory state machines); REQ-STATE-01, REQ-STATE-06; REQ-SEC-03.
