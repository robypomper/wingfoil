---
id: "task-080-fix-npm-ci-under-pinned-npm"
type: task
title: "Make the release gate installable under the npm the pipeline pins (npm 10.9.0 / Node 22.12.0)"
status: in-progress
release: "v0.2"
priority: "high"
tags: ["v0.2", "release", "distribution", "dependencies"]
ref: "task-077-first-real-staging-run"
bug: ["bug-056-npm-ci-fails-under-pinned-npm-10-9"]
depends_on: ["task-073-fix-stale-package-lock"]
tmpl_version: 260703
---

## Description

`bug-056-npm-ci-fails-under-pinned-npm-10-9` (`open`, high, **release blocker**): the `gate` job of
`.github/workflows/publish.yml` dies at its `Install` step because `npm ci` exits 1 under npm 10.9.0 —
the npm Node 22.12.0 bundles, and 22.12.0 is what the workflow's own `env.NODE_VERSION` pins — with
`Missing: @emnapi/core@1.11.3` / `Missing: @emnapi/runtime@1.11.3 from lock file`. The same lockfile
bytes install under npm 11.6.2, which is why nothing local ever caught it. Until this is fixed the
publish pipeline cannot get past step 1 and **no release can be cut**.

**The real fix is a dependency-policy change, not another lock bump.** `dl-069-lockfile-drift-unguarded`
(`in-discussion`) already analysed the structure: `@napi-rs/wasm-runtime@1.1.6` declares peers
`@emnapi/core` and `@emnapi/runtime` that the lock records **no hoisted entry for**, so npm resolves
them from the registry at install time. `dl-069`'s **option (b) — pin those peers with an `overrides`
block in `package.json`** — is the change that makes them resolve from the lock instead, and per that
DL's amendment (this ingest) it is now the only one of its two options that actually unblocks the gate:
option (a), a push-triggered CI job, reports a failure it cannot repair, and would only see this class
at all if it pins the same `NODE_VERSION`. `task-073-fix-stale-package-lock` (`done`) is a `depends_on`
rather than a duplicate: its three-line `@emnapi/wasi-threads` bump was correct for the npm it
measured, and left the peers unlocked.

`dl-069` is `in-discussion`, so **the option choice is the approver's and must be settled before this
task moves to `in-progress`** — see Implementation Notes.

## Acceptance Criteria

1. **AC1 — the gate installs under the npm the pipeline pins.** With npm **10.9.0** (obtained as
   `npm install --prefix <scratch> npm@10.9.0`; `<scratch>/node_modules/.bin/npm --version` must print
   `10.9.0`), run in a clean checkout of the branch:
   `npm ci --dry-run --no-audit --no-fund` → **exit 0**. The command and its exit code go in the
   Execution Notes. A run under any other npm does not satisfy this AC.
