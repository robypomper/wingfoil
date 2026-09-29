---
id: "task-123-template-paths-are-relative-to-the-config-root"
type: task
title: "Every `template.file` in this repository's `memory.yaml` is relative to the configuration root, so `memory add` works on its own Memory"
status: in-progress
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

Branch `task/task-123-template-paths-are-relative-to-the-config-root`, worktree `../.wf2-wt/task-123`,
cut from `main` at `c3df9df3`. Start: `13fcc292` (task `[backlog → in-progress]`), `901b3fb5`
(`bug-156` `[planned → in-progress]`).

### design (architect)

**`depends_on` read (dl-015).** `task-111` is `done` (`grep -m1 '^status:'
docs/04_memory/v0.2.2/task-111-configuration-moves-to-the-repository-root.md` → `status: done`).
What this task takes from its Execution Notes:
- The configuration is now `.wingfoil/` at the repository root and Memory is `docs/04_memory/`, so
  the CLI run from the root reads this repository's own configuration; `task-111` measured that
  `memory add --type bug` still fails there on `.wingfoil/.wingfoil/memory/templates/bug.md`
  (its design section and the approver's ruling, item 4). This task is that failure.
- `task-111` left the eight `file:` values unchanged on purpose and bumped no config `version:` for
  path-only comment edits (ruling item 7). This task changes *values*, not comments, and AC 1 asks
  for the bump, so `memory.yaml` goes `1.3 → 1.4` (`doc-versioning`: the last bump, `1.2 → 1.3`,
  was committed in `92908e8c`; `git log -p --follow -- .wingfoil/memory.yaml | grep '^[-+]version'`).
- Standing note 6: `test/cli/own-memory.integration.test.ts` reads this repository's real history.
  The AC 2 test below also reads this repository's real, committed configuration — but at `HEAD`
  only, never its history, so a history rewrite cannot break it.

Also read, for AC 4: `task-110`'s Execution Notes (`done`). Its AC 6 run hit this bug and stripped
the prefix in a scratch copy; the `--set` values it used are the ones reused here —
`release`: `--set kind=… --set version=… --set release-line=…`; `release-line`: `--set version=…`;
`plan`: `--set workflow=… --set phase=… --set scope=…`. `{date}`/`{author}` are unimplemented; no
type of this repository uses them (`grep -n id_pattern .wingfoil/memory.yaml`).

**Specs.** `spec-001-memory-yaml-schema` is `approved` (`grep -m1 '^status:'` → `status: approved`);
its `TemplateConfig` declares `file: z.string(), // scaffold path, relative to config root`. The code
follows it: `resolveAddType` (`src/core/memory-add-type.ts` at `c3df9df3`) builds
``templatePath = `${WINGFOIL_DIR}/${template.file}` ``, and `init`'s scaffold writes
`file: memory/templates/${type}.md` (`src/storage/templates.ts`, `memoryYaml`). No spec is missing
or needs revision; the defect is configuration only
(`grep -c 'file: ".wingfoil/memory/templates/' .wingfoil/memory.yaml` → `8`; the eight scaffolds
exist and are tracked: `git ls-files .wingfoil/memory/templates | wc -l` → `8`).

**AC classification (T1).**

| AC | Class | Why |
|---|---|---|
| 1 — the 8 `template.file` values relative, `version` bumped | configuration | the green change; no behaviour of its own, proven by AC 2 |
| 2 — the committed config resolves every scaffold at `HEAD` | **red-first** | `resolveAddType` on this repository fails today for every type (bug-156 reproduction) |
| 3 — the `init` scaffold resolves every scaffold the same way | characterization | `init` already writes `memory/templates/<type>.md`; the test passes on first run |
| 4 — `memory add` of every type on a throwaway clone | characterization (manual e2e) | end-to-end run of the built CLI, recorded below |
| 5 — `npm test` green, coverage not regressing | verification | gates below |

**Baseline** (this worktree at `901b3fb5`, before any change):
`npx jest --coverage --coverageReporters=text-summary --coverageReporters=json-summary` →
152 suites / 2472 tests passed; stmts 98.66 (3392/3438), branches 94.25 (1789/1898),
funcs 98.98 (584/590), lines 99.46 (3000/3016).
