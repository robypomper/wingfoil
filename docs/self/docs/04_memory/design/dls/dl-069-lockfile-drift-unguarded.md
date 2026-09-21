---
id: "dl-069-lockfile-drift-unguarded"
type: decision-log
title: "Lockfile drift is unguarded: the @emnapi peers are still unlocked and `npm ci` runs only in the tag-triggered gate"
status: in-discussion
context: "dev-loop-review"
release: "v0.2"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`bug-043-npm-ci-fails-on-stale-package-lock` is `closed` and `task-073-fix-stale-package-lock` is
`done` and merged (`2151946`; the lock commit is `0f54871`). The bug was closed as *this instance
fixed*, and correctly so — the whole repair is three lines. But the two structural conditions that
produced it are untouched, and together they mean the **next** occurrence arrives with no commit to
this repository and surfaces during a release rather than before one.

1. **The `@emnapi` peers are still unlocked.** `@napi-rs/wasm-runtime@1.1.6` (dev + optional, reached
   through `eslint`'s resolver chain) declares peers `@emnapi/core: ^1.7.1` and
   `@emnapi/runtime: ^1.7.1`, and the lock records no top-level entry for either. npm therefore
   resolves them **at install time, from the registry**, which is precisely the mechanism `bug-043`
   identified: "The requirement is being resolved at install time, not read from the lock." The next
   upstream `@emnapi/core` release can reproduce the failure with zero change here.
2. **`npm ci` runs in exactly one place, behind a tag.** So the first thing that will notice the next
   drift is a release run.

This is not a re-report of `bug-043`. It is the decision `bug-043`'s own "Suggested fix" gestured at
and deliberately left out of scope — "Worth pairing with a CI job that runs `npm ci` on push, so the
next drift is caught by the pipeline instead of by the next person to clone" — and which nothing
currently schedules.

### Measured evidence

Measured 2026-09-21 in a clean worktree of `main` at `bcc66a9` (`ingest/v02-release-governance`).
`node v22.21.0`, `npm 11.6.2`. The *broken* lock is `package-lock.json` at `0f54871^`; the *fixed*
lock is the same file at `0f54871`. `package.json` is **identical** at `0f54871^` and `HEAD`
(`git diff --stat 0f54871^ HEAD -- package.json` → empty output), so none of the comparisons below is
confounded by a manifest that moved.

**E0 — the repair, and its size.** `git show --stat 0f54871` → `package-lock.json | 6 +++---`, one
file, three insertions: `node_modules/@emnapi/wasi-threads` `1.2.2 → 1.2.3` (version, resolved,
integrity). Nothing else moved.

**E1 — the peers are still unlocked *after* the fix.** Run against the **fixed** lock, i.e. what is on
`main` now:

```
$ npm ls --package-lock-only --all
...
│ │ │   │ └─┬ @napi-rs/wasm-runtime@1.1.6
│ │ │   │   ├── UNMET DEPENDENCY @emnapi/core@^1.7.1
│ │ │   │   ├── UNMET DEPENDENCY @emnapi/runtime@^1.7.1
npm error code ELSPROBLEMS
npm error missing: @emnapi/core@^1.7.1, required by @napi-rs/wasm-runtime@1.1.6
npm error missing: @emnapi/runtime@^1.7.1, required by @napi-rs/wasm-runtime@1.1.6
(exit 1)
```

Confirmed directly in the lock: `node_modules/@emnapi/wasi-threads` (`:565`) is the only top-level
`@emnapi` entry; `@emnapi/core` and `@emnapi/runtime` exist only **nested** under
`@unrs/resolver-binding-wasm32-wasi`, pinned at `1.10.0`, which cannot satisfy a peer of
`@napi-rs/wasm-runtime` at the hoisted position. `task-073` moved a version; it did not add the
missing entries.

**E2 — `npm ls --package-lock-only` cannot tell the broken lock from the fixed one.** The two locks
were placed in separate scratch directories alongside the same `package.json`:

```
$ npm ls --package-lock-only --all            # broken → exit 1 ;  fixed → exit 1
$ md5sum <broken-output> <fixed-output>       # after stripping npm's timestamped debug-log path line
7120844e77cbfd00e721751d90745d64  b.txt
7120844e77cbfd00e721751d90745d64  f.txt       # byte-identical, 1049 lines each
```

Without `--all` both exit **0** and differ only in the project-directory line the command echoes.
So the obvious "cheap deterministic check" does not work: the command reports the *same* tree and the
*same* two `ELSPROBLEMS` on a lock that installs and on one that does not.

**E3 — offline, `npm ci` accepts the broken lock.** With a cold, empty npm cache:

```
$ npm ci --dry-run --offline --cache <empty-dir>      # in the BROKEN lock's directory
EXIT=0
added 498 packages in 2s

$ npm ci --dry-run --offline --cache <same-dir>       # in the FIXED lock's directory
EXIT=0
added 498 packages in 1s
```

Identical outcome, identical package count. **This is the load-bearing finding**: detection requires
registry-derived data, so **no deterministic Jest test can catch this drift.** A unit test is
forbidden from reaching the network by the `determinism` directive (REQ-SYS-07: no unordered or
environment-dependent behaviour in context-building paths), and offline the defect is invisible. The
guard has to be a CI job or a manifest-level pin — it cannot be a test.

**E4 — with the registry reachable, the broken lock still fails, but the message has changed.**

```
$ npm ci --dry-run --cache <cold-dir>                 # BROKEN lock, network available
EXIT=1
npm error code EUSAGE
npm error `npm ci` can only install packages when your package.json and package-lock.json
npm error or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install`
```

`bug-043` recorded a different, more specific error: `Invalid: lock file's @emnapi/wasi-threads@1.2.2
does not satisfy @emnapi/wasi-threads@1.2.3`. Three days later the same lock yields the generic
`EUSAGE` out-of-sync message instead. Since `package.json` is byte-identical across the range, this is
not a manifest mismatch — registry metadata has moved again underneath the same unlocked peers, which
is the very instability this decision is about. It also means **the failure signature is not stable**,
so any guard that greps for a particular npm error string will rot.

**E5 — `npm ci` runs in exactly one place, and only on a tag.**

```
$ ls .github/workflows/
publish.yml                       # the only workflow in the repository

$ grep -rn "npm ci" .github/ scripts/ package.json
.github/workflows/publish.yml:3:   #   gate → ... `npm ci`, ...        (comment)
.github/workflows/publish.yml:99:        run: npm ci                    (the only invocation)

$ sed -n '66,68p;82,83p' .github/workflows/publish.yml
on:
  push:
    tags: ['v[0-9]+.[0-9]+.[0-9]+']
jobs:
  gate:
```

So `npm ci` executes only inside the `gate` job of a workflow triggered exclusively by a `vX.Y.Z` tag
push. There is no push- or PR-triggered CI of any kind. A drift introduced today is first observed by
whoever pushes the release tag — after the release branch has merged (`dl-024`) — or by the next
person to clone, which is exactly how `bug-043` was found.

**E6 — the current development convention hides it.** Per `bug-043`'s own analysis, the dev-loop
worktree convention symlinks `node_modules` from the primary checkout, so a stale lock is invisible in
normal work. This ingest deliberately ran a real `npm ci` in a fresh worktree instead — **exit 0**,
confirming `main` is currently healthy. That is the state this decision wants to keep, not a reason to
believe it will hold.

## Decision

Two options are open for guarding lockfile drift. They are presented with a recommendation; the
approver's choice is recorded in this document's approve commit `Reason:`. The options are not
mutually exclusive — (b) narrows the specific hole, (a) catches the general class — and the honest
reading of E1–E5 is that **(a) is the one that actually closes the gap**; (b) alone would have
prevented `bug-043` and would not prevent the next unrelated drift.

### (a) A push-triggered CI job that runs `npm ci` — recommended

Add a job that runs `npm ci` (and, minimally, `npm run build` + `npm test`) on pushes and/or pull
requests, so drift is caught by the pipeline rather than by a release or a clone.

*Cost, stated plainly:*

- It **edits `.github/workflows/publish.yml`**, which is `task-060-publish-pipeline` (`done`) ground
  and `task-078-publish-pipeline-hardening` (`backlog`) territory. It is not a free-standing change.
- It **changes that workflow's trigger**, today `on: push: tags: ['v[0-9]+.[0-9]+.[0-9]+']` (E5). A
  tags-only trigger is load-bearing for `adr-009` clause 1 ("No publish ever runs from a `design/*`
  phase branch") and for the gate's "tag is on `main`" assertion. Widening the trigger on the *same*
  workflow risks weakening that guarantee; a **separate** `ci.yml` leaves `publish.yml`'s trigger
  untouched and is the safer shape — but that is itself a decision, because `adr-009` frames GitHub
  Actions usage around one publish pipeline and says nothing about a general CI workflow.
- It depends on `dl-068`'s Action 3: the remote is **empty**, so no GitHub Actions job — this one
  included — can run until the history is pushed.
- Recurring cost is minutes of runner time per push, on a free-tier public repository.

### (b) Pin the `@emnapi` peers with an `overrides` block in `package.json`

Add `overrides` for `@emnapi/core` and `@emnapi/runtime` so the peers resolve from the lock instead of
from the registry, removing the specific install-time resolution that produced `bug-043`.

*Cost:* it pins a **dev-only, optional, transitive** dependency of `eslint`'s resolver chain from the
top-level manifest — action at a distance that a future reader will struggle to attribute, and which
`npm ls` will not explain (E2). It silently freezes a subtree npm currently keeps current, and it must
be revisited on every `eslint`/`@unrs/resolver` bump. And it is **narrow**: it addresses this one
unlocked peer pair, not the class. E4 shows the failure mode is not even stable in its message; there
is no reason to expect the next drift to arrive through the same package.

### Sub-question

- **S1 — should the guard assert, or merely run?** `npm ci`'s non-zero exit is already the assertion,
  and E4 shows the *message* is unstable while the *exit code* is not. Any guard should key on exit
  status only. **Recommendation:** run `npm ci` and let its exit code fail the job; never grep npm's
  output.

## Rationale

- **No test can do this job.** E3 is decisive: cold-cache, offline, `npm ci --dry-run` exits 0 on a
  lock that demonstrably does not install, with output indistinguishable from the healthy one. The
  `determinism` directive forbids a network-dependent unit test, so the check cannot live in Jest. It
  must be CI, or it must be a manifest-level pin — there is no third place for it.
- **The cheap alternative was checked and does not work.** `npm ls --package-lock-only` was the
  obvious lockfile-only validator; E2 shows it produces byte-identical output for the broken and the
  fixed lock. Recording that it fails is worth as much as recording what works.
- **The window is a full release cycle wide.** E5: the only `npm ci` sits behind a tag push, i.e.
  *after* the release branch merges. `bug-043` proved the consequence — the drift was found by a human
  cloning the repository, not by the pipeline `adr-009` designed to catch exactly this.
- **(b) is a patch on one hole, not a guard.** E1 shows the unlocked peers survived `task-073`; (b)
  would seal them, and nothing else. E4 shows even this instance's signature has already changed once.
- **Timing.** `dl-056-first-real-publishing-run` and `task-077-first-real-staging-run` will exercise
  `publish.yml` end-to-end for the first time. Deciding this **before** that run means the guard is
  designed alongside the pipeline work (`task-078`) rather than bolted on after a release run fails on
  its first step — which is what `bug-043` showed happens.

## Actions

1. **Decide (a), (b), or both — before `task-077-first-real-staging-run` executes.** Owner: approver.
   The decision belongs in this document's approve commit `Reason:`.
2. **On (a): carry it in `task-078-publish-pipeline-hardening`** (`backlog`, `v0.2`), which already
   owns `publish.yml` changes, and settle there whether it becomes a new job in `publish.yml` or a
   separate `ci.yml`. Per S1, key the gate on `npm ci`'s exit code only.
3. **On (b): carry it in `task-074-fix-engines-node-floor`'s vicinity, not inside it.** `task-074`
   already touches `package.json` and is sequenced against `task-073`'s lock work; an `overrides`
   block is a different concern and should not ride that diff. File it as its own task if chosen.
4. **Sequence behind `dl-068` Action 3.** Nothing in (a) can run until the local history is pushed to
   the empty `origin` (`dl-068` E2).
5. **Re-measure E1 at execution time.** The `@emnapi` subtree is exactly the thing that moves without a
   commit here; the numbers above are pinned to `main` at `bcc66a9` on 2026-09-21 and should be
   re-derived, not copied, by whoever implements the guard.

## Relations

- **Derives from:** `task-073-fix-stale-package-lock` (`done`) and its review;
  `bug-043-npm-ci-fails-on-stale-package-lock` (`closed` — this instance fixed; its "Suggested fix"
  explicitly deferred the CI pairing this DL takes up).
- **Constrains:** `.github/workflows/publish.yml` (`task-060-publish-pipeline`, `done`),
  `task-078-publish-pipeline-hardening` (`backlog`, the likely carrier),
  `task-077-first-real-staging-run` (`backlog`, the deadline).
- **Sequenced behind:** `dl-068-publishing-requires-public-repository` (the remote is empty, so no CI
  job can run yet), `dl-056-first-real-publishing-run` (`ready`).
- **Adjacent:** `adr-009-npm-publishing-pipeline` (`accepted`, clause 1 fixes the tags-only trigger
  option (a) would have to work around), `spec-015-packaging-publishing` §3 stage 1 (`npm ci` as the
  gate's first step), `dl-023-init-cli-e2e-smoke-gate` (inherits the same first step),
  `dl-057-publish-pipeline-hardening` (`ready`), `bug-046-lock-root-engines-never-asserted` (the other
  thing about `package-lock.json` that nothing asserts).
- **Traceability:** REQ-SYS-09 (the pipeline this protects), REQ-SYS-07 / `determinism` directive (why
  E3 rules out a Jest guard).