2. **AC2 — a full, non-dry `npm ci` under npm 10.9.0 also exits 0**, in a checkout with no
   `node_modules` present (the worktree convention symlinks `node_modules` from the primary checkout —
   `bug-043`'s own analysis — which would mask the result).
3. **AC3 — no regression under the developer npm.** `npm ci --dry-run --no-audit --no-fund` under npm
   11.6.2 still exits 0.
4. **AC4 — the peers are in the lock.** `grep -n '"node_modules/@emnapi' package-lock.json` lists
   hoisted entries for **both** `@emnapi/core` and `@emnapi/runtime` (at `main` `0cf643f` that grep
   returns a single line, for `"node_modules/@emnapi/wasi-threads"`).
5. **AC5 — the pinned versions are recorded and justified** in `package.json`, with a comment or an
   Execution-Notes entry naming why an `overrides` block points at a dev-only, optional, transitive
   dependency of `eslint`'s resolver chain — `dl-069` option (b)'s stated cost is precisely that a
   future reader cannot attribute it.
6. **AC6 — nothing keys on npm's error text.** No test, script or workflow step added by this task
   greps npm output; `dl-069` S1 and its E4 (the same lock produced two different messages three days
   apart) make exit status the only stable signal.
7. **AC7 — the existing gates stay green**: `npx jest`, `npx jest --coverage` (coverage non-regressing,
   >80%), `npx tsc -p tsconfig.build.json --noEmit`, `npm run lint`, `npm run docs:api` all exit 0.
   `npx tsc --noEmit -p tsconfig.json` may still carry only the permitted `bug-026` error.
8. **AC8 — `bug-056` is carried to `resolved`** by `bug.sync_state` off this task's `bug:` field, not
   by a separate edit.

## Implementation Notes

- **Settle `dl-069` first.** It is `in-discussion`; its option (b) is what this task implements, and
  its amendment records the two consequences the `task-077` reviewer drew. If the approver chooses (a)
  as well, that is a *separate* carrier (`dl-069` Action 2 names `task-078`, now merged) — this task
  must not grow a CI workflow.
- **Do not fix this by changing `NODE_VERSION`.** Raising the pin to a Node whose bundled npm tolerates
  the unlocked peers would make the symptom disappear and leave the cause; it would also reopen
  `bug-023`/`adr-010`'s Node-floor reasoning, which `task-074` closed. If it is nonetheless proposed,
  it is a decision, not an implementation choice.
- **`@emnapi` versions move without a commit here.** `bug-056` recorded `1.11.3` as the version npm 10.9
  demanded on 2026-09-21; `bug-043` had recorded `1.10.0`/`1.2.2` weeks earlier. Re-derive the version
  to pin at execution time — do not copy `1.11.3` out of this document.

**Must be re-verified at execution time, not read from this task:**

1. That Node 22.12.0 still bundles npm 10.9.0 — `curl -sS https://nodejs.org/dist/index.json` and read
   the `v22.12.0` row. The pin's npm is the whole premise.
2. That `.github/workflows/publish.yml` still carries the workflow key `env.NODE_VERSION: '22.12.0'`,
   consumed by all three `actions/setup-node` steps as `node-version: ${{ env.NODE_VERSION }}`.
3. The current hoisted `@emnapi` entries in `package-lock.json` (`grep -n '"node_modules/@emnapi'`).
4. That the failure still reproduces **before** the fix — a red-first AC1 run under npm 10.9.0 — so the
   fix is shown to cause the green, not merely to coexist with it.
5. `bug-056`'s claim that `bug-043` cannot be reopened, re-read from
   `docs/self/.wingfoil/memory.yaml`'s `bug` machine, if anyone proposes reopening it instead.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass.
     AC classification (dl-014/T1, `testing` directive) is required per AC: AC1/AC2 are red-first —
     the failure is reproducible today under npm 10.9.0 and must be shown red before the fix;
     AC3/AC4/AC7 are characterization. -->

### design — role: architect

Branch `task/task-080-fix-npm-ci-under-pinned-npm`, worktree
`/home/robypomper/Workspaces/.wf2-wt/task-080`, created from `main` at `0cf643f`
(`wf(decision-log): approve dl-075-no-bare-line-offsets-in-memory`). Host environment for every command
below: Linux, `node v22.21.0`, host `npm 11.6.2`. **The npm under test is not the host npm**: npm 10.9.0
was installed into the scratchpad and invoked by absolute path, written `<npm109>` below:

```
$ npm install --prefix <scratch>/npm109 npm@10.9.0 --no-audit --no-fund   # exit 0
$ <scratch>/npm109/node_modules/.bin/npm --version
10.9.0
```

**`agent.read_related` (dl-015, HARD gate).** `depends_on: ["task-073-fix-stale-package-lock"]`
(`grep -n '^depends_on:' docs/self/docs/04_memory/v0.2/task-080-fix-npm-ci-under-pinned-npm.md` →
`depends_on: ["task-073-fix-stale-package-lock"]`); `task-073` is `status: done`
(`grep -n '^status:' docs/self/docs/04_memory/v0.2/task-073-fix-stale-package-lock.md` → `status: done`).
Its Execution Notes were read in full. What this task takes from them, acknowledged item by item:

1. **Its `green` section already diagnosed this task's cause and named this task's fix.** It recorded
   that npm left the two peers unlocked and only re-pinned the hoisted `@emnapi/wasi-threads` orphan,
   that "the structural cause is therefore not fixed by this commit, only its current instance", and
   that "a *durable* fix would have to change `package.json` (e.g. an `overrides` pin), which AC6/the
   task scope forbid here". This task is that change. Its prediction is confirmed below, not copied:
   the same `grep` is re-run at this branch's base.
2. **Its evidence is npm-11-only, and says so implicitly.** Every measurement in it is stamped
   `npm 11.6.2`; nothing there contradicts this task, but nothing there covers npm 10.9 either. That
   gap is the whole of `bug-056`.
3. **Its worktree warning is operative here.** "Until it lands, a new worktree cannot `npm ci` … the
   established workaround is symlinking `node_modules` from the primary checkout — which is exactly why
   AC1 forbids using such a worktree as evidence." Every `npm ci` recorded below therefore runs in a
   **throwaway clone in the scratchpad**, never in this worktree.
4. **Its method is reused deliberately**: characterize the lock diff entry by entry with a scripted
   `packages{}` comparison rather than asserting it, and re-run the gate set inside a real `npm ci`
   tree rather than in a warm worktree.

**`agent.verify_specs`.** No new `tech-spec` is needed, and none is revised. The contract this task
serves already exists and is approved: `spec-015-packaging-publishing` §3 stage 1 makes `npm ci` the
gate's first step, and `REQ-SYS-09` ("Distribution as an npm package") is the requirement behind it.
`REQ-SYS-09` states its own verification route — "distribution requirement with no behavioral BDD
feature; verified directly against the npm-publish acceptance test" — so the `review` BDD gate has **no
scenario to run for this task**; checked, not assumed:

```
$ grep -rln "npm\|packag" docs/02_requirements/02_bdd/features/
(no output — no .feature file mentions npm or packaging at all)
```

The acceptance evidence is therefore the recorded `npm ci` exit codes under both npms plus the existing
packaging suites (`test/cli/npm-distribution.test.ts`, `test/cli/publish-pipeline.test.ts`), which run
green in the gate set below, plus the new deterministic lock assertion this task adds (see `red`).

**Premises re-verified at execution time (Implementation Notes items 1–4), not read from the task.**

1. Node 22.12.0 still bundles npm 10.9.0 — from Node's own release index, not from a report:

   ```
   $ curl -sS https://nodejs.org/dist/index.json | node -e '…select v22.12.0 / v22.21.0…'
   v22.12.0 npm 10.9.0 Jod
   v22.21.0 npm 10.9.4 Jod
   ```

   The host's `npm 11.6.2` is bundled by neither — it is a manual upgrade, which is `bug-056`'s "why no
   one saw it locally".
2. `.github/workflows/publish.yml` still pins the same Node, and all three `setup-node` steps still
   consume it: `grep -n "NODE_VERSION" .github/workflows/publish.yml` → the `env:` key
   `NODE_VERSION: '22.12.0'` plus three `node-version: ${{ env.NODE_VERSION }}` uses (and one comment
   line naming 22.12.0 as the floor).
3. The hoisted `@emnapi` entries at this branch's base are exactly what `bug-056` recorded:

   ```
   $ grep -n '"node_modules/@emnapi' package-lock.json      # at 0cf643f
   565:    "node_modules/@emnapi/wasi-threads": {
   ```

   One hoisted entry, and it is neither of the two the failure names. The two peers exist in the lock
   only **nested** under `node_modules/@unrs/resolver-binding-wasm32-wasi/node_modules/@emnapi/core`
   and `…/@emnapi/runtime`, both pinned `1.10.0` — a position that cannot satisfy a peer edge of the
   **hoisted** `node_modules/@napi-rs/wasm-runtime`, whose own lock entry declares
   `"peerDependencies": { "@emnapi/core": "^1.7.1", "@emnapi/runtime": "^1.7.1" }`.
4. The failure still reproduces **before** the fix — the red-first evidence, recorded under `red`.

**The version to pin was re-derived, not copied from this document** (Implementation Notes item 3):
`npm view @emnapi/core version` → `1.11.3`, `npm view @emnapi/runtime version` → `1.11.3`, and
`npm view @emnapi/core versions` lists `1.7.0 … 1.11.3` as the ^1.7.1-satisfying set. `1.11.3` is what
the failure demands today *and* what the registry resolves today, so pinning it changes no version
anyone's install currently computes — it only makes that version come from the manifest instead of from
the registry.

**`dl-069` is still `in-discussion` — flagged, not resolved here.**
`grep -n '^status:' docs/self/docs/04_memory/design/dls/dl-069-lockfile-drift-unguarded.md` →
`status: in-discussion`. This task's Description makes the option choice a precondition. What is
implemented here is **option (b) only** — the `overrides` pin — which is (i) what this task's own AC4
and AC5 require in so many words, (ii) what `dl-069`'s amendment records as "the only option that
actually unblocks the gate", and (iii) what the approver scheduled when this task was moved to
`backlog` with those ACs. **No CI workflow is added**: `.github/` is untouched by this branch, so
option (a) remains entirely open and uncommitted-to. If the approver reads the precondition strictly,
the standing item is to approve `dl-069` with the choice recorded in its `Reason:` — it is carried to
the final report rather than acted on here.

**The pin stays where it is** (Implementation Notes item 2). `NODE_VERSION` is untouched; a lockfile-level
fix exists and is implemented below, so the `adr-010` Node floor is never in question. `package.json`'s
`engines.node` is likewise untouched.

**T1 acceptance-criterion classification (dl-014 / testing directive).**

| AC | Class | Evidence / test |
|---|---|---|
| AC1 — `npm ci --dry-run` exits 0 under npm 10.9.0 | **red-first** — the red is an executable reproduction, not a Jest test (see "Why the Jest test is narrower than the AC") | clean clone of `main` under `<npm109>` → exit **1**; clean clone of this branch → exit **0**; both recorded verbatim |
| AC2 — full non-dry `npm ci` under npm 10.9.0, no `node_modules` present | **red-first** | same throwaway clone, `node_modules` absent before the run (`ls -d node_modules` → no such file) |
| AC3 — no regression under the developer npm (11.6.2) | characterization | same clone, host `npm ci --dry-run` → exit 0 (green before and after; the point is that it stays green) |
| AC4 — both peers hoisted in the lock | **red-first** | `test/cli/lockfile-peer-overrides.test.ts` — fails at this branch's base (no hoisted entries), passes after `green`; plus the `grep` in both states |
| AC5 — pinned versions recorded and justified in `package.json` | characterization | the `overrides` block + the `green` section's attribution paragraph, which is the artefact AC5 asks for |
| AC6 — nothing keys on npm's error text | characterization | `grep -rn "npm error\|EUSAGE\|Missing:" test/ src/ scripts/ .github/` → no match introduced by this task (run under `refactor`) |
| AC7 — existing gates stay green | characterization | the gate table under `refactor`, run inside a real `npm ci` tree |
| AC8 — `bug-056` carried by `bug.sync_state` | characterization | the two `wf(bug): sync` commits on this branch, driven off the task's `bug:` field |

**Why the Jest test is narrower than the AC, and why that is honest.** `dl-069` E3 is decisive and
unchanged: offline, with a cold cache, `npm ci --dry-run` exits 0 on a lock that does not install, so
**no deterministic test can detect lockfile drift in general** — detection needs registry data, which
the `determinism` directive (REQ-SYS-07) and the `testing` directive both forbid a unit test to reach
for. The test added here therefore does **not** attempt that. It asserts a strictly local, file-only
property — every peer this repository pins via `overrides` has a hoisted lock entry at exactly the
pinned version — which is entirely offline and deterministic (it reads two files and parses them), and
which is exactly the property whose absence produces `bug-056`. It also catches the specific silent
revert measured under `green` (D1). AC1/AC2 remain proven by recorded `npm ci` runs, not by Jest, and
AC6 is satisfied because the test never looks at npm's output: it never runs npm.

### red — the reproduction (executable) and the deterministic test

**R1 — AC1/AC2 red: the gate's own command, under the gate's own npm, on `main`.** Cloned `main` into
the scratchpad, **outside every worktree**, so no symlinked `node_modules` could mask the result
(`task-073`'s Execution Notes and `bug-043`'s analysis both warn about exactly this):

```
$ git clone -q --branch main /home/robypomper/Workspaces/WingFoil2 <scratch>/mainclone
$ cd <scratch>/mainclone && git log --oneline -1
0cf643f wf(decision-log): approve dl-075-no-bare-line-offsets-in-memory [in-discussion → ready]
$ node -v && <npm109> --version
v22.21.0
10.9.0
$ <npm109> ci --dry-run --no-audit --no-fund ; echo EXIT=$?
npm error code EUSAGE
npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
npm error Missing: @emnapi/core@1.11.3 from lock file
npm error Missing: @emnapi/runtime@1.11.3 from lock file
EXIT=1
```

Reproduced at this branch's base rather than at `bug-056`'s `b505473`, and with the same two missing
packages — the defect is head-independent. (`node -v` is the host's 22.21.0; the *npm* is 10.9.0, which
is the variable under test. Node's own version is not implicated: the same bytes pass under 11.6.2 on
this very Node, which is the asymmetry `bug-056` is about.)

**R2 — the deterministic red: `test/cli/lockfile-peer-overrides.test.ts`.** The AC1/AC2 red above is an
executable reproduction, not a suite, and by `dl-069` E3 no suite can replace it. What *can* be
asserted offline is the structural property whose absence produces it. Run in this worktree, before any
fix:

```
$ npx jest test/cli/lockfile-peer-overrides.test.ts ; echo EXIT=$?
● package.json overrides (task-080) — shape › declares at least one override …
    expect(received).toBeGreaterThan(expected)   Expected: > 0   Received: 0
● package-lock.json (task-080 AC4) — required peer edges resolve from the lock › hoists every
  required peer any hoisted package declares
    - Array []
    + Array [
    +   "@napi-rs/wasm-runtime -> @emnapi/core",
    +   "@napi-rs/wasm-runtime -> @emnapi/runtime",
    + ]
Tests: 2 failed, 5 passed, 7 total
EXIT=1
```

The failing list is **exactly** the two packages npm 10.9 reports missing, derived independently: the
test never runs npm and never reads its output (AC6) — it walks the lock's own hoisted entries and
reports every *required* peer edge with no hoisted entry to resolve from. Peers carrying
`peerDependenciesMeta.<name>.optional: true` are exempt, and the exemption is measured rather than
assumed: scanning both locks with that rule shows **11 unhoisted peer edges at `main`, 9 of them
optional** (jest's `node-notifier` ×4, `eslint -> jiti`, `dedent -> babel-plugin-macros`,
`jest-config -> esbuild-register`/`ts-node`, `@modelcontextprotocol/sdk -> @cfworker/json-schema`) —
and the 2 non-optional ones are the `@emnapi` pair. After the fix the same scan reports 9, all
optional. So the assertion is non-vacuous both ways: it fails today for the two edges that matter and
would fail again the moment either is dropped from the lock.

The remaining five assertions in that file (`overrides` shape, exact-version pins, lock entry at the
pinned version, no stale pin) pass vacuously with no `overrides` block present and become load-bearing
under `green`; they are the durability half, aimed at D1 below.

### green — the fix: pin the two peers, hoist exactly those two entries

The change is 32 added lines across two files and removes nothing.

**1. `package.json` — a scoped `overrides` block plus its attribution** (AC5). JSON carries no comments,
so the "why" is recorded in a sibling `"//overrides"` key — npm ignores `//`-prefixed keys, and it puts
the explanation where the future reader actually looks, which is the precise cost `dl-069` option (b)
charges ("action at a distance that a future reader will struggle to attribute"). The Execution-Notes
copy is this section:

```json
"overrides": {
  "@napi-rs/wasm-runtime": {
    "@emnapi/core": "1.11.3",
    "@emnapi/runtime": "1.11.3"
  }
}
```

- **Why `@napi-rs/wasm-runtime` and not the tree.** The nested form pins only the edges *that package*
  declares. `@unrs/resolver-binding-wasm32-wasi` depends on `@emnapi/core@1.10.0` and
  `@emnapi/runtime@1.10.0` exactly, nested under its own `node_modules/` in the lock; a flat
  `"@emnapi/core": "1.11.3"` override would have moved those too, for no reason connected to this bug.
  Scoping keeps the blast radius to the two edges that fail.
- **Why exact versions and not `^1.11.3`.** A range is re-resolved from the registry on every install,
  which is the mechanism being removed. `1.11.3` was re-derived at execution time
  (`npm view @emnapi/core version` → `1.11.3`, `npm view @emnapi/runtime version` → `1.11.3`), not
  copied from this task's Description; it satisfies the declared peer range `^1.7.1` and equals what an
  unpinned resolve computes today, so no install anyone runs today changes version because of this.
- **Why a dev-only, optional, transitive package is pinned from the top-level manifest.** There is no
  lower place to put it: the edge belongs to `@unrs/resolver`'s wasm fallback, reached through `eslint`,
  and this repository cannot edit either package's manifest. `overrides` is npm's only mechanism for
  constraining a transitive edge, and the gate cannot install until this one is constrained.

**2. `package-lock.json` — the two hoisted entries, and nothing else.**
`git diff --stat` → `package-lock.json | 25 +++`, `package.json | 7 +++`; 32 insertions, **0 deletions**:

```
$ grep -n '"node_modules/@emnapi' package-lock.json        # AC4, after
565:    "node_modules/@emnapi/core": {
578:    "node_modules/@emnapi/runtime": {
590:    "node_modules/@emnapi/wasi-threads": {
```

**Why the lock was patched surgically rather than regenerated.** Regenerating with the host npm would
swap one npm's opinion of the whole file for another's and be unreviewable; regenerating with npm 10.9.0
was tried and produces a **larger** diff than the fix needs — besides the two entries it also flips the
`"peer": true` flag on 11 unrelated entries (`@babel/core`, `@typescript-eslint/parser`, `acorn`,
`browserslist`, `eslint`, `express`, `hono`, `jest`, `typescript`, `zod` lose it;
`@emnapi/wasi-threads` gains it), which is npm 10.9 and npm 11.6 disagreeing about metadata, not
anything this bug needs. So the two entries were taken **verbatim** from that npm-10.9.0 resolution and
inserted; every other byte of the lock is untouched. Their `resolved`/`integrity` were then checked
against the registry independently of npm's resolution:

```
$ npm view @emnapi/core@1.11.3 dist.integrity dist.tarball
dist.integrity = 'sha512-zLpS5asjEb7lq8jYLq37N6XKaE41DIexlY1rF/z4/tIl3wo13Sqm28fRyfIsKZD+NZ8mM5RoKkpW/rBcuoSZSg=='
dist.tarball   = 'https://registry.npmjs.org/@emnapi/core/-/core-1.11.3.tgz'
$ npm view @emnapi/runtime@1.11.3 dist.integrity dist.tarball
dist.integrity = 'sha512-Xz4Tpyki7XyrpbUK1jR1AhdAdaXyhhY4lZ3neLodmhpuWfy2PAQN5B46sAiU4liOXGLkHypn/qU+jvfWSCYYLA=='
dist.tarball   = 'https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.11.3.tgz'
```

Both match the inserted entries byte for byte. Nothing else in the lock moved — no entry added beyond
these two, none removed, no version, `resolved` or `integrity` changed, `lockfileVersion` still `3`,
and the root `packages[""]` entry is **unchanged**: npm records no `overrides` key there (verified on
all three of the regenerated locks), so the surgical lock and a regenerated one agree about the root.

**Which half of the change actually makes `npm ci` pass — measured, because it is not obvious.** Two
control runs under npm 10.9.0, each on a clean copy of `main`:

```
lock entries only, no overrides   →  npm ci --dry-run  EXIT=0
overrides only, lock untouched    →  npm ci --dry-run  EXIT=1   (Missing: @emnapi/core@1.11.3 …)
```

So the **lock entries** are what the gate needs — `npm ci` never re-resolves a manifest — and the
`overrides` block is what keeps them from being whatever `@emnapi/core@latest` happens to be at the next
`npm install`. Both halves ship because the fix has to survive the next re-resolve, not only pass today.

**D2 — the override demonstrably binds this edge.** With the block set to a deliberately *stale*
`1.11.2` (registry latest is `1.11.3`) and the lock re-resolved under npm 10.9.0, the recorded versions
are `1.11.2`, not latest. The version now comes from the manifest, which is the whole claim of option (b).

**D1 — a real limitation, measured and not smoothed over.** Re-resolving the *fixed* tree under the host
**npm 11.6.2** (`npm install --package-lock-only`) **deletes both hoisted entries again**, `overrides`
block present and all — that npm simply does not record these optional peer nodes, which is the same
npm-version asymmetry that let `bug-056` reach CI in the first place:

```
$ npm install --package-lock-only --no-audit --no-fund      # npm 11.6.2, on the fixed tree
$ node -e '…read the two entries…'
core: undefined runtime: undefined
```

`npm ci` never does this, so the release gate is safe; but a developer on npm 11.x who runs a plain
`npm install` will silently revert this fix in a diff that shows nothing else. That is exactly what
`test/cli/lockfile-peer-overrides.test.ts` now fails on, so the suite catches the revert before the gate
does — and it is filed as a proposed element in the review summary, since the durable answer is to make
developers run the pinned npm rather than to rely on a test noticing.

### refactor — gates, run inside a real `npm ci` tree

No code refactoring was needed: the change is a manifest pin, two lock entries and one test file; `src/`
is untouched (`git diff --stat main...HEAD -- src` → empty output). What this phase did is run the gates
where they mean something. A throwaway clone of **this branch** was made in the scratchpad — outside
every worktree, so nothing is masked by a symlinked `node_modules` — and installed with **npm 10.9.0**,
i.e. the CI runner's own npm, not the host's:

```
$ git clone -q --branch task/task-080-fix-npm-ci-under-pinned-npm /home/robypomper/Workspaces/WingFoil2 <scratch>/fixclone
$ cd <scratch>/fixclone && git log --oneline -1
469cd1c fix(build): task-080-fix-npm-ci-under-pinned-npm — pin the @emnapi peers and hoist them in the lock
$ ls -d node_modules
ls: cannot access 'node_modules': No such file or directory
$ <npm109> ci --dry-run --no-audit --no-fund ; echo AC1_EXIT=$?      # AC1
added 528 packages in 3s
AC1_EXIT=0
$ ls -d node_modules                                                  # still absent — AC2 starts clean
ls: cannot access 'node_modules': No such file or directory
$ <npm109> ci --no-audit --no-fund ; echo AC2_EXIT=$?                 # AC2 — full, non-dry
added 498 packages in 18s
AC2_EXIT=0
$ git status --porcelain                                              # the install rewrites nothing
(empty)
$ npm --version && npm ci --dry-run --no-audit --no-fund >/dev/null 2>&1 ; echo AC3_EXIT=$?   # AC3
11.6.2
AC3_EXIT=0
```

So the same bytes now install under both npms, where `main` installs under only one. (The dry run counts
528 packages and the real install 498: `--dry-run` reports the full ideal tree, the real install skips
optional packages that do not match this platform. Both exit 0, which is what the AC asks; per AC6 the
counts are read for understanding, nothing keys on them.)

**Gate set, every command run in `<scratch>/fixclone`** — the npm-10.9.0-installed tree, so these are
numbers a CI runner would see:

| Gate | Result |
|---|---|
| `npx jest` | exit **0** — 105 suites / 1705 tests passed |
| `npx jest --coverage` | exit **0** — `All files 98.58 %` stmts / 92.58 % branch / 98.81 % funcs / 99.18 % lines |
| `npx tsc -p tsconfig.build.json --noEmit` | exit **0** |
| `npx tsc --noEmit -p tsconfig.json` | exit **0** — no output at all; `bug-026` is closed (`task-076`) and nothing replaced it |
| `npm run lint` | exit **0** (`lint.clean`) |
| `npm run docs:api` | exit **0** (`docs.api.*`) |

**Coverage is non-regressing, measured rather than argued.** The identical command was run on a clean
`npm ci` clone of `main` at `0cf643f`: `All files 98.58 | 92.58 | 98.81 | 99.18`, 104 suites / 1697
tests. The branch reports the same four numbers to the hundredth, which is what `src/` being
byte-identical predicts — and the new test imports nothing from `src/` (`grep -n "src"
test/cli/lockfile-peer-overrides.test.ts` → no match), so it cannot move them.

**The test-count delta is +8, and all eight are accounted for**: the new file contributes 7 cases, and
`test/core/latency-budget-placement.test.ts` generates one case **per test source file** via
`it.each(SCANNED_FILES)`, so a new file under `test/` adds exactly one more. 1697 + 7 + 1 = 1705. Suites
104 → 105.

**AC6 — nothing added here keys on npm's output**, checked rather than asserted:

```
$ grep -rn "npm error\|EUSAGE\|Missing:" test/ src/ scripts/ .github/
(no output — no match anywhere in the repository, the new test file included)
```

The test reads `package.json` and `package-lock.json` and never invokes npm at all, so there is no
output for it to key on. `.github/` is untouched by this branch, so the gate's own steps are unchanged:
the workflow still runs `npm ci` and still fails on its exit code alone (`dl-069` S1).

### dl-075 fix-on-touch — citations converted, meaning unchanged

`dl-075-no-bare-line-offsets-in-memory` is `ready` (approved at `0cf643f`, this branch's base) and its
disposition is *fix on touch*. Both documents this task edits carried bare `path:line` offsets in
**durable** positions, so they were converted in the same change. Nothing else in the sentences moved,
and no code block was touched — a recorded command's output is an honest record of what was read, which
`dl-075` keeps legal:

| Document | Position | Was | Now |
|---|---|---|---|
| this task, AC4 | acceptance criterion | "today it lists only `@emnapi/wasi-threads`, at `:565`" | "at `main` `0cf643f` that grep returns a single line, for `"node_modules/@emnapi/wasi-threads"`" |
| this task, "Must be re-verified" item 2 | instruction | "still pins `NODE_VERSION: '22.12.0'` (today `:106`, consumed at `:119`, `:151`, `:169`)" | the YAML key path `env.NODE_VERSION` plus the three `node-version: ${{ env.NODE_VERSION }}` uses |
| `bug-056`, Expected Behavior | durable claim | "`publish.yml:98-99` make `npm ci` the gate's first step" | the `gate` job's step **named `Install`**, whose `run:` is `npm ci` |
| `bug-056`, Actual Behavior (prose) | durable claim | "`publish.yml:106` declares `NODE_VERSION`… (`:119`, `:151`, `:169`)" | the `env.NODE_VERSION` key and the three `setup-node` `node-version:` uses, with the commit they were read at |

The AC4 edit is a citation change only: the criterion still demands hoisted entries for both peers, and
the parenthesis still records that exactly one hoisted `@emnapi` entry existed before the fix. Flagged
here rather than left silent because editing a task's own acceptance criteria mid-flight deserves to be
visible to the reviewer.
