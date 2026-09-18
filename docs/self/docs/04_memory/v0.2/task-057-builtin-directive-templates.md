---
id: "task-057-builtin-directive-templates"
type: task
title: "Implement Built-in Directive Templates (6 types)"
status: done
release: "v0.2"
priority: "High"
tags: ["v0.2", "p3"]
ref: "P3.8"
bug: ""
depends_on: ["task-043-secret-credential-hygiene", "task-044-builtin-template-integrity", "task-064-fix-init-directive-scaffold-schema"]
tmpl_version: 260703
---

## Description

As Alex, deliver feature **P3.8** (US-0A-09): install exactly 6 built-in directive templates during init (code-quality, testing, code-review, architecture, security, documentation).

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p3-directives/P3.8-builtin-directive-templates.feature`.

Key scenario: after init, `.wingfoil/directives/built-in/` contains exactly the 6-template set.

## Implementation Notes

**`task-064` must land before this task adds any file under `directives/built-in/`.** `task-044`
replaced the built-in registry with derivation from the scaffold, so adding the scaffold file alone
arms the integrity check — there is no longer a registry edit that could be forgotten, and equally no
longer one that could be delayed. With `bug-006` unfixed, `directiveMd()` emits `name`/`kind`/`ref`
while `DirectiveFrontmatter` requires `id`/`type`/`title`, so `wingfoil init` aborts for every user.
Verified empirically by `task-044` and its reviewer, both of whom reproduced
`built-in directive template integrity check failed: architecture`. The alternative is for this task
to emit schema-valid frontmatter itself. The `depends_on` edge above was added so the constraint is
structural rather than carried narratively through `task-044`'s Execution Notes.


Depends on REQ-SEC-08/10 (`task-043`/`task-044`). Replaces the interim `custom/` stand-ins (see CLAUDE.md §3). `directives/built-in/` is empty today.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### design — role: architect (directives: architecture, determinism, traceability; global: doc-versioning, documentation, security-secrets)

Branch `task/task-057-builtin-directive-templates`, worktree from `main` at `9c83ca2` (task-055 merged).

#### `agent.read_related` (`dl-015`, HARD gate) — acknowledged

- **task-043-secret-credential-hygiene** (both passes). Taken: `scanText(content, file)` /
  `SECRET_PATTERNS` are the canonical spec-007 scanner — reuse them, never re-implement regexes. Its
  second pass states REQ-SEC-08's Fit Criterion clause (a) — *"After `init`, the built-in `security`
  directive is present"* — is **this task's**, and that `test/validation/secret-scan.test.ts` says so
  in a comment that becomes stale once this lands. `warnings` are not a gate per spec-007 §4, but the
  shipped templates will be proven to produce **0 findings of any severity** (stronger, and free).
- **task-044-builtin-template-integrity** (both passes). Taken: there is no registry — the checked set
  is DERIVED from `templateScaffold(...)` by `builtinTemplateSources`, classifying by **directory**, so
  adding a file under `.wingfoil/directives/built-in/` to the scaffold is all it takes to arm guard 5
  (`initWingfoilProject`). Schema-only depth per `dl-031` — no digest/manifest. Its hand-off: the
  stderr `unknown field(s) ignored` noise from `.passthrough()` fires for keys outside
  `DirectiveFrontmatter`'s shape → the shipped frontmatter uses **only** declared keys (`id, name,
  type, kind, title, tags, ref`), no `scope`.
- **task-064-fix-init-directive-scaffold-schema**. Taken, all three of its hand-off items: (1) `kind`
  must be `built-in` on a built-in file — `directiveMd()` hard-codes `custom`, so built-ins get their
  own renderer; (2) hand-authored frontmatter must satisfy `DirectiveFrontmatter` on its own → every
  shipped file goes through the REAL `verifyBuiltinTemplates` **and** the REAL `loadDirectives` in a
  test; (3) precedence is ratified (`dl-037`) — now implemented, see task-055.
- **task-054-project-directives** (not a `depends_on`, read on instruction). Taken: both init write
  paths run guard 3/5 over the array they write; `scaffoldFiles()` (P1.1 skeleton,
  `initWingfoilStorage`, no CLI verb) reserves `directives/built-in/.gitkeep`. P3.8's Background is "a
  new project being initialized" = `wingfoil init` = `initWingfoilProject` → templates go into
  `templateScaffold` only; the skeleton keeps its `.gitkeep` (deliberately unchanged, see D5).
- **task-055-auto-load-directives-by-role** (just merged). Taken: `selectDirectivesById`
  (`src/core/context.ts:100`) is the single precedence rule — custom wins by DIRECTORY
  (`isRemovableCustomAssetPath`), not `kind`; each shadowed id yields
  `directive '<id>' defined in <paths>; using <winner>` in `ExecutionContext.warnings` and in
  `directives list` `{entries, warnings}`. The listing is an inventory that never dedupes.

Also read: `dl-030` (REQ-SEC-07 clause (a) keyed on the `built-in/` directory; clause (b) owned
elsewhere — nothing here), `dl-031`, `dl-036` + spec-007 §2–§4, `dl-037`, `bug-006`, spec-011,
spec-013, spec-015 §1, REQ-SEC-07/08/10.

#### `agent.verify_specs`

- **spec-013** (`approved`) — the file shape. `kind` is a plain string "so `built-in` needs no schema
  change". Shipped frontmatter = its five required fields + optional `tags`/`ref`.
- **spec-011** (`approved`) — `directives/built-in/` is "reserved for the official P3.8 directive
  templates shipped by the `wingfoil` npm package"; Consequences: "`wingfoil init` … is the eventual
  producer of this layout". **How init installs them** is not spelled out as a mechanism, but it is
  determined by what is already approved/ratified, so no new spec is needed:
  - **spec-015 §1** fixes the tarball: "`files` review: stays `["dist", "README.md"]`" — so shipped
    assets must live inside `dist/`, i.e. be compiled module content, not loose `.md` files beside it.
  - The only `init` write path is `templateScaffold` → `initStorage` (task-029), and task-044's
    ratified derivation says real built-in content "is added to the **scaffold**".
  → The templates are TypeScript string data in `src/storage/`, compiled into `dist/`, emitted by
  `templateScaffold`. **`package.json` `files` and the `publish-metadata` allowlist are NOT changed**;
  a pack test proves the carrying module is in the tarball. spec-011's *text* is stale on this point
  ("EMPTY today", "roles.yaml binds by directive **name**") → reported as a proposed element, not a
  blocker (it describes `docs/self/.wingfoil/`, which this task does not change).
- **REQ-SEC-10 / dl-031**: schema check only — satisfied by existing guard 5 over derived sources.
- **REQ-SEC-08 / spec-007 / dl-036**: clause (a) delivered here; security template text proven clean.
- **REQ-SEC-07 / dl-030**: `requireCustomAsset` already refuses `directives/built-in/**` — pinned for
  the six real shipped paths (characterization).
- Design gate: **pass-through** (no new tech-spec).

#### `agent.classify_acs` (T1)

Acceptance = `P3.8-builtin-directive-templates.feature` (3 scenarios) + REQ-SEC-08 clause (a) + the
orchestrator's precedence/validation obligations. Baseline evidence (commands run in this worktree):
`ls -a docs/self/.wingfoil/directives/built-in/` → `.gitkeep` only; `grep -n "BUILTIN_DIRECTIVES_DIR"
src/storage/templates.ts` → the scaffold writes only `${BUILTIN_DIRECTIVES_DIR}/.gitkeep`;
`grep -n "kind: custom" src/storage/templates.ts` → the one `directiveMd` renderer.

| AC | Criterion | Class | Evidence |
|---|---|---|---|
| AC1 | P3.8 Sc.1 — after `wingfoil init`, `.wingfoil/directives/built-in/` contains exactly the 6 templates `code-quality, testing, code-review, architecture, security, documentation` | **red-first** | scaffold writes only `.gitkeep` there today |
| AC2 | P3.8 Sc.2 — installed independently of the selected methodology, and available for assignment (resolvable by id through roles.yaml) | **red-first** | same; "for every registered template" property. `Trunk-Based` is not a registered init template (`TEMPLATE_NAMES` = Scrum, Kanban) → proposed element |
| AC3 | P3.8 Sc.3 — a corrupted built-in source aborts init before writing, message `built-in directive template integrity check failed: <name>` | **characterization** | `test/core/init-project.test.ts` › "aborts before writing anything when a built-in directive template is corrupted" passes today (task-044); re-pinned against a corrupted copy of a REAL shipped template |
| AC4 | every shipped file validates through the real `verifyBuiltinTemplates` AND the real `loadDirectives`, with `kind: built-in`, `id` = filename stem, no out-of-shape keys (bug-006 re-grade) | **red-first** | no shipped file exists to validate |
| AC5 | REQ-SEC-08 (a) — after init the built-in `security` directive is present; the shipped template text trips 0 spec-007 findings (any severity) | **red-first** | not present today |
| AC6 | dl-037 on a fresh project — no id is defined twice, so `directives list` has **0** warnings and every role binding resolves to the built-in | **red-first** | today the six ids live in `custom/` (fresh init would otherwise produce 6 shadow warnings once built-ins are added) |
| AC7 | dl-037 on a customized project — a `custom/<id>.md` with a built-in id wins, and a shadow warning names it (listing + ExecutionContext) | **red-first** (end-to-end) | the rule exists (task-055, unit-tested with fixtures) but no real built-in exists to shadow; the end-to-end test over a real init fails until AC1 lands |
| AC8 | REQ-SEC-07 — the six shipped paths are non-removable | **characterization** | `requireCustomAsset('directive','directives/built-in/testing.md')` already refused (`test/core/builtin-asset.test.ts:40`) |
| AC9 | shipped via npm (spec-015 §1 `files` unchanged): the compiled module carrying the templates is in `npm pack --dry-run --json --ignore-scripts` | **red-first** | the module does not exist |
| AC10 | determinism — templates are fixed strings, no dates; scaffold byte-identical run to run | **characterization** | existing `test/storage/templates.test.ts` › determinism covers the scaffold; extended to include the new files |

#### Design decisions

- **D1 — content module `src/storage/builtin-directives.ts`**: `BUILTIN_DIRECTIVE_TEMPLATES` (fixed
  order = the BDD's listing order) as structured data (`id, name, appliesTo, rules[]`) plus a pure
  renderer. `storage` because `templateScaffold` (its only consumer) lives there and `storage` must not
  import a pillar schema (REQ-SYS-02) — it doesn't need to. Not `src/directives/` (task-051/052/056).
- **D2 — frontmatter**: `id` (stem), `name`/`title` (human, same value — spec-013 notes they are
  identical on every file), `type: directive`, `kind: built-in`, `tags: [built-in, <id>]`,
  `ref: [P3.8]`. No other key (task-044 stderr-noise constraint).
- **D3 — body**: normative, project-agnostic rules derived from the six dogfood stand-ins with every
  WingFoil-specific item removed (REQ/dl/spec ids, `docs/04_memory` paths, dl-022's WingFoil phase
  names, Zod/Jest/TypeDoc). A closing note tells the reader how to customize (a same-id file under
  `directives/custom/` takes precedence and is reported). No dates, no versions, no credential-shaped
  examples.
- **D4 — fresh-project scaffold replaces its generated P3.8 stand-ins.** `templateScaffold` stops
  emitting `directives/custom/{the six}.md` (the `p38: true` rows of `DIRECTIVES`) and emits the six
  built-ins instead; the four cross-cutting starters stay in `custom/`. Rationale: the task's own
  description ("Replaces the interim `custom/` stand-ins") and AC6 — keeping both would make every
  fresh `init` report six shadow warnings about files the user never wrote. `roles.yaml` is unchanged:
  it binds by id, so the same bindings now resolve to the built-ins. `directives/built-in/.gitkeep` is
  dropped from `templateScaffold` (the directory now holds real files; Sc.1 says "exactly 6").
- **D5 — scope held**: `scaffoldFiles()` (P1.1 skeleton, no CLI verb) unchanged; `roles.yaml` scaffold
  unchanged (the unbound `security` id is a proposed element, not a silent change); no change to
  `src/core/init.ts`, `src/core/context.ts`, `src/core/index.ts`, `package.json`.
- **D6 — dogfood config untouched.** `docs/self/.wingfoil/directives/{built-in,custom}/` not edited;
  the stand-ins stay. Delete/rename vs. keep-as-customization is the approver's call (review summary).

### red — role: developer (directives: code-quality, testing, determinism) — `81cb63d`

Two new suites: `test/storage/builtin-directives.test.ts` (template data) and
`test/core/builtin-directive-templates.test.ts` (end to end over `initWingfoilProject` in a temp repo).
`npx jest test/core/builtin-directive-templates.test.ts test/storage/builtin-directives.test.ts --maxWorkers=2`
→ `Test Suites: 2 failed` / `Tests: 12 failed, 3 passed, 15 total` (the storage suite could not run:
`Cannot find module '../../src/storage/builtin-directives'`). Observed failure reasons:

| AC | Test | Observed |
|---|---|---|
| AC1 | Sc.1 › *contains exactly the 6 templates*; *tracked by git* | `- Expected - 6 / + Received + 1` (only `.gitkeep`) |
| AC4 | Sc.1 › *loads through the real loadDirectives as kind built-in* | `- Expected - 8 / + Received + 1` |
| AC5 | Sc.1 › *REQ-SEC-08 (a)* | `Expected: "directives/built-in/security.md"` / `Received: "directives/custom/security.md"` |
| AC2 | Sc.2 › *Scrum/Kanban installs the same 6*; *available for assignment* | `-6/+1`; `Received: "directives/custom/code-quality.md"` |
| AC3 | Sc.3 › *corrupted REAL template* | `ENOENT … built-in/security.md` — the fixture needs a shipped template to corrupt; the abort behaviour itself is characterization (task-044) and needed no code |
| AC6 | dl-037 › *a fresh project defines no id twice* | `Expected: false / Received: true` (`custom/testing.md` scaffolded) |
| AC7 | dl-037 › *customizes a built-in id … one shadow warning* | `- Expected - 3 / + Received + 1` (no built-in to shadow) |
| AC9 | spec-015 › *compiled module is packed* | `Expected value: "dist/storage/builtin-directives.js"` not in the pack listing |

Green at red, as T1 predicted (no fabricated red): *REQ-SEC-07 … refused for removal* (AC8),
*REQ-SEC-08 (b) … 0 findings*, and *installed bytes identical across methodologies* (vacuously equal
`.gitkeep` maps at red; made meaningful by the 6-file assertion beside it).

### green — `d405e5a`

- `src/storage/builtin-directives.ts` (new): `BUILTIN_DIRECTIVE_TEMPLATES` (6, feature order),
  `BUILTIN_DIRECTIVE_IDS`, `builtinDirectiveMd` (D1–D3). Exported from `src/storage/index.ts`.
- `src/storage/templates.ts`: `templateScaffold` emits the six under `BUILTIN_DIRECTIVES_DIR` instead of
  `built-in/.gitkeep`; `DIRECTIVES` keeps only the four custom starters (the `p38` flag and the
  `ref: [P3.8]` branch in `directiveMd` are gone with them) (D4). `roles.yaml` unchanged.
- Two pre-existing tests pinned the old shape and were updated (shape only, intent kept):
  `test/storage/templates.test.ts` › *creates the directives built-in/custom split* (now asserts the six
  built-in paths); `test/core/directive-create.test.ts` › AC2 collision now uses `determinism` (still a
  scaffolded CUSTOM directive) and the untouched-directory count 10 → 4. Line 159 (bug-026) not touched.
- `npx jest --maxWorkers=4` → **87 suites / 1226 tests passed**.

**Behaviour change worth the reviewer's eye:** on a fresh project `wingfoil directive create --name
code-quality` previously failed `directive already exists` (the stand-in was in `custom/`); it now
SUCCEEDS and creates a `custom/` override of the built-in, which `directives list` reports as a shadow.
That matches dl-037's override model and P3.1's wording ("a **custom** directive … already exists"),
but no element ratifies whether `directive create` should accept a built-in id → proposed dl.

### refactor — `f0076f9`

Comments/test-name only, all made false by this change: `src/core/builtin-integrity.ts`
(`verifyBuiltinTemplates` TSDoc "no built-in template content ships yet"), `src/storage/templates.ts`
(`builtinTemplateSources` "Returns `[]` for both of today's scaffolds"), `test/core/init-project.test.ts`
(describe header + the *"default (empty) registry — no behavior change until built-in content ships"*
test name), `test/storage/builtin-template-sources.test.ts` ("Vacuously true today"),
`test/validation/secret-scan.test.ts` (clause (a) "do not exist yet" → points at the new test). Found by
`grep -rn "EMPTY today\|empty today\|\.gitkeep only\|no built-in template content ships\|until built-in content ships\|do not exist yet\|Returns \`\[\]\` for both\|Vacuously true today" src/ test/`.
`src/core/builtin-asset.ts:8` still says "(empty today, `.gitkeep` only)" — it paraphrases spec-011's
description of the dogfood tree, which is still true there; left alone (task-052 territory).

### review-ready summary

**Gates (this worktree, HEAD `f0076f9`; `git merge main` → "Already up to date", main still `9c83ca2`):**

| Gate | Command | Result |
|---|---|---|
| tests | `npx jest --coverage --maxWorkers=4` | **87/87 suites, 1226/1226 tests** (main: 85 / 1163) |
| coverage | same | **98.33 % stmts / 90.31 % branch / 98.48 % funcs / 98.95 % lines**; main `9c83ca2` measured in a throwaway worktree: 98.32 / 90.33 / 98.46 / 98.94. `builtin-directives.ts` 100/100/100/100 |
| build tsc | `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| full tsc | `npx tsc --noEmit -p tsconfig.json` | only `test/core/directive-create.test.ts(159,19): error TS2339` (bug-026) |
| lint.clean | `npm run lint` | exit 0 |
| docs.api | `npm run docs:api` | exit 0 |

**Branch-% dip explained, not asserted:** absolute counts from `coverage/coverage-final.json` — main
900 branches / 813 covered / **87 uncovered**; branch 898 / 811 / **87 uncovered**. No new uncovered
branch; the −0.02 pt is the arithmetic of deleting the fully-covered `p38` ternary.

**BDD acceptance → tests (all passing):**
- P3.8 Sc.1 *Built-in templates are installed during init* → `test/core/builtin-directive-templates.test.ts`
  › *P3.8 Scenario 1* (exactly 6 files, the set, git-tracked, clean tree, real `loadDirectives`) +
  `test/storage/builtin-directives.test.ts` › *built-in directive template set*.
- P3.8 Sc.2 *selected by methodology* → › *P3.8 Scenario 2* — property over `TEMPLATE_NAMES`
  (Scrum, Kanban): same 6, byte-identical, every bound built-in id resolves to `built-in/` with no warning.
  The scenario's literal `"Trunk-Based"` is not a registered init template → proposed element.
- P3.8 Sc.3 *integrity check* → › *P3.8 Scenario 3* (a truncated copy of the REAL shipped `security.md`,
  exact message, exit 1, `.wingfoil` absent) + existing `test/core/init-project.test.ts` REQ-SEC-10 cases.
- REQ-SEC-08 (a) → › *REQ-SEC-08 (a)*; template text → `builtin-directives.test.ts` › *zero spec-007
  findings of any severity* (+ non-vacuity: a planted key header under the same path IS flagged).
- bug-006 re-grade → every shipped file through `DirectiveFrontmatter`, `verifyBuiltinTemplates`,
  declared-keys-only; compiled CLI `init` printed nothing on stderr.
- dl-037 → › *a fresh project … 0 warnings*; › *customizes a built-in id* (listing, `resolveRoleDirectives`
  and `assembleExecutionContext` all carry the one shadow warning; custom wins).
- REQ-SEC-07 → › *refused for removal*. spec-015 §1 → › *compiled module … packed*
  (`npm pack --dry-run --json --ignore-scripts`; `package.json` `files` unchanged, allowlist test untouched).

**End to end, compiled CLI** (`npm run build`, fresh repo in the scratchpad):
`node dist/cli.js init --template Kanban` → exit 0, empty stderr; `git ls-files .wingfoil/directives` →
6 `built-in/*.md` + 4 `custom/*.md`; `directives list --format json` → 10 entries, `warnings: []`, exit 0.

**Dogfood config — APPROVER DECISION (nothing changed here).** `docs/self/.wingfoil/directives/built-in/`
still holds only `.gitkeep` and there is no root `.wingfoil/`, so **today this repo reports no shadow
warning**. Simulated by copying `docs/self/.wingfoil` into a scratch repo and adding the six shipped
files: `directives list` reports six warnings of the form
`directive 'testing' defined in directives/built-in/testing.md, directives/custom/testing.md; using directives/custom/testing.md`
(architecture, code-quality, code-review, documentation, security, testing). Options:
(a) delete the six stand-ins once the dogfood config receives the built-ins; (b) keep them as deliberate
customizations (they carry WingFoil-specific rules — dl-022, dl-013/TypeDoc, T1, REQ-SYS ids — that the
generic built-ins intentionally omit), updating their "stand-in … until they ship" blockquote and
`kind`-note, and accepting the six warnings; (c) split: keep WingFoil-specific additions as differently
named custom directives bound in `roles.yaml` alongside the built-ins. **Recommendation: (c)** — it keeps
every WingFoil-specific rule, dogfoods the built-ins as a real user would, and yields zero warnings;
(b) is the zero-effort fallback. Either way CLAUDE.md §3 and spec-011's "EMPTY today" text become stale
once the dogfood built-ins are installed.
