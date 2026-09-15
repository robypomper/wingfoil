---
id: "dl-023-init-cli-e2e-smoke-gate"
type: decision-log
title: "Standing fresh-init + CLI end-to-end smoke gate before release-submit"
status: ready
context: "process"
release: "v0.2"
tmpl_version: 260703
---

## Context

`retro-v0.1` (T5/T7 dispositions) traces two related v0.1 gaps to a single missing safety net.

**(a) `init` scaffolds config that fails its own schemas.** `bug-005-init-scaffold-fails-schema-validation`
(critical) found that `wingfoil init` (any template) writes a `dna.yaml` that fails
`spec-002-dna-yaml-schema`'s own `DnaYaml` Zod schema and a `memory.yaml` whose types carry no
`id_pattern` — so `dna show`, `dna set`, `paths`, and `memory add` all error immediately, exit `1`, on
a freshly-initialized project. It was caught only by luck, at the very **last** task of the release
(`task-032-readme-cli-quickstart`), during manual real-CLI verification of the README quick-start
walkthrough — not by any automated check. `bug-006-init-directive-scaffold-schema-invalid` (still
`open`) is the same class of defect one layer down: the directive-template generator omits `id`,
`type: directive`, and `title`, so `wingfoil directives list` errors `E_VALIDATION` on a fresh project.

**(b) The CLI is the least-tested layer.** Three polish bugs escaped to release regardless
(`bug-001-cli-version-flag`, `bug-002-cli-error-stack-dump`, `bug-003-cli-integration-dist-race`, all
now `closed`), and `task-006`/`task-007` (dual-interface shared core, npm distribution) discovered that
commander v15 is ESM-only and therefore untestable under the project's CommonJS Jest runtime
(`bug-007-commander-esm-jest-untestable`, `open`, deferred to v0.2) — so CLI wiring is excluded from
automated coverage and "only ever verified by hand."

**Root cause, common to both:** nothing in the release workflow ever ran a real `wingfoil init` end-to-
end and then exercised the scaffolded project through the CLI surface as a standing, repeatable gate.
Scaffold/schema drift and CLI-wiring regressions were only ever caught by whichever task happened to
touch that area manually — in `bug-005`'s case, almost not at all.

## Decision

Add a standing **fresh-init + CLI end-to-end smoke gate**
run every release, before `release-submit`:

- It runs a real `wingfoil init` (each supported template: Scrum, Kanban) into a throwaway directory,
  then drives the scaffolded project through the CLI surface — `dna show`, `dna set`, `memory add`,
  `memory submit`, `paths`, `directives list`, at minimum — asserting **correct exit codes** per
  `spec-005-cli-command-contract` and **schema-valid scaffolded artifacts**: `dna.yaml`, `memory.yaml`,
  and the directive `.md` files must each round-trip through their own loaders/Zod schemas
  (`spec-002-dna-yaml-schema` and the memory/directives equivalents), not merely "look right."
- Implemented as a new `e2e-smoke.yaml` sub-workflow (`kind: sub`, `element: release`), wired into
  `release-cycle.yaml` immediately before `release-submit` — either as its own phase or as a
  `release-submit` pre-check; the config task that ratifies this decides the exact wiring shape.
- **Staged rollout**, same posture as `dl-013`'s docs-gate B-DECISION (`retro-v0.1` Actions): the gate
  starts as `warn` (reports failures, does not block) and flips to hard-reject once it runs green for a
  release, so the gate doesn't itself become a bootstrap blocker.
- Does **not** duplicate the existing bug records. `bug-004`, `bug-005`, `bug-006`, and `bug-007`
  remain their own defects with their own fixes/dispositions; this DL is the **process gate** that
  would have caught `bug-005`/`bug-006` at release time and would continue to catch their class of
  regression going forward — it does not resolve any of them by itself.

## Rationale

- **A black-box safety net at exactly the boundary v0.1 left untested.** Every other v0.1 test layer
  (unit, BDD) exercises code paths directly; nothing exercised "a user runs `init` then uses the CLI"
  as a single scenario — which is precisely how `bug-005` slipped through 32 tasks undetected.
- **Would have caught `bug-005` at `release-submit`, not at the last task.** The gate turns "caught by
  luck during README verification" into "caught deterministically, every release, before submit."
- **Complements, doesn't compete with, `bug-007`'s fix.** `bug-007` is a white-box (in-process,
  in-Jest) fix for CLI testability; this gate is a black-box (real subprocess, real filesystem) check
  that still has value even once `bug-007` lands — it's the only layer that exercises the actual
  `init`-scaffolded artifacts a real user would get.
- **Determinism and quality.** The tool's core promise is that it can bootstrap a valid project
  (P5.1.1); that must be verified automatically every release, not left to whichever task happens to
  touch the CLI by hand (REQ-SYS-07 / REQ-STATE-09 — explicit declared checks over inferred diligence).
- **Trade-off considered.** A new release gate carries its own maintenance cost (fixtures, a throwaway
  init target, cross-platform subprocess spawning) against the cost of shipping a tool whose `init`
  can't produce a schema-valid project. v0.1 already demonstrated the risk is real and not
  hypothetical, so the gate was chosen over leaving this to manual diligence; the staged warn→reject
  rollout bounds the near-term cost.

## Actions

- [ ] Ratify this decision (owner: approver), as part of the `retro-v0.1` bootstrap DL batch.
- [ ] On `ready`, as config task(s): (1) author `e2e-smoke.yaml` (`kind: sub`, `element: release`,
  `produces:` a smoke-test report); (2) wire it into `release-cycle.yaml` before `release-submit`;
  (3) start it in `warn` mode; flip to hard-reject once a release runs it clean (coordinate the
  warn→reject staging record with `dl-013`, per `retro-v0.1`'s B-DECISION action).
- [ ] Note explicitly in the gate's own docs that it complements, and does not replace or close,
  `bug-004`, `bug-005`, `bug-006`, or `bug-007` — each keeps its own lifecycle.
- [ ] Cross-reference from `bug-006`'s Execution Notes once the gate exists, so re-opening `bug-006`'s
  fix can use the gate to verify it.

> **Implemented out-of-flow in the v0.1→v0.2 config-bootstrap** (branch `design/config_bootstrap_v0.2`; see `docs/05_plans/rl-v1/rel-v0.1/retrospective-and-config-bootstrap-plan.md`). `release: v0.2` — already delivered; no further task derivation by v0.2 `build-backlog`.
