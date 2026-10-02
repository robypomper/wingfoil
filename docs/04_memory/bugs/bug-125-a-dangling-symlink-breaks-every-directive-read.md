---
id: "bug-125-a-dangling-symlink-breaks-every-directive-read"
type: bug
title: "One dangling symlink under `.wingfoil/directives/` makes every directive read fail with a raw `ENOENT`, including the read-only `directives list`"
status: in-progress
severity: "medium"
release-origin: "v0.2"
release: "v0.3"
feature: "P3.5"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`collectFiles` (`src/core/loaders.ts`) calls `statSync` on every entry it finds. `statSync` **follows**
a symlink, so a single dangling link under `.wingfoil/directives/` throws, and the raw error reaches
the operator:

```
$ wingfoil directives list
error: ENOENT … stat '…/dangling.md'      exit 1
```

`directive remove` fails the same way. **One broken link disables the whole pillar's read surface**,
including the command whose only job is to show what is installed.

## Steps to Reproduce

Create a symlink under `.wingfoil/directives/custom/` pointing at a path that does not exist, then run
`wingfoil directives list`.

## Expected Behavior

An unreadable entry is skipped with a diagnostic naming it, or reported as a mapped `CoreError`. A
read-only listing does not fail wholesale because one of its entries is broken.

## Actual Behavior

The first bad entry aborts the read, with a raw Node error rather than WingFoil's error format.

## Notes

**Two defects in one, and they should be fixed together.** The *blast radius* — one entry killing the
whole listing — and the *leak* — a raw `ENOENT` where `spec-005` §3 defines the format. The second is
`bug-071`/`bug-093`'s family, in a third place.

**`lstat` is the natural fix and it now exists.** `task-106` added `targetIsSymlink`
(`src/storage/confinement.ts`), which uses `lstatSync` precisely because it does not follow the link.
`collectFiles` needs the same distinction: see the entry, decide about it, rather than resolve it and
inherit whatever the resolution hits.

**It is `medium` rather than `low` because of the surface it takes down.** `directives list` is one of
the first commands a new user runs to see what the tool installed, and a dangling link is the kind of
thing a half-finished manual edit leaves behind. Nothing about it requires bad intent.

**Pre-existing, and untouched by any task in this wave.** Found by `task-102` while probing around its
own fix, confirmed verbatim by its reviewer, and not registered at the time.

## Triage & Execution Notes

- triage (2026-09-25): **medium**. Nothing is destroyed and nothing is written, but a read-only
  command fails in a way that names no WingFoil concept and offers no way forward.
