---
id: "dl-072-init-scaffold-per-type-state-machines"
type: decision-log
title: "Should the `init` scaffold ship one shared `defaults` state machine, or a per-type `states:` block for each of the seven types?"
status: in-discussion
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`task-071-fix-init-memory-yaml-state-machine` fixes `bug-030-init-memory-yaml-has-no-state-machine` by
adding a **single shared `defaults.states` block** to the `memory.yaml` the `init` scaffold writes, and
leaving all seven scaffolded types without a `states:` block of their own. The review asked whether the
scaffold should instead ship a per-type machine for each type; `task-071` rejected that as out of
scope, correctly — it would need `spec-011-storage-layout` and `spec-001-memory-yaml-schema` revised
first. This DL is where that question is parked so it is decided rather than forgotten.

It is filed **separately** from `dl-071-init-seeds-no-approver` rather than folded into it, despite
both being "what should `init` scaffold?" questions. The reason: `dl-071` is a question about
`adr-006`'s authority model — who may approve, and whether a tool may grant that — and its options are
weighed against a governance guarantee. This one is a question about how much opinion a scaffold
should carry, weighed against `REQ-STATE-08`'s fallback and the cost of editing two `approved` specs.
They share a file and nothing else; deciding them together would let the smaller one ride on the
larger one's answer.

### Measured evidence

Measured 2026-09-21 against a build of `task/task-071-fix-init-memory-yaml-state-machine` at
**`1fee316`** (`npm ci` + `npm run build`, exit 0). The branch has since moved to `7cd5166`;
`git diff 1fee316 7cd5166 -- src/` is **empty**, so this describes its current HEAD.

**E1 — what the scaffold writes today (on that branch).** A fresh `wingfoil init --template scrum`
produces a `memory.yaml` with one `defaults` block and seven types, none declaring `states:`:

```
# Memory element schema (P1.13) — scaffolded by `wingfoil init`.
# One entry per element type: its path pattern, its id pattern and its scaffold template. Every type
# below shares the `defaults` state machine; give a type its own `states:` block to override it for
# that type only (REQ-STATE-08).
version: 1

defaults:
  states:
    sequence: [ draft, pending, approved ]
    gates:
      pending: { reject: draft }

types:
  adr: …  bug: …  decision-log: …  release: …  release-line: …  task: …  tech-spec: …
```

The scaffolded types are `adr, bug, decision-log, release, release-line, task, tech-spec` — seven; the
self-config's eighth type, `plan`, is not scaffolded.

**E2 — the machine works end to end on the scaffold as shipped.** Same build, fresh project:

```
$ node dist/cli.js memory add --type adr --title "Test"
{ "id": "adr-001-test", "path": "docs/memory/adr/adr-001-test.md" }
$ node dist/cli.js memory submit adr-001-test
{ "id": "adr-001-test", …, "from": "draft", "to": "pending" }
```

So this is not a defect question. Nothing is broken; the question is whether a shared default is the
right *shape* for a scaffold.

**E3 — what this project itself chose, for contrast: every single type overrides the default.**

```
$ python3 -c "import yaml; d=yaml.safe_load(open('docs/self/.wingfoil/memory.yaml'));
              print('defaults:', 'defaults' in d);
              [print(k, '-> own states:', 'states' in v) for k,v in d['types'].items()]"
defaults: True
release-line -> own states: True     release -> own states: True
task         -> own states: True     adr     -> own states: True
decision-log -> own states: True     tech-spec -> own states: True
bug          -> own states: True     plan    -> own states: True
```

Eight of eight. The `defaults` block in this project's own `memory.yaml` is declared and used by
**nothing** — it is documentation of the fallback, not a working default. A dogfooding project whose
config overrides the default everywhere is evidence that the shared default is not what a mature
WingFoil config looks like.

**E4 — the specs do not describe the scaffold's shape at all.** `spec-011-storage-layout:104` still
describes per-type `states` as `(values/initial/transitions)` — the encoding `spec-001` retired — and
never mentions `defaults`:

