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
   hoisted entries for **both** `@emnapi/core` and `@emnapi/runtime` (today it lists only
   `@emnapi/wasi-threads`, at `:565`).
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
2. That `.github/workflows/publish.yml` still pins `NODE_VERSION: '22.12.0'` (today `:106`, consumed at
   `:119`, `:151`, `:169`).
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
