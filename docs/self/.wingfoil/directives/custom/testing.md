---
id: testing
name: "Testing"
type: directive
kind: custom
title: "Testing"
tags: [custom, testing, tdd, jest]
ref: [P3.8]
---

# Directive — Testing

Custom stand-in directive. Applies to developers and QA.

> **Stand-in custom directive.** WingFoil's official built-in P3.8 templates are not yet implemented;
> until they ship, this generic rule (adapted to the project methodology/tech-stack in `dna.yaml`) is
> kept as `custom`. `ref: [P3.8]` records the built-in template it becomes once those exist.

- Test-first / TDD: write a failing test before the implementation (red → green → refactor).
- Maintain >80% coverage (Jest); coverage must not regress on merge.
- Each behavior has at least one happy-path and one edge/error-path test (mirrors the BDD suite).
- Tests are deterministic and isolated; no reliance on external services or wall-clock/random.

> Source: Features §P3.8 (Testing). Aligns with `dev-loop` TDD sub-workflow.
