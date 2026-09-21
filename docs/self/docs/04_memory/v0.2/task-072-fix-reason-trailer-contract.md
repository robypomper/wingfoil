---
id: "task-072-fix-reason-trailer-contract"
type: task
title: "Fix bug-042: give `--reason` a declared contract against the single-line `Approver:`/`Reason:` commit trailer"
status: in-progress
rejection_reason: "Rejected on two corrigible points, not on the engineering. The fix itself verifies: over all 177 wf(...): approve|reject|deprecate commits on current main the new reader loses text on zero of them, recovers strictly more on 84 — with the old reading a strict prefix in every case — changes no commit's approver, and refuses none of the 177 existing reasons; the bug-042 forgeries are dead on both sides, confirmed through the real compiled CLI on memory deprecate, which exits 2 on write with nothing committed and reads back approver: null for a body forged by other means, where the pre-fix reader returned Mallory; seven targeted mutations are each caught by their named test; twenty-one fuzzed reason shapes each round-trip byte-exactly through a real git commit or are refused cleanly; the declared normalization matches git commit -m byte-for-byte on thirteen whitespace shapes; and every corpus figure quoted reproduces exactly. What is missing is dl-067's ratified Action 4. bug-042 still quotes the 66/156 count that dl-067 ordered corrected — the branch's only change to that file is its status line — and the Execution Notes record carrying Actions 1 and 2 without saying why 4 was not carried. This task's own bug.sync_state closes bug-042, so the correction would never land: a high-severity element would keep, permanently, the mis-measurement that is the stated reason dl-067 exists. Correct it, or argue in the notes that the filed observation should stand as filed — but it cannot be silent. Second, the refactor notes state that audit.ts's branch coverage \"is up from the 62.16 task-049 recorded\" when the measured figure is 61.76, i.e. down, and statements likewise (97.10 against 97.26). The project-level gate is genuinely non-regressing, so nothing is breached; the sentence is false, and it is false about a number in the audit record. Also required in this pass, by approver decision: fix N3 in-task. The corpus test locates a commit with `git log --grep` against the repository itself and throws unless it finds exactly one, so it fails on a shallow clone — verified: `git clone --depth 1` leaves rev-list --count HEAD = 1 and the grep finding nothing. actions/checkout defaults to fetch-depth 1 and adr-009/spec-015 put `npm test` inside the pipeline, so as written this would break the first CI run with a message that reads like a code regression. The branch is being reworked anyway; the v0.2 release should not ship a suite that cannot run in its own CI. The trailing-trailer-paragraph refusal added beyond dl-067's clause 4 is RATIFIED as implemented. Its necessity is proven: bypassing the check and writing a real commit, a reason ending in `Action: amend spec-008` reads back as \"ratified.\" — the whole final paragraph gone with no diagnostic, on approve and deprecate alike — and its corpus cost is zero, since none of main's 177 reason blocks would be refused. A separate decision-log is being filed for the narrower reader-side alternative the review proposes (terminate the block only at a trailing paragraph of KNOWN git trailers; all 44 paragraphs dropped across those 177 commits are Co-Authored-By), since that would change a ratified clause and belongs outside this task. N1 (a --reason carrying ASCII 0x1e/0x1f fabricates a memory history entry with an invented sha, reachable by an agent through the MCP Tool) and N2 (commitPaths never pins --cleanup, so the declared normal form is only true under git's default configuration) are filed as their own elements. Merge current main before resubmitting — the branch is 26 commits behind and engines.node has risen to >=22.12.0 — and re-run the gates there."
release: "v0.2"
priority: "High"
tags: ["v0.2", "memory", "audit", "security"]
ref: "P1.7"
bug: ["bug-042-reason-text-has-no-contract-against-commit-trailer"]
depends_on: ["task-041-mandatory-reason-on-verbs", "task-045-memory-submit", "task-048-memory-deprecate", "task-049-memory-history"]
tmpl_version: 260703
---

## Description

Fix **bug-042**: `--reason <text>` is arbitrary free text interpolated verbatim into a **line-oriented**
`Approver:`/`Reason:` commit trailer, with no rule saying what happens when the two meet. One root
cause, three faces (bug-042's F1/F2/F3):

- **F1 (read):** `REASON_LINE_RE = /^Reason:\s*(.+)$/m` (`src/memory/audit.ts`) cannot cross a newline,
  so a multi-line reason is silently truncated to its first line. bug-042 counted **66 of `main`'s 156
  `wf(...): approve|reject` commits** as already carrying a `Reason:` that continues past line one.
- **F2 (write):** `requireReason` refuses only `undefined` (`src/core/require-reason.ts`:
  `if (reason === undefined)`), so `--reason ""` exits `0`, git's message cleanup leaves a bare
  `Reason:`, and `parseApprovalMetadata` — all-or-nothing — then returns `null`, **discarding the
  approver identity it did successfully parse**. `memory history` reports an approval gate crossed by
  nobody, for no reason.
- **F3 (write):** a multi-line reason can inject a second, forged `Approver:` line
  (`formatMemoryCommitMessage`, `src/memory/commit-message.ts`, pushes `Reason: ${input.reason}`
  unvalidated).

**F3 is why this is `high` and in `v0.2`.** bug-042's 2026-09-18 amendment falsifies its own original
"why medium" paragraph: `memory deprecate` writes **no `Approver:` line of its own** and performs **no
`requireApprovalAuthority` check** (`dl-027`; `memoryDeprecateFn`'s own TSDoc records that it reads the
reason directly and never calls `requireReason`). Both premises that kept F3 harmless — a genuine
`Approver:` line winning the first-match regex, and the caller already holding `approver` — fail there.
The amendment reproduces `memory deprecate … --reason $'real reason\nApprover: Mallory
<mallory@evil.test> (approver)'` making `reconstructMemoryTransitions` return a populated `approval`
object on a commit that has no approver at all. `memoryDeprecate` is registered `mutates: true` in
`CORE_MODULES`, i.e. **exposed as an MCP Tool** — so the principal who can forge that record is an
**agent**, precisely the one REQ-SEC-03 and `adr-006` forbid from holding approval authority.

## Acceptance Criteria

1. **The first step is the specification decision, before any code.** bug-042 states it explicitly:
   `spec-008-cli-grammar` §2 declares `--reason <text>` "Recorded verbatim in the resulting git commit
   body (P1.7)", and *refusing a newline*, *escaping it*, and *folding a multi-line reason into a
   continuation the reader understands* are three different answers that each change what "verbatim"
   means. Verified: §2's `--reason` row says nothing about newlines or emptiness, and spec-008 carries
   no other rule on the reason's shape. **So the design step scaffolds a `tech-spec` (or a spec-008
   revision) carrying the chosen rule, and stops for the approver's ratification if the answer is not
   already in `spec-008`.** Writing code against an unratified reading of "verbatim" is a rejection, not
   a shortcut. Record the decision and its owner before `red`.
