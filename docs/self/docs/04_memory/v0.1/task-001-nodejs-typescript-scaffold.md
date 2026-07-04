---
id: "task-001-nodejs-typescript-scaffold"
type: task
title: "Node.js/TypeScript project scaffold"
status: pending
release: "v0.1"
priority: "Blocker"
tags: ["v0.1"]
ref: "adr-005-typescript-node-stack"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

Initializes the actual Node.js/TypeScript project that every other v0.1 task will build against —
today the repo is spec-only with no `src/` tree. Per `adr-005-typescript-node-stack` and
`docs/self/.wingfoil/dna.yaml`'s `tech_stack.technologies`, this task creates `package.json` (npm as
package manager), `tsconfig.json` targeting Node.js 18+, and the `src/{core,storage,memory,dna,
directives,workflow,cli,mcp-server}` module layout from `dna.yaml`'s `modules:` section. It adds
Commander.js + chalk (CLI surface), the Model Context Protocol SDK + Anthropic SDK (MCP server), and
Zod (validation) as dependencies, plus Jest + ts-jest as the test runner with a coverage threshold,
and wires `npm run build`/`npm run lint`/`npm test` scripts. Without this scaffold no TDD/Jest work
on any other v0.1 task (including `task-002`) has anywhere to live.

## Acceptance Criteria

- On a clean checkout, `npm install && npm run build && npm test` all succeed (empty/placeholder
  test suite is acceptable at this stage).
- `tsconfig.json` compiles under Node.js 18+ with strict mode enabled.
- `package.json` declares Commander.js, chalk, the MCP SDK, Anthropic SDK, and Zod as dependencies,
  and Jest + ts-jest as dev dependencies, matching `dna.yaml`'s `tech_stack.technologies` list.
- Jest is configured with a coverage threshold of >80%, per `dna.yaml`'s Jest `notes: coverage
  target >80%` and the `testing` directive (`docs/self/.wingfoil/directives/custom/`).
- The `src/` module directories match `dna.yaml`'s `modules:` list (`core, storage, memory, dna,
  directives, workflow, cli, mcp-server`), even if most start as empty stubs.
- `npm run lint` runs cleanly against the empty scaffold (no lint errors on generated boilerplate).

## Implementation Notes

- Scope is limited to the local dev scaffold — CI pipeline and npm-registry publish config are out
  of scope here and belong to a later packaging/release-automation task (tracked against
  `REQ-SYS-09`), not this one.
- Follow `adr-005-typescript-node-stack`'s Decision section literally: TypeScript, Node.js 18+, npm,
  semantic versioning — do not substitute an alternate runtime or package manager.
- Keep the module boundaries in `src/` aligned with `dna.yaml`'s `modules:` list from the start, so
  later tasks (e.g. `task-002`'s `src/validation`) drop into an already-coherent layout rather than
  forcing a restructure.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
