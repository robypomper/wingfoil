---
id: "bug-042-reason-text-has-no-contract-against-commit-trailer"
type: bug
title: "`--reason` text has no contract against the single-line `Approver:`/`Reason:` commit trailer: multi-line reasons are truncated on read, a blank reason destroys the whole approval record, and a multi-line one can forge a second Approver line"
status: in-progress
severity: "high"
release-origin: "v0.2"
release: "v0.2"
feature: "P1.7"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

The `Approver:`/`Reason:` commit trailer (CLAUDE.md §5.1, P1.7, REQ-SEC-04) is written and read as two
**single lines**, but `--reason <text>` is arbitrary free text with no shape contract at all — so
arbitrary text meets a line-oriented format with no rule saying what happens. One root cause, three
faces: a multi-line reason is silently truncated on read, a blank reason destroys the entire approval
record, and a multi-line reason can inject a second, forged `Approver:` line into the authoritative
audit record.

## Steps to Reproduce

All three verified on `main` (the reader, `src/memory/audit.ts`, is merged via `task-049-memory-history`
at `b205cf5`; the writer, `formatMemoryCommitMessage` in `src/memory/commit-message.ts`, via
`task-045-memory-submit` at `b5f6676`). The approver-gated verbs that call the writer are `task-046` and
`task-047`. **`task-047` was approved and merged to `main` while this report was being written**
(`c03cca9` approve, `57c412f` finalize, `e890cf9` merge; `main` is now `9147d84`), so `memory reject` —
and with it the `--reason` → trailer path — is shipped, not prospective. `task-046` is still `in-review`
on branch `task/task-046-memory-approve` at `62c7459`, read read-only with `git show`.

**F1 — READ side: a multi-line reason is truncated to its first line.**

`REASON_LINE_RE` is `/^Reason:\s*(.+)$/m` (`src/memory/audit.ts:126`); `.` does not cross newlines, so
`parseCommitReason` (`:147-153`) returns only the first line. It is documented as a known limitation in
that function's own TSDoc (`:141-146` — "a hypothetical multi-paragraph reason would be silently
truncated to its first line here") and is untested.

It is not hypothetical. On `main`, of the 156 `wf(...): approve|reject` commits, **66** carry a `Reason:`
that continues past its first line:

```
for sha in $(git log main --format='%H' --grep='^wf(.*): \(approve\|reject\)'); do
  git log -1 --format=%b $sha | awk '/^Reason:/{f=1;next} f&&NF{c++} f&&!NF{exit} END{print c+0}'
done
# → 156 commits, 66 with a Reason continuing past line 1
# e.g. 8c3fe35 (approve dl-051) 10 extra lines; 995dfc0 (approve dl-042) 9; a651335 (reject task-070) 9
```

Reproduced end to end in a scratch git repository:

```
commit body: "Approver: A <a@b.c> (approver)\nReason: first line of the reason\n
              second paragraph explaining more\nApprover: Eve <eve@evil.test> (approver)\n\n"
REASON_LINE_RE.exec(body)[1]  ->  "first line of the reason"     # the rest is dropped
```

So once `wingfoil memory history` (P1.10) reads back this repository's own history, every one of those 66
reasons loses everything after its first line — silently, with no diagnostic.

**F2 — WRITE side: a blank or whitespace-only `--reason ""` is accepted and destroys the whole record.**

`requireReason` (`src/core/require-reason.ts:39-45`) refuses only `undefined`: `const reason =
options?.reason; if (reason === undefined) throw …; return reason;`. The CLI passes an empty string
through — `buildOptionValues` (`src/cli/program.ts:200-212`) keeps any value where `typeof value ===
'string'`, and its own TSDoc says it does so deliberately "so a core op can distinguish 'not given' from
an empty string". Nothing downstream re-checks: `formatMemoryCommitMessage` emits `Reason: ` on
`reason !== undefined` (`src/memory/commit-message.ts:60-62`), and the verb exits `0`.

