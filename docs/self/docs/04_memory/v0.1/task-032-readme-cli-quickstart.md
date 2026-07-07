---
id: "task-032-readme-cli-quickstart"
type: task
title: "README.md and CLI quick-start docs"
status: approved
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

- **design:** verified scope against `spec-005-cli-command-contract` and `spec-008-cli-grammar` —
  both already `approved`, no gap, no new tech-spec needed. Task's own `ref:` already cites spec-005
  directly.
- **red/green (blocker found — bug-005):** built `dist/` and manually drove the real CLI
  (`node dist/cli.js ...`) inside a throwaway temp git repo, per the AC's "no fictional command"
  requirement. Discovered that `wingfoil init`'s generated `.wingfoil/dna.yaml`/`memory.yaml` fail
  their own consumers' schemas: `stacks.methodologies`/`team.roles` were written as bare string
  lists instead of the `{name}`-object arrays `DnaYaml` (`src/dna/schema.ts`) requires, `team.members`
  (required) was never written at all, and no `memory.yaml` type declared `id_pattern` (required by
  `memoryAddFn`). Net effect: on a freshly-initialized project, `dna show`, `dna set`'s read-back,
  `paths`, and `memory add` all errored (exit 1) — the exact quick-start cycle this task's AC
  requires. `dna set` cannot repair this (it only overwrites a single dotted key with a *string*
  leaf, never an array/object), so there was no workaround available to a README author.
  Filed **bug-005-init-scaffold-fails-schema-validation** (severity critical) for the record, then
  fixed it inline in this branch rather than deferring to a separate task: the fix is a narrow,
  mechanical correction to two pure string-template generator functions in
  `src/storage/templates.ts` (no schema/design change), and this task's own AC is not achievable at
  all without it. Added a guarding regression test first (red:
  `test/storage/templates.test.ts` — asserts `templateScaffold(...)`'s generated `dna.yaml`
  round-trips through the real `DnaYaml.safeParse` and every `memory.yaml` type declares
  `id_pattern`, for both templates), then the fix (green). Flagged explicitly here and in bug-005
  for the reviewer to confirm this scope call (fixing `src/storage` inside a task whose `ref` is
  spec-005/documentation) rather than splitting it into a separate fix task.
- **green (README):** rewrote `README.md`'s "CLI Commands"/"Getting Started" sections to the real
  v0.1 surface only (`init`, `dna show`/`set`, `memory add`/`search`, `paths`, `mcp` + the real
  global flags) — the previous (task-007) README documented several commands that don't exist in
  this release (`audit`, `dna infer`, `directive create/add/assign`, `memory import/history`,
  `workflow status/update/history`, `init --from-existing`). Added a step-by-step Quick Start with
  transcripts captured verbatim from the fixed CLI in a throwaway temp repo (not hand-typed), and an
  exit-code/`--format` section citing spec-005/008. Per this task's own Implementation Notes,
  deliberately did **not** document `directive`/`workflow` CLI verbs — even though `directives list`/
  `workflow list` already exist as registered commands in this build, `directives list` itself
  errors on a fresh project (its scaffolded `.md` frontmatter is missing `id`/`type`/`title` — the
  same class of scaffold/schema-mismatch defect as bug-005, in the directive template instead of the
  DNA/Memory ones) and neither is part of v0.1's committed feature scope — left unfixed and
  unfiled as a separate bug since it's out of this task's AC and doesn't block anything documented
  here; flagging it here only so the reviewer/next-task-owner is aware.
- **review:** full suite green (540/540, `npx jest`), `npx tsc -p tsconfig.build.json` exit 0.
  Re-ran the exact documented Quick Start sequence end-to-end against a freshly rebuilt `dist/` in a
  new throwaway temp repo (`init --template Scrum` → `dna show` → `dna show project` →
  `dna set project.name` → `dna show project` → `memory add --type task ...` →
  `memory search first` → `paths config` → `dna show project --format yaml`) — output matches the
  README's transcripts verbatim. Also re-verified the two exit-code-table examples
  (`dna show nonexistent_section` → exit 1, `memory add --type task` missing `--title` → exit 2)
  against the final build.
