---
id: "task-050-directive-create"
type: task
title: "Implement `wingfoil directive create`"
status: done
release: "v0.2"
priority: "Critical"
tags: ["v0.2", "p3"]
ref: "P3.1"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

As Morgan, deliver feature **P3.1** (US-4-02): create a new custom directive under `.wingfoil/directives/custom/`, committed to git.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p3-directives/P3.1-directive-create.feature`.

Key scenario: `wingfoil directive create --name no-direct-db-access` → file under `custom/`; committed; exit 0.

## Implementation Notes

First Directives-pillar CLI verb. Directive frontmatter per `spec-013`.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### `design` — role: architect

#### T1 — acceptance-criteria classification (`agent.classify_acs`)

AC source: `docs/02_requirements/02_bdd/features/p3-directives/P3.1-directive-create.feature`
(3 scenarios). Ground truth checked before classifying: `grep -rn "directiveCreate" src/` matches only
two **doc comments** (`src/core/index.ts` lines 12 and 645, both naming it as *not yet implemented*) —
no declaration, no call site. `CORE_MODULES` (`src/core/index.ts`) declares exactly eight operations
(`test/core/production-registry.test.ts` asserts the list verbatim), of which the only Directives-pillar
one is `directives.directivesList` (`mutates: false`, a wrapped `loadDirectives`). Baseline before any
change: `npx jest --maxWorkers=2` → **74 suites / 966 tests, all passing**.

| AC | BDD scenario | Classification | Basis |
|----|--------------|----------------|-------|
| AC1 | "Create a new custom directive" — a file named after `--name` under `.wingfoil/directives/custom/`, committed to git, exit `0` | **red-first** | No create path exists: nothing in `src/` writes under `directives/custom/` outside `wingfoil init`'s one-shot scaffold (`src/storage/templates.ts`). |
| AC2 | "Error — creating a directive whose name already exists" — no file overwritten, exit `1`, message `directive already exists: no-direct-db-access` | **red-first** | No conflict check and no such message string exist anywhere. |
| AC3 | "Error — invalid directive name" — no file created, exit `2`, message `invalid directive name (use kebab-case)` | **red-first** | No name validator and no such message string exist anywhere. |

**No characterization ACs** — all three are new behaviour, so `red` must produce a genuinely failing
test for each (no exemptions claimed).

#### `agent.read_related` (dl-015, hard gate)

`depends_on: []` (this file's frontmatter; plan §4 lists task-050 in **Wave 1 — no `depends_on`**).
The gate is a **no-op**: there are no upstream Execution Notes to load or acknowledge.

#### `agent.verify_specs`

Task scope checked against the approved `tech-spec` set. **No gap found → no `memory.add(type:
tech-spec)`, so `design` is a pass-through** (plan §3.2: the approval gate fires *only* when a new
spec was scaffolded). Every contract this task needs is already pinned by an `approved`/authoritative
artefact:

| Question this task must answer | Authority (status) |
|---|---|
| Core function name, `mutates`, CLI command, MCP Tool name | `spec-006-core-domain-api` §3 `directives` table (`approved`): `directiveCreate`, `mutates: true`, CLI `wingfoil directive create`, Tool `directive.create` |
| Exit codes `0`/`1`/`2` and the `error: <reason>` rendering | `spec-008-cli-grammar` §5/§6 (`approved`) + `src/core/exit-code.ts` (REQ-INT-04) |
| Where the file goes; `custom/` vs `built-in/` | `spec-011-storage-layout` (`approved`) "directives/{built-in,custom}/ split"; `docs/01_vision/X_cli-cmds.md` (v1.2): "Creates `.wingfoil/directives/custom/[name].md`. Unique within custom directives." |
| The frontmatter the generated file must carry | `spec-013-directive-frontmatter-schema` (`approved`) — `id`/`name`/`type`/`kind`/`title` required, `tags`/`ref` optional, `.passthrough()` |
| Git-identity pre-flight on a mutation | REQ-SEC-01 / `adr-006` via `requireGitIdentity` (`src/core/git-identity.ts`, task-014) |
| Determinism of generated content | REQ-SYS-07 — pure function of `--name`, no clock/randomness |

#### Design decisions taken (and why), recorded before `red`

**D1 — the CLI noun is `directive` (singular), so this registers as a NEW `CoreModule` named
`directive`, not as an entry in the existing `directives` module's operations map.**

`CliCommand.noun` is `CoreModule.name` verbatim (`buildCliCommands`, `src/cli/registrar.ts`) and the
MCP Tool name is `` `${module.name}.${verb}` `` (`deriveMcpToolName`, `src/mcp/registrar.ts`). So the
module name *is* the wire-visible noun; it is not a `src/` directory name (`paths` is already a
`CoreModule` with no `src/paths` behind it, and `CoreOperation`'s own doc calls `CoreModule.name`
"the `wingfoil <noun>` segment"). Three approved/authoritative sources agree the P3 pillar exposes
**two** nouns:

- BDD `P3.1`/`P3.2`/`P3.3` invoke `wingfoil directive create|assign|remove`; BDD `P3.4` invokes
  `wingfoil directives list`.
- `spec-006` §3's `directives` table pins CLI `wingfoil directive create` + Tool `directive.create`
  on the same row as CLI `wingfoil directives list` + Resource `wingfoil://directives/list`.