Then git's own message cleanup strips the trailing space, leaving a bare `Reason:` — and both trailer
parsers fail on it. Reproduced in a scratch repository:

```
$ printf 'wf(task): reject t-1 [pending → draft]\n\nApprover: A <a@b.c> (approver)\nReason: ' > m1.txt
$ git commit --only -F m1.txt -- f.txt
$ git log -1 --format=%b | cat -A
Approver: A <a@b.c> (approver)$
Reason:$
$
# REASON_LINE_RE.exec(body)  -> null        (no (.+) to capture)
# APPROVER_LINE_RE.exec(body) -> matches    (the approver line is intact)
```

`parseCommitReason` therefore returns `null`, and because `parseApprovalMetadata` is all-or-nothing —
"Returns `null` when either line is absent" (`src/memory/audit.ts:157-176`) — it returns `null` too,
**discarding the approver identity it did successfully parse**. `reconstructMemoryTransitions`
(`:245-267`) sets both fields from those two functions, so the transition is reported with `approval:
null` and `reason: null`: `memory history` shows an approval gate crossed by nobody, for no reason. That
is precisely the record P1.7 and REQ-SEC-04 exist to guarantee, destroyed by an empty string that the
command accepted at exit `0`.

**F3 — WRITE side: a multi-line reason can inject a second, forged `Approver:` line.**

Because the reason is interpolated verbatim into the body (`commit-message.ts:61`) and never validated,
`--reason $'real reason\nApprover: Eve <eve@evil.test> (approver)'` produces a commit body carrying two
`Approver:` lines. Reproduced, same scratch repository as F1:

```
body.match(/^Approver:.*$/gm)
  -> [ 'Approver: A <a@b.c> (approver)', 'Approver: Eve <eve@evil.test> (approver)' ]
APPROVER_LINE_RE.exec(body).slice(1,4)  -> [ 'A', 'a@b.c', 'approver' ]   # the real one
```

## Expected Behavior

`--reason` has a declared contract against the trailer format: a reason that cannot be recorded
faithfully is refused at the CLI boundary (exit `2`) rather than written, and a reason that *is* recorded
reads back identically to what was given. In particular a reason may not be empty, and a multi-line
reason either round-trips in full or is rejected — but is never silently halved, and can never introduce
a second trailer line.

## Actual Behavior

- F1: `memory history` returns the first line of a multi-line reason and drops the rest, with no warning.
  66 of `main`'s 156 approve/reject commits are affected.
- F2: `--reason ""` exits `0`, commits a bare `Reason:` line, and makes `memory history` report that
  transition with approver **and** reason both `null`.
- F3: a multi-line reason can place a forged `Approver:` line in the commit body.

## Notes

- **F3 is not currently an authorization bypass, and is filed for the audit record, not as a privilege
  escalation.** Both regexes carry `/m` and take their **first** match, and `formatMemoryCommitMessage`
  emits the genuine `Approver:` line *before* the `Reason:` line (`commit-message.ts:56-63`), so the real
  approver always wins the parse — confirmed above. And only a principal who already holds the `approver`
  role can run the verb at all (`requireApprovalAuthority`, `src/core/approval-authority.ts:66-72`). What
  is damaged is the commit body itself, which per P1.7/CLAUDE.md §5.1 **is** the authoritative audit
  record: `git log`, a code-review UI, or any reader that is not these two regexes sees two approvers and
  cannot tell which is real.
- **Why this needs a spec decision, not a silent in-task fix.** `spec-008-cli-grammar` §2 declares the
  `--reason <text>` value "Recorded verbatim in the resulting git commit body (P1.7)". Refusing a
  newline, or escaping one, or folding a multi-line reason into a continuation the reader understands,
  are three different answers and all three change what "verbatim" means. Whichever is chosen belongs in
  `spec-008` §2 (the flag's contract) and in CLAUDE.md §5.1 (the hand-written commits that follow the
  same format today).
