---
id: "dl-124-not-applicable-for-required-fields"
type: decision-log
title: "A required frontmatter field cannot say \"not applicable\", so a type's rule is either weakened for everyone or satisfied with false data — declare an explicit not-applicable value per field"
status: in-discussion
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`, being filed now). The retrospective's completeness
pass over the notes kept during the release surfaced a proposal no existing element carried, and the
approver accepted it at the `additional-points` gate: a required frontmatter field needs a declared
way to say "not applicable".

**How required fields work.** Each type in `memory.yaml` declares
`template.frontmatter.required`, and `memory submit` refuses a document whose required fields are
missing. `missingRequiredFields` (`src/memory/submit.ts`) treats a field as missing when
`isEmptyValue` holds: `undefined`, `null`, a blank string, or an empty list. There is no third
state. A field is either filled with a value, or it blocks the submit.

**Where that forces a bad choice.** A field is required because it applies to most elements of the
type, not to all of them.

- **A patch release.** `release` requires
  `[ title, version, pillar, features, requirements, release-line ]` (`memory.yaml`,
  `types.release.template.frontmatter.required`). `requirements` points at a per-release backlog file
  under `docs/03_backlog/04_backlog/by-release/`, and `git ls-tree --name-only a20b346c
  docs/03_backlog/04_backlog/by-release/` lists `v0.1.json` … `v1.0.json`, with no patch release.
  A patch has no pillar and may add no feature. The v0.2 retrospective scheduled a patch, v0.2.2,
  and `dl-092-tracking-a-patch-after-its-minor-is-released` asks how to track it. Under the current
  rule its document must invent a `pillar`, point `requirements` at a file that does not exist, or
  have the field dropped from `required` for every release.
- **An ADR with no SARD requirement.** `adr` requires `sard_ref`. All ten ADRs at `a20b346c` have one
  (`grep -h "^sard_ref:" docs/self/docs/04_memory/design/adrs/*.md`), but an ADR on a
  tooling or process choice with no SARD requirement behind it would have to cite one anyway.
- **An empty list is not "none".** `features: []` reads as missing today. That the empty-list
  case is a defect of its own is `bug-147-submit-reads-an-empty-list-as-missing`; even when it is
  fixed, an empty list says "none yet", not "this does not apply".

Either way out loses information. Dropping the field from `required` removes the check from every
element that should have it. Filling it with a placeholder writes data that is false, and a reader
or a query cannot tell it from real data. The `claim-evidence` directive cannot be satisfied by a
field that states something false.

## Decision

A type may declare, per required field, that the field accepts an explicit **not-applicable**
value. `memory submit` accepts that value only for fields declared to take it, and a reader can
always tell it from data. The open choices below remain for the approver.

**Q1 — how not-applicable is written:**
- **(A) one reserved value**, `n/a`, the same in every type and field. A field holding it is present
  for `missingRequiredFields` only when the type declares the field as accepting it.
- **(B) a sibling field**, `not_applicable: [pillar, requirements]`, listing the fields that do not
  apply; the fields themselves stay empty.
- **(C) conditional requirement**: `required_unless: { kind: patch }`, keyed on another field's value.

**Q2 — where it is declared in `memory.yaml`:**
- **(a)** `template.frontmatter.not_applicable_allowed: [ pillar, features, requirements ]`, next to
  `required`;
- **(b)** per-state, `nullable_for: [ <state>, … ]` on each field, so a field may be not-applicable in
  `draft` but not later.

**Q3 — must a not-applicable value carry a reason:**
- **(i) no**; the declaration in `memory.yaml` is the justification;
- **(ii) yes**, as a quoted string `"n/a — <reason>"` (quoted, because an unquoted `n/a: <reason>`
  would parse as a YAML mapping), so each use says why.

**Recommendation:** Q1 (A), Q2 (a), Q3 (ii).
- **Q1 (A)** keeps each fact in the field it belongs to, and a search for a `pillar` value starting
  `n/a` finds every element where the field does not apply. (B) splits one fact across two fields. (C) is expressive
  but needs a condition language `memory.yaml` does not have.
- **Q2 (a)** is the smallest schema change. (b) answers a question nobody has asked yet.
- **Q3 (ii)**: an unexplained `n/a` is the same guess as a placeholder, and one line of reason is what
  `claim-evidence` asks of every other statement.

## Rationale

- **Exceptions become visible and declared.** Today the only exception mechanism is weakening the
  rule. A declared not-applicable value keeps the rule for the elements it fits, and makes every
  exception a searchable value with a reason.
- **Deterministic and validated in one place.** The accepted value and the allowlist live in
  `memory.yaml`, and the check stays in `missingRequiredFields`, validated by the same schema
  (`src/memory/schema.ts`) that validates `required` today.
- **Trade-off.** A reserved value is one more convention to document (spec-001, spec-010), and
  readers of those fields (queries, the MCP Resources) must treat `n/a` as a value, not as data.

Alternatives considered:
- **Make the fields optional.** Rejected: it gives up the check for every element to spare a few.
- **A separate type per exception** (a `patch-release` type). Rejected as a general answer: it
  multiplies types for what is one field's applicability. `dl-092` may still choose it for patches
  on its own grounds.

## Actions

1. **Ratify, choosing Q1–Q3.** Owner: approver. The choice goes in the approve commit's `Reason:`.
2. **Amend `spec-001-memory-yaml-schema`** (the new declaration) and
   **`spec-010-memory-frontmatter-schema`** (the reserved value and its reading).
3. **Code**, behind a v0.3 task: `TemplateConfig` in `src/memory/schema.ts` accepts the declaration;
   `missingRequiredFields` accepts the value only where declared; tests on both sides.
4. **This repository's `memory.yaml`** declares not-applicable where a type needs it, starting with
   `release` once `dl-092` settles patch tracking; bump its `version`.
5. **Tasks are derived by v0.3 `release-planning` (`build-backlog`)**, not created here.

## Relations

- **Origin:** `retro-v0.2`, from the completeness pass over the notes kept during the release
  (`retrospective-rel-v0.2-plan` §4.10).
- **Amends, on ratification:** `spec-001-memory-yaml-schema`, `spec-010-memory-frontmatter-schema`,
  `memory.yaml`.
- **Related:** `bug-147-submit-reads-an-empty-list-as-missing` (the empty-list case);
  `dl-092-tracking-a-patch-after-its-minor-is-released` (the first type that needs this);
  `dl-114-recording-agent-token-consumption` (`not-reported`, the same idea for run records).
- **Traceability:** P1.13 (Memory element schema), P1.6 (`memory submit`).
