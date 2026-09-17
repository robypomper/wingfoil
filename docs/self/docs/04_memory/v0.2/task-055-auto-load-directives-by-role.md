---
id: "task-055-auto-load-directives-by-role"
type: task
title: "Implement Auto-Load Directives by Role"
status: in-progress
release: "v0.2"
priority: "Critical"
tags: ["v0.2", "p3"]
ref: "P3.6"
bug: ""
depends_on: ["task-037-role-task-scoped-context", "task-039-mcp-prompts-role-based-infra", "task-069-fix-archived-excluded-from-agent-context"]
tmpl_version: 260703
---

## Description

As Jordan, deliver feature **P3.6** (US-3-06): directives auto-load into agent context at task execution, per the active role.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p3-directives/P3.6-auto-load-by-role.feature`.

Key scenario: agent under `developer` → context includes `testing` + `code-quality`; 100% of the role's directives present.


**`dl-037` — directive precedence and shadow reporting (assigned by `dl-037`, ratified A.1 + B.1).**
Two behaviours land here because this task already consumes `resolveRoleDirectives` and already owns
rendering its `warnings` channel:

1. **`custom/` wins over `built-in/`** when two directives share an id. `task-037` shipped the
   opposite by accident — it broke the tie on shortest path, so `directives/built-in/…` won because
   `'b'` sorts before `'c'` — and pinned that in a test. Flip the comparator in `src/core/context.ts`'s
   dedup and flip that test. `spec-012` §5 now states the rule.
2. **The shadowed directive is reported**, through the same `warnings` array that carries `dl-029`'s
   no-assignments message — naming the id and which file won. Render both warnings; nothing surfaces
   them to an operator until this task does.

Urgency: `task-057-builtin-directive-templates` ships the six built-ins whose ids are exactly the six
`custom/` stand-ins, so every one becomes a live duplicate the moment it lands.
## Implementation Notes

Depends on REQ-STATE-05 role/task-scoped context (`task-037`) + REQ-INT-02 (`task-039`). Realizes the `roles.yaml` bindings.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### design — role: architect (directives: architecture, determinism, traceability; global: doc-versioning, documentation, security-secrets)

#### Scope, as expanded by the approver

This task's ACs are the union of three sources, all binding:

1. **P3.6** — `p3-directives/P3.6-auto-load-by-role.feature` (3 scenarios; the edge scenario already
   amended on `main` to dl-029 (c): globals only **plus** `no directives assigned to role 'intern'`).
2. **`dl-037-builtin-vs-custom-directive-precedence`** (`ready`, A.1 + B.1) — assigned in this task's
   own AC section: `custom/` wins over `built-in/`; the shadowed file is reported through `warnings`.
   `spec-012` §5 already states both rules (checked: `grep -n "custom/\` wins" docs/self/docs/04_memory/design/specs/spec-012-*.md`).
3. **`dl-042-directives-list-output-contract`** (`ready`, ratified in `995dfc0` — handed to this task
   by the approver's commit body, **scope expansion by approver decision**): **A** — a shadowed
   directive is reported via a `warnings` channel on the listing; **D** — `directives list --role <r>`
   emits the warning for a role with no assignments **and** for a dangling binding (role bound to an
   id with no file) instead of silently returning globals; the payload gains a warnings channel
   alongside the entries, and changing the existing assertions that pin the bare array is accepted.
   **B** (type filters/column) is OUT. **C**: `DirectiveListEntry` stays `[AUTHORING]`, no spec-016.

Evidence the dl-037 defect is live (verified, not inherited from dl-042's text):
`sed -n 110p src/core/context.ts` → `if (incumbent === undefined || file.path < incumbent.path) byId.set(id, file);`
and `test/core/context.test.ts:245` pins `…?.path).toContain('built-in')`. Evidence the listing has no
warnings channel: `grep -c warnings src/core/directives-list.ts` → `0`.

#### `agent.classify_acs` (T1)

| AC | Criterion | Class | Evidence |
|---|---|---|---|
| AC-1 | P3.6 Sc.1 — under `developer`, context includes `testing` + `code-quality`; 100% of the role's directives present | **characterization** | `resolveRoleDirectives`/`assembleExecutionContext` (task-037) already do this: `test/core/context.test.ts` › "includes 100% of the role's assigned directives plus global". Pinned again with the feature's own fixture, green on first run. |
| AC-2 | P3.6 Sc.2 — `reviewer`'s `code-review` NOT loaded under `developer` | **characterization** | same resolver; › "includes 0 directives of other roles". |
| AC-3 | P3.6 Sc.3 (edge, amended by dl-029) — unbound `intern` → only globals + warning `no directives assigned to role 'intern'` | **characterization** | task-037 second pass, `73df7be`; › "emits the P3.6 warning verbatim for a role absent from `assignments`". |
| AC-4 | dl-037 A.1 — `custom/` beats `built-in/` for the same id, input-order independent | **red-first** | line 110 above picks `built-in/`. |
| AC-5 | dl-037 B.1 — the shadowed file is reported through the resolution's `warnings`, naming the id and the winning file | **red-first** | the resolver emits only the dl-029 warning today (`grep -n "warnings" src/core/context.ts`). |
| AC-6 | dl-042 A — `directives list` payload carries `warnings` alongside `entries`, reporting every shadowed id | **red-first** | payload is a bare `DirectiveListEntry[]` (`src/core/directives-list.ts:134`). |
| AC-7 | dl-042 D — `directives list --role <r>`, role with no assignments (incl. no `roles.yaml`) → dl-029 warning; exit 0, entries unchanged (globals) | **red-first** | same; today silent. |
| AC-8 | dl-042 D — `directives list --role <r>` with a dangling binding (id with no file) → a warning naming the id and role | **red-first** | same; `resolveRoleDirectives`' TSDoc states dangling ids are "silently skipped". |
| AC-9 | one precedence rule shared by context assembly and the listing (orchestrator instruction; dl-042's "task-055 … owns the resolution rule the shadow warning reports") | **red-first** (structural) | covered by asserting the listing's shadow/`--role` warnings equal `resolveRoleDirectives`' for the same inputs. |
| AC-10 | the existing surfaces still pass: P3.4 BDD suite (`test/core/directives-list.test.ts`, CLI integration) with the new `{entries, warnings}` shape; P3.6 BDD | characterization / shape update | the three assertions pinning the bare array (`test/core/production-registry.test.ts:131`, `test/cli/program.integration.test.ts:166` and `:546`) are updated — accepted by dl-042's ratification. |

#### `agent.read_related` (dl-015, HARD gate) — acknowledged

- **task-037-role-task-scoped-context** (both passes). Constraints taken: (i) warnings are a *returned*
  array, never stderr/logger — REQ-SYS-07 on a context-building path; the new warnings follow that.
  (ii) `warnings` is a diagnostic *about* the context, never serialized into the spec-012 §7 envelope.
  (iii) role lookup is own-property only (`ownAssignments`) — the listing must not re-derive a role's
  assignments with a plain index read, so it goes through `resolveRoleDirectives`. (iv) the output is
  sorted by id and input-order independent — the new comparator must stay a total order. (v) its
  breaking-change note: `resolveRoleDirectives` returns `RoleDirectiveResolution`; the only non-test
  consumers are `assembleExecutionContext` and `src/mcp/prompt.ts` (`grep -rn resolveRoleDirectives src`).
- **task-039-mcp-prompts-role-based-infra**. Constraints: `registerRolePrompts` consumes the resolver
  as-is and deliberately does **not** embed `warnings` in the prompt text (spec-004 §3.2 payload);
  its note 3 records that dl-037 is inherited "for free" once this task lands. So this task changes no
  line in `src/mcp/prompt.ts`; the Prompts channel picks up custom-wins automatically. Wiring the
  registrar into `createMcpServer` stays `task-058`'s.
- **task-069-fix-archived-excluded-from-agent-context**. Constraints: `assembleExecutionContext`'s
  archived filter and its `warnings` contract ("an archived element produces no warning … adding an
  unratified entry would change a payload REQ-SYS-07 governs") must be preserved. The archived-element
  test "only `memory` is affected — `dna`, `directives` and `warnings` are identical" must stay green;
  the new directive warnings depend only on directive inputs, never on the element.

Also read: **task-053-directives-list** Execution Notes (the listing's author, not a `depends_on`): the
listing is an **inventory** that never deduplicates, `--role` filters per file, and globals are
unconditional. Those decisions stand — dl-042 ratified a warnings channel, not deduplication — so
entries are unchanged; only `warnings` is added.

#### Design decisions

- **D1 — one precedence rule, in `src/core/context.ts`.** A new exported `selectDirectivesById(files,
  ids?)` performs dedup + precedence + shadow reporting, and is the only place "which file wins" is
  decided. `resolveRoleDirectives` calls it for the role's allowed ids; `buildDirectiveListing` calls it
  (without `--role`) for every id, and calls `resolveRoleDirectives` itself (with `--role`) so its
  warnings are *the* resolution's warnings. No second comparator.
- **D2 — precedence is structural, via REQ-SEC-07's discriminator.** A file is "custom" iff
  `isRemovableCustomAssetPath('directive', path)` (`src/core/builtin-asset.ts`, task-042) — the same
  allow-list that keys removability on the `custom/` directory, and which accepts both path separators
  (`loadDirectives` builds `path` with the platform `join`, so a string `startsWith('directives/custom/')`
  would be wrong on Windows). Custom beats non-custom; ties (two custom or two non-custom files with one
  id) break on the lexicographically smallest `path`, keeping the order total and input-independent.
  `frontmatter.kind` is **not** consulted: dl-042 B notes path and `kind` can disagree, and REQ-SEC-07
  keys on the directory.
- **D3 — warning texts.** dl-029: `no directives assigned to role '<role>'` (unchanged). Shadow (dl-037
  B.1 example wording, generalised to name files since spec-012 §5 asks for "which file won"):
  `directive '<id>' defined in <path>, <path>; using <winner path>`. Dangling (dl-042 D, no ratified
  text): `directive '<id>' bound to role '<role>' has no directive file`. Fixed order: no-assignments,
  then dangling ids ascending, then shadowed ids ascending.
- **D4 — dangling bindings are reported by the resolver, so context assembly reports them too.** dl-042 D
  ratifies the warning on the listing; making the listing's `--role` warnings exactly the resolver's
  (D1) means `ExecutionContext.warnings` gains it as well. This is the same harm dl-037's rationale
  names ("a directive an agent was supposed to obey and never saw"), including a dangling **global**
  (e.g. a missing `security-secrets`, which dl-029 calls the safety-critical case). Flagged for the
  approver in the review summary as the one place this task's reading goes beyond dl-042's literal text.
- **D5 — listing payload `{ entries, warnings }`.** Without `--role`: `warnings` = shadow warnings over
  all files (dangling/no-assignment warnings are role-scoped, so they need `--role`). With `--role`:
  the resolution's warnings. Entries are unchanged (inventory, both shadow files still listed).
  Rendering: `--format console|json|yaml` all render the payload, so the warnings reach the operator on
  the CLI and on `wingfoil://directives/list` with no surface-specific code (spec-006 §4 single-source).