- **Scope: one root cause, so one fix.** `task-047-memory-reject` (merged) and `task-046-memory-approve`
  (`in-review`) inherit all three faces through the same three helpers — `requireReason`,
  `formatMemoryCommitMessage`, `parseCommitReason`/`parseApprovalMetadata` — and
  `task-048-memory-deprecate` (`in-progress` at `b6175b7`) inherits F1 and F3 for its own `Reason:` line
  (deprecate carries a reason but no `Approver:`, per `audit.ts:131-137`). Splitting this into three bugs
  would put three tasks on one code path.
- **Not a duplicate of `bug-024`.** `bug-024-commander-parse-errors-exit-1` (`open`, `low`) covers
  `--reason` given with **no value at all** exiting `1` where spec-008 requires `2` — a commander parse
  failure, surface-wide, before any core code runs. This bug is about a `--reason` that *is* supplied and
  reaches the trailer: blank, multi-line, or trailer-shaped. Neither fixes the other.
- **Why `medium`.** F2 destroys an audit record at exit `0`, which is the strongest single symptom, but
  it takes a deliberate `--reason ""`; F1 is silent and already applies to 66 real commits but loses
  explanatory prose rather than the decision itself; F3 misleads human readers without changing any
  enforcement outcome. None of the three is exploitable by an unauthorized principal, which is what keeps
  it below `high`.
- Suggested shape of a fix, for whoever schedules it: reject an empty/whitespace-only reason at
  `requireReason` (exit `2`, message pinned in `spec-008` §2); decide the multi-line rule there too, and
  have `formatMemoryCommitMessage` enforce it so writer and reader cannot drift — which is the property
  `commit-message.ts:8-10` already claims for itself; then make `parseApprovalMetadata` stop discarding a
  successfully parsed `Approver:` line when the reason is absent, so a damaged trailer degrades instead
  of vanishing. Each with a regression test, and one that round-trips through a real `git commit` so
  git's own message cleanup (which is what produces the bare `Reason:` in F2) is part of the assertion.

- **AMENDMENT (2026-09-18, after `task-048-memory-deprecate` shipped): F3 IS exploitable by an
  unauthorized principal, and the "why `medium`" paragraph above is falsified for `memory deprecate`.**
  That verb writes **no `Approver:` line of its own** and performs **no `requireApprovalAuthority`
  check** (dl-027: deprecate is not an approval gate). Both premises the paragraph rests on therefore
  fail: there is no genuine `Approver:` line for the first-match regexes to land on, and the caller need
  not hold `approver`. Reproduced by task-048's reviewer:
  `memory deprecate decision-12 --reason $'real reason\nApprover: Mallory <mallory@evil.test> (approver)'`
  makes `reconstructMemoryTransitions` return
  `approval: {approverName:"Mallory", approverEmail:"mallory@evil.test", approverRole:"approver",
  reason:"real reason"}` on a commit that has no approver at all. So `wingfoil memory history` — the
  tool P1.10 defines as the way to read the audit trail — itself reports a forged approval, rather than
  merely a human reader being misled.
  **`memory.deprecate` is registered as an MCP Tool**, so the principal who can do this is an **agent** —
  precisely the one REQ-SEC-03 and adr-006 forbid from holding approval authority.
  Re-graded `medium → high` and scheduled into `v0.2` on the approver's instruction (2026-09-18); the
  fix must land before the v0.2 release gate. The fix itself is unchanged in shape and still needs the
  `spec-008` §2 decision above — it belongs to `formatMemoryCommitMessage` / `requireReason`, not to any
  single verb.

## Triage & Execution Notes

- capture: raised by the review of `task-047-memory-reject` (Wave 2 round 3, 2026-09-18), filed under
  `bug-ingest-rel-v0.2-wave2-review-findings-plan` (second batch). Proposed release `v0.2`: `task-047`
  merged mid-batch (`e890cf9`) so the path is live, `task-046` is `in-review` on it and `task-048` is
  `in-progress` behind it — a fix is cheapest now, while the third verb is still being written. Scheduling
  remains the approver's call, so `release:` is left empty for `release-planning`'s `build-backlog` to
  stamp (`dl-016`).
