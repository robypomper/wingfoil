---
id: "task-097-memory-history-reads-each-commit-at-its-historical-path"
type: task
title: "Read each commit at the path the element had *then*, so a renamed element's transitions stop reporting null states — and stop leaking git's `fatal:` to the operator while doing it"
status: in-review
release: "v0.2"
priority: "high"
tags: ["v0.2", "memory", "history"]
ref: "bug-080-read-status-at-reads-the-current-path-at-pre-rename-commits"
bug: ["bug-080-read-status-at-reads-the-current-path-at-pre-rename-commits", "bug-071-read-status-at-leaks-git-stderr"]
depends_on: []
tmpl_version: 260703
---

## Description

`reconstructMemoryTransitions` (`src/memory/history.ts`) walks an element's commits with
rename-following, so it *finds* the commits that precede a rename. `readStatusAt`
(`src/memory/audit.ts`) then reads each one with `git show <sha>:<currentPath>` — the path the element
has **now**. At any commit older than a rename the element did not live there, the read fails, and the
transition is reported with `from` and `to` as `null`.

This is live in this repository. `a353c12` renamed five `release` elements from
`planning/v1/` to `planning/rl-v1/`, and every pre-rename transition of all five reports null states.
It defeats **P1.10** for any renamed element, and renames are not exotic here: a Memory type whose
`path` interpolates an id renames every element under it when that id changes.

`bug-071` is the same function's other half — `execFileSync` without an `stdio` option, so git's
`fatal: path '<doc>' exists on disk, but not in '<sha>'` goes straight to the operator's terminal on
every run. It is scheduled here rather than separately because a fix for `bug-080` removes the
*occasion* for that message without removing the *leak*: the moment some other commit legitimately
lacks the file, it returns. Close both, and close them deliberately.

## Acceptance Criteria

**AC1 — the historical path reaches the read.** `git log --follow --name-status` already reports each
rename edge (`R100 <old> <new>`). Thread the path each commit actually used into `readStatusAt`
instead of passing the current one. The walk is the source of truth for "where was this file at this
commit"; `readStatusAt` must stop guessing.

**AC2 — the five live cases report real states.** `minor-v0.1`, and the other four `release` elements
renamed by `a353c12`, report a non-null `from`/`to` for every transition that has one. Pin this with a
test that runs against a **fixture repository containing a rename**, not against this repository —
`bug-075` means the CLI cannot be aimed at our own Memory, and a test that depends on our history
breaks the day someone rewrites it.

**AC3 — a commit where the file genuinely does not exist is still handled.** Before the element's
first commit, or on a branch where it was never added, there is no content to read. That is a
legitimate `null`, distinct from the defect. The test must cover both so a future reader can tell them
apart.

**AC4 — `bug-071`: no git output reaches the operator's stderr.** Give `execFileSync` an explicit
`stdio` and handle the failure in code. Pin it with a test asserting the child's stderr is captured
rather than inherited. Do not rely on AC1 having removed the message.

**AC5 — exit codes unchanged.** `memory history` exits 0 on a clean walk today and must continue to;
`spec-005` §1 governs anything else.

## Implementation Notes

- `dl-080` is `ready`: a read that gates an operation resolves at `HEAD`. This read gates nothing — it
  reconstructs history, and its whole subject is *other* commits — so `dl-080` does not apply here.
  Say so in the Execution Notes rather than leaving a reviewer to wonder whether it was overlooked.
- Classify each AC per `dl-014`/T1 before writing anything. AC2 and AC4 are **red-first** (the
  behaviour is wrong today). AC3 and AC5 are likely **characterization**. Do not fabricate a red.
- `bug-071` is `low` and `bug-080` is `high`; they close together, and the commit that closes them
  should say which change closed which.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). -->

### start — role: developer

`status: backlog → in-progress` (`aada4b9`). `bug:` names two, so `bug.sync_state` ran as its own
commit: `bug-080` and `bug-071` both `planned → in-progress` (`dc1bb5b`).

