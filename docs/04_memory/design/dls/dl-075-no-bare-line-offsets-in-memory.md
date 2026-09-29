---
id: "dl-075-no-bare-line-offsets-in-memory"
type: decision-log
title: "Memory documents, tech-specs and acceptance criteria cite source locations as bare line offsets, which decay silently — 11 of a 19-citation sample no longer point at what they claimed, and no cheap check detects it"
status: ready
context: "documentation-governance"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

A line offset is not a reference to a piece of code. It is a **claim about a file's state at a
moment** — "on the day I wrote this, that content was on line 138" — written in a form that looks
like a pointer. Nothing re-evaluates it, and a reader who follows it to the wrong line cannot tell a
stale citation from a correct one: both resolve, both produce plausible text, and only one is the
text the author meant.

This is the same family as the release's top rejection cause — asserting a file's state without
running the command that settles it — but displaced in time. The claim was **true when written**. The
author did run the command. What fails is the claim's shelf life, and no gate, test or review step
anywhere in the repository re-checks it.

All measurements below are against `main` at **`9221037`**, taken in this ingest's worktree, with the
command that produced each one stated inline. Every number was re-derived here; three claims in the
intake that proposed this decision-log did **not** survive re-measurement (**E2**, **E3**, **E4**) and
are corrected below rather than repeated.

### E1 — the surface: 549 citations in 112 documents

```
$ grep -rEon '[A-Za-z0-9_./-]+\.(ts|js|cjs|yml|yaml|json|md):[0-9]+(-[0-9]+)?' \
      docs/self/docs/04_memory/ docs/05_plans/ | wc -l
549
$ grep -rlE '[A-Za-z0-9_./-]+\.(ts|js|cjs|yml|yaml|json|md):[0-9]+' \
      docs/self/docs/04_memory/ docs/05_plans/ | wc -l
112
```

549 occurrences, **371 distinct** `path:line` strings, across **112** documents. The same sweep over
`docs/self/.wingfoil/` returns **zero** — the hand-authored configuration cites no offsets at all, so
whatever is decided here touches Memory documents and phase plans only, never a config pillar.

Where they sit, by element type (one pass over that grep output, bucketing each hit by the directory
of the document containing it):

| Element type | Documents | Citations |
|---|---|---|
| `task` (`04_memory/v0.2/`) | 37 | 256 |
| `decision-log` (`design/dls/`) | 34 | 151 |
| `bug` (`bugs/`) | 36 | 116 |
| `plan` (`docs/05_plans/`) | 2 | 17 |
| `adr` (`design/adrs/`) | 1 | 5 |
| `tech-spec` (`design/specs/`) | 2 | 4 |

The distribution matters, because a citation's *kind* is not uniform. Splitting the task documents at
their `## Execution Notes` heading:

```
task docs — citations inside Execution Notes: 207
task docs — citations above it (Description / Acceptance Criteria / Impl Notes): 49
```

and the bug documents by section heading:

```
   47  ## Steps to Reproduce
   32  ## Notes
   14  ## Summary
   10  ## Triage & Execution Notes
    8  ## Actual Behavior
    5  ## Expected Behavior
```

So **264** of the 549 already sit in a note-like position — a record of what somebody read at a
moment — and **285** sit in a durable position: an acceptance criterion an implementer must satisfy,
a decision's rationale, a bug's summary, a spec's contract. That 285 is the number a ratification
decision has to dispose of (**E7**).

### E2 — the measured stale fraction: 11 of 19, plus a twelfth that misquotes

This is the load-bearing number, so the sampling is stated in full and is reproducible.

**Method.** Take the 549 occurrences with their containing document and line, sort them
lexicographically (deterministic — no `shuf`, no seed, in the spirit of REQ-SYS-07's aversion to
unordered iteration in anything whose result is reasoned about), take every 30th:

