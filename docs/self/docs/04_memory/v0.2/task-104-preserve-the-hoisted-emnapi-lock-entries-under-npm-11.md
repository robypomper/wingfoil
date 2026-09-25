---
id: "task-104-preserve-the-hoisted-emnapi-lock-entries-under-npm-11"
type: task
title: "Stop an ordinary `npm install` on npm 11 from reverting the two hoisted `@emnapi` lock entries the release gate needs, and make the reversion fail a check instead of passing silently"
status: in-review
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

## Execution Notes

### design — role: architect

Branch `task/task-104-preserve-the-hoisted-emnapi-lock-entries-under-npm-11`, worktree
`/home/robypomper/Workspaces/.wf2-wt/task-104`, created from `main` at `5017555c`
(`wf(bug): sync bug-044, bug-063, bug-103 [triaged -> planned]`). `main` did not move while this task
ran (`git merge-base --is-ancestor main HEAD` → true at submit), so no merge of `main` was needed and
none was made. Host environment for every command below unless stated otherwise: Linux,
`node v22.21.0`, `npm 11.6.2` (`which npm` → `/usr/local/bin/npm`, a hand-upgrade — Node 22.21.0
bundles npm 10.9.4, per `dl-076` E1 and re-derived below).

**`agent.read_related` (dl-015).** `depends_on: []`
(`grep -n '^depends_on:' docs/self/docs/04_memory/v0.2/task-104-*.md` → `depends_on: []`), so the hard
gate has nothing to acknowledge. Read anyway, because the task names them: `bug-063` in full, and
`task-080-fix-npm-ci-under-pinned-npm`'s Execution Notes in full. What is taken from `task-080`:

1. Its **D1** is this task. It measured, on its own fixed tree, that
   `npm install --package-lock-only` under npm 11.6.2 "deletes both hoisted entries again,
   `overrides` block present and all", and closed with "the durable answer is to make developers run
   the pinned npm rather than to rely on a test noticing". That prediction is re-measured here at
   this branch's base rather than copied — see AC1.
2. Its **control pair** is the finding this task builds on: *lock entries only, no overrides* →
   `npm ci` exit 0; *overrides only, lock untouched* → exit 1. So the `overrides` block was never
   what makes the gate install; it binds a version. Nothing in it makes npm **record a node**, which
   is precisely why npm 11 is free to prune the node. That gap is what AC2 has to close.
3. Its worktree warning is operative: a worktree whose `node_modules` is symlinked from the primary
   checkout masks install results. Every `npm install` / `npm ci` recorded as evidence below runs in
   a **throwaway clone in the scratchpad** with no `node_modules` present, except the two runs
   explicitly labelled as being in this worktree (which has its own real `node_modules`, never a
   symlink — `ls -d node_modules` → *No such file or directory* at branch creation).

