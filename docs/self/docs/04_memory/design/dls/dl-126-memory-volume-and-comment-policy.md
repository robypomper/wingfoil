---
id: "dl-126-memory-volume-and-comment-policy"
type: decision-log
title: "Memory grew seven-fold in one release while the code grew two-and-a-half-fold, and nearly half of `src/` lines are comments — a volume and comment policy"
status: in-discussion
context: "retrospective"
release: "v0.4"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`, being filed now). At its `additional-points` gate the
approver accepted the proposal of a compaction and comment policy, with target release v0.4.

**The figures, re-measured.** Both trees were extracted with
`mkdir m && git archive <commit> docs/self/docs/04_memory src | tar -x -C m`, one at `5b16ab61`
(`wf(release): approve minor-v0.1 [releasing → released]`) and one at `a20b346c`, and measured with:

- Memory words: `find m/docs/self/docs/04_memory -name '*.md' -print0 | xargs -0 cat | wc -w`;
- `src/` lines: `find m/src -name '*.ts' -print0 | xargs -0 cat | wc -l`;
- comment lines, meaning lines whose first non-blank characters are `//`, `/*` or `*`:
  the same stream through `grep -cE '^\s*(//|/\*|\*)'`;
- blank lines: `grep -cE '^\s*$'`. Code lines are the remainder.

| Measure | v0.1 (`5b16ab61`) | `a20b346c` | Growth |
|---|---|---|---|
| Memory documents | 85 | 362 | ×4.3 |
| Memory words | 82,359 | 587,277 | ×7.1 |
| `src/*.ts` files | 58 | 84 | ×1.4 |
| `src/` lines | 5,577 | 15,234 | ×2.7 |
| of which comment lines | 2,234 (40.1%) | 7,178 (47.1%) | ×3.2 |
| of which code lines | 2,893 | 7,000 | ×2.4 |
| Memory words per code line | 28.5 | 83.9 | ×2.9 |

Where the words are, at `a20b346c` (files, words, median words per file):

| Path under `docs/self/docs/04_memory/` | Files | Words | Median |
|---|---|---|---|
| `v0.2/` (tasks) | 75 | 315,509 | 3,721 |
| `design/dls/` | 87 | 99,971 | 829 |
| `bugs/` | 136 | 86,642 | 551 |
| `v0.1/` (tasks) | 33 | 37,077 | 1,039 |
| `design/specs/` | 15 | 35,653 | 1,936 |
| `design/adrs/` | 10 | 9,421 | 792 |
| `planning/` | 6 | 3,004 | 373 |

Two further readings:
- **Execution Notes.** In the 75 v0.2 task files, 277,196 of the 315,509 words sit under
  `## Execution Notes`, the template's last section (`awk '/^## Execution Notes/{e=1} e' <file> | wc -w`,
  summed). The median v0.2 task is 3.6 times the median v0.1 task.
- **Process history in code comments.** At `a20b346c`, 1,309 of the 7,178 comment lines name a
  process element (`grep -cE '\b(task|bug|dl|spec|adr)-[0-9]{3}'` over the comment lines), against 466
  of 2,234 at `5b16ab61`.

**Why it matters.**
- **Agents read this.** Memory is loaded into agent context (REQ-PERF-05 bounds that by relevance, not
  by size), and a relevant v0.2 task is a median of 3,721 words before the agent reads anything else.
- **Humans read it too.** The v0.2 retrospective needed eight parallel mining slices to read one
  release's output.
- **Comments restate the process.** A comment that says which task or reject produced a line is a
  second copy of what the commit and the Memory element already record. Comments that restate a
  process fact go stale when it changes: `bug-016`, `bug-096` and `bug-109` are such comments.

## Decision

WingFoil adopts a policy on how much text a Memory element and a source comment carry, and it is
measured release by release. The open choices below remain for the approver.

**Q1 — Memory volume:**
- **(A) structure, not caps.** Each template states what each section is for and a soft length
  guide; Execution Notes end with a short `Outcome` paragraph a reader can stop at; the retrospective
  subsection proposed by `dl-115` holds what the retrospective needs.
- **(B) compaction on close.** When an element reaches a terminal state, its Execution Notes are
  replaced by a summary that cites the commit holding the full text (`git show <sha>:<path>`).
- **(C) measure only.** `dl-089`'s Q16 (Memory volume) moves from `info` to a `trend ↓` metric, with
  no rule behind it.

**Q2 — source comments:**
- **(a) a comment rule in the `code-quality` directive.** A comment explains why the code is as it is
  and what it guarantees; the history of how it got there (which task, which reject, which pass)
  belongs in the commit and the Memory element. One element id per decision a comment depends on, no
  narrative.
- **(b) a lint threshold** on the comment-line share per file.
- **(c) no rule.**

**Recommendation:** Q1 (A) together with (C), Q2 (a).
- **Q1 (A)** makes long text navigable without deleting evidence. (B) rewrites closed elements,
  which the audit trail and every citation into them depend on. (C) alone measures a problem without
  changing anything, but it is the check that shows whether (A) works.
- **Q2 (a)** targets the part of the comment volume that duplicates other records. A ratio threshold
  (b) would also punish the TSDoc that `api-docs.test.ts` requires on every export.

## Rationale

- **Growth is not the problem; the ratio is.** A project that governs itself should produce more text
  than code. Whether it should produce text three times faster than code per release is the question,
  since every word is read again by the next agent or reviewer it is relevant to.
- **Structure keeps the evidence.** The value of Execution Notes is that they were written at the
  time. Compaction would trade that for size; a reading order keeps both.
- **Why v0.4.** No reader is blocked today, and `dl-115` (v0.3) changes the notes' structure first.
  v0.4 decides with one more release of measurements.
- **Trade-off.** (A) and (a) are rules without enforcement beyond review until `dl-089`'s scripts run;
  the measurement is what shows whether they hold.

## Actions

1. **Ratify, choosing Q1 and Q2.** Owner: approver. The choice goes in the approve commit's `Reason:`.
2. **Templates** (`docs/self/.wingfoil/memory/templates/`) gain the section guidance under Q1 (A);
   **`dl-089`'s catalogue** changes Q16 under Q1 (C), through its own catalogue rule.
3. **`code-quality` directive** (`docs/self/.wingfoil/directives/custom/code-quality.md`) gains the
   comment rule under Q2 (a), and the built-in `code-quality` template that `wingfoil init` installs is
   amended the same way, so new projects inherit it.
4. **Existing comments are not rewritten wholesale**; they are brought in line when their file is next
   touched.
5. **Tasks are derived by v0.4 `release-planning` (`build-backlog`)**, not created here.

## Relations

- **Origin:** `retro-v0.2`, the Memory-volume disposition (2026-09-28).
- **Related:** `dl-115-retrospective-notes-written-during-the-release` (the structure of Execution
  Notes); `dl-089-release-health-analyses-before-retrospective` (Q16); `dl-075-no-bare-line-offsets-in-memory`;
  `dl-120-documentation-directive-extensions` (transient facts in durable prose); REQ-PERF-05.