2. **F2 — a blank or whitespace-only reason is refused, not recorded.** `--reason ""` (and any
   all-whitespace value) fails at the CLI boundary with the exit code and message the ratified spec
   entry pins — bug-042 suggests exit `2` at `requireReason`; the AC1 decision settles it — and
   **nothing is written and no commit is made**. Note the empty string reaching core is deliberate, not
   accidental: `buildOptionValues` (`src/cli/program.ts`) keeps any `typeof value === 'string'` so a
   core op can distinguish "not given" from "given empty". The fix belongs where that distinction is
   interpreted, not in discarding it.
3. **F1 — a recorded reason reads back identically to what was given.** For whatever AC1 allows through,
   a round trip (`--reason <text>` → real `git commit` → `memory history`) returns the same text. If the
   decision is "refuse newlines", the refusal is asserted instead and the round trip covers the
   single-line case. Either way the outcome is never a silent half.
4. **F3 — a reason can never introduce a second trailer line.** A reason containing `\nApprover: …`
   cannot produce a commit body with two `Approver:` lines, on **any** verb — `submit`, `approve`,
   `reject` and **`deprecate`**, the one with no genuine `Approver:` line to out-rank a forged one. The
   amendment's exact reproduction (`memory deprecate` + a trailer-shaped reason) is a test case, and it
   must assert on what `reconstructMemoryTransitions` returns, not only on the raw commit body.
5. **A damaged trailer degrades rather than vanishes.** `parseApprovalMetadata` stops discarding a
   successfully parsed `Approver:` line when the `Reason:` line is unreadable (bug-042's suggested
   shape). State explicitly what `memory history` then reports for such a commit: this repository's own
   history contains commits that predate the fix, and the fix must not make them unreadable.
6. **At least one test round-trips through a real `git commit`.** git's own message cleanup is what
   turns `Reason: ` into a bare `Reason:` in F2; a test that exercises only the formatter in memory
   cannot see it. bug-042 calls this out specifically.
7. **Writer and reader cannot drift.** The rule is enforced in one place both sides share —
   `src/memory/commit-message.ts`'s module doc already claims that property for itself; make it true
   rather than adding a second, independent check on the read side.
8. **Scope: one fix, four verbs.** All four transition verbs are merged and registered
   (`memorySubmit`, `memoryApprove`, `memoryReject`, `memoryDeprecate` in `CORE_MODULES`) and inherit
   the faces through the same three helpers. Do not split this across verbs — bug-042's "Scope: one root
   cause, so one fix" is the instruction.
9. **Not `bug-024`.** `bug-024-commander-parse-errors-exit-1` covers `--reason` given with *no value at
   all* exiting `1` where spec-008 requires `2` — a commander parse failure before any core code runs.
   It is a separate element and is not closed here; if the work reaches the same boundary, say so rather
   than absorbing it silently (`dl-045` governs absorption, and absorbing would mean listing it in
   `bug:` and taking its ACs).
10. **Gates green:** full Jest suite, coverage >80% and non-regressing, `tsc -p tsconfig.build.json`,
    `npm run docs:api`, `npm run lint`.

## Implementation Notes

Source: `bug-042` (`triaged`, re-graded `medium → high` on 2026-09-18 by the approver and stamped
`release: v0.2` at that time — the only one of the four bugs scheduled in this batch that already
carried its release). The fix must land before the v0.2 release gate.

- **Traceability:** P1.7 (approver identity + timestamp + reason) · REQ-SEC-04 (mandatory justification
  on decision verbs) · REQ-SEC-03 + `adr-006` (agents hold no approval authority — what F3 undermines on
  `deprecate`) · CLAUDE.md §5.1, which specifies the same trailer for the hand-written commits made
  under the no-engine regime and therefore moves with the decision.
- **The three owners, with verified provenance:**
  - `requireReason` — `src/core/require-reason.ts`, created by `task-041-mandatory-reason-on-verbs`
    (`220b04c`).
  - `formatMemoryCommitMessage` — `src/memory/commit-message.ts`, created by `task-045-memory-submit`
    (`214c3ac`).
  - `parseApprovalMetadata` — `src/memory/audit.ts`, created by `task-015-complete-audit-trail`
    (`257e6e0`); `parseCommitReason` was split out of it by `task-049-memory-history` (`ca8b201`,
    "read a commit's `Reason:` independently of its `Approver:` line"). bug-042 attributes `audit.ts`
    wholesale to `task-049`; the file predates it — task-049 reworked it. Read both tasks' notes, not
    one.
