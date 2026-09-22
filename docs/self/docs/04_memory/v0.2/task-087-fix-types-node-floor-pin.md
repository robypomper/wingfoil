---
id: "task-087-fix-types-node-floor-pin"
type: task
title: "Raise `@types/node` to the Node floor adr-010 declared, so `src/` is typechecked against the runtime the package promises"
status: in-review
release: "v0.2"
priority: "medium"
tags: ["v0.2", "build", "distribution"]
ref: "bug-049-types-node-pinned-to-superseded-floor"
bug: ["bug-049-types-node-pinned-to-superseded-floor"]
depends_on: ["task-074-fix-engines-node-floor"]
tmpl_version: 260703
---

## Description

`@types/node` is pinned `^18.19.130` — not incidentally, but as a decision recorded in `task-001`'s
Execution Notes to match the then-current `engines.node >=18.0.0`. `adr-010-node-22-runtime-floor`
raised the declared floor to `>=22.12.0` **in this release**, so the pin no longer tracks the contract
it was set to track: `src/` is typechecked against a Node 18 API surface while the package promises
Node 22.12+. The compiler can therefore reject APIs that are available on the supported runtime, and
cannot warn about ones that are not.

v0.2 is the release that declares the new floor. Shipping it with the types pinned to the superseded
one leaves the build contract internally inconsistent in the very release that changed it.

## Acceptance Criteria

- **AC1** — `@types/node` tracks the floor `engines.node` declares. State the resolved version and the
  command that shows `engines.node` and the installed `@types/node` agreeing, rather than asserting it.
- **AC2** — The change is justified from the floor, not from "latest": say which major matches
  `>=22.12.0` and why, and do not silently adopt a newer major than the floor implies.
- **AC3** — Both typechecks stay silent: `npx tsc -p tsconfig.build.json --noEmit` and the full
  `npx tsc --noEmit -p tsconfig.json`. If raising the types surfaces **new** errors, they are real
  findings about code written against the old surface — fix them in this pass if they are small, or
  report them as proposed elements if they are not. Do not suppress them and do not widen the pin to
  make them disappear.
- **AC4** — `npm ci` succeeds under **npm 10.9.x**, the npm the pinned `NODE_VERSION` bundles, not only
  under the developer's npm. `bug-056` exists because that distinction was never made; install npm
  10.9.0 into a scratch prefix and use it explicitly. `task-080`'s hoisted `@emnapi` lock entries must
  survive your change — `test/cli/lockfile-peer-overrides.test.ts` goes red if they do not, and
  `bug-063` records that a plain `npm install` under npm 11.x erases them.
- **AC5** — Check whether `bug-046`, `bug-047` and `bug-048` — the rest of the `adr-010` engines
  cascade — are closed, made moot, or untouched by this change. Record the answer for each with the
  command that settles it. Do **not** fix them here unless a change is a one-line consequence of yours;
  if it is, say so explicitly rather than folding it in silently.
- **AC6** — All six gates green.

## Implementation Notes

- Read `task-074-fix-engines-node-floor`'s Execution Notes first (`dl-015` read_related): it raised
  `engines.node` and is the change that made this pin stale.
- `task-001`'s Execution Notes carry the original decision to pin at 18; the new decision should read
  as a deliberate successor to it, not as a drive-by bump.
- `adr-010` is `accepted`; its cascade already touched CLAUDE.md, the product brief, `dna.yaml` and
  `dl-001`. This is the build-side leaf of that same cascade.
- Classify every AC per `dl-014`/T1. Expect characterization: the existing gates are the assertion,
  and a manufactured failing test for a dependency version would be dead weight — say so plainly
  rather than fabricating a red.

## Execution Notes

<!-- filled in per phase -->

### `design` — role: architect

Branch `task/task-087-fix-types-node-floor-pin`, worktree
`/home/robypomper/Workspaces/.wf2-wt/task-087`, cut from `main` at `710a824`
(`wf(task): approve task-086…, task-087… [pending → backlog]`). Task `backlog → in-progress`
(`1566238`); `bug-049` synced `planned → in-progress` (`986793f`).

