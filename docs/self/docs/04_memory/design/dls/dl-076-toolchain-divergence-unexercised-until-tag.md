---
id: "dl-076-toolchain-divergence-unexercised-until-tag"
type: decision-log
title: "The toolchain that builds this repository is not the toolchain that releases it — npm 11.6.2 locally against the 10.9.x every Node 22 release bundles, git 2.43.0 against the runner's 2.55.0 — and nothing declares, gates or exercises the difference until a release tag"
status: in-discussion
context: "toolchain-governance"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

A repository that pins a Node version in CI and nothing anywhere else has not pinned a toolchain. It
has pinned one tool, in one place, for one workflow that runs once per release — and left every other
tool, and every developer machine, free. The artifacts a developer commits (a lockfile, a test
assertion) are then built against an environment **no gate in this repository ever runs in**, and the
first process that does run in that environment is the release.

That is the class this document records. It is not a hypothesis: it produced two independent
release-blocking defects within days of each other, both found by the *first* execution of the
pipeline (`task-077-first-real-staging-run`, `done`), neither of which any local gate could have
produced.

The class has two axes, and whether they are one decision or two is settled in **E7** and in the
Decision below:

- **What differs** — tool versions. The lockfile is written by an npm that no pinned Node ships; the
  timestamp assertions are written against a git that no runner ships.
- **When the difference is first exercised** — `.github/workflows/publish.yml` fires on a version tag
  and nothing else, so the divergent environment is first entered at the most expensive moment
  available.

All measurements below are against `main` at **`0cf643f`**, taken in this ingest's worktree, with the
command that produced each stated inline. Every figure was re-derived here; one reproduction attempt
failed on the first try through an error of this document's own, which is recorded in **E6** rather
than hidden.

### E1 — the measured divergence

```
$ node --version && npm --version && git --version
v22.21.0
11.6.2
git version 2.43.0
```

```
$ curl -sS https://nodejs.org/dist/index.json -o /tmp/nodeindex.json
$ node -e 'const d=require("/tmp/nodeindex.json");
  for (const v of ["v22.12.0","v22.21.0","v22.23.2","v23.11.1","v24.21.0"]) {
    const r = d.find(x => x.version === v); console.log(r.version, "npm", r.npm); }'
v22.12.0 npm 10.9.0
v22.21.0 npm 10.9.4
v22.23.2 npm 10.9.8
v23.11.1 npm 10.9.2
v24.21.0 npm 11.19.0
```

```
$ curl -sS https://raw.githubusercontent.com/actions/runner-images/main/images/ubuntu/Ubuntu2404-Readme.md \
    | grep -iE '^- (Node\.js|Npm|Git) '
- Node.js 22.23.2
- Npm 10.9.8
- Git 2.55.0
```

| Tool | This developer machine | What `publish.yml`'s `env.NODE_VERSION` (`'22.12.0'`) installs | What `ubuntu-24.04` pre-installs |
|---|---|---|---|
| Node | **22.21.0** | **22.12.0** | 22.23.2 |
| npm | **11.6.2** | **10.9.0** | 10.9.8 |
| git | **2.43.0** | *not pinned* → the image's **2.55.0** | 2.55.0 |

Three properties of that table are load-bearing.

**The local npm is not even what the local Node bundles.** Node v22.21.0 ships npm 10.9.4 per the
index above, yet `npm --version` reports 11.6.2, and it is a plain global install rather than a
corepack shim:

```
$ ls -la $(which npm)
/usr/local/bin/npm -> ../lib/node_modules/npm/bin/npm-cli.js
```

So the npm every local command runs under is a hand-upgrade that no Node release, pinned or
otherwise, would produce.

**No Node 22 release ships npm 11**, so the divergence cannot be closed by moving the pin inside the
supported line. `adr-010-node-22-runtime-floor` (`accepted`) sets the runtime floor at Node 22.12+;
across the whole 22 line the bundled npm runs 10.9.0 → 10.9.8, and npm 11 first appears on Node 24
(`v24.21.0` → `11.19.0`, above). Reaching npm 11 through the Node pin means leaving the floor
`adr-010` accepted.