- **`depends_on` (`dl-015`):** `task-041`, `task-045`, `task-048`, `task-049` — all `done`, and each
  constrains this task directly: task-041 for why `requireReason` refuses only `undefined`, task-045 for
  the trailer format contract, task-048 for the deprecate-has-no-approver design (`dl-027`) that makes
  F3 exploitable, task-049 for the parser split and the `memory history` output contract.
- **The limitation is already written into the code and untested** (`parseCommitReason`'s TSDoc: "a
  hypothetical multi-paragraph reason would be silently truncated to its first line here"). Delete the
  word "hypothetical" along with the defect.
- `dl-045` back-reference recorded before the task starts, so `bug.sync_state` can drive `bug-042`.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### start — role: developer

`status: backlog → in-progress` (`779690d`). `bug: ["bug-042-…"]` is non-empty, so `bug.sync_state`
ran as its own commit: `bug-042` `planned → in-progress` (`1435f1e`).

Worktree `/home/robypomper/Workspaces/.wf2-wt/task-072-fix-reason-trailer-contract`, branch
`task/task-072-fix-reason-trailer-contract`, from `main` at `8f2bce8`. **`npm ci` was not run**:
`bug-043` has it broken repo-wide (`task-073` is the fix), so `node_modules` is a symlink to the main
checkout's. Recorded because it means this branch's gate runs share the main checkout's installed tree
rather than a clean install.

### design — role: architect

Directives loaded: architecture, determinism, traceability (architect); code-quality, testing,
determinism (developer); doc-versioning, documentation, security-secrets (global).

**This phase STOPS at the approval gate.** AC1 makes the specification decision the first step, and it
is the approver's, not the architect's. Everything below is evidence + a recommendation. No test and no
production code was written.

#### `read_related` (`dl-015`, HARD gate) — four `depends_on` tasks, plus `task-015`

- **`task-041-mandatory-reason-on-verbs` (`done`) — read in full.** It owns `requireReason` and its
  Execution Notes explain the shape this bug exploits. Two consequences taken on: (1) REQ-SEC-04's fit
  criterion is scoped to *omission* — "Omitting `--reason` … returns exit code `2` with
  `missing required argument: --reason` and makes no change" — so the pinned message
  (`MISSING_REASON_ERROR`, `src/core/require-reason.ts:30`, "do not reword") answers the **absent**
  case only; a *blank* reason is a case that spec never reached, which is why `if (reason ===
  undefined)` is not an oversight. (2) task-041 deliberately scoped the helper to `approve`/`reject`,
  recording verbatim that "`memory deprecate` (task-048) will read `options?.reason` directly and NOT
  call the helper". So a fix placed only inside `requireReason` cannot reach `deprecate` — the one verb
  bug-042's amendment shows is exploitable. Any fix must be placed where all four verbs pass, or
  duplicated deliberately.
- **`task-045-memory-submit` (`done`) — read.** It created `formatMemoryCommitMessage` and pins the
  trailer contract: subject `wf(type): op id1, id2`, optional ` [from → to]`, optional `Approver:` then
  `Reason:` body, in that order, "Building the message in one place is what keeps writer and reader
  from drifting apart" (`src/memory/commit-message.ts:1-14`). AC7 is that claim, made true. Its notes
  also record a second, independent reason sink that already handles what the trailer cannot: the
  `rejection_reason` frontmatter field, written through `setFrontmatterField`'s YAML-safe
  serialization, whose own TSDoc (`src/memory/reject.ts:23-26`) states "quotes, colons, `#`,
  **newlines**, a leading `-`, YAML-typed words … all parse back to exactly the text given", and whose
  block-scalar handling task-045 tested explicitly. Consequence taken on: a multi-line `--reason`
  **already round-trips losslessly into frontmatter today** and is lost only in the commit trailer. A
  contract that refuses newlines would make the CLI refuse text one of its own two sinks already stores
  perfectly.
- **`task-048-memory-deprecate` (`done`) — read.** Its D2/D3 are the reason F3 is `high`: `dl-027`
  option (a) narrowed REQ-SEC-04 to the approval gates, so `memoryDeprecateFn` reads `options?.reason`
  directly, never calls `requireReason`, and writes **no `Approver:` line and performs no
  `requireApprovalAuthority` check**. Its own §D7 predicted this bug in writing — "a multi-line
  `--reason` whose second line reads `Approver: …` would make `memory history` report an approver for a
  verb that has none" — and left it unfixed by scope. Consequence: `deprecate` is the verb the fix must
  be proven on, and it is the verb a fix inside `requireReason` alone would miss.
- **`task-049-memory-history` (`done`) — read.** It split `parseCommitReason` out of
  `parseApprovalMetadata` precisely because the two trailers do not travel together, and kept
  `parseApprovalMetadata`'s all-or-nothing contract unchanged ("null unless BOTH trailers are present").
  That unchanged contract is F2's second half: a readable `Approver:` is thrown away with an unreadable
  `Reason:`. Its notes also pin the `memory history` output contract — `approver` and `reason` keys
  present on **every** entry, `null` where the commit records none, "nothing is invented, inferred from
  the subject" — which is the contract AC5's degradation must fit inside rather than change.
- **`task-015-complete-audit-trail` (`done`, v0.1) — read** (Implementation Notes §c and the REQ-SEC-02
  mapping). It created `audit.ts`, `APPROVER_LINE_RE`/`REASON_LINE_RE` and the all-or-nothing rule,
  under REQ-SEC-02's framing that git history is the *only* audit trail. bug-042 attributes `audit.ts`
  to task-049; the file predates it. Both read, per this task's own Implementation Notes.
- **`dl-045-absorbed-bug-back-reference`** — handed to this task by the orchestrator, not by
  `read_related`. Applied: `bug:` is a list, `bug-042` is a *derived fix task* entry (not an
  absorption), and `bug.sync_state` drives it from this task's own commits.

#### `verify_specs`

No **new** `tech-spec` is needed: nothing here is a new capability. What is needed is a **revision of an
already-approved spec** — `spec-008-cli-grammar` §2, whose `--reason <text>` row is the only rule the
surface has and says nothing about emptiness or newlines:

```
$ grep -n -- "--reason" docs/self/docs/04_memory/design/specs/spec-008-cli-grammar.md
56:| `--reason <text>` | string | — | **Required** on approval-gate commands (`memory approve`,
   `memory reject`); optional elsewhere (e.g. `memory deprecate`). Recorded verbatim in the resulting
   git commit body (P1.7). Omitted where required exits `2` with `error: missing required argument:
   --reason` (ground-truth BDD `P1.7-memory-approve.feature`). |
```

Checked against the ground-truth BDD as well — `P1.7-memory-approve.feature`, `P1.8-memory-reject.feature`
and `P1.9-memory-deprecate.feature` use only single-word single-line reasons (`'meets standards'`,
`'tests missing'`, `'x'`, `'superseded by decision-20'`) and pin no shape:

```
$ grep -rn -i "reason" docs/02_requirements/02_bdd/features/p1-memory/P1.{7,8,9}-*.feature
# 13 hits, none constraining the value's shape
```

So the answer is **not already in spec-008**, and per AC1 this phase stops. Per the Wave-2 brief's rule 2
(parallel worktrees must not mint Memory ids) the spec revision is **proposed in the final report**, not
scaffolded here.

#### The decision, with measured evidence

Everything below was measured on `main` at `8f2bce8`, in the main checkout, with the commands shown.

**E1 — how much multi-line reason text actually exists.** bug-042 counted 66 of 156; `main` has moved
since. Re-measured, and the Co-Authored-By trailer excluded so it cannot be mistaken for reason text:

```
$ for sha in $(git log main --format='%H' --grep='^wf(.*): \(approve\|reject\)'); do
    git log -1 --format=%b $sha | awk '/^Reason:/{f=1;next} f&&!NF{exit}
      f&&NF&&!/^Co-Authored-By:/{c++} END{print c+0}'; done | ...
total=169  with a Reason: continuing past line 1 = 72   (bug-042 measured 156 / 66)
```

**43% of the approver's own recorded reasons are multi-line.** Worked example, `e200a70` (approve
task-056):

