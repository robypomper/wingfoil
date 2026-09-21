---
id: "bug-063-npm-11-erases-hoisted-emnapi-lock-entries"
type: bug
title: "A plain `npm install` under npm 11.x silently deletes the hoisted `@emnapi` lock entries that make the release gate installable, reverting task-080"
status: open
severity: "medium"
release-origin: "v0.2"
release: ""
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`task-080-fix-npm-ci-under-pinned-npm` made the release gate installable by adding two hoisted
`@emnapi` entries to `package-lock.json`, because `@napi-rs/wasm-runtime` declares them as required
peers and npm 10.9.x refuses a lock that lacks them. Under npm 11.x a plain `npm install` removes
both entries again — the scoped `overrides` block in `package.json` does not preserve them — so any
developer running an ordinary install on the npm this repository's developers actually have will
revert the fix as a side effect of an unrelated command.

## Steps to Reproduce

1. Clone `main` at or after `fdee8cb` into a throwaway directory (the fix is present: the lock carries
   `node_modules/@emnapi/core` and `node_modules/@emnapi/runtime` at `1.11.3`, and `package.json`
   carries `overrides` scoped to `@napi-rs/wasm-runtime`).
2. With npm **11.6.2** on `PATH`, run `npm install --package-lock-only --no-audit --no-fund`. It
   reports `up to date` and exits 0.
3. Read the two entries back out of the lock. Both are **absent**.

Reproduced here on 2026-09-21 against `main` `fdee8cb`, npm 11.6.2, in a `--depth 1` clone outside
every worktree:

```
before node_modules/@emnapi/core 1.11.3
before node_modules/@emnapi/runtime 1.11.3
overrides: {"@napi-rs/wasm-runtime":{"@emnapi/core":"1.11.3","@emnapi/runtime":"1.11.3"}}
npm 11.6.2 → up to date in 2s
after node_modules/@emnapi/core ABSENT
after node_modules/@emnapi/runtime ABSENT
```

## Expected Behavior

A lockfile entry that an npm version requires should not be removable by a different npm version
running a routine command, or — if the two npm versions genuinely disagree about what the lock should
contain — the disagreement should be visible at the moment it happens rather than discovered later by
a gate.

## Actual Behavior

npm 11.x writes a lock that npm 10.9.x rejects, and it does so silently, reporting `up to date`. The
same command under npm 10.9.0 preserves both entries. Nothing in the diff explains why the entries
left, and `npm ls` does not attribute them to anything, so a reader meeting the diff has no path back
to the reason.

## Notes

**The guard exists and works, which is why this is `medium` and not `high`.** `npm ci` never rewrites
a lockfile, so the release gate cannot be broken by this in passing, and `task-080` shipped
`test/cli/lockfile-peer-overrides.test.ts`, which reports every required peer edge a hoisted entry
declares with no hoisted entry to resolve from. Verified here rather than assumed: the reverted
lockfile produced above, dropped into a detached worktree of `main`, turns that suite red —
`3 failed, 4 passed` — naming both `@emnapi` edges. So the revert is loud, not silent, the moment
anything runs the suite. What remains is that the revert happens at all, on a routine command, with
no signal at the moment it is committed.

This is one half of the asymmetry `dl-076-toolchain-divergence-unexercised-until-tag`
(`in-discussion`) is about, seen from the local side: `bug-056` was CI's npm rejecting a lock written
by a developer's npm, and this is a developer's npm discarding what CI's npm requires. Neither side
is wrong in isolation; there is simply no declared answer to which npm authors this file.
`dl-069-lockfile-drift-unguarded` (`ready`) is ratified as option (b) only, and option (b) is exactly
the hand-maintained pin this bug bounds — that limitation is recorded in dl-069's own approve commit
and in `bug-056`'s closure, so this bug is the schedulable form of something already written down
twice.

A fix is not obvious and should not be assumed to be "pin harder". Candidates worth weighing when
this is triaged: declaring `packageManager` so corepack makes every local npm the CI one (which is
`dl-076` option (A), and would dissolve this bug rather than fix it); a repository guard that fails
when the lock loses a required peer edge, i.e. running `task-080`'s existing suite in a hook or an
early CI job rather than only inside `npm test`; or accepting the revert and re-adding the entries
whenever CI rejects the lock, which is the status quo with extra steps.

## Triage & Execution Notes

- triage (2026-09-21): **medium**. It reverts a fix that a release blocker depended on, which is
  serious, but it cannot reach the gate silently — `npm ci` does not rewrite the lock and the
  existing suite fails loudly on the reverted file. No fix task filed: the sensible fix is very
  likely a consequence of `dl-076`'s ratification rather than a change of its own, and filing a task
  now would pre-commit to a shape the approver has not chosen.
- Raised by the reviewer of `task-080` as a non-blocking finding, proposed in that task's report, and
  reproduced independently here before filing rather than taken on the reviewer's word.
