---
id: "dl-086-a-guard-over-a-filesystem-effect-resolves-on-the-filesystem"
type: decision-log
title: "A read that predicts what an imminent syscall will touch cannot resolve at `HEAD` — the guard would be decorative in exactly the case it exists for"
status: in-discussion
context: "architecture"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`dl-080` option (B) is `ready`: a read that gates an operation resolves at `HEAD`. `command-baseline`
(the `custom/` directive `task-094` wrote) states it, states that there is no third category of read,
and states that a deviation is argued in a decision-log rather than taken in a TSDoc.

`task-102` deviated. Its confinement guard calls `realpathSync` against the **working tree**, and the
answer decides whether `directive remove` refuses. By the directive's own mechanical test that is a
gating read. The task was instructed — by the orchestrator, in its own Implementation Notes — to
resolve it at `HEAD`, and did not.

The implementation is right and the instruction was wrong. This document is the argument the
directive requires, written so the next agent meeting the case does not re-derive it differently.

## Evidence

### E1 — `HEAD` cannot answer the question being asked

The harm is one syscall: `unlinkSync`, which follows the symlinks **on disk** and consults nothing a
commit records.

Replacing `.wingfoil/directives/custom` with a symlink is a working-tree act that need never be
committed. So a `HEAD`-resolved chain sees a real directory, permits the operation, and the unlink
still lands outside the project root — the guard is decorative in precisely the case it exists for.

### E2 — the converse fails too

A symlink committed at `HEAD` but replaced by a real directory in the working tree would be **refused**
for a crossing that cannot happen. Resolving at `HEAD` is not merely insufficient here; it is wrong in
both directions.

### E3 — `dl-080` arbitrates a different kind of question

`dl-080`'s subject is baselines of **content and declaration** — what the project *says*: which types
exist, which roles are declared, which directives are installed. Those are re-derivable by a second
clone, which is why `HEAD` is the right answer and why `adr-006` and REQ-SEC-02 support it.

This read asks something else: **what will this syscall touch?** It is a prediction about a physical
effect, not a question about what the project declares. No commit can answer it, because the effect
does not consult commits.

### E4 — the two reads sit four lines apart, under opposite rules

`directiveRemoveFn`'s step 3 resolves a directive **name** against the working tree and gates on it.
That one *is* `dl-080`'s subject, it *should* resolve at `HEAD`, and `bug-108` is open against it. The
confinement guard, added immediately after, correctly does not.

Two adjacent gating reads owing different baselines, for reasons nothing in the repository states, is
exactly the divergence `dl-080` was raised over.

## Decision

Proposed narrowly, as `task-102` argued it:

> **A read whose purpose is to predict the target of an imminent filesystem mutation resolves on the
> filesystem. Every other gating read keeps `HEAD`.**

### What this deliberately does not license

- **Not step 3's name resolution.** `bug-108` stays open and that read is still owed to `HEAD`. The
  test is the read's *purpose*, not its proximity to a mutation.
- **Not option (C) under another name.** (C) sorted gating reads by what they **produce** — durable
  attestation or not — and was withdrawn because it left `bug-082` open by design. This sorts by what
  the guarded **effect** touches, and it narrows the exception surface rather than widening it: (C)
  would have permitted `task-102`'s read *and* others; this permits one shape.
- **Not the "explain, never decide" clause.** `command-baseline` allows reading the working tree to
  *word* a refusal. Here the working tree **decides** it. Different clause, different licence.

## Rationale

The cost of leaving this unwritten is not that someone writes the wrong code — `task-102` wrote the
right code. It is that the next agent meets a guard breaking a ratified rule with no argument beside
it, and either copies the deviation into a case where `HEAD` was correct, or "fixes" this one back to
`HEAD` and makes the guard decorative. Both are the determinism failure the north star names.

**Residual risk, named rather than hidden.** There is a TOCTOU window between `realpathSync` and
`unlinkSync` that **no path-based API closes** — only `openat`/`O_NOFOLLOW`-style file-descriptor
primitives would, and Node's `fs` exposes none. This guard converts a routine, self-inflicted loss
into a refusal. It is **not** an adversarial defence and must not be cited as one.

**Determinism.** This is not a context-building path, so REQ-SYS-07's ordering constraints are not in
play; two runs against the same filesystem agree.

## Actions

1. Decide whether to adopt the rule as proposed, narrow it further, or reject it and require `HEAD`
   (which E1 argues makes the guard decorative).
2. If adopted, amend `command-baseline` — its "there is no third category of read" is the sentence
   this contradicts, and it must not be left standing beside a ratified exception.
3. Leave `bug-108` owed to `HEAD` explicitly, in whichever document carries the rule, so the two
   adjacent reads are visibly different rather than accidentally so.

## Relations

- Extends `dl-080-which-baseline-each-command-reads` (ready); does not amend its subject.
- Raised by `task-102-directive-remove-confines-its-deletion-to-the-project-root`, at its reviewer's
  insistence, against an instruction the orchestrator had written into that task.
- Constrains `command-baseline` (`docs/self/.wingfoil/directives/custom/`) and `task-105`, which
  applies the same guard shape to the Memory store (`bug-117`).
- `bug-108` is the adjacent read that keeps `HEAD`.
