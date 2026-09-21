---
id: "task-074-fix-engines-node-floor"
type: task
title: "Fix bug-023: reconcile the published `engines.node` floor with what the dependency tree actually accepts"
status: in-review
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "distribution", "packaging"]
ref: "REQ-SYS-09"
bug: ["bug-023-engines-node-floor-contradicts-commander"]
depends_on: ["task-059-publish-metadata"]
tmpl_version: 260703
---

## Description

Fix **bug-023**: `package.json` declares `"engines": {"node": ">=18.0.0"}` while the installed
`commander` requires `>=22.12.0` — the package advertises support for a Node floor its own dependency
tree does not accept. On Node 18 npm emits `EBADENGINE`, and with `engine-strict=true` the install hard
fails. This is a **published-contract defect**: it must land before `task-060`/`task-061` publish for
real.

Verified on `main` at `91258a7` (2026-09-21), reading the installed tree rather than the report:
`package.json` line 16 `"node": ">=18.0.0"`; `node_modules/commander/package.json` → version
`15.0.0`, `engines` `{"node":">=22.12.0"}`.

**The task's own work is deciding the real floor and then making every claim agree** — bug-023's fix
shape is "decide the real floor (raise ours, or pin an older commander), correct `package.json` and
`spec-015` §1 together, and pin it with an assertion". The declared floor also appears in product-level
documents, and those are not a task's to change unilaterally (see AC2).

## Acceptance Criteria

