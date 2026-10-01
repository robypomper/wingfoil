---
id: "task-137-read-pillar-configuration-memory-documents-any-commit-not"
type: task
title: "Read the pillar configuration and the Memory documents at any commit, not only at `HEAD` or in the working tree"
status: in-progress
release: "v0.3"
kind: "feature"
priority: "high"
tags: ["v0.3", "agent", "context", "determinism", "storage"]
ref: "spec-012"
bug: []
depends_on: []
tmpl_version: 260703
---

## Description

`spec-012` §2 pins a context to `stateRef`, a commit sha, and `spec-016` §2.4 has the MCP Prompt resolve "at the pinned `state`, not the working tree". The agent commits while it runs, so `state` is an older commit than the `HEAD` of the moment the Prompt is fetched. Today only `…AtHead` readers exist, and nothing lists or reads Memory documents at a revision. This task adds `…AtRev(root, rev)` for DNA, `memory.yaml`, directives and roles. The existing `…AtHead` functions are kept as `rev = 'HEAD'`. It also adds a Memory scan at a revision (`listMemoryDocumentPathsAtRev`, a document summary at rev, and a by-type-and-id lookup at rev), so `task-176` can build the whole context from one commit.

## Acceptance Criteria

- (characterization) Every existing `…AtHead` loader still passes its current suite unchanged after it is re-expressed through `…AtRev(root, 'HEAD')`.
- (red-first) `loadDnaYamlAtRev`, `loadMemoryYamlAtRev`, `loadDirectivesAtRev` and `loadRolesYamlAtRev` return the content committed at a given older sha. They ignore a later commit and a dirty working tree (fixture repo with two commits and an uncommitted edit).
- (red-first) The Memory scan at a revision lists and parses exactly the element documents committed at `rev`, in the same sorted order as `listMemoryDocumentPaths`. A document added after `rev`, or present only in the working tree, is absent. Its by-id lookup returns the frontmatter and body as of `rev`.
- (red-first) An unknown or malformed `rev` fails with a `CoreError` that names the rev. It does not return an empty result: an empty result would hand a wrong context to an agent.
- (characterization) No wall-clock, randomness or unordered iteration appears in these paths (REQ-SYS-07). Two calls with the same `(root, rev)` are deep-equal.

## Implementation Notes

- **Size:** M · **wave:** 1 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** spec-012 §2 (`stateRef`), §8; spec-016 §3.3 step 7; adr-012 point 3.
- **Features:** P5.4.4, P5.4.3.
- **Notes:** Proposal key: B01. touches `src/core/loaders.ts`, `src/memory/query.ts` (or a sibling), and `src/storage/commit.ts` if a batched reader is needed. **Possible overlap with domain A/C:** `spec-017` §1.1 deduction reads Memory at `HEAD` and needs the same scan. Whichever task lands first owns the primitive, and the other one depends on it.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

Branch `task/task-137-read-pillar-configuration-memory-documents-any-commit-not`, worktree
`../.wf2-wt/task-137`, cut from `main` at `5b885fd5`; start commit `abc7b366` (`[backlog → in-progress]`).
`bug: []`, so there is no bug to sync.

### design (architect)

**`depends_on` read (dl-015).** `depends_on: []`. The batch note names `task-136` (`done`, merged):
it rewrote `loadWorkflowsYaml` to collect every finding into one ordered `diagnostics` array and throw
a `DiagnosticsError` (`src/core/loaders.ts`, `src/core/workflow-diagnostics.ts`). A workflows reader at
a revision must keep that contract byte for byte, so it shares the loader body rather than copying it.

