---
id: "bug-056-npm-ci-fails-under-pinned-npm-10-9"
type: bug
title: "`npm ci` fails in the release gate under npm 10.9.0 — the npm the pinned NODE_VERSION 22.12.0 bundles"
status: closed
severity: "high"
release-origin: "v0.2"
release: "v0.2"
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

The `gate` job of `.github/workflows/publish.yml` dies at its `Install` step: `npm ci` exits non-zero
under npm **10.9.0** — the npm that Node **22.12.0** bundles, which is the version the workflow pins in
`env.NODE_VERSION` — with `Missing: @emnapi/core@1.11.3` / `Missing: @emnapi/runtime@1.11.3 from lock
file`. The same lockfile bytes install cleanly under npm 11.6.2. Nothing can be published until this is
fixed: the gate is step 1 of the pipeline and it never reaches the tests, the pack, or the publish.

## Steps to Reproduce

1. Check out `main` (measured here at `b505473`, the merge of `task-078-publish-pipeline-hardening`).
2. Obtain npm 10.9.0 — the version `actions/setup-node` installs for `node-version: 22.12.0`:
   `npm install --prefix <scratch> npm@10.9.0`.
3. Run the gate's first step against the repository's own lockfile:
   `<scratch>/node_modules/.bin/npm ci --dry-run --no-audit --no-fund`.
4. Repeat with npm 11.6.2 (a manually upgraded npm — see Notes) on the **same bytes**.

## Expected Behavior

`spec-015` §3 stage 1 and the `gate` job's opening step in `.github/workflows/publish.yml` — the step
named `Install`, whose `run:` is exactly `npm ci` — make `npm ci` the gate's first step, and `bug-043` was
closed / `task-073` marked `done` on the premise that the lockfile installs. `npm ci` must therefore
exit 0 under the npm that the pipeline's own `NODE_VERSION` pin selects.

## Actual Behavior

Reproduced in this ingest, in a clean worktree of `main` at `b505473`
(`/home/robypomper/Workspaces/.wf2-wt/ingest-077`):

```
$ /…/npm109/node_modules/.bin/npm --version
10.9.0
$ /…/npm109/node_modules/.bin/npm ci --dry-run --no-audit --no-fund ; echo EXIT=$?
npm error code EUSAGE
npm error
npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
npm error
npm error Missing: @emnapi/core@1.11.3 from lock file
npm error Missing: @emnapi/runtime@1.11.3 from lock file
EXIT=1
```

Same worktree, same lockfile bytes, the machine's own npm:

```
$ npm -v
11.6.2
$ npm ci --dry-run --no-audit --no-fund >/dev/null 2>&1 ; echo EXIT=$?
EXIT=0
```

The failing error text is what `task-077-first-real-staging-run` captured from the real `act -j gate`
run against the unmodified workflow (`Missing: @emnapi/core@1.11.3` / `@emnapi/runtime@1.11.3`), so this
is the gate's failure, reproduced here without `act` at all.

**The npm is chosen by the pin, not by chance.** `.github/workflows/publish.yml` declares the workflow
key `env.NODE_VERSION: '22.12.0'`, consumed by all three `actions/setup-node` steps as
`node-version: ${{ env.NODE_VERSION }}` (verified at `main` `0cf643f`: `grep -n "NODE_VERSION"` returns
the `env:` key plus three `node-version:` uses). Which npm
that installs, taken from Node's own release index rather than from report:

```
$ curl -sS https://nodejs.org/dist/index.json | node -e '…select v22.12.0 / v22.21.0…'
v22.21.0 npm 10.9.4 lts Jod
v22.12.0 npm 10.9.0 lts Jod
```

**The lock still has no hoisted entry for either peer** — the structural gap, unchanged by `task-073`:

```
$ grep -n '"node_modules/@emnapi' package-lock.json
565:    "node_modules/@emnapi/wasi-threads": {
```

One hoisted `@emnapi` entry, and it is not either of the two npm 10.9 demands.

## Notes

**Why no one saw it locally.** The same index rows show the developer machine's Node v22.21.0 bundles
npm **10.9.4**, yet `npm -v` there reports **11.6.2** — the npm that passes is a manual upgrade, not what
any pinned Node ships. Every local `npm ci` in this repository has been run under an npm no CI job will
ever use.

**`bug-043` cannot be reopened, and this is not a duplicate of it.**
`bug-043-npm-ci-fails-on-stale-package-lock` is `status: closed` and `task-073-fix-stale-package-lock`
is `status: done` (both read from their frontmatter at `b505473`). The `bug` state machine in
`docs/self/.wingfoil/memory.yaml` gives `closed` no outbound edge —
`sequence: [draft, open, triaged, planned, in-progress, in-review, resolved, closed]` ends there,
`gates` declares nothing for `closed`, and `waiting` lists only `triaged`/`planned`; the sole wildcard is
`memory.deprecate`, which retires rather than reopens. So a new bug is the only legal way to carry this.
It is also the right one on the merits: `task-073`'s fix (a three-line `@emnapi/wasi-threads` version
bump, `0f54871`) was **correct for npm 11.6**, which is the npm it measured; it simply does not cover
the npm the pipeline pins.

**Relation to `dl-069-lockfile-drift-unguarded`** (`in-discussion`): this bug is the concrete instance
that falsifies that DL's E6 conclusion ("confirming `main` is currently healthy") — `main` is healthy
under npm 11.6 only. `dl-069` is amended in this same ingest to record it. The *structural* decision
stays there (its option (b), the `overrides` pin, is now the only option that actually unblocks the
gate); this bug is the release blocker that decision has to clear.

**Suggested fix.** Pin `@emnapi/core` and `@emnapi/runtime` at the manifest level (`dl-069` option (b))
so they resolve from the lock rather than from the registry, and verify with an `npm ci` run under npm
10.9.0 — not under the developer's npm. Do **not** key any check on npm's error string: `dl-069` E4
already recorded that message changing under the same lock.

## Triage & Execution Notes

Filed from finding **F2** of `task-077-first-real-staging-run` (`done`), at the scheduling act its
approve commit `ac10060` directs. Severity **high**, release-blocking, per that commit: "the gate cannot
install". The reviewer independently confirmed F2 on the exact lockfile bytes before approval; this
document re-derives the whole chain — the npm bundled by the pin, both npm runs, the lock's missing
entries, the machine's terminal `closed` — rather than copying it. Fix task:
`task-080-fix-npm-ci-under-pinned-npm`.