1. **The floor is decided and stated.** Either raise `engines.node` to what the tree accepts, or pin a
   commander that accepts the current floor. Whichever is chosen, say why — including whether runtime
   actually survives on Node 18, which bug-023 says it may ("commander's only notable builtin use is
   `stripVTControlCharacters` from `node:util`, Node ≥16.11, plus optional chaining") while insisting
   that "guessing that it works is not a contract".
2. **Every claim of the floor is checked individually, and the task says which actually disagree.** The
   survey below was run for this task on `main` at `91258a7`; **re-run each check at execution time**
   and correct the table rather than copying it.

   | Claim | Where | Observed | Disagrees? |
   |---|---|---|---|
   | `engines.node` | `package.json:16` | `">=18.0.0"` | **yes** — the defect itself |
   | CI Node version | `.github/workflows/publish.yml:78` `NODE_VERSION: '22.12.0'`, used at `:91`, `:123`, `:141` | pinned 22.12.0, and the comment at `:45` already reads "the lowest version every dependency accepts" | **no** — CI is already correct, and it is a single pinned version, not a matrix |
   | `spec-015-packaging-publishing` | `:60`, under "Unchanged" | `engines: node >=18` | **yes** — an `approved` spec ratifies the wrong floor and must move with the fix |
   | `adr-009-npm-publishing-pipeline` | whole document | `grep -n -i "node\b"` → no output; it states no Node floor (`sard_ref: REQ-SYS-09`) | **no** — nothing to change |
   | `README.md` | `:115` "This installs the `wingfoil` binary (Node.js 18+ required)" | 18+ | **yes** — but `README.md` is owned by the `user-docs` release gate (`dl-013`); decide whether to correct it here or hand it to that gate, and say which |
   | `dna.yaml` | `docs/self/.wingfoil/dna.yaml:73-75`, `stacks.technologies` → `Node.js`, `version: "18+"` | 18+ | **yes** — not named in bug-023's list; surfaced by this survey |
   | Product brief | `docs/01_vision/01_product-brief.md:267` "Node.js 18+ (npm)" | 18+ | **yes** — and it is a **vision** document. Per CLAUDE.md §10.1 the specs win over config, and changing the product's declared runtime floor is an approver/spec-level decision, not a task edit. **Stop and report** rather than editing the vision package unilaterally |
   | `CLAUDE.md` | `:18`, `:92` "Node.js 18+" | 18+ | **yes** — no workflow gate owns `CLAUDE.md` (`dl-025`, `in-discussion`); note it, do not silently absorb it |

3. **The regression guard exists.** An assertion in `test/cli/publish-metadata.test.ts` that **every**
   dependency's `engines.node` range is satisfied by ours, so the next dependency bump cannot
   reintroduce the contradiction silently. bug-023 records that today that file makes no `engines`
   assertion at all — re-verify that before writing, and classify the new test honestly (`dl-014`/T1:
   it goes red on the current `>=18.0.0`, so it is genuinely red-first).
4. **`spec-015` §1 moves with `package.json`, in the same change.** The spec is `approved`, so amend it
   as a dated Revision note (`dl-047`: tech-specs carry no `version:` field), citing this task and
   `bug-023`. A `package.json` corrected while the spec still ratifies `>=18` is the same defect one
   document further out.
5. **No new instance of the `bug-022` race.** `test/cli/npm-distribution.test.ts` packs *without*
   `--ignore-scripts` (`bug-022`); anything this task adds that packs must use `--ignore-scripts`, like
   its sibling in `publish-metadata.test.ts`. Fixing `bug-022` is not in scope.
6. **Gates green:** full Jest suite, coverage >80% and non-regressing, `tsc -p tsconfig.build.json`,
   `npm run docs:api`, `npm run lint`.

## Implementation Notes

Source: `bug-023` (`triaged`, severity `medium`, no `feature:`). **Its `release:` was `v0.3` and moves to
`v0.2` in the scheduling commit that accompanies this task** — the approver's decision on 2026-09-21,
reversing the "Scheduled v0.3 by the approver" note in the bug's own Notes section. That note and the
Triage line `release: v0.3 per the approver's scheduling decision` are now historical; the frontmatter
is authoritative. The reason for the move is the one bug-023 itself gives for the deadline: "it must
land before `task-060` / `task-061` publish for real", and those are v0.2 tasks.

- **Traceability:** REQ-SYS-09 — "`npm install -g wingfoil` makes the `wingfoil` command available on
  PATH" — which is exactly what `EBADENGINE` / `engine-strict` breaks. `adr-009` cites the same
  requirement.
- **Nobody owns it today** (bug-023): `task-059-publish-metadata` is `done` and its acceptance criteria
  never validated `engines` against the dependency tree; `task-060`'s Verdaccio staging smoke runs
  `npm install -g wingfoil` on CI's Node (≥22), so it cannot catch this. That is why AC3 is a guard and
  not just a value change.
- **`depends_on: ["task-059-publish-metadata"]` (`dl-015`)** — it shipped the publish metadata surface
  and owns `test/cli/publish-metadata.test.ts`, the file AC3 edits; its Execution Notes cover that
  suite's exhaustive-allowlist design and the `--ignore-scripts` convention AC5 relies on. Read them at
  design, per `dl-015`.
- **Interaction with `task-073-fix-stale-package-lock`:** that task refreshes `package-lock.json` in the
  same release. If this task pins a different commander, the two touch related artefacts — sequence them
  rather than running them blind against each other, and say in the notes which landed first.
- `dl-045` back-reference recorded before the task starts, so `bug.sync_state` can drive `bug-023`.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### `design` — role: architect

Branch `task/task-074-fix-engines-node-floor`, worktree
`/home/robypomper/Workspaces/.wf2-wt/task-074-fix-engines-node-floor`, cut from `main` at `8f2bce8`.
Task `in-progress` from `start` (`599e4ac`); `bug-023` synced `planned → in-progress` (`230b7d2`).

**Environment deviation — `node_modules` is a symlink, not an `npm ci` install.** `npm ci` is broken
repo-wide (`bug-043-npm-ci-fails-on-stale-package-lock`, being fixed in parallel by `task-073`), so
per the orchestrator's instruction this worktree's `node_modules` is a symlink to
`/home/robypomper/Workspaces/WingFoil2/node_modules`:

```
$ ln -s /home/robypomper/Workspaces/WingFoil2/node_modules \
        /home/robypomper/Workspaces/.wf2-wt/task-074-fix-engines-node-floor/node_modules
```

This matters for this task specifically, because the whole task reads the **installed tree**. Two
consequences, both accepted deliberately: (a) the tree observed here is the one `main` resolves today,
not one re-resolved from `package-lock.json`; (b) `package-lock.json` is **not touched** by this task —
`task-073` owns it. Relevant fs calls (`existsSync`/`readFileSync`) follow symlinks, so the guard added
by AC3 reads the same tree either way.

**`agent.read_related` (`dl-015`, HARD gate) — `depends_on: ["task-059-publish-metadata"]`,
acknowledged.** Read `docs/self/docs/04_memory/v0.2/task-059-publish-metadata.md` §Execution Notes in
full. What this task takes from it:

- **It owns `test/cli/publish-metadata.test.ts`, the file AC3 edits**, and states that file's design
  contract in its module doc: *metadata only* — no script, no workflow file, no credential is asserted
  there (§2–§5 of `spec-015` belong to `task-060`/`task-061`). `engines` is a `package.json` *metadata*
  field, so AC3's guard sits inside that boundary; it asserts nothing about the pipeline.
- **The exhaustive-allowlist design**: the file tightened `npm-distribution.test.ts`'s inclusion checks
  into an allowlist so "a tarball that also ships something it should not" fails. AC3's guard is the
  same shape one field over — an *exhaustive* sweep of the dependency closure rather than a spot check
  on `commander` — chosen for the same reason: a spot check on commander would pass the day someone
  adds a different dependency with a higher floor.
- **The `--ignore-scripts` convention (AC5)**: `packedPaths()` runs
  `npm pack --dry-run --json --ignore-scripts`, memoized, because jest's `globalSetup` has already
  built `dist/`. **This task adds nothing that packs**, so AC5 is satisfied by construction rather than
  by a new flag — the guard reads `package.json` and `node_modules/**/package.json` only, spawning no
  subprocess at all. `bug-022` is untouched.
- **Why nobody caught this**: task-059's own T1 table lists four ACs (attribution fields,
  `publishConfig`, `files` review, pack manifest). `engines` appears in `spec-015` §1 only under
  *Unchanged*, so it was never in that task's scope — which is exactly `bug-023`'s "nobody owns it
  today", confirmed by reading rather than assumed.