**The bundled-npm mapping is not monotonic in the Node version**, so "pick a newer Node" is not even
a reliable heuristic: the latest Node 23 (`v23.11.1`) bundles npm **10.9.2**, older than the npm the
latest Node 22 (`v22.23.2`) bundles (**10.9.8**).

### E2 — what the repository declares about its toolchain: one field, advisory

The negatives here are the finding, so each is stated with the command that returned nothing.

```
$ grep -rn "packageManager\|volta" package.json .github/ scripts/
$ find . -maxdepth 3 -not -path "./node_modules/*" -not -path "./.git/*" \
      \( -name ".nvmrc" -o -name ".node-version" -o -name ".tool-versions" -o -name ".npmrc" \)
$ grep -rn "corepack" --include="*.json" --include="*.yml" --include="*.cjs" \
      --include="*.ts" --include="*.md" . --exclude-dir=node_modules --exclude-dir=.git
```

All three produce **no output**. There is no `packageManager` field, no `volta` block, no `.nvmrc`,
no `.node-version`, no `.tool-versions`, no repository `.npmrc`, and corepack is named nowhere —
although corepack itself is present on this machine (`corepack --version` → `0.34.0`), so adopting it
would not require installing anything new.

The single declaration that does exist is `package.json`'s `engines` object, which carries
`"node": ">=22.12.0"` and **no `npm` key**. It is advisory:

```
$ npm config get engine-strict
false
```

With `engine-strict` false — the default, and there is no `.npmrc` to change it — a violated `engines`
range is a printed `EBADENGINE` warning, not a failure. That is exactly the mechanism
`bug-048-ci-node-version-fails-eslint-engines` (`open`, low) already records for the Node pin, and
exactly the warning nobody acted on.

**Nothing in the repository asserts a tool version at runtime.** The only version assertions in the
tree are two expectations in `test/cli/publish-pipeline.test.ts` — `expect(parsed.env?.NODE_VERSION)
.toBe('22.12.0')` and `expect(setup?.with?.['node-version']).toBe('${{ env.NODE_VERSION }}')` — which
assert that the pin is *written in the YAML*, not that any process ever runs under it. No script
prints or checks `node --version`, `npm --version` or `git --version`:
`grep -rn "node --version\|npm --version\|git --version\|process\.version" scripts/ .github/ src/ test/`
returns only those two workflow-shape assertions plus prose in `test/cli/publish-metadata.test.ts`.

### E3 — where the pipeline pins, and what it leaves to the image

```
$ find .github -type f
.github/workflows/publish.yml
```

One workflow file in the whole repository. Inside it:

- `env.NODE_VERSION` is `'22.12.0'`, declared once.
- All three jobs — `gate`, `stage`, `promote` — use `actions/setup-node` with
  `node-version: ${{ env.NODE_VERSION }}`, so all three run the same Node and therefore the same npm.
  **No job runs `npm ci` under a different npm than another**, because only one job runs `npm ci` at
  all.
- **npm is never pinned independently of Node.** It arrives as whatever the chosen Node bundles, and
  as **E1** shows that is 10.9.0 — *older* than the 10.9.8 the runner image already had, so the
  `setup-node` step actively downgrades npm relative to the bare image.
- **git is not pinned anywhere**, in any job. It is whatever `ubuntu-24.04` ships. Nothing in npm's
  manifest vocabulary can pin it: `engines` and `packageManager` describe Node and a package manager,
  not a version-control binary.

```
$ grep -rn "npm ci" .github/ scripts/ package.json
.github/workflows/publish.yml:3:#   gate    → assert the tag is on main and equals v<package.json version> (spec-015 §4), `npm ci`,
.github/workflows/publish.yml:52:# declare `^20.19.0 || ^22.13.0 || >=24`), so `npm ci` in these jobs emits EBADENGINE warnings for
.github/workflows/publish.yml:127:        run: npm ci
```

Three hits, two of them comments. The repository contains exactly **one** executable `npm ci` — the
`Install` step of the `gate` job — and it is reachable only by a tag push (**E4**).

### E4 — when each gate runs: everything locally, or once per release

The trigger is `on.push.tags` with the single pattern `'v[0-9]+.[0-9]+.[0-9]+'`. There is no
`pull_request` key, no branch `push` key, no `workflow_dispatch`, no `schedule`.

