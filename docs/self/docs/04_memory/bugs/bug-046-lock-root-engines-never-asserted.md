---
id: "bug-046-lock-root-engines-never-asserted"
type: bug
title: "Nothing asserts that package-lock.json's root `engines` matches package.json's, and `npm ci` does not detect the drift"
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

`package-lock.json` carries its own copy of the root package's `engines` block
(`packages[""].engines`), nothing in the repository asserts that it agrees with `package.json`'s, and
`npm ci` installs happily when the two disagree — so the declared runtime floor can silently differ
between the manifest a consumer reads and the lockfile CI installs from.

## Steps to Reproduce

Measured 2026-09-21 in a clean worktree of `main` at `bcc66a9` (`ingest/v02-release-governance`),
`node v22.21.0`, `npm 11.6.2`.

1. Confirm both copies exist and currently agree:

```
$ node -e 'console.log(JSON.stringify(require("./package.json").engines))'
{"node":">=18.0.0"}
$ node -e 'const l=require("./package-lock.json");console.log(JSON.stringify(l.packages[""].engines))'
{"node":">=18.0.0"}                       # lockfileVersion=3
```

2. Copy `package.json` + `package-lock.json` into a scratch directory and raise **only** the
   manifest's floor to the value `task-074-fix-engines-node-floor` will set:

```
$ node -e '...p.engines.node=">=22.12.0"...'
manifest engines:   {"node":">=22.12.0"}
lock root engines:  {"node":">=18.0.0"}
```

3. Run the command CI runs:

```
$ npm ci --dry-run --offline --cache <cold-dir>
EXIT=0
109 packages are looking for funding
$ grep -i engine <output>
add @shikijs/engine-oniguruma 3.23.0     # a package NAME — no engines diagnostic of any kind
```

4. Confirm the repair path:

```
$ npm install --package-lock-only --offline --cache <cold-dir>
EXIT=0
lock root engines AFTER: {"node":">=22.12.0"}
```

5. Confirm nothing in the test suite would have caught it:

```
$ grep -rn "engines" test/
(no output — no test anywhere under test/ makes an engines assertion)
```

## Expected Behavior

Either `npm ci` refuses a lockfile whose root `engines` disagrees with the manifest's — the way it
refuses a dependency set that is out of sync — or the repository asserts the equality itself, so a
manifest edit that forgets the lockfile cannot merge.

## Actual Behavior

`npm ci` exits `0` with the two disagreeing and emits **no** engines diagnostic (step 3). No test
asserts the relationship (step 5). The drift is only repaired as a side effect of someone happening to
run `npm install` or `npm install --package-lock-only` (step 4), which also rewrites the lock — the
very thing `bug-043` showed people avoid doing casually.

## Notes

### This is live right now, not hypothetical

On `main` today the two copies **agree** (`>=18.0.0` in both — step 1), so there is no instance to
observe yet. The defect becomes live the moment `task-074-fix-engines-node-floor` (`backlog`, `v0.2`)
executes: its whole job is to raise `package.json`'s `engines.node` to `>=22.12.0`
(`adr-010-node-22-runtime-floor`, `pending`). If that edit is made by hand — the natural way to change
one string in a manifest — the lockfile keeps `>=18.0.0` and nothing says so. That makes this a
**precondition** of task-074 rather than a follow-up to it.

### Why it matters

- `package-lock.json` is what `npm ci` installs from, and `npm ci` is the first step of the publish
  gate (`.github/workflows/publish.yml:99`; `spec-015-packaging-publishing` §3 stage 1). A lockfile
  claiming a different floor than the published manifest is a second, invisible copy of exactly the
  contradiction `bug-023-engines-node-floor-contradicts-commander` is about.
- `task-074`'s AC3 adds a guard that every **dependency's** `engines.node` is satisfied by ours. That
  guard reads `package.json` and the dependency tree; it says nothing about the lockfile's own root
  block, so it would pass with the drift in place. (See `bug-047` for the other gap in the same
  guard.)
- It is cheap to close: one assertion comparing `require('package.json').engines` against
  `require('package-lock.json').packages[""].engines` — deterministic, offline, no registry access.
  That is a notably better position than `dl-069`'s drift, where the evidence shows no offline test
  can work at all.

### Suggested fix — do NOT apply as part of this report

Add the equality assertion to `test/cli/publish-metadata.test.ts` (the file `task-059-publish-metadata`
owns and the one `task-074` AC3 already edits), and sequence it **with or before** `task-074` so the
manifest edit and the lockfile refresh land together.

Per `dl-014`/T1, classify it honestly: against `main` as it stands the assertion **passes on first
run**, so it is a **characterization** test of the current agreement plus a guard for the change
task-074 is about to make — not a red-first test, and no red should be manufactured to pretend
otherwise.

Note `npm install --package-lock-only` rewrites the lock (step 4); whoever fixes this should confirm
the resulting diff is the `engines` line and nothing else, per `task-073`'s convention that a lock
change is reviewable only when it is the whole diff.

Severity **medium**: no impact today (the two agree), no product code involved, and a one-line
assertion closes it — but it is about to become live in the next task, and it sits on the publish
gate's critical path.

## Triage & Execution Notes

Raised during the v0.2 release-governance ingest (2026-09-21), from the review of
`task-074-fix-engines-node-floor` (`backlog`). Filed unfixed per the ingest plan — the agent stops at
`open` and holds no approval authority.

Related: `adr-010-node-22-runtime-floor` (`pending`, the decision that makes this live),
`bug-023-engines-node-floor-contradicts-commander` (`planned`, the manifest-side defect),
`bug-047-engines-guard-asserts-satisfies-not-equals` (the other gap in the same guard),
`task-074-fix-engines-node-floor` (`backlog`), `task-059-publish-metadata` (`done`, owns
`test/cli/publish-metadata.test.ts`), `task-073-fix-stale-package-lock` (`done`, the lock-refresh
convention), `dl-069-lockfile-drift-unguarded` (the other unguarded lockfile property),
`spec-015-packaging-publishing` §3 stage 1, `.github/workflows/publish.yml:99`,
`package-lock.json` `packages[""].engines`, `package.json:16`.

## Addendum (2026-09-22) — the blind spot is the whole `packages[""]` block, not only `engines`

Measured while reviewing `task-087-fix-types-node-floor-pin`, and reproduced independently by that
task's reviewer, both under npm 10.9.0 — the npm the pinned `NODE_VERSION` bundles:

- Corrupt **only the lock's root range mirror** (set `packages[""].devDependencies["@types/node"]` to a
  range that contradicts the resolved entry) and leave the resolved entry correct:
  `npm ci --dry-run` and a real `npm ci` both exit **0**. npm never looks at it.
- Corrupt the **resolved** entry instead: `npm ci` exits **1** with
  `Invalid: lock file's @types/node@18.19.130 does not satisfy @types/node@22.20.4`.

So npm validates the resolved entry and ignores the root mirror. This bug is currently framed as an
`engines`-only defect; the same silence covers every field of `packages[""]`, dependency ranges
included. Nothing in `test/` asserts anything about that block (`grep -rn 'packages\[""\]' test/`
returns nothing), which is why a mirror can drift from its manifest without any gate noticing.

This widens the bug's scope rather than changing its class, so it is recorded here instead of being
filed as a separate element.
