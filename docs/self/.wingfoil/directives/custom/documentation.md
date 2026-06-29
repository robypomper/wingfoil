---
id: documentation
name: "Documentation"
type: directive
kind: custom
title: "Documentation"
tags: [custom, documentation]
ref: [P3.8]
---

# Directive — Documentation

Custom stand-in directive. Applies to all roles.

> **Stand-in custom directive.** WingFoil's official built-in P3.8 templates are not yet implemented;
> until they ship, this generic rule (adapted to the project methodology/tech-stack in `dna.yaml`) is
> kept as `custom`. `ref: [P3.8]` records the built-in template it becomes once those exist.

- Every command/feature is documented (README + command docs) before it ships (npm package includes docs).
- Decisions live in Memory (`adr` for architectural decisions, `decision-log` for product/process
  decisions), not scattered across the codebase.
- Keep cross-references intact (see the custom `traceability` directive).
- Update the relevant `docs/` artifact in the same change that alters behavior.

> Source: Features §P3.8 (Documentation).