```
$ grep -n "defaults" docs/self/docs/04_memory/design/specs/spec-011-storage-layout.md
(no output)
```

So whichever way this is decided, spec-011 needs an edit; that edit is already required regardless,
and is filed as `bug-053-spec-011-memory-yaml-row-stale-states-encoding`. `spec-001` defines both
forms (`states: StateMachine.optional(), // absent ⇒ defaults.states applies (REQ-STATE-08)`,
`:116`) and is agnostic about which a scaffold should use.

**E5 — REQ-STATE-08 itself is stale**, which matters because it is the requirement the scaffold's
comment cites. Its Description still names the pre-`spec-001` machine with a `rejected` state; filed
as `bug-052-req-state-08-names-retired-default-machine`. Any text written here that cites
REQ-STATE-08 inherits that.

## Decision

Two options, presented with a recommendation; the approver's choice is recorded in this document's
approve commit `Reason:`.

### (A) Keep the shared `defaults` block — **recommended**

One machine, seven types inheriting it, a comment telling the user how to override per type (E1).

*For:* it is the smallest scaffold that is correct, and it is exactly what REQ-STATE-08 exists for —
"Reduce config friction for simple types" is the requirement's own stated Rationale. A new project has
no idea yet whether its `bug` type needs a seven-state lifecycle; shipping one would be the scaffold
guessing. It also keeps the generated file short enough to read in one screen, which is what makes the
"give a type its own `states:` block to override it" comment actionable rather than lost. And it costs
nothing now: `task-071` is already implemented this way and `in-progress`.

*Against:* it teaches by absence. A user who never opens `spec-001` may not discover that per-type
machines exist at all, and per-type machines are the whole point of `adr-008-per-type-state-machines`
("There is NO global state machine — a release and a task move through different lifecycles", as
`memory.yaml`'s own header puts it). E3 shows this project overrides the default on essentially every
type — so the scaffold demonstrates the thing its own author does not do.

### (B) Ship per-type `states:` blocks for all seven

Each scaffolded type declares its own machine, seeded with something plausible for that type
(`bug` with an `open → triaged → …` chain, `release` with `planning → in-development → …`, and so on).

*For:* it demonstrates the feature that `adr-008` calls the point of the design, in the file where a
user will first meet it. It gives a new project a usable lifecycle per type on day one instead of
`draft → pending → approved` for everything, and a machine is much easier to *edit* than to *invent*.

*Against:* it is the scaffold taking a position on seven lifecycles it knows nothing about, and the
positions would almost certainly come from this project's own `memory.yaml` — i.e. WingFoil's
development process shipped as every user's default, which is precisely the kind of inferred opinion
the project's own determinism directive argues against ("prefer explicit declared config over inferred
behaviour"). It makes the generated file several times longer. It needs `spec-011` to specify the
seeded machines, which turns a documentation correction (E4, already owed) into a substantive spec
addition with its own review. And it makes `defaults` dead weight in the scaffold — present, correct,
and demonstrated by nothing.

### Sub-questions to settle with the main option

- **S1 — if (A): does the scaffold show an override?** A single commented-out `states:` example under
  one type would demonstrate the mechanism at ~4 lines, without the scaffold committing to any
  lifecycle. This is arguably the best of both and is cheap. *Recommendation:* yes — a commented
  example on `bug`, whose case for a richer machine is the most obvious.
- **S2 — if (B): where do the seeded machines come from?** This project's `memory.yaml`, or something
  deliberately generic? *Recommendation:* if (B), generic — shipping WingFoil's own process is the
  strongest argument against (B) and should not be conceded by default.
- **S3 — either way, spec-011 must be corrected first.** E4: its `memory.yaml` row describes a retired
  encoding and omits `defaults` entirely, so it currently describes neither option. That correction is
  owed regardless (`bug-053`) and per `dl-047-tech-specs-carry-no-version-field` is a dated Revision
  note plus re-ratification on an `approved` spec. *Recommendation:* land `bug-053`'s fix first, then
  state the scaffold's shape in the same document.
- **S4 — and REQ-STATE-08 should say something true** before the scaffold's comment cites it (E5,
  `bug-052`). *Recommendation:* sequence behind `bug-052` as well, or at minimum do not add new text
  that repeats the stale machine.

