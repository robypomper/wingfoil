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