```
$ grep -rEon '[A-Za-z0-9_./-]+\.(ts|js|cjs|yml|yaml|json|md):[0-9]+(-[0-9]+)?' \
      docs/self/docs/04_memory/ docs/05_plans/ > cites.txt
$ sort cites.txt | awk 'NR % 30 == 1' > sample.txt
$ wc -l < sample.txt                          # 19
$ cut -d: -f1 sample.txt | sort -u | wc -l    # 19 — one citation per distinct document
```

19 citations in 19 **different** documents, spanning bugs, decision-logs, tasks and a phase plan.
Each was then adjudicated by hand: read the claim the surrounding prose attaches to the offset, then
`sed -n '<n>p'` the target file on `main` at `9221037` and ask whether it is that thing.

| # | Citation | Claim attached to it | Verdict at `9221037` |
|---|---|---|---|
| 1 | `audit.ts:125-126` | "the two trailer regexes" | **stale, twice over** — a TSDoc paragraph; `APPROVER_LINE_RE` is at `:138` and `REASON_LINE_RE` no longer exists (`grep -n 'REASON_LINE_RE' src/memory/audit.ts` → nothing) |
| 2 | `src/memory/state-machine.ts:138` | `resolveStateMachine` | **stale** — now at `:203` |
| 3 | `commit-message.ts:56-63` | `formatMemoryCommitMessage`'s body assembly | **stale** — now the `ReasonDefect` union |
| 4 | `.github/workflows/publish.yml:99` | the sole `npm ci` | **stale** — `contents: read` |
| 5 | `…/v0.2/task-074-fix-engines-node-floor.md:17` | the task that changes `package.json` | current |
| 6 | `src/core/index.ts:815-820` | the `paths` op registration | **stale** — TSDoc for `memory reject` |
| 7 | `…/planning/rl-v1/minor-v0.3.md:16` | `agent execute` is v0.3 scope | current |
| 8 | `src/core/directive-assign.ts:112-152` | `updateRoleAssignments` | **stale** — now at `:199` |
| 9 | `src/core/approval-authority.ts:67` | `requireApprovalAuthority` calls `readGitIdentity` | current |
| 10 | `src/workflow/schema.ts:45-62` | the `Phase` schema | current |
| 11 | `test/cli/program.integration.test.ts:352` | the "under 1 second" perf assertion | **stale** — reads `'\n',` |
| 12 | `src/core/index.ts:979` | a doc comment naming `directiveRemove` | **stale** — now at `:1172` |
| 13 | `test/core/directive-assign.test.ts:121` | one of three `toEqual` assertions | **stale** — the call, not an assertion |
| 14 | `dev-loop.yaml:73` | `refactor.checks.post` | **stale** — that is `green`'s `post`; `refactor`'s is `:81` |
| 15 | `src/storage/commit.ts:60` | `git commit --only --quiet -m` | current |
| 16 | `docs/01_vision/01_product-brief.md:267` | quoted as "TypeScript, Node.js 18+ (npm)" | **right line, wrong quotation** — it reads `22.12+` since the `adr-010` cascade |
| 17 | `src/core/types.ts:30-36` | `commit` only on the `ok: true` arm | current |
| 18 | `publish-secrets.test.ts:52` | the raw-text `/secrets\./g` scan | **stale** — at `:59` |
| 19 | `test/memory/versioning-audit-trail.test.ts:61` | the timestamp regex `task-081` will widen | current |