- Its precedent for the boundary this task hits: task-059 declined to fix `bin.wingfoil`'s `./` prefix
  **because `spec-015` listed it under "Unchanged"**, and routed it to the approver (later `bug-020`,
  then an in-place spec amendment). `engines: node >=18` is listed in the *same sentence* of the same
  "Unchanged" line. The difference is that AC4 of this task explicitly authorizes the spec amendment,
  so the spec moves with the code here instead of being deferred.

**`agent.verify_specs` — no new `tech-spec` needed; `design` is a pass-through (no approver gate).**
`spec-015` §1 already governs the `package.json` publish surface including `engines`, and AC4 directs
this task to amend it in place as a dated Revision note (`dl-047`: tech-specs carry no `version:`
field) rather than supersede it. `adr-009` is `accepted` and states no Node floor (verified below).
`REQ-SYS-09` is the traceability anchor. No `memory.add(type: tech-spec)` invoked.

**However, `verify_specs` did surface an authority conflict the task's own survey missed — see
"AC2 — survey re-run" row `adr-005`.** That is reported to the approver, not resolved here.

#### AC2 — survey re-run (this worktree, `8f2bce8`, 2026-09-21)

Every row re-checked by running the command in the *Observed* column; rows the task's table did not
contain are marked **NEW**.

| Claim | Where | Command run | Observed | Disagrees? |
|---|---|---|---|---|
| `engines.node` | `package.json:16` | `sed -n '15,17p' package.json` | `">=18.0.0"` | **yes** — the defect |
| commander's own floor | `node_modules/commander/package.json` | `node -e "…require('./node_modules/commander/package.json')…"` | `15.0.0`, `engines.node = ">=22.12.0"` | — (the constraint) |
| **Whole production closure** **NEW** | 109 packages reachable from `dependencies` | tree walk, see "The floor, computed" below | max floor `>=22.12.0` (commander); next highest `>=18.14.1` (`@hono/node-server`) | — commander is the **single** binding constraint |
| CI Node version | `.github/workflows/publish.yml:78` `NODE_VERSION: '22.12.0'` (used `:91`, `:123`, `:141`) | `grep -rn "node-version\|NODE_VERSION" .github/workflows/` | one pinned version, no matrix; only one workflow file exists | **no** for the value — but its **comment** at `:45-48` asserts "`package.json` still declares `engines.node >=18.0.0` … which is currently false: bug-023". That sentence becomes false the moment this task lands ⇒ **comment must move with the fix** |
| `spec-015-packaging-publishing` | `:60`, "Unchanged" | `grep -n -i node …spec-015…` | `engines: node >=18` — **the only `node` mention in the file** | **yes** — AC4 |
| `adr-009-npm-publishing-pipeline` | whole doc | `grep -n -i "node" …adr-009…` → `rc=1`, no output | states no Node floor | **no** — confirmed, nothing to change |
| `README.md` | `:115` | `grep -n -i node README.md` | `This installs the \`wingfoil\` binary (Node.js 18+ required).` — the file's only `node` mention | **yes** — handed to the `user-docs` gate (`dl-013`), see below |
| `dna.yaml` | `:73-75` `stacks.technologies` → `Node.js` | `sed -n '68,80p' …dna.yaml` | `version: "18+"` | **yes** — but it is *config tracing to `adr-005`* (below), so it moves when the ADR does, not before |
| Product brief (**vision**) | `docs/01_vision/01_product-brief.md:267` | `grep -n Node …01_product-brief.md` | `**Language & Runtime:** TypeScript, Node.js 18+ (npm)` | **yes** — **not edited.** Vision is authoritative over config (CLAUDE.md §10.1); an approver/spec-level decision |
| `CLAUDE.md` | `:18`, `:92` | `grep -n Node CLAUDE.md` | `Node.js 18+` twice | **yes** — **not edited** (`dl-025`: no workflow gate owns `CLAUDE.md`; `bug-008`) |
| **`adr-005-typescript-node-stack`** **NEW** | title, `:25`, `:45`, `:56` | repo-wide `grep -rn -E "Node\.?js ?1[68]\+\|\"node\": *\">=18"` | `status: accepted` — its **title** is "TypeScript on Node.js 18+, distributed via npm"; `:45` "Requires contributors and CI to standardize on Node.js 18+ as a baseline" | **yes — and this is the root authority.** The brief, `dna.yaml`, `dl-001` and `CLAUDE.md` all restate *this* ADR. **Not edited** — see "Boundary" |
| **`dl-001-typescript-over-python`** **NEW** | `:19`, `:35` | same sweep | `ready` — "Adopt TypeScript with **Node.js 18+** runtime", "recorded in `dna.yaml`" | **yes** — moves with `adr-005`. **Not edited** |
| `@types/node` pin **NEW** | `package.json` devDeps, `18.19.130` | `node -e` engines sweep | pinned `^18` deliberately (task-001 notes: "matching the `engines.node >=18.0.0` floor") | **yes, indirectly** — a devDependency; moving it needs `package-lock.json`, owned by `task-073`. **Not touched**; reported |

