---
id: "task-050-directive-create"
type: task
title: "Implement `wingfoil directive create`"
status: in-progress
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