Worktree `/home/robypomper/Workspaces/.wf2-wt/task-097`, branch
`task/task-097-memory-history-reads-each-commit-at-its-historical-path`, from `main` at `02b77f97`.
`node_modules/` was absent in the worktree; `npm ci` → exit 0, 341 entries.

### design — role: architect

Directives loaded: architecture, determinism, traceability (architect); code-quality, testing,
determinism (developer); doc-versioning, documentation, security-secrets (global).

#### `read_related` (`dl-015`, HARD gate)

`depends_on: []` — nothing to acknowledge. The task's `ref`/`bug` elements
(`bug-080-read-status-at-reads-the-current-path-at-pre-rename-commits`,
`bug-071-read-status-at-leaks-git-stderr`) were both read in full, including `bug-071`'s
**Correction (2026-09-22)**, which says the bug "stays open … explicitly **downstream of `bug-077`**
and not to be worked independently". `bug-077` is closed (`task-089`), so that precondition is met.

One deliberate divergence from `bug-080`'s own Notes, which say "When this is fixed, `bug-071` should
be closed as absorbed rather than worked." The task file overrides that and it is right to: AC4 says
"Do not rely on AC1 having removed the message." AC1 removes the *occasion* for the `fatal:` in the
rename case, not the leak — the `stdio` option is still missing, and the next commit that
legitimately lacks the document brings the line straight back. Both were therefore worked, and each
is pinned by its own test.

#### `dl-080` — why it does not apply here (asked for explicitly)

`dl-080` (`ready`) holds that a read which **gates an operation** resolves at `HEAD`. This read gates
nothing: `readStatusAt` is called from `reconstructMemoryTransitions`, whose product is a report and
whose whole subject is *other* commits. Resolving it at `HEAD` is not merely unnecessary here, it is
the defect — reading every commit at the `HEAD` path is literally what `bug-080` is. `dl-080` was
read and consciously found inapplicable; it was not overlooked. Recorded per the Implementation Note.

#### `verify_specs`

