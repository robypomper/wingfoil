---
id: "bug-071-read-status-at-leaks-git-stderr"
type: bug
title: "`readStatusAt` runs `git show` without `stdio`, so `memory history` prints a `fatal:` from git on every run, clean ones included"
status: open
severity: "low"
release-origin: "v0.2"
release: ""
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`readStatusAt` in `src/memory/audit.ts` invokes `git show <sha>:<relativePath>` through
`execFileSync` with no `stdio` option, so the child inherits this process's stderr. When the walk
reaches a commit in which the document did not yet exist at its current path — an ordinary outcome of
a `--follow` history — git writes `fatal: path '<doc>' exists on disk, but not in '<sha>'` straight to
the operator's terminal. The command still exits `0` and its output is correct.

## Steps to Reproduce

```
$ grep -n "'show'" src/memory/audit.ts
233:    raw = execFileSync('git', ['-C', root, 'show', `${sha}:${relativePath}`], { encoding: 'utf-8' });
```

Read on `main` at `e933f53`. Run `wingfoil memory history <any document with renames in its history>`
and read stderr: the `fatal:` lines appear on a successful run.

## Expected Behavior

An expected, handled condition does not print anything, least of all a line beginning `fatal:`.

## Actual Behavior

Every run emits `fatal:` lines that mean nothing is wrong. The failure is not the noise itself but
what the noise costs: **a genuine `fatal:` is now indistinguishable from the routine ones**, which is
exactly the signal `bug-050` depended on — its forged history was accompanied by
`fatal: invalid object name`, and that line is how the defect announced itself.

## Notes

The condition is already documented as a "Known limitation" in `reconstructMemoryTransitions`'s TSDoc,
so it is understood rather than unnoticed; what is missing is suppressing the child's stderr. The fix
is one option on the existing call: `stdio: ['ignore', 'pipe', 'pipe']`, which keeps the captured
stdout the function needs while denying the child the terminal.

`bug-050` observed this and explicitly declined to file it, and `task-086`'s review found it still
unowned. Filed now so it stops being rediscovered.

Note the interaction with `bug-070`: the two CLI integration helpers that would catch a stray `fatal:`
on a passing command return a hardcoded empty `stderr`, so no test can currently see this. Fixing
either one alone leaves the other's value unrealised.

## Triage & Execution Notes

- triage (2026-09-22): **low**. One option on one call, no behavioural change to the command's output
  or exit status, and the noise misleads rather than breaks. It earns its place because it degrades
  the one channel a real failure uses to announce itself.
- No fix task filed: a one-line change, naturally carried by whatever next touches `audit.ts` or by
  `bug-070`'s fix, with which it pairs.


## Correction (2026-09-22) — this bug described a symptom, and its proposed remedy would have hidden the defect

Filed earlier the same day, framing the `fatal:` line as noise from "an expected, handled condition"
and proposing `stdio: ['ignore','pipe','pipe']` to suppress the child's stderr.

**The condition is not expected.** `bug-077-history-follow-attributes-template-commits` reproduces the
cause: `memory history` walks with `git log --follow`, which chases the element back to the template
it was copied from, so the walk yields a commit that never contained the document. `readStatusAt` then
asks `git show <that sha>:<path>` for a path absent from that tree, and git says so. The `fatal:` is
the **only visible symptom** of a fabricated history entry that otherwise carries a real sha, author
and timestamp.

So the remedy proposed here was worse than the defect: suppressing the stderr would have left the
phantom entry in place and removed the one sign that anything was wrong.

**What survives of this bug.** Once `bug-077` is fixed, a `git show` against a commit that genuinely
predates a legitimately renamed path can still print a `fatal:`, and suppressing it then is a real
cosmetic improvement. This bug stays open for that, explicitly **downstream of `bug-077`** and not to
be worked independently — fixing it first would destroy the evidence for the other.

Recorded rather than silently rewritten. The original text stands above, because the reasoning that
produced it is part of what this release should learn from: the line was read as an accepted
limitation because a TSDoc already described it as one, and nobody asked why the condition arose.