| Gate | Declared in | Fires |
|---|---|---|
| unit tests, coverage ≥ 80, TypeDoc API docs, `lint.clean` | `dev-loop.yaml`, the `refactor` phase's `checks.post` | developer machine, by hand |
| BDD acceptance suite | `dev-loop.yaml`, the `review` phase's `checks.pre` | developer machine, by hand |
| fresh-init + CLI end-to-end smoke (`dl-023`) | `release-cycle.yaml`, the `e2e-smoke` phase | developer machine, by hand |
| `npm ci` · `prepublishOnly` (build + test + lint) · `npm publish --dry-run` · `npm pack` | `publish.yml`, job `gate` | **only** a `vX.Y.Z` tag push |
| ephemeral-Verdaccio staging publish + clean install + smoke | `publish.yml`, job `stage` | same tag push |
| real publish with provenance | `publish.yml`, job `promote` | same tag push, after approver review |

Every gate that runs *before* a tag runs on a developer machine. Every gate that runs in the
pipeline's environment runs *only* at the tag. There is no third case. And because there is no
workflow engine yet, even the left-hand column is a convention a human executes rather than a
process — the `checks` entries in `dev-loop.yaml` are declarations, not a runner.

How long the divergent environment went unentered, measured:

```
$ git log --reverse --format='%h %cI' -- .github/workflows/publish.yml | head -1
5236a2e 2026-09-17T17:47:13+02:00
$ git log --oneline -- .github/workflows/publish.yml | wc -l
5
$ git rev-list --count 5236a2e..HEAD
472
```

The pipeline landed on 2026-09-17, was edited **5** times, and **472** commits reached `main` before
`task-077` ran any part of it for the first time (its tasks were filed 2026-09-21T09:58, `05a1388`;
approved 2026-09-21T19:56, `ac10060`). Nothing about that window is unusual for this project — it is
what a tag-only trigger means.

### E5 — instance 1: `bug-056`, and the fix space is narrower than the bug states

`bug-056-npm-ci-fails-under-pinned-npm-10-9` (`planned`, high) reports that `npm ci` fails under npm
10.9.0. Re-derived here on `0cf643f`, and **extended**: the failure is not specific to the pinned npm.

```
$ npm install --prefix <scratch>/npm1090 npm@10.9.0 --no-audit --no-fund --silent
$ npm install --prefix <scratch>/npm1098 npm@10.9.8 --no-audit --no-fund --silent
$ <scratch>/npm1090/node_modules/.bin/npm ci --dry-run --no-audit --no-fund ; echo EXIT=$?
npm error code EUSAGE
npm error Missing: @emnapi/core@1.11.3 from lock file
npm error Missing: @emnapi/runtime@1.11.3 from lock file
EXIT=1
$ <scratch>/npm1098/node_modules/.bin/npm ci --dry-run --no-audit --no-fund ; echo EXIT=$?
npm error code EUSAGE
npm error Missing: @emnapi/core@1.11.3 from lock file
npm error Missing: @emnapi/runtime@1.11.3 from lock file
EXIT=1
$ npm --version && npm ci --dry-run --no-audit --no-fund >/dev/null 2>&1 ; echo EXIT=$?
11.6.2
EXIT=0
```

**10.9.8 is the npm the runner image pre-installs and the npm the newest Node 22 bundles** (**E1**),
and it fails on the same bytes with the same message. Two consequences the bug does not state:

- Raising `env.NODE_VERSION` anywhere inside the Node 22 line does **not** unblock the gate.
- Deleting the `setup-node` steps and using the image's own Node does **not** unblock it either.

The structural gap is unchanged:

```
$ grep -n '"node_modules/@emnapi' package-lock.json
565:    "node_modules/@emnapi/wasi-threads": {
```

One hoisted `@emnapi` entry, and it is neither of the two that npm 10.x demands, in a
`lockfileVersion 3` lock (`node -e 'console.log(require("./package-lock.json").lockfileVersion)'`
→ `3`). The lockfile is a **product of the divergent npm**: it was written by an npm 11 and is
installable only by an npm 11. This is the axis-1 mechanism in its purest form — the divergence did
not merely hide a defect, it *authored* one.

### E6 — instance 2: `bug-057`, which no npm-side declaration can reach

