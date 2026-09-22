---
id: "release-publishing-rel-v0.2-plan"
type: plan
title: "Release-publishing — v0.2 (the first real publish: sweep, amend, bump, push, rehearse, tag, promote, mark released)"
status: active
version: "1.0"
workflow: "release-publishing"
phase: "rel-v0.2"
element: "minor-v0.2"
release: "v0.2"
tmpl_version: 260703
---

## Context

This plan executes the **`release-publishing`** sub-workflow
(`docs/self/.wingfoil/workflows/custom/release-publishing.yaml`, `version: 1.0`, `element: release`)
against **`minor-v0.2`**. In `release-cycle.yaml` (`version: 1.1`) it is the `publishing` phase,
after `submit` and before `retrospective`. Its three declared phases are `tag`, `publish`,
`mark-released`.

**This is the first release WingFoil actually publishes.** `dl-018-release-publishing-strategy`
records that v0.1 was a paper release and `release-publishing` was skipped entirely, so nothing in
this repository's history is a precedent for the steps below. The architecture is `adr-009`
(`accepted`: GitHub Actions CI/CD, ephemeral Verdaccio staging driven by a local-first script,
promotion with npm provenance/OIDC, secrets only in the CI store); the file-level contract is
`spec-015-packaging-publishing` (`approved`); the pipeline is `.github/workflows/publish.yml`.

**Two acts in this plan cannot be undone.** Pushing a `vX.Y.Z` tag starts the publish pipeline, and
a published npm version is effectively permanent — `spec-015` §5's rollback posture is "prefer
`npm deprecate` + a follow-up patch over `npm unpublish` (restricted)". Both acts, and the
environment approval between them, are **Roberto's personally**; each step below says so at the
step, not only here.

Per CLAUDE.md §6 there is no workflow engine, so this document is the coherent plan §6/§10.7 require,
and it is itself a `plan` Memory element (`dl-019`).

### Two ratified decision-logs owe work to *this document*

- **`dl-074-tag-must-be-on-pushed-main` (`ready`), ratified as (a) + (b).** `publish.yml`'s first
  gate step asserts `git merge-base --is-ancestor "$GITHUB_SHA" origin/main` — ancestry of the
  **pushed** `main` — while `spec-015` §4 and `dl-024` say only "on `main`". (a) owes an amendment to
  `spec-015` §4; (b) owes an executable push step in this plan. **Both are discharged here**: (a) as
  Step 2, (b) as Step 5.
- **`dl-068-publishing-requires-public-repository` (`ready`), ratified as (a).** Its outstanding
  action is a **secret sweep before the push**, because the push makes history public in one step and
  `bug-055` records that the secret scanner's own AWS fixture already tripped GitHub push protection
  once, requiring a standing allow-secret exception. **Discharged as Step 1.**

### The session executing this plan is assumed to know nothing beyond `CLAUDE.md`

Read §7 (Conventions a fresh session will not know) **before** running any step.

---

## 1. Preconditions — verify first, stop on any failure

Every row is a command. Values in the last column were read at `main` `a2e3586` (2026-09-22) and are
**a record of what the command returned then, not a claim this plan makes** — re-run every one.
**If any row fails, stop and report. Do not work around a failing precondition in this phase.**

| # | Condition | Command | Read at `a2e3586` |
|---|---|---|---|
| P1 | `release-submit` completed: the release element is `releasing` | `awk '/^status:/{print $2; exit}' docs/self/docs/04_memory/planning/rl-v1/minor-v0.2.md` | `in-development` — **`release-submit` had not run yet** |
| P2 | The approver authorised `approve-release` | the approver says so, in this conversation | — |
| P3 | On `main`, clean tree | `git rev-parse --abbrev-ref HEAD; git status --porcelain` | `main`; empty |
| P4 | **`main` is pushed** (`dl-074`) | `git fetch origin; git rev-list --count origin/main..main` | `0` |
| P5 | No release tag exists yet, locally or on the remote | `git tag -l; git ls-remote --tags origin` | both empty |
| P6 | The package name is still free — i.e. nothing has been published | `npm view wingfoil version` | `npm error 404 Not Found` (the `E404` line is the load-bearing output) |
| P7 | The repository is public (`dl-068`) | `gh api repos/robypomper/wingfoil --jq '{private,visibility}'` | `{"private":false,"visibility":"public"}` |
| P8 | The `npm-publish` environment is armed (§6) | `gh api repos/robypomper/wingfoil/environments` | `required_reviewers` (robypomper) + `branch_policy`; `can_admins_bypass: true` |
| P9 | The deployment tag policy is `v*` (`dl-068` Action 6) | `gh api repos/robypomper/wingfoil/environments/npm-publish/deployment-branch-policies` | one policy, `{"name":"v*","type":"tag"}` |
| P10 | `NPM_TOKEN` exists as an **environment** secret, not a repository secret | `gh api repos/robypomper/wingfoil/environments/npm-publish/secrets`; `gh api repos/robypomper/wingfoil/actions/secrets` | env: `NPM_TOKEN` (updated 2026-09-21); repo: `total_count: 0` |
| P11 | `node_modules` matches the lockfile | `npm ci` | exit 0 |
| P12 | The `@emnapi` lockfile entries survive (`bug-063`, §7.5) | `node -e "const l=require('./package-lock.json');for(const k of ['node_modules/@emnapi/core','node_modules/@emnapi/runtime'])console.log(k,l.packages[k]?l.packages[k].version:'ABSENT')"` | both `1.11.3` |
| P13 | The lockfile peer guard is green | `npx jest test/cli/lockfile-peer-overrides.test.ts` | (run it) |
| P14 | The six gates are green (§6) | see §6 | 109 suites / 1754 tests, exit 0; coverage 98.59 / 92.97 / 98.80 / 99.18 |
| P15 | `publish.yml` triggers on nothing but a version tag (§5.1) | `grep -n -A3 '^on:' .github/workflows/publish.yml; ls -1 .github/workflows/` | `push.tags: ['v[0-9]+.[0-9]+.[0-9]+']`; one workflow file |

