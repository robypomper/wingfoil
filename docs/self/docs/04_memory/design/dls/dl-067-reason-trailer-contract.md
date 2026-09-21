---
id: "dl-067-reason-trailer-contract"
type: decision-log
title: "What `--reason` records against a line-oriented `Approver:`/`Reason:` commit trailer: refuse newlines, escape them, or declare the reason a block"
status: ready
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`--reason <text>` is arbitrary free text; the `Approver:`/`Reason:` commit trailer it lands in is read
and written as two **single lines**. No rule says what happens when the two meet. That gap is
`bug-042-reason-text-has-no-contract-against-commit-trailer` (`planned`, `high`, `v0.2`) with three
faces — a multi-line reason silently truncated on read (F1), a blank reason destroying the whole
approval record (F2), and a multi-line reason forging a second `Approver:` line (F3). Its 2026-09-18
amendment re-graded it `medium → high`: on `memory deprecate` — which writes no `Approver:` line and
runs no `requireApprovalAuthority` check (`dl-027-req-sec-04-deprecate-reason-scope`) — F3 lets an
**agent**, acting through an MCP Tool, make `memory history` report a forged approval, which is exactly
what REQ-SEC-03 and `adr-006` forbid.

`task-072-fix-reason-trailer-contract` (`in-progress`, `v0.2`) is **stopped at its design gate** on its
own AC1, which makes the specification decision the first step and the approver's, not the architect's:
`spec-008-cli-grammar` §2 declares the value "Recorded verbatim in the resulting git commit body
(P1.7)", and *refusing a newline*, *escaping it*, and *folding it into a declared continuation* are
three different answers that each change what "verbatim" means. Writing code against an unratified
reading of "verbatim" would be a rejection, not a shortcut. This DL is the ratified container that
decision needs, and the thing task-072 is waiting on.

### Measured evidence

All figures re-measured on `main` at `7aeeb91` for this DL (task-072 measured at `8f2bce8`; `main` has
moved). Commands are given so each is re-runnable.

**E1 — how much multi-line reason text exists.** 171 `wf(…): approve|reject` commits on `main`
(task-072: 169).

```
$ git log main --format='%H' --grep='^wf(.*): \(approve\|reject\)' | wc -l
171
$ for sha in $(git log main --format='%H' --grep='^wf(.*): \(approve\|reject\)'); do
    git log -1 --format=%b $sha | awk '/^Reason:/{f=1;next} f&&!NF{exit}
      f&&NF&&!/^Co-Authored-By:/{c++} END{print c+0}'; done | awk '$1>0{n++} END{print n}'
74            # task-072 measured 72 of 169
```

That command — bug-042's and task-072's — stops the reason at the **first blank line**. Under the
termination rule option C would actually implement (block runs to git's trailing trailer paragraph or
end of body, §E4), the count is **79 of 171**, because five reasons resume after a blank line. So the
72/74 figure *understates* the affected corpus; the honest number for scoping the fix is **79 (46%)**.

**E2 — `REASON_LINE_RE` captures only the first line.** `/^Reason:\s*(.+)$/m`
(`src/memory/audit.ts:126`): `.` does not cross newlines, so `parseCommitReason` (`:147-153`) returns
line one. Worked example, `e200a70` (`wf(task): approve task-056-role-based-directive-assignment
[in-review → approved]`):

```
$ BODY=$(git log -1 --format=%b e200a70) node -e '...REASON_LINE_RE.exec(BODY)...'
captured: 1241   block: 3409   pct kept: 36%
```

1241 of 3409 characters — **64% of that approval's recorded justification dropped silently**, with no
diagnostic. It is not the worst: `546b76e` (`approve task-054-project-directives`) keeps **64 of 3298**
characters (2%). The limitation is written into `parseCommitReason`'s own TSDoc as "hypothetical"
(`audit.ts:141-146`); it is not hypothetical, and it is untested.

**E3 — "verbatim" is ALREADY false, independently of this bug.** `commitPaths` commits with
`git commit --only --quiet -m <message>` (`src/storage/commit.ts:60`), and `-m` applies git's
`cleanup=whitespace`. Reproduced in a scratch repository for this DL:

