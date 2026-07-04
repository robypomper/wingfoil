---
id: "task-007-npm-distribution"
type: task
title: "Infrastructure: REQ-SYS-09 — npm distribution"
status: pending
release: "v0.1"
priority: "Medium"
tags: ["v0.1", "architecture"]
ref: "REQ-SYS-09"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

REQ-SYS-09 requires WingFoil to ship as an installable **npm package** exposing the `wingfoil` CLI —
per the MVP success criterion "Published to npm with documentation" (`08_mvp-canvas.md`). This task
covers the packaging concerns that sit outside any single pillar module: a `package.json` with a `bin`
entry (`"wingfoil": "./dist/cli.js"` or equivalent) so `npm install -g wingfoil` places the command on
`PATH`, a build step that compiles the TypeScript sources under `src/` (per `dna.yaml` tech stack:
TypeScript / Node.js 18+) to a runnable `dist/`, and the published package's shipped documentation
(README + command reference) so `wingfoil --help` and the npm page are self-sufficient for a new user.

Because this is foundational, cross-cutting infrastructure — not the delivery of any single CLI
command's behavior — it is not tied to one feature story; the v0.1 backlog entry (`TASK-005`) notes its
`related_stories` are intentionally empty for exactly this reason.

## Acceptance Criteria

Per the SARD fit criterion (`docs/02_requirements/03_sard/01_architecture.md`, REQ-SYS-09):

> `npm install -g wingfoil` makes the `wingfoil` command available on PATH and `wingfoil --help` exits
> 0; the published package includes README + command docs.

Testable form:
- A global install (`npm install -g wingfoil`, or the local-tarball equivalent in CI) resolves the
  `wingfoil` binary on `PATH`.
- `wingfoil --help` exits with code `0` (per the CLI exit-code contract, `spec-005`) and prints usage.
- The published npm package artifact includes a `README.md` and command documentation (not just
  compiled JS).

## Implementation Notes

- No dedicated tech-spec owns npm packaging specifically among the 12 approved specs; this task should
  follow `spec-005-cli-command-contract` (exit-code contract that `wingfoil --help` must satisfy) and
  `dna.yaml`'s `stacks.technologies` (npm, TypeScript/Node 18+) as the binding constraints, and flag in
  Execution Notes if a dedicated packaging spec turns out to be needed during `dev-loop`'s design gate.
- `spec-011-storage-layout` is relevant background for what the published package must **not** ship
  (the dogfooding `docs/self/.wingfoil/` content is project-local config, not part of the npm artifact).
- Related feature work: none — per backlog `TASK-005` (`docs/03_backlog/04_backlog/by-release/v0.1.json`),
  `related_stories` is intentionally empty: "foundational/cross-cutting infrastructure (npm
  distribution) not tied to a single story."

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
