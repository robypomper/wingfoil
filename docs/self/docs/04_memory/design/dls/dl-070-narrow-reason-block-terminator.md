---
id: "dl-070-narrow-reason-block-terminator"
type: decision-log
title: "Where the `Reason:` block ends: any trailing paragraph of `Key: value` lines, or only one whose keys are known git trailers"
status: in-discussion
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`dl-067-reason-trailer-contract` (`ready`) clause 2 declares the `Reason:` trailer a **block**: it runs
from the remainder of its own line to "(exclusive) git's trailing trailer paragraph or the end of the
body". It does not say how a reader recognises "git's trailing trailer paragraph".

`task-072-fix-reason-trailer-contract` answered that **by shape**: a final paragraph every line of
which matches `/^[A-Za-z][A-Za-z0-9-]*:[ \t]\S/` is the trailer block
(`trailerParagraphStart`, `src/memory/commit-message.ts`). The writer side inherits the same rule as a
corollary — a `--reason` ending in such a paragraph is refused (`trailing-trailer-paragraph`,
"invalid flag value: --reason must not end in a paragraph of \"Key: value\" lines"), because the reader
would otherwise silently eat it. The approver **ratified that refusal as implemented**.

The review that produced this DL proposed a narrower alternative worth deciding separately: terminate
the block only at a trailing paragraph whose keys are **known git trailers** (`Co-Authored-By`,
`Signed-off-by`, `Reviewed-by`, …), with the writer-side refusal narrowing to match. Both rules cost
zero on today's corpus; they differ only in what they refuse from future authors. Because it changes
`dl-067` clause 4's corollary and a clause the approver has already ratified, it is a decision, not an
implementation detail.

### Measured evidence

All figures measured on `main` at **`ba2cad0`**, against the `task-072` branch build at `bfcc74b`
(`npm ci` + `npm run build`, exit 0). The reviewer's figures were taken at an earlier `main`; `main`
has moved, so every number below is re-measured and the deltas are noted.

**E1 — the corpus.** 178 `approve`/`reject`/`deprecate` commits (the reviewer measured 177):

```
$ git log ba2cad0 --format='%H' --grep='^wf(.*): \(approve\|reject\|deprecate\)' | wc -l
178
```

**E2 — trailing trailer-shaped paragraphs: 47, not 44 — and NOT all `Co-Authored-By`.** The received
framing was "all 44 trailing paragraphs dropped … are `Co-Authored-By:`, zero other keys". Re-measured
by classifying each body's final paragraph under the shape rule `task-072` implements:

```
$ python3 …  # for each commit: strip trailing blanks, take the final paragraph,
             # keep it if every line matches /^[A-Za-z][A-Za-z0-9-]*:[ \t]\S/
governance commits: 178
with a trailing trailer-shaped paragraph: 47
    ['Co-Authored-By'] -> 45
    ['Reason']         -> 2
non-Co-Authored-By: [('b3295f693', ['Reason']), ('20e8271ab', ['Reason'])]
```

