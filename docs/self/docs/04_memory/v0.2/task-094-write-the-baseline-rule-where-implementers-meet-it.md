---
id: "task-094-write-the-baseline-rule-where-implementers-meet-it"
type: task
title: "Write dl-080's baseline rule where an implementer meets it — a directive and the specs — so the next read or write is not decided by whoever adds it"
status: backlog
release: "v0.2"
priority: "high"
tags: ["v0.2", "governance", "directives", "determinism"]
ref: "dl-080-which-baseline-each-command-reads"
bug: []
depends_on: ["task-091-reads-resolve-at-head", "task-092-writes-refuse-a-dirty-target", "task-093-dna-mutation-surface-add-remove-update"]
tmpl_version: 260703
---

## Description

`dl-080-which-baseline-each-command-reads` is `ready`, ratified as option **(B)**: a read that gates
an operation resolves against the repository as committed at `HEAD`, and a write refuses while its
target carries modifications the command does not own.

Its **Action 4** asks that the ruling be written "where an implementer meets it — a `custom/`
directive, or the CLI grammar spec — not only here". That action has no owner and is unperformed.
Two tasks reported it independently (`task-091` and `task-092`) after sweeping for further instances,
which is itself the evidence that it matters: both looked for where the rule was recorded, and both
found it recorded only in the decision-log.

**This is the loop-closing task for the whole class.** Eight instances of one root cause have been
found in this release — `bug-076`, `bug-078`, `bug-079`, `bug-081`, `bug-082`, plus three more from
`task-091`'s sweep — and every one existed because nothing told the implementer which state a command
reads. Fixing the eight without writing the rule down leaves the ninth to be decided by whoever adds
it. `dl-080`'s own rationale names this as a **determinism** finding: two agents given the same defect
class produced two different architectures.

## Acceptance Criteria

- **AC1** — **Choose the carrier and argue it**, rather than doing all of them by default. The
  candidates are a `custom/` directive, an amendment to `spec-005-cli-command-contract`, an amendment
  to `spec-008-cli-grammar`, and any combination. Weigh what each reaches: directives are **bound by
  role** (`roles.yaml`), so a directive reaches whoever executes under that role and is auto-loaded
  per P3.6; a spec is read when someone looks for the contract. Record which audience each misses.
- **AC2** — The rule as written states **both halves** — the read baseline and the write refusal —
  because the class contains both, and half a rule would have prevented only half the instances.
