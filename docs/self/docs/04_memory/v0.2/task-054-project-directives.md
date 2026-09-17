---
id: "task-054-project-directives"
type: task
title: "Implement Project Directives (custom + built-in storage layout)"
status: in-review
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
   single flat `.wingfoil/directives/.gitkeep`. The two entries sit where the old one sat, so the
   list keeps its fixed order and its byte-identical output run to run (REQ-SYS-07).
   *(Corrected in the second pass: this originally added "so the list stays sorted". The list is not
   sorted and never was — see `refactor (second pass)` below.)*
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
Full suite `npx jest --maxWorkers=2` → **75 suites / 978 tests, all passing**. `npx tsc -p
tsconfig.build.json` exit 0.

The baseline at `8456f28` was re-measured (74 suites / 966 tests) in a throwaway clone rather than
quoted from memory, and the +12 reconciled per suite via `jest --json`:

| Suite | base → head | why |
|---|---|---|
| `test/core/project-directives.test.ts` | 0 → 10 | new suite (2 P3.5 cases + 3 `bug-018` cases, each × 2 write paths) |
| `test/storage/builtin-template-sources.test.ts` | 10 → 11 | the one added derivation-coverage case |
| `test/core/latency-budget-placement.test.ts` | 78 → 79 | **not mine to claim**: its `it.each` enumerates every file under `test/`, so adding any test file adds one case |

No other suite's count moved.

### refactor (developer)

Documentation only — no behaviour change (the suite count and results are identical before and after).
Four doc comments were corrected because the change invalidated what they asserted:

- `src/storage/layout.ts` — module header and `scaffoldFiles`: the skeleton's `directives/` is now a
  `{built-in,custom}` split; why two `.gitkeep`s rather than one (git tracks files, not directories,
  and P3.5 requires *both* subfolders tracked); why `built-in/` being an asset directory is what
  obliges the REQ-SEC-10 guard on this path; and why `workflows/{built-in,custom}` stays out (P4.17).
- `src/core/init.ts` — module header now states that BOTH write paths run the REQ-SEC-10 check over
  the array they are about to write, and `initWingfoilStorage`'s own comment documents its three
  guards, the `builtinTemplates` override, and the `dl-031` "schema validation, no digest" scope.
- `src/core/builtin-integrity.ts` — `verifyBuiltinTemplates`' "Callers (namely `initWingfoilProject`)"
  line was stale the moment guard 3 landed; it now names both callers and states the rule that
  generated them (every `initStorage` write path is one).
- `src/storage/templates.ts` — the module header claimed task-018 deferred the `directives/{built-in,
  custom}` split to `templateScaffold`; that is no longer where it exclusively lives.
  `builtinTemplateSources`' comment now records that both scaffolds flow through it.

**Gates, all observed in this worktree at this commit:**

| Check | Command | Result |
|---|---|---|
| `tests.passing` | `npx jest --maxWorkers=2` | **75 suites / 978 tests passed**, 0 failed |
| `tests.coverage(min: 80)` | `npx jest --coverage --maxWorkers=2` | **global 98.11% stmts / 89.70% branch / 98.33% funcs / 98.85% lines** |
| `docs.api.build` + `public-complete` | `npm run docs:api` | exit **0** |
| (build typecheck) | `npx tsc -p tsconfig.build.json` | exit **0** |
| `lint.clean` (`dl-034`) | `npx eslint .` | exit **0** |

Per-file coverage for the touched files: `src/storage/layout.ts` **100 / 100 / 100 / 100**;
`src/core/builtin-integrity.ts` **100 / 100 / 100 / 100**; `src/storage/templates.ts`
**100 / 95 / 100 / 100** (uncovered branch: line 457, the `sort` comparator's equal-paths arm,
pre-existing); `src/core/init.ts` **93.18 / 95 / 100 / 95.23** — the two uncovered lines, 117 and 192,
are the pre-existing `catch` → `coreErr({code: 'IO'})` arms of the two init functions, unchanged here.

### end-to-end verification (compiled CLI / compiled `dist`, not tests)

`npm run build`, then a fresh `git init` repo under the scratch dir.

**1. The real CLI, `wingfoil init` (`initWingfoilProject` path):**