`bug-057-timestamp-assertions-reject-zulu-offset` (`planned`, high) reports that two `%aI` assertions
reject git's `Z` zero-offset. The environment half, re-derived here:

```
$ git --version
git version 2.43.0
$ TZ=UTC git commit -q --allow-empty -m utc && git log -1 --format=%aI
2026-09-21T20:32:55+00:00
$ TZ=Europe/Rome git commit -q --allow-empty -m rome && git log -1 --format=%aI
2026-09-21T22:32:55+02:00
$ node -e 'console.log(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test("2026-09-21T09:25:53Z"))'
false
```

git 2.43.0 writes a zero offset as `+00:00`, which the narrow regex accepts; the runner's git 2.55.0
(**E1**) writes `Z`, which it rejects. The defect is unreachable on this machine by construction —
not unlikely, *unreachable*.

*A caution, recorded because it cost a measurement here.* A first attempt ran
`TZ=UTC git log -1 --format=%aI` against a commit that had been authored under `Europe/Rome`, and got
back `+02:00` — which reads as "git 2.43 ignores `TZ`", and is wrong. `%aI` renders the **author's
stored offset**, so the timezone that matters is the one in effect at `git commit`, not at `git log`.
`bug-057`'s reproduction command is correct as written (`TZ=UTC` sits on the `commit`); the error was
this document's. It is worth stating because it is the same failure mode as the class itself: a
measurement taken in the wrong environment that produces a plausible number.

The decisive property for the decision below: **`engines` has no `git` key, and `packageManager`
names a package manager.** There is no field in `package.json`, no lockfile, and no npm configuration
that constrains which git a developer runs. Every instrument on axis 1 that is cheap is also
structurally blind to `bug-057`.

### E7 — how much of `task-077`'s harvest this class actually explains

Six bugs came out of the first pipeline run. Classified honestly, including the ones this decision
would not have prevented:

| Bug | Status / severity | Class | Matching local toolchain? | Earlier CI run on `ubuntu-24.04`? |
|---|---|---|---|---|
| `bug-056` `npm ci` under pinned npm | `planned`, high | toolchain version (npm) | **Yes** — any local npm 10.9.x fails on every `npm ci` (**E5**) | **Yes** — first push |
| `bug-057` `Z` zero-offset | `planned`, high | toolchain version (git) + UTC | **Only** with a local git ≥ 2.55 *and* commits authored under UTC; no npm-side field reaches it (**E6**) | **Yes** — first push |
| `bug-058` `ENOTEMPTY` teardown flake | `planned`, medium | flaky race under load | No — not version-keyed; passes on the host and passed two of three container runs | **Flakily** — an earlier run is a chance, not a guarantee |
| `bug-059` SIGINT leaks staging registry + token | `planned`, high | missing signal handler in `scripts/publish-staging.cjs` | No — reproducible locally today; it needed the script **run** | **No** — CI sends no SIGINT |
| `bug-060` `act` recipe unusable from a worktree | `open`, low | environment divergence, *opposite* direction | n/a — the local environment is the one that breaks | **No** — CI never runs `act` from a worktree |
| `bug-061` staging log noise | `open`, low | cosmetic output of a **passing** run | No | **No** — a green run stays green |

**2 of 6** are toolchain-version divergence in the sense this document is about. **1 more**
(`bug-060`) is environment divergence on a different axis and is the mirror image: it fires *only*
locally and never in CI, so neither "make local look like CI" nor "run CI earlier" would have found
it. **3 of 6** (`bug-058`, `bug-059`, `bug-061`) were found because the pipeline was finally
*executed*, not because of where it executed.

That is the honest limit on this decision and it must not be softened: the dominant reason `task-077`
produced six findings is that **nothing had ever run** — 472 commits, five edits to the workflow, zero
executions (**E4**). Environment explains a third of the harvest; execution explains the rest. Any
option evaluated below on "how many bugs would it have caught" has to be read against that split.

## Decision

WingFoil records how the toolchain a developer builds with is related to the toolchain the release
pipeline runs under, and when that relation is first exercised. The approver's choice — and the
answer to **Q1** below — is recorded in this document's approve commit `Reason:`.

### Q1 — one decision or two

This document treats the two axes as **one decision with two instruments**, and argues it from the
evidence rather than from tidiness.

