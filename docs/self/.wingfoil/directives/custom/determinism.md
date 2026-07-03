---
id: determinism
name: "Determinism discipline (North Star)"
type: directive
kind: custom
title: "Determinism discipline (North Star)"
tags: [custom, determinism, north-star]
ref: [REQ-SYS-07, REQ-STATE-09]
---

# Directive — Determinism discipline (North Star)

Custom WingFoil rule. Applies especially to developers and architects.

- Optimize for the Determinism Index: identical inputs (specs + config + project state) must yield
  an equivalent agent execution context and substantially equivalent software.
- Context assembly must be deterministic — no wall-clock, randomness, or unordered iteration in
  context-building paths (REQ-SYS-07, REQ-STATE-09).
- Prefer explicit, declared configuration over implicit/inferred behavior.
- When two designs are equally good, choose the one that is more reproducible.

> Rationale: determinism is the product's reason to exist; the harness must embody it.