Net correction to the task's own table: it had **7** rows and missed the three that matter most —
`adr-005` (the accepted ADR the other four documents derive from), `dl-001`, and the `publish.yml`
*comment* (it checked the value, not the prose). It was right that `adr-009` states no floor and that
CI pins a single version.

#### The floor, computed (not assumed)

Walked the **production** closure only — `dependencies`, transitively, resolved node-style through the
installed tree. That is the correct scope: `files: ["dist", "README.md"]` means a consumer of
`wingfoil` installs `dependencies` and nothing else, so `engines` advertises a contract about *that*
closure. 109 packages; 81 declare an `engines.node`; the binding maximum is:

```
commander            15.0.0   >=22.12.0     <-- binding
@hono/node-server    1.19.14  >=18.14.1
@modelcontextprotocol/sdk 1.29.0 >=18
express / send / router / type-is / …       >= 18
everything else                             <= 18
```

So **the only floor that is true of the tree as it stands is `>=22.12.0`.**

#### AC1 — the decision, and what it costs

Two coherent resolutions; the bug names both.

**Option B — pin commander below 15 (keeping the declared 18+ true).** Rejected, on three independent
grounds, each checked here:

1. It requires regenerating `package-lock.json`, which this task is explicitly forbidden to touch
   (`bug-043` / `task-073` own it, in parallel, this release).
2. It reverses work that landed *in this release*. `commander@15` is ESM-only
   (`node -p "require('…/commander/package.json').type"` → `module`; single `default` export
   condition), and `task-065-fix-commander-esm-jest-harness` (`bug-007`) rebuilt the entire Jest/TS
   harness around exactly that — `jest.config.js`'s `transformIgnorePatterns: ['/node_modules/(?!commander/)']`
   plus `tsconfig.test.json`. `src/cli/program.ts:14`'s module doc names *"downgrading `commander`"* as
   the alternative it deliberately rejected.
3. Nothing documents commander@15 as accidental, so "pin it lower" is not restoring an intent — it is
   a new dependency decision, which is ADR territory, not a fix task's.

**Option A — raise `engines.node` to `>=22.12.0`. CHOSEN.** It is the only value provably true of the
installed tree (above), it is the value CI already runs, and `publish.yml:45`'s own comment already
calls `22.12.0` "the lowest version every dependency accepts".

*Does runtime actually survive on Node 18?* bug-023 says it may, and the evidence points that way but
does not settle it: commander's only builtin imports are `node:events`, `node:child_process`,
`node:path`, `node:fs`, `node:process` and `stripVTControlCharacters` from `node:util` (Node ≥16.11) —
`grep -rn "from 'node:" node_modules/commander/lib/*.js` — and a scan for post-18 APIs
(`styleText`, `Object.groupBy`, `Promise.withResolvers`, `util.parseArgs`, `process.getBuiltinModule`, …)
returns **nothing**. The published CLI loads it through a preserved dynamic `import()` from CJS
(`src/cli/program.ts:68`), supported since Node 12.17. **But no Node 18 runtime exists in this
environment** (`node -v` → `v22.21.0`, no nvm), so this was *not* executed, and per bug-023 "guessing
that it works is not a contract". The declared floor must be the one we can prove, which is 22.12.0.

*What raising it costs users — measured, REQ-SYS-09 Fit Criterion.* REQ-SYS-09's criterion is that
`npm install -g wingfoil` puts `wingfoil` on PATH. Probed offline with a throwaway package declaring an
unsatisfiable `engines.node` (`>=99.0.0`) on `node v22.21.0` / `npm 11.6.2`, installed from a local
tarball into a throwaway prefix:

```
$ npm install -g --prefix …/prefix --offline …/engtest-demo-1.0.0.tgz
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'engtest-demo@1.0.0',
npm warn EBADENGINE   required: { node: '>=99.0.0' },
npm warn EBADENGINE   current: { node: 'v22.21.0', npm: '11.6.2' } }
added 1 package in 860ms                          EXIT=0
$ …/prefix/bin/engtest-demo   ->  hello            # binary installed and runs

$ npm install -g --engine-strict --prefix …/prefix2 --offline …/engtest-demo-1.0.0.tgz
npm error code EBADENGINE … Required: {"node":">=99.0.0"}   EXIT=1
$ ls …/prefix2/bin  ->  No such file or directory   # nothing installed
```

So raising the floor **does not lock anyone out by default**: npm warns and installs anyway, and the
binary still lands on PATH. It hard-fails only under `engine-strict=true`, which is opt-in and is the
correct outcome for a runtime we do not test. The cost of raising is therefore a warning for Node
18/20 users; the cost of *not* raising is that the package makes a claim it cannot honour — and that
under `engine-strict` the current declaration is the one that mis-sorts (it lets a Node-18 install
through silently). Node 18 reached end-of-life 2025-04-30 and Node 20 on 2026-04-30 (public Node.js
release schedule; **not verifiable offline from this worktree** — flagged as such rather than asserted
as measured), so as of 2026-09-21 a `>=22.12.0` floor excludes only already-unsupported runtimes.

#### Boundary — what this task does NOT change, and why

`adr-005-typescript-node-stack` is `accepted` and its **title** is the 18+ claim. The product brief
(`docs/01_vision/`), `dna.yaml:73-75`, `dl-001` and `CLAUDE.md` are all restatements of it. Per
CLAUDE.md §10.1 the vision wins over config, and a fix task cannot supersede an accepted ADR. So:

- **Changed here** (the implementation contract, which is what `bug-023` is about): `package.json`
  `engines.node`, `spec-015` §1 (AC4 authorizes it), the now-stale `publish.yml` comment, and the AC3
  guard.
- **Reported, not changed**: `docs/01_vision/01_product-brief.md:267`, `adr-005`, `dl-001`,
  `dna.yaml:73-75`, `CLAUDE.md:18/:92`, `README.md:115`, `@types/node`'s `^18` pin.
- `README.md:115` specifically: **handed to the `user-docs` release gate (`dl-013`)**, which owns that
  file, rather than corrected here — and it should be corrected *after* the approver settles the
  product-level floor, because the README states the **product's** floor, not `package.json`'s. It is
  wrong today either way (it promises Node 18 for a package that cannot run there), so this task makes
  it no more wrong; it makes the contradiction visible instead of hidden.

This leaves the repository in a knowingly-split state for as long as the approver takes: `package.json`
will say `>=22.12.0` while the vision says `18+`. That is deliberate and is the lesser of the two — the
alternative is shipping a manifest that is false to npm itself.

#### T1 — acceptance-criteria classification (`dl-014`, `testing` directive)