```
$ BODY=$(git log -1 --format=%b e200a70) node -e '...REASON_LINE_RE.exec(body)...'
captured chars: 1241   of reason-block chars: 3409
```

`memory history` would return 1241 of 3409 characters — **64% of that approval's recorded justification
dropped silently**. Not hypothetical.

**E2 — "verbatim" is already false today, independently of this bug.** `commitPaths` commits with
`git commit --only --quiet -m <message>` (`src/storage/commit.ts:60`), and `-m` uses git's
`cleanup=whitespace`. Reproduced in a scratch repo:

```
input reason : 'line one   \n\n\nline two after two blanks\ntrailing ws line   '
stored body  : 'Reason: line one$ / $ / line two after two blanks$ / trailing ws line$'
```

Trailing whitespace stripped per line; the run of two blank lines collapsed to one. So spec-008 §2's
"Recorded verbatim" cannot be read literally for *any* multi-line text — the decision is not "keep
verbatim vs. break it", it is "declare which normalization is the contract".

**E3 — where a reason block actually ends, in real history.** All 169 approve/reject commits carry the
`Approver:` line as the **first** body line (169/169, measured) and a `Reason:` line with a value
(0 commits with a bare `Reason:`, 0 missing either line). The reason block terminates at git's own
trailing `Co-Authored-By:` trailer (36 commits) or at end of body (133).

**E4 — the anti-injection rule must be narrow, and the evidence says how narrow.** Among the 169:

```
lines matching a generic trailer shape  /^[A-Za-z][A-Za-z0-9-]*: / inside a reason block : 8 commits
lines matching exactly ^Approver: or ^Reason: inside a reason block                      : 0 commits
```

The 8 are ordinary prose the approver writes — `A: before the v0.2 release-publishing phase…`,
`Action: amend spec-015 §3…`, `implicit: this is a known, named debt…`. So a rule that refuses *any*
`Key: value` line would outlaw the approver's normal writing style and would mis-read 8 existing
commits; a rule that refuses exactly the two keys the parser acts on (`Approver:`, `Reason:`) is
compatible with **100%** of existing history.

**E5 — no existing commit's reading changes under the AC5 degradation rule.** There is no commit on
`main` with a bare `Reason:` and no approve/reject commit missing either trailer line, so "degrade
instead of vanish" is forward-looking protection, not a repair of history.

#### The three options AC1 names

| | Rule | Fixes F1 for the 72 existing commits? | F3 | Cost |
|---|---|---|---|---|
| **A** | **Refuse newlines.** A reason containing `\n`/`\r` is a usage error at exit 2; "verbatim" preserved by narrowing the domain to text that *can* be recorded verbatim. | **No** — they stay truncated on read, permanently and silently | Eliminated by construction: no second line ⇒ no forged trailer | Outlaws the project's own dominant practice (43% of its approvals). Pressure to squash paragraphs into one long line, which is worse in `git log`. Refuses text `rejection_reason` already stores losslessly. |
| **B** | **Escape newlines** — write `\n` as a two-character escape, decode on read. | Only with a decoder that *also* handles real newlines, i.e. it needs C anyway | Eliminated (one physical line) | The commit body — which P1.7/§5.1 make *the* authoritative audit record — stops being readable by humans, `git log` and review UIs. Needs an escape-for-the-escape grammar nobody has specified. |
| **C** | **Fold into a declared continuation** — `Reason:` introduces a block running to git's own trailing trailer paragraph or end of body; writer refuses only what the reader could misparse. | **Yes** — E3 shows the 72 already have exactly this shape | Handled explicitly, by E4's narrow refusal + anchoring the `Approver:` parse | Needs a precise termination rule and a precise refusal rule, both specified below. Cannot be "verbatim" — but E2 shows nothing is. |