*For one.* Neither instrument alone disposes of the two instances already realized. An npm-side
declaration — `engines.npm`, `packageManager`, a `.nvmrc` — is structurally blind to `bug-057`
(**E6**): there is no manifest field that names a git. An earlier CI run detects `bug-056` on the
first push, but does not stop the next `npm install` from rewriting the lockfile the same way, because
nothing local constrains which npm writes it (**E5**: the lock is a *product* of the divergence, not
merely a victim of it). Ratifying either half alone leaves a known, already-realized defect class
uncovered — which is the test `dl-075-no-bare-line-offsets-in-memory` (`ready`) applied to its own
option (C): an option that presupposes the other half is not an alternative to it.

*For two, stated fairly.* They have different fix surfaces (`package.json` and dotfiles versus
`.github/`), different practical owners (repository configuration versus the `adr-009` pipeline), and
very different cost shapes — one taxes every developer command, the other taxes no local command at
all. The trigger axis also touches a ratified ADR: `adr-009-npm-publishing-pipeline` (`accepted`)
decision 1 reads "The publish workflow runs on a `vX.Y.Z` git tag pushed to `main`". A reader could
reasonably file the trigger question as an amendment to `adr-009` and the declaration question as a
repository convention, and keep them apart.

*Why one is still the better reading.* The failure being recorded is neither "our npm differs" nor
"CI runs late". It is **that the environment the released artifacts are built for is an environment
nothing in this repository ever runs in** — of which the version gap is the cause and the tag-only
trigger is why it survives to the release. The approver may still schedule the instruments as separate
tasks; that is an implementation split, not a second decision. This stays an open question rather than
a settled one, because the governance cost of touching `adr-009` is real and only the approver can
weigh it.

### The options

Costs below are per-instrument; they compose, and a recommendation is stated in **Actions**.

**(A) Declare `packageManager` and adopt corepack.** `"packageManager": "npm@<version>"`, every
contributor runs `corepack enable` once, and the workflow gains a `corepack enable` step before
`npm ci`.
*Prevents:* the lockfile can no longer be written by an npm nobody else has — the direct cause of
`bug-056` (**E5**). It is also the only option that makes the divergence *harmless* rather than
*forbidden*: the developer keeps their global npm, and it is simply bypassed inside this repository.
*Costs:* corepack fetches the declared npm on first use (network); it is one more moving part against
`adr-001`'s minimal-dependency posture; and `corepack enable` is a per-developer step no gate can
verify, so a contributor who skips it is silently back to today.
*Does not prevent:* `bug-057`, at all (**E6**). It names a package manager; git is not one.
*Ordering trap, measured:* declaring an npm **10.9.x** — the align-to-CI direction — makes **every
local `npm ci` fail today**, because 10.9.8 fails on this lockfile (**E5**). That direction is
unadoptable until `bug-056` is fixed. Declaring **11.x** aligns the developer with an npm no job
currently runs, and would have to be paired with pinning npm in the workflow too — which, per **E1**,
cannot be done through the Node pin without leaving `adr-010`'s floor.

**(B) Declare `engines.npm`.** One key in `package.json`.
*Prevents:* nothing, by default. `npm config get engine-strict` → `false` (**E2**), so a violated
range prints `EBADENGINE` and continues — the same warning `bug-048` already records as ignored for
Node. Adding `.npmrc` with `engine-strict=true` turns it into a hard failure, but `engines` is also a
promise to **consumers** of the published package, so a strict npm floor is a product-visible change
that belongs with `adr-010`, not with a repository convention. And a `>=11` floor is currently
unsatisfiable by any Node 22 release (**E1**) — it would declare a combination the project's own
accepted ADR forbids by default.
*Costs:* zero, which is also what it buys.

**(C) Add `.nvmrc` / `.node-version`.** One line.
*Prevents:* neither bug. The local Node (22.21.0) is already inside the declared floor; the npm that
matters is the one installed globally *over* it (**E1**).
*Costs:* near zero, plus a real hazard: the Node version would then be written in two places — the
dotfile and `publish.yml`'s `env.NODE_VERSION` — with nothing keeping them equal, so it adds a drift
surface in exchange for no coverage.

