---
id: "dl-022-spec-review-gate"
type: decision-log
title: "Spec-review gate: a tech-spec/ADR must pass a consistency review before approval"
status: ready
context: "process"
release: "v0.1"
tmpl_version: 260703
---

## Context

Across v0.1 delivery, several `tech-spec` documents reached `approved` while carrying defects that
were only caught later, at *code* time, inside `dev-loop`'s design safety-net — forcing in-flight spec
corrections and undocumented `[AUTHORING]` improvisation by the implementing task. The v0.1
retrospective (`retro-v0.1`) mined four concrete, distinct failure modes, none of which the
`tech-spec`/`adr` approval gate (`pending → approved` / `pending → accepted`) currently checks for:

1. **INTERNAL contradiction** — `spec-009` §2 prose required *recursive* unknown-field checking, but
   the spec's own code listing implemented root-only checking. Caught while implementing
   `task-002-validation-id-engine`.
2. **CROSS-SPEC inconsistency** — `spec-006` specified snake_case Tool names and a different MCP URI
   scheme than `spec-004`'s dot-form, with no cross-reference between the two documents. Caught while
   implementing `task-006-dual-interface-shared-core`.
3. **SPEC ↔ BDD/vision drift** — `spec-008`'s CLI grammar (positional arguments) disagreed with the
   BDD scenarios and vision docs (flag-based grammar). Caught while implementing
   `task-025-implement-dna-set` and `task-028-implement-paths-category`.
4. **Stale SARD/BDD text** — `REQ-SEC-06`'s confinement-boundary wording did not match the boundary
   actually needed (project root, not `.wingfoil/memory/`). Caught while implementing
   `task-017-storage-confinement` and `task-022-implement-memory-entries`.

In every case the defect was real, low-cost to describe, and would have been cheap to catch by reading
the spec against its siblings and against the acceptance contracts — but nothing in the approval path
asked a reviewer to do that reading. The gate today only requires `template.frontmatter.required` to be
present (REQ-STATE-01 validity), not that the content be internally or cross-document consistent.

## Decision

*(in-discussion — proposed, not yet ratified)* Introduce a **spec-review gate**: before a `tech-spec`
transitions `pending → approved`, or an `adr` transitions `pending → accepted`, a reviewer/architect
must confirm the document passes four checks:

1. **INTERNAL** — prose agrees with its own code listings, examples, and field tables (no
   `spec-009`-style self-contradiction).
2. **CROSS-SPEC** — no naming, URI/field-scheme, or terminology conflict with sibling specs already
   `approved` (no `spec-006`-vs-`spec-004`-style drift).
3. **SPEC ↔ BDD/vision** — command grammar, field names, and behaviour match the relevant BDD
   scenarios (`docs/02_requirements/02_bdd/features/`) and vision docs (no `spec-008`-style grammar
   mismatch).
4. **TRACEABILITY** — the spec cites the REQ(s)/feature ID it specifies for, and that citation is
   accurate (catches `REQ-SEC-06`-style stale requirement text at the point it would be relied on).

Concretely, this decision proposes two changes once ratified:

- Add a `spec-review` clause enumerating these four checks to the `architecture` custom directive
  under `.wingfoil/directives/custom/` (and cross-reference it from `code-review`, since reviewer role
  carries `code-review`+`traceability` per `roles.yaml` while architect carries `architecture`).
- Wire the check as an explicit `checks:`/approval precondition into the three workflow phases that
  currently move specs/ADRs through this gate: `initial-design/seed-specs` and
  `release-planning/identify-specs` (tech-spec `pending → approved`), and
  `release-planning/record-adrs` (adr `pending → accepted`).

No change to the `memory.yaml` state machines themselves — `tech-spec` (`draft → pending → approved
→ superseded`) and `adr` (`draft → pending → accepted → superseded`) are unaffected; this only adds a
precondition to an existing transition, the same way `memory.approve` already requires
approver-identity + reason evidence in the commit (§5.1).

## Rationale

- **Catch contradictions at spec time, not code time.** All four retro-v0.1 defects were discovered
  downstream, during implementation, which is the more expensive place to fix them and the place where
  determinism (REQ-SYS-07 — no ad-hoc, undeclared behaviour in context-building/implementation paths)
  is easiest to violate via silent `[AUTHORING]` fixes.
- **Upholds "specs win" in practice, not just in principle.** The project's golden rule is that specs
  are authoritative; a spec riddled with internal or cross-spec contradictions cannot actually serve
  that role. The gate makes "specs win" enforceable rather than aspirational.
- **Reuses existing machinery.** No new role or directive category — `architect` already carries
  `architecture` + `traceability`, `reviewer` already carries `code-review` + `traceability`
  (`roles.yaml`); this is an additional clause on directives and phases that already exist.
- **Trade-off considered.** A review gate adds friction/latency to every spec approval, versus the
  status quo of cheaper-per-instance but recurring code-time rework. The four retro-v0.1 instances
  across four different specs in a single release show the rework cost is real and recurring, not a
  one-off; the gate is chosen over leaving the status quo.

## Actions

- [ ] Ratify the spec-review gate (owner: approver).
- [ ] On ratify: (1) add the `spec-review` clause (four checks above) to the `architecture` custom
  directive, cross-referenced from `code-review`; (2) add a `checks:`/approval precondition entry to
  `initial-design/seed-specs`, `release-planning/identify-specs`, and `release-planning/record-adrs`
  in the workflow definitions; (3) note this DL in `dl-016-release-planning-governance-reconcile` if
  its `release-planning` phase wiring overlaps.
- [ ] No `memory.yaml` schema change required — this is a process precondition on an existing
  transition, not a new state.
