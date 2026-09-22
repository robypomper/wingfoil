---
id: "task-087-fix-types-node-floor-pin"
type: task
title: "Raise `@types/node` to the Node floor adr-010 declared, so `src/` is typechecked against the runtime the package promises"
status: in-progress
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