- `spec-008-cli-grammar` §1 enumerates the nouns as "`memory`, `dna`, `directive`, `workflow`,
  `agent`" — singular `directive`.
- `X_cli-cmds.md` (v1.2) §Pillar 3 lists `directive create` / `directive assign` /
  `directive remove` / `directives list`.

Putting `directiveCreate` in the `directives` module would derive
`deriveVerb('directives', 'directiveCreate')` → `'directive-create'` (the name does not start with
`'directives'`, so the function falls back to kebab-casing the whole name), i.e.
`wingfoil directives directive-create` and Tool `directives.directive-create` — contradicting all four
sources above. Renaming the operation to `directivesCreate` would give `wingfoil directives create`,
which still contradicts the BDD. A second `CoreModule` is therefore the only reading that satisfies
the approved contracts **without touching `deriveVerb` or either registrar** — parity stays
structural (spec-006 §4).

Side benefit for the concurrent task-053 (`directives list`): the new module is **appended at the end
of the `CORE_MODULES` array**, so the `directives` block that task-053 edits is not touched at all by
this task. `enumerateOperations` sorts by `(module.name, operation.name)`, so array position carries
no behavioural meaning.

**D2 — the mutating-op template is copied from `dnaSetFn`/`memoryAddFn`, in their order.**
`requireGitIdentity(root)` first (REQ-SEC-01: refuse before any read/write), then argument validation
via `throw new UsageError(...)` → exit `2` (`exitCodeForThrow`), then the domain check → returned
`coreErr` → exit `1` (`exitCodeForError`; every `CoreError.code` maps to `1`), then
`writeDocument` + `commitPaths` on the one scoped path. Identity-before-arguments is deliberate: it is
what both existing mutating ops do, and the BDD Background ("Given an initialized WingFoil project")
never exercises an unset identity, so no scenario distinguishes the two orders.

**D3 — error codes/messages, character-exact from the feature file.**
- AC3 → `throw new UsageError('invalid directive name (use kebab-case)')` → exit `2`.
- AC2 → `coreErr({ code: 'CONFLICT', message: 'directive already exists: ' + name })` → exit `1`.
  `CONFLICT` (not `VALIDATION`) because the input is well-formed and the failure is that the target
  already exists — spec-006 §2's code list.
- A missing `--name` is not in the BDD; it is classified as a usage error with the
  `missing required argument: --name` wording spec-008 §4 fixes and `memoryAddFn` already uses.

**D4 — kebab-case is `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`.** Lower-case alphanumeric segments joined by
single hyphens; no leading/trailing/double hyphen, no upper case, no spaces, no dot. This rejects
`'bad name!'` (AC3) and, as a security consequence, every path-traversal or absolute-path spelling
(`../x`, `a/b`, `/etc/passwd`) before any path is built — so the write target cannot escape
`.wingfoil/directives/custom/` by construction (security-secrets / REQ-SEC-06 spirit).

**D5 — generated frontmatter mirrors `wingfoil init`'s own generator (`directiveMd`,
`src/storage/templates.ts`), which task-064 just fixed for `bug-006`.** Emitted fields: `id: <name>`
(spec-013: "matches the filename stem"), `name: <name>`, `type: directive`, `kind: custom` (the file
lands under `custom/`), `title: "<Humanized name>"`. `tags`/`ref` are omitted — both are `.optional()`
in `DirectiveFrontmatter`, and a user-authored rule has no P3.8 `ref` to claim. The title humanizer is
`hyphens → spaces, capitalize the first letter` — a pure function of `--name`
(`no-direct-db-access` → `No direct db access`), matching the `code-quality` → `Code quality` shape
the init generator already uses. No clock, no randomness, no environment read (REQ-SYS-07).