So: **45** are `Co-Authored-By` (44 at the reviewer's earlier sha — consistent, `main` gained one), and
the "zero other keys" half **does not hold**. Two commits — `b3295f69` (`approve dl-013 … dl-024`) and
`20e8271a` (`approve retro-v0.1`) — are shaped `Approver:` / blank / single-line `Reason:`, so under
the shape rule the trailing trailer-shaped paragraph **is the reason itself**.

**E3 — those two are saved by an explicit floor, not by the terminator rule.** `parseReasonBlock` reads
`const end = Math.max(trailerParagraphStart(lines), start + 1);` — the `start + 1` guarantees the
`Reason:` line survives even when the terminator points at it. Verified by running the real function:

```
$ node -e 'const {parseReasonBlock}=require("./dist/memory/commit-message.js"); …'
b3295f693 -> reason chars: 725   ("Exceptional retrospective bootstrap — ratify the v0.1 govern…")
20e8271ab -> reason chars: 212   ("v0.1 retrospective complete — A1 explore (12-theme friction …")
e200a70   -> reason chars: 3409  (dl-067 E2's worked example, read in full)
```

Nothing is lost today. But the shape rule needs a special case to achieve that, and the narrow rule
would not: `Reason` is not a git trailer key, so `trailerParagraphStart` would return "no trailer" for
both commits on the rule alone.

**E4 — both refusal rules cost exactly zero on the existing corpus.** Every commit's parsed reason,
run through the implemented `reasonDefect` and through a narrow variant that additionally requires
every line of the final paragraph to be a known git-trailer key:

```
reasons refused by RATIFIED shape rule: 0 []
reasons refused by NARROW known-key rule: 0 []
```

So this decision buys nothing retroactively. It is entirely about what a future approver is allowed to
write.

**E5 — generic `Key: value` prose inside reasons: 9 commits** (dl-067 E5 measured 8; `main` gained
one). The keys are ordinary English, not trailers: `C`, `A`/`B`, `Action`, `implicit`, `did`, `written`,
`claim`, `cleared`.

```
f304bf7:C   3655166:A/B   58ac6f9:Action   1ee7f00:implicit   f15a434:did
995dfc0:C   a8f607c:written   546b76e:claim   0ef76be:cleared
```

None of these is a *final* paragraph, so none is refused today. But `58ac6f9`'s `Action:` line is
exactly the shape that would be refused had the approver ended the reason on it instead of continuing
— which is the concrete surprise this DL is about.

## Decision

Two options, presented with a recommendation; the approver's choice is recorded in this document's
approve commit `Reason:`.

### (A) Keep the ratified shape rule as implemented

The block terminates at any final paragraph of `Key: value` lines; `--reason` may not end in one.

*For:* already ratified, already implemented, already tested. It is git's own documented heuristic for
a trailer block (git looks at the shape of the last paragraph, not at a key whitelist), so a reader
built this way agrees with `git interpret-trailers` on messages neither tool wrote — including
hand-written commits, merge-tool output and anything a future contributor's hook adds. No key list to
maintain and no question about what belongs on it.

*Against:* it refuses reason text that is not a trailer and could not be mistaken for one by anybody
reading it. An approver ending a reason on a lone `Action: amend spec-015 §3` line — a form this
project's own approver has already used mid-reason nine times (E5) — gets `invalid flag value` and no
obvious explanation of why that line is special. It also needs the `start + 1` special case (E3) to
avoid eating a single-line reason paragraph, which is a sign the rule is slightly wider than the thing
it is trying to name.

### (B) Narrow it to known git-trailer keys — **recommended**

The block terminates only at a final paragraph whose every line's key is a **known git trailer**; the
writer-side refusal narrows to match.

*For:* it is a **strictly smaller refusal** than (A) with the same measured cost — zero, on both
counts (E4) — so it can only ever permit text (A) would have refused, never the reverse. It removes
the `Action:` surprise. It makes the termination rule say what it means: this project's commits end in
`Co-Authored-By:` and nothing else (45/47, E2), and that is the block a reader must skip. And the two
`Reason:`-only commits stop needing a special case to read correctly (E3).

*Against:* a key list is a maintenance surface and a source of disagreement (does `Fixes:` count?
`Refs:`? a hook-added `Change-Id:`?). It **diverges from git's own heuristic**, so a trailer this
project does not list would be read as part of the reason where `git interpret-trailers` would not — a
real risk for a project whose commits are written by several tools. And it reopens a clause the
approver has already ratified, for a benefit that is entirely hypothetical today.

### Sub-questions to settle with the main option

- **S1 — the key list, if (B).** Minimal (`Co-Authored-By` only, which is 45/45 of what this project
  actually emits) or the conventional set (`Co-Authored-By`, `Signed-off-by`, `Reviewed-by`,
  `Acked-by`, `Tested-by`, `Reported-by`, `Suggested-by`, `Cc`, `Fixes`, `Closes`, `Refs`)?
  Minimal is honest about the corpus and maximally permissive for reason prose; conventional is more
  robust to a contributor whose tooling adds a standard trailer. *Recommendation:* the conventional
  set, matched case-insensitively — the cost of a false *non*-terminator (a real trailer read into the
  reason) is worse than the cost of a false terminator, and the extra keys are all shapes no one writes
  as prose.
- **S2 — does `start + 1` stay?** Under (B) the two `Reason:`-only commits no longer need it, but it
  costs nothing and protects against any future key list that accidentally includes `Reason`.
  *Recommendation:* keep it, and document it as belt-and-braces rather than load-bearing.
- **S3 — where the rule is written down.** `dl-067`'s clause 2 and 4 are the ratified text; whichever
  option wins, `spec-008-cli-grammar` §2's `--reason` row (already scheduled for amendment by `dl-067`
  action 1) should state the termination rule explicitly rather than leave it to the implementation.
  *Recommendation:* yes, in the same amendment — one visit to an `approved` spec, not two.
