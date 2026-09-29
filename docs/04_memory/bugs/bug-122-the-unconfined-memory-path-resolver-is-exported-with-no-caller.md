---
id: "bug-122-the-unconfined-memory-path-resolver-is-exported-with-no-caller"
type: bug
title: "`resolveMemoryPath` — the unconfined sibling of `resolveConfinedMemoryPath` — is exported from the storage barrel, has no caller in `src/`, and is the shorter name of the two"
status: triaged
severity: "low"
release-origin: "v0.2"
release: ""
feature: "P1.6"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`src/storage/index.ts` exports `resolveMemoryPath`. Nothing in `src/` calls it:

```
$ grep -rln "resolveMemoryPath" src/ test/
src/storage/memory-path.ts
src/storage/index.ts
test/storage/memory-path.test.ts
```

Its confined counterpart, `resolveConfinedMemoryPath`, is **not** exported from that barrel — it is
imported directly by its two callers. So the public surface offers the unguarded function and hides
the guarded one, and the unguarded one has the shorter, more obvious name.

## Steps to Reproduce

The grep above.

## Expected Behavior

Either the unconfined resolver is not part of the public surface, or the difference between the two is
impossible to miss at the call site.

## Actual Behavior

A future caller reaching for the shorter name gets an unguarded path next to a guarded one, with
nothing at the import to tell them apart.

## Notes

**It is a ready-made bypass of everything `task-102`, `task-105` and `task-106` built.** Those three
tasks established one containment boundary, extended it to the Memory store, and added the symlinked
target refusal. All of it sits behind `resolveConfinedMemoryPath`. `resolveMemoryPath` renders the
path and stops.

**Raised by `task-105` and filed late.** Its reviewer confirmed it, `task-106`'s reviewer confirmed it
again independently, and `grep -rln "resolveMemoryPath" docs/self/docs/04_memory/` returned only task
documents — no bug, no decision-log. It was proposed twice and registered neither time; this filing is
the correction, and the delay is recorded because it is the same orchestration failure `bug-108`
carries.

**Three shapes, and the choice is not obvious.** Stop exporting it, so the barrel offers only the
guarded path. Rename it to something that cannot be reached for absentmindedly. Or keep it and make
the guarded one the exported default. The first is cheapest and the third is the one that survives a
careless reader.

## Triage & Execution Notes

- triage (2026-09-25): **low**. Nothing is wrong today — the function is correct at what it does and
  nobody calls it. It is filed for the caller who has not arrived yet, which is the only moment at
  which it is cheap.