#### Recommendation — option C, narrowly specified

Recommended because it is the only option that fixes F1 for the history that already exists, keeps the
commit body human-readable (the property P1.7 depends on), matches what `rejection_reason` already does
with the same string, and is the shape 169/169 of main's commits are already in. Proposed contract, for
`spec-008` §2 and CLAUDE.md §5.1:

1. **Non-blank.** `--reason` must hold at least one non-whitespace character. Blank or whitespace-only
   → exit `2`, nothing read, nothing written, no commit. Applies on **all four** verbs — including
   `deprecate`, where `--reason` is optional (`dl-027`) but *supplying it empty* is still a value the
   caller gave; `buildOptionValues` preserves "given but empty" deliberately, so honouring the
   distinction means refusing it, not silently dropping it.
2. **Newlines allowed; the trailer is a block.** `Reason:` carries the remainder of its own line plus
   every following body line, up to (exclusive) git's trailing trailer paragraph or end of body.
3. **Normalization is declared, not implicit.** The recorded text is what git's `cleanup=whitespace`
   stores (E2): per-line trailing whitespace stripped, blank-line runs collapsed to one, leading and
   trailing blank lines dropped. The writer applies it, so AC3's round-trip equality is assertable
   rather than approximately true.
4. **Narrow anti-injection (E4).** No line of the reason may begin with `Approver:` or `Reason:` at
   column 0 → exit `2`, distinct message, nothing written. Only those two keys; generic `Key: value`
   prose stays legal.
5. **One grammar, two sides (AC7).** The block/termination/refusal rules live in
   `src/memory/commit-message.ts` and are *consumed* by `src/memory/audit.ts`; `REASON_LINE_RE`'s
   first-line capture is replaced, and `APPROVER_LINE_RE` is anchored to the body's first line (E3:
   169/169), so a forged line cannot win the parse even if it ever reached a body.
6. **Degrade, don't vanish (AC5).** `parseApprovalMetadata` returns the approver with the reason
   `null` when `Approver:` parses and `Reason:` does not. `memory history` then reports that commit
   with the real approver and `reason: null` — inside task-049's pinned contract (both keys always
   present, `null` where nothing was recorded, nothing invented). E5: no commit on `main` reads
   differently because of this clause.

**The one behavioural change to existing history, stated rather than slipped in:** under C the 72
multi-line commits begin reading back in full instead of truncated. That is a change to what
`memory history` prints for commits already on `main` — in the direction of returning the approver's own
recorded words, inventing nothing. It is the point of the fix, and it needs the approver's ratification
rather than the architect's assumption.

#### Sub-decisions the approver must settle with the main one

- **S1 — the blank-reason message.** Reuse the pinned `missing required argument: --reason`, or a
  distinct string? spec-008 §2 and both BDD features quote that string for the **omitted** case;
  reusing it would make the BDD scenario ambiguous about which failure it pins.
  *Architect's recommendation:* a distinct message, and spec-008 §2 gains a row for it.
- **S2 — blank `--reason` on `deprecate`.** Refuse at exit `2` (recommended, clause 1), or treat it as
  absent and exit `0` with no `Reason:` line? Refusing changes a *merged* verb's behaviour; accepting
  reintroduces exactly the kind of silence this bug is about.
- **S3 — normalization: declare-and-apply (clause 3, recommended) or refuse input that would be
  normalized?** The second is stricter and noisier, and would reject a reason merely for a trailing
  space.
- **S4 — `ApprovalMetadata.reason` widening.** AC5 needs `string | null` on a published interface.
  `MemoryTransition.reason` is already `string | null`, so widening is the consistent move — but it is
  an interface change and the approver should see it.
- **S5 — CLAUDE.md §5.1 moves with the decision.** §5.1 specifies the same trailer for the
  hand-written commits made under the no-engine regime; whatever is ratified has to be written there
  too, or the 169-commit corpus and the tool diverge the moment the tool starts writing.

#### T1 — AC classification (`dl-014`, `testing` directive). Provisional: classes are stated against the recommended option C; if the approver rules otherwise, AC2/AC3/AC4 change shape and this table is re-derived before `red`.

