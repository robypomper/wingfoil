---
id: "task-072-fix-reason-trailer-contract"
type: task
title: "Fix bug-042: give `--reason` a declared contract against the single-line `Approver:`/`Reason:` commit trailer"
status: in-progress
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
