---
id: "task-168-accept-declared-not-applicable-value-required-fields-explicit"
type: task
title: "Accept a declared not-applicable value for required fields, and an explicit empty list"
status: in-progress
release: "v0.3"
kind: "feature"
priority: "medium"
tags: ["v0.3", "core", "memory"]
ref: "dl-124"
bug: ["bug-147"]
depends_on: ["task-127-add-memory-amend-id-reason-approver-gated-verb"]
tmpl_version: 260703
---

## Description

`isEmptyValue` (`src/memory/submit.ts:18-22`) treats `[]` as missing, so an author who explicitly sets `features: []` is refused (`bug-147`), and a required field cannot say "does not apply" (`dl-124`). Ratified: `template.frontmatter.not_applicable_allowed: [...]`, value `"n/a — <reason>"`, accepted only for declared fields.

## Acceptance Criteria

- (red-first) a declared field holding `"n/a — patch release"` passes `submit`; bare `n/a` or an undeclared field holding it is refused, naming the field.
- (red-first) the empty-list rule chosen in design (accept `[]` as present, or require `n/a` for lists) is asserted and stated in `spec-010`.
- (characterization) this repository's `memory.yaml` declares not-applicable for `release`'s `pillar`/`requirements` if the approver confirms (Action 4; version bump).

## Implementation Notes

- **Size:** S · **wave:** 1 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** dl-124 Q1 (A) `n/a`, Q2 (a) `not_applicable_allowed`, Q3 (ii) quoted reason; spec-001; spec-010.
- **Features:** P1.6, P1.13.
- **Notes:** Proposal key: C28.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

Branch `task/task-168-accept-declared-not-applicable-value-required-fields-explicit`, worktree
`../.wf2-wt/task-168`, cut from `main` at `903b87a6`; start `e0469fd4`, `bug-147` synced
`planned → in-progress` at `b06aa42e`.

### design (architect)

**`depends_on`** (dl-015): `task-127`'s Execution Notes read. What this task takes from them: review
F1 made `memory amend` run `submit`'s own required-field check past the type's initial state
(`requireRequiredFieldsKept`, `src/core/memory-amend.ts`). The not-applicable rule therefore has to
apply to both verbs from one function, or the two would disagree about what "filled" means.

**Specs and decisions cited** (`awk '/^status:/{print $2;exit}'` on each): `spec-001`, `spec-010`
`approved`; `dl-124`, `dl-092` `ready`. `dl-124`'s ratification is `09cc2ae8`
(`git log --follow` on its file): "Q1 (A), Q2 (a), Q3 (ii)".

**Design decisions** (to confirm at review):
1. **The value.** A string whose trimmed text starts with `n/a`, in any case, not followed by a word
   character, is *not-applicable-shaped* (`n/a`, `N/A`, `n/a — x`; not `n/available`, not
   `P1 (n/a for docs)`). The one accepted form is `n/a — <non-blank reason>`, em dash only, as the
   ratified Q3 (ii) text writes it. An ASCII `n/a - reason` is refused as "needs a reason".
2. **Undeclared fields.** A not-applicable-shaped value on a required field the type does not list is
   refused whatever its form. This is what keeps `task.kind` (required since `task-150`, not listed)
   from being skipped with `n/a`. `title` is never listable: spec-010 requires it of every type, and
   `memory.yaml` validation refuses `title` in the list. Optional fields are not checked.
3. **Schema.** `not_applicable_allowed: string[]` (optional) next to `required`. Two semantic checks:
   each entry is a member of `required`, and `title` is not one.
4. **One check for two verbs.** `requireRequiredFields(memoryYaml, type, frontmatter, verb)`
   (`src/core/required-fields.ts`, new) is called by `memory submit` and by amend's
   `requireRequiredFieldsKept`. Messages: the existing `missing required field on <verb>: a, b`
   (unchanged), and `not-applicable value on <verb>: <field> does not accept one (…)` /
   `<field> needs a reason, written "n/a — <reason>"`, joined by `; ` when both apply.
5. **No existing document is affected.** `grep -rniE '^[a-z_-]+: *"?n/a' docs/04_memory docs/05_plans`
   → nothing, so no committed frontmatter becomes refusable.

**AC classification (T1).**

| AC | Class | Why |
|---|---|---|
| 1 — declared `"n/a — patch release"` passes; bare `n/a` or an undeclared field holding it is refused naming the field | **red-first** for the refusals and the schema key; the accepting half is characterization (a non-empty string already passes `isEmptyValue`) | no `not_applicable_allowed` key and no refusal existed on `903b87a6` |
| 2 — the empty-list rule, asserted and stated in spec-010 | **stopped for the approver** (below) | — |
| 3 — `memory.yaml` declares not-applicable for `release`'s `pillar`/`requirements` | **stopped for the approver** (below; the AC itself says "if the approver confirms") | — |