**Specs.** `spec-012` and `spec-016`/`spec-017` are `approved`, `adr-012` `accepted`
(`awk '/^status:/{print $2;exit}'` on each). `spec-012` §2 types `stateRef` as a commit sha and §8 makes
`build(req)` a pure function of it; `spec-016` §3.3 step 7 assembles at `state_ref = HEAD` and its run
record (§4, field 14) stores the **full sha**; `spec-017` §1.1 reads everything "as committed at
`HEAD`", §1.3 enumerates Memory "from `HEAD`'s tree in sorted path order, never by directory listing
order", §1.4 keeps per-document failures local to deduction, §2 adds no loader code. None of them
fixes a function signature for the reader, so no spec is missing or needs revision; the shape below is
this task's, recorded for its consumers.

**The primitive (the "whichever lands first owns it" note).** This task lands first, so it owns it.
`task-198` (`depends_on` this task), `task-194` and `task-176` build on it:

- `resolveRevision(root, rev) → sha` (`src/core/revision.ts`). Resolves `rev` once to the full 40-hex
  sha of a commit (`git rev-parse --verify --quiet <rev>^{commit}`). A rev that is empty, starts with
  `-`, or holds whitespace, a control byte, `:` or `..` is **malformed** → `RevisionError` with
  `code: 'VALIDATION'`; a well-formed rev that names no commit (unknown name, unborn `HEAD`, a tree or
  blob) → `code: 'NOT_FOUND'`. Both name the rev in the message and carry `details: { rev }`.
  `RevisionError` is a thrown `Error` that *is* a `CoreError` (`code`, `message`, `details`) and gives
  the plain value through `toCoreError()`, so a core function returns it with `coreErr(...)`. Never an
  empty result.
- Every `…AtRev(root, rev)` resolves the rev **once**, then reads every byte at that sha, so one call
  cannot mix two commits even if a ref moves while it runs. Error labels keep the rev **as given**
  (`HEAD:.wingfoil/dna.yaml`), which keeps the `…AtHead` messages unchanged.
- Config: `loadDnaYamlAtRev`, `loadMemoryYamlAtRev`, `loadRolesYamlAtRev` (`T | null` — `null` when the
  commit does not hold the file), `loadDirectivesAtRev` (array), and `loadWorkflowsYamlAtRev` — not
  named by the ACs, added because `spec-017` §1.1 needs `workflows.yaml` and its includes at `HEAD`
  and the batch note asks for the diagnostics contract at a commit. The working-tree and the revision
  workflows loaders run one body over a byte source, so they cannot drift.
- `…AtHead(root)` is `…AtRev(root, 'HEAD')`, except that an **unresolvable** `HEAD` (no commits, or no
  repository) keeps its old answer — `null`, or `[]` for directives — which is what their suites pin
  (`test/core/loaders.test.ts` "returns null while dna.yaml is untracked", in a repository with no
  commit). A malformed rev cannot reach them: `'HEAD'` is a constant.
- Memory (`src/memory/query.ts`): `listMemoryDocumentPathsAtRev(root, rev, memoryYaml)` (the same
  `computeMemoryContentRoots` scan roots, listed with `listPathsAtRev`, `.md` only, sorted with the
  comparator `listMemoryDocumentPaths` uses), `loadMemoryDocumentSummaryAtRev(root, rev, path)` (`null`
  when the commit does not hold the path), `loadMemoryDocumentsAtRev(root, rev, memoryYaml)` (list +
  parse, the snapshot `task-198`/`task-176` need) and `findMemoryDocumentByTypeAndIdAtRev(root, rev,
  memoryYaml, type, id)`. The parse is the one `loadMemoryDocumentSummary` uses (lifted, not copied),
  so `task-171`'s tolerant read changes both baselines at once. The caller passes the `memoryYaml` it
  loaded at the same rev; a caller that needs a fixed commit across several calls resolves the sha
  first and passes it.
- Batched read (`src/storage/commit.ts`, `readPathsAtRev`): one `git cat-file --batch` process for a
  list of paths. Measured on this repository's 664 Memory/plan documents at `HEAD`: one `git show` per
  file `5.49 s`, one batch `0.39 s` (`time` over both loops, design session). A failed batch throws
  `StorageError(E_GIT_READ_FAILED)`: a read that fails must not pass for "absent".