**P1 is the one that was false when this plan was written.** This plan does not start until
`release-submit-rel-v0.2-plan` has completed and the approver has authorised it.

**P6 deserves a moment.** If `npm view wingfoil version` ever returns a version instead of a 404,
something has already been published. Stop immediately and report — do not attempt to publish over
it, and do not attempt to unpublish.

---

## 2. Step 1 — the secret sweep (`dl-068`), before anything is pushed

- **Role:** `qa` (agents may execute as `qa`); directive `security-secrets` (global, all roles)
- **Action:** run this repository's own scanner over the tree that is about to become public
- **Produces:** the sweep's output, reported to the approver. No file change.
- **Settled by:** the command below, plus the approver's reading of it

`dl-068`'s approve `Reason:` (commit `22f4ca0`) states the action plainly: "the document's own cost
paragraph asks for a secret sweep before the first push, while the repository is still cheap to
inspect. `bug-055` is the known instance".

Run the project's own `spec-007` scanner over tracked files:

```sh
npm run build
node -e '
  const { scanText } = require("./dist/validation/secret-scan.js");
  const { execSync } = require("node:child_process");
  const { readFileSync } = require("node:fs");
  const files = execSync("git ls-files", { encoding: "utf-8" }).split("\n").filter(Boolean);
  let total = 0;
  for (const f of files) {
    let text; try { text = readFileSync(f, "utf-8"); } catch { continue; }
    const r = scanText(text, f);
    if (r.blocking.length) { total += r.blocking.length;
      console.log(f, r.blocking.map((x) => x.patternId + "@" + x.line).join(" ")); }
  }
  console.log("blocking findings:", total);
'
```

**What a clean result looks like, and what it will actually look like.** It will **not** be zero.
`bug-055` (`open`, medium) measured that `test/validation/secret-scan.test.ts` alone produces **24
blocking findings** — the scanner's own fixtures, which are secret-*shaped* by construction, since
their job is to prove each pattern matches. GitHub's push protection flagged one of them (the
40-character AWS-shaped literal) and rejected this repository's first push with `GH013`; the approver
cleared it through GitHub's allow-secret URL, so a **standing allowlist exception now exists on the
repository**.

So the sweep's purpose is not "expect zero". It is: **every finding must be accounted for as a
fixture, by name, before the push** — and anything that is *not* a known fixture stops the phase.
Report the file list and the per-file counts; `test/validation/secret-scan.test.ts` is expected,
anything else is not.

`dl-073-scan-surface-vs-publication-boundary` is the open question about what the scanner covers
versus what publication exposes; it is not resolved here and does not block, but say in the report
that the sweep is a one-shot manual run, not a gate anything enforces.

**If push protection rejects the push at Step 5 anyway:** stop. Clearing a push-protection block is a
GitHub-side action taken by the repository owner through GitHub's own UI. An agent does not click
that link.

---

## 3. Step 2 — amend `spec-015` §4 (`dl-074` (a))

- **Role:** `architect` (agents may execute as `architect`); directives `architecture`,
  `determinism`, `traceability`, plus the global `doc-versioning`, `documentation`
- **Action:** an **in-place dated Revision note** on an `approved` tech-spec — no supersede, no state
  change, no `version:` bump
- **Produces:** an edit to
  `docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md`
- **Settled by:** `grep -n "pushed" docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md`
  returning the new §4 sentence, and `awk '/^status:/{print $2; exit}'` on that file still returning
  `approved`

### 3.1 What to change

`spec-015` §4's tag bullet currently reads, quoted verbatim:

> - The publish trigger is an annotated git tag `vX.Y.Z` created **on `main`** after the release
>   branch merges (`dl-024`; never on a `design/*` branch). Tag ↔ `package.json` `version` must match
>   (CI asserts this before promote).

It must additionally state that **`main` must be pushed to `origin` before the tag is pushed**,
because `publish.yml`'s gate asserts ancestry of `origin/main`, not of anyone's local `main`. The
gate step, quoted verbatim from `.github/workflows/publish.yml`'s `gate` job, step "Tag commit is on
main (dl-024)":

```
          git fetch --no-tags origin main
          git merge-base --is-ancestor "$GITHUB_SHA" origin/main
```

### 3.2 How to write it — the route is established, follow it

`dl-047-tech-specs-carry-no-version-field` governs: an `approved` tech-spec is amended **in place**,
with a dated Revision note appended to the document, `status: approved` unchanged and **no `version:`
bump** (tech-specs carry no `version:` field). This exact document has taken that route three times
— read one before writing yours:

