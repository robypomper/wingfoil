---
id: traceability
name: "Requirement traceability chain"
type: directive
kind: custom
title: "Requirement traceability chain"
tags: [custom, traceability, requirements]
ref: [docs/02_requirements/X_specs-downcast-plan.md]
---

# Directive — Requirement traceability chain

Custom WingFoil rule. Applies to reviewers, architects, and product owners.

- Maintain the chain: **feature (P*) → user story (US-*) → BDD scenario → SARD requirement
  (REQ-*) → tech-spec (when the task implements a shared file format, schema, constant set, or
  module API) → task**.
- Every architecture decision references the SARD requirement(s) it implements.
- Every tech-spec references the SARD requirement(s)/feature it specifies for.
- Every task references its feature id and target release, and its tech-spec(s) when one exists.
- Keep each task's target-release assignment consistent with the planned release cadence in
  `docs/01_vision/07_sequencer.md` — roughly one release per week, each centered on a pillar
  (v0.1 → v1.0). Relocated here from the former `dna.yaml` `conventions.process.release_cadence`.
- Every base document (adr, decision-log, tech-spec, bug) carries a `release` field with the uniform
  meaning "the release this element's implementation is assigned to" (== `task.release`), stamped by
  `release-planning`'s `build-backlog` (`dl-016`). A bug additionally carries `release-origin` — the
  release it was *found in* — which must not be conflated with its fix `release`.
- A task's `depends_on` obligations (`dl-015`) are a required cross-reference: the `dev-loop` review
  gate rejects a task that ignored a declared upstream task's Execution-Notes constraint.
- A reviewer rejects work that breaks or omits a required cross-reference.

> Rationale: traceability is what lets Casey/Morgan see how requirements flow to test and release,
> and what makes the audit trail complete. Source: `docs/02_requirements/X_specs-downcast-plan.md`.
