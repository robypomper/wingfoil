---
id: "bug-087-element-ids-derived-from-the-worktree"
type: bug
title: "`nextSequenceNumber` derives an element's id by counting files in the working tree, so a gapped sequence produces an id whose path is already occupied"
status: open
severity: "medium"
release-origin: "v0.2"
release: ""
feature: "P1.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`nextSequenceNumber` (`src/memory/add.ts`) counts matching `.md` files with `readdirSync` of the
**working tree** and returns count + 1. A gap in the sequence — an element removed, or a working tree
that disagrees with `HEAD` — therefore yields an id whose path an existing element already occupies.

Before `task-092` the write was **unconditional**, so the collision silently overwrote the occupant:
`wf(adr): add adr-001-x` produced a commit that **deleted three lines of a committed ADR**. The
reviewer of that task then established the sharper form: it does not need a dirty tree at all. With
`adr-001-alpha` removed-and-committed and `adr-002-beta` clean and committed, `memory add` on a
**fully clean, fully committed** repository exits 0 and commits a diff deleting the real content of
`adr-002-beta.md`.

## Steps to Reproduce

1. In a scaffolded project (`bug-075` — a scratch project is required), add two elements of the same
   type so the directory holds `…-001-…` and `…-002-…`.
2. `git rm` the first and commit, leaving a gap: the directory now holds one file, numbered 002.
3. `wingfoil memory add --type adr --title "Beta"` → the counter reads one file and returns 2, so the
   id resolves to the path `…-002-…` already occupies.

Against `main` before `task-092`: exit 0 and a commit whose diff removes the occupant's content.
Against `task-092`'s branch: exit 1, `refusing to create …: something already exists there (at HEAD,
in the index, in the working tree)`.

## Expected Behavior

An element's id is derived from something that cannot collide. A count of files present at one moment
is not that — it is a guess that happens to be right while nothing has ever been removed.

## Actual Behavior

The id is a function of the working tree's current contents, and a gap makes it wrong.

## Notes

**Severity is contingent on `task-092` staying landed, and that is stated deliberately.** Before it,
this was CLI-reachable data loss and would have been `critical`. After it, the destructive face is
gone — the command refuses and tells the user to choose a different title — so what remains is a
usability defect: a legitimate add is refused because the counter guessed an occupied id. If
`task-092` were ever reverted this bug returns to `critical` without changing a line.

**It belongs to `dl-080`'s class even though it looks like arithmetic.** An element's id is a durable
attestation — it appears in the commit subject, in every cross-reference, and in `memory history` —
and it is derived here from the working tree. That is the same rule `dl-080` ratified for every other
gating read, and this read was simply never looked at: it surfaced from the Action-5 sweep that
`task-092` ran and nobody had run before.

Related: `bug-085` is a *different* working-tree read in the *same* verb (the type registry), and
`task-092` guards that verb's *write*. `memory add` therefore carries three instances of one class,
which is worth knowing when the fix is scoped — a single pass over `memoryAddFn` may settle more than
one of them.

## Triage & Execution Notes

- triage (2026-09-23): **medium**, **not a release blocker** — `task-092` removes the destructive
  face, and what is left refuses loudly rather than corrupting quietly.
- Scheduled to **v0.3**. No fix task filed: deriving the id from a non-colliding source is a small
  design question (highest existing number rather than a count; or the committed tree rather than the
  working one) and it should be answered under `dl-080`'s rule with `bug-085` in view.
