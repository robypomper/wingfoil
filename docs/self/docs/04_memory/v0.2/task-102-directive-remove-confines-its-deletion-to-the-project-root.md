---
id: "task-102-directive-remove-confines-its-deletion-to-the-project-root"
type: task
title: "Refuse before unlinking when a directive resolves outside the project root, so a symlinked `directives/custom` cannot cost someone a file they never pointed the tool at"
status: in-progress
release: "v0.2"
priority: "high"
tags: ["v0.2", "directives", "security"]
ref: "bug-044-symlinked-directives-custom-escapes-confinement"
bug: ["bug-044-symlinked-directives-custom-escapes-confinement"]
depends_on: []
tmpl_version: 260703
---

## Description

When `.wingfoil/directives/custom` is a **symlink to a directory outside the project root**,
`wingfoil directive remove <name>` unlinks the outside file **for real**, and only then fails — with a
raw `Command failed: git … add -- …` that is not a `CoreError`, so the operator gets a leaked git
message instead of a mapped refusal, and nothing records that a file was deleted.

REQ-SEC-06 places the confinement boundary at the **project root**
(`resolveConfinedMemoryPath`, `src/storage`, from `task-017`). This crosses it, and it destroys.

It is not a default path — it needs a symlink, which is a deliberate act. But sharing a directive set
between projects is a reasonable thing to try, and the cost of trying it is a file gone from
somewhere the user never aimed the tool.

## Acceptance Criteria

**AC1 — reproduce first, and record the damage.** Build the CLI, create a scratch project whose
`.wingfoil/directives/custom` is a symlink to a directory outside it, put a directive file in that
outside directory, and run `directive remove`. Record: the exit code from `$?` directly, the stderr
verbatim, **and whether the outside file still exists**. That last one is the AC; the others are
context.

**AC2 — the check happens before the unlink, not after.** The order is the whole defect. Resolve the
target's real path, compare it against the project root, and refuse **before** any filesystem
mutation. A fix that deletes and then reports is not a fix.

**AC3 — the refusal is a mapped `CoreError` at exit 1**, per `spec-005` §1, with a message naming the
path and saying it resolves outside the project. No raw git text reaches the operator —
`bug-071`/`bug-093` are the same family and `bug-093` records the durable remedy.

**AC4 — use the existing primitive.** `resolveConfinedMemoryPath` (`src/storage`, `task-017`) already
computes this boundary. If it does not fit, say precisely why in the Execution Notes rather than
writing a second boundary check — two places deciding confinement is how a guarantee becomes a
suggestion.

**AC5 — symlink resolution, not string comparison.** The path must be resolved (`realpath`) before
comparing. A prefix check on the un-resolved path passes for exactly the input this bug is about.

**AC6 — the ordinary path is unchanged.** A directive genuinely inside the project still removes,
still commits, still exits 0. Characterize this before you touch anything.

**AC7 — the whole verb, not just this entry.** `directive remove` is one caller; check whether
`directive create` and `directive assign` resolve paths the same way and can be pointed outside by
the same symlink. If they can, say so and file it — do not widen this task silently.

## Implementation Notes

- AC1 is a **measurement**, AC2/AC3/AC5 are **red-first** under `dl-014`/T1, AC6 is
  **characterization**. Record the classification per AC.
- The fixture is the delicate part: a test that symlinks outside its own temp directory and then
  deletes is a test that can damage a developer's machine if the boundary logic is wrong. Build the
  outside directory **inside** a second `mkdtemp` so the blast radius is bounded, and assert the file
  survives rather than asserting an error string alone.
- `command-baseline` is now a `custom/` directive bound to `developer` and `reviewer` — read it. The
  read that decides whether to refuse here gates, so it resolves at `HEAD`; the working tree may be
  read to *explain* the refusal, never to decide it.