- **D6 — contention.** `src/core/index.ts` edit limited to the `directivesListFn` type/TSDoc;
  `src/directives/**` untouched (task-051/052/056 own it next); `src/mcp/prompt.ts` untouched.

#### `agent.verify_specs`

No new tech-spec: `spec-012-context-loader-relevance-filtering` (`approved`) §5 already states custom-wins
and shadow reporting (amended for dl-037); dl-042 C explicitly rules out a listing spec (the entry shape
stays `[AUTHORING]`). `dl-029`, `dl-037`, `dl-042` are all `ready`. Design gate is **pass-through**.

**Checks (post):** `frontmatter.required` — task carries `title`, `release`. `tech-spec.approved` —
spec-012 approved, no new spec. `depends_on.acknowledged` — all three above.

### red — role: developer (directives: code-quality, testing, determinism) — `d23f8e7`

`npx jest test/core/context.test.ts test/core/directives-list.test.ts test/core/production-registry.test.ts test/cli/program.integration.test.ts --maxWorkers=2`
→ **`Test Suites: 4 failed, 4 total` / `Tests: 34 failed, 84 passed, 118 total`**. Failures, by reason:

| AC | Test (red) | Observed failure |
|---|---|---|
| AC-4 | `context.test.ts` › spec-012 §5 › *picks the same duplicate regardless of input order, and `custom/` wins (dl-037 A.1)* (the flipped task-037 pin) | `Expected: "directives/custom/testing.md"` / `Received: "directives/built-in/testing.md"` |
| AC-4 | › dl-037 › *custom/ wins even when the built-in arrives with Windows separators* | `Expected: "Custom"` / `Received: "Built-in"` |
| AC-5 | › dl-037 › *reports the shadowed directive through `warnings`…* | `- Expected - 3 / + Received + 1` (warnings `[]`) |
| AC-9 | › dl-037 › *selectDirectivesById is the shared rule…* | `TypeError: (0 , context_1.selectDirectivesById) is not a function` |
| AC-8 | › dl-042 D › *warns for a role-assigned id with no directive file*; *warns for a dangling global too…* | warnings missing the dangling entry |
| AC-6/7/8/9 | `directives-list.test.ts` › *the warnings channel (dl-042 A + D)* — all 7 cases | `Expected: [...] / Received: undefined` (payload is a bare array, no `warnings`) |
| AC-10 | the 15 pre-existing `directives-list.test.ts` cases, `production-registry.test.ts` › *directivesList returns coreOk([...])*, the 4 pre-existing CLI `directives list` cases | shape change: `entries` undefined on a bare array (accepted by dl-042's ratification) |
| AC-7 (CLI) | `program.integration.test.ts` › *--role for an unbound role carries the dl-029 warning in the payload, exit 0* | `warnings` absent from the payload |

Characterization cases green at red, as T1 predicted (no fabricated red): `context.test.ts` › *P3.6 — auto-load
directives by role (BDD acceptance)* — 3/3 passing (`npx jest test/core/context.test.ts -t "P3.6"`).

### green — `07dafc5`

- `src/core/context.ts` — new exported `selectDirectivesById(files, ids?)` → `{ byId, warnings }` with the
  module-private `compareDirectivePrecedence` (custom via `isRemovableCustomAssetPath('directive', path)`
  first, then smallest path). `resolveRoleDirectives` now delegates dedup/precedence/shadow warnings to it
  and adds the dangling-binding warning (fixed order: no-assignments → dangling → shadow). Return shape
  `RoleDirectiveResolution` is unchanged, so `assembleExecutionContext` and `src/mcp/prompt.ts` needed no
  edit (`git diff main --stat -- src/mcp` → empty).
- `src/core/directives-list.ts` — `buildDirectiveListing`/`loadDirectiveListing` return
  `DirectiveListing { entries, warnings }`; warnings come from `selectDirectivesById` (no role) or
  `resolveRoleDirectives` (with role; a missing `roles.yaml` resolves against an empty bindings object).
  Entries logic untouched.
- `src/core/index.ts` — the `directivesListFn` value type and TSDoc line; `selectDirectivesById`,
  `DirectiveSelection`, `DirectiveListing` added to the existing context/directives-list export lines.

### refactor — `e7b6793`

`ExecutionContext.warnings` and `assembleExecutionContext` TSDoc still said the warnings were dl-029 only —
updated to name the three kinds. Coverage showed `compareDirectivePrecedence`'s equal-path arm uncovered;
kept (it keeps the comparator consistent for a caller passing one file twice) and covered by
› *the same file handed in twice still resolves to one directive*. `src/core/context.ts` and
`src/core/directives-list.ts` → **100 / 100 / 100 / 100** (`npx jest test/core/context.test.ts
test/core/directives-list.test.ts --coverage --collectCoverageFrom=src/core/context.ts
--collectCoverageFrom=src/core/directives-list.ts`).

### sync with main (dl-035) — `4910303`

`git merge main` (no rebase) brought in `ebfb1e3` (dl-041: spec-006 §3 `module` column, spec-008 §1
`directives` noun) — docs only, no conflict. Re-read after the merge: spec-006 §3 row
`| directivesList | directives | false | wingfoil directives list | Resource wingfoil://directives/list |`
matches the unchanged `CORE_MODULES` registration (`name: 'directives'`); spec-006 §4 ("no duplicated or
hand-copied operation list") still reads as cited in D5. No note relied on the old wording. Gates re-run below.

### review-ready summary

**Gates — re-run after the merge, in this worktree:**

| Gate | Command | Result |
|---|---|---|
| tests | `npx jest --coverage --maxWorkers=2` | **80/80 suites, 1106/1106 tests** (baseline before this task: 80 / 1087) |
| coverage | same | **98.32 % stmts / 90.33 % branch / 98.46 % funcs / 98.94 % lines** (baseline 98.29 / 90.18 / 98.44 / 98.93 — non-regressing) |
| build | `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| full tsc | `npx tsc --noEmit -p tsconfig.json` | only `test/core/directive-create.test.ts(159,19): error TS2339` (bug-026, pre-existing) |
| lint.clean | `npm run lint` | exit 0 |
| docs.api | `npm run docs:api` | exit 0 |

**BDD acceptance → tests (all passing):**

- P3.6 Sc.1 *Directives auto-load at task execution* → `test/core/context.test.ts` › P3.6 › *Scenario: Directives auto-load at task execution…*
- P3.6 Sc.2 *Only the executing role's directives are loaded* → › *Scenario: Only the executing role's directives are loaded…*
- P3.6 Sc.3 *Edge - no assigned directives* → › *Scenario: Edge - a role with no assigned directives — only globals, plus the warning*
- P3.4 Sc.1/2/3 → `test/core/directives-list.test.ts` (Scenario 1/2/3 describes, now reading `entries`) + `test/cli/program.integration.test.ts` › `directives list --format json` and › `directives list --role <role>`.

**Scope added by approver decision (dl-042 A + D), covered:** AC-6..AC-9 above, plus the end-to-end CLI case
› *--role for an unbound role carries the dl-029 warning in the payload, exit 0*. Manual check of the
compiled CLI in a scratch repo (`node dist/cli.js directives list --role developer --format yaml`) printed
`warnings:` with the dangling `ghost-rule` warning and the `testing` shadow warning, exit 0.

**Corrections to the design notes (verified after writing them):**
- AC-10 said "three assertions" pin the bare array. The actual edits were five read sites: `production-registry.test.ts`
  (1) and `program.integration.test.ts` (4 — the `--format json` case, the `directive create` visibility
  case, and both `--role` describe cases). All are shape-only (`.entries`).
- D5 said warnings reach `wingfoil://directives/list` with no surface code. That follows from spec-006 §4
  (the Resource derives from the same registered op), but **no MCP test asserts the directives Resource
  payload**: `grep -rl directives test/mcp` → only `test/mcp/role-prompts.test.ts`.

**For the approver / reviewer:**
1. **D4 goes past dl-042's literal text:** the dangling-binding warning lives in `resolveRoleDirectives`, so
   `ExecutionContext.warnings` carries it too (and dangling **globals** are reported). This is what makes the
   listing's `--role` warnings and the context's warnings one rule (AC-9); if the approver wants it
   listing-only, the dangling loop moves to `buildDirectiveListing`.
2. **Warning texts are not ratified anywhere** except dl-029's. Shadow: `directive '<id>' defined in <paths>; using <winner>`
   (dl-037's example, generalised to paths); dangling: `directive '<id>' bound to role '<role>' has no directive file`.
3. **Shadow warnings without `--role` are not role-filtered**, while `--role` reports only shadowed ids bound to that role.
4. `src/mcp/prompt.ts` still does not surface warnings (task-039's decision, spec-004 §3.2); it inherits
   custom-wins with no change. No surface renders `ExecutionContext.warnings` yet (no `agent execute` until v0.3).
