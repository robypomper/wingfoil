---
id: "task-123-template-paths-are-relative-to-the-config-root"
type: task
title: "Every `template.file` in this repository's `memory.yaml` is relative to the configuration root, so `memory add` works on its own Memory"
status: pending
release: "v0.2.2"
priority: "high"
tags: ["v0.2.2", "memory", "config", "dogfooding"]
ref: "bug-156-repository-memory-yaml-template-paths-carry-the-config-root"
bug: ["bug-156-repository-memory-yaml-template-paths-carry-the-config-root"]
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here can never leave `triaged`. A single string is still accepted for documents predating dl-045.
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-111-configuration-moves-to-the-repository-root"]
tmpl_version: 260703   # Orignal template version
---

## Description

`spec-001` declares `template.file` as a scaffold path relative to the configuration root, and the
CLI resolves it that way (`src/core/memory-add-type.ts`, `templatePath = WINGFOIL_DIR + "/" +
template.file`). The `memory.yaml` that `init` scaffolds follows the rule. This repository's
hand-authored `memory.yaml` does not: its 8 `template.file` entries start with `.wingfoil/`, so
`memory add` looks for `.wingfoil/.wingfoil/memory/templates/<type>.md` and fails for every type
(`bug-156`, reproduced on `1087c166`).

**Why in v0.2.2, right after `task-111`.** `task-111` moves the configuration to the root so the
Memory verbs run on this repository. `history` and `search` then work, but `memory add` still fails
on every type until this is fixed, and the patch's first Success Criterion is that WingFoil's own
Memory is operated through its own verbs. The approver scheduled it on 2026-09-29. This closes
`bug-156`.

## Acceptance Criteria

1. Every `template.file` in the root `.wingfoil/memory.yaml` is a path relative to the configuration
   root (`memory/templates/<type>.md`), and the file's `version` is bumped (`doc-versioning`). The
   change touches only those values and the version line. *Configuration.*
2. A test loads the repository's real, committed configuration and asserts that, for every type, the
   scaffold `memory add` resolves exists at `HEAD`. *Red-first:* it fails on the prefixed values.
3. A test pins that the `memory.yaml` scaffolded by `init` resolves every scaffold the same way.
   *Characterization.*
4. On this repository, with the build under development, `memory add` creates an element of every
   type whose `id_pattern` needs no field token, and of `release`, `release-line` and `plan` with the
   `--set` values their patterns need (`task-110`). The run is done in a throwaway clone or worktree,
   so no element is added to the real Memory, and the commands and ids are recorded in Execution
   Notes.
5. `npm test` green; coverage not regressing.

## Implementation Notes

- Out of scope: a validation rule that refuses a `template.file` starting with the config root's own
  name. If the review thinks one is needed, it is filed as its own element.
- `task-114` and the out-of-flow `dl-088` change also edit `memory.yaml` and its `version`. They run
  after this task, in that order, so the version bumps do not collide.

## Execution Notes

<!-- Running log of what actually happened during this task's dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
