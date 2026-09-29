---
id: "bug-137-bracket-regex-skips-ascii-arrow-transitions"
type: bug
title: "`BRACKET_RE` matches only the Unicode `→` arrow, so an ASCII `->` transition bracket is silently skipped by `verifyTransitionConsistency`"
status: planned
severity: "medium"
release-origin: "v0.2"
release: "v0.2.2"
feature: "P1.2"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`src/memory/audit.ts`'s `BRACKET_RE` recognizes only the Unicode `→` arrow in a commit subject's
`[old → new]` transition bracket; a commit written with the ASCII form `[old -> new]` fails the
match and is quietly excluded from `verifyTransitionConsistency`'s coverage rather than being
flagged as unparseable.

## Steps to Reproduce

1. `grep -n "BRACKET_RE" src/memory/audit.ts` → line 333:
   `const BRACKET_RE = /\[([^[\]→]+?)\s*→\s*([^[\]]+?)\]\s*$/;` — the character class and the
   literal both admit only `→`, never `-`/`>`.
2. `sed -n '340,360p' src/memory/audit.ts` shows the caller: `const match = BRACKET_RE.exec(transition.subject); if (!match) continue;` — a non-match is a silent `continue`, not a recorded finding.
3. Count how many of this repository's own `wf()` commits already use the ASCII form instead of
   the Unicode one, at `a20b346c` (main): `git log --format=%s 20e8271..a20b346c | grep '^wf(' | grep -oE -- '\[[^]]*(->|→)[^]]*\]' | grep -oE -- '->|→' | sort | uniq -c` →
   ```
       198 ->
       430 →
   ```
   198 real, already-committed transition subjects use `->` and are therefore never visited by
   `BRACKET_RE.exec`.

## Expected Behavior

A commit subject carrying a transition bracket in either arrow form is parsed; at minimum, a
subject whose bracket cannot be parsed by neither form is reported as an unparseable/unverifiable
transition rather than passed over in silence.

## Actual Behavior

Every one of the 198 ASCII-form subjects is invisible to `verifyTransitionConsistency`: the
function neither validates nor flags them, so REQ-STATE-01's consistency check currently provides
no coverage at all over roughly a third of this repository's own approve/reject/deprecate history.

## Notes

- Per the retrospective's own correction, the ASCII form here is hand-written grammar drift, not
  evidence that a state transition bypassed the tool (every `wf()` commit in this repository is
  hand-written per `bug-075`, still `open`: `grep -n "^status:" docs/self/docs/04_memory/bugs/bug-075-*.md`
  → `status: open`). The defect is narrower than "bypass": the audit's own regex quietly drops
  exactly the commits most likely to carry a typo instead of surfacing them as unparseable.
- Root cause: `BRACKET_RE`'s arrow alternative is a single literal (`→`) rather than an alternation
  over both accepted forms, and the caller treats "no match" as "nothing to check" instead of "found
  an unparseable bracket."
- Fix shape (from the retrospective's disposition): normalize on read to the canonical `→` arrow (or
  accept `->` as an equivalent alternative in the regex) **and** report any subject whose bracket
  still fails to parse, so the check's silence stops meaning "verified" when it actually means
  "skipped." `dl-079-wf-commit-verbs-outside-the-declared-grammar` (`in-discussion`) is the
  decision-log that ratifies the practised `wf()` commit grammar this fix's canonical-arrow choice
  has to sit inside; this bug is a declared prerequisite of that ratification, not a substitute for
  it.

## Triage & Execution Notes

- capture: filed by the v0.2 retrospective (retro-v0.2), from the era-wide commit-grammar mining
  pass over `20e8271..a20b346c`.
