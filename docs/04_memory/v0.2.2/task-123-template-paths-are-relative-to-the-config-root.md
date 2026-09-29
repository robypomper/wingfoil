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
  was committed in `33d89b7c`: `git log --format=%h -G'^version: 1\.3' --follow -- .wingfoil/memory.yaml`).
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

### red (developer) — `28c30eb8`

`test/core/memory-add-scaffold-paths.test.ts`. For every type the committed `memory.yaml`
registers (read with `loadMemoryYamlAtHead`, not pinned, so a later type such as `dl-088`'s is
covered without editing the test), it calls `resolveAddType` — the resolver `memory add` itself
uses, reading `memory.yaml` and the scaffold at `HEAD` — and expects
`.wingfoil/memory/templates/<type>.md` for each.
- AC 2 runs it on this repository's root (`join(__dirname, '..', '..')`).
- AC 3 runs it on a temp repository after `initWingfoilProject(repo, name)`, for every name in
  `TEMPLATE_NAMES` (Scrum, Kanban).

`npx jest test/core/memory-add-scaffold-paths.test.ts` → **1 failed, 2 passed**. The failure is AC 2,
all eight types `REFUSED: cannot read the scaffold for memory type '<type>':
'.wingfoil/.wingfoil/memory/templates/<type>.md' is not committed at HEAD. …`. The two AC 3 rows
pass on first run, as classified (characterization). `npx eslint` on the file → exit 0.

### green (developer) — `0bd69282`

`.wingfoil/memory.yaml`: the eight `template.file` values lose the `.wingfoil/` prefix, and
`version: 1.3 → 1.4`; nothing else (`git diff 28c30eb8 0bd69282 --stat` → `1 file changed,
9 insertions(+), 9 deletions(-)`; the nine `-`/`+` pairs are the eight `file:` lines and the
`version` line, annotations kept). The test resolves at `HEAD`, so it was re-run after the commit:
`npx jest test/core/memory-add-scaffold-paths.test.ts` → **3 passed**. No other consumer of the old
values: `git grep -n '"\.wingfoil/memory/templates/' -- . ':!docs/04_memory' ':!docs/05_plans'` at
`0bd69282` → one line, `.wingfoil/workflows/custom/wingfoil-init.yaml:26`, a `produces:` entry
naming the scaffold directory root-relative (`".wingfoil/memory/templates/"`) — a path from the
repository root, not a `template.file`, and correct as it is (the same command at `28c30eb8` on
`.wingfoil/memory.yaml` → the 8 old values).

### AC 4 — `memory add` of every type on a throwaway clone

`git clone --branch task/task-123-… <worktree> $(mktemp -d <session scratchpad>/ac4-XXXX)/wf` at
`0bd69282`; `wingfoil` = `node <worktree>/dist/cli.js`, built by jest's `globalSetup` from this
branch's `src/` (unchanged since `ba66b7c9`). Clone deleted afterwards; nothing was added to the
real Memory (`git status --porcelain` in the worktree afterwards → only this task file, modified by
these notes).

| command | output | commit |
|---|---|---|
| `memory add --type adr --title "AC4 probe adr" --format json` | `{"id":"adr-012-ac4-probe-adr",…}` exit 0 | `wf(adr): add adr-012-ac4-probe-adr`, 1 file |
| `memory add --type bug --title "AC4 probe bug" --format json` | `{"id":"bug-160-ac4-probe-bug",…}` exit 0 | `wf(bug): add bug-160-ac4-probe-bug`, 1 file |
| `memory add --type decision-log --title "AC4 probe decision log" --format json` | `{"id":"dl-130-ac4-probe-decision-log",…}` exit 0 | `wf(decision-log): add …`, 1 file |
| `memory add --type tech-spec --title "AC4 probe tech spec" --format json` | `{"id":"spec-016-ac4-probe-tech-spec",…}` exit 0 | `wf(tech-spec): add …`, 1 file |
| `memory add --type task --title "AC4 probe task" --format json` | `E_MISSING_PATH_VALUE: path pattern "docs/04_memory/{release}/{id}.md" is missing value(s) for: release` exit 1 | none |
| `memory add --type task --title "AC4 probe task" --set release=v0.2.3 --format json` | `{"id":"task-001-ac4-probe-task","path":"docs/04_memory/v0.2.3/task-001-ac4-probe-task.md"}` exit 0 | `wf(task): add task-001-ac4-probe-task`, 1 file |
| `memory add --type release --title "WingFoil v0.2.3" --set kind=patch --set version=v0.2.3 --set release-line=rl-v1 --format json` | `{"id":"patch-v0.2.3","path":"docs/04_memory/planning/rl-v1/patch-v0.2.3.md"}` exit 0 | `wf(release): add patch-v0.2.3`, 1 file |
| `memory add --type release-line --title "WingFoil v2" --set version=v2 --format json` | `{"id":"rl-v2","path":"docs/04_memory/planning/rl-v2.md"}` exit 0 | `wf(release-line): add rl-v2`, 1 file |
| `memory add --type plan --title "Dev-loop — rel-v0.2.3" --set workflow=dev-loop --set phase=rel-v0.2.3 --set scope=rl-v1/rel-v0.2.3 --format json` | `{"id":"dev-loop-rel-v0.2.3-plan","path":"docs/05_plans/rl-v1/rel-v0.2.3/dev-loop-rel-v0.2.3-plan.md"}` exit 0 | `wf(plan): add …`, 1 file |