**11 of 19 (58%) no longer point at what they claimed.** A twelfth (#16) still points at the right
line and quotes text that was replaced under it — the failure an offset cannot express and a verbatim
quotation would have caught on sight. Seven of 19 (37%) are correct.

Two qualifications, because the number is easy to over-read:

- **Decay tracks churn, not age.** `dl-074-tag-must-be-on-pushed-main` was filed the same day and
  cites `.github/workflows/publish.yml:120-123` and `:88-90`; both resolve exactly today, because
  `git log --oneline b505473..HEAD -- .github/workflows/publish.yml` is empty. `src/core/index.ts`
  carries 26 of the 371 distinct citations and has **56 commits** on `main`
  (`git log --oneline main -- src/core/index.ts | wc -l`; 1358 commits total); both sampled citations
  into it (#6, #12) are stale. A citation into a quiet file can outlive the project.
- **Some staleness is not decay at all — it was wrong on arrival.** #13 and #14 are off by a few
  lines against the file *as it stood when they were written*, not after it moved (**E5**). The two
  failure modes are indistinguishable to a reader, which is the point.

Note what #1 shows about the alternative: the citation named `REASON_LINE_RE`, which
`task-072-fix-reason-trailer-contract` deleted. A symbol citation would have failed loudly on a
one-command `grep`. The offset resolves silently to unrelated prose.

### E3 — task-079's acceptance criteria decayed in under nine hours, before execution began

The intake claimed "eight source offsets, seven already shifted, only `VERDACCIO_PACKAGE` survived".
**That does not reproduce.** The real count is larger and the survivors are three, not one — but the
underlying finding is stronger than the claim, not weaker.

`task-079-spec-015-staging-and-node-floor-corrections` states in its Description that "all line
numbers below are against `main` at **`7bb95d6`** and were re-read for this task, not copied from the
sources that raised them". It then cites **19 source offsets** in its acceptance criteria: 15 into
`scripts/publish-staging.cjs` (`:37`, `:42-55`, `:48`, `:52`, `:53`, `:62-84`, `:73-75`, `:76-79`,
`:98-102`, `:155-161`, `:183`, `:184`, `:200`, `:201`, `:202-205`), plus `publish.yml:135`,
`package.json:36`, `test/cli/publish-staging.test.ts:95-103` and `README.md:115`.

```
$ for c in 7bb95d6 b505473 HEAD; do
    echo "--- $c"; git show $c:scripts/publish-staging.cjs | sed -n '37p;201p'
  done
```

At `7bb95d6` all 19 resolve correctly. The task then **started** at `1afff06`, on a base of
`b505473`. Between those two points `task-078-publish-pipeline-hardening` landed, whose `5261607`
rewrote `scripts/publish-staging.cjs`:

| | at `7bb95d6` (ACs written) | at `b505473` (task started) |
|---|---|---|
| `publish-staging.cjs:37` | `const VERDACCIO_PACKAGE = 'verdaccio@6';` | unchanged |
| `publish-staging.cjs:201` | the `npm install … verdaccio@6` call | `child.kill('SIGTERM');` |
| `publish-staging.cjs:42-55` | `stagingPaths` | mid-comment above `REGISTRY_STOP_TIMEOUT_MS` |
| `publish.yml:135` | `npm run publish:staging -- --tarball …` | `npm pack --ignore-scripts …` (moved to `:157`) |
| `test/cli/publish-staging.test.ts:95-103` | the no-uplink test | now at `:101-109` |

**16 of the 19 shifted; 3 survived** — `publish-staging.cjs:37`, `package.json:36` and
`README.md:115`. They are survivors by luck of churn, not by construction.

The timing is the finding. `git log -1 --format='%cI'` on each commit gives: ACs written **11:21**,
`task-078` merged to `main` **20:06**, `task-079` started **20:09**. The acceptance criteria an
implementer was handed were *false at handover*, roughly nine hours after they were written and
pinned, and the document's own pin (`7bb95d6`) is the only reason the discrepancy is recoverable at
all.

### E4 — the commit pin is what rescues a citation, and `dl-052` proves it

The intake claimed `dl-052-verdaccio-started-by-staging-script-in-ci` "cites `sed -n '77,78p'` for a
passage that had already moved". **That does not reproduce either, and the truth is the opposite.**
`dl-052` writes its citation as `` `sed -n 77-78p` on `main`, `8a6a091` ``:

```
$ git show 8a6a091:docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md \
    | sed -n '77,78p'
2. **stage** — start **Verdaccio** (`npx verdaccio` locally / official image as a CI service on
   `http://localhost:4873`), `npm publish` the packed tarball to it (throwaway auth token).
```

Exactly the quoted passage. Today the same offsets read something unrelated:

```
$ sed -n '77,78p' docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md
  gate (`dl-013`) per `adr-010` action 5 — settled at the decision level, not yet closed in the
  user-facing documentation. This bullet still fixes only what the published manifest asserts about
```

So `dl-052` (`ready`) is the **positive** case: a citation that still resolves a release later,
because the commit travels with it. That is option (B) working, and it is already in use here.

It is not a clean win. `dl-052`'s *other* offsets carry no pin of their own, and two are stale today
(`publish-staging.cjs:197` → `if (timer) clearTimeout(timer);`, `:62` → `};`), while
`adr-009 §3 (:68-70)` and `publish-staging.cjs:37` still hold. A per-document pin does not cover
citations added by a later edit, and a reader cannot tell which offsets the pin was meant to govern.

### E5 — off-by-one and off-by-three at the authoring commit, not after it

Two citations are wrong against the file as it stood **when they were written**, which no re-reading
catches and no freshness convention prevents:

- `test/cli/publish-staging.test.ts:83-87`, cited for the test "keeps every staging file inside the
  run work dir". The test occupies **`:84-88`** at `b505473` and still does at `9221037`
  (`grep -n "keeps every staging file inside the run work dir" test/cli/publish-staging.test.ts` →
  `84`). The intake attributed this to task-079's **reviewer**; it is not —
  `git log -S'publish-staging.test.ts:83-87'` names **`51429d9`, the implementer's own design
  notes**. Correcting the attribution makes the point worse, not better: it was produced in the same
  pass that re-read three neighbouring offsets (`stagingPaths` `:50-63`, `stagingEnv` `:99-112`, the
  `finally` `:163-169`) and got all three exactly right.
- `bug-053`'s `docs/self/.wingfoil/memory.yaml:58-63`, quoted as the `defaults:` block. At the bug's
  own pinned commit `ba2cad0`, `git show ba2cad0:docs/self/.wingfoil/memory.yaml | grep -n '^defaults:'`
  returns **`61`**; `:58-63` is the tail of a comment paragraph about rejection reasons. Off by three,
  at the commit it was measured against.

The plausible mechanism in both cases is a `sed -n` window pasted into prose and then edited — the
workflow the offset convention itself encourages.

### E6 — no cheap mechanical check detects any of this

Two decidable properties, swept over the 371 distinct citations:

```
distinct: path does not resolve from repo root:   93
distinct: path resolves, line number past EOF:     0
distinct: path resolves, line in range:          278
```

**Zero** citations point past the end of their file. The cheapest possible automated check — "does
this line exist?" — finds nothing, because cited line numbers are small relative to the files they
point into. Every one of the 11 stale citations in **E2** is *in range* and resolves to real text.

Worse, **93 of 371 (25%)** cannot be resolved to a file at all from the repository root, because the
path is a bare basename or a fragment; **83** have no directory separator whatsoever
(`audit.ts:125-126`, `dev-loop.yaml:73`, `commit-message.ts:56-63`, `publish-secrets.test.ts:52`). A
machine cannot check them; a human resolves them only from the surrounding prose. Each of those four
happens to be unambiguous in this repository *today* — the ambiguity is latent rather than realized,
which is the same shape as the offset problem itself.

### E7 — what already exists on `main`, by disposition class

From **E1**: **285** citations in durable positions (49 in task Description / Acceptance Criteria /
Implementation Notes, 59 in bug Summary / Notes / Expected / Actual, 151 in decision-logs, 17 in
phase plans, 5 in ADRs, 4 in tech-specs) and **264** in note-like positions (207 task Execution
Notes, 57 bug Steps-to-Reproduce and Triage notes).

## Decision

WingFoil records how a Memory document cites a location in source. Three options are open; the
approver's choice, and the disposition of the 285 existing durable citations, are recorded in this
document's approve commit `Reason:`.

### (A) Cite a unique symbol or a verbatim quotation, plus the commit read at — bare offsets confined to notes

A durable citation names something the file **carries**, not somewhere it sits: an exported symbol
(`resolveStateMachine` in `src/memory/state-machine.ts`), a heading (`spec-015` §3 stage 2), a YAML
key path (`dev-loop.yaml`, the `refactor` phase's `checks.post`), or a verbatim quotation of the
line — with the commit it was read at when the claim is about a state that may legitimately move.
Bare offsets stay legal in Execution Notes, bug Steps-to-Reproduce and triage notes, where a stale
offset is a truthful record of what somebody read rather than an instruction to a later reader.

*What it gains.* The citation carries its own check: a symbol either exists or it does not
(`grep -n 'export function resolveStateMachine' src/memory/state-machine.ts` settles it in one
command), and a quotation that no longer matches is visibly a quotation that no longer matches. Every
failure in **E2** except #9, #15 and #17 becomes self-announcing, and #1 becomes a hard error rather
than silent prose. **E5**'s two off-by-N errors become impossible, because a name is not subject to
arithmetic. It also fixes **E6**'s 25% unresolvable-path problem as a side effect: a symbol name is
searchable without a path at all.

*What it loses, and the loss is real.*

- **A line number is faster.** `src/core/index.ts:979` is one keystroke in an editor; "the TSDoc
  paragraph for `directiveRemoveFn`" is a search. In a 1200-line file the offset is strictly better
  ergonomics — while it is correct.
- **Not everything has a symbol.** A line of YAML (`dev-loop.yaml` has several `post:` keys), a
  specific assertion inside a long `it()` (#13's third `toEqual`), a blank-line boundary, a row of a
  Markdown table, a `#` comment. The fallback is a verbatim quotation, which is longer than the line
  it replaces and duplicates content that can then drift on its own — #16 is exactly a quotation that
  drifted. A quotation is also not necessarily unique: two identical assertions in one file are two
  matches, so the rule must say a citation disambiguates (nearest enclosing named thing, plus the
  quotation).
- **It is not enforceable today.** There is no workflow engine to run a `checks` entry, so this is a
  convention a reviewer applies, exactly like the `traceability` and `documentation` custom directives
  it would live beside.

### (B) Keep offsets, require the commit sha alongside

Every durable offset is written `path:line` **at** an explicit sha, as `dl-052` already does for its
one pinned quote and `task-079` does document-wide. Staleness stops being silent: a reader who lands
on the wrong text has the sha, and `git show <sha>:<path> | sed -n '<n>p'` recovers the original claim
mechanically.

*What it gains.* Cheap to adopt — a habit, not a rewrite. Preserves the ergonomics of a line number.
It is the only option under which a claim about a state that has since *legitimately* changed (#16,
#4) stays recoverable rather than merely wrong. And it is already proven in this repository (**E4**).

*What it costs.* It makes staleness **detectable, not prevented**: every reader still has to run the
`git show`, and in practice nobody does — `dl-052`'s pinned citation was read as current a release
later, and #16 was never revisited. The form actually used is a whole-document pin ("all line numbers
below are against `7bb95d6`"), and **E3** shows what that is worth: the pin was accurate and the
acceptance criteria were false at handover nine hours later regardless. A document-wide pin also has
no answer for citations added by a later edit under the same pin.

### (C) Status quo plus a mechanical check

Leave the convention alone; add a test that resolves every citation in `docs/self/docs/04_memory/`
and `docs/05_plans/` and fails when one no longer points at what it claimed.

*This is the option that sounds best and is worst, and it is costed here so the record shows it was
considered rather than dismissed.* It is **not decidable as stated**, for three independent reasons:

1. **There is no oracle.** A citation is `path:line`. What it *claimed* lives in the surrounding
   prose, in natural language. `src/memory/state-machine.ts:138` does not record that it meant
   `resolveStateMachine`; a checker would have to extract that intent from an English sentence.
   Which means (C) is not an alternative to (A)/(B) — it is a *consequence* of having adopted one.
2. **Nothing cheap fires.** **E6**: 0 of 278 resolvable citations are out of range, and 93 of 371
   cannot be resolved to a file at all. The entire 58% stale fraction is invisible to any check that
   does not already know the intent.
3. **Where an oracle does exist, the check inverts the failure.** Suppose citations carried
   quotations (option A). A test that fails when a quotation stops matching also fails the moment
   somebody *correctly* edits the cited line — #16's case, where `01_product-brief.md:267` rightly
   changed from "Node.js 18+" to "22.12+". The test would turn a correct source edit red in
   documents the editor is not touching, across a durable surface of 285 citations in ~110 files.
   That trains people to update the quotation without reading why it changed — the decay it was
   built to stop. For a prose quotation there is no way to distinguish "the citation rotted" from
   "the world moved and the citing document now needs a human".

A reduced version is defensible and much cheaper: check only the two **decidable** properties — every
cited path resolves from the repository root (would flag 93 today) and every cited line is in range
(flags 0 today). It catches none of **E2**, but it never false-positives and it retires the latent
ambiguity behind `audit.ts:125-126`.

## Rationale

- **The failure is silent, and the silence is the whole cost.** A broken link 404s. A stale offset
  resolves to plausible text and gives the reader no signal. 11 of 19 sampled citations are wrong and
  every one reads as if it were right (**E2**, **E6**).
- **Freshness is not the fix, because decay is faster than the document cycle.** **E3** is the
  strongest evidence here: `task-079`'s citations were re-read from source, pinned to a commit, and
  false nine hours later before the task began. "Be careful" has already been tried in this
  repository by the most careful available author, on the document that says so explicitly, and it
  failed.
- **Durable documents and working notes are different artifacts and should not share a convention.**
  264 of 549 citations already sit in Execution Notes or reproduction steps, where a stale offset is
  an accurate record of a past reading — the same reason `dl-014` asks for per-AC classification to
  be recorded there and `dl-015` makes a downstream task read them. The 285 in acceptance criteria,
  decisions and specs are instructions to future readers, and only those need to survive. The
  boundary already exists in the templates; the rule would just use it.
- **The offset habit degrades traceability, which is a bound directive rather than a preference.**
  The `traceability` custom directive requires cross-references in the chain to be intact and has a
  reviewer reject work that breaks one; the `documentation` custom directive requires cross-references
  be kept intact and the relevant `docs/` artifact updated in the same change that alters behavior. A
  citation that silently stops pointing at its subject breaks a cross-reference without breaking
  anything a reviewer looks at.
- **This is adjacent to determinism, not identical to it.** REQ-SYS-07 governs context assembly, and
  a Memory document is an input to the context an agent is handed. Two agents reading `task-079`'s
  acceptance criteria at `7bb95d6` and at `b505473` read two different specifications of the same
  work while the text is byte-identical. That is not a REQ-SYS-07 violation as written — the inputs
  did change — but it is the same hazard the requirement exists to remove, and P1.7/P1.10's audit
  trail has the same interest: a `Reason:` that cites an offset is an approval record whose own
  evidence rots.
- **The boundary with stale *prose* is worth naming precisely, and it is not the same problem.**
  `bug-053-spec-011-memory-yaml-row-stale-states-encoding` (`open`) and
  `bug-054-adr-001-present-tense-stack-parenthetical-stale` (`open`) are **content** decay: a document
  *describes* a fact (the `states` encoding; the Node floor) that has since changed, and the sentence
  is wrong however it is cited. A citation convention fixes neither. They belong with
  `bug-045-mutating-op-enumeration-titles-stale` (`open`) — prose a reader meets first that the
  artefact beneath it has outgrown. The connection is narrower and one-directional: both bugs
  *report* their finding using offsets, and `bug-053`'s reporting offset was already off by three at
  its own measurement commit (**E5**). That is evidence the offset habit contaminates even the
  documents written to correct staleness — not evidence that they are the same decay. #16 is the one
  sampled case sitting on the boundary: the offset is right and the quotation is stale, i.e. content
  decay expressed through a citation.
- **Option (C) is not a third way.** It presupposes an oracle only (A) or (B) creates. Recording that
  is part of the value of this document.

## Actions

1. **Choose (A), (B), (A)+(B), or the reduced-(C) path-and-range check.** Owner: approver; the choice
   belongs in this document's approve commit `Reason:`. (A) and (B) compose: name the thing *and* pin
   the commit for claims about state that may move.
2. **Decide the disposition of the 285 existing durable citations** (**E7**). Three candidates; this
   document deliberately does not pick one:
   - *Fix all 285.* Honest but expensive — 285 edits across ~110 documents, many of them `done` tasks
     and `ready` decision-logs whose bodies should not be rewritten after ratification. An in-place
     edit to a settled document is what the dated-revision-note practice exists to constrain — a
     practice `dl-047-tech-specs-carry-no-version-field` is still settling (`in-discussion`), so the
     route itself is not yet ratified.
   - *Fix on touch.* Any document opened for another reason gets its citations converted. Cheapest,
     and it leaves a mixed corpus indefinitely in which a reader cannot tell which convention a given
     citation follows — close to today's state.
   - *Leave them; apply the rule to new writing only.* Defensible if the value is prospective, and
     the only option that costs nothing. It does make the 11-in-19 stale fraction permanent for
     everything already written.
3. **If (A) is chosen, write it as a directive rule, not as prose here.** The natural home is the
   `documentation` custom directive (global, all roles) beside "keep cross-references intact", or
   `traceability` if it is framed as a chain obligation. The rule needs one sentence on the fallback
   for locations that have no symbol, and one on disambiguating a non-unique quotation. Owner:
   whoever carries the task.
4. **Re-measure E2 before acting, not from this document.** The 11-of-19 is pinned to `9221037` on
   2026-09-21 and will drift. The commands are in **E1** and **E2** and are reproducible as written.
5. **Do not schedule a citation-resolving test on the strength of (C) alone.** If the approver wants
   a mechanical guard now, scope it to the two decidable properties in **E6**; the intent-checking
   version needs (A) or (B) ratified first and still has the false-positive problem in (C).3.
6. **`bug-053`, `bug-054` and `bug-045` stay separate.** They are stale-prose bugs with their own
   fixes and should not be folded into this decision or blocked on it.

## Relations

- **Derives from:** the `v0.2` review-gate finding that unverified claims about a file's state are the
  release's leading rejection cause; this document is the time-displaced form of the same failure.
- **Evidence documents (cited, not amended):** `task-079-spec-015-staging-and-node-floor-corrections`
  (`done`) — **E3**, **E5**; `dl-052-verdaccio-started-by-staging-script-in-ci` (`ready`) — **E4**;
  `task-078-publish-pipeline-hardening` (`done`), whose `5261607` moved `task-079`'s ground;
  `task-072-fix-reason-trailer-contract` (`done`), which deleted the symbol #1 names.
- **Adjacent, deliberately not merged:** `bug-053-spec-011-memory-yaml-row-stale-states-encoding`
  (`open`), `bug-054-adr-001-present-tense-stack-parenthetical-stale` (`open`),
  `bug-045-mutating-op-enumeration-titles-stale` (`open`) — all stale *prose*; see Rationale for the
  boundary. `dl-074-tag-must-be-on-pushed-main` (`in-discussion`) is the counter-example whose
  citations still resolve today.
- **Would amend, if (A) is ratified:** the `documentation` or `traceability` custom directive (P3.8
  stand-ins under `directives/custom/`).
- **Traceability:** P1.7 and P1.10 (the audit trail a citation is meant to serve), P1.13,
  REQ-SYS-07 (determinism of what an agent is handed — adjacent, see Rationale), REQ-SYS-08
  (directives bind by role, which is how such a rule would be enforced).