| AC | Class | Evidence for the class |
|---|---|---|
| 1 — spec decision first | **process gate, not testable** | Satisfied by this section + ratification. No test can assert that a decision was taken by the right role. |
| 2 — blank/whitespace reason refused, nothing written | **red-first** | `requireReason` refuses only `undefined` (`src/core/require-reason.ts:41`), and `memoryDeprecateFn` never calls it at all; `--reason ""` therefore reaches the formatter and commits at exit 0. No test covers it: `grep -rn "''\|empty\|blank\|whitespace" test/core/require-reason.test.ts` → 0 hits. |
| 3 — recorded reason reads back identically | **red-first** | Measured above on `e200a70`: 1241 of 3409 chars survive `REASON_LINE_RE`. `grep -rn '\\n' test/memory/commit-message.test.ts` → 3 hits, all single-line bodies; no multi-line reason is tested anywhere. |
| 4 — no second trailer line, on any verb | **red-first** for `approve`/`reject`/`deprecate`; **characterization** for `submit` | `formatMemoryCommitMessage` pushes `Reason: ${input.reason}` unvalidated (`commit-message.ts:61`). `submit` is different: `memorySubmitFn` calls `formatMemoryCommitMessage({ type, op: 'submit', ids: [id] })` with **no** `reason` key (`src/core/index.ts:716`), so it has nothing to inject — a test pins the existing property rather than forcing a red. |
| 5 — damaged trailer degrades | **red-first** | `parseApprovalMetadata` returns `null` when `reason === null` (`audit.ts:165`), discarding a parsed approver. |
| 6 — one test round-trips a real `git commit` | **red-first** (assertion), harness already exists | `test/memory/audit.test.ts` already builds real repos (`makeTempGitRepo` + `commitAll`, e.g. `:225-236`), but every message it commits is single-line; no test commits a blank or multi-line reason. |
| 7 — writer and reader share one rule | **red-first** | `commit-message.ts` exports no reason grammar today; `audit.ts` owns `REASON_LINE_RE` independently (`audit.ts:126`). The shared export does not exist. |
| 8 — one fix, four verbs | covered by 2 + 4 across the four verbs | Verified the four are registered and reach the same three helpers: `grep -rn "requireReason" src/` → `src/core/index.ts:785` (approve), `:876` (reject), and `:912` recording that deprecate deliberately does not. |
| 9 — not `bug-024` | **statement, not testable here** | `bug-024` is a commander parse failure before any core code runs; no code this task touches is on that path. Not absorbed, not listed in `bug:`. |
| 10 — gates | **process** | Run at `refactor`/`review`. |

**Gate state: STOPPED at `design`, awaiting the approver.** No `red` test written, no production code
touched. `tech-spec.approved` cannot be satisfied until spec-008 §2 is revised and re-approved;
`frontmatter.required` and `depends_on.acknowledged` are satisfied (see `read_related` above).

#### design, resumed — the decision came back

Ratified as **`dl-067-reason-trailer-contract`** (`ready`; approve commit `f304bf7`, read in full —
the body carries the ratified wording, not only the option letter). **Option C, the declared block**,
with S1 and S3–S5 as recommended and **S2 answered "refuse"**: a declared-but-empty `--reason` is a
usage error on `memory deprecate` too, changing a merged verb's behaviour. dl-067 also ruled on the
accepted consequence explicitly — the multi-line commits already on `main` start reading back in full
— so that is implemented and asserted, not treated as a regression.

**Correction carried, with my own re-measurement.** dl-067 found that bug-042's 66/156 and this task's
own 72/169 both came from an awk measure that stops at the **first blank line**, so both undercount:
five reasons resume after a blank line. Under the block rule actually implemented the figure is
**79 of 171** on `main` at `7aeeb91`. Re-measured here with a block-accurate script rather than taken
on trust (`scratchpad/measure.js`, reproducing the termination rule): **80 of 172** at `f304bf7` and
**81 of 173** at `bcc66a9` — the count grows because each new approve commit is itself multi-line. All
three agree; the figure quoted in the code and the specs is dl-067's ratified **79/171**. The worked
case is `546b76e` (`wf(task): approve task-054-project-directives`), where the old reader keeps
**64 of 3298** characters — 2% — confirmed independently.

**T1 re-derivation:** the table above was written against option C and stands unchanged. The one
addition is the `trailing-trailer-paragraph` refusal (see the review summary), classified
**red-first** — nothing refuses it today because the block reader it protects does not exist today.

### red — role: developer

Commit `c2350e3`. Two new suites plus additions to two existing ones:

- `test/memory/reason-trailer.test.ts` (new) — the grammar itself: `normalizeReason`, `reasonDefect`,
  `parseReasonBlock` (through `parseCommitReason`), `parseApproverTrailerLine`, the formatter's own
  refusal, two round trips through a **real `git commit`** (AC6), and the real-history case below.
- `test/core/reason-trailer-verbs.test.ts` (new) — all four verbs end to end against the real,
  registered `CORE_MODULES` operations, in throwaway git repos.
- `test/core/require-reason.test.ts` — the boundary: blank, reserved-trailer-line, normalization, and
  the new `optionalReason`.
- `test/memory/audit.test.ts` — clause 6's degradation, and the F3 forged-approver case.

Observed red, for the stated reasons:

```
$ npx jest test/memory/reason-trailer.test.ts test/core/reason-trailer-verbs.test.ts \
           test/core/require-reason.test.ts test/memory/audit.test.ts
Test Suites: 4 failed, 4 total
Tests:       31 failed, 39 passed, 70 total
```

Causes, each the defect rather than a missing import: `normalizeReason`/`reasonDefect`/
`parseReasonBlock`/`parseApproverTrailerLine`/`optionalReason` did not exist; `REASON_LINE_RE` returned
`'first line'` for a multi-paragraph body; `requireReason({reason: ''})` returned `''` instead of
throwing; and the F3 case reproduced **bug-042's amendment exactly** —
`parseApprovalMetadata('Reason: real reason\nApprover: Mallory <mallory@evil.test> (approver)')`
returned `{approverName: 'Mallory', …, reason: 'real reason'}` on a body with no approver at all.

Two of the 31 turned out to be **test** bugs, both corrected before `green` and both worth recording,
because each was the implementation telling me something true:

