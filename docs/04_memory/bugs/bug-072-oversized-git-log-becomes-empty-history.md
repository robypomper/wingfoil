---
id: "bug-072-oversized-git-log-becomes-empty-history"
type: bug
title: "`walkGitLogFields` sets no `maxBuffer` and swallows the error, so a `git log` past Node's 1 MiB default becomes an empty history rather than a failure"
status: open
severity: "medium"
release-origin: "v0.2"
release: ""
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`walkGitLogFields` in `src/memory/git-log.ts` runs `git log` through `execFileSync` without a
`maxBuffer` option, so Node's 1 MiB default applies, and wraps the call in a `catch` that returns an
empty array. Past that threshold the child's output is truncated and `execFileSync` throws `ENOBUFS`;
the `catch` converts that into "this document has no history" — indistinguishable from a document
that genuinely has none, at exit `0`.

## Steps to Reproduce

1. `grep -rn 'maxBuffer' src/` → one hit, `src/validation/secret-scan.ts`, which sets
   `Number.POSITIVE_INFINITY`. Nothing else in `src/` sets it, `git-log.ts` included.
2. Read `walkGitLogFields`'s `catch`: it returns `[]` for every failure, with no discrimination.
3. Drive any `execFileSync` past 1 MiB of stdout and observe it throws `ENOBUFS` rather than
   returning truncated output.

Measured on `main` at `e933f53`: today's audit-path walk over `docs/self/docs/04_memory` produces
about **208 KB**, and the largest single-document `--follow` walk about **23 KB**. There is headroom.

## Expected Behavior

An output too large to read is an error the operator sees, not an empty result. Either raise
`maxBuffer` — `secret-scan.ts` sets `Number.POSITIVE_INFINITY` and is the in-repo precedent — or
discriminate in the `catch` so `ENOBUFS` surfaces rather than being folded into "no history".

## Actual Behavior

"No history" is reported for a document that has one, and the audit path reports a clean
"0 commits, 0 unknown authors" pass over a walk that never happened.

## Notes

**The urgency stated in the intake was wrong and is corrected here.** `task-086`'s notes quoted
642 KB for the audit field set including `%b`; the reviewer re-measured it at **208 KB** for the walk
that actually runs. The mechanism is real and the fix is still right, but this is not near the
threshold today, which is why it is `medium` and not `high`.

The failure class is the same one `bug-050` belongs to — **a wrong answer reported as success** — and
that similarity is the reason it is worth fixing rather than noting. A history reader that answers
"none" when it means "I could not read it" undermines the audit trail exactly as a forged entry does,
one direction further along: `bug-050` invented a record, this one hides all of them.

It sits inside the file `task-086` rewrote and was deliberately left alone there, correctly — it is a
different defect with a different fix, and folding it in would have widened a security fix's diff.

## Triage & Execution Notes

- triage (2026-09-22): **medium**. No current exposure at roughly 208 KB against a 1 MiB ceiling, but
  the repository's Memory grows monotonically and nothing watches this number. The severity is in the
  failure mode, not in its likelihood today: silent and total.
- No fix task filed: one option on one call, or a discriminating `catch`. The natural carrier is
  whoever next touches `git-log.ts` — `task-086` is in that file now but must not widen its scope.
