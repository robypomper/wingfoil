---
id: "task-118-dna-scaffold-shows-the-technology-shape"
type: task
title: "The `init`-scaffolded `dna.yaml` shows the `{name, category}` shape of a technology"
status: approved
release: "v0.2.2"
priority: "low"
tags: ["v0.2.2", "init", "dna", "first-use"]
ref: "bug-139-dna-scaffold-hides-required-category"
bug: ["bug-139-dna-scaffold-hides-required-category"]
depends_on: []
tmpl_version: 260703
---

## Description

`wingfoil init` scaffolds `stacks.technologies: []` with no example of the required
`{name, category}` shape. A first edit therefore fails schema validation on a field the author never
knew about (`bug-139`). The scaffold is generated in `src/storage/templates.ts`. This closes
`bug-139`.

## Acceptance Criteria

1. The scaffolded `dna.yaml` shows the shape, as a comment or a commented-out example entry, with
   `category` visible. *Red-first:* a test asserts it on the scaffold's text.
2. Uncommenting the example as written gives a `dna.yaml` that validates. *Red-first.*
3. A freshly scaffolded project still validates unedited. *Characterization.*
4. `npm test` green.

## Execution Notes

### design (architect) — 2026-09-29

**`depends_on: []`** — no upstream task's Execution Notes to read (the `dl-015` gate is vacuous).
`bug: [bug-139-dna-scaffold-hides-required-category]`, so `bug.sync_state` moves bug-139 with this
task (`planned → in-progress` done at `start`, commit `889550e3`).

**Specs.** `grep -m1 '^status:'` → `spec-002-dna-yaml-schema: approved`,
`spec-011-storage-layout: approved`. Neither specifies the scaffold's text: `grep -n -i scaffold`
on spec-002 hits only its uniqueness note (line 300, names distinct across templates); spec-011's
hits are about `memory/templates/` and init detection. `P5.1.1-init.feature` only requires "a
complete `.wingfoil/` structure". No spec needs a revision note, no tech-spec is missing, so the
design approval is a pass-through. `grep -n -i "technolog" docs/user-guide.md docs/cli-reference.md`
→ neither quotes the scaffold text (they document `dna add stacks.technologies`), so no user doc
changes.

**Design.** Only `dnaYaml()` in `src/storage/templates.ts` changes. The active line stays
`technologies: []`, deliberately:
- dropping the key (schema-valid, `technologies` is `.optional()`) would make the first
  `dna add stacks.technologies` rewrite `dna.yaml` without its comments (`sed -n 468,469p docs/user-guide.md`,
  §11 Known limitations: the first entry of a collection `dna.yaml` does not contain yet rewrites it
  without its comments);
- an uncommented-in-place entry list under `technologies:` is impossible while `[]` stays (a
  `technologies:` key with only comments under it parses to `null`, which the schema refuses; a second
  `technologies:` key is a duplicate-key parse error).
So the scaffold carries, above `technologies: []`, a comment naming the `{name, category}` shape
(`category` required, free text) and a commented-out example **block** (`technologies:` + one entry
with `name` and `category`) that the comment says replaces the `technologies: []` line, plus the
`dna add … --entry-category` equivalent. "Uncommenting the example as written" (AC 2) is therefore
read as: strip the `# ` prefix from the example block and put it in place of the `technologies: []`
line, exactly as the scaffold's own comment instructs. **Flag for the approver:** this reading of AC 2
is a choice; the alternative (drop `technologies: []`) was rejected for the comment-loss reason above.

**AC classification (T1).**

| AC | Class | Why |
|---|---|---|
| 1 — scaffold shows the shape, `category` visible | red-first | `grep -n "category" src/storage/templates.ts` → no hit in `dnaYaml()` today |
| 2 — the uncommented example validates | red-first | there is no example to uncomment today, so the test cannot find it |
| 3 — a fresh scaffold validates unedited | characterization | already pinned by `test/storage/templates.test.ts` (bug-005 suite, `DnaYaml.safeParse`); extended to the real two-pass loader `loadDnaYaml` |
| 4 — `npm test` green | characterization | gate, run at refactor/review |

### red