`memory history` is specified by `spec-006-core-domain-api` §3 (the `memory` operation table) and
`spec-008-cli-grammar`; the behaviour under repair is the BDD contract of
`docs/02_requirements/02_bdd/features/p1-memory/P1.10-memory-history.feature` ("author, ISO-8601
timestamp, state change, and reason" per entry). This task restores an existing contract and defines
no new user-facing surface, so **no new `tech-spec` is scaffolded** and `design` passes through.

#### T1 — per-AC classification (`dl-014`, `testing` directive)

| AC | Classification | Why |
|----|----------------|-----|
| **AC1** the historical path reaches the read | **red-first** | The plumbing does not exist; `MemoryHistoryEntry` had no `path` field and no probe produced one. Its behaviour is observable only through AC2/AC3, plus the two direct unit tests on the new helpers. |
| **AC2** pre-rename transitions report real states | **red-first** | Wrong today — reproduced below. |
| **AC3** a genuinely absent document is still `null` | **characterization** | `readStatusAt` already returned `null` on any `git show` failure; the no-frontmatter half of the pair passed on first run, before any source change (see red output — 1 passed, 5 failed). Pinned so the legitimate `null` stays distinguishable from the defect. |
| **AC4** no git output on the operator's stderr | **red-first** | Leaks today — reproduced below, with the exact `fatal:` lines. |
| **AC5** exit codes unchanged | **characterization** | `0` today and after. Pinned twice: the new out-of-process test asserts `[status, stderr] === [0, '']` on a clean walk, and `test/cli/history-scaffold-phantom.integration.test.ts` already asserts the same through the real `dist/cli.js` (that suite passes unchanged). |

No red was fabricated and no dead code was added to force one.

### red — role: developer (`1c284df8`)

`test/memory/history-rename-path.test.ts`. The fixture is a **throwaway repository built by the
test** — four commits: create under `docs/04_memory/planning/v1/minor-v0.1.md`, transition there,
`git mv` to `docs/04_memory/planning/rl-v1/minor-v0.1.md` in its own commit, transition again. It
reproduces the *shape* of `a353c12` (whose rename of five `release` elements is the live case) rather
than reading this repository's history, per AC2: `bug-075` keeps the CLI off our Memory, and a test
reading our commits breaks when they are rewritten. The document is authored in place, not copied
from a template, so `findElementCreationSha` finds no copy edge and `task-089`'s truncation is not
entangled with this fixture.

`npx jest test/memory/history-rename-path.test.ts` on the unmodified source:

```
Tests:       5 failed, 1 passed, 6 total
● reconstructMemoryTransitions across a rename (bug-080, AC2) › reports real states for the transitions that predate the rename
● reconstructMemoryTransitions across a rename (bug-080, AC2) › leaves no transition with an unreadable state once the element has been created
● a commit where the document genuinely does not exist (AC3) › reports null there, and only there — the legitimate null is distinguishable from the defect
● bug-071 — git writes to a pipe this process owns, never to the operator (AC4) › prints nothing on stderr even when a commit in the walk legitimately has no document
● bug-071 — git writes to a pipe this process owns, never to the operator (AC4) › prints nothing on stderr on a clean walk either (AC5 — the exit status is unchanged too)
```

The two defects are visible separately in that run. `bug-080`:

```
- Expected  - 2        + Received  + 2
    Array [
-   "draft",           +   null,
-   "planning",        +   null,
      "planning", "in-development", null,
```

`bug-071` (the child process's own stderr, at exit `0`):

```
    Array [ 0,
-   "",
+   "fatal: path 'docs/04_memory/planning/rl-v1/minor-v0.1.md' exists on disk, but not in 'a63ff3f…'
+ fatal: path 'docs/04_memory/planning/rl-v1/minor-v0.1.md' exists on disk, but not in 'fc3e34a…'",
```

The one AC3 case that passed on first run is the characterization one ("still reports null when the
document exists at the commit but carries no frontmatter").

**Why AC4's test spawns a child process.** Nothing in-process can observe the leak: `execFileSync`
hands the grandchild *this* process's fd 2, and jest neither captures nor fails on what lands there —
which is why `bug-071` survived a year of green suites, and the same blind spot `bug-070` records for
the two CLI helpers that return a hardcoded `stderr: ''`. The test therefore runs
`reconstructMemoryTransitions` in a `spawnSync`'d node process against the compiled
`dist/memory/audit.js` (built once by jest's `globalSetup`, `bug-003`) and reads the child's stderr.
It also asserts the returned states, so the assertion cannot pass by never reaching the failing read:
the trailing `null` **is** the handled `fatal:`.

### green — role: developer (`2e3b40b9`)

Which change closed which bug:

- **`bug-080` (high) — closed by the path threading.** `MemoryHistoryEntry` gains a
  `path` field: the root-relative path the element occupied *at that commit*.
  `collectHistoricalPaths` (`src/memory/history.ts`) runs a third `git log --follow --name-status
  --format=%H` probe and maps sha → the **last** tab-separated field of that commit's status line
  (the destination of `R<score> <old> <new>`, the single path otherwise); `attachHistoricalPaths`
  (pure) stamps it onto each walked entry; `getMemoryHistory` composes the two before
  `dropPreCreationAncestry`. `reconstructMemoryTransitions` then calls `readStatusAt(root, entry.sha,
  entry.path)` instead of passing its own argument. The walk is now the source of truth for "where
  was this file at this commit", as AC1 requires.
- **`bug-071` (low) — closed by the `stdio` option.** `readStatusAt`'s `execFileSync` gets
  `stdio: ['ignore', 'pipe', 'pipe']`, so git's `fatal:` lands in a pipe this process owns and the
  failure is handled where it is already caught. Independent of the above: it is still reached
  whenever a commit in the walk genuinely has no document (AC3), which AC4's first test exercises.

A separate probe rather than `--name-status` on the existing walk, for the reason `task-086` and
`task-089` both record: `walkGitLogFields` recovers records by **field arity** over `<field>NUL`
groups, so anything git appends outside the `--format` string would be read as the next record's
first field. The existing `CREATION_PROBE_ARGS` is a second invocation for exactly this reason; this
is the third.

Two smaller decisions worth a reviewer's eye:

1. **`collectHistoricalPaths` throws on a git failure**, mirroring `findElementCreationSha`: "git
   could not answer" and "this element was never renamed" are different answers, and folding the
   first into the second reinstates `bug-080` silently. `attachHistoricalPaths`, by contrast, **falls
   back** to the caller's path for a sha the probe reported no diff for (git shows no diff for a
   merge commit without `-m`) — that is not evidence of a broken walk, and the fallback is exactly
   the behaviour that shipped before this field existed, so it cannot degrade below the status quo.
   Both rules are tested directly, the fallback on the pure function rather than through a fixture.
2. **The new probe carries the same `stdio`.** Writing a fresh `execFileSync` without it, in the same
   pass that closes `bug-071`, would reopen the bug on a new call — and did: the first green run
   printed `fatal: not a git repository` from the new probe into the jest output. Caught by running
   the suite and reading it, fixed before this commit.

Sentences I made stale and therefore fixed in the same pass:

- `src/memory/audit.ts` — the "Known limitation" paragraph on `reconstructMemoryTransitions`,
  which described the defect as live.
- `src/core/index.ts` — `MemoryHistoryEntryView`'s "`to` is `null` only in the documented rename edge
  case", now "only when the commit genuinely has no document to read".
- `test/cli/history-scaffold-phantom.integration.test.ts` — the AC7 comment stating "It is NOT fixed:
  `readStatusAt` still asks for the current path at pre-rename commits". `task-089` was right to
  write it; it is no longer true.
- `test/memory/history-scaffold-copy.test.ts` — the two `MemoryHistoryEntry` literals gain `path`
  (mechanical; the field is required, and `test/**` is type-checked by `tsconfig.json` even though
  jest does not type-check it).

### refactor — role: developer: gates

Run in this worktree after merging `main` (`99fb235d`) in at `f32dafe1` (`dl-035`: merge, never
rebase).

| Gate | Command | Result |
|---|---|---|
| unit + BDD | `npx jest` | **123 suites / 1920 tests, all passing** |
| coverage ≥80, non-regressing | `npx jest --coverage` | **98.76 % stmts · 93.64 % branches · 98.90 % funcs · 99.25 % lines** (all files). `src/memory/history.ts` **100 / 100 / 100 / 100**; `src/memory/audit.ts` 98.55 stmts |
| typecheck (build, no emit) | `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| typecheck (build, **emitting**) | `npx tsc -p tsconfig.build.json` | exit 0 |
| typecheck (full, `test/**` included) | `npx tsc --noEmit -p tsconfig.json` | exit 0, **no output** (`bug-026`'s exception is still absent) |
| lint | `npm run lint` | exit 0, no findings |
| API docs | `npm run docs:api` | exit 0, no warnings |

**Shared-file note for the orchestrator** (the brief asks for this explicitly). This branch touches
two files other wave-4 branches also touch:

- `src/core/index.ts` — **doc comment only**, three lines inside `MemoryHistoryEntryView`'s TSDoc
  (around the `from`/`to` paragraph). **No import line changed, no symbol added or removed.**
- `src/memory/index.ts` — **not touched at all.** `MemoryHistoryEntry` is already exported from the
  barrel and gained a field, not a new name; `collectHistoricalPaths` and `attachHistoricalPaths` are
  deliberately exported from `src/memory/history.ts` only, like the existing `findElementCreationSha`
  and `dropPreCreationAncestry`, and imported by their tests from that module path. So `task-095`'s
  barrel edits and this branch cannot collide.

The one place a semantic (clean-merge) conflict could hide is a branch that constructs a
`MemoryHistoryEntry` literal, since `path` is now required — `npx tsc --noEmit -p tsconfig.json`
catches it, and it is only type-checked there (jest does not type-check `test/**`).

`determinism` (REQ-SYS-07): the new probe reads no clock, sorts nothing by chance, and its output is
a pure function of the repository. `security-secrets`: nothing added reads or writes credentials; the
`-c core.quotePath=false` is passed for the single invocation and never written to the repository's
config.