```
$ node dist/cli.js init --template Scrum
{ "root": "…/e2e-init", "template": "Scrum", "files": [ ".wingfoil/directives/built-in/.gitkeep",
  ".wingfoil/directives/custom/architecture.md", … ] }
exit=0

$ ls -la .wingfoil/directives/
drwxrwxr-x 2 … built-in
drwxrwxr-x 2 … custom

$ git ls-files .wingfoil/directives
.wingfoil/directives/built-in/.gitkeep
.wingfoil/directives/custom/architecture.md
.wingfoil/directives/custom/code-quality.md
.wingfoil/directives/custom/code-review.md
.wingfoil/directives/custom/determinism.md
.wingfoil/directives/custom/doc-versioning.md
.wingfoil/directives/custom/documentation.md
.wingfoil/directives/custom/security-secrets.md
.wingfoil/directives/custom/security.md
.wingfoil/directives/custom/testing.md
.wingfoil/directives/custom/traceability.md

$ git status --porcelain --untracked-files=all
(empty)

$ git log --oneline
021603d chore(wingfoil): initialize .wingfoil/ with the Scrum template (P5.1.1)
```

`git ls-files` — not `ls` — is the proof: both subfolders hold entries in git's index, so a fresh
clone reconstructs them (REQ-SYS-01).

**2. The skeleton path (`initWingfoilStorage`), driven against compiled `dist/core`.** It has no CLI
surface — `src/core/init.ts`'s header says it is deliberately not registered in `CORE_MODULES` until a
verb exists — so it is exercised directly:

```
$ node -e "require('…/dist/core').initWingfoilStorage(process.cwd())"
{ "ok": true, "files": [ ".wingfoil/directives/built-in/.gitkeep",
  ".wingfoil/directives/custom/.gitkeep", ".wingfoil/dna.yaml", ".wingfoil/memory/.gitkeep",
  ".wingfoil/memory.yaml", ".wingfoil/workflows.yaml" ] }

$ git ls-files .wingfoil/directives
.wingfoil/directives/built-in/.gitkeep
.wingfoil/directives/custom/.gitkeep

$ git status --porcelain --untracked-files=all
(empty)
```

**3. The `bug-018` guard, same compiled build, fresh repo:**

```
$ node -e "…initWingfoilStorage(process.cwd(), [{name:'security', kind:'directive',
           content:'truncated, no frontmatter\n'}])"
{ "ok": false, "error": { "code": "VALIDATION",
  "message": "built-in directive template integrity check failed: security" } }
.wingfoil written? -> false
```