```
input reason : 'line one   \n\n\nline two after two blanks\ntrailing ws line   '
stored body  : 'Reason: line one$ / $ / line two after two blanks$ / trailing ws line$'
```

Per-line trailing whitespace stripped; the run of two blank lines collapsed to one. So spec-008 §2's
"Recorded verbatim" cannot be read literally for *any* multi-line text today. The question is not
"keep verbatim or break it" — it is **which normalization is the declared contract**.

**E4 — the shape real history is already in.** Of the 171: `Approver:` is the **first body line** in
**171/171**; **0** carry a bare `Reason:`; **0** are missing either line. The reason block terminates at
git's trailing `Co-Authored-By:` trailer in **38** and at end of body in **133**.

**E5 — how narrow the anti-injection rule must be.** Inside reason blocks: **8** commits carry a generic
`Key: value` line (`3655166` "A: before the v0.2 release-publishing phase…", `58ac6f9` "Action: amend
spec-015 §3…", `1ee7f00` "implicit: this is a known, named debt…", plus `f15a434`, `995dfc0`, `a8f607c`,
`546b76e`, `0ef76be`); **0** carry a line beginning literally `Approver:` or `Reason:`. Both figures
match task-072's. A rule refusing any `Key: value` line would outlaw the approver's normal prose and
mis-read 8 existing commits; a rule refusing exactly the two keys the parser acts on is compatible with
**100%** of existing history.

**E6 — nothing on `main` reads differently under the degradation clause.** No commit has a bare
`Reason:` and none is missing a trailer line, so "degrade instead of vanish" is forward-looking
protection, not a repair.

## Decision

Three options are open for what `--reason` records against the trailer. They are presented here with a
recommendation; the approver's choice is recorded in this document's approve commit `Reason:`.

### (A) Refuse newlines

A reason containing `\n`/`\r` is a usage error at exit `2`. "Verbatim" is preserved by narrowing the
domain to text that *can* be recorded verbatim; F3 is eliminated by construction, since a one-line
reason cannot introduce a second trailer line.

*Against:* it does **not** fix F1 for the 79 commits already on `main` — they stay truncated on read,
permanently and silently. It outlaws the project's own dominant practice (46% of its own approvals),
pressuring approvers to squash paragraphs into one long line, which reads worse in `git log` than the
truncation it replaces. And it refuses text the *other* reason sink already stores losslessly: the
`rejection_reason` frontmatter field goes through `setFrontmatterField`'s YAML-safe serialization,
whose TSDoc (`src/memory/reject.ts:23-26`) states that newlines "parse back to exactly the text given".
The CLI would be refusing, on one sink, text its own other sink round-trips perfectly.

### (B) Escape newlines

Write `\n` as a two-character escape on the way in, decode on the way out. F1 and F3 both close, and the
trailer stays one physical line.

*Against:* the commit body is what P1.7 and CLAUDE.md §5.1 make **the** authoritative audit record, and
escaping makes it unreadable to humans, to `git log`, and to every review UI — trading a silent read
defect for a permanent legibility defect in the artefact of record. It needs an escape-for-the-escape
grammar nobody has specified, and a decoder that must *also* handle genuinely-newline-bearing bodies —
i.e. it needs option C's block rule anyway, for the 79 commits that already exist.

### (C) Declare `Reason:` a block — **recommended**

1. **Non-blank on all four verbs.** `--reason` must hold at least one non-whitespace character; blank
   or whitespace-only exits `2`, nothing read, nothing written, no commit. Including `deprecate`, where
   `--reason` is optional (`dl-027`) but *supplying it empty* is a value the caller gave —
   `buildOptionValues` preserves "given but empty" deliberately (`src/cli/program.ts:200-212`), so
   honouring that distinction means refusing it, not silently dropping it.
2. **Newlines allowed; the trailer is a block.** `Reason:` carries the remainder of its own line plus
   every following body line, up to (exclusive) git's trailing trailer paragraph or the end of the body.
   E4 shows 171/171 of `main` are already in exactly this shape.
