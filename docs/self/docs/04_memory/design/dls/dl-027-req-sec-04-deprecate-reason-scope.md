---
id: "dl-027-req-sec-04-deprecate-reason-scope"
type: decision-log
title: "Is --reason mandatory on `memory deprecate`? REQ-SEC-04 says yes, spec-008 and BDD P1.9 say no"
status: ready
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Four authoritative artefacts disagree about one flag, and the disagreement is currently resolved
only inside one task's Execution Notes.

**REQ-SEC-04** (`docs/02_requirements/03_sard/05_security-compliance.md`) names three verbs in all
three of its binding fields:

> **Description:** `approve`, `reject`, and `deprecate` require a `--reason`.
> **Fit Criterion:** Omitting `--reason` on `approve`/`reject`/`deprecate` returns exit code `2` with
> `"missing required argument: --reason"` and makes no change.
> **Traceability:** … Feature P1.9 (US-5-04, BDD `p1-memory/P1.9-memory-deprecate.feature`).

**`spec-008-cli-grammar`** (`approved`) §2 says the opposite for the third verb:

> **Required** on approval-gate commands (`memory approve`, `memory reject`); optional elsewhere
> (e.g. `memory deprecate`).

**BDD `P1.9-memory-deprecate.feature`** has no missing-reason scenario at all: both of its `--reason`
occurrences (lines 10 and 22) supply the flag. There is nothing to fail.

**CLAUDE.md §5.1** aligns with spec-008 — `memory.deprecate` is documented as "not an approval gate —
no `Approver:` line required — but a `Reason:` keeps the audit trail meaningful."

`task-041-mandatory-reason-on-verbs` shipped `requireReason` covering `approve`/`reject` only,
resolving the conflict in favour of spec-008 and recording that choice in its Execution Notes. Two
consequences follow. First, once `task-048-memory-deprecate` ships, `wingfoil memory deprecate x`
with no `--reason` will exit `0`, leaving REQ-SEC-04's Fit Criterion permanently unsatisfiable for a
third of its stated surface. Second, `task-048` declares `depends_on: ["task-041-mandatory-reason-on-verbs"]`,
a dependency this design renders vacuous.

## Decision

**Option (a): narrow REQ-SEC-04 to the approval
gates.** Amend its Description and Fit Criterion to name `approve`/`reject` only, and drop P1.9 from
its Traceability line. `memory deprecate` keeps `--reason` optional-but-encouraged, as CLAUDE.md
§5.1 already describes.

Alternatives:

- **(b) Amend spec-008 instead**, making `--reason` required on `deprecate`, and add the missing
  error scenario to `P1.9-memory-deprecate.feature`. This is the option most faithful to REQ-SEC-04's
  own **Rationale** — "Decisions must be explainable in the audit trail" — since a deprecation *is* a
  decision, and the one that most often needs explaining ("superseded by what?"). It costs an edit to
  an `approved` spec and a new BDD scenario, and it makes `task-048` widen `requireReason`'s call set.
- **(c) Change nothing.** Rejected: it leaves a Fit Criterion that no task will ever satisfy and that
  every future traceability audit will re-open.

## Rationale

- Three of the four artefacts (spec-008, P1.9, CLAUDE.md §5.1) already treat the flag as optional on
  `deprecate`; only REQ-SEC-04 does not. Option (a) makes the minority document yield, which is the
  smaller and more honest edit.
- `deprecate` is genuinely not an approval gate: it takes no `Approver:` line and carries no
  authority check. Grouping it with `approve`/`reject` under a requirement titled "Mandatory
  justification on **decision verbs**" conflates two different kinds of operation.
- **Argument against (a), stated explicitly for the approver:** REQ-SEC-04's Rationale is about the
  audit trail, not about approval gating, and by that reading `deprecate` belongs in scope and it is
  spec-008 that drifted. If the approver weighs the Rationale above the other three artefacts,
  option (b) is the correct outcome and this DL should be ratified that way.
- Whichever way it goes, the decision must live here rather than in `task-041`'s Execution Notes: a
  `done` task's notes are re-read only through `dl-015`'s `read_related` gate, which mandates reading,
  not acting.

## Actions

- Owner **approver**: ratify (a) or (b).
- If (a): amend REQ-SEC-04 (Description, Fit Criterion, Traceability); drop the now-vacuous
  `depends_on` on `task-048-memory-deprecate`.
- If (b): amend `spec-008` §2 (new version per the doc-versioning directive); add the missing-reason
  scenario to `P1.9-memory-deprecate.feature`; widen `requireReason`'s call set in `task-048`.