- Determinism: no clock, no randomness; every list is sorted explicitly; nothing is cached between
  calls. Reading at a commit touches neither the working tree nor the index (`git rev-parse`,
  `ls-tree`, `cat-file`, `show` only).

**AC classification (T1, `testing` directive).**

| AC | Class | Why |
|---|---|---|
| 1 — `…AtHead` suites unchanged through `…AtRev(root, 'HEAD')` | characterization | the behaviour exists; the existing suites must pass untouched |
| 2 — the four config `…AtRev` loaders read an older sha, ignore a later commit and a dirty tree | red-first | no `…AtRev` exists (`grep -rn "AtRev" src/core/loaders.ts` → only `readPathAtRev`/`listPathsAtRev` imports) |
| 3 — Memory scan + by-id lookup at a rev | red-first | nothing lists or reads Memory at a revision (`grep -n "AtRev" src/memory/query.ts` → nothing) |
| 4 — unknown/malformed rev → `CoreError` naming the rev | red-first | `readPathAtRev` answers `null` for an unknown rev today, which is the empty result the AC forbids |
| 5 — determinism, two calls deep-equal | characterization | holds by construction once AC 2–3 exist; pinned with a test that passes on first run |

`loadWorkflowsYamlAtRev` and `readPathsAtRev` are tested red-first with AC 2 (they do not exist).

### red (developer)

`21a1723e` adds three suites: `test/core/loaders-at-rev.test.ts` (AC 2, 4, 5; the workflows
diagnostics contract), `test/memory/query-at-rev.test.ts` (AC 3, 4, 5), `test/storage/read-paths-at-rev.test.ts`
(the batched reader and the resolver). `npx jest test/core/loaders-at-rev.test.ts
test/memory/query-at-rev.test.ts test/storage/read-paths-at-rev.test.ts` → **3 suites failed, 5 tests
failed**: the two first suites fail to run (`Cannot find module '../../src/core/revision'`), the storage
suite's 5 tests fail with `readPathsAtRev is not a function` / `resolveCommitAtRev`. Each is the
missing function, not a fixture fault.

### green (developer)

`eada94ce`: `src/storage/commit.ts` (`resolveCommitAtRev`, `readPathsAtRev`), `src/core/revision.ts`
(new), `src/core/loaders.ts` (five `…AtRev`, the `…AtHead` re-expressed through `atHeadOr`, the
workflows loader split into `loadWorkflowsFrom` over a `WorkflowSource`), `src/memory/query.ts` (four
readers; `parseMemoryDocument` lifted out of `loadMemoryDocumentSummary`), the three barrels. Three
deviations from the design, all on the way to green:

- **A directory is `null` in the batch.** The first green run failed one storage assertion:
  `readPathAtRev(<rev>, 'dir')` returns `git show`'s tree listing, the batch returns `null`. The batch
  is right (a listing is no file's content), so the test now compares the two on files and absent
  paths only and pins the directory case separately, and the TSDoc says so. Committed with the green.
- **Directives keep one `readPathAtRev` per file.** The full suite then failed
  `test/core/directive-inventory-baseline.test.ts` "a listed blob that cannot be read back is skipped",
  which spies `storage.readPathAtRev` by name. AC 1 says the existing suites pass unchanged, and a
  project holds a handful of directives, so `loadDirectivesAtRev` reads them one by one; the Memory
  scan, where the count is in the hundreds, uses the batch.
- `loadMemoryDocumentSummaryAtRev` returns `null` for a path the commit does not hold (the working-tree
  `loadMemoryDocumentSummary` throws `ENOENT`): at a commit, absence is an answer.

### refactor (developer)

`19b4f797`. Coverage first came back below `main` (functions 93.74 against 94.44): the eight new
re-exports of `src/core/index.ts` were never read through the barrel, and four new branches could not
be reached. Changes:

- `listPathsAtCommit` (`src/core/revision.ts`): a `null` listing of a sha `resolveRevision` has just
  resolved now throws `StorageError(E_GIT_READ_FAILED)` instead of being read as `[]` (the empty answer
  AC 4 forbids). Used by `loadDirectivesAtRev` and the Memory scan; pinned by a spy test in each suite.
- The Memory readers parse through one lazy generator (`parseMemoryDocumentsAtSha`), so
  `findMemoryDocumentByTypeAndIdAtRev` stops at its match as the working-tree lookup does, and the
  unreachable `undefined` branch is gone. `resolveCommitAtRev` drops a redundant sha regex.
- New tests: the barrels export every reader; `readPathsAtRev` fails loudly when `git` cannot be
  spawned (`{ env: { PATH: '' } }`).

| Gate | Result |
|---|---|
| `npx jest --coverage` (worktree, `19b4f797`) | 180 suites / 3018 tests passed; 98.83 / 95.07 / 94.72 / 99.54 (stmts / branches / funcs / lines) |
| the same on `main` `5b885fd5`, temporary detached worktree | 177 suites / 2969 tests; 98.82 / 95.06 / 94.44 / 99.52 — no regression |
| new files | `revision.ts` 28/28 stmts, 16/16 branches, 6/6 funcs; `query.ts` 134/134 stmts, 26/26 funcs; `commit.ts` 63/64 stmts, 16/16 funcs |
| `npm run lint` | exit 0 |
| `npm run docs:api` | exit 0, 0 warning lines (`grep -ci warning`) |
| `npx tsc --noEmit -p tsconfig.json` / `npx tsc -p tsconfig.build.json --noEmit` | exit 0 / exit 0 |

Uncovered new branches, both defensive: `commit.ts:297` (a batch answer that ends before its header —
git exited 0, so it cannot happen) and the unused side of the workflows reader's `[raw = null]`
default (`loaders.ts:327`).

BDD: `P5.4.3-context-preloading.feature` and `P5.4.4-execution-context.feature` describe context
assembly, not the reader; no suite under `test/` runs them (`grep -rln "P5.4.4\|P5.4.3" test` →
nothing). They belong to `task-176`, which builds the context on these readers.

### review (reviewer)

| AC | Status | Evidence |
|---|---|---|
| 1 — `…AtHead` suites unchanged | met | `git diff --stat 5b885fd5 HEAD -- test/` lists only the three new suites; the full suite passes (180/180) |
| 2 — four config `…AtRev` at an older sha, blind to a later commit and a dirty tree | met | `loaders-at-rev.test.ts` "…committed at the older sha" ×4 (+ workflows), fixture with two commits and an uncommitted edit |
| 3 — Memory scan + by-id at a rev | met | `query-at-rev.test.ts`: order equals `listMemoryDocumentPaths`' filtered to the commit; later-added and working-tree-only documents absent; by-id returns status/body as of the rev |
| 4 — unknown/malformed rev → `CoreError` naming it | met | `RevisionError` `NOT_FOUND` / `VALIDATION`, message holds `JSON.stringify(rev)`, `toCoreError()` → `{code, message, details: {rev}}`; checked on all nine readers |
| 5 — determinism | met | deep-equal tests in both suites; `grep -nE "Date\.now\|new Date\|Math\.random"` over the four source files → nothing; every list sorted explicitly |

Reading at a commit leaves the tree alone: both suites compare `git status --porcelain` before and
after.

**For the dependants (`task-198`, `task-194`, `task-176`).** Resolve once with `resolveRevision(root,
'HEAD')`, then pass the sha to every reader so they all see one commit; feed the Memory readers the
`memoryYaml` from `loadMemoryYamlAtRev` at the same sha. Parse failures still throw
(`ValidationError`), as in the working tree: `spec-017` §1.4's tolerant read is `task-171`'s, through
`parseMemoryDocument`, which both baselines share. A symlink committed under a scan root is listed as a
blob and read as its target path; the working-tree scan follows it instead (not changed here, reported).

No spec edit, no pending amendment.