3. **Normalization declared, not implicit.** The recorded text is what git's `cleanup=whitespace`
   stores (E3): per-line trailing whitespace stripped, blank-line runs collapsed to one, leading and
   trailing blank lines dropped. The writer applies it, so round-trip equality is assertable rather than
   approximately true.
4. **Narrow anti-injection.** No line of the reason may begin with `Approver:` or `Reason:` at column 0
   → exit `2`, distinct message, nothing written. Only those two keys (E5); generic `Key: value` prose
   stays legal.
5. **One grammar, two sides.** The block, termination and refusal rules live in
   `src/memory/commit-message.ts` and are *consumed* by `src/memory/audit.ts` — that module's own doc
   already claims "building the message in one place is what keeps writer and reader from drifting
   apart"; this makes the claim true. `REASON_LINE_RE`'s first-line capture is replaced, and
   `APPROVER_LINE_RE` is anchored to the body's first line (E4: 171/171), so a forged line cannot win
   the parse even if one ever reached a body.
6. **Degrade, don't vanish.** `parseApprovalMetadata` returns the approver with `reason: null` when
   `Approver:` parses and `Reason:` does not, instead of discarding both. This sits inside task-049's
   pinned `memory history` contract (both keys present on every entry, `null` where nothing was
   recorded, nothing invented). E6: no commit on `main` reads differently because of this clause.

**Consequence, stated rather than slipped in:** under (C) the **79** multi-line commits already on
`main` begin reading back **in full** instead of truncated. That is a change to what `memory history`
prints for commits that already exist — in the direction of returning the approver's own recorded words
and inventing nothing. It is the point of the fix, and it is the part that needs the approver's
ratification rather than an architect's assumption.

### Sub-questions to settle with the main option

- **S1 — the blank-reason message.** Reuse the pinned `missing required argument: --reason`, or a
  distinct string? spec-008 §2 and the `P1.7`/`P1.8` BDD features quote that string for the **omitted**
  case; reusing it makes those scenarios ambiguous about which failure they pin.
  *Recommendation:* a distinct message, with spec-008 §2 gaining its own row for it.
- **S2 — blank `--reason` on `deprecate`.** Refuse at exit `2` (C clause 1), or treat it as absent and
  exit `0` with no `Reason:` line? Refusing changes a **merged** verb's behaviour; accepting
  reintroduces exactly the silence this bug is about. *Recommendation:* refuse.
- **S3 — normalization: declare-and-apply (C clause 3), or refuse input that would be normalized?**
  The second is stricter and noisier, and would reject a reason merely for a trailing space.
  *Recommendation:* declare-and-apply.
- **S4 — widening `ApprovalMetadata.reason` to `string | null`.** Needed by C clause 6, and consistent
  with `MemoryTransition.reason`, which is already `string | null` — but it is a published-interface
  change and the approver should see it named. *Recommendation:* widen.
- **S5 — CLAUDE.md §5.1 moves with the decision.** §5.1 specifies the same trailer for the hand-written
  commits made under the no-engine regime, and those commits are the entire 171-commit corpus. If it is
  not amended in the same breath, the corpus and the tool diverge the moment the tool starts writing.
  *Recommendation:* amend it as part of this decision's actions.

## Rationale

(C) is recommended on five grounds, each resting on a measured figure rather than a preference:

- **It is the only option that fixes F1 for history that already exists.** 79 of 171 approve/reject
  commits carry a multi-line reason (E1). (A) leaves every one of them permanently truncated; (B) needs
  C's block rule to read them anyway. Only (C) makes `memory history` return what the approver actually
  wrote.
- **It keeps the commit body human-readable**, which is the property P1.7 and REQ-SEC-02 depend on:
  git history is the audit trail, so the artefact of record must stay legible to `git log` and to
  reviewers. (B) trades that away.
- **It is the shape the corpus is already in.** 171/171 have `Approver:` as the first body line; 0 have
  a bare `Reason:`; blocks already terminate at a trailing trailer paragraph or end of body (E4). (C)
  declares an existing convention rather than imposing a new one.
- **"Verbatim" is not on the table for any option.** `git commit -m` already normalizes (E3), so
  spec-008 §2's current wording is false today regardless of what is chosen. (C) is the only option that
  *declares* the normalization instead of leaving it implicit and unasserted.
