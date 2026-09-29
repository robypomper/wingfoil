---
id: "task-111-configuration-moves-to-the-repository-root"
type: task
title: "The configuration moves to the repository root, so the Memory verbs run on this repository's own Memory"
status: in-review
release: "v0.2.2"
priority: "high"
tags: ["v0.2.2", "config", "dogfooding", "memory"]
ref: "bug-075-memory-verbs-cannot-read-this-repos-own-memory"
bug: ["bug-075-memory-verbs-cannot-read-this-repos-own-memory"]
depends_on: ["task-109-transition-brackets-accept-the-ascii-arrow", "task-110-memory-add-keeps-version-dots-and-sources-every-id-token"]
tmpl_version: 260703
---

## Description

The Memory verbs shipped in v0.2 cannot be pointed at this repository's Memory. The configuration
lives under `docs/self/.wingfoil/`, while the CLI resolves it from the git root, and running from
`docs/self/` is refused as not-at-git-root (`bug-075`). So every operation on WingFoil's own Memory
is still done by hand.

The retrospective chose the remedy and its timing (`retrospective-rel-v0.2-plan` §6.8 step 2). The
configuration moves to the repository root, as the patch's first structural step, so v0.2.2 and v0.3
both write Memory at the new location and nothing has to be migrated twice. **v0.3 may start once
this task is on `main`** (the `dl-092` parallel-release rule). This closes `bug-075`.

## Acceptance Criteria

1. `docs/self/.wingfoil/` becomes `.wingfoil/` at the root, and `docs/self/docs/04_memory/` becomes
   `docs/04_memory/`. Both move with `git mv`, so that `wingfoil memory history --follow` keeps each
   element's history across the move. That is checked on at least one element of each type.
2. At the root, with the build under development, `wingfoil memory history <id>` and
   `wingfoil memory search` answer on this repository's own Memory. The `wf()` transitions come back,
   in both arrow forms (`task-109`). *Red-first* (today they fail).
3. Every test that loads the real configuration loads it from the root. Before: 32 test files cite
   `docs/self` (`grep -rl "docs/self" test/ | wc -l` on 2026-09-29). After the task, the same command
   returns 0, unless a remaining hit is justified in Execution Notes.
4. Durable citations of moved paths are updated in the Memory documents and plans that cite them
   (206 files under `docs/self/docs/04_memory/` cite `docs/self` on 2026-09-29). Historical quotes,
   such as commit subjects or text quoted verbatim, stay as written.
5. The comments and README that describe the config root are corrected: `memory.yaml`'s
   "resolved against the docs/self/ dogfooding root", and `.wingfoil/README.md`. `CLAUDE.md` §3, §5
   and §5.1 get only the path corrections that keep them true. Their full realignment belongs to the
   `user-docs` phase's `align-agent-docs` step (`dl-025`).
6. The non-configuration files under `docs/self/` (`X_wingfoil-init-plan.md`, `WORKFLOW.md`, and any
   others `ls docs/self` shows) are each either moved or left with a pointer. Every choice is listed
   in Execution Notes.
7. `npm test` green; coverage not regressing; `tsc --noEmit` clean.

## Implementation Notes

- The move is large. Land it as one reviewable change, with the rename commits separate from the
  content edits, so the review can check that the renames are pure (`git diff -M --stat`).
- Check `.gitignore` and `package.json` `files` (today `["dist", "README.md"]`), so the root
  `.wingfoil/` and `docs/04_memory/` never enter the tarball.
- The pinned released build (`task-112`) does not exist yet. Verify with the build under development,
  and say so in Execution Notes.

## Execution Notes

Branch `task/task-111-configuration-moves-to-the-repository-root`, worktree `../.wf2-wt/task-111`,
cut from `main` at `a0f15fd7`. The configuration was still under `docs/self/`, so every Memory
transition of this task was written by hand in the §5.1 format.

### design (architect)

**`depends_on` read (dl-015).** `task-109` and `task-110` are `done`
(`grep -m1 '^status:'` on both). What this task takes from them:
- `task-109`: `BRACKET_RE` reads `->` and `→`, but `memory history` never reads the bracket — it derives
  `from`/`to` from frontmatter at each commit. So AC 2's "both arrow forms" is about *subjects* that
  carry either arrow coming back with the right states, not about a parser this task touches.