| # | Acceptance criterion | Classification | Justification |
|---|---|---|---|
| AC1 | the floor is decided and stated | **red-first** (carried by AC3's assertion) | the decision's *executable* form is the guard; `package.json` on `main` declares `>=18.0.0`, which the guard rejects. Not a separate test |
| AC2 | every claim of the floor checked individually, table corrected | **characterization — documentation only, no test** | it is a survey of documents. Pinning it with a test would mean asserting the content of `README.md`/`CLAUDE.md`/the vision, which this task is explicitly forbidden to own. Evidence is the commands above; no test is written, and none is fabricated to look like one |
| AC3 | regression guard: every dependency's `engines.node` satisfied by ours | **red-first** | verified first that the file makes no such assertion today: `grep -n "engines" test/cli/publish-metadata.test.ts` → **`rc=1`, no output**. The new test fails on `main`'s `>=18.0.0` for a genuine reason (commander requires `>=22.12.0`) |
| AC4 | `spec-015` §1 moves with `package.json` | **characterization — documentation only** | a Memory/spec edit; the repo has no test asserting spec prose, and inventing one here would be dead weight |
| AC5 | no new instance of the `bug-022` race | **characterization (by construction)** | the guard spawns **no** subprocess — it reads `package.json` and `node_modules/**/package.json`. Verified by the absence of `execFileSync` in the added block; the file's existing `packedPaths()` already passes `--ignore-scripts` and is untouched |
| AC6 | gates green | **characterization** | the standing `dev-loop` `refactor` gates |

One genuinely red-first criterion (AC3, carrying AC1). No red is fabricated for AC2/AC4/AC5/AC6.

**BDD coverage.** `grep -rln "engines\|Node.js 18\|npm install -g" docs/02_requirements/02_bdd/features/`
finds no scenario about the engines floor — the acceptance contract here is REQ-SYS-09
(`docs/02_requirements/03_sard/01_architecture.md`), whose fit criterion is the `npm install -g` probe
recorded above, not a `.feature` scenario. Stated rather than left implicit, per rule 1.

**No `semver` dependency is added.** The guard needs range arithmetic, and `require('semver')` in this
tree resolves to **6.3.1** (`typeof semver.subset` → `undefined`; `subset` arrived in 7.x). semver 7 is
present only nested under devDependencies (`node_modules/ts-jest/node_modules/semver` etc.), which is a
hoisting accident, not a contract. Declaring `semver` would require a `package-lock.json` change —
forbidden here. So the guard carries a small, explicit range evaluator that **throws on any syntax it
does not understand**, and that evaluator has its own unit tests in the same file. Loud over clever:
a future dependency using a range form the evaluator cannot read fails the suite instead of being
silently skipped.

### `red` — role: developer

Added the AC3 guard to `test/cli/publish-metadata.test.ts` (task-059's file, per its "metadata only"
boundary — see `design`). Nothing else changed; `package.json` still declares `>=18.0.0`.

```
$ npx jest test/cli/publish-metadata.test.ts
● publish surface (task-074) — `engines.node` vs the production dependency closure
  › declares a floor every production dependency accepts (bug-023, REQ-SYS-09)

  - Array []
  + Array [
  +   "@hono/node-server@1.19.14 requires node >=18.14.1",
  +   "commander@15.0.0 requires node >=22.12.0",
  + ]

Tests: 1 failed, 46 passed, 47 total
```

Red for the stated reason: the declared floor is below what an installed production dependency
accepts. The other 46 (task-059's 9, plus this task's 2 non-failing guard cases and 35 evaluator unit
cases) pass, so the red is isolated to the criterion.

**Finding the bug did not record: `commander` is not the only offender.** `@hono/node-server@1.19.14`
(transitive, via `@modelcontextprotocol/sdk`) requires `>=18.14.1`, which `>=18.0.0` also fails.
`bug-023` and the task both frame this as a commander-vs-18 problem; in fact the declared floor was
false by **two** independent packages, and would have stayed false by `@hono/node-server` even if
commander had been pinned back. This strengthens the AC1 decision rather than changing it, and it is
the concrete case for AC3's "computed, not hard-coded" shape: a guard written as "assert commander is
satisfied" would have shipped still-broken.

**Guard design, and what was deliberately *not* done.**

- **Production closure only** (`dependencies`, transitively — 109 packages, 81 with an
  `engines.node`). `files: ["dist", "README.md"]` means that is exactly what a consumer installs, so
  it is what `engines` makes a promise about. Verified that including devDependencies would be wrong
  *and* immediately red for a reason this task cannot fix: `eslint@10.6.0` / `@eslint/js@10.0.1`
  declare `^20.19.0 || ^22.13.0 || >=24`, which `22.12.0` does **not** satisfy — reported as a
  proposed element rather than absorbed here.
- **No `semver` dependency added** (see `design`). The evaluator throws on unknown syntax and carries
  35 unit cases of its own, including five "must throw" cases, so it cannot pass a range by failing to
  understand it.
- **A vacuity guard**: `really walks the tree — the guard cannot pass by finding nothing` asserts the
  closure actually contains `commander` and more than ten `engines`-declaring packages. A "no
  violations" assertion alone is green when the walk is broken, which is the one way this guard could
  rot silently.
- **No subprocess** (AC5): the guard reads `package.json` and each installed package's own
  `package.json`. `packedPaths()` — the only thing in the file that packs, and it already passes
  `--ignore-scripts` — is untouched. `bug-022` gains no new instance.

### `green` — role: developer

`package.json:16` `">=18.0.0"` → `">=22.12.0"` — one field, nothing else. `package-lock.json` is
**not** touched (it carries its own copy of the root `engines` at `:35`; refreshing it belongs to
`task-073-fix-stale-package-lock` / `bug-043`, and the two must not race — see "Sequencing" below).

```
$ npx jest test/cli/publish-metadata.test.ts
Test Suites: 1 passed, 1 total
Tests:       47 passed, 47 total
```

### `refactor` — role: developer

Two documentation surfaces moved with the code, so the manifest is not corrected while its governing
prose still ratifies the old value.

1. **`spec-015` §1 (AC4).** `engines: node >=18` removed from the *Unchanged* sentence and replaced by
   a dedicated `engines.node` bullet stating the value **and the rule that derives it** ("the highest
   `engines.node` floor in the production dependency closure"), plus a dated **Revision (2026-09-21)**
   note at the end of `## Process Notes` — the file's established amendment pattern (the `bin.wingfoil`
   bullet above it was amended the same way after `task-059`). No `version:` bump: tech-specs carry no
   `version:` field (`dl-047`), and the state stays `approved` — an in-place amendment, not a
   supersede, per the `dl-041` precedent the spec itself cites. Both the bullet and the Revision note
   say explicitly that the **product-level** floor is not settled here.
2. **`.github/workflows/publish.yml:45-48` comment.** It asserted "`package.json` still declares
   `engines.node >=18.0.0` … which is currently false: bug-023" — true when written, false the moment
   this task lands, and leaving it would be the same class of defect this task exists to close. The
   comment is now accurate, names `@hono/node-server` as the second constraint, and records the
   devDependency gap below. **Comment only** — `NODE_VERSION` and every step are unchanged, so nothing
   `task-060` owns moves.

**One thing deliberately left wrong, and reported instead.** The same comment used to claim `22.12.0`
is "the lowest version every dependency accepts". That is false for **devDependencies**: `eslint@10.6.0`
and `@eslint/js@10.0.1` declare `^20.19.0 || ^22.13.0 || >=24`, which `22.12.0` does not satisfy, so
`npm ci` on CI emits `EBADENGINE` for them today. Raising `NODE_VERSION` is a change to the publish
pipeline (`task-060`'s ground) and needs a lockfile-aware decision, so the comment now records the gap
and the defect is proposed as its own element rather than fixed here.

**Gates** (run in this worktree, after `git merge main`):

| Command | Result |
|---|---|
| `npx jest` | **exit 0** — 100 suites / 1591 tests passed |
| `npx jest --coverage` | **exit 0** — statements **98.54**, branches **92.30**, functions **98.76**, lines **99.15**; threshold 80 met on all four |
| `npx tsc -p tsconfig.build.json --noEmit` | **exit 0** |
| `npx tsc --noEmit -p tsconfig.json` | exit 2, **only** the pre-existing `bug-026` error: `test/core/directive-create.test.ts(159,19): error TS2339` — untouched |
| `npm run lint` | **exit 0** |
| `npm run docs:api` | **exit 0** |

Coverage is **non-regressing by construction, not just by measurement**: `jest.config.js`
`collectCoverageFrom: ['src/**/*.ts', '!src/**/index.ts']`, and this task changes **no file under
`src/`** — the diff is `package.json`, `test/`, `.github/`, and Memory documents. The numbers above
are the measured confirmation.

**Sequencing against `task-073-fix-stale-package-lock`** (the task file asks for this explicitly).
`task-073` regenerates `package-lock.json`; this task edits `package.json`'s `engines` block, which
the lockfile mirrors at `:35` (`"node": ">=18.0.0"`). They do not conflict textually — different
files — but a lockfile regenerated from the *old* `package.json` would re-pin the stale floor. **This
task landed its `package.json` change first within its own branch; whichever merges to `main` second
must be the one that re-runs its own check.** Concretely: if `task-073` merges after this, its
regenerated lock will pick up `>=22.12.0` automatically and nothing is needed; if it merges *before*,
its lock still carries `>=18.0.0` at `:35` and someone must refresh it. Neither task pins a different
`commander`, so no dependency resolution changes either way. Flagged for the orchestrator rather than
resolved here, since this worktree must not touch `package-lock.json`.

### `review-ready summary` — role: reviewer

Merged `main` (`7aeeb91`) into `task/task-074-fix-engines-node-floor` (`dl-035` — merge, never
rebase). The merge brought `spec-004`, two SARD files, `bug-026` (`open → triaged`) and four new task
files (`task-075`..`task-078`); **none of the documents this task cites changed**, verified with
`git diff --name-only 659b42e HEAD | grep -E 'spec-015|dl-047|dl-054|dl-045|dl-015|dl-013|dl-025|bug-022|bug-023|publish.yml|package.json|publish-metadata|adr-005|dl-001|README|dna.yaml|01_product-brief'`
→ `rc=1`, no output. All gates re-run after the merge, same numbers as the table above.

**What landed.** `git diff --stat main HEAD` — six files, no source file among them:

```
.github/workflows/publish.yml                                     |  14 +-   (header comment only)
docs/self/docs/04_memory/bugs/bug-023-…md                         |   2 +-   (status sync)
docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md | 37 +-
docs/self/docs/04_memory/v0.2/task-074-fix-engines-node-floor.md  | 328 +
package.json                                                      |   2 +-   (engines.node)
test/cli/publish-metadata.test.ts                                 | 337 +
```

`git diff --name-only main HEAD | grep -E 'package-lock.json|README.md|CLAUDE.md|01_product-brief|adr-005|dl-001|dna.yaml'`
→ `rc=1`: every out-of-bounds file is genuinely untouched, not just intended to be.

**AC-by-AC.**

| AC | Status | Evidence |
|---|---|---|
| AC1 floor decided and stated | **met** | `>=22.12.0`, argued in `design` against the rejected alternative, with the npm `EBADENGINE` probe transcript for what it costs users |
| AC2 every claim checked, table corrected | **met** | 13-row table in `design`; three rows the task's own survey lacked (`adr-005`, `dl-001`, the `publish.yml` comment), and `adr-009`/CI confirmed as "no change" by running the greps |
| AC3 regression guard exists | **met** | `test/cli/publish-metadata.test.ts`; red-first, verified genuinely absent first (`grep -n "engines" …` → `rc=1`) and shown failing |
| AC4 `spec-015` §1 moves with `package.json` | **met** | same `refactor` commit as the `publish.yml` comment; dated Revision note, no `version:` (dl-047), state stays `approved` |
| AC5 no new `bug-022` race | **met** | the guard spawns no subprocess; `packedPaths()` untouched and still `--ignore-scripts`. Now owned by `task-075`, merged in above |
| AC6 gates green | **met** | table in `refactor`, re-run post-merge |

**BDD (`tests.bdd.run`).** There is no BDD scenario for this criterion, and that is the requirement's
own design, not a gap: `grep -rln "engines\|Node.js 18\|npm install -g" docs/02_requirements/02_bdd/features/`
→ `rc=1`, and `REQ-SYS-09` (`docs/02_requirements/03_sard/01_architecture.md:95-102`) states
"distribution requirement with **no behavioral BDD feature** — verified directly against the
npm-publish acceptance test". `test/cli/publish-metadata.test.ts` **is** that acceptance test, so the
BDD gate is discharged by the suite this task extends. The behavioural suites were re-run whole
(`npx jest`, 100 suites / 1591 tests) rather than spot-checked.

**Weak spots a reviewer should look at.**

1. **The hand-rolled range evaluator** is the largest new surface (no `semver` available; see
   `design`). It has 35 unit cases including five must-throw cases, and it fails closed on unknown
   syntax — but it is still a semver re-implementation, and a reviewer should read it as one. If a
   `semver@^7` devDependency becomes acceptable once `task-073` settles the lockfile, replacing the
   evaluator with `semver.subset` would be a strict simplification.
2. **The guard checks the floor, not the whole range.** It asserts that the single lowest version we
   advertise satisfies every production dependency — which is exactly the `EBADENGINE` semantics — and
   refuses any `engines.node` that is not a plain `>=x.y.z`. A future compound range would have to
   teach the guard first. Deliberate, documented at `parseNodeFloor`, but it is a narrowing.
3. **The repository is now knowingly split** between `package.json` (`>=22.12.0`) and the
   product-level "Node.js 18+" in `adr-005` / the vision / `dna.yaml` / `README.md` / `CLAUDE.md`.
   That split is the approver's to close (see below); until then, anyone reading only the vision gets
   the wrong floor.
4. **Not proven: whether the CLI actually runs on Node 18.** No Node 18 is installed here
   (`node -v` → `v22.21.0`). The static evidence says it probably would; the contract is set to what
   is provable, not to what is likely.

**For the approver — the decision this task could not make.** Raising `engines.node` fixes the
*manifest*. It does not settle what the **product** claims, which is stated in a **vision** document
and an **accepted ADR**:

- `docs/01_vision/01_product-brief.md:267` — "TypeScript, Node.js 18+ (npm)"
- `adr-005-typescript-node-stack` — `accepted`; its **title** is "TypeScript on Node.js 18+";
  `:45` "Requires contributors and CI to standardize on Node.js 18+ as a baseline"
- `dl-001-typescript-over-python:19,:35` — `ready`; the same claim, "recorded in `dna.yaml`"
- `docs/self/.wingfoil/dna.yaml:73-75` — `stacks.technologies` → `Node.js`, `version: "18+"`
- `README.md:115`, `CLAUDE.md:18/:92` — restatements

Per CLAUDE.md §10.1 vision wins over config, and a fix task cannot supersede an accepted ADR, so all
six are left untouched. Closing the split needs an ADR superseding `adr-005`'s runtime clause (or an
explicit decision that 18+ was always an aspiration and the manifest is the contract), then the vision
edit, then `dna.yaml`, then `README.md` through the `user-docs` gate (`dl-013`), then `CLAUDE.md`
(`dl-025`/`bug-008`). Proposed as elements in the handover rather than filed here — parallel worktrees
must not mint ids.

**Handover to `task-077-first-real-staging-run`.** Its AC7 lists `bug-023` among the things the v0.2
`release-publishing` phase is waiting on, citing `publish.yml:45-48`. Those lines now say the opposite
(the floor is reconciled and guarded), so `task-077` should re-read them rather than copy its own
planning-time list — which is what its AC7 already instructs.