| Note heading in `spec-015` | Commit |
|---|---|
| *Revision (2026-09-21) — §3 stage 2* | `b92959b docs(self): task-079-… — amend spec-015 §3 stage 2 (dl-052) and §1's settled Node caveat (adr-010)` |
| *Revision (2026-09-22) — §3 stage 1* | `148cb4c docs(self): task-084 — spec-015 §3: drop the two repaired stage-1 claims, keep the SIGINT bound citing bug-059, add the dated Revision note` |
| *Revision (2026-09-22) — §3 interrupt teardown* | `7cf21be docs(self): task-085 — spec-015 §3: re-tense the SIGINT teardown gap into history, add the dated Revision note` |

The shape those three share, and yours must too:

1. A bolded heading of the form **`Revision (YYYY-MM-DD) — §4: <one sentence saying what changed and
   why>, per dl-074-tag-must-be-on-pushed-main.`**
2. The **superseded wording quoted in full**, so a later reader can see what the document used to
   say. Never silently replace a sentence.
3. The **evidence**, cited per `dl-075` (§7.2): name the workflow file's job and step and quote the
   two lines, rather than giving a line offset. Pin the commit you read them at.
4. A closing paragraph stating the mechanics: *"Edited in place — no supersede, no state change, and
   no `version:` bump because tech-specs carry no `version:` field (`dl-047`) — per the `dl-041` /
   `task-059` / `task-074` / `task-084` / `task-085` precedent."*

**`dl-074` Action 3** asks whether the sentence is mirrored into `dl-024-git-branch-tag-conventions`
decision 2 or whether `spec-015` owns it alone. **That is the approver's call** (`dl-074` names the
owner as "approver") — ask, and do whichever he says. Do not mirror it unbidden: `dl-024` is `ready`,
and editing a ratified decision-log without instruction is exactly the kind of unilateral change the
approval model exists to prevent.

### 3.3 The commit

An edit to a spec with no state change is **not** a Memory state-transition commit and must not use
the `wf(...)` form. Follow the precedent above:

```
docs(self): spec-015 §4 — state that main must be pushed to origin before the tag (dl-074 (a))

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## 4. Step 3 — bump `package.json` to the release version

- **Role:** `developer`; directives `code-quality`, `testing`, `determinism`
- **Action:** hand-edit the version in `package.json` and `package-lock.json`
- **Produces:** `package.json`, `package-lock.json`
- **Settled by:** `node scripts/check-release-tag.cjs v0.2.0` printing
  `tag v0.2.0 matches package.json version 0.2.0` and exiting 0

### 4.1 Why this step exists at all

`publish.yml`'s gate runs `node scripts/check-release-tag.cjs "$GITHUB_REF_NAME"`, and
`checkReleaseTag` in that file refuses the tag unless `tag === "v" + version`. Read at `a2e3586`:

```sh
node -p "require('./package.json').version"          # -> 0.1.0
node -p "require('./package-lock.json').version"     # -> 0.1.0
node -p "require('./package-lock.json').packages[''].version"   # -> 0.1.0
```

`spec-015` §4 says "v0.2 publishes `0.2.z`". **A `v0.2.0` tag against a `0.1.0` manifest fails the
gate** — fail-closed, nothing published, but it burns a tag, and a tag pushed by mistake is the one
thing in this phase that is awkward to take back. So the bump happens here, on `main`, **before** the
tag exists.

The exact version is the approver's to fix (`0.2.0` unless he says otherwise). Everything below
assumes `0.2.0`; substitute whatever he names.

### 4.2 How to bump it — by hand, not with `npm version`

Edit three fields by hand: `package.json`'s `version`, and `package-lock.json`'s top-level `version`
and `packages[""].version`. Then:

```sh
npm ci                                   # never a bare `npm install` — see §7.5
node -e "const l=require('./package-lock.json');for(const k of ['node_modules/@emnapi/core','node_modules/@emnapi/runtime'])console.log(k,l.packages[k]?l.packages[k].version:'ABSENT')"
npx jest test/cli/lockfile-peer-overrides.test.ts
```

**Both `@emnapi` entries must still read `1.11.3` and the guard must be green.** `bug-063` (`open`,
medium) measured that a plain `npm install` under npm 11.x silently removes those two hoisted
entries — reporting `up to date` while doing it — and the npm that `publish.yml` pins (10.9.0,
bundled with the pinned Node 22.12.0) then refuses the lock, which is the failure `bug-056` was and
`task-080` fixed. Anything that rewrites the lockfile is suspect, **`npm version` included**: it
rewrites `package-lock.json`, and it creates a commit and a tag by default. Do not use it here. If
you use it anyway (`npm version --no-git-tag-version`), re-run the two commands above immediately and
treat an `ABSENT` as a stop.

Then re-run the six gates (§6) — the bump changes the manifest `test/cli/publish-metadata.test.ts`
reads.

Commit:

```
chore(release): bump version to 0.2.0 for the v0.2.0 tag (spec-015 §4)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## 5. Step 4 — merge the phase branch into `main` (`dl-024`)

- **Role:** `developer`
- **Action:** `git merge --ff=false` of `design/release_publishing_v0.2` into `main`
- **Produces:** one merge commit on `main`
- **Settled by:** `git log --oneline --merges -1` showing the merge, and
  `git merge-base --is-ancestor <phase-branch> main` exiting 0

`dl-024` decision 2: the version tag is created on `main` **after** the release's final branch has
merged — never on the phase branch, because a tag on a branch that is later deleted either dangles or
must be recreated. `dl-035`: **merge, never rebase** — a branch carrying `wf(*)` commits must never
be rebased (§7.3).

---

## 6. The six gates