- `task-110`: its AC 6 e2e found that this repository's `memory.yaml` `template.file` values carry a
  `.wingfoil/` prefix, so `memory add` fails here on every type. That is `bug-156` (now `planned`,
  owned by `task-123`, which depends on this task). **Not fixed here:** the eight `file:` values are
  unchanged (`git diff a0f15fd7 HEAD -- .wingfoil/memory.yaml | grep '^[-+].*file:'` → nothing).
  After the move `memory add` still fails, measured in a scratch clone of this branch:
  `wingfoil memory add --type bug --title "scratch probe"` → `error: cannot read the scaffold for
  memory type 'bug': '.wingfoil/.wingfoil/memory/templates/bug.md' is not committed at HEAD` (exit 1).

**Specs.** No tech-spec defines where *this repository's* configuration lives beyond `spec-011`
(scoped to `docs/self/.wingfoil/`) and `spec-007` §1 (the scan's self-hosted analog). Both, plus one
sentence each in `spec-002` and `spec-003`, are made false by the move, so they are amended in place
with a dated revision note (the `spec-001` precedent `dl-041` cites) — **pending the approver's
sign-off** at review, like `task-110`'s `spec-008` §10. No new spec is scaffolded.

**Design.**
- Rename first, content after: `git mv` in commits of their own, so `git diff -M --stat` shows R100
  only and `git log --follow` crosses the move.
- The CLI needs no code change to read this repository: it resolves `.wingfoil/` at the git root and
  `memory.yaml`'s `path` patterns (`docs/04_memory/...`) against the same root. The one `src/` value
  tied to the old layout is `SCAN_SURFACE_ROOTS` (`src/validation/secret-scan.ts`), which named the
  nested copies; it becomes `['.wingfoil', 'docs/04_memory']`.
- Citation policy (AC 4): a path given so a reader can open a file is rewritten; a historical record
  is kept as written — fenced transcripts, command and commit-subject code spans (also when a span
  wraps to the next line), verbatim quotations, any line anchored to a commit sha (the old path is
  what resolves at that sha), and sentences that describe the nested layout or the move itself.
  Applied by a throwaway script (session scratchpad), then reviewed line by line on the diff.

**AC classification (T1).**

| AC | Class | Why |
|---|---|---|
| 1 — `git mv`, history followed | characterization | git's rename following; checked per type below, no code |
| 2 — `history`/`search` answer at the root | **red-first** | today both exit 1 on ENOENT `.wingfoil/memory.yaml` |
| 3 — tests load the root config | characterization (refactor) | the same assertions, new path; they go red only as a consequence of the rename |
| 4 — durable citations | documentation | no behaviour |
| 5 — config comments, README, CLAUDE.md paths | documentation | no behaviour |
| 6 — non-config files under `docs/self/` | documentation | a decision per file |
| 7 — suite, coverage, `tsc` | verification | gates below |

### red (developer) — `b48b3a36`

`test/cli/own-memory.integration.test.ts`: `dist/cli.js` with `cwd` = the repository root runs
`memory history bug-077-history-follow-attributes-template-commits --format json` and
`memory search --type bug` / `memory search history-follow-attributes-template-commits`. `bug-077`
is `closed`, its trail carries `[in-progress → in-review]` and `[in-review -> resolved -> closed]`,
and its creation predates the move. Assertions name states and subjects, never shas; in a shallow
checkout the trail assertions are replaced by a non-empty check (the `reason-trailer.test.ts`
pattern). `npx jest test/cli/own-memory.integration.test.ts` before the move → **2 failed**, both on
`{"error":"ENOENT: no such file or directory, open '<worktree>/.wingfoil/memory.yaml'"}`.

### green (developer)

- `16fd0f02` — `git mv docs/self/.wingfoil .wingfoil` and `git mv docs/self/docs/04_memory
  docs/04_memory`: `git show -M --name-status --format= 16fd0f02 | cut -f1 | sort | uniq -c` →
  `493 R100`, `--stat` → `0 insertions(+), 0 deletions(-)`.
- `9607b451` — `docs/self/WORKFLOW.md` → `.wingfoil/WORKFLOW.md`,
  `docs/self/X_wingfoil-init-plan.md` → `docs/05_plans/X_wingfoil-init-plan.md`: 2 × R100.
- `cc776699` — `task-123` (added on `main` while this ran, see review) → `docs/04_memory/v0.2.2/`: R100.
- After `16fd0f02` alone, `npx jest test/cli/own-memory.integration.test.ts` → **2 passed**; the full
  suite → 15 suites failed (`Tests: 12 failed, 2241 passed`), every one a suite that joined
  `docs/self` to load the real configuration.
- `3513ecc5` — `SCAN_SURFACE_ROOTS` → `['.wingfoil', 'docs/04_memory']`. Measured on the built
  `dist/validation`: `scanProjectSurface('.', {surfaceRoots: ['.wingfoil','docs/self/.wingfoil','docs/self/docs/04_memory']}).filesScanned`
  → **50** after the move (below the REQ-SEC-08 guard's `> 100` floor), with the new default → **495**.
- `ba66b7c9` — the tests join `.wingfoil` at the root; the npm-distribution test also asserts
  `docs/04_memory` is not packed.

**AC 1 — `memory history` follows every type across the move.** Command, at the branch head:
`node dist/cli.js memory history <id> --format json`, compared with
`git log --format=%H a0f15fd7 -- docs/self/<path> | wc -l` (the commits the element had at the old
path, no `--follow`). Every entry list starts at the element's `add`, before the move:

| type | id | entries | at old path | first entry |
|---|---|---|---|---|
| release-line | `rl-v1` | 8 | 6 | add → draft, 2026-07-03 |
| release | `minor-v0.1` | 7 | 1 | add → draft, 2026-07-03 (crosses the earlier `planning/v1` → `rl-v1` rename too) |
| task | `task-054-project-directives` | 20 | 18 | add → draft, 2026-07-08 |
| task | `task-123-template-paths-are-relative-to-the-config-root` | 4 | 0 | add → draft, 2026-09-29 (born on `main` at the old path, moved after the merge) |
| adr | `adr-001-git-backed-storage` | 5 | 3 | add → draft, 2026-07-04 |
| decision-log | `dl-013-documentation-process-gate` | 6 | 4 | add → draft, 2026-07-04 |
| tech-spec | `spec-001-memory-yaml-schema` | 9 | 7 | add → draft, 2026-07-04 |
| bug | `bug-077-history-follow-attributes-template-commits` | 8 | 7 | add → draft, 2026-09-22 |

The difference is the move commit (every element) plus the citation commit where it touched the
file. `plan` does not move: its `path` is `docs/05_plans/{scope}/{id}.md` at the root, and this task
edits plans in place. Note for P1.10: the move commit is itself an entry of every element's history
(`operation: null`, `from` = `to`); that is what the command is specified to list, every commit that
touches the document.

Scratch-clone probe of the transition verbs (a `git clone` of this branch in the session scratchpad,
deleted after): `memory deprecate bug-077-… --reason …` → exit 0, commit
`wf(bug): deprecate … [closed → deprecated]`; `memory approve dl-061-dev-loop-reject-bug-sync
--reason …` → exit 0, `[in-discussion → ready]` with the `Approver:` line. Nothing was written to
this branch; the probe only shows the verbs reach this repository's Memory now.

### refactor (developer)

Content commits, each separate from the renames:
- `082ac762` — config comments: `memory.yaml` (the "resolved against the docs/self/ dogfooding root"
  comment), `.wingfoil/README.md` (why it lived under `docs/self/`, what the move changed, `bug-156`;
  layout table gains `WORKFLOW.md`; Memory-paths note), `dna.yaml` `paths.governance`,
  `user-docs.yaml` `produces:`, the `security-secrets` directive, the `tech-spec` template example,
  `WORKFLOW.md`, two workflow NOTE comments. No config-file `version:` bumped: comment and path
  corrections never were (`ceda51d9`, `d3de4419` edited `memory.yaml` without a bump).
- `33f47dd1` — Memory and plan citations (policy in design). No plan `version:` bumped, as in
  `a353c125` (the `planning/v1` → `rl-v1` rename's path corrections).
- `1dbc96e4` — `spec-002`, `spec-003`, `spec-007`, `spec-011`: paths plus the sentences the move made
  false, each with a revision note. `spec-011`'s note records a pre-existing gap it does not close:
  `find .wingfoil -maxdepth 4 -type f` lists `memory/templates/plan.md`,
  `workflows/custom/user-docs.yaml` and `workflows/custom/e2e-smoke.yaml`, which its tree does not.
- `20f4af0a` — `CLAUDE.md` path corrections in §1, §2, §3, §5, §5.1, §6 and §10 (only what keeps them
  true), `README.md`'s dogfooding line, `COLLABORATION.md`'s links (`**Version:** 1.0 → 1.1`).

**AC 3 — tests.** `grep -rl "docs/self" test/ | wc -l`: **33** at `a0f15fd7` → **0**. Four more
files built the path only as `join(…, 'docs', 'self', …)` and escaped that grep (`license-file`,
`dna/edit`, `memory/element-schema`, `storage/git-root`); `grep -rn "'docs', 'self'" test/` now finds
one line, `test/storage/git-root.test.ts:26`, a synthetic nested directory inside a temp
repository that proves the git-root refusal — not the real configuration; kept. `src/` has no
`docs/self` left (`grep -rn docs/self src | wc -l` → 0).

**AC 4 — Memory and plans.** `grep -rl "docs/self" <memory dir> | wc -l`: **212** files at
`a0f15fd7` (`git grep -l docs/self a0f15fd7 -- docs/self/docs/04_memory | wc -l`) → **126** under
`docs/04_memory`; occurrences 594 → 294 (`grep -ro`). Plans: 22 → 18 files. What remains is
historical, classified by the script's own report over `docs/04_memory` (lines): 92 in fenced
transcripts, 88 in command or commit-subject code spans, 15 in commands wrapping to a second line,
35 anchored to a sha, 3 verbatim quotations, 34 in lines excluded as statements about the nested
layout or the move (all of `bug-075`, this task's own Description and ACs, `rl-v1`/`patch-v0.2.2`'s
scope lines, the v0.2.2 plans' §2–§3, …), plus bare `docs/self/` layout statements (`task-032`,
`task-045`, `task-068`, …). Two lines in live elements now state a layout that no longer holds and
are left to their owners (see review).

**AC 5 — left for `align-agent-docs` (`dl-025`).** `CLAUDE.md` §3 still says the Memory-transition
verbs "do not exist yet" (they ship, and the scratch probe above reaches this repository); §5.1
does not say whether WingFoil's own Memory is now operated through the verbs or still by hand; §1's
status line (`minor-v0.2` `in-development`) is stale; `.wingfoil/README.md`'s heading "Why it lives
here and is hand-authored" and `initial-design.yaml` / `wingfoil-init.yaml`'s NOTE that the CLI "is
not yet usable" predate v0.2. None of these is a path, so none was touched.

**AC 6 — the files under `docs/self/`** (`git ls-files docs/self` at `a0f15fd7`, outside the two
moved trees):
- `docs/self/WORKFLOW.md` → **moved** to `.wingfoil/WORKFLOW.md`: it describes the workflows in
  `.wingfoil/`, next to `.wingfoil/README.md`; `spec-011`'s tree lists it.
- `docs/self/X_wingfoil-init-plan.md` → **moved** to `docs/05_plans/X_wingfoil-init-plan.md`, where
  `dl-019` already locates the grandfathered `X_*` plans; `CLAUDE.md` §6 points there.
- `docs/self/` itself: no tracked file remains (`ls docs/self` → No such file or directory), so no
  pointer is left. The main working tree holds an **untracked** `docs/self/X_initial-design-plan.md`
  (and untracked `TODOs.md`, `tools/` at the root); they belong to other work, are not in this
  worktree and were not touched — the approver moves `X_initial-design-plan.md` by hand if wanted
  (`docs/05_plans/` would match the other `X_*` plans).

**Gates** (worktree, after the merge below):

| Check | Command | Result |
|---|---|---|
| unit + BDD | `npx jest --coverage --coverageReporters=text-summary --coverageReporters=json-summary` | 152 suites / 2472 tests passed |
| baseline | same command at `cfd0aa7a` (`a0f15fd7` plus the two status commits), before any other change | 151 suites / 2469 tests |
| coverage | same, before → after | stmts 98.66 (3392/3438) → 98.66 (3392/3438); branches 94.25 (1789/1898) → 94.25; funcs 98.98 (584/590) → 98.98; lines 99.46 (3000/3016) → 99.46 |
| lint | `npm run lint` | exit 0 |
| API docs | `npm run docs:api` | exit 0 |
| types | `npx tsc --noEmit` | exit 0 |
| tarball | `npm pack --dry-run`, file list sorted, before vs after | identical, 341 lines; no `.wingfoil/` or `docs/04_memory/` entry (`package.json` `files` is `["dist", "README.md"]`; `.gitignore` needs no change) |

+3 tests: the two new ones, and one more `it.each` row in `test/core/latency-budget-placement.test.ts`,
which scans every test file (per-file counts from `npx jest --json` at `a0f15fd7` and at the head:
`latency-budget-placement.test.ts` 155 → 156, `own-memory.integration.test.ts` new with 2).

The pinned released build (`task-112`) does not exist yet; everything above ran the build under
development (`dist/`, built by jest's `globalSetup` or `npm pack`'s `prepack`).

### review (reviewer)

- **BDD acceptance, P1.10 / P1.5 / P1.12:**
  `npx jest $(grep -rlE "P1\.10|P1\.5-|P1\.5 |memory-search|memory search" test | sort) test/cli/own-memory.integration.test.ts`
  → 22 suites, 570 tests passed.
- **`main` moved during the task.** `git log --oneline a0f15fd7..main` showed six commits
  (to `997a3578`): `bug-156` `open → triaged → planned`, `task-123` added/submitted/approved to
  `backlog` at `docs/self/docs/04_memory/v0.2.2/`, the v0.2.2 dev-loop plan at v1.2. Merged with
  `git merge --no-ff main` (`27623d86`, no rebase). git proposed placing `task-123` at the new path
  (`CONFLICT (file location)`); it was resolved at `main`'s path instead and then moved by its own
  pure rename (`cc776699`), so its history follows (4 entries, table above). The sweep re-run over
  the merged content found no new citation to rewrite: the merged `docs/self` mentions are a command
  span in `bug-156` and the plan's §2–§3 lines about this move.
- `main` moved once more before submit (`997a3578..6afb473d`: `bug-157`, `bug-158` `open → triaged`),
  merged the same way (`ee1c21a4`); git's rename detection applied both status edits at
  `docs/04_memory/bugs/` (`ls docs/self` → No such file or directory). Their remaining `docs/self`
  mentions are command spans (Steps to Reproduce), kept. The gates table above ran before this
  second merge, which touched only those two bug files; re-run after it:
  `npx jest test/cli/own-memory.integration.test.ts test/validation/secret-scan.test.ts test/memory/state-machine.test.ts`
  → 3 suites, 128 tests passed.
- **For the approver.**
  1. Sign off the four spec revisions (`spec-002`, `spec-003`, `spec-007` §1 with the
     `SCAN_SURFACE_ROOTS` change, `spec-011`), or reject naming the wording to change.
  2. `spec-011`'s tree does not list three files that exist (`plan.md`, `user-docs.yaml`,
     `e2e-smoke.yaml`); recorded in its revision note, not fixed. Needs an element if it should be.
  3. Two open bugs state the old layout as today's: `bug-154` ("The same happens in this repository
     today, whose configuration sits under `docs/self/`") — `node dist/cli.js directives list` at
     the root now exits 0 with the real configuration, so this repository no longer reproduces it —
     and `bug-035` ("the dogfooded config lives under `docs/self/.wingfoil/`"). Their triage should
     re-read them; left as written.
  4. `memory add` still fails here until `task-123` (`bug-156`).
  5. The AC 5 items listed for `align-agent-docs`.
  6. `test/cli/own-memory.integration.test.ts` reads this repository's real history, which
     `test/memory/history-rename-path.test.ts` avoided on purpose; it asserts subjects and states,
     not shas, and degrades to a non-empty check in a shallow clone. A history rewrite that changes
     `bug-077`'s subjects would break it.

**Approver's ruling at the review gate (2026-09-29).**
- 1: the four spec revisions are signed off with the approval.
- 2: `spec-011`'s incomplete tree is filed as a bug.
- 3: `bug-154` and `bug-035` are updated to the new layout, in a commit on `main` after the merge.
- 4: the `align-agent-docs` items stay with that step, except for `CLAUDE.md` and `README.md`. Those
  two got the new paths and the commands that now run on this repository before approval, in the
  commit after this note: `CLAUDE.md` §1, §3, §5, §5.1 and the `README.md` CLI table, release table
  and dogfooding paragraph. Before writing them, the verbs were checked on a throwaway clone of this
  branch with `node dist/cli.js`:
  - `dna show`, `paths`, `directives list`, `workflow list`, `memory search`, `memory history` all
    exit 0;
  - `memory approve dl-047-… --reason probe` wrote `wf(decision-log): approve … [in-discussion →
    ready]`, and `memory deprecate` wrote `… [ready → deprecated]`;
  - `memory add --type bug` failed on `.wingfoil/.wingfoil/…` (`bug-156`).
- 5: the empty history entry for the move commit is accepted as is.
- 6: **kept as a standing note.** `test/cli/own-memory.integration.test.ts` depends on the real
  history of `bug-077`. A history rewrite that changes those subjects must update the test in the
  same change.
- 7: no version bump for path-only edits, accepted.
