---
id: code-quality
name: "Code Quality"
type: directive
kind: custom
title: "Code Quality"
tags: [custom, code-quality, typescript]
ref: [P3.8]
---

# Directive — Code Quality

Custom stand-in directive (TypeScript / Node.js). Applies to anyone writing code.

> **Stand-in custom directive.** WingFoil's official built-in P3.8 templates are not yet implemented;
> until they ship, this generic rule (adapted to the project methodology/tech-stack in `dna.yaml`) is
> kept as `custom`. `ref: [P3.8]` records the built-in template it becomes once those exist.

- Lint clean: no errors; warnings triaged before merge.
- Respect complexity limits; prefer small, single-responsibility functions.
- No dead code, no commented-out blocks, no `any` without justification (TypeScript).
- Match surrounding code style, naming, and idioms.
- All public APIs typed; validate external input with Zod at boundaries.

> Source: Features §P3.8 (Code Quality). Auto-installed for the TS/Node tech stack.
