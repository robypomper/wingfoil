---
id: "task-105-confine-the-memory-store-to-the-project-root"
type: task
title: "Make `resolveConfinedMemoryPath` resolve before it compares, so a symlinked Memory directory cannot put an element outside the project root"
status: in-progress
release: "v0.2"
priority: "high"
tags: ["v0.2", "storage", "memory", "security"]
ref: "bug-117-memory-add-writes-outside-the-project-root-through-a-symlinked-store"
bug: ["bug-117-memory-add-writes-outside-the-project-root-through-a-symlinked-store"]
depends_on: ["task-102-directive-remove-confines-its-deletion-to-the-project-root"]
tmpl_version: 260703
---

## Description

`resolveConfinedMemoryPath` (`src/storage/memory-path.ts`) compares **textually**. When a Memory
type's directory is a symlink pointing outside the project root, `memory add` writes the element
there, fails on `git add` with a raw unmapped git message, and records nothing — leaving a file
outside the user's project and no trace that anything was written.

REQ-SEC-06 places the confinement boundary at the project root. This is `bug-044`'s crossing, in the
pillar the requirement was written for, on a far more ordinary command.

**`task-102` has already built the repair**; this task uses it. That task extracted `escapesRoot`
(the single containment predicate) and `resolveRealPathInRoot`, which real-resolves a target's
**parent** and deliberately leaves the leaf alone. `resolveConfinedMemoryPath` calls `escapesRoot`
today but hands it an **unresolved** path — exactly the comparison that passes for this input.

## Acceptance Criteria

**AC1 — reproduce first, and record what was written where.** Build the CLI, make a throwaway
project whose `docs/memory/<type>` is a symlink to a directory outside it, commit, run `memory add`.
Record the exit code from `$?` directly, the stderr verbatim, and **whether a file appeared outside
the root**. That last one is the AC.

**AC2 — the check precedes the write.** Resolve, compare, refuse — before any file is created. A fix
that writes and then reports is not a fix; `task-102`'s reviewer proved this by mutation, finding the
error-message and no-commit assertions still passing while the outside file was destroyed.

**AC3 — the refusal is a mapped `CoreError` at exit 1** (`spec-005` §1), naming the path and saying
it resolves outside the project root. No raw git text reaches the operator.

**AC4 — reuse `task-102`'s primitives; do not write a second boundary.** `escapesRoot` and
`resolveRealPathInRoot` exist. If either does not fit, say precisely why rather than adding a third
definition of "inside the project root" — two places deciding confinement is how a guarantee becomes
a suggestion.

**AC5 — the leaf stays unresolved, and you must understand why before you touch it.** `task-102`
resolves the **parent** only, so a symlinked **file** inside a real directory still behaves —
`unlink` removes the link, and that case is verified safe in `bug-044`. Real-resolving the leaf reds
two of its tests. Preserve the asymmetry and pin it on this path too.

**AC6 — the TSDoc sentence is already false and `task-102` is correcting it.** Check what landed
before writing your own: it claimed "no filesystem answer exists for a path that does not exist yet",
which `realpathOfDirectory` refutes. Do not reintroduce it in different words.

**AC7 — every Memory write path, not only `memory add`.** `resolveConfinedMemoryPath` serves the
whole pillar. Enumerate its callers and check each; if one is unreachable or already guarded, say
which and how you established it.

**AC8 — the ordinary path is unchanged.** A Memory directory genuinely inside the project still
writes, still commits, still exits 0. Characterize before touching anything.

## Implementation Notes

- **This task cannot start before `task-102` lands.** Both change `src/storage/memory-path.ts`, and
  `task-102`'s correction is in flight in that file. Read its Execution Notes first (`dl-015`) —
  especially its argument about why a guard over a physical filesystem effect resolves on the
  filesystem rather than at `HEAD`, which applies here unchanged.
- AC1 is measurement, AC2/AC3 are **red-first**, AC5 and AC8 are **characterization**.
- **Your fixture can damage the machine it runs on.** It symlinks outside a temp directory and then
  writes. Build the outside directory inside a *second* `mkdtemp`, and assert on what appears there
  rather than on an error string alone.
- `bug-118` is adjacent and **not in scope**: the dirty-target guard is blind to any path beyond a
  symlink, which is why it did not catch this. Do not widen into it; if your work makes it cheaper to
  fix, say so.
