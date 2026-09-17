---
id: "task-054-project-directives"
type: task
title: "Implement Project Directives (custom + built-in storage layout)"
status: in-progress
release: "v0.2"
priority: "Critical"
tags: ["v0.2", "p3"]
ref: "P3.5"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

As Morgan, deliver feature **P3.5** (US-4-03): the directive storage layout (`built-in/` + `custom/`) exists after init and is git-tracked.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p3-directives/P3.5-project-directives.feature`.

Key scenario: `.wingfoil/directives/` contains `built-in/` and `custom/`, both git-tracked.


**`bug-018` — close the guard-5 bypass this task's own change opens.** `scaffoldFiles()`
(`src/storage/layout.ts`) currently emits a flat `.wingfoil/directives/.gitkeep`. Satisfying this
task's AC means it will emit `directives/built-in/` — and `initWingfoilStorage` writes that scaffold
via `initStorage(root)` at `src/core/init.ts:75` **without guard 5**, unlike `initWingfoilProject`
which derives sources and verifies at lines 143-150.

Nothing escapes today, because `builtinSourceOf` excludes dotfiles and `.gitkeep` is one. But after
this task the `built-in/` directory exists on a write path that checks nothing, and the only thing
standing between that and an unchecked built-in asset is that nobody has put a non-dotfile there yet.
`task-044`'s reviewer named this exact scenario: *"if a future task ever put a built-in asset into the
minimal skeleton it would reproduce the shape task-044 was rejected for"*. This is that task.

Close it here rather than leaving it: `builtinTemplateSources` is already generic over
`ScaffoldFile[]`, so running the same derivation plus `verifyBuiltinTemplates` over `scaffoldFiles()`
in `initWingfoilStorage` is roughly one line. Pair it with a test asserting **both** write paths check,
so the symmetry is pinned rather than re-derived. `bug-018` needs closing by hand afterwards — it
carries no `bug:` back-reference from this task, so `bug.sync_state` will not advance it.
## Implementation Notes

Layout per `spec-011`. Core of the Directives pillar.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### design (architect)

**`agent.read_related` (`dl-015`)** — `depends_on: []`, so there is nothing to read; the gate is a
no-op for this task.

**`agent.verify_specs`** — no missing artefact, `design` passes through with no approval gate:

- `spec-011-storage-layout` (`approved`) already specifies the `directives/{built-in,custom}` split
  and states that `built-in/` holds "only `.gitkeep` (empty)" today. That is the layout contract this
  task realizes in the scaffold; nothing to add.
- `spec-013-directive-frontmatter-schema` (`approved`) covers directive file contents — not touched
  here (the split is about directories, and `task-064` already made the generated `custom/*.md`
  frontmatter schema-valid).
- `dl-031-req-sec-10-integrity-depth` (`ready`) fixes the depth of the `bug-018` guard: schema
  validation **is** the REQ-SEC-10 contract. No digest, no manifest, no checksum is in scope.

**`agent.classify_acs` (T1)** — state of the two write paths as actually read in
`src/storage/layout.ts`, `src/storage/templates.ts` and `src/core/init.ts` at `8456f28`:

| # | Acceptance criterion | Path | Class | Evidence |
|---|---|---|---|---|
| A1 | `.wingfoil/directives/` contains `built-in/` **and** `custom/` after `wingfoil init` | `initWingfoilProject` → `templateScaffold` | **characterization** | `templateScaffold` already emits `directives/built-in/.gitkeep` + ten `directives/custom/*.md`; asserted by `test/storage/templates.test.ts` "creates the directives built-in/custom split (spec-011)" |
| A2 | …and on the minimal skeleton path too | `initWingfoilStorage` → `scaffoldFiles` | **red-first** | `scaffoldFiles()` emits a single flat `.wingfoil/directives/.gitkeep` — no split at all |
| A3 | both subfolders are **tracked by git** (BDD `And both are tracked by git`) | both | **red-first** | no test anywhere runs `git ls-files` over `.wingfoil/directives/`; `test/storage/templates.test.ts` asserts the in-memory `ScaffoldFile[]` path list only, and `test/core/init-project.test.ts` asserts `existsSync` only |
| A4 | `bug-018` — both write paths run the REQ-SEC-10 built-in integrity guard before writing | `initWingfoilStorage` | **red-first** | `src/core/init.ts:75` calls `initStorage(root)` with no guard; only `initWingfoilProject` (lines 142-146) derives sources and calls `verifyBuiltinTemplates` |

A1 is exempt from `red`'s failing-test requirement (plan §3.3); A2/A3/A4 must fail first.

**Why A4 has to land in this task.** A2 is what arms it: once `scaffoldFiles()` emits
`.wingfoil/directives/built-in/`, the minimal skeleton owns a built-in asset directory on a write path
that checks nothing. Today nothing escapes only because `builtinSourceOf` (`src/storage/templates.ts`)
returns `null` for any basename starting with `.`, and `.gitkeep` is the only thing in there. That is a
fact about the current *content*, not a guarantee — exactly the shape `task-044` was rejected for, and
the one `bug-018`'s reporter predicted.

**Design decisions:**

1. `scaffoldFiles()` replaces `directives/.gitkeep` with `directives/built-in/.gitkeep` +
   `directives/custom/.gitkeep`. Two placeholders, because git tracks files, not directories — the BDD
   "both are tracked by git" clause is only satisfiable via a tracked entry inside each.
2. Scope held to the **directives** split. `workflows/{built-in,custom}` stays out of the minimal
   skeleton: that is P4.17 ground, and `scaffoldFiles()` is deliberately the P1.1 skeleton, not the
   full spec-011 layout (which `templateScaffold` already provides).
3. `initWingfoilStorage` computes `scaffoldFiles()` **once**, runs the same
   `builtinTemplateSources` → `verifyBuiltinTemplates` derivation `initWingfoilProject` runs, and
   passes that same array to `initStorage`. Deriving from the array that is about to be written is the
   property that makes "installed but unchecked" unrepresentable; re-calling `scaffoldFiles()` for the
   write would reintroduce the drift by the back door.
4. Guard order mirrors `initWingfoilProject`: git-repo → git identity → REQ-SEC-10. `verifyBuiltinTemplates`
   is pure and touches no disk, so running it before the write satisfies REQ-SEC-10's "before writing
   partial assets" ordering.
5. `initWingfoilStorage` gains the same optional test-only `builtinTemplates` override
   `initWingfoilProject` already carries, so the symmetry can be exercised through both public entry
   points by one shared table rather than asserted twice in different shapes.

### red (developer)

Two files, both driving the production entry points (no test-only reimplementation of the layout):

- **`test/core/project-directives.test.ts`** (new) — the P3.5 BDD scenario "Directive storage layout
  exists after init", plus the `bug-018` guard, each asserted as a `describe.each` table over
  **both** write paths. Git tracking is checked with `git ls-files .wingfoil/directives` (plus
  `git status --porcelain --untracked-files=all` empty), because `existsSync` cannot discharge the
  BDD's `And both are tracked by git`.
- **`test/storage/builtin-template-sources.test.ts`** — one added case extending the existing
  "total coverage of the real scaffold" property from `templateScaffold` to `scaffoldFiles()`.

**Observed red — `npx jest test/core/project-directives.test.ts test/storage/builtin-template-sources.test.ts`:
2 suites failed, 5 tests failed / 16 passed (21 total).** The five:

1. `P3.5 … initWingfoilStorage › creates .wingfoil/directives/ with a built-in/ and a custom/ subfolder`
   — `existsSync(.wingfoil/directives/built-in)` `Expected: true / Received: false`.
2. `P3.5 … initWingfoilStorage › tracks BOTH subfolders in git` — no tracked path starts with
   `.wingfoil/directives/built-in/`.
3. `bug-018 … initWingfoilStorage › aborts with a VALIDATION error naming the failing template` —
   `Received: {"ok": true}`: the corrupted source list was accepted and the scaffold written.
4. `bug-018 … initWingfoilStorage › fails closed on an unrecognized built-in kind` — same `{"ok": true}`.
5. `builtinTemplateSources … scaffoldFiles` — `builtinPathsOf(scaffoldFiles()).length`
   `Expected: > 0 / Received: 0`.

**T1 correction from the observed run.** Every `initWingfoilProject` row in both tables passed
unchanged, including the git-tracking one. So A3 is red-first on the **skeleton** path only; on the
`wingfoil init` path it was already true, just never asserted — characterization, like A1. A2 and A4
are red-first as classified. No fabricated red was needed anywhere.

### green (developer)

Two production edits, nothing else:

1. **`src/storage/layout.ts`** — `scaffoldFiles()` now returns
   `.wingfoil/directives/built-in/.gitkeep` + `.wingfoil/directives/custom/.gitkeep` in place of the
   single flat `.wingfoil/directives/.gitkeep`. Lexical ordering is preserved
   (`directives/built-in/… < directives/custom/… < dna.yaml`), so the list stays sorted and
   byte-identical run to run (REQ-SYS-07).
2. **`src/core/init.ts`** — `initWingfoilStorage` gains guard 3 (REQ-SEC-10) and the optional
   `builtinTemplates` override. It binds `const files = scaffoldFiles()` **once**, derives
   `builtinTemplateSources(files)`, calls `verifyBuiltinTemplates`, returns a `VALIDATION` `coreErr`
   on failure, and then passes *that same array* to `initStorage(root, files)`. The previous code
   called `scaffoldFiles()` twice (once implicitly as `initStorage`'s default parameter, once to
   report `value.files`); binding it once is what makes the checked set and the written set the same
   array rather than two independently recomputed lists.

Guard order matches `initWingfoilProject` — git-repo, then identity, then REQ-SEC-10 — so the
`not a git repository` message still wins over everything else.

**Observed after green:** `npx jest test/core/project-directives.test.ts
test/storage/builtin-template-sources.test.ts` → 2 suites passed, 21 tests passed.
Full suite `npx jest --maxWorkers=2` → **75 suites / 978 tests, all passing** (baseline at `8456f28`
was 74 suites / 966 tests; +1 suite, +12 tests). `npx tsc -p tsconfig.build.json` exit 0.