## Rationale

(A) is recommended because the scaffold's job is to produce a correct, minimal, editable starting
point, and (B) trades that for a teaching demonstration paid for with seven guesses about a user's
process. The requirement being satisfied — REQ-STATE-08, whose Rationale is literally "Reduce config
friction for simple types" — describes (A).

The strongest argument for (B) is E3, and it is stronger than it first looks: this project overrides
the default on **eight of eight** types, so its own `defaults` block is declared and used by nothing.
A scaffold that ships only the construct its author never uses is teaching the wrong half. That is a
real observation, and it is why S1 is recommended alongside (A): a single commented-out override
teaches the mechanism at four lines, which is the part of (B) worth keeping, without the part that
guesses seven lifecycles.

What this decision explicitly is **not**: a reopening of `adr-008-per-type-state-machines`. Per-type
machines remain the design; the question is only what a scaffold pre-fills.

Low stakes, stated plainly: nothing is broken either way (E2), no user is blocked, and the cost of
changing the answer later is one scaffold edit plus a spec revision. It is filed small, and should be
decided quickly or deferred deliberately rather than debated at length.

## Actions

1. **Owner `approver`: choose (A) or (B)**, and settle S1–S4.
2. **Sequence behind the two corrections it depends on**, per S3/S4:
   `bug-053-spec-011-memory-yaml-row-stale-states-encoding` (spec-011 describes neither option today)
   and `bug-052-req-state-08-names-retired-default-machine` (the requirement the scaffold comment
   cites).
3. **If (A) + S1:** a commented-out per-type `states:` example in the scaffolded `memory.yaml`, and a
   sentence in `spec-011`'s `memory.yaml` row saying the scaffold ships `defaults` only. Small enough
   to ride `task-071-fix-init-memory-yaml-state-machine` **if it is still in rework when this is
   ratified** (`in-progress` on `task/task-071-fix-init-memory-yaml-state-machine`, HEAD `7cd5166`);
   otherwise its own task.
4. **If (B):** its own task, after `spec-011` gains the seeded machines — not a rider on `task-071`,
   which is scoped to `bug-030` and has already been reworked once.

## Relations

- **Parked by:** `task-071-fix-init-memory-yaml-state-machine` (rejected it as out of scope — correctly,
  per E4).
- **Depends on:** `bug-053-spec-011-memory-yaml-row-stale-states-encoding` and
  `bug-052-req-state-08-names-retired-default-machine` (both filed in this batch; both must land before
  either option can be written down accurately).
- **Constrained by:** `spec-001-memory-yaml-schema` (`approved` — defines both forms, agnostic about
  the scaffold), `spec-011-storage-layout` (`approved` — would have to specify the choice),
  `adr-008-per-type-state-machines` (`accepted` — the design this is not reopening), REQ-STATE-08
  (the fallback, and its stated Rationale).
- **Adjacent, not absorbed:** `dl-071-init-seeds-no-approver` (the other "what should `init`
  scaffold?" question from the same review — kept separate because it is a question about `adr-006`'s
  authority model, not about scaffold opinion; see Context),
  `bug-030-init-memory-yaml-has-no-state-machine` (`planned` on `main`; tracked `in-review` on its fix
  task's branch — the defect this sits downstream of).
- **Traceability:** P1.13 (memory element schema), P5.1.1 (`init`), REQ-STATE-08, REQ-SYS-04,
  REQ-SYS-07 (declared over inferred — the determinism argument against (B)).