**D6 — scope held to `--name`.** `X_cli-cmds.md` also sketches `--file-format md/yaml` and
`--template TEMPLATE` for this command; neither appears in the P3.1 feature file, and `--file-format
yaml` would additionally break `loadDirectives`, which only reads `.md`. Both are left to a later
task (see "Deviations / out of scope").

**D7 — commit subject `wf(directive): create <name>`**, one commit, staging only
`.wingfoil/directives/custom/<name>.md` — the same shape `dnaSetFn` uses for `wf(dna): set <key>`
(CLAUDE.md §5.1's one-operation-one-scoped-commit convention, applied to a config-pillar mutation).

### `red` — role: developer (commit `962183e`)

Two new suites plus the three registry-enumeration suites the new operation necessarily widens:

- `test/directives/create.test.ts` — the pure pillar helpers (kebab-case rule incl. every rejection
  shape, title humanization, the generated document byte-for-byte, and its frontmatter validated
  against the **real** `DirectiveFrontmatter` schema rather than a hand-copied field list).
- `test/core/directive-create.test.ts` — the registered operation: AC1/AC2/AC3 against a throwaway
  temp git repo carrying the **real `wingfoil init` scaffold** (`initWingfoilProject(repo, 'Scrum')`),
  plus registration/parity, missing `--name`, the REQ-SEC-01 identity pre-flight, and a determinism
  case (same name in two independent repos → byte-identical file).
- `test/cli/program.integration.test.ts` — a `directive create` block driven through the **real
  compiled CLI**, out of process, asserting exit codes and stderr strings character-exact.
- `test/core/production-registry.test.ts`, `test/core/parity.test.ts`,
  `test/mcp/read-only-agent-channel.test.ts` — the three suites that assert the operation list
  verbatim; each widened to include `directive.directiveCreate` / `directive create` /
  `directive.create`.

**Red evidence (verbatim, before any implementation existed):**

```
FAIL test/directives/create.test.ts
  ● Test suite failed to run
    Cannot find module '../../src/directives/create' from 'test/directives/create.test.ts'

FAIL test/core/directive-create.test.ts
  ● … › is registered on a `directive` module as a `mutates: true` operation
    expect(received).toBeDefined()
    Received: undefined
  ● … › AC1: creates the file under .wingfoil/directives/custom/, commits it, returns ok + sha (exit 0)
    fixture bug: "directiveCreate" operation not registered on the directive module

FAIL test/cli/program.integration.test.ts
  ● … › an invalid name exits 2 with the exact BDD message and creates no file
    Expected: 2
    Received: 1        (commander's "unknown command 'directive'")

Test Suites: 6 failed, 6 total
Tests:       23 failed, 51 passed, 74 total
```

### `green` — role: developer (commit `6c3520c`)

- **New:** `src/directives/create.ts` — `INVALID_DIRECTIVE_NAME_MESSAGE`, `isValidDirectiveName`,
  `directiveTitleFromName`, `renderCustomDirective`. Zero imports: pure, no filesystem, no git, no
  clock (REQ-SYS-07), and no dependency on `src/core` (spec-006 §1 keeps the pillar a leaf).
- **`src/directives/index.ts`** — re-exports the four, matching how `src/dna/index.ts` re-exports
  `./set`.
- **`src/core/index.ts`** — `DirectiveCreateParams` + `directiveCreateFn` (identity pre-flight →
  usage validation → `CONFLICT` check → write + one scoped commit), and a **new `directive`
  `CoreModule` appended at the END of `CORE_MODULES`**. The existing `directives` module block is
  **not touched at all** (`git diff main...HEAD -- src/core/index.ts` has no hunk inside it) — the
  concurrency constraint for task-053. Three other hunks: one import line, one new function, one
  stale-doc-comment correction above the array.

`npx tsc -p tsconfig.build.json` → exit 0; the six suites → **106 passed / 106**.

### `refactor` — role: developer (commit `6638805`)

- `directiveCreateFn` now spells the target location **once** (`relativePath`), deriving the absolute
  path via `join(root, relativePath)` — so the existence check, the write and the commit scope cannot
  drift apart.
- Brought three stale doc comments in step with behaviour (documentation directive): the
  `CORE_MODULES` header still called `memoryAdd`/`directiveCreate` "still task-020..030's scope";
  `src/directives/index.ts`'s module doc still said only the schema lived there; and
  `read-only-agent-channel.test.ts`'s describe title still named two mutating Tools.

**Observed gate results (all four run at the refactor commit):**

| Check | Command | Result |
|---|---|---|
| `tests.passing` | `npx jest --maxWorkers=2` | **76 suites / 1019 tests, all passing** (baseline on `main` before this task: 74 / 966) |
| `tests.coverage(min: 80)` | `npx jest --coverage --maxWorkers=2` | global **98.12 stmts / 89.65 branch / 98.34 funcs / 98.85 lines** — threshold met |
| `docs.api.*` | `npm run docs:api` | exit **0** |
| (build) | `npx tsc -p tsconfig.build.json` | exit **0** |
| `lint.clean` | `npx eslint .` | exit **0** |

Coverage of the touched source: `src/directives/create.ts` = **100 / 100 / 100 / 100**.
`src/core/index.ts` is **not measured** — `jest.config.js`'s `collectCoverageFrom` excludes
`!src/**/index.ts` — so `directiveCreateFn`'s coverage is not reported as a number; its behaviour is
exercised through the registered `CoreFn` by `test/core/directive-create.test.ts` (12 cases) and
through the compiled binary by `test/cli/program.integration.test.ts` (4 cases). That exclusion
predates this task and was not changed here.

### `review` — role: developer side (BDD run + submit)

**P3.1 scenario-by-scenario, with the test that proves each and the message strings as observed:**

| BDD scenario | Proven by | Observed |
|---|---|---|
| "Create a new custom directive" — file under `custom/`, committed, exit 0 | `test/core/directive-create.test.ts` "AC1: creates the file …" + `test/cli/program.integration.test.ts` "creates the file … and exits 0" | file at `.wingfoil/directives/custom/no-direct-db-access.md`; `git show --name-only HEAD` = that one path; subject `wf(directive): create no-direct-db-access`; exit `0` |
| "Error - creating a directive whose name already exists" — no overwrite, exit 1, `directive already exists: no-direct-db-access` | `test/core/directive-create.test.ts` "AC2: a second create …" + the CLI block's duplicate case | stderr exactly `error: directive already exists: no-direct-db-access`, exit `1`; file bytes and `HEAD` both unchanged |
| "Error - invalid directive name" — no file created, exit 2, `invalid directive name (use kebab-case)` | `test/core/directive-create.test.ts` "AC3: `--name 'bad name!'` …" + the CLI block's invalid-name case | stderr exactly `error: invalid directive name (use kebab-case)`, exit `2`; `custom/` listing unchanged |

Message strings are **character-exact** against the feature file: asserted with `toBe` on the whole
stderr line (`error: <reason>\n`, spec-008 §6) in the CLI suite and with `toEqual` on the whole
`CoreError` object in the core suite — not `toContain`.

**End-to-end on the real compiled CLI**, in a scratch git repo outside the worktree
(`node dist/cli.js`, after `npx tsc -p tsconfig.build.json`):

```
$ node …/dist/cli.js init --template Scrum          → exit 0 (28 files, incl. 10 custom directives)
$ node …/dist/cli.js directive create --name no-direct-db-access
{ "name": "no-direct-db-access", "path": ".wingfoil/directives/custom/no-direct-db-access.md" }
exit=0

$ cat .wingfoil/directives/custom/no-direct-db-access.md
---
id: no-direct-db-access
name: no-direct-db-access
type: directive
kind: custom
title: "No direct db access"
---

# No direct db access

<!-- Write the rule this directive enforces here. Directives are auto-loaded per role (roles.yaml). -->

$ git log -1 --format='%H %an <%ae>%n%s'
4e225fc3a484da2fcf7a73c1b67c71842727a300 WingFoil E2E <e2e@example.invalid>
wf(directive): create no-direct-db-access
$ git show --name-only --format= HEAD
.wingfoil/directives/custom/no-direct-db-access.md
$ git status --porcelain
(empty — the change really is committed)

$ node …/dist/cli.js directives list --format json   → 11 entries:
['architecture','code-quality','code-review','determinism','doc-versioning','documentation',
 'no-direct-db-access','security-secrets','security','testing','traceability']

$ node …/dist/cli.js directive create --name no-direct-db-access
error: directive already exists: no-direct-db-access                 exit=1
$ node …/dist/cli.js directive create --name 'bad name!'
error: invalid directive name (use kebab-case)                       exit=2
$ node …/dist/cli.js directive create --name '../escape'
error: invalid directive name (use kebab-case)                       exit=2
$ node …/dist/cli.js directive create
error: missing required argument: --name                             exit=2
$ git log --oneline
4e225fc wf(directive): create no-direct-db-access
8766d17 chore(wingfoil): initialize .wingfoil/ with the Scrum template (P5.1.1)
```

The `directives list` run is the load-time proof asked for by the `bug-006` lesson: the created file
is read back by the real `loadDirectives` **alongside the ten `wingfoil init` scaffolds**, and all
eleven validate against `DirectiveFrontmatter` (the loader throws on the first bad file, so 11 results
means 11 valid files). The same invariant is asserted in-process by
`test/core/directive-create.test.ts` "AC1: the created directive loads cleanly alongside the ten
scaffolded by `wingfoil init`".

### Deviations / out of scope

**Two of the items below are now elements, filed after the independent review so they do not survive
as prose in a `done` task's notes:**

- **`dl-041-spec-006-module-grouping-vs-core-module-name`** — `spec-006` §3 claims its groupings *are*
  `CoreModule.name`, which is false in three places (`pathsQuery` under `dna`, this task's
  `directiveCreate` under `directives`, plus the heading/`module` split generally), and `spec-008` §1's
  noun list omits `directives` entirely. **It also carries the instruction below about where
  `task-051` / `task-052` register** — which is the one thing in these notes that must not be lost,
  since nothing reschedules a done task's Execution Notes and `dl-015`'s `read_related` covers
  `depends_on` tasks, not decision-logs.
- **`bug-021-core-index-excluded-from-coverage`** — the `collectCoverageFrom` exclusion noted below.
  Originally disclosed by `task-049`, which is now `done`, so it had already escaped once; this task
  was the second restatement and `task-065` the third. Measured during `task-065`'s review: the
  reported ~98 % is **not** materially overstated — including `index.ts` files moves statements,
  branches and lines *up*, and the functions drop is an artifact of CommonJS re-export getters. The
  one real hole is `src/core/index.ts` itself.

The review upheld the module-naming deviation as **correct and necessary**, not merely defensible: the
brief executed literally would have produced `wingfoil directives directive-create`, failing the P3.1
acceptance contract. `paths` is the established precedent for a `CoreModule.name` decoupled from both
the `src/` directory and `spec-006` §3's heading.

Original list, kept for context:


- **Deviation from the task brief's wording.** The brief asked for the operation to be appended to the
  **`directives`** module's operations map in `src/core/index.ts`. Doing that literally would have
  produced `wingfoil directives directive-create` and Tool `directives.directive-create` (see design
  decision **D1** for the `deriveVerb` derivation), contradicting the P3.1 BDD, `spec-006` §3,
  `spec-008` §1 and `X_cli-cmds.md`. A separate `directive` module was registered instead. The
  *intent* of the constraint — do not touch the block task-053 is editing — is satisfied more
  strictly than asked: the `directives` block has **zero** changed lines in this branch.
- **`--file-format md|yaml` and `--template TEMPLATE`** (sketched for this command in
  `X_cli-cmds.md`) are **not implemented**: neither appears in the P3.1 feature file, and
  `--file-format yaml` would additionally break `loadDirectives`, which reads `.md` only. A later task
  (or a decision-log, if the `yaml` option is still wanted) should own them.
- **Interactive prompting for a missing `--name`** (spec-008 §4's TTY matrix) is not implemented; a
  missing `--name` fails immediately with exit `2`. Only `wingfoil init` implements the prompt matrix
  today, so this matches every other `CORE_MODULES` operation rather than introducing a second,
  divergent prompting path.
- **`src/core/index.ts` is excluded from coverage measurement** by the pre-existing
  `collectCoverageFrom` rule (see the `refactor` table). Not changed here; worth a decision-log if the
  release wants core-op line coverage reported, since `src/core/index.ts` now holds three mutating
  operations' whole bodies.
- **Note for `task-051-directive-assign` (P3.2) and `task-052-directive-remove` (P3.3):** their noun
  now exists. Register `directiveAssign` / `directiveRemove` in the **`directive`** module this task
  added (`CORE_MODULES`, last entry) — `deriveVerb` then yields `assign` / `remove`, giving
  `wingfoil directive assign|remove` and Tools `directive.assign` / `directive.remove`, exactly as
  `spec-006` §3 pins them. Do not add them to the plural `directives` module.