Commit `213c9b16` adds a `task-118` suite to `test/storage/templates.test.ts`, run over every
registered template (`TEMPLATES`: Scrum, Kanban). `npx jest test/storage/templates.test.ts -t task-118`
→ **4 failed, 2 passed**: AC 1 fails on the missing `{name, category}` comment, AC 2 fails because
`  # technologies:` is not in the scaffold (a genuine red — nothing to uncomment); AC 3
(characterization) passes on first run, as classified. AC 2's test uncomments the example block
(strip `# `), puts it in place of `  technologies: []`, writes the result to a temp
`.wingfoil/dna.yaml` and loads it with `loadDnaYaml` (`src/core/loaders.ts`, the two-pass loader
`dna show` uses), expecting `[{name: TypeScript, category: language}]`.

### green

Commit `d8b4ab65`: `dnaYaml()` (`src/storage/templates.ts`) writes, above `technologies: []`, a comment
naming the `{name, category}` shape (`category` required, free text; `version`/`notes` optional), the
commented example block, and the `wingfoil dna add … --entry-category language` equivalent.
`npx jest test/storage/templates.test.ts` → 41 passed.

**End to end** (built `dist/cli.js`, throwaway `git init` under the session scratchpad):
- `wingfoil init` → exit `2`, `error: missing required argument: --template` (the message task-119
  owns); `wingfoil init --template Kanban` → exit `0`, one commit
  `chore(wingfoil): initialize .wingfoil/ with the Kanban template (P5.1.1)`; the `stacks:` block
  shows the comment + example as written above.
- `wingfoil dna show stacks` on the unedited scaffold → exit `0`, `"technologies": []`.
- Example uncommented in place of `technologies: []` (diff: `-  technologies: []` /
  `+  technologies:` / `+    - name: TypeScript` / `+      category: language`) → `dna show stacks`
  exit `0`, `[{"name": "TypeScript", "category": "language"}]`.
- From the unedited scaffold, the hint's own command `wingfoil dna add stacks.technologies --value
  TypeScript --entry-category language` → exit `0`, commit `wf(dna): add stacks.technologies
  TypeScript`, 1 file `+3 -1`; the comment block is kept (`grep -c '^ *#' .wingfoil/dna.yaml` → 13
  before and after) and the entry lands under `technologies:` below it.
- bug-139's own reproduction (bare `- name: TypeScript`) still fails, as the schema intends:
  `dna show stacks` → exit `1`, `E_VALIDATION stacks.technologies.0.category … expected string,
  received undefined` — the difference is that the scaffold now says so beforehand.

### refactor

Commit `3100d57f`: `npx tsc --noEmit` failed on the red test's helper (`TS2532`/`TS2322`, indexing a
`string[]` under `noUncheckedIndexedAccess`); rewritten with `slice`/`findIndex`. No `src/` refactor
needed.

Checks, after merging `main` (merge `fdc582f8`, brought `task-121` and `bug-160`; no `src/`/`test/`
overlap):
- `npx jest` → 152 suites, **2478 passed** (main's files: 2472; +6 = 3 tests × 2 templates).
- Coverage (`npx jest --coverage`), before (main's `templates.ts` + test) → after: statements
  98.66% (3392/3438) → 98.66% (3392/3438), branches 94.25% → 94.25%, functions 98.98% → 98.98%,
  lines 99.46% → 99.46% — unchanged, as expected: the change is template text, no new branch.
- `npm run lint` → exit 0; `npx tsc --noEmit` → exit 0; `npm run docs:api` → exit 0, no warning
  (no new public API).
- User docs: `grep -n -i technolog docs/user-guide.md docs/cli-reference.md` → neither quotes the
  scaffold, so nothing to align; `test/docs/` is in the green full run.

### review

- `tests.bdd`: `P5.1.1-init.feature` is exercised by `test/core/init-project.test.ts` and
  `test/cli/init-command.test.ts` → with `templates.test.ts` and `schema-uniqueness.test.ts`,
  `npx jest` on those four → 72 passed.
- AC 1 ✔ (red-first, `213c9b16` → `d8b4ab65`); AC 2 ✔ (red-first, same); AC 3 ✔ (characterization,
  now also through `loadDnaYaml`); AC 4 ✔ (`npx jest` 2478/2478).
- For the approver: AC 2's reading ("uncomment in place of `technologies: []`") is the design choice
  recorded above; no spec revision was needed (no spec defines the scaffold text).
