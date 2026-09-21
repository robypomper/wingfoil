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
