---
id: "dl-111-tool-signature-in-commits"
type: decision-log
title: "Commits WingFoil writes carry no tool signature — add a `WingFoil-Version: <semver> (<sha>)` trailer, stamped at build, so a commit says which build wrote it"
status: in-discussion
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`, being filed now), from the approver's request at its
`additional-points` gate: every commit WingFoil writes should record the WingFoil version and the
build commit that wrote it.

**What a WingFoil commit records today.** Every commit the tool writes goes through one primitive,
`commitPaths` (`src/storage/commit.ts`). `git grep -n "commitPaths(" a20b346c -- src` lists its
callers: `wingfoil init` (`initStorage`, `src/storage/layout.ts`), the DNA and directive verbs
(`src/core/index.ts`, `src/core/directive-assign.ts`), `memory add` (`src/memory/entry.ts`) and the
Memory transition verbs (`commitMemoryTransition`, `src/core/memory-transition.ts`). The only other
`git commit` invocation in `src/` is the one inside `commitPaths` itself
(`git grep -n "'commit'" a20b346c -- src` finds only `src/storage/commit.ts`). The message itself is
built by `formatMemoryCommitMessage` (`src/memory/commit-message.ts`): a subject, then an optional
`Approver:` line and an optional `Reason:` block. Nothing in it names the tool, its version or its
build. `grep -n "Approver:\|Reason:" src/memory/commit-message.ts` shows those two keys as the only
body lines the formatter writes.

**What the build knows about itself.** `wingfoil --version` prints `package.json`'s `version` and
nothing else (`readPackageVersion`, `src/cli/program.ts`). No build step records the commit the
package was built from: `build` is `tsc -p tsconfig.build.json`, and the package ships only `dist`
and `README.md` (`node -p "require('./package.json').files"` → `[ 'dist', 'README.md' ]`). Anything
the running tool is to know about its own build must therefore be inside `dist`.

**Why it matters now.**

- **Tool-written and hand-written commits cannot be told apart.** On this repository every Memory
  operation is hand-written (`bug-075`), and the `wf()` grammar drift the retrospective measured
  (ASCII brackets, undeclared verbs, `dl-079`) is drift in hand-written commits. Once the configuration
  moves to the root (v0.2.2) both kinds will coexist in one history, and a subject line alone does not
  say which one a commit is.
- **A defect in a published build has no reach.** When a verb is found to write a wrong commit (as
  `bug-076` did), nothing in the history says which commits a given build wrote.
- **The replay experiment needs a pinned build.** The retrospective deferred replaying its agent-error
  inventory until v0.3 ships, on the condition that each commit records the build that wrote it.
- **The residue of an older request.** Recording the build commit inside `--version` was the
  unpublished-build half of an earlier note; publication settled the version half
  (`npm view wingfoil version` → `0.2.1`), and the commit half folds in here.

**The trailer grammar this touches.** `dl-067-reason-trailer-contract` (`ready`) declares the
`Reason:` block and reserves two keys: no line of a reason may begin `Approver:` or `Reason:`
(`RESERVED_TRAILER_LINE_RE`, `src/memory/commit-message.ts`; `grep -n "RESERVED_TRAILER_LINE_RE ="
src/memory/commit-message.ts` shows `/^(?:Approver|Reason):/`). A reason also may not end with a
paragraph made only of `Key: value` lines, because `parseReasonBlock` ends the block at the
commit's trailing trailer paragraph. `dl-070-narrow-reason-block-terminator` (`in-discussion`) asks
whether that terminator should be any `Key: value` paragraph or only one whose keys are known.

## Decision

Every commit WingFoil writes ends with a trailer paragraph carrying

```
WingFoil-Version: <semver> (<sha>)
```

where `<semver>` is `package.json`'s `version` and `<sha>` is the commit the running `dist` was built
from. The trailer is written by the one commit primitive, so every caller gets it. At the gate the
approver ruled that `WingFoil-Version` becomes a reserved key under `dl-067`. The open choices below
remain for the approver.

**Q1 — how the key is reserved:**
- **(A) extend `RESERVED_TRAILER_LINE_RE`** to `Approver|Reason|WingFoil-Version`. A `--reason` with a
  line beginning `WingFoil-Version:` is refused at exit `2`, like a forged `Approver:` line. Readers
  take the trailer only from the trailing trailer paragraph (`git log --format='%(trailers:key=WingFoil-Version,valueonly)'`).
- **(B) reserve by position only.** Readers accept the key only in the trailing paragraph, and
  `dl-067`'s "no closing `Key: value` paragraph" rule already stops a reason from supplying that
  paragraph. No new refusal.

**Q2 — where the sha comes from:**
- **(a) a generated `dist/build-info.json`** (`{ "version", "commit" }`), written by the `build`
  script. It must be `build`, not `prepack`: `publish.yml` packs with `npm pack --ignore-scripts`, so
  `prepack` does not run in the pipeline, while `prepublishOnly` runs `npm run build`. A tree with
  uncommitted changes is stamped `<sha>-dirty`.
- **(b) `git rev-parse HEAD` at run time.** Rejected: an npm-installed package has no `.git`, and
  inside a user's repository the command would return the user's commit, not WingFoil's.

**Q3 — what a run without a stamp writes** (tests running from `src/` through `ts-jest`, a
hand-built `dist` without the generator):
- **(i)** `WingFoil-Version: <semver> (unknown)`;
- **(ii)** no trailer at all, which makes those commits indistinguishable from hand-written ones.

**Recommendation:** Q1 (A), Q2 (a), Q3 (i).
- **Q1 (A)** makes the reservation the approver ruled explicit in the one place `dl-067`'s refusals
  live, and a forged build record is refused at the same boundary as a forged approval.
- **Q2 (a)** is the only option that works in an installed package. It stamps no timestamp, so two
  builds of one commit are byte-identical.
- **Q3 (i)** keeps "no trailer" meaning exactly "not written by WingFoil".

## Rationale

- **One choke point.** Because every commit goes through `commitPaths`, the signature is one change
  and cannot be forgotten by a future verb. A signature added in `formatMemoryCommitMessage` alone
  would miss `init`, the DNA verbs and the directive verbs.
- **A trailer, not a subject token.** The subject grammar is already under discussion (`dl-079`), and
  subject length is a measured regression (`dl-089`, metric G04). A trailer is what git's own tooling
  reads (`%(trailers:…)`), and it sits where `parseReasonBlock` already stops.
- **Provenance, not identity.** The trailer says which build wrote a commit. It does not say who
  authorised it; that stays with the git author and the `Approver:` line (P1.7, REQ-SEC-01).
- **Cost.** One generated file in `dist`, one trailer line per commit, and one more reserved key in
  a refusal the CLI already makes.

Alternatives considered:
- **A git note per commit** instead of a trailer. Rejected: notes are not pushed by default and are
  lost by ordinary clones, so the record would not travel with the history.
- **Only `--version` prints the sha.** Kept as an addition (Action 3), not as a replacement: it tells
  a user which build they have, not which build wrote a given commit.

## Actions

1. **Ratify, choosing Q1, Q2 and Q3.** Owner: approver. The choice goes in the approve commit's
   `Reason:`.
2. **Amend `dl-067`'s reserved-key list** and `spec-008-cli-grammar` §2 (the `--reason` rows of the
   global-flags table) to name `WingFoil-Version` under Q1 (A). Amend `spec-004-mcp-surface-contract`
   §4.3, which fixes the `wf({type}): {verb} {id}` commit a Tool produces, to show the trailer
   paragraph.
3. **Code, behind v0.3 tasks:** the build-info generator in `build`; `commitPaths` appends the
   trailer; `wingfoil --version` prints `<semver> (<sha>)`; `memory history` surfaces the trailer on
   each entry (P1.10); tests pinning each commit site.
4. **`dl-089`'s catalogue** gains a metric: share of `wf()` commits in a window carrying the trailer,
   which separates tool-written from hand-written drift in G09 and G10.
5. **Tasks are derived by v0.3 `release-planning` (`build-backlog`)**, not created here.

## Relations

- **Origin:** `retro-v0.2`, the approver's request at the `additional-points` gate (2026-09-28).
- **Amends, on ratification:** `dl-067-reason-trailer-contract` (reserved keys), `spec-008-cli-grammar`
  §2, `spec-004-mcp-surface-contract` §4.3.
- **Related:** `dl-070-narrow-reason-block-terminator` (which trailing paragraphs end a reason);
  `dl-079-wf-commit-verbs-outside-the-declared-grammar`; `dl-089-release-health-analyses-before-retrospective`
  (G09, G10); `dl-114-recording-agent-token-consumption`, which can reuse the build record;
  `dl-117-ai-attribution-policy`, the other trailer policy filed by this retrospective.
- **Traceability:** P1.2 and P1.10 (audit trail), REQ-SYS-09 (distribution as an npm package).
