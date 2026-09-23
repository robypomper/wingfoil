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