The standing `dev-loop` `refactor` gates, referred to across v0.2's Execution Notes as "the six
gates" (e.g. `task-087`'s `refactor` gate table). Run all six after Step 3 and again immediately
before Step 7 — `main` moves, and a green run from an hour ago describes a tree that may not exist.

| # | Gate | Command | Passes when |
|---|---|---|---|
| G1 | Unit + integration suite | `npx jest` | exit 0 |
| G2 | Coverage ≥ 80 | `npx jest --coverage` | exit 0 (`jest.config`'s `coverageThreshold.global`) |
| G3 | Build typecheck | `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| G4 | Full typecheck, test sources included (`dl-044`) | `npx tsc --noEmit -p tsconfig.json` | exit 0, no output at all |
| G5 | Lint (`dl-034`) | `npm run lint` | exit 0 |
| G6 | API docs | `npm run docs:api` | exit 0 |

Run G1 and G2 as one `npx jest --coverage`. At `a2e3586` that run was **109 suites / 1754 tests,
exit 0**, coverage **98.59 / 92.97 / 98.80 / 99.18**.

`prepublishOnly` — which CI's gate job runs — is `npm run build && npm test && npm run lint`, i.e.
G1 + G5 plus a build. Running the six gates locally therefore covers the CI gate and more.

### 6.1 What `publish.yml` triggers on

Quoted verbatim from `.github/workflows/publish.yml`:

```yaml
on:
  push:
    tags: ['v[0-9]+.[0-9]+.[0-9]+']
```

**That is the only trigger.** No `workflow_dispatch`, no `push.branches`, no `pull_request`, no
`schedule`. And it is the only workflow in the repository (`ls -1 .github/workflows/` → one file at
`a2e3586`). Two consequences a fresh session must hold onto:

- **Nothing in CI runs on a push to `main`.** Step 5's push is safe in the sense that it starts no
  pipeline — but it is also unverified by CI, which is why §6's gates are run locally first.
- **The publish pipeline can only be started by creating and pushing a matching tag.** There is no
  "run it and see" button. `promote`'s `if: ${{ !env.ACT }}` means a local `act` run cannot publish,
  and `act` has no OIDC issuer, so provenance is only ever exercised by a real tag push.

---

## 7. Conventions a fresh session will not know

### 7.1 Memory commit format (CLAUDE.md §5.1)

One operation, one commit, one element type, nothing else in the commit. Subject
`wf({type}): {add|submit|approve|reject|deprecate} {id1}, {id2}`. `approve`/`reject`/`deprecate`
carry a body; `add`/`submit` do not. `Approver:` is `Name <email> (role)`. The `Reason:` block runs
to the end of the body (or to the trailing trailer paragraph), may span lines, may **never** be
blank, may never contain a line beginning `Approver:` or `Reason:`, and may not end with a paragraph
made entirely of `Key: value` lines. Read §5.1 in full before writing any such commit.

Edits that are not Memory state transitions — Step 2's spec amendment, Step 3's bump — use ordinary
conventional-commit subjects (`docs(self):`, `chore(release):`), never `wf(...)`.

### 7.2 Durable citations (`dl-075`, ratified as (A) composed with (B))

A citation names something the file **carries** — an exported symbol, a heading, a YAML key path, or
a verbatim quotation — and pins the commit it was read at when the claim concerns something that may
legitimately move. **Bare `path:line` offsets are not acceptable in durable prose**; they stay legal
in Execution Notes, bug Steps-to-Reproduce and triage notes. Disposition of existing citations:
**fix-on-touch**. Step 2's Revision note must follow this — it is a durable amendment to an approved
spec, and `dl-075`'s own evidence is that a spec corrected from a stale offset is how `spec-015` went
wrong in the first place.

### 7.3 Merge, never rebase (`dl-035`, `dl-014` G3, `dl-024`)

Never rebase a branch carrying `wf(*)` commits — it destroys the audit records P1.2/P1.7/P1.10 depend
on. Bring `main` in with `git merge --no-edit main`; merge out with `--ff=false`. Phase work runs on
`design/<phase>_<version>` — here, `design/release_publishing_v0.2`.

### 7.4 Agents hold no approval authority, and this phase has three acts beyond their role

CLAUDE.md §4/§8; `dna.yaml` `team.agents[0].approval_authority: false` and
`executes_as: [ developer, reviewer, qa, architect ]`. **Every phase of `release-publishing.yaml`
declares `role: tech-lead`, which is not in that list** — so the whole phase runs under Roberto's
explicit instruction, step by step. Specifically, an agent must **never**, on its own initiative:

- create a git tag, or push one;
- publish to any registry;
- approve the `npm-publish` environment deployment;
- click through a GitHub push-protection or allow-secret link;
- handle, read, or echo `NPM_TOKEN`.

### 7.5 `npm ci` after any dependency change — and never a bare `npm install`

After merging anything that touches `package.json` or `package-lock.json`, run **`npm ci`** before
the gates. A stale `node_modules` fails `test/cli/types-node-floor.test.ts`, which asserts that the
**installed** `@types/node` major equals the major of `engines.node`'s floor — it reads the tree, not
the manifest.

**Never run a bare `npm install` before tagging.** `bug-063`: under npm 11.x it silently deletes the
hoisted `@emnapi/core` and `@emnapi/runtime` lock entries that make `npm ci` work under the npm CI
uses, and reports `up to date` while doing it. `npm ci` never rewrites a lockfile, which is why it is
the safe command. Before the tag, verify — with commands, in the report — that both entries are
present at `1.11.3` **and** that `test/cli/lockfile-peer-overrides.test.ts` is green (§1 P12/P13,
§4.2).

### 7.6 The evidence rule (the top rejection cause in this release)

**Never assert a file's state without running the command that settles it, and put the command in the
note.** Claims that a file was done, undone, covered or unchanged, asserted without opening it, were
the largest single source of review rejections in v0.2. In a phase where the cost of a wrong belief is
a public artefact, this is the rule that matters most: report commands and their output, never
conclusions.

---

## 8. Step 5 — push `main` to `origin` (`dl-074` (b))

- **Role:** `tech-lead` → **Roberto's instruction required** (§7.4)
- **Action:** `git push origin main`
- **Produces:** `origin/main` equal to local `main`
- **Settled by:** `git fetch origin && git rev-list --count origin/main..main` → **`0`**

**Measure the gap first. Do not take a number from any document — including this one.**

```sh
git fetch origin
git rev-list --count origin/main..main
git rev-parse origin/main main
```

`dl-074`'s Action 4 is explicit: "Re-measure E1 before tagging, not from this document. The number
here is pinned to `b505473` on 2026-09-21 and will be wrong by the time anyone acts on it; the
command is `git rev-list --count origin/main..main`, and the precondition is that it reads `0`."

That advice is load-bearing, because the number has moved every time anyone has looked: **4** during
`task-077`'s run, **9** at review, **83** at `dl-074`'s ingest, "over one hundred and twenty" in
`dl-074`'s own approve `Reason:` (`a2e3586`), and **0** when this plan was written — `origin/main`
and `main` were both `a2e3586`, verified independently with `git ls-remote origin main` and
`gh api repos/robypomper/wingfoil/commits/main --jq .sha`. Note what that last value means: **the
history has since been pushed**, so `dl-068` Action 3's "the remote is empty" bootstrap is already
discharged and this step is now the ordinary "keep `main` current" case `dl-074` is about. The number
will be non-zero again as soon as any of v0.2's remaining phase plans merge — including this one.

**Step 1's secret sweep must be complete and reported before this push.**

Why the precondition exists, in one line: `publish.yml`'s gate asserts ancestry of `origin/main`, and
`git merge-base --is-ancestor` fails with a **bare exit 1 and no output**, so the remedy is invisible
from the error. Fail-closed, but at the worst possible moment.

---

## 9. Step 6 — the staging rehearsal (`dl-056`), before any tag

- **Role:** `qa` (the run itself is executable by an agent under instruction; it publishes only to a
  localhost registry it starts and destroys)
- **Action:** `npm run publish:staging`
- **Produces:** a transcript, pasted into the report
- **Settled by:** exit 0 and the line `[publish:staging] staged wingfoil@<version> and smoke passed`

`dl-056-first-real-publishing-run` (`ready`) exists precisely because every registry-touching effect
in this pipeline was, until `task-077`, unexecuted: "the cheapest place to discover a wrong assumption
is a run nobody depends on". Its option A.1 is a pre-release staging dry run before
`release-publishing`, and this step is it.

### 9.1 What `npm run publish:staging` actually does

`package.json`'s `publish:staging` is `node scripts/publish-staging.cjs`. The script's own module
header lists seven stages, and `dl-052-verdaccio-started-by-staging-script-in-ci` (`ready`) ratified
that this is the same entry point CI's `stage` job invokes — there is no CI service container:

1. pack the package (or take `--tarball`, which CI passes);
2. install a major-pinned `verdaccio@6` (`VERDACCIO_PACKAGE`) into a throwaway per-run work dir
   (`mkdtempSync` under the system temp dir) and start it on `http://localhost:4873/`, with npm
   redirected into that work dir (`stagingEnv`) and inherited npm credentials stripped;
3. register a throwaway user, keeping its token in a work-dir `.npmrc` — never in the repo, never in
   `~`;
4. `npm publish <tarball>` to that registry, provenance explicitly off;
5. `npm install --global wingfoil@<version>` **from staging** into the work-dir prefix;
6. run the `dl-023` e2e smoke (`scripts/e2e-smoke.cjs`) against the `wingfoil` now on PATH;
7. tear down — token first, then the registry, then the work dir — on success, on failure, and on
   `SIGINT`/`SIGTERM`/`SIGHUP` (`TEARDOWN_SIGNALS`, `installTeardownHandlers`; `task-083` closed
   `bug-059`). `SIGKILL` is the one uncovered case; POSIX forbids catching it.

The registry gives the package under test **no `proxy:` uplink** (`verdaccioConfig`; only the `'**'`
catch-all proxies npmjs), which is what makes the smoke meaningful: a same-named `wingfoil` on npmjs
can never satisfy the install.

It needs network access (to fetch Verdaccio and to proxy dependencies) and it is POSIX-only.

### 9.2 What it costs

`task-077-first-real-staging-run` measured, on a developer machine:

```
$ date -Is; /usr/bin/time -f "WALL=%e s" npm run publish:staging; echo "REAL_EXIT=$?"
WALL=113.01 s
REAL_EXIT=0
```

**About two minutes on the host**; about **1m35s** as CI's `stage` step inside a container. Verdaccio
installs ~111 packages and takes ~22s of that. Budget five minutes and do not start it if you cannot
watch it.

### 9.3 What a clean run looks like

Exit 0, and at the end the `dl-023` smoke's **18 assertions all `ok`** across both scaffold templates
(Scrum and Kanban) — `--help`, `--version`, `init`, `dna show`, `dna set`, `memory add`,
`paths config`, `directives list`, `workflow list`, and "working tree clean after every mutation" —
closing with:

```
[publish:staging] staged wingfoil@<version> and smoke passed
```

Two things you will see that are **not** failures: Verdaccio emits ~170 `warn --- Password for user
"wingfoil-staging" took NNNms to verify` lines (noise, tracked as `bug-061`), and `npm pack` runs
`prepack → build` first, so a `tsc` run appears in the transcript.

**If it fails, the phase stops.** A failed staging run is exactly the signal `dl-056` wants before a
tag rather than after one.

### 9.4 Do not kill it when it goes quiet — `bug-067`

`bug-067` (`open`, medium): `run` in `scripts/publish-staging.cjs` executes every npm step through
`spawnSync`, which blocks the event loop for the child's whole lifetime, so a signal delivered **only
to the script** is queued and honoured when that step returns. Measured latencies: **44 seconds**
during `npm install --global`, and **7 seconds** in a second measurement. Teardown is correct when it
finally runs — `task-083` fixed that — but for those seconds the process looks hung.

**Do not escalate to `SIGKILL`.** `SIGKILL` cannot be caught, runs no teardown, and leaks exactly
what `bug-059` was filed about: an orphaned Verdaccio holding port 4873, a ~268 MB work dir, and a
**live registry auth token on disk**. An interactive `Ctrl-C` signals the whole process group, so the
npm child dies and the step returns in under a second — that is the safe way to stop it. Wait out a
single-process `kill -INT`.

### 9.5 `act` and worktrees — `bug-060`

`publish.yml`'s header offers an `act` recipe for exercising the pipeline locally. **It does not work
from a git worktree** (`bug-060`, `open`, low): a worktree's `.git` is a file naming a host path the
container does not have, so every git-dependent step dies with `fatal: not a git repository: (null)`.
`task-077` reproduced this and then ran the identical workflow from a throwaway **clone**, which
worked. If you rehearse with `act`, clone; do not use a worktree. And note what `act` cannot tell you
— §10.2.

---

## 10. Step 7 — `tag` (APPROVER ONLY)

- **Workflow phase:** `tag`; **role:** `tech-lead` → **Roberto personally**
- **Workflow `checks.pre`:** `["on-branch-is-main", "release-branch-merged-to-main"]` (`dl-024`)
- **Workflow actions:** `git.commit("release {release.version}")`,
  `git.tag("{release.version}", on: main)`
- **Produces:** an annotated tag `v0.2.0` on `main`, and — the moment it is pushed — a live GitHub
  Actions run
- **Settled by:** `git tag -l` and `git ls-remote --tags origin` showing the tag, and the workflow
  run appearing under `gh run list --workflow publish.yml`

### 10.1 An agent must never create or push this tag

This is the act that starts the publish. `release-publishing.yaml` gives the phase `role: tech-lead`,
which is outside the agent role set (§7.4), and `publish.yml`'s approver runbook step 4 states that
"the tag `vX.Y.Z` is pushed on `main`" is a human action by the `approver` role. An agent prepares
everything, verifies everything, and then **hands over**.

Immediately before the tag, re-verify, in this order, and put the outputs in the handover:

```sh
git rev-parse --abbrev-ref HEAD            # main
git status --porcelain                     # empty
git fetch origin && git rev-list --count origin/main..main    # 0   (dl-074)
node scripts/check-release-tag.cjs v0.2.0  # exit 0, versions match (spec-015 §4)
node -e "const l=require('./package-lock.json');for(const k of ['node_modules/@emnapi/core','node_modules/@emnapi/runtime'])console.log(k,l.packages[k]?l.packages[k].version:'ABSENT')"
npx jest test/cli/lockfile-peer-overrides.test.ts
npm view wingfoil version                  # still E404 — nothing published yet
```

The commands Roberto then runs himself:

```sh
git tag -a v0.2.0 -m "release v0.2.0"
git push origin v0.2.0
```

`spec-015` §4 says **annotated** (`-a`). `dl-057`'s open item (d) records the annotated-tag question
as one `task-077` was asked to settle; if it is still open when you reach this step, say so rather
than assuming.

### 10.2 The environment gate has never fired — plan for that

`dl-068` E6, from `task-077` finding F7: **`act` ignores a job's `environment:` key entirely.** In
`task-077`'s full local run, `promote` started straight after `stage`, unapproved — no reviewer
prompt, no wait. The key `act` ignores is the one every protection rule hangs off:

```sh
grep -n "environment:" .github/workflows/publish.yml    # promote's `environment: npm-publish`
```

So the required-reviewer rule — **the sole human control on publishing**, per `adr-006` and
`task-061`'s runbook — is armed on GitHub (verified: §1 P8/P9/P10) and **cannot be exercised
anywhere else**. The first real tag push is the first time it is ever tested, and that is the one run
where a failure is public.

`dl-068` Action 5 makes this an approver decision **taken beforehand**: decide who watches the run,
and what to do if `promote` proceeds without prompting. Note the failure mode of an ignored
`environment:` is **a publish, not a halt**. Also note `can_admins_bypass: true` and
`prevent_self_review: false` on this environment — Roberto can approve his own deployment, which is
the intended single-approver setup, but it means nothing external stops an accidental approval.

---

## 11. Step 8 — `publish` (the pipeline runs; APPROVER approves the gate)

- **Workflow phase:** `publish`; **role:** `tech-lead` → **Roberto personally**
- **Workflow action:** `agent.execute` — build + `npm publish`; in practice this is
  `publish.yml`'s three jobs
- **Workflow checks:** `pre: ["tests.passing"]`, `post: ["package published to npm registry"]`
- **Produces:** `wingfoil@0.2.0` on the public npm registry, with provenance
- **Settled by:** `npm view wingfoil version` returning the published version (§12)

The pipeline, as `publish.yml`'s header states it:

- **`gate`** — assert the tag is on `origin/main` and equals `v<package.json version>`, `npm ci`,
  `prepublishOnly` (build + test + lint), `npm publish --dry-run --ignore-scripts`, then
  `npm pack --ignore-scripts` **once** and upload the tarball as an artifact.
- **`stage`** — download that tarball and run `npm run publish:staging -- --tarball dist-pack/*.tgz`:
  the same script Step 6 rehearsed.
- **`promote`** — `environment: npm-publish`, `id-token: write`; waits for the required reviewer, then
  publishes **that same tarball** with `--provenance --access public` through a transient `.npmrc`.

`task-077` verified by SHA-256 across all three jobs that the tarball `promote` would publish is
byte-identical to the one `stage` smoked.

**Watch the run:** `gh run watch $(gh run list --workflow publish.yml -L1 --json databaseId --jq '.[0].databaseId')`.

**The approval itself is Roberto's, in GitHub's UI.** An agent does not approve a deployment, and
does not touch `NPM_TOKEN` (§7.4). If `promote` starts without waiting, that is the §10.2 scenario —
stop watching and tell him immediately; it means the gate did not fire.

**If `gate` or `stage` fails, nothing is published** — `needs: stage` means `promote` never runs.
That is a clean failure: fix, and cut a new tag. Do not force-push or move a tag that CI has already
seen.

---

## 12. Step 9 — verify the publish

- **Role:** `qa`
- **Produces:** the verification block in the report
- **Settled by:**

```sh
npm view wingfoil version        # the published version — no longer E404
npm view wingfoil dist-tags      # latest -> 0.2.0
npm view wingfoil repository homepage
```

And, in a throwaway directory outside this repository, the REQ-SYS-09 fit criterion itself:
`npm install -g wingfoil` then `wingfoil --help` (exit 0). Do this only after the publish has
completed.

Rollback posture, for the record and **not** to be exercised by an agent: `spec-015` §5 and
`publish.yml`'s runbook both say do **not** `npm unpublish`; use
`npm deprecate wingfoil@X.Y.Z "broken: <reason> — upgrade to X.Y.Z+1"`, run by the approver with his
own credentials, then ship a patch through the same tag flow.

---

## 13. Step 10 — `mark-released`

- **Workflow phase:** `mark-released`; **role:** `tech-lead` → **Roberto's instruction required**
- **Workflow action:** `element.set_state(released)` — release: `releasing → released`
- **Produces:** one commit changing exactly one line of
  `docs/self/docs/04_memory/planning/rl-v1/minor-v0.2.md`
- **Settled by:** `awk '/^status:/{print $2; exit}' docs/self/docs/04_memory/planning/rl-v1/minor-v0.2.md`
  → `released`

**This is a `waiting` edge, exactly like `enter-releasing`.** `memory.yaml`'s `release` machine
declares `waiting: [ planning, in-development, releasing ]`, so `releasing` too has a forward edge
with **no CLI verb**; it fires only via the workflow action. The `release-submit` plan's §3.1 carries
the probe that demonstrates this against the shipped engine (`resolveTransitionTarget` in
`src/memory/state-machine.ts`) — re-run it with `'releasing'` in place of `'in-development'` if you
want to see it yourself; at `a2e3586` all of `submit`, `approve` and `reject` were refused from
`releasing`, and only `deprecate` was legal.

Edit **only** the `status:` field. Recommended subject, following the same reasoning as the
`release-submit` plan's §3.2 (name the workflow action or phase, never a reserved CLI verb, and
always carry the bracket):

