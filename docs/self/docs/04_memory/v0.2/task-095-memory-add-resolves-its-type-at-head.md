---
id: "task-095-memory-add-resolves-its-type-at-head"
type: task
title: "Resolve `memory add`'s type registry, `path` and `template` from the committed repository, so an element cannot be created against a type no commit defines"
status: backlog
release: "v0.2"
priority: "high"
tags: ["v0.2", "memory", "audit-trail"]
ref: "bug-085-memory-add-reads-the-type-registry-from-the-worktree"
bug: ["bug-085-memory-add-reads-the-type-registry-from-the-worktree"]
depends_on: ["task-091-reads-resolve-at-head", "task-092-writes-refuse-a-dirty-target"]
tmpl_version: 260703
---

## Description

`memory add` reads `memory.yaml` from the **working tree** to decide whether the requested type
exists, where its files land and which scaffold to copy. An uncommitted type is therefore enough to
produce a committed element whose type no commit defines — and the element is then **unreachable**:
`memory submit` and `memory deprecate` both answer `document not found`, and `memory search --type`
finds nothing.

`dl-080-which-baseline-each-command-reads` is `ready`, ratified as option (B): a read that gates an
operation resolves at `HEAD`. `task-091` moved the four transition verbs; `memory add` was outside
its wording because it consults no state machine, and after that task it is **the only Memory verb
still reading its governing document from the working tree**.

Declared a release blocker at `critical`: strictly worse than `bug-081`, which at least left the
element visible and refusing.

## Acceptance Criteria

- **AC1** — Reproduce first, on a scratch project against current `main` (`bug-075`): an uncommitted
  type, `memory add` at exit 0, `git show HEAD:.wingfoil/memory.yaml` lacking the type, and every
  verb answering `document not found` after the tree is restored. Commands in the notes.
- **AC2** — After the fix the type registry, the type's `path` and its `template` all resolve at
  `HEAD`. **Follow `task-091`'s shape**: remove the parameter so the decision is unreachable from a
  working-tree copy, rather than adding a guard. `loadMemoryYamlAtHead` already exists and is public.
  If one of the three reads cannot be moved that way, say why rather than substituting a guard.
- **AC3** — Refusal exits **`1`** per `spec-005` §1 as ruled on `bug-076`, naming the type and saying
  that it is not committed — the diagnostic shape `task-090` and `task-091` established, where a
  second sentence appears only when the working tree and `HEAD` actually disagree.
- **AC4** — **`init` commits `memory.yaml` in the scaffold commit, so there is no bootstrap window**
  — `task-091` measured this; re-verify rather than inherit it. Then decide fail-closed or fail-open
  for an absent or unreadable committed `memory.yaml` and pin the choice.
- **AC5** — The ordinary flows still pass, each pinned: adding an element of a committed type;
  adding after the type was added **and committed**; and `memory add` still refusing an occupied path
  under `task-092`'s absence guard, which must not regress.
- **AC6** — A test pins the defect and fails against current code.
- **AC7** — **`bug-087` is not in scope** — the id counter reading the working tree is a *different*
  read in the same verb, and `task-092` already removed its destructive face. If your change makes it
  trivially closable, say so; do not widen to reach it.
- **AC8** — All six gates green; the full `tsc --noEmit -p tsconfig.json` silent.

## Implementation Notes

- Read `task-091`'s Execution Notes first (`dl-015` read_related): same rule, same shape, same
  diagnostic, and its AC5 sweep is what found this bug.
- `memory add` carries **three** instances of `dl-080`'s class — this read, `bug-087`'s id counter,
  and the write `task-092` guarded. A single pass over `memoryAddFn` may settle more than one; say
  which you touched and which you deliberately left.
- Classify every AC per `dl-014`/T1. AC1, AC2, AC3 and AC6 are red-first by construction.

## Execution Notes

<!-- filled in per phase -->