- **S4 — if (A) wins, does the refusal message change?** "must not end in a paragraph of \"Key: value\"
  lines" describes the rule accurately but does not tell the author what to do. *Recommendation:* if
  (A), add the remedy to the message (e.g. "— add a line of prose after it, or reword the last line");
  a refusal an author cannot act on is the actual cost being accepted.

## Rationale

(B) is recommended on the narrow ground that it is a **subset**: E4 shows both rules refuse nothing on
178 commits, so choosing (B) cannot break any existing reason, and every future reason (B) accepts is
one (A) would have refused for a reason the author cannot see. When two rules have identical measured
cost and one is strictly more permissive over text that is provably not a trailer, the more permissive
one needs less justification, not more.

The supporting arguments are weaker and are stated as such:

- E2 corrects the premise this was raised on. "Zero other keys" is false — 2 of 47 trailing
  trailer-shaped paragraphs are `Reason:` — and the shape rule reads them correctly only because of an
  explicit `start + 1` floor (E3). That is not an argument that (A) is broken; it is evidence that the
  shape rule names a slightly larger set than the thing it is for, which is (B)'s whole claim.
- E5's nine generic `Key: value` prose lines show the approver writes in a register where a
  colon-keyed line is ordinary. None is currently refused, so this is about the next one, not a
  repair.

The honest case **against** (B), and the reason this is the approver's call rather than a
recommendation to execute: it trades agreement with git's own heuristic for a project-local key list,
on a codebase whose commits are produced by more than one tool, to fix a surprise nobody has yet hit.
If the approver values "our reader and `git interpret-trailers` never disagree" above "no author is
ever surprised", (A) is correct and this DL should close with (A) recorded.

## Actions

Conditional on the outcome:

1. **If (B):** amend `dl-067` clause 2 (termination) and clause 4's corollary (the
   `trailing-trailer-paragraph` refusal) to the known-key form, with a dated Revision note and
   re-ratification — `dl-067` is `ready`, so this is an amendment, not an edit. Then hand the narrowed
   rule to `task-072-fix-reason-trailer-contract` (currently `in-progress` on
   `task/task-072-fix-reason-trailer-contract`, HEAD `bfcc74b`), whose `trailerParagraphStart`,
   `reasonDefect` and their tests change together.
2. **If (A):** record the ratification here and, per S4, decide whether the refusal message gains a
   remedy clause. Nothing else moves.
3. **Either way:** `spec-008-cli-grammar` §2's `--reason` row states the termination rule explicitly,
   folded into the amendment `dl-067` action 1 already schedules (S3).
4. **Either way:** correct the trailing-paragraph figures wherever they are quoted — the shape-rule
   corpus is **47** trailing trailer-shaped paragraphs over **178** commits at `ba2cad0`, of which
   **45** are `Co-Authored-By` and **2** are `Reason:`-only, not "44, zero other keys".

## Relations

- **Amends (if (B)):** `dl-067-reason-trailer-contract` (`ready`) clauses 2 and 4;
  `spec-008-cli-grammar` §2 (`approved`, via `dl-047-tech-specs-carry-no-version-field`).
- **Hands to:** `task-072-fix-reason-trailer-contract` (`in-progress` on its branch, `backlog` on
  `main`) — it owns `trailerParagraphStart`/`reasonDefect` and is in rework already.
- **Fixes nothing, and says so:** `bug-042-reason-text-has-no-contract-against-commit-trailer`
  (`planned`) is closed by `dl-067` either way; this decision changes only which future reasons are
  refused.
- **Adjacent, not absorbed:** `bug-050-reason-control-characters-fabricate-history-entries` (filed in
  this batch — a `0x1e` in the reason corrupts `memory history` under **both** options; neither rule
  sees it, since neither splits on control characters),
  `bug-051-commit-cleanup-never-pinned` (filed in this batch — the stored body's normal form is ambient
  git config, so any termination rule reads text that may already have been altered),
  `dl-054-submit-commit-subject-bracket`, `dl-055-core-error-details-never-reach-operators` (governs
  whether the refusal message in S4 reaches the operator at all).
- **Traceability:** P1.7 (approver identity + timestamp + reason), P1.8, P1.9, P1.10 (`memory history`
  reads the block back), REQ-SEC-02 (git history is the audit trail), REQ-SEC-04.