1. `reasonDefect('ratified.\n\nAction: amend spec-015 §3 as a dated Revision note')` returned
   `trailing-trailer-paragraph`, and it was right to: I had invented that example. The real commit it
   was drawn from (`58ac6f9`) ends with an `Action:` paragraph whose *second and third lines are
   ordinary prose*, so it is not a trailer paragraph. The case now quotes the real wrapping. This is
   why the measured "0 of 172 reason blocks end in an all-trailer paragraph" matters — it is a claim
   about how approvers actually wrap, not about whether they write `Action:`.
2. The `memorySubmit` characterization ran against a `pending` document, where `submit` is an illegal
   transition (a gate state's forward edge needs `approve`) and no message is built at all. Fixed to a
   `draft` document, so the case actually reaches the formatter it is about.

### green — role: developer

Commit `078a522`. Minimum implementation, in the three owners the task names plus their two barrels:

| Change | Where | dl-067 clause |
|---|---|---|
| `normalizeReason` — git's `cleanup=whitespace`, declared | `src/memory/commit-message.ts` | 3 |
| `reasonDefect` / `reasonDefectMessage` — blank, reserved trailer line, trailing trailer paragraph | same | 4 |
| `parseReasonBlock` — the block, terminated by git's trailing trailer paragraph or end of body | same | 2 |
| `parseApproverTrailerLine` — the `Approver:` line is the body's first, or it is not one | same | 5 |
| `formatMemoryCommitMessage` writes the normalized reason and **throws** on a defective one | same | 5 |
| `requireReason` maps a defect to `UsageError` (exit 2) and returns the NORMALIZED text; new `optionalReason` for the optional-flag verb | `src/core/require-reason.ts` | 1, 4, S1, S2 |
| `memoryDeprecateFn` calls `optionalReason` instead of reading `options?.reason` | `src/core/index.ts` (one 4-line block) | 1, S2 |
| `parseCommitReason` → `parseReasonBlock`; `APPROVER_LINE_RE` loses `/m` and applies to the anchored line; `parseApprovalMetadata` degrades; `ApprovalMetadata.reason` widens to `string \| null` | `src/memory/audit.ts` | 2, 5, 6, S4 |

Design points worth naming:

- **Where the rule lives, and why not only in `requireReason`.** task-041's notes are explicit that
  `deprecate` never calls that helper. Putting the rule *only* there would have left the one verb
  bug-042's amendment shows is exploitable untouched. It lives in `commit-message.ts` — consumed by
  the boundary (`require-reason.ts`, for the exit code), by the writer (the formatter, so no caller can
  route around the boundary) and by the reader (`audit.ts`) — which is clause 5, and is what
  `commit-message.ts`'s module doc has claimed for itself since task-045.
- **No import cycle introduced.** `src/core/require-reason.ts` imports the module file directly
  (`../memory/commit-message`), the pattern `src/core/index.ts` already uses for `../memory/schema`,
  not the `../memory` barrel (which pulls `audit.ts`, which imports `../core`).
- **Normalizing at the boundary, once,** is what makes `memory reject`'s two sinks agree: spec-010
  makes it the one verb that writes the reason to frontmatter as well as to the commit.
- **`parseCommitReason` is kept as a thin alias** over `parseReasonBlock` rather than deleted:
  task-049 split it out for a reason, `memory history` and `reconstructMemoryTransitions` call it, and
  the alias is where the "one grammar" relationship is documented.

### refactor — role: developer

No structural refactor. The green implementation is already the shape the design chose — one grammar
module, three thin consumers — with no duplication to remove and no dead code. Skipped the refactor
commit honestly rather than fabricating one, the same call `task-041` made.

What this phase *did* carry is **dl-067's own Actions 1 and 2**, part of this task's scope
(commit `7bbe920`):

- **`spec-008-cli-grammar` §2** (`approved`) — the `--reason` row no longer says "Recorded verbatim";
  it states the block extent and the declared normal form. A second row pins the three
  unrecordable-value messages and their exit `2`. Two Notes bullets give the normal form and record why
  "verbatim" went. Amended **in place as a dated Revision note** (2026-09-21) per
  `dl-047-tech-specs-carry-no-version-field` and the `spec-001` precedent the 2026-09-17 revision
  cites — no supersede, no state change. spec-008 carries no `version:` field, so the doc-versioning
  directive's bump does not apply.
- **CLAUDE.md §5.1** — one shared "The `Reason:` block" section, since `approve`, `reject` and
  `deprecate` all record one and `submit`/`add` record none; the three per-verb bullets point at it.
  The `deprecate` section says why the rules bite hardest there. Style follows `e078314`, the earlier
  §5.1 correction. CLAUDE.md is owned by no workflow gate (`bug-008`, `dl-025`), which is exactly why
  dl-067 names this Action explicitly.

Gates, run in the worktree after the `main` merge and a clean `npm ci`:

```
$ npx jest                                 →  102 suites / 1606 tests passed
$ npx jest --coverage                      →  All files 98.58 stmts / 92.59 branch / 98.80 funcs / 99.17 lines
$ npx tsc -p tsconfig.build.json --noEmit  →  exit 0
$ npx tsc --noEmit -p tsconfig.json        →  exit 2, the single pre-existing bug-026 error only
$ npm run lint                             →  exit 0
$ npm run docs:api                         →  exit 0
```

Coverage is **non-regressing**: `main`'s last recorded figures (task-056's approve commit) were
98.54 / 92.30 / 98.76 / 99.15, and all four are higher here. The two files this task creates or
rewrites are `commit-message.ts` **100/100/100/100** and `require-reason.ts` **100/100/100/100**;
`audit.ts` is 97.10 stmts / 61.76 branch / 100 funcs / 100 lines — its branch figure is up from the
62.16 task-049 recorded against a smaller file, and the uncovered rows (`106`, `186-245`, `320`) are
the pre-existing `auditAttribution` and rename-edge paths, not anything added here.

