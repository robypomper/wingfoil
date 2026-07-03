---
id: adr-007-stateless-state-derivation
type: adr
title: "Stateless state derivation (no state index)"
status: pending
sard_ref: REQ-SYS-03
supersedes: ""
tmpl_version: 260703   # Orignal template version
---

## Context

Every WingFoil element (release-line, release, task, adr, decision-log, tech-spec, bug) and every
workflow phase needs a current state so agents and humans can tell what to do next: what is still a
draft, what is pending review, what has been approved. The obvious alternative is a dedicated
`.wingfoil/state/` index file (or database) that tracks the state of every element and phase
centrally. That approach creates a second source of truth alongside the Memory documents themselves:
the index can drift from the documents it describes if a commit updates one but not the other, if a
manual edit bypasses the tool, or if a merge resolves the two differently. Because state is exactly
the kind of value that changes on every approval, submit, and reject, this drift risk is not
theoretical — it would recur on nearly every commit that touches Memory.

Without a decision to keep state colocated with the deliverable, the project would need to invest in
index-consistency machinery (locking, reconciliation, drift detection) purely to keep a derived value
in sync with its source — effort spent defending against a problem that does not exist if the index is
never created.

## Decision

Element and workflow state is derived, not stored. For Memory-backed elements, state is read directly
from each document's own frontmatter `status:` field, validated against that element type's state
machine as declared in `.wingfoil/memory.yaml` (REQ-STATE-01, REQ-STATE-08). For non-Memory workflow
phases (spec/design phases with no backing Memory document), phase completion is deduced from the
existence of the phase's declared `produces:` artifacts on disk. There is **no** separate
`.wingfoil/state/` index anywhere in the repository. Recomputing state for a given commit — by
scanning frontmatter and artifact existence at that commit — always yields the same result as any
previously cached computation (REQ-STATE-02).

## Consequences

- **Positive:**
  - State can never disagree with the deliverable it describes: there is only one place to look, and
    only one place that can be wrong.
  - Deleting any in-memory cache or derived view and recomputing state from the repository is always
    safe and always reproducible for a fixed commit (REQ-SYS-03 fit criterion; REQ-STATE-02).
  - Git history is the sole audit trail for state transitions — no secondary log to keep consistent
    with it.
- **Negative:**
  - State queries must scan frontmatter (and, for phase completion, check artifact existence) rather
    than do an O(1) index lookup; acceptable at the project's current scale, but a query-heavy command
    (e.g. `memory list --status pending` across a large tree) pays a linear scan cost.
  - Tooling that wants a fast "what changed state recently" view must derive it from git log /
    frontmatter diffs rather than reading a ready-made index.
- **Neutral:**
  - Every transition is still validated against the element type's declared state machine before the
    frontmatter is written (REQ-STATE-01, REQ-STATE-04); this ADR only rules out a *separate* index,
    not the *validation* of transitions.
  - Non-Memory phase completion depends on `produces:` artifacts being declared accurately in the
    workflow definition; an incomplete `produces:` list would misreport phase completion, which is a
    workflow-authoring concern rather than a state-storage concern.

## Process Notes

Grounded in `docs/02_requirements/03_sard/01_architecture.md` (REQ-SYS-03) and
`docs/02_requirements/03_sard/03_state-context.md` (REQ-STATE-01, REQ-STATE-02, REQ-STATE-08), which
are the current ground truth for this requirement. This document is expanded with workflow phase
deduction via `produces:` artifacts and explicit REQ-STATE-01/02/08 citations.