**`agent.verify_specs`.** No `tech-spec` is needed and none is revised. `spec-015-packaging-publishing`
§3 stage 1 already makes `npm ci` the gate's first step and `REQ-SYS-09` is the requirement behind it;
`REQ-SYS-09` declares its own verification route ("distribution requirement with no behavioral BDD
feature"), so the review BDD gate has no scenario for this task — the same conclusion `task-080`
reached and recorded, re-checked here rather than inherited:

```
$ grep -rln "npm\|packag" docs/02_requirements/02_bdd/features/
(no output)
```

**`spec-015` §2 is checked, not assumed, because this task adds an npm script.** §2 reads
"Existing `build`/`prepack`/`test`/`lint` unchanged; `prepack → build` still produces `dist/`", and
`test/cli/publish-pipeline.test.ts` asserts `prepack: 'npm run build'` literally under the title
"leaves the existing build/prepack/test/lint scripts unchanged (spec-015 §2)". So **`prepack` is not
touched** — AC3's "or a `prepack` check" option is declined for that reason, and the check is wired
as a *new* script (`check:lockfile`) plus a jest suite instead. §2 is a positive list that already
grew once (`publish:staging`); adding a script alongside it contradicts nothing, so no spec revision
is required.

**Premises re-verified at execution time rather than read from `task-080` or from this task.**

1. `.github/workflows/publish.yml` still pins the Node version, and all three `setup-node` steps
   still consume it:
   ```
   $ grep -n "NODE_VERSION" .github/workflows/publish.yml
   45:# Node version: pinned once in `env.NODE_VERSION` to 22.12.0 — the lowest version every PRODUCTION
   106:  NODE_VERSION: '22.12.0'
   119:          node-version: ${{ env.NODE_VERSION }}
   151:          node-version: ${{ env.NODE_VERSION }}
   169:          node-version: ${{ env.NODE_VERSION }}
   ```
2. Node 22.12.0 still bundles npm 10.9.0 — read from Node's own release index, not from a report
   (AC4 says to read the workflow rather than assume which npm ships with it; this is the second
   half of that, since the workflow names a Node and not an npm):
   ```
   $ curl -sS https://nodejs.org/dist/index.json -o <scratch>/nodeindex.json
   $ node -e '…select v22.12.0 / v22.21.0…'
   v22.12.0 npm 10.9.0
   v22.21.0 npm 10.9.4
   ```
   So the npm AC4 is about is **10.9.0**, and it is neither the host's 11.6.2 nor what the host's own
   Node bundles. It was installed into the scratchpad and invoked by absolute path throughout,
   written `<npm109>` below:
   ```
   $ npm install --prefix <scratch>/npm109 npm@10.9.0 --no-audit --no-fund    # exit 0
   $ <scratch>/npm109/node_modules/.bin/npm --version
   10.9.0
   ```
3. The hoisted entries are present at this branch's base:
   ```
   $ grep -n '"node_modules/@emnapi' package-lock.json
   565:    "node_modules/@emnapi/core": {
   578:    "node_modules/@emnapi/runtime": {
   590:    "node_modules/@emnapi/wasi-threads": {
   ```

**T1 acceptance-criterion classification (dl-014 / `testing` directive).**

| AC | Class | Evidence |
|---|---|---|
| AC1 — reproduce, versions recorded | **red-first**, as an executable reproduction | the transcript below: plain `npm install` under npm 11.6.2 on a clean clone of this branch's base deletes 25 lines of lock and exits 0 |
| AC2 — the entries survive an ordinary `npm install` | **red-first**, by control pair | AC1 *is* the red (overrides-only → pruned). After the fix, two consecutive `npm install` runs leave `package-lock.json` byte-identical; removing only the new devDependency declarations makes it prune again, which isolates the cause |
| AC3 — a reversion fails a check | **red-first** | `test/cli/check-lockfile-pins.test.ts` written first: suite failed to run (`Cannot find module '../../scripts/check-lockfile-pins.cjs'`). Then, with the check in place, the two entries were deleted from the committed lock by hand → `npm run check:lockfile` exit **1** with the remediation, jest **5 failed / 15 passed** |
| AC4 — `npm ci` under the pinned CI npm | characterization-by-execution | full non-dry `npm ci` under `<npm109>` (10.9.0) in a clean clone with no `node_modules` → exit 0, lock untouched |
| AC5 — what the mechanism costs a consumer | characterization-by-execution | `npm pack --dry-run --json` (contents), the packed manifest's fields, and a **real** install of the tarball into a throwaway consumer project |
| gates | characterization | the table under `refactor` |

**Why the Jest suite is narrower than AC2, and why that is honest.** `dl-069` E3 is unchanged and
decisive: offline with a cold cache, `npm ci --dry-run` exits 0 on a lock that does not install, so
**no deterministic test can detect lockfile drift in general**, and the `determinism` directive
(REQ-SYS-07) forbids a unit test to reach the registry for the data that would. Nothing here tries.
The suite asserts local, file-only properties of two committed files and never runs npm; "a package
manager did something" is proven by recorded transcripts, exactly as the Implementation Notes say.

### red

**R1 — AC1: the reproduction, on the npm installed here.** It **does** still reproduce. A clone of
this branch at its base, in the scratchpad, outside every worktree, with no `node_modules`:

```
$ git clone -q --branch task/task-104-… <repo> <scratch>/ac1 && cd <scratch>/ac1
$ git log --oneline -1
f44768a8 wf(bug): sync bug-063-npm-11-erases-hoisted-emnapi-lock-entries [planned -> in-progress]
$ node --version && npm --version
v22.21.0
11.6.2
$ node -e '…read the two entries…'          # BEFORE
node_modules/@emnapi/core 1.11.3
node_modules/@emnapi/runtime 1.11.3
$ node -e 'console.log(JSON.stringify(require("./package.json").overrides))'
{"@napi-rs/wasm-runtime":{"@emnapi/core":"1.11.3","@emnapi/runtime":"1.11.3"}}
$ ls -d node_modules
ls: cannot access 'node_modules': No such file or directory

$ npm install                                # the ordinary command, no flags
added 500 packages, and audited 501 packages in 7s
EXIT=0

$ node -e '…read the two entries…'          # AFTER
node_modules/@emnapi/core ABSENT
node_modules/@emnapi/runtime ABSENT
$ git status --porcelain
 M package-lock.json
$ git diff --stat
 package-lock.json | 25 -------------------------
 1 file changed, 25 deletions(-)
```

The diff itself, pasted rather than described:

```diff
diff --git a/package-lock.json b/package-lock.json
index 857ac3d4..fb451260 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -562,31 +562,6 @@
       "dev": true,
       "license": "MIT"
     },
-    "node_modules/@emnapi/core": {
-      "version": "1.11.3",
-      "resolved": "https://registry.npmjs.org/@emnapi/core/-/core-1.11.3.tgz",
-      "integrity": "sha512-zLpS5asjEb7lq8jYLq37N6XKaE41DIexlY1rF/z4/tIl3wo13Sqm28fRyfIsKZD+NZ8mM5RoKkpW/rBcuoSZSg==",
-      "dev": true,
-      "license": "MIT",
-      "optional": true,
-      "peer": true,
-      "dependencies": {
-        "@emnapi/wasi-threads": "1.2.3",
-        "tslib": "^2.4.0"
-      }
-    },
-    "node_modules/@emnapi/runtime": {
-      "version": "1.11.3",
-      "resolved": "https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.11.3.tgz",
-      "integrity": "sha512-Xz4Tpyki7XyrpbUK1jR1AhdAdaXyhhY4lZ3neLodmhpuWfy2PAQN5B46sAiU4liOXGLkHypn/qU+jvfWSCYYLA==",
-      "dev": true,
-      "license": "MIT",
-      "optional": true,
-      "peer": true,
-      "dependencies": {
-        "tslib": "^2.4.0"
-      }
-    },
     "node_modules/@emnapi/wasi-threads": {
       "version": "1.2.3",
       "resolved": "https://registry.npmjs.org/@emnapi/wasi-threads/-/wasi-threads-1.2.3.tgz",
```

Two things this adds to `bug-063`, which reproduced with `--package-lock-only`. First, it is the
**plain, full `npm install`** — no flags, the command the bug is about — so the reversion is not an
artifact of the lock-only mode. Second, npm reports `added 500 packages … EXIT=0`: nothing in its
output mentions a removal, and the 25 deleted lines are the whole of the diff, with no neighbouring
change to draw a reviewer's eye. That is the shape of the defect.

**R2 — AC3: the check, written before it existed.** `test/cli/check-lockfile-pins.test.ts` first, run
in this worktree against the tree as committed at `f44768a8`:

```
$ npx jest test/cli/check-lockfile-pins.test.ts
● Test suite failed to run
    Cannot find module '../../scripts/check-lockfile-pins.cjs' from 'test/cli/check-lockfile-pins.test.ts'
Test Suites: 1 failed, 1 total
EXIT=1
```

Committed as `9af42e11` before any implementation.

### green — the mechanism, and why it is this one

Three changes across 5 non-Memory files (`git diff --stat main...HEAD -- package.json
package-lock.json scripts test` → `5 files changed, 402 insertions(+), 6 deletions(-)`), `src/` untouched
(`git diff --stat main...HEAD -- src` → empty output; no `index.ts` barrel is touched either, so this
branch has no surface for the semantic-merge class the wave brief warns about).

**1. `package.json` — the two peers become exact direct `devDependencies`** (AC2). This is the whole
of the mechanism:

```json
"devDependencies": {
  "@emnapi/core": "1.11.3",
  "@emnapi/runtime": "1.11.3",
  …
}
```

kept alongside `task-080`'s `overrides` block, and explained in a sibling `"//devDependencies:@emnapi"`
key (npm ignores `//`-prefixed keys) so the reader who meets two packages nothing imports finds the
reason in the file rather than in a task document. `task-080`'s own `"//overrides"` note ended
"`test/cli/lockfile-peer-overrides.test.ts` fails if the lock stops carrying these" — true, but it
left the impression that the `overrides` block keeps them there, which this task measured to be
false; a sentence this pass made misleading is this pass's to fix, so that note now carries a closing
clause pointing at the new one.

**Why a direct declaration and not one of the other candidates.**

- **Why not `packageManager` + corepack.** It would dissolve the bug rather than fix it, and
  `bug-063`'s own Notes say so — but it is `dl-076-toolchain-divergence-unexercised-until-tag`
  option (A), and `dl-076` is `in-discussion`
  (`grep -n '^status:' docs/self/docs/04_memory/design/dls/dl-076-*.md` → `status: in-discussion`).
  Choosing it is the approver's act, not an implementer's; this branch leaves it entirely open and
  uncommitted-to, exactly as `task-080` left `dl-069` option (a) open.
- **Why not a `postinstall`.** It is the one candidate with a real consumer cost — see AC5.
- **Why not a committed `.npmrc`.** There is no npm config that makes npm 11 record a pruned optional
  peer node; a repository `.npmrc` would also change resolution behaviour for everyone in ways
  nothing here needs. (`dl-076` E2 records that no `.npmrc` exists; this task does not add one.)
- **Why not "a different `overrides` shape".** The flat form pins a package tree-wide and would move
  the nested `@emnapi/core@1.10.0` under `@unrs/resolver-binding-wasm32-wasi` for no reason connected
  to this bug; `lockfile-peer-overrides.test.ts` already rejects it. And shape is not the issue:
  measured below, `overrides` of *any* shape binds a version without recording a node.
- **Why a direct declaration works.** npm never prunes a node a manifest directly depends on. It is
  declarative, runs no code at any point in anyone's install, and — being `devDependencies` — is
  invisible to consumers (AC5).

**The isolation control — the declarations are load-bearing, not decorative.** From the *fixed* tree,
with the `overrides` block still in place, only the two devDependency lines removed:

```
$ node -e '…delete the two devDependencies…'
$ node -e 'console.log("devDeps @emnapi:", …)'
devDeps @emnapi: []
$ npm install --no-audit --no-fund            # npm 11.6.2
removed 2 packages in 2s
EXIT=0
$ node -e '…read the two entries…'
node_modules/@emnapi/core ABSENT
node_modules/@emnapi/runtime ABSENT
```

So the pruning returns the moment the declarations go, and `overrides` alone never prevented it. That
control is why the check in AC3 asserts the **declaration** as well as the lock entry: the lock can be
correct at the instant someone deletes the mechanism that keeps it correct, and that commit must not
pass.

**2. `package-lock.json` — regenerated by the ordinary command, not hand-patched.** `npm install` in
this worktree produced the whole of it:

```
$ git diff --stat        # after `npm install`, before committing
 package-lock.json | 8 +++-----
 package.json      | 6 +++++-
```

Five insertions, five deletions in the lock: the root `packages[""]` gains the two devDependencies,
and four entries (`@emnapi/core`, `@emnapi/runtime`, `@emnapi/wasi-threads`, `tslib`) lose
`"optional": true`, because they are now reached through a non-optional dev path. No version,
`resolved` or `integrity` changed; `lockfileVersion` is still `3`. Unlike `task-080`, no surgery was
needed — the point of the change is that the ordinary command now produces the right file.

Committed as `657899ee`.

**3. `scripts/check-lockfile-pins.cjs` + `.d.cts`, exposed as `npm run check:lockfile`** (AC3). Pure,
offline, dependency-free CommonJS in the shape `scripts/check-release-tag.cjs` established
(`checkLockfilePins(manifest, lockfile) → { ok, message }`, plus a `readProject(dir)` so the script
can be pointed at any directory, which is also what makes its exit codes testable). It asserts three
properties, the third of which is general rather than `@emnapi`-specific:

1. every dependency pinned in `overrides` has a hoisted lock entry at exactly the pinned version;
2. every such dependency is **also** declared as an exact direct dependency — the `bug-063` property,
   the one the isolation control above proves is load-bearing;
3. no hoisted package declares a **required** peer with no hoisted entry to resolve it from — the
   general form of `bug-056`, so a future dependency repeating the shape is caught without anyone
   remembering to add a pin. Peers the parent marks `peerDependenciesMeta.<name>.optional` are exempt,
   and the exemption is itself covered by a test, so the assertion cannot pass vacuously.

Nothing in it runs npm or reads npm's output: `dl-069` S1/E4 measured the same lock producing two
different npm error messages three days apart, so the message is not a stable signal (`task-080` AC6,
honoured here).

### AC3 — the reversion now fails, and says what to do

`task-080` restored the entries and nothing noticed when they came undone; the point of this section
is that that is no longer true. **Measured, not asserted.** The two entries were deleted from the
committed lock by hand, in this worktree:

```
$ node -e '…delete node_modules/@emnapi/core and …/runtime from package-lock.json…'
$ npm run --silent check:lockfile
package-lock.json / package.json lost a pin the release gate depends on:

  - @napi-rs/wasm-runtime -> @emnapi/core@1.11.3: package-lock.json has NO hoisted entry for @emnapi/core
  - @napi-rs/wasm-runtime -> @emnapi/runtime@1.11.3: package-lock.json has NO hoisted entry for @emnapi/runtime
  - @napi-rs/wasm-runtime -> @emnapi/core: required peer with no hoisted lock entry to resolve it from
  - @napi-rs/wasm-runtime -> @emnapi/runtime: required peer with no hoisted lock entry to resolve it from

How to fix:
  1. If you have not committed the loss:  git checkout -- package.json package-lock.json
  2. If package.json changed on purpose:  keep each overridden package ALSO declared as an exact
     direct devDependency, then run  npm install  and commit both files together.
  3. Re-check with:  npm run check:lockfile

Why it matters: `npm ci` exits 1 under npm 10.9.x — the npm Node 22.12.0 bundles, and
.github/workflows/publish.yml pins that Node in env.NODE_VERSION — on a lock missing these
entries, so the release gate cannot install (bug-056). An `overrides` pin alone does not keep
them there: npm 11.x prunes them on an ordinary `npm install` and reports `up to date` (bug-063).
EXIT=1

$ npx jest test/cli/check-lockfile-pins.test.ts test/cli/lockfile-peer-overrides.test.ts
Test Suites: 2 failed, 2 total
Tests:       5 failed, 15 passed, 20 total

$ git checkout -- package-lock.json && npm run --silent check:lockfile >/dev/null ; echo EXIT=$?
EXIT=0
```

And the same failure as an exit code from the standalone entry point, which is what makes it usable
outside jest — covered permanently by a test that builds a synthetic broken project in a temp dir and
spawns the script (`exits 1 and writes the remediation to stderr…`), so the contract is pinned rather
than only demonstrated here.

**Where this check runs, stated plainly rather than overclaimed.** It runs (i) on demand in about a
second, `npm run check:lockfile`; (ii) in `npx jest`, hence in `prepublishOnly`, hence in the gate job
of `.github/workflows/publish.yml`. It does **not** run on `git commit` and it does **not** run on
push: a git hook is a developer-environment decision nobody has taken, and a push-triggered CI job is
`dl-069` option (a), which is explicitly *not* ratified (`dl-069` is `ready` as option (b) only). So
the residual window is unchanged in shape and much smaller in practice: the reversion no longer
*happens* on an ordinary install, and if it is reintroduced deliberately, the first thing that runs
the suite says so with a remediation. Closing the window entirely is `dl-076`'s to decide — see
Proposed elements.

### AC4 — `npm ci` under the npm the pipeline pins

The workflow pins **Node 22.12.0** (`env.NODE_VERSION`, re-read above), and Node 22.12.0 bundles
**npm 10.9.0** (re-derived from `nodejs.org/dist/index.json` above, not assumed). In a fresh clone of
this branch, outside every worktree, with **no `node_modules`** — so nothing is masked:

```
$ git clone -q --branch task/task-104-… <repo> <scratch>/ac4 && cd <scratch>/ac4
$ git log --oneline -1
657899ee feat(cli): task-104 — declare the two @emnapi peers as exact devDependencies …
$ ls -d node_modules
ls: cannot access 'node_modules': No such file or directory
$ <npm109> --version
10.9.0
$ <npm109> ci --no-audit --no-fund
added 502 packages in 10s
EXIT=0
$ git status --porcelain
(empty — `npm ci` did not rewrite the lock)
$ node scripts/check-lockfile-pins.cjs
package-lock.json carries every pinned entry (2 overrides pin(s)) and every required peer edge resolves from the lock
EXIT=0
```

A **full, non-dry** `npm ci`, not a `--dry-run`. 502 packages against the 500 an npm-11 install of the
pre-fix tree reported — the two `@emnapi` packages are now really installed rather than resolved and
discarded, which is the point.

**A residual divergence, measured because it would otherwise be assumed away.** `npm ci` is safe, but
`npm install` under the *pinned* npm still rewrites metadata this repository's npm 11 does not:

```
$ <npm109> install --package-lock-only --no-audit --no-fund   # fresh clone of this branch
up to date in 2s
$ git diff --stat
 package-lock.json | 12 ------------
$ git diff -- package-lock.json | grep -E "^[-+]" | grep -v "^[-+][-+]" | sort | uniq -c
     12 -      "peer": true,
$ node scripts/check-lockfile-pins.cjs >/dev/null ; echo EXIT=$?
EXIT=0
```

Twelve `"peer": true` flags, on `@babel/core`, `@emnapi/core`, `@emnapi/runtime`,
`@typescript-eslint/parser`, `acorn`, `eslint`, `express`, `hono`, `jest`, `typescript`, `zod`,
`zod-to-json-schema` — metadata only; no version, `resolved` or `integrity` moves, the `@emnapi`
entries survive, and the check stays green. `task-080` saw the same class from the other direction
("flips the `peer: true` flag on 11 unrelated entries") and left it in a `done` task's notes, where
nothing schedules it. It is unchanged by this task and carried to Proposed elements rather than
absorbed.

### AC5 — what the mechanism costs a consumer

The task says the package ships `dist` and `README.md` only. **Measured rather than taken on trust,
and the premise is slightly wrong in the package's favour** — `LICENSE` ships too, because npm always
includes it regardless of `files`:

```
$ npm pack --dry-run --ignore-scripts --json | node -e '…'
entryCount 331 unpackedSize 1433059
scripts/*: []
package-lock: []
top-level: [ 'LICENSE', 'README.md', 'dist', 'package.json' ]
```

So `scripts/check-lockfile-pins.cjs` is **not in the tarball at all**, and neither is the lockfile.
The published `package.json` does carry the fields, which is the part worth checking rather than
reasoning about:

```
$ npm pack --ignore-scripts --pack-destination <scratch>/pack && tar -xzf wingfoil-0.1.0.tgz package/package.json
$ node -e '…read package/package.json…'
has devDependencies: true
emnapi in devDeps: [ '@emnapi/core', '@emnapi/runtime' ]
scripts keys: [ 'build', 'prepack', 'prepublishOnly', 'publish:staging', 'check:lockfile', 'lint', 'docs:api', 'test', 'test:coverage' ]
has overrides: true
install-time lifecycle scripts present: []
```

Three of those lines matter and each is inert for a consumer: npm installs only the **root** project's
`devDependencies`, never a dependency's; npm honours `overrides` only from the **root** manifest,
never from a dependency's; and `check:lockfile` is reachable only through an explicit `npm run`, which
nothing on an install path issues — and it would fail to resolve its own file anyway, since
`scripts/` is not shipped. The decisive measurement is the install itself, into a throwaway consumer
project:

```
$ mkdir <scratch>/consumer && echo '{"name":"consumer","version":"1.0.0","private":true}' > package.json
$ npm install <scratch>/pack/wingfoil-0.1.0.tgz --no-audit --no-fund
added 111 packages in 21s
EXIT=0
$ ls node_modules/@emnapi
ls: cannot access 'node_modules/@emnapi': No such file or directory
$ ls node_modules/wingfoil
dist  LICENSE  package.json  README.md
```

**Zero `@emnapi` packages reach a consumer, and no code of ours runs during their install.** The
comparison the AC asks for, each answered against that measurement:

| Candidate | Consumer cost | Failure mode if it goes wrong |
|---|---|---|
| **Exact direct `devDependencies`** (chosen) | **none** — measured above: not installed, not honoured, not executed | a developer or CI installs two extra small packages (500 → 502). Local only |
| `postinstall` script | **runs on every consumer install**, and ships in the manifest | breaks or slows an install of `wingfoil` for reasons that have nothing to do with `wingfoil`; `--ignore-scripts` consumers silently skip it, so it is unreliable *and* intrusive |
| committed `.npmrc` | none (not in `files`) | changes resolution for every developer and for CI, globally, to fix one edge; no npm setting actually preserves a pruned optional peer node, so it would not even work |
| a different `overrides` shape | none (a dependency's `overrides` is ignored) | measured not to solve the problem: shape does not make npm record a node. A flat pin additionally moves the unrelated nested `@emnapi/core@1.10.0` |
| the lockfile check alone (`npm run check:lockfile`) | none (`scripts/` is not shipped) | reports the reversion but cannot prevent it — which is the shape `task-080` already had. It is kept **in addition to** the mechanism, not instead of it |

### refactor — gates, run in this worktree

No code refactoring was needed. The worktree's `node_modules` was **deleted and reinstalled with
`npm ci`** before this table, per the task's Implementation Notes, and `git status --porcelain` is
empty after it (so `npm ci` rewrote nothing):

```
$ rm -rf node_modules && npm ci --no-audit --no-fund       # npm 11.6.2, node v22.21.0
added 502 packages in 6s
EXIT=0
$ git status --porcelain
(empty)
```

| Gate | Command | Result |
|---|---|---|
| unit + BDD suite | `npx jest` | **139 suites / 2306 tests passed**, exit 0 |
| coverage ≥80, non-regressing | `npx jest --coverage` | **98.56 %** statements / 94 branches / 98.75 functions / 99.4 lines; 139 suites / 2306 tests, exit 0 |
| build typecheck | `npx tsc -p tsconfig.build.json --noEmit` | exit 0, no output |
| build **emitting** | `npx tsc -p tsconfig.build.json` | exit 0, no output |
| full typecheck (`bug-026`) | `npx tsc --noEmit -p tsconfig.json` | exit 0, **no output at all** — no exception carried |
| lint | `npm run lint` | exit 0 |
| API docs | `npm run docs:api` | exit 0 |
| lockfile pins (new) | `npm run check:lockfile` | exit 0 |

Coverage is `main`'s by construction, not by coincidence: `collectCoverageFrom` is `src/**/*.ts` and
`git diff --stat main...HEAD -- src` returns empty output, so nothing this branch adds is measured by
it. `git diff --name-only main...HEAD | grep -E 'index\.ts$'` is likewise empty — **no barrel and no
shared `src/` import line is touched**, so this branch carries none of the semantic-merge risk the
wave brief describes, and it can be merged in any order relative to `task-102` and `task-103`.
`main` never moved during the task (`git merge-base --is-ancestor main HEAD` → true), so no merge of
`main` into this branch was made.

**Adjacent but untouched, as instructed.** `bug-046` (the lockfile's own `engines` copy that nothing
asserts) and `bug-048` (CI pins a Node version two dev dependencies reject) are **not** absorbed.
`bug-046` is now materially cheaper to fix and it is worth saying where: `scripts/check-lockfile-pins.cjs`
already parses both files, already has the `{ ok, message }` + remediation convention, and already
runs in three places (on demand, in `npx jest`, and in the gate through `prepublishOnly`), so the
missing `engines` assertion is a fourth `problems.push` in `checkLockfilePins` and one synthetic test,
with no new wiring. `bug-048` is not made cheaper or harder by anything here.