```
wf(release): mark-released minor-v0.2 [releasing → released]

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

**Check `dl-079` first.** `dl-079-wf-commit-verbs-outside-the-declared-grammar` (`in-discussion` when
this plan was written) is the open decision about verbs §5.1 does not define — `sync`, `start`,
`finalize` — and the subject recommended here is one of the same family. Read its state
(`awk '/^status:/{print $2; exit}' docs/self/docs/04_memory/design/dls/dl-079-*.md`) before
committing; if it has been ratified as its option (B) — correct the practice back to the declared
five — express this edge the way (B) prescribes and say so in the report.

**Do not copy v0.1's `5b16ab6 wf(release): approve minor-v0.1 [releasing → released]`.** v0.1 skipped
`release-publishing` entirely (`dl-018`), so its `release-submit` approval commit absorbed this
phase's state change under an `approve` subject the shipped engine refuses from `releasing`. v0.2 is
the first release where the two are distinct. The word is the approver's to confirm (§14).

---

## 14. Handoff

**The agent may do, under instruction:** §1 (all preconditions), Step 1 (secret sweep), Step 2
(`spec-015` amendment), Step 3 (version bump), Step 4 (merge), Step 6 (staging rehearsal), Step 9
(verification), and every re-measurement the plan asks for. It reports after each and stops.

**Roberto does, personally — no agent, no exception:**

| # | Act | Why it is his |
|---|---|---|
| 1 | Authorise the phase to start (`approve-release` from `release-submit`) | approval authority (CLAUDE.md §4/§8) |
| 2 | Decide the release version (`0.2.0` unless he says otherwise) | §4.1 |
| 3 | Decide `dl-074` Action 3 — whether the pushed-`main` sentence is mirrored into `dl-024` or owned by `spec-015` alone | §3.2; `dl-074` names the owner as approver |
| 4 | Read the secret sweep and accept it, or clear a push-protection block in GitHub's UI | §2; `bug-055` |
| 5 | `git push origin main` | §8; irreversible in the sense that history becomes public |
| 6 | Decide `dl-068` Action 5 before the tag — who watches the run, and what happens if `promote` proceeds without prompting | §10.2 |
| 7 | **Create and push the tag** | §10 — the act that starts the publish |
| 8 | **Approve the `npm-publish` environment deployment** | §11 — the sole human control on publishing |
| 9 | Provide/rotate `NPM_TOKEN`, and any `npm deprecate` if rollback is needed | `spec-015` §5, `adr-009` §5 |
| 10 | Confirm the two verb-less-edge commit subjects (`enter-releasing`, `mark-released`) | §13; no document fixes them |
| 11 | Instruct Step 10 (`mark-released`) | `tech-lead` role, outside the agent role set |

**Completion criteria:** `wingfoil@0.2.0` visible on the public registry with provenance;
`npm install -g wingfoil` + `wingfoil --help` exit 0 from a clean directory; the tag present on
`origin`; `minor-v0.2` at `status: released` in exactly one commit. The next phase is
`retrospective`.

---

## 15. Known hazards

- **H1 — the tag is the point of no return.** Everything before it is reversible; the tag starts a
  pipeline whose last job publishes. Never create one to "see what happens", and never move or
  re-push a tag CI has already seen.
- **H2 — the environment gate is untested (§10.2).** `act` ignores `environment:`. The failure mode
  of an ignored gate is a publish, not a halt.
- **H3 — `bug-063`: a bare `npm install` erases the `@emnapi` lock entries** and reports `up to
  date`. Never run one before tagging; verify both entries and
  `test/cli/lockfile-peer-overrides.test.ts` (§7.5, §4.2, §10.1).
- **H4 — `bug-067`: `publish:staging` goes silent for tens of seconds** during a blocking npm step.
  Do not `kill -9`; that leaks a live token, an orphan registry on :4873, and ~268 MB (§9.4).
- **H5 — `bug-055`: the secret sweep will not return zero.** 24 findings come from the scanner's own
  fixtures. Account for each by name; anything unaccounted stops the phase (§2).
- **H6 — `bug-060`: `act` cannot run from a worktree.** Clone if you rehearse the workflow (§9.5).
- **H7 — the manifest version is a gate, not a formality.** `v0.2.0` against `0.1.0` fails
  `check-release-tag.cjs` and burns a tag (§4.1).
- **H8 — `main` moves.** Re-measure `git rev-list --count origin/main..main` and re-run the six gates
  immediately before the tag. Every number in this document is a record of a past reading, not a
  claim about now.
- **H9 — action pins are documentation, not a checked claim.** `publish.yml`'s header says so in as
  many words: nothing in this repository enforces the pinned `uses:` SHAs or their trailing version
  comments, and Dependabot is not configured. Do not update an action as part of this phase.
- **H10 — `dl-068` E5's three vendor-policy premises remain unverified** (provenance requiring a
  public repository; Environments protection on private repositories; npm granular tokens selecting
  only existing packages). `dl-068` Action 4 asks that they be confirmed against vendor documentation
  before the first publish and the outcome recorded there. That is outstanding.
- **H11 — the first publish needs a broader token than the steady state.** `dl-068` records that npm
  granular tokens can only select packages that already exist, so the **first** publish needs an
  all-packages-write token with the shortest practical expiry, replaced immediately afterwards by a
  `wingfoil`-scoped one. That is `NPM_TOKEN`'s owner's business, not an agent's.

---

## Approver decisions of 2026-09-22 — recorded here because this plan is executed by a later session

Given in chat and binding on this phase:

- **The release version is `0.2.0`.** `package.json` still reads `0.1.0`, and
  `scripts/check-release-tag.cjs` refuses any tag that is not exactly `v` + that value — so the bump
  is a precondition of the tag, not a tidy-up after it. Edit the manifest **by hand**; never
  `npm version`, which rewrites the lockfile and would drop `task-080`'s hoisted `@emnapi` entries
  (`bug-063`).
- **Open bugs carrying no `release` are authorised to the next release.** The `pre-release-checks`
  reading of "no open bug" is satisfied by *v0.2-scheduled* bugs being closed, which they are; the
  44 unscheduled ones do not block this release. Do not re-litigate that here.
- **The subject line for the two verb-less edges is accepted as proposed**: `wf(release):
  enter-releasing minor-v0.2 [in-development → releasing]` and `wf(release): mark-released
  minor-v0.2 [releasing → released]`, following the `wf(task): start` / `finalize` and `wf(bug):
  sync` practice. Note this is the very practice `dl-079` (`in-discussion`) asks whether to ratify or
  correct; check that document's state before committing, and if it has since been ratified the
  other way, follow the ratification rather than this note.

Unchanged and still the approver's, to be performed personally and never by an agent: pushing `main`,
creating and pushing the tag, approving the `npm-publish` deployment, supplying or rotating
`NPM_TOKEN`, and instructing both `enter-releasing` and `mark-released`.
