---
id: "task-086-fix-reason-control-chars-history-forgery"
type: task
title: "Stop a `--reason` containing the git-log framing control characters from fabricating a `memory history` entry whose sha is caller-supplied text"
status: in-progress
release: "v0.2"
priority: "high"
tags: ["v0.2", "memory", "security", "audit-trail"]
ref: "bug-050-reason-control-characters-fabricate-history-entries"
bug: ["bug-050-reason-control-characters-fabricate-history-entries"]
depends_on: ["task-072-fix-reason-trailer-contract"]
tmpl_version: 260703
---

## Description

`src/memory/git-log.ts` frames `git log` output with `FIELD_SEP` (`0x1f`) and `RECORD_SEP` (`0x1e`),
documented as characters "a real commit subject/body never contains, so splitting on it needs no
escaping". `--reason` is arbitrary free text that lands in the commit body, so that documented
guarantee is false by construction.

A reason carrying `0x1e` splits one commit's record in two, and `wingfoil memory history` then prints
a **fabricated entry whose `sha` is the caller-supplied text**, emits `fatal: invalid object name` on
stderr, and reports the genuine approval with `from: null`. The verb exits `0` and reports success.

This is the audit trail the Memory verbs exist to produce (**P1.7**, **P1.10**), in the release that
ships those verbs. An operator can forge a history entry with an ordinary argument and no privilege.
`task-072`'s ratified `Reason:` grammar does **not** close it — `bug-050` measured that on task-072's
own branch — so do not assume the trailer contract helps.

## Acceptance Criteria

- **AC1** — Reproduce the forgery first, end to end, against the CLI as built from this branch's base,
  and record the exact commands and output. A fix whose defect was never reproduced by the person
  fixing it is not accepted here: `bug-050` gives the recipe, but re-derive it rather than pasting it.
- **AC2** — After the fix, a reason containing `0x1e`, `0x1f`, or both, at any position — start, middle,
  end, repeated, and as the entire reason — produces a `memory history` output with **exactly one**
  entry per commit, correct `sha`, correct `from`/`to`, and no `fatal:` on stderr.
- **AC3** — The reason text itself is preserved in whatever form the design chooses (escaped, rejected
  at input, or parsed by a framing that cannot collide). If the chosen design **rejects** such a
  reason instead of carrying it, the refusal must be an explicit error at exit `2` naming the offending
  character — never a silent strip, and never exit `0`.
- **AC4** — Whatever guarantee replaces the current one is **stated truthfully** in the TSDoc of
  `git-log.ts`. The present comment asserts something false; leaving a weaker-but-true statement is
  required, and it must be derivable from the code rather than aspirational.
- **AC5** — A test pins the forgery itself, not only the happy path: it must fail against the current
  code. State the command that shows it failing before the fix and passing after.
- **AC6** — Other control characters are swept, not assumed. Establish what the parser does with `0x00`,
  `0x0a`, `0x0d` and any other character the framing or the `--format` string relies on, and either fix
  them in the same pass or record why each is harmless, with the command that settles it.
- **AC7** — `dl-067`'s `Reason:` block contract (CLAUDE.md §5.1, ratified via `task-072`) is not
  weakened. If the fix interacts with it, say exactly how; the two must be consistent, and neither may
  silently reinterpret the other.
- **AC8** — All six gates green; the full `tsc --noEmit -p tsconfig.json` silent.

## Implementation Notes

- Read `task-072-fix-reason-trailer-contract`'s Execution Notes first (`dl-015` read_related): it owns
  the `Reason:` grammar and measured that its contract does not close this hole.
- The framing lives in `src/memory/git-log.ts` (`FIELD_SEP`, `RECORD_SEP`) and is consumed by the
  history reader; `memory approve`/`reject` are the write side that carries `--reason` into the body.
- Design space worth weighing before choosing, and the choice belongs in the design notes: escape the
  separators on write; use `git log -z` / `%x00`-style framing that cannot collide with body text;
  parse by commit count rather than by separator; or refuse the input. Each has a different blast
  radius on already-committed history, and **the fix must not make existing commits unreadable** —
  whatever is already in `main`'s history must still parse.
- Classify every AC per `dl-014`/T1 before writing code. AC1/AC2/AC5 are red-first by construction.

## Execution Notes

<!-- filled in per phase -->