All eight types are created. `task`'s `id_pattern` needs no field token, but its `path` needs
`{release}`, so it takes `--set release=…` too (the first `task` row). Control, a second clone at
`28c30eb8` (the red commit, before the fix): `memory add --type bug --title "AC4 probe bug"` →
`cannot read the scaffold for memory type 'bug': '.wingfoil/.wingfoil/memory/templates/bug.md' is not
committed at HEAD. …` exit 1.

**Findings from the run — not this task's scope, reported for the approver:**
1. **Duplicate numbers.** `dl-130-ac4-probe-decision-log` reuses `130`, already taken by
   `dl-130-visibility-steps-in-the-release-flow` (`ls docs/04_memory/design/dls | sort -V | tail`):
   `nextSequenceNumber` returns *count + 1*, and the sequence has a gap (`dl-020 → dl-022`). That is
   `bug-087` (`open`, `release: v0.3`) reproduced on this repository. And `task-001-ac4-probe-task`:
   the counter is confined to the type's resolved directory, which for `task` is the per-release
   `docs/04_memory/{release}/`, so every new release restarts at `task-001`, while this repository
   numbers tasks across releases (`task-123`; `docs/04_memory/v0.1/task-001-nodejs-typescript-scaffold.md`
   exists). `dl-101` (`ready`, `v0.3`) proposes "the highest number plus one" but, as written, still
   "restricted to the type's directory" — so it would not fix the task case either. No element
   names the per-release restart (`grep -rlniE "restarts at 1|counter restarts|task-001-"
   docs/04_memory/bugs docs/04_memory/design` → no bug or DL about it).
2. **`release-line` path token vs field.** The six committed releases live under
   `planning/rl-v1/` but carry `release-line: "v1"` (`grep -H '^release-line:'
   docs/04_memory/planning/rl-v1/*.md`). `--set release-line=v1` writes the field they carry and
   files the element under a new `planning/v1/` (`{"id":"patch-v0.2.4","path":"docs/04_memory/planning/v1/patch-v0.2.4.md"}`,
   same clone); `--set release-line=rl-v1` files it in the right folder with a field value no other
   release has. No element covers it (`grep -rlnE 'planning/v1/|release-line: "v1"'
   docs/04_memory/bugs docs/04_memory/design` → only `bug-080`, about the old rename).

### refactor (developer)

No refactor: the change is eight values and a version line. Gates, in this worktree at `0bd69282`:

| Check | Command | Result |
|---|---|---|
| unit + BDD | `npx jest --coverage --coverageReporters=text-summary --coverageReporters=json-summary` | 153 suites / 2476 tests passed (baseline 152 / 2472) |
| coverage before → after | same | stmts 98.66 (3392/3438) → 98.66 (3392/3438); branches 94.25 (1789/1898) → 94.25; funcs 98.98 (584/590) → 98.98; lines 99.46 (3000/3016) → 99.46 — no `src/` change |
| `lint.clean` | `npm run lint` | exit 0 |
| `docs.api.*` | `npm run docs:api` | exit 0 |
| types | `npx tsc --noEmit` | exit 0 |

+4 tests: the three new ones, and one more `it.each` row in `test/core/latency-budget-placement.test.ts`,
which scans every test file (`npx jest test/core/latency-budget-placement.test.ts` → 157 tests;
156 at `task-111`'s head per its notes).

### review (reviewer)

- **Acceptance (P1.3 `memory add`, P1.13 scaffolds):**
  `npx jest $(ls test/core/memory-add*.test.ts test/cli/memory-add*.test.ts test/memory/add.test.ts test/storage/templates.test.ts | sort)`
  → 11 suites, 128 tests passed.
- **`main` moved during the task** (`git log --oneline 748593a5..main` → 17 commits, to `7ac792de`:
  `task-121` merged, `bug-160` added and submitted, `patch-v0.2.2` notes, a plan update — none touches
  `.wingfoil/` or `test/`: `git diff --stat 748593a5...main`). Merged with `git merge --no-ff main`
  (`a2d33554`, no rebase, no conflict). Re-run after the merge: `npx jest` → 153 suites / 2476 tests
  passed. (The `bug-160` id the AC 4 probe produced in the throwaway clone is now taken on `main` by
  `bug-160-vision-index-document-map-and-line-ranges-are-stale`; the probe was never committed here.)
- **For the approver.**
  1. The green commit's subject is `fix(config): …` rather than the plan's `feat({module})`: the
     change is configuration, and `config` is the scope `task-111` used for the same file.
  2. AC 4 finding 1 (task numbering restarts per release; `dl-101`'s rule would keep it) and
     finding 2 (`release-line` field vs `planning/rl-v1/` folder) have no element. Filing them is
     the approver's call; nothing here was changed for them.
  3. AC 2's test depends on this repository's committed `.wingfoil/`, as `task-111`'s
     `own-memory.integration.test.ts` does on its history. It reads `HEAD` only, so it follows
     whatever `memory.yaml` is committed — `task-114` and `dl-088`'s edits included.