- **AC3** — It states the **consequences already decided**, so they are not re-derived: refusals exit
  `1` per `spec-005` §1 (ruled on `bug-076`); the read must be made **unreachable** rather than
  guarded where possible (`task-090`'s shape, followed by `task-091`); and a path or target that does
  not resolve is refused, never created (`dl-081`, `bug-084`).
- **AC4** — If a directive is the carrier, it is **bound in `roles.yaml`** to the roles that write
  code — at minimum `developer`, and consider `architect`. An unbound directive reaches nobody
  (`bug-059`'s sibling problem in `dl-042`: a directive bound to no role is invisible). Verify the
  binding loads: `wingfoil directives list --role developer` must show it.
- **AC5** — **Cite what exists rather than restating it.** By the time this runs, the rule will be
  implemented in `task-090`, `task-091`, `task-092` and `task-093`; the document should point at the
  primitives those built (`loadDnaYamlAtHead`, `loadMemoryYamlAtHead`, `requireUnmodifiedTarget`,
  `verifyCommittedScope`) so an implementer reaches for them instead of writing a third mechanism.
  Cite by symbol plus the commit read at, per `dl-075`.
- **AC6** — Any spec amendment is an in-place dated Revision note under `dl-047`, the route
  `task-079`, `task-084` and `task-085` used on `spec-015`. Frontmatter untouched, `status: approved`
  preserved.
- **AC7** — Confirm at execution time that `dl-080` is still `ready` and that its Action 4 is still
  unperformed — **do not trust this description**. If `task-093` has already amended a spec with the
  rule, say so and narrow this task rather than duplicating it.
- **AC8** — All six gates green; the full `tsc --noEmit -p tsconfig.json` silent. The diff is expected
  to be documentation and configuration only; if it touches `src/`, explain why.

## Implementation Notes

- **Run this AFTER the three implementation tasks land**, which is why they are `depends_on`. The
  document describes what they built, and `task-093`'s AC8 already amends `spec-002`, `spec-006` and
  the grammar spec — overlapping edits to the same documents from two directions is how a merge
  conflict becomes a contradiction.
- Read `dl-080` in full, including its approve commit's `Reason:`, before writing a word. The
  ratification settles which option was chosen and why the other four were not, and a directive that
  re-opens that is worse than none.
- `docs/self/.wingfoil/directives/custom/` holds ten directives today; `determinism.md` is the closest
  neighbour and is already bound to `developer` and `architect`. Whether this rule belongs inside it
  or beside it is part of AC1.
- Classify every AC per `dl-014`/T1. This is a documentation and configuration task: expect
  characterization throughout, and do not fabricate a red.

## Execution Notes

<!-- filled in per phase -->

## Material gathered while this task waited (2026-09-24)

This task was deliberately held at `backlog` after its dependencies cleared, because each week of
delivery adds evidence for exactly the rule it exists to write. Three items accumulated; all three
are inputs, not scope changes.

**1. A "resolution read" versus "gate read" distinction now exists in a TSDoc and nowhere else.**
`task-096` deliberately left `directive remove`'s resolution read on the working tree, and its
reviewer verified the reasoning in both directions: the exception buys an accurate refusal for an
untracked file (`requireUnmodifiedTarget` names it) and loses one for a file committed at `HEAD` but
deleted in the working tree (which gets `unknown directive` instead). Neither choice can destroy
anything — `task-092`'s guard decides that after both — so it is a message-quality trade, not a
safety one.

The problem is the classification itself. `dl-080` option (B) says *a read that gates an operation*
resolves at `HEAD`; step 3 of `directive remove` **is** a read that gates, since it returns
`NOT_FOUND` at exit 1. Calling it a "resolution read" is a category `dl-080` does not contain, and it
sits close to the option (C) the approver explicitly withdrew rather than reshaped. Today that
distinction lives only in `directiveRemoveFn`'s TSDoc and `task-096`'s Execution Notes, which is
precisely the placement this task exists to fix. **Either write the exception into the rule, or write
that there is no exception and let `bug` handle the message quality.** Do not leave it where an
implementer meets it by accident.

**2. Four tasks have now re-derived the rule from prose.** `task-091`, `task-092`, `task-093` and
`task-096` each implemented `dl-080` and each wrote its own set of TSDoc comments restating it.
`task-096`'s implementer raised this itself as a proposed element. That is the cost `dl-080`'s
Action 4 was written to stop, and it now has a number rather than an intuition.

**3. A twin rule belongs beside it, and `bug-096` carries the evidence.** `task-093` was rejected
twice and approved over a third finding, all three for the same habit: a sentence asserting a fact
about the code, written without running the command that settles it — a coverage attribution, a
`spec-008` §9 clause, then a comment about `program.options`. `task-096` produced a fourth in the same
week: a TSDoc claiming git C-quotes paths containing spaces, which it does not, next to a test whose
fixture was chosen so that the claim could not be checked.

The rule is one sentence — *a comment or note that asserts a fact about the code names the command
that establishes it* — and the release has four measured instances arguing for it. It belongs in the
same directive as `dl-080`'s rule because it has the same shape: something everybody was expected to
know, that nothing wrote down, rediscovered once per task at review cost.

**How to treat this section.** It is evidence for the rule's *placement and wording*, not an
instruction to widen scope. If any of the three turns out to belong elsewhere, say so in the Execution
Notes and name where — do not carry it silently.