**(D) Run the packaging gate on push/PR.** A **second** workflow, leaving `publish.yml`'s tag-only
trigger untouched, running `npm ci` + `prepublishOnly` on `ubuntu-24.04` at the same `NODE_VERSION`.
*Prevents:* `bug-056` **and** `bug-057`, on the first push after each entered the tree — the only
candidate covering both (**E7**). It also addresses the larger finding: it converts "the pipeline
environment is entered once per release" into "once per push", and **E4**'s 472-commit window is the
measure of what that is worth.
*Costs:* Actions minutes (free on a public repository), a few minutes of wall clock per push, and the
discipline of keeping it green. One cost must be named rather than waved past: `adr-009` explicitly
lists "iterating a GitHub Actions workflow by pushing commit-after-commit just to debug it" as a cost
to avoid. A push-triggered job runs on every push by definition, so the decision has to say whether
that concern attaches to a *gate* workflow — which is not being iterated, and which is precisely the
thing that would let the publish workflow stop being debugged by tagging.
*Does not prevent:* `bug-059` (CI sends no SIGINT), `bug-060` (CI never runs `act` from a worktree),
`bug-061` (a green run stays green). Catches `bug-058` only flakily.
*Governance note:* as a separate workflow this needs **no** `adr-009` amendment. Changing
`publish.yml`'s own `on:` block would.