**Environment.** Linux, `node v22.21.0`, host `npm 11.6.2`. The npm under test is **not** the host npm
(AC4): npm 10.9.0 was installed into the scratchpad and is invoked by absolute path throughout, written
`<npm109>` below.

```
$ npm install --prefix <scratch>/npm109 npm@10.9.0 --no-audit --no-fund    # exit 0
$ <scratch>/npm109/node_modules/.bin/npm --version
10.9.0
```

`npm ci --prefer-offline --no-audit --no-fund` in this worktree exited 0 before any edit, so every
figure below is taken against a real install, not a symlinked `node_modules`.

#### `agent.read_related` (`dl-015`, HARD gate) — `depends_on: ["task-074-fix-engines-node-floor"]`

`grep -n '^depends_on:' docs/self/docs/04_memory/v0.2/task-087-fix-types-node-floor-pin.md` →
`depends_on: ["task-074-fix-engines-node-floor"]`;
`grep -n '^status:' docs/self/docs/04_memory/v0.2/task-074-fix-engines-node-floor.md` → `status: done`.
Its Execution Notes were read in full. Acknowledged, item by item:

1. **It is the change that made this pin stale, and it said so at the time.** Its `design` AC2 survey
   carries a row for `@types/node` marked *yes, indirectly* — "a devDependency; moving it needs
   `package-lock.json`, owned by `task-073`. **Not touched**; reported" — and its Boundary section
   lists `@types/node`'s `^18` pin under *Reported, not changed*. This task is that reported item being
   executed, not a rediscovery.