Before this task that same call returned `{ ok: true }` and wrote the scaffold (red evidence #3).

### review (developer side)

- `tests.bdd.passing` — the P3.5 acceptance suite and every suite bearing on the changed surface pass:
  `npx jest test/core/project-directives.test.ts test/directives/schema.test.ts
  test/storage/templates.test.ts test/storage/builtin-template-sources.test.ts test/core/init.test.ts
  test/core/init-project.test.ts` → **72 passed / 72 total**.
- Full suite at the submit commit: **75 suites / 978 tests passed**. Gates as tabled under `refactor`
  (eslint 0, tsc 0, `docs:api` 0, coverage 98.11% global).
- `bug.sync_state` — no-op: this task's `bug:` field is empty. `bug-018` is closed by hand afterwards,
  as its own notes and this task's AC state.

**Scope actually delivered, and what it is not.** P3.5's scenario 1 (storage layout) is met on both
init paths.

> **Both "already covered" claims that stood here were false, and the approver rejected the task for
> them (`8247503`).** They read: scenario 2 "already covered … by `test/storage/git-backed-storage.test.ts`
> [which] commits a `directives/custom/*.md` edit", and scenario 3 "already covered … by
> `src/directives/schema.ts` and `test/directives/schema.test.ts`". Both are corrected in place below
> rather than deleted, because a coverage claim that turned out to be wrong is itself worth leaving on
> the record. The two greps that settle it were re-run in this worktree, not taken on trust:
> `grep -rn "HEAD~\|HEAD^" test/` → **0**, and
> `grep -rn "invalid directive: missing required field" src/ test/` → **0** (the string occurs exactly
> once in the repository, in the feature file itself).

The failure mode behind both: I described what those files are *about* rather than what they
*execute*. `git-backed-storage.test.ts` is about directive files being versioned, and
`schema.test.ts` is about a missing `name` being rejected — but the first never edits an existing
file and the second never asserts a message.

**Scenario 2 — "A directive change is versioned" — was NOT covered; it is covered now.** The test I
cited (`test/storage/git-backed-storage.test.ts`, the P1.1 block) *creates* a directive file: it
asserts the porcelain status is exactly `?? .wingfoil/directives/custom/testing.md`, which is the
assertion that the path did **not** previously exist, then commits it. There is no edit, so neither
`Then` clause of scenario 2 was reachable from it — and the second clause, "the previous version is
retrievable from history", was unreachable from anywhere in the suite: no test read a prior revision
at all. Closed in this pass by a new `describe` block in the same file, "A directive change is
versioned (P3.5 scenario 2)" — details under `red (second pass)`.

**Scenario 3 — "Error - a directive file missing required header fields" — is HALF covered, and the
uncovered half is now `bug-025`.** `test/directives/schema.test.ts:49` does discharge the first
clause, "loading reports the file as invalid": `DirectiveFrontmatter` marks `name` required, so the
file fails and `wingfoil directives list` exits 1. The second clause, `And the message is "invalid
directive: missing required field 'name'"`, is **not implemented** — the real message is Zod's
generic text. Observed on the compiled CLI:

```
$ wingfoil directives list
error: E_VALIDATION name (/…/.wingfoil/directives/custom/no-direct-db-access.md): Invalid input: expected string, received undefined
exit=1
```

Not fixed here: emitting that string means editing `src/core/loaders.ts` / `src/directives/`, which
`task-050` (P3.1) and `task-053` (P3.4) hold concurrently. Filed instead as
**`bug-025-directive-validation-message-not-emitted`** (`open`, severity `low`, `feature: P3.5`,
`release: ""` — scheduling is `build-backlog`'s stamp per dl-016). That matters because `task-054` is
the **only** element in Memory carrying `ref: "P3.5"` (`grep -rln 'ref: *"\?P3\.5' docs/self/docs/04_memory/`
→ one file, this one), so an unimplemented clause left as prose in a done task's notes would have had
nothing scheduling it.

`src/directives/` was deliberately not opened — `task-050` and `task-053` are editing it concurrently.

**Files changed:** `src/storage/layout.ts`, `src/core/init.ts` (both behaviour), `src/storage/templates.ts`,
`src/core/builtin-integrity.ts` (both comments only), `test/core/project-directives.test.ts` (new),
`test/storage/builtin-template-sources.test.ts`. No change to `src/directives/`, `src/core/index.ts`,
`package.json`, or `jest.config.js`. *(Second pass adds `test/storage/git-backed-storage.test.ts`; the
file list is restated in full under `review (second pass)`.)*

---

## Second pass — rejected `8247503` (in-review → in-progress)

**What was NOT in question.** The approver's reject body and an independent reviewer both confirmed
the P3.5 scenario-1 code, the `bug-018` code and their tests are correct, and had mutation-tested the
symmetry pin from both sides (deleting guard 3 alone → 2 red; deleting guard 5 alone → 2 red; moving
guard 3 inside the `try` after `initStorage` → 2 red, killed by the `existsSync('.wingfoil') === false`
assertions). Every gate number reported in the first pass reproduced, including the +12 delta and its
`latency-budget-placement` explanation. **None of that code or those tests was touched in this pass.**

The rejection was about the two false coverage claims corrected above, plus the sortedness wording.

### red (second pass) — developer

**T1 classification — one AC, characterization, and it must pass on first run.** P3.5 scenario 2's
behaviour (git-backed versioning of a directive file) is not new: `writeDocument` + `commitPaths`
already do it, and `initStorage` has been committing directive files since task-018. What was missing
was an assertion, not a capability. Per dl-014/T1 and the `testing` directive, a characterization AC
is exempt from `red`'s failing-test requirement, and **no red was fabricated** — no production line
was changed for this test, and none was needed.

Added to `test/storage/git-backed-storage.test.ts`: `describe('A directive change is versioned (P3.5
scenario 2)')`, which starts from an already-tracked `directives/custom/no-direct-db-access.md`, edits
it, commits, and then asserts

- `git status --porcelain` is exactly `` ` M <path>\n` `` **before** the commit — the assertion that
  the file pre-existed this edit (`??` untracked and `A ` added both fail it) — compared untrimmed so
  porcelain's two-column `XY` code stays positional: `X` is index status, `Y` is worktree status, so
  ` M` (worktree-modified) is told apart from `M ` (index-modified) by column, not by counting the
  spaces that survive a trim;
  <br>*(Corrected in the third pass. This originally read "trimming it away would let an added-file
  (`A `) or untracked (`??`) result pass". False — see `third pass` below.)*
- exactly one new commit, touching exactly that one path, tree clean afterwards;
- `git show HEAD:<path>` is the new content;
- **`git show HEAD~1:<path>` is the prior content** — the second `Then` clause, asserted directly
  rather than inferred from the commit succeeding. This is the first `HEAD~`/`HEAD^` read in the
  entire suite.

**It passed on the first run of the final assertion set, as a characterization test should.** One
honest wrinkle: the first execution failed, and the failure was in *my assertion*, not in the
behaviour — I had written `` `M  ${rel}` `` (staged-modification, two columns) against a `.trim()`ed
porcelain string, and git reports an unstaged edit as `` ` M ` ``. Fixing the expectation to the
untrimmed, correct form made it green with no production change. Recorded rather than quietly
rewritten, because "it went red once" should not be mistaken for red-first evidence: it was a test
bug, and the versioning behaviour under test never changed.

**Non-vacuity check.** A passing characterization test earns less trust than a failing one, so the key
assertion was mutated: changing `git show HEAD~1:<path>` to expect the *new* content makes the test
fail (`1 failed, 5 passed`), and restoring it returns 6/6. The history read is doing real work.

### refactor (second pass) — developer

**The sortedness claim was false; corrected in two places.** `scaffoldFiles()` is not lexically
sorted, and my first-pass refactor asserted it was. Verified empirically rather than by eye:

```
scaffoldFiles is lexically sorted?   false
templateScaffold is lexically sorted? true
```

The single inversion is `.wingfoil/memory/.gitkeep` before `.wingfoil/memory.yaml`: `'.'` (0x2E)
sorts before `'/'` (0x2F), so a real sort puts `memory.yaml` first. Determinism is unaffected —
REQ-SYS-07 needs the order *fixed*, which a hand-written literal is, not *sorted* — so the code is
right and only the prose was wrong.

- `src/storage/templates.ts` — "returns a path-sorted list — **as does `scaffoldFiles`**" was my
  addition and is the one outright false clause; the surrounding claim about `templateScaffold` was
  pre-existing and is true. Rewritten to say the derivation needs the caller's order *reproducible*,
  not sorted, and to name why each of the two callers qualifies.
- `src/storage/layout.ts` — "in a fixed lexical order" was **inherited from task-018**, not written by
  me, but it is false by the same argument and I carried it forward unexamined. Rewritten to "a fixed,
  hand-written order", with the `0x2E`/`0x2F` reason spelled out and an explicit warning not to
  "fix" it by sorting.
- The green-phase note above ("the list stays sorted") was corrected in place.

`src/storage/templates.ts:16` and `:411` also say "sorted by path", but both refer to
`templateScaffold` only, which genuinely sorts — left alone.

**`dl-031`'s Actions item (a) is already discharged — nothing is handed on.** Amending REQ-SEC-10's
title and Description to say *schema-checked* was done by `9d74d80` ("docs: implement dl-031 —
REQ-SEC-10 is a schema check, not an integrity check", 2026-09-14), which is an ancestor of this
branch's start point `d933cbe` (`git merge-base --is-ancestor 9d74d80 d933cbe` → exit 0). On this
branch `docs/02_requirements/03_sard/05_security-compliance.md:98-101` reads:

```
### REQ-SEC-10 — Schema checks on built-in templates

* **Description:** Built-in directive and workflow templates are schema-checked before installation during
  `init`.
```

and its `Traceability` line carries the scoping sentence too ("Scoped to schema validation by
`dl-031-req-sec-10-integrity-depth`"). So the SARD already says what `dl-031` decided, and this task
neither needed to change it nor leaves it outstanding.

> *[Third pass. Where this paragraph now stands, the second pass asserted the exact opposite — that
> the amendment "remains **undone**" — and repeated it in the hand-off list. It was false, and it was
> checkable in one `sed -n '98,101p'`. Worse, the branch already contradicted it twice:
> `src/core/builtin-integrity.ts:8` (inherited from `task-044`) says dl-031 "**retitled** the
> requirement", past tense, and that module's opening line already quotes the NEW title; and this
> task's own `design` note cites dl-031's ratified scope correctly. I read the decision and its
> consequence, then asserted the state of the file without opening the file — the same root cause this
> task names for itself two sections above, in the pass whose purpose was to stop doing it.]*

### review (second pass) — developer

All five `refactor` gates re-run in this worktree at the submit commit:

| Check | Command | Result |
|---|---|---|
| `tests.passing` | `npx jest --maxWorkers=2` | **75 suites / 979 tests passed**, 0 failed |
| `tests.coverage(min: 80)` | `npx jest --coverage --maxWorkers=2` | **global 98.11% stmts / 89.70% branch / 98.33% funcs / 98.85% lines** |
| `docs.api.build` + `public-complete` | `npm run docs:api` | exit **0** |
| (build typecheck) | `npx tsc -p tsconfig.build.json` | exit **0** |
| `lint.clean` (`dl-034`) | `npx eslint .` | exit **0** |

**978 → 979, +1, and the delta is its own consistency check.** The one new test went into an
*existing* file, so — unlike the first pass — `test/core/latency-budget-placement.test.ts` did **not**
move (still 79): its `it.each` enumerates files under `test/`, not tests. `test/storage/git-backed-storage.test.ts`
went 5 → 6. No other suite changed.

Per-file coverage for the touched files is unchanged from the first pass: `src/storage/layout.ts`
**100 / 100 / 100 / 100**; `src/core/builtin-integrity.ts` **100 / 100 / 100 / 100**;
`src/storage/templates.ts` **100 / 95 / 100 / 100**; `src/core/init.ts` **93.18 / 95 / 100 / 95.23**.
Two line numbers shifted because comments grew — `templates.ts`'s uncovered branch is now reported at
**459** (was 457) and is still the same line, `files.sort((a, b) => …)`'s equal-paths arm; `init.ts`'s
117 and 192 are unmoved and are still the two pre-existing `catch → coreErr({code: 'IO'})` arms. This
pass changed no production behaviour, so no coverage number moved.

**Files changed across BOTH passes, in full:**

| File | Change |
|---|---|
| `src/storage/layout.ts` | behaviour (pass 1: the split) + comments (pass 2: order wording) |
| `src/core/init.ts` | behaviour (pass 1: guard 3 + override) |
| `src/storage/templates.ts` | comments only (both passes) |
| `src/core/builtin-integrity.ts` | comments only (pass 1) |
| `test/core/project-directives.test.ts` | new (pass 1) |
| `test/storage/builtin-template-sources.test.ts` | one added case (pass 1) |
| `test/storage/git-backed-storage.test.ts` | one added `describe` (pass 2) |
| `docs/self/docs/04_memory/bugs/bug-025-…md` | new element (pass 2) |

Still untouched: `src/directives/`, `src/core/index.ts`, `package.json`, `jest.config.js`. No merge
run; worktree and branch left in place.

**Open items this task hands on, as elements rather than prose:**

- `bug-018-init-storage-bypasses-integrity-guard` — closed in code here, still `triaged`; closed by
  hand (no `bug:` back-reference, so `bug.sync_state` is a no-op).
- `bug-025-directive-validation-message-not-emitted` — `open`, filed in this pass, unscheduled.

That is the whole list — two items. A third bullet claiming `dl-031`'s REQ-SEC-10 amendment was still
outstanding was removed in the third pass: it was already done before this branch existed
(`9d74d80`), so listing it inflated the hand-off with work nobody owes.

---

## Third pass — rejected `527fefa` (in-review → in-progress)

**Not reopened.** The reviewer re-verified the whole second pass and it held: byte-identity of the
protected material (`git diff --exit-code 8ac9452..HEAD` on the three files, exit 0), every gate
number, all three greps, `bug-025`'s two-commit discipline and its CLI output reproduced after a
rebuild, and the sorting-comment provenance confirmed by `git log -S` (`layout.ts`'s wording from
task-018's `7892282`, mine from `3d2f6a3`). They also probed the scenario-2 test harder than I had —
deleting the `Given` pre-commit so the file is newly created makes it fail on `ls-files` with
`Received: ""` — so it genuinely cannot pass on a created file. No code and no test logic changed in
this pass; two prose corrections only, plus the comment stating one of them.

**Both defects were the same one, and it is the one this task had already diagnosed for itself:
asserting the state of a file without opening the file.**

### 1. The `dl-031` claim was false (corrected above, under `refactor (second pass)`)

I wrote that dl-031's Actions item (a) — retitling REQ-SEC-10 to *schema-checked* — "remains undone",
and listed it as handed on. It was done on 2026-09-14 by `9d74d80`, before this branch started.
Verified this pass by opening the file and by ancestry, not from the reject message:

```
$ sed -n '98,101p' docs/02_requirements/03_sard/05_security-compliance.md
### REQ-SEC-10 — Schema checks on built-in templates

* **Description:** Built-in directive and workflow templates are schema-checked before installation during
  `init`.

$ git merge-base --is-ancestor 9d74d80 d933cbe && echo ancestor
ancestor
```

The aggravating detail is that the branch already told me twice. `src/core/builtin-integrity.ts:8`
says dl-031 "retitled the requirement" — past tense — and line 2 of that same module quotes the new
title verbatim. My own `design` note cites dl-031's ratified scope correctly. I had the decision and
its consequence in hand and still described the SARD's contents from memory.

### 2. The untrimmed-porcelain justification was false (corrected above, under `red (second pass)`)

The assertion itself is correct and stays exactly as written — the reviewer verified it. Only my
stated reason was wrong: I claimed trimming "would let an added-file (`A `) or untracked (`??`)
result pass". Measured in a scratch repo, all four states:

| state | raw porcelain | trimmed |
|---|---|---|
| untracked | `?? d/` | `?? d/` |
| staged add | `A  d/f.md` | `A  d/f.md` |
| unstaged modification (what the test expects) | `` ` M d/f.md` `` | `M d/f.md` |
| staged modification | `M  d/f.md` | `M  d/f.md` |

Against the trimmed expectation `M d/f.md`, every other row is still unequal — including staged
modification, which differs by an internal double space. So trimming would have rejected all three;
the protection I claimed was never at stake.

What untrimmed actually buys is that porcelain's two-column `XY` code stays **positional** — `X` index
status, `Y` worktree status — so ` M` and `M ` are read by column instead of by counting leftover
spaces. That is legibility, and it is not nothing: the ambiguity is exactly what produced this line's
first, wrong expectation of `M  ` for a file that was never staged. Both the note and the test comment
now say that, and neither claims strictness the comparison does not have.

### The mechanical guard, adopted

Before any sentence asserting that something is done, undone, covered or uncovered: run the command
that settles it, and put the command in the note. Pass two applied this to three greps and all three
claims were correct; the two claims that were not checked are the two that were false. Every state
claim in this pass carries its command — the two greps above, `sed -n '98,101p'`,
`git merge-base --is-ancestor`, and the four-row porcelain table.

### Confirming gate run (third pass)

No behaviour changed in this pass — one test *comment* and the notes — so every number is expected to
be, and is, identical to the second pass:

| Check | Command | Result |
|---|---|---|
| `tests.passing` | `npx jest --maxWorkers=2` | **75 suites / 979 tests passed**, 0 failed |
| `tests.coverage(min: 80)` | `npx jest --coverage --maxWorkers=2` | **global 98.11% stmts / 89.70% branch / 98.33% funcs / 98.85% lines** |
| `docs.api.build` + `public-complete` | `npm run docs:api` | exit **0** |
| (build typecheck) | `npx tsc -p tsconfig.build.json` | exit **0** |
| `lint.clean` (`dl-034`) | `npx eslint .` | exit **0** |

Per-file coverage for the touched files also unmoved: `src/storage/layout.ts` and
`src/core/builtin-integrity.ts` 100/100/100/100; `src/storage/templates.ts` 100/95/100/100 (line 459,
the `files.sort` equal-paths arm); `src/core/init.ts` 93.18/95/100/95.23 (lines 117, 192, the
pre-existing `IO` catch arms).

**Files changed in the third pass:** `test/storage/git-backed-storage.test.ts` (comment only — the
assertion is byte-identical) and this task's Memory file. Nothing else.