**(E) A documented container step in dev-loop's `refactor` gates.** Run the suite once inside
`catthehacker/ubuntu:act-24.04` — which ships git 2.55.0, per `bug-057` — before review.
*Prevents:* `bug-057` locally, and `bug-056` too if the container's own npm is used.
*Costs:* a Docker pull and a container suite run per task. The mechanism is already proven at task
scale: `task-081-fix-timestamp-offset-assertions`' Implementation Notes recommend exactly this narrow
form (`docker run --rm catthehacker/ubuntu:act-24.04 …`, "it needs no `act`, no workflow and no
artifact server") for its AC2.
*Does not prevent:* anything requiring a real GitHub runner. And it would be a `checks` entry in a
`workflows/custom/` YAML that no engine executes — a convention a reviewer enforces, as `lint.clean`
was before `task-066-fix-eslint-baseline-and-lint-gate` made it real.

**(F) Write the divergence down and change nothing.** A paragraph in the `documentation` or
`code-quality` custom directive, or in `README.md`: *your npm is not CI's npm; `npm ci` passing
locally proves nothing about the gate.*
*Prevents:* nothing; it converts a silent trap into a known one.
*Costs:* nothing.
*Worth stating honestly:* this has already happened. `bug-056`'s own Notes say "Every local `npm ci`
in this repository has been run under an npm no CI job will ever use" — written **after** the gate
failed. Option (F) is the status quo with the finding recorded, and its only claim is that a named
trap is better than an unnamed one.

### What ratification would require of a developer working here today

Stated explicitly, because "does my wrong npm become a problem?" is the question anyone reading this
will actually have. A developer whose npm is 11.6.2 while CI runs 10.9.0:

| Ratified option | Must they change their machine? | What a mismatch becomes |
|---|---|---|
| **(F)** only | No | Nothing — a documented caveat |
| **(B)** without `engine-strict` | No | A printed `EBADENGINE` line, ignorable — and ignored (`bug-048`) |
| **(B)** with `engine-strict=true` | **Yes** — every `npm install`/`npm ci` on a non-conforming npm fails, for contributors *and* for consumers of the published package | A hard local failure; needs `adr-010`'s floor reopened |
| **(A)** corepack | One-time `corepack enable`; the global npm is then bypassed inside the repo, not forbidden | Nothing — the mismatch stops mattering. **But** if the declared npm is a 10.9.x, every local `npm ci` fails until `bug-056` is fixed (**E5**) |
| **(C)** `.nvmrc` | Only if they already use a version manager that reads it | Nothing |
| **(D)** push/PR gate | No | A **CI** failure on the author's own branch, minutes after the push, instead of a release failure at the tag |
| **(E)** container gate | A Docker pull; one container run per task | A reviewer-enforced gate failure before review |

Only **(B)-strict** requires anyone to change their toolchain. **(A)** and **(D)** — the two with real
coverage — require nobody to change anything they run outside this repository.

## Rationale

- **The divergence did not only hide a defect; it authored one.** The lockfile on `main` is
  `lockfileVersion 3` written by npm 11 and not installable by any npm 10.9.x, including the one the
  runner image already carries (**E5**). That is why detection alone is insufficient: an earlier CI
  run would have gone red on the first push, and the next `npm install` under the developer's npm
  would have re-created the same lock. Prevention and detection here are not two strategies for the
  same gap; they close different halves of one causal chain.
- **Cheap instruments are structurally blind to half the evidence.** `engines`, `packageManager` and
  `.nvmrc` are all npm/Node vocabulary. `bug-057` is a git defect. No declaration in `package.json`
  constrains git, and the local git (2.43.0) *cannot* produce the input that fails (**E6**). Any
  option set that stops at the manifest has, by construction, no answer for one of the two realized
  blockers.
- **The tag-only trigger is a ratified choice, not an oversight.** `adr-009` decision 1 states the
  trigger deliberately, and `adr-009` did reason about CI cost — its concern was iterating a workflow
  by pushing throwaway commits. That concern is about the *publish* workflow. Nothing in `adr-009`
  considered, or excluded, a separate gate workflow; the scope it names is "the *package-distribution*
  pipeline, which is inherently a CI concern". So option (D) as a second workflow is an addition
  `adr-009` is silent on, not a reversal of it. This document says so rather than claiming `adr-009`
  was wrong.
- **The strongest case for (D) is not the bug count.** `task-077`'s harvest splits 2 environment / 3
  execution / 1 inverse (**E7**). The number that argues for a push gate is **E4**'s: 472 commits and
  five edits to `publish.yml` before any part of it ran. A pipeline exercised once per release is a
  pipeline whose defects are all discovered at once, under release pressure, by whoever pushed the
  tag — which is exactly what happened.
- **This is adjacent to determinism without being a REQ-SYS-07 violation.** REQ-SYS-07 governs context
  assembly, not build environments. But the project's north star is that two independent runs from the
  same specifications produce substantially equivalent software, and a repository in which `npm ci`
  succeeds or fails according to an undeclared property of the operator's machine does not meet the
  spirit of that even though no requirement as written is breached. REQ-SYS-09 is the closest existing
  hook: it already establishes that this project makes a machine-checkable promise about the
  environment its artifacts *run* in — the `engines.node` floor `task-074-fix-engines-node-floor`
  closed. What it does not yet do is make any promise about the environment its artifacts are *built*
  in.
- **Doing nothing is a defensible position and is costed as such.** Option (F) is what the repository
  effectively chose for 472 commits, and the price was two high-severity blockers discovered in the
  release gate rather than four days earlier. That price is now known, which is the one thing that was
  not true before `task-077`. An approver who judges a second workflow not worth its ongoing
  maintenance is making a defensible trade, provided the trade is recorded here rather than
  re-discovered at the next tag.
- **`bug-060` is deliberately not folded in.** It is environment divergence in the opposite
  direction — a local condition (`act` from a git worktree) that CI never meets — and neither
  instrument here touches it. Including it would make this decision look broader than its evidence
  supports.

## Actions

1. **Answer Q1 — one decision or two.** Owner: approver. This document argues one, with the
   instruments schedulable as separate tasks. If the approver splits it, the trigger half should say
   explicitly whether it amends `adr-009` or adds a workflow beside it.
2. **Choose the instrument set.** Owner: approver; the choice belongs in this document's approve
   commit `Reason:`. This document's reading of its own evidence: **(D) + (A)**, in that order —
   (D) because it is the only option covering both realized blockers and it also closes **E4**'s
   execution gap, (A) because it is the only option that stops the lockfile being authored by an npm
   nobody else runs, and it requires nobody to change their machine. (B), (C) and (F) are recorded as
   costed and covering nothing that (D) + (A) does not.
3. **Order (A) after `bug-056`.** Declaring `packageManager` at any npm 10.9.x breaks every local
   `npm ci` today (**E5**). If (A) is ratified, its task must depend on
   `task-080-fix-npm-ci-under-pinned-npm`, and must state which direction it aligns — toward CI's
   10.9.x or toward the lockfile's 11.x — because **E1** shows those cannot both be satisfied through
   the Node pin while `adr-010`'s Node 22 floor stands.
4. **If (D) is ratified, scope it narrowly first.** `npm ci` + `prepublishOnly` on `ubuntu-24.04` at
   the same `NODE_VERSION`, as a new workflow file; not a copy of the staging job, which needs
   Verdaccio and is where `bug-059` and `bug-061` live. Owner: whoever carries the task.
5. **Do not close `bug-056` or `bug-057` on the strength of this decision.** They are release blockers
   with their own fix tasks (`task-080`, `task-081`, both `backlog` at `0cf643f`); this document
   records the class, not the fixes.
6. **Re-measure before acting.** Every figure here is pinned to `main` at `0cf643f` on 2026-09-21 and
   will drift — in particular the runner image's tool versions, which `actions/runner-images` moves
   without notice. The commands are inline in **E1**–**E7**.

### Open questions for the approver

- **Q1 — one decision or two?** Argued above; genuinely open because of the `adr-009` governance cost.
- **Q2 — does a mismatch become a gate failure, a warning, or nothing?** The table under *What
  ratification would require* enumerates the answers; the approver picks one.
- **Q3 — which npm is canonical, CI's 10.9.x or the lockfile's 11.x?** Today those are contradictory
  (**E1**, **E5**), and `bug-056`'s fix determines the answer. Until it lands, "align local to CI" is
  unadoptable.
- **Q4 — if the trigger changes, does `adr-009` get amended, or does a separate CI workflow sit beside
  the publish one?** The second needs no ADR change.
- **Q5 — is git declared at all, and if so how?** No npm-side field can (**E6**); the only instruments
  are a container (E) or a runner (D).
- **Q6 — does `bug-060` belong to this class?** This document says no, and says why; the approver may
  disagree.

## Relations

- **Instances (cited, not amended):** `bug-056-npm-ci-fails-under-pinned-npm-10-9` (`planned`, high)
  — **E5**, extended here by the 10.9.8 measurement that narrows its fix space;
  `bug-057-timestamp-assertions-reject-zulu-offset` (`planned`, high) — **E6**.
- **Source of the evidence:** `task-077-first-real-staging-run` (`done`), whose approve commit
  `ac10060` scheduled all six findings; `task-080-fix-npm-ci-under-pinned-npm` and
  `task-081-fix-timestamp-offset-assertions` (both `backlog`) carry the fixes.
- **Adjacent, deliberately not merged:** `bug-060-act-recipe-unusable-from-git-worktree` (`open`) —
  environment divergence in the opposite direction; `bug-048-ci-node-version-fails-eslint-engines`
  (`open`) — the earlier, low-severity symptom of the same undeclared-toolchain class, which `engines`
  already reports and nobody acts on (**E2**); `dl-069-lockfile-drift-unguarded` (`in-discussion`) —
  owns the *structural* lockfile decision `bug-056` instantiates, which this document does not
  re-open.
- **Constrains and is constrained by:** `adr-009-npm-publishing-pipeline` (`accepted`) — its decision
  1 fixes the tag-only trigger; `adr-010-node-22-runtime-floor` (`accepted`) — the Node 22.12+ floor
  that makes npm 11 unreachable through the Node pin (**E1**); `spec-015-packaging-publishing`
  (`approved`) — its §3 stage 1 is the gate whose first step fails.
- **Pipeline decisions this sits beside, without overlapping:** `dl-056-first-real-publishing-run`
  (`ready`) — who runs the pipeline first; `dl-057-publish-pipeline-hardening` (`ready`) — its item
  (e) touches "whether the Node pin can move", the nearest existing hook to **E1**, but neither
  document addresses the trigger or the developer-side toolchain.
- **Citation convention:** written under `dl-075-no-bare-line-offsets-in-memory` (`ready`) — durable
  citations above name a symbol, a YAML key path, a heading or a verbatim quotation plus the commit
  read at (`0cf643f`); the only bare offsets that appear are inside quoted `grep` output.
- **Traceability:** REQ-SYS-09 (the declared runtime floor — the existing machine-checkable promise
  about the environment artifacts *run* in; this class concerns the environment they are *built* in),
  REQ-SYS-07 (determinism — adjacent, see Rationale), REQ-INT-04 and REQ-INT-05 (the CLI contracts the
  gate's `prepublishOnly` exercises), P5.1.
