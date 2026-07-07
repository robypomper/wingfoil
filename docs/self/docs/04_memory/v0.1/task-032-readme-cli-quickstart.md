---
id: "task-032-readme-cli-quickstart"
type: task
title: "README.md and CLI quick-start docs"
status: in-progress
release: "v0.1"
priority: "High"
tags: ["v0.1", "documentation"]
ref: "spec-005-cli-command-contract"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

WingFoil has no `README.md` yet — the repository root today only carries specs and `docs/self/`
configuration. Once the v0.1 CLI surface actually exists (`task-020-implement-memory-add`,
`task-023-implement-keyword-search`, `task-025-implement-dna-set`, `task-026-implement-dna-show`,
`task-028-implement-paths-category`, `task-029-implement-wingfoil-init`), this task writes the
project's first `README.md`: what WingFoil is, how to install it, and a walkthrough of the basic CLI
commands (`wingfoil init`, `wingfoil dna show`/`set`, `wingfoil memory add`/`search`, `wingfoil
paths`). The quick-start must reflect the real, implemented command surface — invocation grammar,
global flags, exit codes, and output formats — as fixed by `spec-005-cli-command-contract` (exit-code
contract: `0`/`1`/`2`; `--format console|json|yaml`; `error: <reason>` on stderr) and
`spec-008-cli-grammar` (`wingfoil <noun> <verb> [args] [flags]` invocation form, global flags
`--format`/`--reason`/`--verbose`/`--color`/`--interactive`, element-ref syntax `<type>:<id>`), not an
idealized or aspirational one. This is also one of v0.1's explicit Success Criteria in
`docs/self/docs/04_memory/planning/v1/minor-v0.1.md` ("README + quickstart guide documented").

## Acceptance Criteria

- `README.md` exists at the repository root and covers: project identity/one-line pitch, installation
  (`npm install` / global CLI install), and a step-by-step quick-start that runs `wingfoil init` on a
  fresh project through to a working `wingfoil dna show` / `wingfoil memory add` / `wingfoil memory
  search` / `wingfoil paths` cycle.
- Every command shown in the quick-start matches its actual implemented flag surface and output —
  no documented flag/command that isn't real, no real flag/command left undocumented.
- Exit-code and `--format` behaviour shown in any example output is consistent with
  `spec-005-cli-command-contract` (three-code contract `0`/`1`/`2`; `console`/`json`/`yaml` formats).
- A new user with no prior WingFoil context can follow the README top-to-bottom and successfully run
  the CLI end-to-end (this is validated concretely by `task-033`'s manual Journey 0a walkthrough).
- README is committed at the repo root (not under `docs/self/`), since it targets external
  users/npm-package consumers, not WingFoil's own dogfooded config.

## Implementation Notes

- This is a **gating/closing task**: it can only be written once the CLI commands it documents exist
  and are stable (`task-020`, `task-023`, `task-025`, `task-026`, `task-028`, `task-029`), so it should
  run near the end of v0.1, after those tasks are implemented — writing it earlier risks documenting
  a command surface that changes before release.
- Keep the quick-start scoped to what v0.1 actually ships (`init`, `dna show/set`, `memory add/search`,
  `paths`) — do not document later-pillar commands (`directive`, `workflow`, `agent`) that don't exist
  until subsequent releases.
- Cross-check every example against `spec-008-cli-grammar`'s worked examples and global-flag table
  before committing, so the README can't silently drift from the CLI's actual contract.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
