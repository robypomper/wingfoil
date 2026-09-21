---
id: "dl-063-p1-8-reject-message-and-authority-trace"
type: decision-log
title: "P1.8 sc.2 pins an illegal-transition message that contradicts REQ-STATE-01, dl-032 and dl-053 and is false for four types; and P1.8 has no authority scenario at all"
status: in-discussion
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Raised by the review of `task-047-memory-reject`. That task was **approved and merged to `main` while
this element was being written** (`c03cca9` approve, `57c412f` finalize, `e890cf9` merge; `main` is now
`9147d84` and the task document reads `status: done`), so what follows is no longer prospective: the
deviation described below is shipped, and `P1.8-memory-reject.feature:18` is now contradicted by the
code on `main`, not by a branch. Two defects in the same feature file: one about a message, one about a
missing scenario.

### A — the message

`docs/02_requirements/02_bdd/features/p1-memory/P1.8-memory-reject.feature:18` pins, for
`wingfoil memory reject` on a `draft` document:

> `And the command exits with code 1 and message "only pending documents can be rejected (current: draft)"`

Three authoritative sources pin a different string for the same event:

- `docs/02_requirements/03_sard/03_state-context.md:16` — REQ-STATE-01's Fit Criterion: a transition the
  type's `sequence`/`gates`/`waiting` machine does not permit "is rejected with
  `"illegal transition <from> -> <to> for type '<type>'"` and leaves the state unchanged", exit `1`.
- `docs/02_requirements/02_bdd/features/p1-memory/P1.6-memory-submit.feature:21` and
  `docs/02_requirements/02_bdd/features/p5-interaction/P5.2.3-mcp-tools.feature:18` — both pin
  `illegal transition approved -> pending for type 'task'`, the same generic shape, on the CLI and MCP
  paths respectively.
- `dl-032-illegal-transition-message-contract` (`ready`) chose option (c), which REQ-STATE-01 now cites
  by name; and `dl-053-illegal-transition-target-for-verbless-edges` (`ready`) settles which `<to>` that
  message prints and names `task-047` as an inheritor of the rule (`dl-053:55` — "Every rule for `<to>`
  becomes the contract for `task-046` (`approve`) and `task-047` (`reject`)"; `:88-89` hand the outcome
  to both).

**Neither decision-log ever mentions P1.8.** Verified:
`grep -n "P1\.8\|P1\.7\|P1\.6" docs/self/docs/04_memory/design/dls/dl-032-illegal-transition-message-contract.md`
→ four hits, all `P1.6`, none `P1.8`. So the competing wording was very probably never noticed when
`dl-032` was ratified.

**The P1.8 wording is also factually false**, because it hard-codes `pending` as "the state one may
reject from". Against this repository's own `docs/self/.wingfoil/memory.yaml` that is wrong for four
types — `task`, the type the scenario itself uses, among them:

| Type | `gates` states carrying a `reject` edge (memory.yaml) | "only pending …" correct? |
|---|---|---|
| `task` | `pending` → `draft`; **`in-review` → `in-progress`** | no — a second reject gate |
| `release-line` | `planning` → `draft` | no |
| `decision-log` | `in-discussion` → `draft` | no |
| `bug` | `open` → `closed`; `in-review` → `in-progress`; `resolved` → `in-progress` | no |
| `adr`, `tech-spec` | `pending` → `draft` | yes |
| `release`, `plan` | none (no `gates` block) | n/a — reject is never legal |

A message naming `pending` cannot be emitted generically without lying to the user on every one of those
rows.

`task-047` implements the generic message and **discloses the deviation rather than absorbing it
silently** — `docs/self/docs/04_memory/v0.2/task-047-memory-reject.md:141` on `main`, section
"SPEC CONFLICT — P1.8 sc.2's message vs REQ-STATE-01 / `dl-032` / `dl-053`", repeated in its BDD-to-test
table (`:355`) and its final report. It asserts the two parts of sc.2 that are *not* in conflict — exit
`1`, and "the state is unchanged" — literally. Because the task is now `done`, that disclosure is the
only thing standing between the shipped behaviour and a feature file that says otherwise.

### B — the authority gate traces to nothing

`docs/02_requirements/03_sard/05_security-compliance.md:29-36`, REQ-SEC-03 "Role-based approval
authority", mentions only **approve**:

> * **Description:** Only users/agents holding the required approver role (per DNA) may **approve** a
>   given element type.
> * **Fit Criterion:** An **approve** attempt by a principal lacking the required role is rejected with
>   `"user not authorized to approve type '<type>'"` and the state is unchanged.
> * **Traceability:** Feature P1.7 (US-2-10, BDD `p1-memory/P1.7-memory-approve.feature`); Feature P4.14 …

