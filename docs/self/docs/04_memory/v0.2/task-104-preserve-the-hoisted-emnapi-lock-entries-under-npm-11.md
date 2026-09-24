---
id: "task-104-preserve-the-hoisted-emnapi-lock-entries-under-npm-11"
type: task
title: "Stop an ordinary `npm install` on npm 11 from reverting the two hoisted `@emnapi` lock entries the release gate needs, and make the reversion fail a check instead of passing silently"
status: pending
release: "v0.2"
priority: "medium"
tags: ["v0.2", "release", "tooling"]
ref: "bug-063-npm-11-erases-hoisted-emnapi-lock-entries"
bug: ["bug-063-npm-11-erases-hoisted-emnapi-lock-entries"]
depends_on: []
tmpl_version: 260703
---

## Description

`task-080` made the release gate installable by adding two hoisted `@emnapi` entries to
`package-lock.json` — `@napi-rs/wasm-runtime` declares them as required peers and npm 10.9.x refuses a
lock without them. Under **npm 11.x a plain `npm install` removes both again**; the scoped `overrides`
block in `package.json` does not preserve them.

Every developer on this project has npm 11. So the lockfile that lets the release run can be reverted
between now and the tag, as a side effect of an unrelated command, by someone who has no reason to
look at it.

This does not affect the published artefact. It affects the publish **succeeding**, and succeeding a
second time.

## Acceptance Criteria

**AC1 — reproduce first, with versions recorded.** `npm --version` and `node --version`; the two
entries present; `npm install`; the two entries gone. Paste the `git diff` of `package-lock.json`, not
a description of it. If it does **not** reproduce on the npm now installed, that is the finding —
report it and stop rather than fixing something that is no longer true.

**AC2 — the entries survive an ordinary `npm install`.** Whatever mechanism you choose, the test is
the ordinary command a developer runs without thinking, not a special one they must remember.

**AC3 — a reversion fails a check rather than passing.** This is the durable half. `task-080` fixed
the lock and nothing noticed when it came undone; a fix that only restores the entries has the same
shape. Add a gate — the `lint.clean` suite, a jest case, or a `prepack` check — that fails when the
two entries are absent, and name in the failure what to do about it.

**AC4 — `npm ci` still works on the pinned CI npm.** The gate job is what this exists to protect;
confirm the fix does not break the version it was built for. `.github/workflows/publish.yml` pins the
Node version — read it rather than assuming which npm ships with it.

**AC5 — say what the mechanism costs.** A `postinstall`, a committed `.npmrc`, a different
`overrides` shape and a lockfile check all have different failure modes for a **consumer** installing
`wingfoil` from npm. The package ships `dist` and `README.md` only, so most of this is invisible to
them — confirm that rather than assuming it.

## Implementation Notes

- AC1 is measurement; AC3 is **red-first** (remove the entries, watch the new check fail); AC2 and
  AC4 are characterization-by-execution. There is no unit test for "a package manager did something",
  so the evidence is the transcript.
- `bug-046` and `bug-048` are adjacent and **not in scope**: the lockfile carries its own `engines`
  copy that nothing asserts, and CI pins a Node version two dev dependencies reject. If your work
  makes either easier to fix, say so in the notes; do not absorb them.
- This is the one task in the wave that can make `main` uninstallable if it goes wrong. Work in your
  worktree, and re-run `npm ci` from a clean `node_modules` before submitting.
