---
id: "dl-028-archived-states-excluded-from-context"
type: decision-log
title: "Which statuses count as archived for context exclusion? REQ-STATE-06 names only `deprecated`, but `superseded` is equally archived"
status: ready
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

**REQ-STATE-06** (`docs/02_requirements/03_sard/03_state-context.md`) promises more in its Rationale
than its Fit Criterion delivers:

> **Description:** Documents in `deprecated` state remain in the repo but are excluded from agent
> context and default searches.
> **Rationale:** Distinguish active from archived decisions.
> **Fit Criterion:** A `deprecated` document never appears in an assembled agent context nor in
> default `memory search` results, while remaining present on disk and in git history.

The Rationale says *archived*; the Description and Fit Criterion say *`deprecated`*. Those are not
the same set. Per `memory.yaml` and CLAUDE.md §5, **`superseded`** is the terminal state of both
`adr` and `tech-spec`, reached by `approve` along the forward `sequence` — never by `memory.deprecate`.
A superseded ADR is an archived decision by any plain reading of the Rationale, yet nothing excludes
it. An agent assembling context today can be handed the ADR that was explicitly replaced, alongside
the one that replaced it.

A second, smaller defect sits in the same place. **`spec-012-context-loader-relevance-filtering`**
(`approved`) §6 states:

> Documents in states `draft`/`rejected`/`deprecated` are **excluded**

`rejected` is not a status this project has. `spec-001-memory-yaml-schema` removed it; CLAUDE.md §5
records that "there is **no separate `rejected` status** anymore anywhere". The entry is vestigial.

Both v0.2 tasks that touched this ground behaved correctly against the specs as written and flagged
the gap rather than silently widening it: `task-038-deprecated-excluded-from-context` excluded
`deprecated` only, and `task-035-bounded-context-relevance` retained the vestigial `rejected` with an
explicit `SPEC-CONFLICT` comment. Neither can be fixed by changing code — only a spec change moves them.

## Decision

*(in-discussion — proposed, not yet ratified)* **Option (a): make the archived set explicit and
canonical as `{deprecated, superseded}`.** Amend REQ-STATE-06's Description and Fit Criterion to name
both; amend `spec-012` §6 to exclude `{deprecated, superseded}` and drop the vestigial `rejected`;
land a single shared predicate (`isArchivedStatus`, superseding `task-038`'s `isDeprecatedStatus`)
that both the search path and the context path consume.

Alternatives:

- **(b) Keep `deprecated` only, and fix the Rationale instead** — reword it to "distinguish current
  from deprecated decisions" so the requirement stops promising a set it does not deliver. Cheaper,
  and defensible if superseded ADRs are considered *historically necessary* context (an agent reading
  `adr-00X` may need to know what it replaced). Still requires dropping `rejected` from `spec-012` §6.
- **(c) Change nothing.** Rejected: it leaves a Rationale that contradicts its own Fit Criterion and a
  spec clause naming a status that cannot occur.

## Rationale

- The failure the Rationale names is exactly the one that survives today: a superseded ADR reaching an
  agent is the "archived decision presented as active" case, and it is the more dangerous of the two
  because `superseded` documents are, by construction, the ones a newer decision contradicts.
- Excluding by a single shared predicate avoids the divergence already forming: `task-035` carries its
  own local `EXCLUDED_STATUSES`, `task-038` exports `isDeprecatedStatus`, and neither is aware of the
  other. Settling the set now means one primitive rather than a reconciliation task later.
- **Argument for (b), stated for the approver:** context exclusion and *retrievability* are different
  questions, and explicit lookup by id already bypasses the filter in `task-038`'s design. If
  superseded ADRs are wanted in relevance-ranked context at a lower score rather than excluded
  outright, that is a scoring change in `spec-012` §6, not an exclusion change — a third shape worth
  weighing before ratifying (a).
- The `rejected` removal is not contentious under any option and should land regardless.

## Actions

- Owner **approver**: ratify (a) or (b); decide separately whether `superseded` is excluded or merely
  down-ranked.
- Either way: amend `spec-012` §6 to drop `rejected` (new spec version per the doc-versioning directive).
- If (a): amend REQ-STATE-06; supersede `isDeprecatedStatus` with a shared `isArchivedStatus`;
  reconcile `task-035`'s local `EXCLUDED_STATUSES` onto it.
- Related: `bug-010-deprecated-reaches-agent-context` (the surfaces where even plain `deprecated` is
  not yet excluded) — this DL decides the *set*, that bug fixes the *reach*.
