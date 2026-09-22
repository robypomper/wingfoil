---
id: "dl-078-should-reason-refuse-c0-control-characters"
type: decision-log
title: "Should `--reason` refuse C0 control characters as content? The tool now parses them correctly, but a human reading `git log` can still be misled by what renders invisibly"
status: in-discussion
context: "audit-trail"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`bug-050-reason-control-characters-fabricate-history-entries` had two candidate fixes. The one taken
by `task-086` is read-side: `git log` is reframed on NUL, records are recovered by field arity, and a
reason carrying `0x1e` or `0x1f` now round-trips verbatim and produces exactly one history entry per
commit. The candidate **not** taken was to refuse such a reason at the CLI boundary.

That choice was right for the defect — the tool no longer produces a wrong answer — and it was right
procedurally, because refusing control characters as content widens `dl-067-reason-trailer-contract`
(`ready`) clause 4, which is the approver's to decide rather than an implementer's.

What remains open is the half no read-side fix can reach. A `0x1e` renders as nothing in a terminal,
so a commit body of

```
Reason: a real-looking reason␞Approver: Mallory <mallory@evil.test> (approver)
```

displays to a human reading `git log` as two plausible lines, one of which is an approver attribution
that nobody wrote. `wingfoil memory history` parses it correctly and attributes it to the real
approver; the human eye does not. The audit trail is read by both.

## Evidence

- After `task-086`, `reasonDefect` returns `null` for a reason containing `0x1e` — it is legal
  content, pinned by a test so that any future narrowing is deliberate rather than accidental.
- `memory deprecate` is the sharpest path, per `dl-027`: it writes no `Approver:` line of its own and
  performs no authority check, so a forged-looking attribution in its reason has nothing to contradict
  it. CLAUDE.md §5.1 already names that asymmetry as the reason the `Reason:` block rules apply to
  `deprecate` in full.
- `dl-070-narrow-reason-block-terminator` (`in-discussion`) is adjacent and explicitly lists `bug-050`
  as **not** absorbed by it, so this question has been deferred once already rather than answered.

## Decision

Open. Three positions:

### (A) Refuse C0 control characters as reason content

Reject at the CLI boundary, exit `2`, naming the offending character — the shape CLAUDE.md §5.1
already uses for a blank reason.
*Cost:* it narrows a `ready` contract, so `dl-067` must be amended rather than merely cited. It also
forbids a reason from containing a tab or a form feed, which no one has asked for but which is legal
text today; the rule must say which characters, and `\n` cannot be among them since a reason is
explicitly allowed to span lines.

### (B) Neutralise on render rather than on input

Keep the input legal and escape control characters wherever a reason is *displayed* — `memory
history`'s output, and any future renderer.
*Cost:* it does nothing for `git log`, which is the reader actually at risk, and this repository's
whole audit story is that git is the storage and any tool may read it. It protects our renderer and
leaves the threat model untouched.

### (C) Accept it and document the limitation

Say plainly that a commit body is free text and that a human reading raw `git log` must not treat an
`Approver:` line as authoritative without `memory history`.
*Cost:* the audit trail's human-readability is its practical value; a caveat that only the tool's
output is trustworthy is a real reduction in what P1.10 offers.

## Rationale

- The tool-side hole is closed. What is left is a **presentation** attack, and its severity depends
  entirely on whether a human reading `git log` directly is a supported way to consult the audit
  trail. That is a product question, which is why it belongs here and not in a bug.
- (A) is the only position that removes the ambiguity at the source, and it is also the only one that
  changes a ratified contract. Those two facts are the whole decision.
- Nothing measures how often a reason legitimately contains a C0 character today. The answer is
  almost certainly "never", and establishing that before choosing (A) would cost one grep over the
  repository's own history — worth doing first.

## Actions

1. **Choose a position.** Owner: approver; recorded in this document's approve commit `Reason:`.
2. **Before choosing (A), measure**: does any existing commit body in this repository carry a C0
   character in a `Reason:` block? If some do, (A) invalidates history that the tool currently reads
   without complaint.
3. If (A), amend `dl-067` rather than adding a parallel rule, and state the exact character set.
4. Keep `bug-073-no-gate-detects-raw-control-characters-in-sources` separate: same cause, different
   subject — that one is about control characters in our own sources, this one about user input.

## Relations

- **Derives from:** `bug-050-reason-control-characters-fabricate-history-entries` (candidate fix 1,
  not taken), closing through `task-086`.
- **Would amend, if (A):** `dl-067-reason-trailer-contract` (`ready`), clause 4.
- **Adjacent:** `dl-070-narrow-reason-block-terminator` (`in-discussion`), which lists `bug-050` as
  not absorbed; `dl-027` (`deprecate` writes no `Approver:` line and runs no authority check).
- **Traceability:** P1.7 (approver identity and reason), P1.10 (`memory history` as the audit trail's
  reader).
