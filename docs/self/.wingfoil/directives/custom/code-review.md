---
id: code-review
name: "Code Review"
type: directive
kind: custom
title: "Code Review"
tags: [custom, code-review, approval]
ref: [P3.8]
---

# Directive — Code Review

Custom stand-in directive. Applies to reviewers (and the approver gate).

> **Stand-in custom directive.** WingFoil's official built-in P3.8 templates are not yet implemented;
> until they ship, this generic rule (adapted to the project methodology/tech-stack in `dna.yaml`) is
> kept as `custom`. `ref: [P3.8]` records the built-in template it becomes once those exist.

- Review checklist: correctness, tests present + passing, adherence to other directives, no secrets.
- Verify the change matches its task/deliverable acceptance criteria.
- When reviewing a `tech-spec` or `adr` for approval, apply the **spec-review gate** from the
  `architecture` directive (`dl-022`): internal + cross-spec + BDD/vision + traceability consistency.
- Approve via `wingfoil memory approve` (records reason); reject via `wingfoil memory reject`
  (returns to the workflow `fallback` step with feedback).
- Approval binds to the `reviewer`/`approver` role, not a person.

> Source: Features §P3.8 (Code Review). Used by the `dev-loop` review step.