`P1.7-memory-approve.feature` carries the matching scenario ("Error - approver lacks authority for the
type", exit 1, that exact message). **`P1.8-memory-reject.feature` has no authority scenario** — its
three scenarios are success, not-pending, and missing `--reason`.

Yet `memory reject` *is* an approver-gated verb, and now a shipped one: `memoryRejectFn`
(`src/core/index.ts:792` on `main`) calls `requireApprovalAuthority(root, dna.value, type)`, which
returns `user not authorized to approve type '<type>'` (`src/core/approval-authority.ts:69`) — the
REQ-SEC-03 string verbatim, reused for a *reject*. CLAUDE.md §5.1 does say agents may execute
`memory.reject` only on the approver's explicit
instruction, and REQ-SEC-04 already covers `--reason` for **both** verbs ("`approve` and `reject` require
a `--reason`", `05_security-compliance.md:38-41`) — so the asymmetry is REQ-SEC-03's alone. As things
stand, `memory reject`'s authority gate traces to no requirement and no BDD scenario: only to
CLAUDE.md §5.1, which `bug-008`/`dl-025` have already flagged as owned by no workflow gate.

## Decision

*Approver to ratify. Two clauses.*

### Clause A — the generic message wins; amend the feature line

`illegal transition <from> -> <to> for type '<type>'` is the message `memory reject` emits, as it already
is for `memory submit` (P1.6) and the MCP Tool path (P5.2.3).
`docs/02_requirements/02_bdd/features/p1-memory/P1.8-memory-reject.feature:18` is amended to that string;
the scenario's other two assertions — exit `1`, state unchanged — stand unchanged.

Alternative considered: **implement P1.8's wording for `reject` only.** Rejected on three counts. It is
false for four of the eight types (table above), so it cannot be generated from `memory.yaml` at all. It
would fork the very contract `dl-032` exists to unify, giving one condition two messages depending on
which verb hit it. And two `ready` decision-logs plus a SARD Fit Criterion outweigh a single BDD line —
with `dl-053` ratified naming `task-047` as its inheritor.

### Clause B — extend REQ-SEC-03 to `reject` explicitly

REQ-SEC-03's Description and Fit Criterion widen from "approve" to the approval-gate verbs `approve`
**and** `reject`, and its Traceability gains Feature P1.8. The reused message text —
`user not authorized to approve type '<type>'`, saying *approve* on a reject — is confirmed as
deliberate: one authority predicate, one string, so an operator learns one message and
`requireApprovalAuthority` needs no verb parameter. A matching authority scenario is added to
`P1.8-memory-reject.feature`, mirroring P1.7's third scenario.

Alternatives considered. **(i) Give `reject` its own message** (`user not authorized to reject type
'<type>'`): rejected — it doubles the strings behind one predicate, would require
`requireApprovalAuthority` to take the verb, and both `task-046` and `task-047` have already implemented
the shared one. **(ii) Leave REQ-SEC-03 as it is and rely on CLAUDE.md §5.1**: rejected — CLAUDE.md is a
process document owned by no workflow gate (`bug-008`, `dl-025`), so the gate would stay untraceable,
which is what the `traceability` directive forbids.

Whether `memory deprecate` (P1.9, `task-048`, `backlog`) also needs an authority gate is **out of scope
here** and deliberately not decided: CLAUDE.md §5.1 states deprecate "is not an approval gate", and P1.9
has no authority scenario either. If the approver wants that settled it should be its own question, not
a side effect of this one.

## Rationale

- **A generic contract that one verb opts out of is not a contract.** `dl-032` was ratified precisely to
  stop the illegal-transition message forking; letting P1.8 keep a verb-specific wording reintroduces
  the fork in the first verb to land after that ratification.
- **The P1.8 string cannot be implemented from configuration.** The reject-from state is a per-type
  `gates` fact. Any faithful implementation of "only pending documents can be rejected" has to hard-code
  `pending`, which the table shows is wrong more often than right.
- **The conflict was discovered, not invented.** `task-047` is the first task to implement `reject`, so
  it is the first that could hit it; it recorded the deviation in its own document instead of shipping
  it silently, which is what makes it schedulable rather than buried in Execution Notes.
- **Clause B is a traceability hole, not a behaviour change.** What `task-047` ships is right and is not
  altered by this decision; what is missing is the requirement it answers to. Filing it alongside clause
  A keeps it to one amendment pass over one feature file instead of two.
- **Both clauses touch documents only.** No code change on either — which is why this is a decision-log
  and not a bug: the deviation is already disclosed on the branch, and the artefacts to correct are an
  `approved` requirement set and a BDD acceptance contract, whose amendment the approver ratifies.

## Actions

- Owner **approver**: ratify clause A and clause B.
- **Clause A**: amend `docs/02_requirements/02_bdd/features/p1-memory/P1.8-memory-reject.feature:18` to
  the generic message (instantiated for that scenario's fixture, matching P1.6:21's style). Nothing else
  in the file changes.
- **Clause B**: amend REQ-SEC-03 in `docs/02_requirements/03_sard/05_security-compliance.md:29-36` —
  Description, Fit Criterion and Traceability — and add the authority scenario to
  `P1.8-memory-reject.feature`, mirroring `P1.7-memory-approve.feature`'s third scenario.
- **Urgency.** `task-047` is `done` and merged (`e890cf9`), so both amendments are now **overdue rather
  than upcoming** — the same position `dl-051` found itself in once `task-055` merged ahead of its
  `spec-012` §5 amendment. Nothing will re-open `task-047` to carry them; they are their own piece of
  work.
- ~~Hand the outcome to **`task-046-memory-approve`** (`in-review` at `62c7459`, same shared helper, so
  before its review pass) and to **`task-048-memory-deprecate`** (`in-progress` at `b6175b7`), which
  touches the same feature family.~~ *(Both are now `done` and merged — see the Scheduling addendum
  (2026-09-21) below.)* `dl-015`'s `read_related` covers `depends_on` tasks and **not** decision-logs,
  which is why no task read this on its own.
- If clause B adds a BDD scenario, the production behaviour it asserts already exists on `main`
  (`src/core/index.ts:792`), so the new scenario needs a test rather than an implementation — and
  `task-047`'s BDD-to-test table (`:355`) should gain the row, even though the task itself is closed.

Related: `dl-032-illegal-transition-message-contract` (`ready`),
`dl-053-illegal-transition-target-for-verbless-edges` (`ready`), `dl-025` and `bug-008` (CLAUDE.md owned
by no gate), `bug-032-spec-004-stale-illegal-transition-example` (the same message, stale in `spec-004`
§4.3), `task-046-memory-approve`, `task-047-memory-reject`, `task-048-memory-deprecate`,
`P1.6-memory-submit.feature:21`, `P1.7-memory-approve.feature`, `P1.8-memory-reject.feature:18`,
`P5.2.3-mcp-tools.feature:18`, REQ-STATE-01, REQ-SEC-03, REQ-SEC-04, `docs/self/.wingfoil/memory.yaml`
(the per-type `gates` blocks), `src/core/approval-authority.ts:66-72`.

## Scheduling addendum (2026-09-21) — unscheduled obligation for v0.3

The Actions above already record `task-047-memory-reject` as `done` and both amendments as *overdue
rather than upcoming*. That now holds for the other two named inheritors as well:
`task-046-memory-approve` finalized at `1914195` and `task-048-memory-deprecate` at `d9867dc`, both on
2026-09-18. The parenthetical states "(`in-review` at `62c7459`)" and "(`in-progress` at `b6175b7`)";
both are stale.

Neither clause needs production code: clause A amends one BDD line, clause B amends REQ-SEC-03 and adds
a scenario whose behaviour already exists on `main` (`src/core/approval-authority.ts`), so it needs a
test rather than an implementation.

This document is therefore left `in-discussion` with `release: ""` on purpose. That pair is exactly what
`release-planning`'s `reconcile-governance` selection filter picks up
(`where: { type: [decision-log, adr], status: [in-discussion, pending], release: ["", "{release.version}"] }`,
`release-planning.yaml:45`), so the next run sweeps it, approves it, and `build-backlog` places the work
it implies. It is an **unscheduled obligation** in the shape `dl-030` established for REQ-SEC-07's P4.9
half: recorded here, placed by the next `release-planning`, never added to a release already
`in-development` (`dl-034` point 4 bounds that exception to bugs blocking work in flight, which this is
not).

**Consequence for whoever ratifies it:** the hand-it-to-the-inheritor instruction in Actions above can no
longer be executed — there is no task left to hand it to. The outcome needs **its own task** out of
`build-backlog`. This addendum exists because nothing else would have said so: `dl-015`'s `read_related`
covers `depends_on` tasks and not decision-logs, and nothing re-opens a `done` task's notes.
