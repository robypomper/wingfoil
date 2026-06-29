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
- A reviewer rejects work that breaks or omits a required cross-reference.

> Rationale: traceability is what lets Casey/Morgan see how requirements flow to test and release,
> and what makes the audit trail complete. Source: `docs/02_requirements/X_specs-downcast-plan.md`.