### Questions for the approver (the task stops here, before AC2 and AC3)

**Q-A — the empty-list rule (AC2, `bug-147`).** The two sources point different ways once the
scaffolds are read:
- `bug-147` Expected Behavior: a present `[]` is filled; non-empty only if `memory.yaml` declares a
  minimum. `dl-124` Context agrees `[]` should be fixed, but reads it as "none yet", not "does not
  apply".
- But `.wingfoil/memory/templates/release.md` scaffolds `features: []   # REQUIRED`. YAML cannot tell
  an author's `[]` from the untouched scaffold's, so accepting `[]` silently turns `release.features`
  into a field an unedited scaffold satisfies. `features` is the only required list field in this
  repository (`grep -n "\[\]" .wingfoil/memory/templates/*.md`, cross-checked with the `required:`
  lists in `memory.yaml`).

Options:
- **(1) Accept `[]` as present** (fixes `bug-147` as filed), and change the `release` scaffold to
  `features:` (null) so an untouched scaffold still fails. Touches `.wingfoil/memory/templates/release.md`
  and the `init` scaffold if it declares a required list (to be checked).
- **(2) Accept `[]` as present, scaffolds unchanged.** Simplest; weakens `release.features`.
- **(3) Keep `[]` as missing; a list field that does not apply says `"n/a — <reason>"`** (needs the
  field declared). `bug-147` would be closed as "by design" rather than fixed.
Recommendation: (1). It fixes the bug as filed and keeps the check on the one field that has it.

**Q-B — `dl-124` Action 4 / AC3.** Action 4 says `release` declares not-applicable "once `dl-092`
settles patch tracking"; `dl-092` is `ready` and `patch-v0.2.2` exists, but it filled the fields
(`pillar: "P1"`, `requirements: "docs/04_memory/design/dls/retro-v0.2.md"`). Should `memory.yaml`
(1.9 → 1.10) declare `not_applicable_allowed: [ pillar, requirements ]` on `release` — and also
`features`, which `dl-124`'s Q2 (a) example lists? `patch-v0.2.2` is `released` and `release` is not
amendable, so it stays as it is either way.

### red (developer)

`9e9f2d34`: `test/memory/submit.test.ts` (pure `notApplicableRefusals`), `test/memory/schema.test.ts`
(`not_applicable_allowed`), `test/core/memory-submit.test.ts` (a `release` fixture with
`kind` required and not listed) and `test/core/memory-amend.test.ts` (the same rule past draft).
`npx jest test/memory/submit.test.ts test/memory/schema.test.ts test/core/memory-submit.test.ts
test/core/memory-amend.test.ts` → **4 suites failed, 14 tests failed, 72 passed**: the 7 pure tests
(`notApplicableRefusals` not exported), 3 schema refusals, 3 submit refusals, 2 amend refusals. The
accept-path tests passed already (characterization, decision 1 above).

### green (developer)

`14bb7902`: `notApplicableRefusals` in `src/memory/submit.ts`; `TemplateFrontmatter` with its two
checks in `src/memory/schema.ts`; `requireRequiredFields` in `src/core/required-fields.ts`, called by
`memorySubmitFn` and `requireRequiredFieldsKept`. Same four files → 4 suites, **86 passed**.

`775e52f4`: `docs/cli-reference.md`, `memory submit` and `memory amend` entries (marked Unreleased (v0.3)).

### refactor (developer)

Gates on `775e52f4` plus the uncommitted spec amendments (`npm run build` first):

| Command | Result |
|---|---|
| `npm run test:coverage` | exit 0; 200 suites / 3381 tests; 98.86 / 95.42 / 95.23 / 99.57 (main after B3, plan v1.8: 98.85 / 95.39 / 95.18 / 99.56) |
| `npm run -s lint` | exit 0 |
| `npm run -s docs:api` | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| `npx jest test/docs` | 3 suites / 7 tests passed |
| per-file coverage of `submit.ts`, `schema.ts`, `required-fields.ts` | 100 / 100 / 100 / 100 |

BDD: `P1.6-memory-submit.feature` has no scenario on required-field content and no AC asks for one;
none added.

### Pending amendments (approver)

Uncommitted in the worktree:
- `spec-001-memory-yaml-schema` — `--reason "task-168: dl-124 Action 2 — TemplateConfig.frontmatter gains not_applicable_allowed, a list of required fields that may hold the not-applicable value; each entry must be in required and never title. Revision note added."`
- `spec-010-memory-frontmatter-schema` — `--reason "task-168: dl-124 Action 2 — Validation rules gain the not-applicable row and the paragraph on the reserved value \"n/a — <reason>\" and how it is read; it applies to submit and to amend past the initial state. Revision note added."`
Both will need one more sentence once Q-A is ruled (the empty-list rule belongs in spec-010).