2. **The floor it set, and how it was derived.** `engines.node` is `>=22.12.0`, chosen as the maximum
   `engines.node` in the **production** closure (`commander@15.0.0`'s `>=22.12.0`, with
   `@hono/node-server@1.19.14`'s `>=18.14.1` second). Re-read from the file rather than from its notes:
   `node -p "require('./package.json').engines.node"` → `>=22.12.0`. That number, not "latest", is what
   AC2 makes this task derive its pin from.
3. **The lockfile-mirror precedent.** It crossed its own "do not touch the lockfile" boundary for
   exactly one reason: `package-lock.json` carries a second copy of a `package.json` fact
   (`packages[""].engines`), the edit put that copy out of date, and **nothing downstream repairs it**.
   The same shape recurs here one field over — `packages[""].devDependencies["@types/node"]` plus the
   `node_modules/@types/node` entry — so the lock moves inside this task too, for the same stated
   reason rather than by habit.
4. **Its convention that a lock change is reviewable only when it is the whole diff** (inherited from
   `task-073`). Honoured: the lock diff produced here is characterized entry by entry under `green`.
5. **Its `EBADENGINE` measurement is reused, not repeated.** It established that an unsatisfied
   `engines.node` is a warning under a default npm and a hard failure only under `engine-strict=true`.
   That is what makes `bug-048` a warning-severity item in AC5 below; nothing here changes it.

**`task-001-nodejs-typescript-scaffold` (`done`) — the decision this pin succeeds.** Not a
`depends_on`; read because the task's Implementation Notes require the new pin to read as a deliberate
successor. Its Execution Notes state the pin and its reason verbatim:

> **`@types/node` pinned to `^18` (not latest `^2x`)**, matching the `engines.node >=18.0.0` floor,
> so stub/future code doesn't typecheck against Node APIs newer than the minimum supported runtime.

**The rule stated there is "the minimum supported runtime"; `18` is only the number that rule produced
in v0.1.** This task does not overturn `task-001`'s decision — it applies the same rule to the floor
`adr-010` now declares. That is also why the pin moves to `^22` and **not** to the newest `@types/node`:
adopting `^24` or `^26` would be the very thing `task-001` refused ("not latest `^2x`").

#### `agent.verify_specs` — no new `tech-spec`, no spec revision; `design` is a pass-through

- `spec-015-packaging-publishing` governs the **published** `package.json` surface. It says nothing
  about `@types/node` or about `devDependencies` at all:
  `grep -n -i "types/node\|devDependenc\|@types" docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md`
  → `rc=1`, no output. `@types/node` is dev-only and outside the published tarball
  (`files: ["dist", "README.md"]`), so there is no spec prose to move with this change — unlike
  `task-074`, whose `engines` edit sat squarely inside that spec's §1.
- `adr-010-node-22-runtime-floor` is `accepted`
  (`grep -n '^status:' docs/self/docs/04_memory/design/adrs/adr-010-node-22-runtime-floor.md` →
  `status: accepted`), and it already anticipated this task: its Consequences → *Neutral* bullet reads
  "`@types/node` is still pinned `^18.19.130` explicitly to match the *old* floor … Tracked as
  `bug-049`; not resolved here", and its closing paragraph files `bug-049` among the items "**not**
  resolved by it".
- No `memory.add(type: tech-spec)` invoked; no approver gate on `design`.

**One thing deliberately not edited.** That `adr-010` *Neutral* bullet becomes factually stale the
moment this task lands. It is **not** corrected here: `adr-010` is an `accepted` ADR recording the
state of the world at decision time, it names `bug-049` as the tracking element in the same sentence
(so a reader following it arrives at the closure), and no AC of this task authorizes amending it.
`task-074`'s precedent is that a spec moves with the code only when an AC says so (its AC4), while
`adr-005`, `dl-001` and the product brief were reported rather than edited. Recorded here so it reads
as a boundary, not an oversight; carried to the final report.

#### AC2 — which `@types/node` major the floor implies, derived rather than picked

DefinitelyTyped publishes one `@types/node` line per **Node major**, and the major is the only
granularity on offer. Measured against the registry and Node's own release index rather than assumed:

| Question | Command | Answer |
|---|---|---|
| Which majors exist? | `npm view @types/node versions --json` | `18.x` (272 releases, last `18.19.130`), `20.x` (259, last `20.19.43`), `22.x` (160, last **`22.20.4`**), `24.x` (69, last `24.13.6`); newest overall `26.6.2` |
| Does the DT *minor* track the Node minor? | `npm view @types/node time --json` vs `curl -sS https://nodejs.org/dist/index.json` | **No.** `@types/node@22.20.0` was published `2026-06-20`; Node `v22.20.0` was released `2025-09-24` — nine months apart. Node 22 has since reached `v22.23.2` while DT's 22 line stops at `22.20.4` |
| Which major does `>=22.12.0` imply? | the two rows above | **`^22`** — the Node 22 line |

So the pin becomes **`^22.20.4`**: major `22` because that is the major of the declared floor, and
`.20.4` because it is the head of that line at the time of writing — structurally identical to
`task-001`'s `^18.19.130`, which was likewise the head of the major the floor then implied. `^24` and
`^26` resolve perfectly well and are **not** adopted: they describe runtimes above the declared floor,
which is the failure direction `bug-049`'s Notes call the quieter and costlier one.

**The residual, stated rather than hidden.** Because the DT minor is its own counter (row 2), there is
no `@types/node` release that describes Node *22.12.0* specifically. `^22.20.4` therefore describes the
Node 22 line as a whole, including APIs added in 22.13–22.23 that a 22.12.0 runtime lacks. That is
strictly better than the status quo — a three-major gap collapses to a within-major one — but it is not
zero, and no finer instrument exists in the ecosystem. Carried to the final report as a proposed
element rather than silently absorbed.

#### T1 — acceptance-criteria classification (`dl-014`, `testing` directive)

| # | Acceptance criterion | Classification | Justification |
|---|---|---|---|
| AC1 | `@types/node` tracks the floor `engines.node` declares | **red-first** | AC1 asks for "the command that shows `engines.node` and the installed `@types/node` agreeing, rather than asserting it". That command is a test, and on `main` it fails for the real reason this task exists (`22` vs `18`) — see `red`. Not a manufactured red: the invariant is the one whose absence *is* `bug-049`, and nothing asserted it before — `grep -rn "types/node" test/` → `rc=1`, no output, run at `986793f` with the new file stashed |
| AC2 | justified from the floor, not from "latest" | **characterization — documentation only** | it is a derivation, evidenced by the table above. Its *outcome* is pinned executably by AC1's guard, which asserts an equality and so fails on a too-new major as well as a too-old one; the reasoning itself is prose, and inventing a test for prose would be dead weight |
| AC3 | both typechecks stay silent | **characterization** | `tsc` is a standing gate; it passes on `main` and must still pass. Any new error is a finding about code written against the superseded surface, handled under `refactor` |
| AC4 | `npm ci` under npm 10.9.x; `@emnapi` entries survive | **characterization** | `npm ci` exits 0 on `main` under npm 10.9.0 since `task-080` (`bug-056`, `closed`), and `test/cli/lockfile-peer-overrides.test.ts` already asserts the hoisted `@emnapi` entries. The job here is to keep both true across a lockfile rewrite, so the assertion already exists; a second one would duplicate `task-080`'s file |
| AC5 | `bug-046` / `bug-047` / `bug-048` disposition | **characterization — investigation, no test** | a report on three other elements, each settled by a command (see `refactor`). This task is explicitly forbidden to fix them |
| AC6 | all six gates green | **characterization** | the standing `dev-loop` `refactor` gates |

One genuinely red-first criterion (AC1). No red is fabricated for AC2–AC6; in particular **no failing
test is manufactured for the dependency version itself** — the bump's correctness is carried by the
relationship guard and by the existing typecheck and install gates, which is what the task's
Implementation Notes ask for.

**BDD coverage.** There is no `.feature` scenario for this task, checked rather than assumed:
`grep -rln "types/node\|engines\|@types\|Node.js 22" docs/02_requirements/02_bdd/features/` → `rc=1`,
no output. The traceability anchor is `REQ-SYS-09` (distribution as an npm package), whose stated
verification route is the packaging suites rather than a BDD scenario — the same position `task-074`
and `task-080` recorded for the same ground. The `review` gate therefore runs the full suite, and the
acceptance evidence is the new guard plus the recorded `npm ci` exit codes under npm 10.9.0.

### `red` — role: developer

`test/cli/types-node-floor.test.ts` (new, `c27d23f`), with `package.json` untouched. It asserts the
**relationship** rather than either number: the major of `devDependencies["@types/node"]` equals the
major of `engines.node`'s floor, and the `@types/node` actually installed carries that same major.

```
$ npx jest test/cli/types-node-floor.test.ts
● @types/node vs the declared Node floor (task-087, bug-049)
  › pins @types/node to the major of the engines.node floor — neither below it nor above it
    - "typesMajor": 22
    + "typesMajor": 18
  › has that same major actually installed, not merely declared
    Expected: 22   Received: 18
Tests: 2 failed, 1 passed, 3 total
```

Red for the stated reason, and only for it: the third case (the vacuity guard — that a floor and a pin
are read at all) passes in both states, so the failure is the criterion and not the fixture.

**Why an equality and not "at least".** `bug-049`'s Notes describe a two-directional failure and call
the second direction the costlier one: types *below* the floor reject APIs the supported runtime has,
types *above* it accept APIs it does not. An `>=` assertion would pin only the first. The equality is
also the shape `bug-047` argues for on the neighbouring `engines` guard (its option 1, "add the
equality half") — applied here, to the surface this task owns, without touching the guard `bug-047` is
actually about.

**Both range readers throw on syntax they do not recognise** rather than skipping the check — the same
"loud over clever" choice `task-074`'s engines evaluator made, so a future range form this file cannot
read fails the suite instead of passing vacuously.

### `green` — role: developer

`897658b`. Two files: `package.json` `devDependencies["@types/node"]` `^18.19.130` → **`^22.20.4`**,
and the three lockfile entries that mirror it.

```
$ npx jest test/cli/types-node-floor.test.ts test/cli/lockfile-peer-overrides.test.ts
Test Suites: 2 passed, 2 total   Tests: 10 passed, 10 total
```

**The lockfile was patched surgically, not regenerated — following `task-080`'s precedent and for the
same measured reason.** Regenerating under npm 10.9.0 was tried first and produces a diff larger than
the change needs:

```
$ <npm109> install --package-lock-only --no-audit --no-fund        # exit 0
$ git diff --stat package-lock.json
 package-lock.json | 27 +++++++++------------------      9 insertions(+), 18 deletions(-)
```

Of those, **11 lines are unrelated `"peer": true` churn** — `@babel/core`, `@typescript-eslint/parser`,
`acorn`, `browserslist`, `eslint`, `express`, `hono`, `jest`, `typescript` and `zod` lose the flag while
`@emnapi/wasi-threads` gains it. That is npm 10.9 and npm 11.6 disagreeing about metadata, which
`task-080`'s `green` section already characterized on this same lockfile (it lists the same eleven
packages), and it is nothing this task needs. So the three entries this change *does* need were taken
verbatim from that npm-10.9.0 resolution and inserted into the committed lock; every other byte is
untouched.

The surgical edit is a JSON round-trip, and that it is byte-preserving was **verified rather than
assumed** before it was used:

```
$ node -e 'const raw=fs.readFileSync("package-lock.json","utf-8");
           console.log(JSON.stringify(JSON.parse(raw),null,2)+"\n" === raw)'
true
```

The resulting diff is exactly three entries, 8 lines:

| Lock entry | Before | After |
|---|---|---|
| `packages[""].devDependencies["@types/node"]` | `^18.19.130` | `^22.20.4` |
| `packages["node_modules/@types/node"]` | `18.19.130` | `22.20.4` (+ its `undici-types` range `~5.26.4` → `~6.21.0`) |
| `packages["node_modules/undici-types"]` | `5.26.5` | `6.21.0` |

`undici-types` moves because `@types/node` is the only thing that depends on it and each `@types/node`
line pins its own — it is a consequence of the bump, not a second decision. Both new
`resolved`/`integrity` pairs were checked against the registry independently of npm's resolution, the
way `task-080` checked the `@emnapi` pair:

```
$ npm view @types/node@22.20.4 dist.integrity   -> sha512-zJRE40jpHtKqE/C4fgHrAKQLJuSpzEnP9ff9Y7YtoR3Wd2pwqzlekDeEuUQXjRd+QCYnVnNwuJYmhdk9XV8gvA==
$ npm view undici-types@6.21.0 dist.integrity   -> sha512-iwDZqg0QAGrg9Rav5H4n0M64c3mkR59cJ6wQp+7C4nI0gsmExaedaYLNO44eT4AtBBwjbTiGPMlt2Md0T9H9JQ==
```

Both match the inserted entries byte for byte. `lockfileVersion` is still `3`, no entry is added or
removed, and the hoisted `@emnapi/core` / `@emnapi/runtime` entries are at `1.11.3` before and after —
the check AC4 requires, run on the file rather than inferred from the method:

```
$ node -e '…read both entries…'
BEFORE node_modules/@emnapi/core 1.11.3      AFTER node_modules/@emnapi/core 1.11.3
BEFORE node_modules/@emnapi/runtime 1.11.3   AFTER node_modules/@emnapi/runtime 1.11.3
```

**Which npm touched the lockfile, and why it matters.** `bug-063` records that a plain `npm install`
under npm 11.x deletes both `@emnapi` entries, `overrides` block or not. Every lockfile-writing command
in this task was therefore run with **npm 10.9.0 by absolute path**; the host npm 11.6.2 was used only
for read-only `npm view` queries and for the no-regression `npm ci` in `refactor` (`npm ci` never
writes the lock — confirmed below by `git status` being empty after it).

### `refactor` — role: developer

No refactoring of production code: `src/` is untouched
(`git diff --name-only $(git merge-base main HEAD)..HEAD -- src` → empty output). What this phase
did is measure the two things the task could not know in advance — the type fallout and the AC5
dispositions — and run the gates.

#### AC3 — the type fallout is **zero**, and the bump is not cosmetic

`bug-049`'s Triage Notes say the size of the fallout "is unknown and should be measured by the task that
takes this on, not estimated". Measured, on the installed `@types/node@22.20.4` tree:

```
$ npx tsc -p tsconfig.build.json --noEmit ; echo $?      -> 0
$ npx tsc --noEmit -p tsconfig.json ; echo $?            -> 0
```

Both silent. **Nothing was suppressed and the pin was not widened** — there was nothing to suppress: no
`@ts-expect-error`, no `any`, no `skipLibCheck` change (it was already `true` in `tsconfig.json` before
this task and is unchanged). The full `tsconfig.json` check covers `test/` as well as `src/`, so
`bug-049`'s worry that a `@types/node` major bump would break test sources outside the gate's reach is
answered for this repository: it breaks neither.

That could mean the change does nothing, so it was checked that the type *surface* really moved. Two
APIs that exist on the declared floor's runtime but not on Node 18 — `util.styleText` (Node 20.12+) and
`process.getBuiltinModule` (Node 22.3+) — compiled against each tree with the project's own compiler
options:

```
against @types/node 22.20.4 -> exit 0
against @types/node 18.19.130 -> exit 2
  error TS2305: Module '"node:util"' has no exported member 'styleText'.
  error TS2339: Property 'getBuiltinModule' does not exist on type 'Process'.
```

That is `bug-049`'s first failure direction, reproduced and then closed: before this change the compiler
rejected APIs the supported runtime has. No such API is *used* in `src/` today (which is why the fallout
is zero); the point is that using one is now possible without fighting the compiler or reaching for
`any`.

#### AC4 — `npm ci` under the npm the pinned `NODE_VERSION` bundles

Run in a **throwaway clone of this branch** in the scratchpad, outside every worktree, with
`node_modules` verified absent first — so the result is what someone else would get, not what this
worktree happens to hold:

```
$ git clone -q --branch task/task-087-… <worktree> <scratch>/clonecheck && cd <scratch>/clonecheck
$ git log --oneline -1   -> f5086b7 (after the main merge)
$ ls -d node_modules     -> No such file or directory
$ <npm109> --version     -> 10.9.0
$ <npm109> ci --dry-run --no-audit --no-fund ; echo $?        -> 0
$ <npm109> ci --no-audit --no-fund                            -> added 498 packages in 7s ; exit 0
$ node -p "require('./node_modules/@types/node/package.json').version"   -> 22.20.4
$ node -e '…the two @emnapi lock entries…'  -> core 1.11.3 · runtime 1.11.3
$ git status --porcelain package-lock.json package.json       -> (empty)
```

No-regression under the developer npm, in a second clone:

```
$ npm --version -> 11.6.2 ; npm ci --no-audit --no-fund -> added 498 packages in 7s ; exit 0
$ node -p "…@types/node version…" -> 22.20.4 ; git status --porcelain package-lock.json -> (empty)
```

498 packages before and after (the merge-base tree installs 498 too — see AC5/`bug-048` below), so the
closure size is unchanged; `@types/node` and `undici-types` simply move version.

#### AC5 — `bug-046`, `bug-047`, `bug-048`: **all three untouched**, none closed, none mooted

None of them is fixed here, and no change of mine is a one-line consequence of any of them. Each row
names the command that settles it, run on this branch after the `main` merge.

| Bug | Disposition | Command that settles it |
|---|---|---|
| `bug-046` — nothing asserts `package-lock.json`'s root `engines` matches `package.json`'s | **untouched** | `git diff $(git merge-base main HEAD)..HEAD -- package.json \| grep engines` → `rc=1`, no output; both copies still agree and still read `>=22.12.0` (`node -p "require('./package.json').engines.node"` and `node -p "require('./package-lock.json').packages[''].engines.node"`); `grep -rn 'packages\[""\]' test/` → `rc=1`, so still no test reads the lock's root block |
| `bug-047` — the engines guard asserts *satisfies*, never *equals* | **untouched** | `git diff --name-only $(git merge-base main HEAD)..HEAD -- test/cli/publish-metadata.test.ts` → empty output: the guard it is about is not edited by this branch |
| `bug-048` — CI's pinned `NODE_VERSION` 22.12.0 does not satisfy `eslint@10.6.0` | **untouched, and not worsened** | `git diff --name-only $(git merge-base main HEAD)..HEAD -- .github/` → empty output; `grep -n "NODE_VERSION:" .github/workflows/publish.yml` → still `'22.12.0'`; and the set of installed packages whose `engines.node` excludes 22.12.0 is **identical before and after** — 10 packages, all `eslint`-family, listed below |

Two observations worth handing on, neither acted on here:

- **`bug-046` generalizes beyond `engines`, and this change is a second instance of its class.**
  `package-lock.json` mirrors `devDependencies` in `packages[""]` exactly as it mirrors `engines`.
  Measured under npm 10.9.0 on copies of this branch's two files:

  ```
  lock root range edited to ^18.19.130, resolved entry left at 22.20.4   -> npm ci --dry-run EXIT=0
  manifest bumped to ^22.20.4, whole lock left at the merge-base          -> npm ci EXIT=1
       npm error Invalid: lock file's @types/node@18.19.130 does not satisfy @types/node@22.20.4
  ```

  So `npm ci` validates the *resolved* entry against the manifest but ignores the root **range** mirror
  — the same blind spot `bug-046` measured for `engines`, one field over. The realistic mistake (bump
  the manifest, forget the lock) is caught; editing the root mirror alone is not. This task's own guard
  covers the `@types/node` case from the other side, because its third assertion reads the **installed**
  version rather than either declaration.
- **`bug-048` undercounts.** It names two packages (`eslint@10.6.0`, `@eslint/js@10.0.1`) because it
  probed a hand-picked list. A full walk of the installed tree finds **ten** that exclude 22.12.0 —
  `eslint@10.6.0`, `@eslint/js@10.0.1`, `@eslint/config-array@0.23.5`, `@eslint/config-helpers@0.6.0`,
  `@eslint/core@1.2.1`, `@eslint/object-schema@3.0.5`, `@eslint/plugin-kit@0.7.2`,
  `eslint-scope@9.1.2`, `eslint-visitor-keys@5.0.1`, `espree@11.2.0`, all declaring
  `^20.19.0 || ^22.13.0 || >=24`. The same walk over a fresh `npm ci` of the **merge-base** tree returns
  the same ten, so this change neither adds nor removes any: the two packages it moves declare no
  `engines` at all (`npm view @types/node@18.19.130 engines` and `npm view undici-types@5.26.5 engines`
  → empty; `@types/node@22.20.4` and `undici-types@6.21.0` → `null`). Reported for whoever picks up
  `bug-048`; not folded in.

#### Gates

Re-run in full **after** merging `main` at `6c2b8f1` (`task-085`'s spec-015 retense plus `bug-068`),
on the tree installed by `<npm109> ci`:

| Command | Result |
|---|---|
| `npx jest` | **exit 0** — 107 suites / 1730 tests passed |
| `npx jest --coverage` | **exit 0** — statements **98.58**, branches **92.58**, functions **98.81**, lines **99.18**; threshold 80 met on all four |
| `npx tsc -p tsconfig.build.json --noEmit` | **exit 0** |
| `npx tsc --noEmit -p tsconfig.json` | **exit 0** — no output at all, `bug-026` included |
| `npm run lint` | **exit 0** |
| `npm run docs:api` | **exit 0** |

Coverage is non-regressing by construction as well as by measurement: `jest.config.js`
`collectCoverageFrom: ['src/**/*.ts', '!src/**/index.ts']`, and this branch changes no file under
`src/` — the diff is `package.json`, `package-lock.json`, one test file and two Memory documents.

### `review-ready summary` — role: reviewer

**What the change is.** `@types/node` moves `^18.19.130` → `^22.20.4`, the lockfile's three mirroring
entries move with it, and a new test pins the *relationship* — the `@types/node` major equals the major
of `engines.node`'s floor — so the next floor move fails a gate instead of silently leaving the type
surface three majors behind. It is the build-side leaf of `adr-010`'s cascade, and it closes `bug-049`.

**Merged `main` once, never rebased** (`dl-035`), at `6c2b8f1`. The merge brought `spec-015`'s
`task-085` retense and `bug-068`. **No document this task cites changed in it** —
`git diff --name-only 897658b HEAD | grep -E 'adr-010|task-001|task-074|task-080|dl-0(14|15|35|45|54|75)|bug-04[6789]|bug-05[6]|bug-063|lockfile-peer-overrides|publish-metadata|publish.yml|package'`
→ `rc=1`, no output — and the one claim that *could* have gone stale was re-checked against the merged
file rather than assumed: `grep -n -i "types/node\|devDependenc\|@types" …spec-015….md` → `rc=1`, still
no output, so "spec-015 says nothing about `@types/node`" holds after the merge as before it. Every gate
was re-run afterwards; the numbers above are from that run.

**Files changed** (`git diff --stat $(git merge-base main HEAD)..HEAD`), five, none under `src/`:

```
docs/self/docs/04_memory/bugs/bug-049-types-node-pinned-to-superseded-floor.md   (status sync only)
docs/self/docs/04_memory/v0.2/task-087-fix-types-node-floor-pin.md               (this log)
package-lock.json                                                                (8 lines, 3 entries)
package.json                                                                     (1 line)
test/cli/types-node-floor.test.ts                                                (new)
```

**AC status.** AC1 ✅ (`test/cli/types-node-floor.test.ts`, red at `c27d23f` and green at `897658b`;
resolved version `22.20.4`, agreement shown by the test rather than asserted). AC2 ✅ (the major is
derived from `>=22.12.0` in the `design` table, with the registry and Node release-index commands that
produce it; `^24`/`^26` explicitly declined). AC3 ✅ (both typechecks exit 0; fallout measured at zero,
nothing suppressed, pin not widened, and the surface shown to have really moved). AC4 ✅ (`npm ci` exit
0 under npm 10.9.0 in a throwaway clone with `node_modules` absent; `@emnapi` entries at `1.11.3` before
and after; `test/cli/lockfile-peer-overrides.test.ts` green). AC5 ✅ (all three bugs untouched, each with
its settling command; two observations handed on rather than folded in). AC6 ✅ (six gates, table above).

**Known weak spots a reviewer should check.**

1. **The within-major residual.** `^22.20.4` describes the Node 22 line as a whole, not Node 22.12.0
   specifically, because DefinitelyTyped publishes no per-Node-minor type surface (evidence in the
   `design` table). APIs added in Node 22.13–22.23 therefore typecheck while the declared floor lacks
   them. This is a genuine, smaller version of the same defect class as `bug-049` and is carried as a
   proposed element rather than absorbed.
2. **The `adr-010` *Neutral* bullet is now stale** ("`@types/node` is still pinned `^18.19.130`"). Left
   as-is deliberately — see `design`/"One thing deliberately not edited". A reviewer may disagree that
   an `accepted` ADR's decision-time record should stay put; that is the approver's call, not this
   task's.
3. **The lockfile is hand-patched, not regenerated.** The method is `task-080`'s and the diff is three
   entries, but a reviewer who prefers a regenerated lock should know that regenerating under npm 10.9.0
   adds the 11-package `"peer": true` churn documented under `green`, and regenerating under npm 11.x
   deletes the `@emnapi` entries (`bug-063`).