- **The narrow refusal is compatible with 100% of history** (E5: 8 generic `Key: value` prose lines, 0
  literal `Approver:`/`Reason:` lines), so F3 closes without outlawing the approver's writing style.

The cost of (C) is honest and specific: it needs a precise termination rule and a precise refusal rule,
both written above, and it cannot claim "verbatim" — but E3 shows nothing can.

## Actions

1. **Amend `spec-008-cli-grammar` §2.** Replace the `--reason <text>` row's "Recorded verbatim in the
   resulting git commit body (P1.7)" with the ratified contract — block extent, declared
   `cleanup=whitespace` normalization, and the narrow `Approver:`/`Reason:` refusal — and **add a row**
   for the blank/whitespace-only case (exit `2` and its message, per S1). spec-008 is `approved`, so the
   amendment is a dated Revision note (`dl-047-tech-specs-carry-no-version-field`) and re-ratification,
   not a silent edit; this DL is that amendment's ratified container.
2. **Amend CLAUDE.md §5.1's commit formats** to the same contract (S5), so the hand-written commits made
   under the no-engine regime and the tool's own output cannot diverge. **Caveat:** CLAUDE.md is owned
   by no workflow gate (`bug-008-claude-md-stale-project-status`, `open`;
   `dl-025-agent-facing-docs-ownership`, `in-discussion`), so nothing schedules this edit — it has to be carried explicitly by whoever
   executes `task-072`, and is named here for that reason.
3. **Hand the outcome to `task-072-fix-reason-trailer-contract`**, which is stopped at its design gate
   waiting for exactly this. On ratification its AC1 is satisfied, its T1 AC-classification table is
   re-derived if the approver rules against (C), and `red` may begin. Its ACs 2–7 are already written
   against (C)'s clauses 1, 2/3, 4, 6 and 5 respectively.
4. **Correct the affected-corpus figure** wherever the fix is scoped: bug-042 and task-072 both quote a
   count produced by an awk measure that stops at the first blank line (66/156, then 72/169). On `main`
   at `7aeeb91` that measure gives 74/171, but the block rule the fix implements gives **79/171**.

## Relations

- **Fixes / unblocks:** `bug-042-reason-text-has-no-contract-against-commit-trailer` (the defect; its
  "why medium" paragraph is falsified by its own 2026-09-18 amendment),
  `task-072-fix-reason-trailer-contract` (stopped at its design gate on this decision).
- **Amends:** `spec-008-cli-grammar` §2 (`approved`); CLAUDE.md §5.1.
- **Constrained by:** `dl-027-req-sec-04-deprecate-reason-scope` (deprecate is not an approval gate —
  why F3 is exploitable there), `task-041-mandatory-reason-on-verbs` (`requireReason` refuses only
  `undefined`, and deliberately does not cover `deprecate`), `task-045-memory-submit`
  (`formatMemoryCommitMessage`, the trailer contract, and `rejection_reason`'s lossless newline
  handling), `task-015-complete-audit-trail` (created `audit.ts`, both regexes and the all-or-nothing
  rule under REQ-SEC-02), `task-049-memory-history` (split `parseCommitReason` out; pinned the
  `memory history` output contract this decision's clause 6 must fit inside), `task-046-memory-approve`,
  `task-047-memory-reject`, `task-048-memory-deprecate` (the verbs that inherit all three faces).
- **Adjacent, not absorbed:** `bug-024-commander-parse-errors-exit-1` (`--reason` with **no value at
  all** exiting `1` where spec-008 requires `2` — a commander parse failure before core code runs;
  neither bug fixes the other), `bug-031-one-invalid-memory-doc-breaks-lookups`,
  `dl-054-submit-commit-subject-bracket` (another commit-subject/trailer grammar question on the same
  formatter), `dl-055-core-error-details-never-reach-operators` (governs how the exit-`2` messages this
  decision pins actually reach the operator).
- **Traceability:** P1.7 (approver identity + timestamp + reason), P1.8 (reject), P1.9 (deprecate),
  REQ-SEC-02 (git history is the audit trail), REQ-SEC-04 (mandatory justification on decision verbs).
