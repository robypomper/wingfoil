---
id: "bug-043-npm-ci-fails-on-stale-package-lock"
type: bug
title: "`npm ci` fails in any fresh clone of main: package-lock.json is internally inconsistent for @emnapi"
status: closed
severity: "medium"
release-origin: "v0.2"
release: "v0.2"
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`npm ci` fails outright in a fresh clone of `main` — `Invalid: lock file's @emnapi/wasi-threads@1.2.2
does not satisfy @emnapi/wasi-threads@1.2.3` — so no fresh worktree and no GitHub Actions job can
install dependencies the way the published pipeline does.

## Steps to Reproduce

Run against `main` at `b7e39f9`, in a throwaway clone outside any existing worktree:

```
$ git clone -q --branch main /home/robypomper/Workspaces/WingFoil2 b1clone
$ cd b1clone && git log --oneline -1
b7e39f9 docs(self): bug-042 — record the task-048 evidence that falsifies its "why medium"

$ npm ci
npm error Invalid: lock file's @emnapi/wasi-threads@1.2.2 does not satisfy @emnapi/wasi-threads@1.2.3
npm error
npm error Clean install a project
...
$ npm ci >/dev/null 2>&1; echo "REAL_EXIT=$?"
REAL_EXIT=1
```

Environment: `npm 11.6.2`, `node v22.21.0`, Linux. Nothing is installed; `node_modules/` is not created.

## Expected Behavior

`npm ci` installs the locked tree and exits `0`. That is the contract the command exists for and the one
the publish pipeline depends on.

## Actual Behavior

Exit `1`, nothing installed. `npm install` is the only way to get a working tree, and it rewrites
`package-lock.json` — i.e. every fresh checkout either fails or produces an uncommitted lock diff.

## Notes

### Root cause, as far as the lock file shows it

The lock's `@emnapi` subtree is incomplete, not merely out of date:

```
$ grep -n '"node_modules/@emnapi' package-lock.json
565:    "node_modules/@emnapi/wasi-threads": {          # version 1.2.2, dev, optional

$ grep -n "1\.2\.3" package-lock.json          # → only jest-pnp-resolver and update-browserslist-db
```

So `@emnapi/wasi-threads@1.2.2` is the only top-level `@emnapi` entry, and **no entry anywhere in the
lock asks for `1.2.3`**. The requirement is being resolved at install time, not read from the lock:
`@napi-rs/wasm-runtime@1.1.6` (`:1335-1352`, dev + optional) declares

```
"peerDependencies": { "@emnapi/core": "^1.7.1", "@emnapi/runtime": "^1.7.1" }
```

and the lock records **no** `node_modules/@emnapi/core` and **no** `node_modules/@emnapi/runtime` to
satisfy them. The only `@emnapi/core` in the file is the nested one under
`@unrs/resolver-binding-wasm32-wasi` (`:2194-2206`), pinned to `1.10.0`, whose own dependency is
`@emnapi/wasi-threads: 1.2.1` (confirmed against the registry: `npm view @emnapi/core@1.10.0
dependencies` → `{"tslib":"^2.4.0","@emnapi/wasi-threads":"1.2.1"}`). Neither `1.2.1` nor `1.2.2` is the
`1.2.3` npm reports, which is why the mismatch surfaces only when npm goes to the registry for the
unlocked peers. The exact provenance of `1.2.3` is not pinned down here and does not need to be: the
lock is inconsistent with itself either way.

All of this is dev-only, optional, transitive (`@unrs/resolver-binding-wasm32-wasi` ← `eslint`'s resolver
chain). Nothing in the runtime dependency set is involved — which is why the *installed* tree keeps
working and only a *clean* install breaks.

### Not introduced by a task branch

```
$ git log --oneline --all -- package-lock.json
63a1a4d feat(docs): task-062-typedoc-tsdoc-backfill — backfill TSDoc on all exported declarations; add typedoc + docs:api gate
e67f8af test(validation): task-004-decoupled-pillars — failing test for shared YAML pre-parse step
789d51a feat(core): task-001-nodejs-typescript-scaffold — Node.js/TypeScript project scaffold
e46214c test(core): task-001-nodejs-typescript-scaffold — failing test for src/ module layout
```

and a sweep of every branch for commits touching the file ahead of `main`
(`for b in $(git branch -a --format='%(refname:short)'); do git rev-list --count main..$b -- package-lock.json; done`)
returns **nothing**. The file has four commits in its whole history, the most recent on `main`; no
in-flight task touches it. The lock did not drift because of the Wave-2 work — registry metadata moved
under a lock that was already missing those two entries.

### Why it matters beyond a local annoyance

- **Every fresh worktree.** The dev-loop convention is a worktree per task with `node_modules` symlinked
  from the primary checkout, which masks this entirely — until someone clones properly, at which point
  the first command in the setup fails.
- **Every GitHub Actions job.** `.github/workflows/publish.yml:99` runs `npm ci`, and its own header
  (`:3`) describes the gate as "`npm ci`, then `prepublishOnly` (build/test/lint)". `spec-015-packaging-publishing:75`
  specifies the same: "**build + gate** — `npm ci`, then `prepublishOnly` … + `npm publish --dry-run`".
  So the pipeline `adr-009` and `spec-015` define cannot complete its first step on a runner today. That
  pipeline has never executed against a clean runner (`dl-056-first-real-publishing-run`), so nothing has
  caught it.
- **`dl-023-init-cli-e2e-smoke-gate`'s e2e-smoke gate** and any "fresh install" verification inherit the same first step.

### Suggested fix — do NOT apply as part of this report

Refresh the lock and commit it on its own:

```
npm install            # rewrites package-lock.json, adding the missing @emnapi/{core,runtime} entries
npm ci                 # must now exit 0 in a fresh clone
```

as a standalone `chore` commit touching only `package-lock.json`, verified by cloning into a throwaway
directory and running `npm ci` there — not inside a worktree whose `node_modules` is symlinked, which
does not exercise the failure. Nothing else should ride that commit: a lock refresh is reviewable only if
it is the whole diff. Worth pairing with a CI job that runs `npm ci` on push, so the next drift is caught
by the pipeline instead of by the next person to clone.

Severity **medium**: it blocks setup and the publish pipeline completely, but it is a one-command fix, it
touches no product code, and every existing worktree is unaffected.

## Triage & Execution Notes

Found while preparing the Wave-2 round-4 ingest batch, by cloning `main` into a throwaway directory
rather than reusing a worktree. Filed unfixed per the ingest plan — the agent stops at `open`.

Related: `adr-009-npm-publishing-pipeline` + `spec-015-packaging-publishing` `:75` (the pipeline that runs `npm ci`),
`dl-056-first-real-publishing-run`, `dl-023-init-cli-e2e-smoke-gate` (e2e-smoke / fresh-init gate),
`.github/workflows/publish.yml:3`/`:99`, `package-lock.json` `:565`, `:1335-1352`, `:2194-2206`.