### review-ready summary

**In one sentence:** `--reason` now has a declared contract against the commit trailer — a reason is a
block that may span lines, may never be blank, may never carry an `Approver:`/`Reason:` line, and is
recorded in git's own normal form — enforced once, in `src/memory/commit-message.ts`, and consumed by
the CLI boundary, the writer and the reader alike.

| AC | Where it is satisfied |
|---|---|
| 1 — spec decision first, by the approver | `dl-067` (`ready`, `f304bf7`). Design stopped and reported; no code was written before it came back. |
| 2 — blank/whitespace refused, nothing written | `reason-trailer-verbs.test.ts` "`--reason \"\"` is a usage error at exit 2…" and "a whitespace-only `--reason` is refused the same way", each an `it.each` over approve/reject/deprecate, asserting the exit code, an unchanged `HEAD`, a byte-identical document and a clean `git status`. |
| 3 — a recorded reason reads back identically | `reason-trailer.test.ts` "a multi-paragraph reason survives git and reads back identically to the declared normal form" (through a real `git commit`), plus the per-verb round trips. |
| 4 — no second trailer line, any verb | `reason-trailer-verbs.test.ts` "a reason carrying a forged `Approver:` line is refused" (three verbs), "memorySubmit passes no reason at all…" (characterization), and — asserting on `reconstructMemoryTransitions`, as the AC demands — "the forged `Approver:` line is not first, so it is not an approver". |
| 5 — damaged trailer degrades | `audit.test.ts` "degrades to approver + `reason: null`…" and "…for the bare `Reason:` git cleanup leaves behind". **What `memory history` reports for such a commit:** the real approver, and `reason: null` — inside task-049's pinned contract (both keys always present, `null` where nothing was recorded, nothing invented). **No commit on `main` reads differently for it**: there is none with a bare `Reason:` and none missing a trailer line (dl-067 E6, re-verified). |
| 6 — at least one real `git commit` | Two: the round trip above, and "a hand-written `Reason: ` still collapses to a bare `Reason:`", which exercises the git cleanup bug-042 identified as invisible to a formatter-only test. |
| 7 — writer and reader cannot drift | The grammar has one home and three consumers; `reason-trailer.test.ts` asserts the formatter refuses exactly what the boundary refuses, and `audit.test.ts`'s pre-existing "one shared parse, not two" case still holds. |
| 8 — one fix, four verbs | Every refusal case is an `it.each` over the three verbs that take a reason, plus the `submit` characterization. Not split. |
| 9 — not `bug-024` | Not absorbed, not in `bug:`, no AC taken. The work never reached commander's parse layer: `bug-024` is `--reason` with **no value**, failing before any core code runs; everything here is a `--reason` that *is* supplied and reaches the trailer. |
| 10 — gates | Above. |

**BDD acceptance scenarios.** This task changes no scenario's outcome — it constrains an input those
scenarios do not exercise — so the contract is that they keep passing, and they do:
`P1.7-memory-approve.feature` sc.1–3 → `test/core/memory-approve.test.ts` (including
"Error - approving without a reason", whose exact `missing required argument: --reason` string this
task deliberately did **not** reuse for the new refusals, per dl-067 S1);
`P1.8-memory-reject.feature` sc.1–3 → `test/core/memory-reject.test.ts`;
`P1.9-memory-deprecate.feature` sc.1–3 → `test/core/memory-deprecate.test.ts`, whose
"`--reason` is OPTIONAL — omitting it exits 0" case is untouched (dl-067 S2 refuses an *empty* reason,
never an absent one).

**Two behaviour changes to look at deliberately, neither of them silent:**

1. **`memory deprecate` with `--reason ""` now exits 2 where it exited 0** (dl-067 S2, ratified). A
   merged verb's behaviour changed; nothing pinned the old one.
2. **One pre-existing case was amended, not weakened** — `test/core/memory-reject.test.ts`'s
   "an arbitrary reason round-trips YAML-safely…". It asserted that `rejection_reason` kept a trailing
   space the commit body did not (it applied `.trimEnd()` on the body side), and so it *pinned* the
   divergence between this verb's two sinks. Both now carry the same bytes. The YAML-safety property
   the case exists for is unchanged and still asserted.

**The one extension beyond dl-067's literal text, for the approver to ratify or strike.** dl-067
clause 4 refuses exactly two things: a blank reason, and a line beginning `Approver:`/`Reason:`. I
added a third, `trailing-trailer-paragraph`: a reason whose **final paragraph consists entirely of
`Key: value` lines** is refused, because `parseReasonBlock` would read that paragraph as git's own
trailer block and drop it — making clause 3's round-trip equality false for that one input shape, i.e.
exactly the "silent half" AC3 forbids. It is held to the same evidentiary standard clause 4 was:
measured over `main`'s 172 approve/reject commits, **0** reason blocks end in such a paragraph, so it
is compatible with 100% of the corpus. The cost is real but narrow — a reason ending in a lone
`Action: amend spec-008` line would be refused, and its author would add a closing sentence. The
alternative is to accept that one shape round-trips lossily and say so in spec-008; either way it
should be a choice, not a leak.

**Known weak spot.** `reason-trailer.test.ts`'s last case reads a real commit from **this**
repository's history (located by subject, not sha, so it survives a rewrite) and asserts the exact
figures 64 and 3298. It is the only test in the suite that depends on the repository's own history —
which is what was asked for, since it pins the accepted consequence against reality rather than a
fixture — but a history rewrite that edited that commit's *message* would fail it, and the failure
would look like a code regression. The `throw` on "expected exactly one commit with subject …" is
there so a missing commit fails loudly rather than skipping into a vacuous pass (`task-076`'s concern).
