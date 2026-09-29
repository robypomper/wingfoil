---
id: release-publishing-rel-v0.2.2-plan
type: plan
title: "Release-publishing — v0.2.2 (bump, rehearse, tag, stage on npm, approve, mark released)"
status: active
version: "1.3"
workflow: "release-publishing"
phase: "rel-v0.2.2"
element: "patch-v0.2.2"
release: "v0.2.2"
tmpl_version: 260703
---

## Context

`patch-v0.2.2` (`docs/04_memory/planning/rl-v1/patch-v0.2.2.md`) is `releasing`. The approver gave
`approve-release` on 2026-09-29 (`release-submit-rel-v0.2.2-plan` `done`, finalize `57859640`, merged
`e5bc1831`, pushed). Per `release-cycle.yaml` and `dl-092` Q2 (ii) the next and last phase for a
patch is **`publishing`** (`include: release-publishing`); there is no retrospective. This plan is its
execution scaffold (`dl-019`).

The contract is `.wingfoil/workflows/custom/release-publishing.yaml` **v1.1**, `element: release`:

| Phase | Role | Declared | This plan |
|---|---|---|---|
| `tag` | `tech-lead` | `checks.pre: [on-branch-is-main, release-branch-merged-to-main]` (`dl-024`); `git.commit("release {release.version}")`; `git.tag("{release.version}", on: main)` | S2–S4 prepare the release commit (agent); **S5 the tag — approver** |
| `publish` | `tech-lead` | push the tag → `publish.yml` gate → stage → promote (`npm stage publish`, OIDC, no token); report the stage id; `approver.execute("npm stage approve <stage-id>")`; `checks.pre: [tests.passing]`, `checks.post: ["staged version approved on npm and live on the npm registry"]`; `approval: { by_role: approver }` | S6 (approver acts, agent watches and reports), S7 verify (agent) |
| `mark-released` | `tech-lead` | `element.set_state(released)` | S9 — on the approver's instruction |

**What is new against v0.2's run** (`release-publishing-rel-v0.2-plan`, `done`), each from a v0.2.2
element:

- **Staged publishing through OIDC** (`dl-087`, `adr-011`, `task-113`). `promote` holds no token: it
  runs `npm stage publish` as the stage-only trusted publisher (`svc-009`) on Node 24.21.0. The
  version is **not live** until the approver runs `npm stage approve <stage-id>` with 2FA (needs npm
  ≥ 11.15.0 locally; the local npm is 11.6.2, so either upgrade it or use Approve on npmjs.com →
  Staged Packages). The runbook is the header of `.github/workflows/publish.yml`. OIDC and staging
  have never run: this tag is their first exercise.
- **The repository is `wingfoil/wingfoil`** (`task-116`, `dl-091`); the trusted publisher is keyed
  on it.
- **`server.json`** carries two more copies of the version, and the tag gate refuses a mismatch
  (`task-115`, `dl-093` point 5 (a)): `version` and `packages[0].version` must equal
  `package.json` `version`.
- **MCP Registry.** `mcpName` ships for the first time in 0.2.2, so this is the first version that
  can be listed (`dl-093` "What the MCP Registry requires"). The first listing is an approver act at
  publication (`dl-093` point 6, `dl-130` Action 4); recording it as a `service` element (`kind:
  listing`) follows (`dl-093` Actions, `dl-088`). `dl-130`'s recurring steps (GitHub Release job,
  metrics snapshot, service verify sweep) are `release: "v0.3"` and are not run here, except what the
  approver chooses to do by hand.

**Carry-over from the earlier phases** (`release-submit-rel-v0.2.2-plan` Execution Notes, read at
`7a03edc9`): `package.json`, `package-lock.json` and `server.json` at `0.2.1`; CHANGELOG
`## [0.2.2] - Unreleased` (line 11); README roadmap row 0.2.2 "🔄 Being released" (line 238); the
README's leading mark `docs/assets/wingfoil-mark.svg` is not in the tarball — check its rendering on
npmjs.com after publish and file a bug if it is broken, **do not switch to an absolute URL
pre-emptively** (`user-docs-rel-v0.2.2-plan` H1).

**Irreversibility.** Up to S4 everything is a local or `main` commit. **S5 (the tag push) starts a
public pipeline, and S6's `npm stage approve` makes a version live that can never be reused.** Both are
the approver's own acts; an agent never creates or pushes the tag, never approves the `npm-publish`
deployment and never approves the staged version (`release-publishing-rel-v0.2-plan` §10.1, §7.4;
`dna.yaml` `team.agents[0].approval_authority: false`).

## Phases / Steps

### P — Preconditions (stop on any failure)

| # | Condition | Command | Expected |
|---|---|---|---|
| P0 | Pinned build in use (`dl-095`) | `npm run -s wingfoil -- --version` | `0.2.1` |
| P1 | Release is `releasing` | `awk '/^status:/{print $2; exit}' docs/04_memory/planning/rl-v1/patch-v0.2.2.md` | `releasing` |
| P2 | release-submit done | `awk '/^status:/{print $2; exit}' docs/05_plans/rl-v1/rel-v0.2.2/release-submit-rel-v0.2.2-plan.md` | `done` |
| P3 | Branch contains `main`, `main` = `origin/main` | `git merge-base --is-ancestor main HEAD; git fetch origin; git rev-list --left-right --count origin/main...main` | exit 0; `0 0` |
| P4 | Clean tree, lockfile installed | `git status --porcelain`; `npm ci` | empty; exit 0 |
| P5 | Nothing published as 0.2.2 yet; tag free | `npm view wingfoil@0.2.2 version`; `git ls-remote --tags origin v0.2.2` | `E404`; empty |
| P6 | `npm-publish` environment protected (runbook A) | `gh api repos/wingfoil/wingfoil/environments/npm-publish --jq '[.protection_rules[].type, .deployment_branch_policy]'`; `gh api repos/wingfoil/wingfoil/environments/npm-publish/deployment-branch-policies --jq '.branch_policies[] | [.name, .type]'` | a `required_reviewers` rule; tag policy `v*` |
| P7 | No publish secret left (runbook 4) | `gh api repos/wingfoil/wingfoil/environments/npm-publish/secrets --jq .total_count` | `0` |

### S1 — secret sweep (`dl-068`; role `qa`)

The v0.2 plan §2 scanner loop over `git ls-files` with `dist/validation/secret-scan.js`. Every
blocking finding must be a known fixture in `test/validation/secret-scan.test.ts` (`bug-055`);
anything else stops the phase. One-shot manual run, not an enforced gate (`dl-073`).

### S2 — the release commit: version bump (role `developer`)

`release-publishing.yaml` `tag` declares `git.commit("release {release.version}")` — this is it.
By hand, **not** `npm version` (it rewrites the lock and tags by default; v0.2 plan §4.2):

- `package.json` `version`, `package-lock.json` `version` and `packages[""].version` → `0.2.2`;
- `server.json` `version` and `packages[0].version` → `0.2.2`;
- `CHANGELOG.md` line 11: `## [0.2.2] - Unreleased` → `## [0.2.2] - 2026-09-29` (the date of the tag,
  confirmed by the approver at S4 — re-date if the tag slips to another day);
- nothing else. The README roadmap row changes only once the version is live (S8).

Then: `npm ci`; both `@emnapi` entries at `1.11.3`; `npm run -s check:lockfile` exit 0;
`node scripts/check-release-tag.cjs v0.2.2` exit 0 (it checks `server.json` too).

Commit `chore(release): release v0.2.2 — bump version to 0.2.2 (spec-015 §4)`, touching only
`package.json`, `package-lock.json`, `server.json`, `CHANGELOG.md`.

### S3 — gates and the staging rehearsal (role `qa`)

- The six gates on the bumped tree: `npx jest --coverage` (G1+G2), `npx tsc -p tsconfig.build.json
  --noEmit`, `npx tsc --noEmit -p tsconfig.json`, `npm run -s lint`, `npm run -s docs:api`; plus
  `npm run -s check:mcp`. `bug-167` flake: one re-run, recorded.
- **The suite in the `gate` job's environment** (added after run `36621412441`, `bug-172`): no git
  identity, exactly as the CI runner has none —
  `env -u GIT_AUTHOR_NAME -u GIT_AUTHOR_EMAIL -u GIT_COMMITTER_NAME -u GIT_COMMITTER_EMAIL GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 HOME=<empty dir> npx jest`
  → exit 0. Every earlier run had an identity, which is how `bug-172` reached the tag.
- `npm run publish:staging` (ephemeral Verdaccio on 4873, pack, publish, clean global install,
  `dl-023` smoke with `--version = 0.2.2`, teardown): exit 0, 20/20 `ok`, port 4873 free afterwards.
  Do not kill it when quiet (`bug-067`); not under `act` in a worktree (`bug-060`).

### S4 — merge into `main` (role `developer`) and hand over the tag

`git merge --no-ff design/release_publishing_v0.2.2` into `main` (`dl-024`: tag on `main` only;
`dl-035`: never rebase). Then re-verify on `main`, and put the output in the handover:

```sh
git rev-parse --abbrev-ref HEAD; git status --porcelain
node scripts/check-release-tag.cjs v0.2.2
npm view wingfoil@0.2.2 version        # still E404
```

Pushing `main` is part of the handover: the gate refuses a tag whose commit is not on `origin`'s
`main`.

### S5 — `tag` (APPROVER ONLY)

```sh
git push origin main                   # if not already pushed at S4
git tag -a v0.2.2 -m "release v0.2.2"
git push origin v0.2.2
```

Annotated (`spec-015` §4), on the `main` commit that carries S2.

### S6 — `publish` (the pipeline runs; the approver acts twice)

The agent watches `gh run list --workflow publish.yml` / `gh run watch <id>` and reports each job.

1. `gate` (tag on main, versions incl. `server.json`, `npm ci`, `prepublishOnly`, dry-run, pack) and
   `stage` (Verdaccio + smoke) run unattended.
2. `promote` waits on `npm-publish`: **the approver approves the deployment** on GitHub. If `promote`
   starts without waiting, the environment protection has failed — tell the approver at once (the
   version would still only be *staged*, not live; `npm stage reject` discards it).
3. `promote` runs `npm stage publish` over OIDC and prints the stage id. The agent reports it.
   Expected first-run risks: OIDC exchange refused (trusted publisher mismatch — check
   `svc-009` against org/repo/workflow/environment), or the staging command unavailable. Either
   fails with nothing staged: stop, file a bug, do not retry blindly.
4. **The approver inspects and approves on npm:** `npm stage list wingfoil`,
   `npm stage view <stage-id>`, `npm stage approve <stage-id>` (2FA; npm ≥ 11.15.0), or Approve on
   npmjs.com → Staged Packages. `npm stage reject <stage-id>` if anything is wrong.

### S7 — verify the publish (role `qa`)

| Command | Expected |
|---|---|
| `npm view wingfoil version` / `dist-tags` | `0.2.2` / `latest: 0.2.2` |
| `npm view wingfoil@0.2.2 mcpName repository.url homepage` | `io.github.wingfoil/wingfoil`; `wingfoil/wingfoil` URLs |
| `npm view wingfoil@0.2.2 dist --json` | provenance attestation present (`https://slsa.dev/provenance/v1`) |
| `npm view wingfoil@0.2.2 dependencies --json` | no `@anthropic-ai/sdk`, no `chalk` (`task-117`) |
| isolated `npm install -g wingfoil@0.2.2` (own `--prefix`, `--cache`, empty user config); `wingfoil --version`; in a fresh git repo `init --template Scrum`, `memory add`, `memory submit` | exit 0; `0.2.2`; `from draft to pending`; clean tree |
| README on `https://www.npmjs.com/package/wingfoil` | the mark renders — if not, file a bug |

### S8 — after the version is live

- **MCP Registry listing (approver).** With `mcp-publisher` (the registry's CLI), `login github` as
  the `wingfoil` org owner and `publish` from the repository root (`server.json`). Verify:
  `curl -s 'https://registry.modelcontextprotocol.io/v0/servers?search=io.github.wingfoil/wingfoil'`
  lists version `0.2.2`.
- **Record it (agent, after the listing exists):** `memory add --type service` for the MCP Registry
  listing (`kind: listing`, `verify:` the curl above), then `submit`; the approver's `approve` makes
  it `active` (`dl-088`: approve = the approver ran `verify`).
- **README roadmap row** 0.2.2 → `✓ Released (\`wingfoil@0.2.2\` on npm)`, in a `docs:` commit.
- **Optional, approver's choice:** a GitHub Release `v0.2.2` from the CHANGELOG section
  (`dl-130` Q1/Q4 are v0.3 decisions; nothing requires it now).

### S9 — `mark-released` (role `tech-lead` — approver's explicit instruction only)

`releasing` is a `waiting` state: hand edit of `status:` only, subject per the v0.2 precedent
`d2ad1f3f`: `wf(release): mark-released patch-v0.2.2 [releasing → released]`, one file. Then this
plan's Execution Notes (`docs(plans):`), `finalize [active → done]` with the approver's
`Approver:`/`Reason:`, merge `--no-ff`, push on instruction.

### Hazards

- **H1 — a tag is forever on npm's side.** A version number once staged-and-approved can never be
  reused; a tag whose pipeline fails burns nothing on npm but must be deleted and re-pushed by the
  approver, or the version skipped (the v0.2.0 precedent, `bug-135`).
- **H2 — first run of OIDC + staging + env gate on `wingfoil/wingfoil`.** Watch the run live.
- **H3 — `bug-055`.** Do not touch `test/validation/secret-scan.test.ts`; a push-protection block is
  cleared only by the repository owner in GitHub's UI.
- **H4 — one id per `memory` call** (`bug-171`); commit notes before a transition (`bug-076` guard);
  plan/service `add` with `--set` needs the dev build.
- **H5 — `main` moves.** Re-check `origin/main` before the merge and before the tag.
- **H6 — the branch.** `design/release_publishing_v0.2.2`, worktree
  `../.wf2-wt/release-publishing-v0.2.2`, cut from `main` `e5bc1831`.

## Handoff

**The agent does:** P, S1, S2, S3, S4 (merge), then stops with the tag commands; watches S6 and
reports; S7; the service element and README row of S8; S9 on instruction.

**The approver (Roberto) does:** confirms the CHANGELOG date; pushes `main` and the tag (S5);
approves the `npm-publish` deployment and the staged version on npm (S6); publishes the MCP Registry
listing and approves its `service` element (S8); instructs `mark-released` (S9) and approves this
plan's `finalize`.

**Completion:** `wingfoil@0.2.2` live on npm with provenance and `latest`; `patch-v0.2.2`
`released`; README row updated; this plan `done` and merged. After it: v0.3's `release-planning`
starts with `advance-pinned-build` (pin `wingfoil-released` → `npm:wingfoil@0.2.2`, `dl-095`).

## Execution Notes

Phase started 2026-09-29 by the agent, session "DEV v0.2.2 - D.release-submit", on the approver's
instruction ("pusha main e procedi con release-publishing"). Before it, `main` was pushed
(`227fbad5..e5bc1831`). Branch `design/release_publishing_v0.2.2`, worktree
`../.wf2-wt/release-publishing-v0.2.2`, cut from `main` `e5bc1831`. Plan: add `fc93d793` (dev
build) → submit `36a4c5a4` (pinned, `draft → active`).

### P — preconditions: all met

| # | Result |
|---|---|
| P0 | `0.2.1` |
| P1 | `releasing` |
| P2 | `done` |
| P3 | ancestor exit 0; `origin/main...main` → `0 0` |
| P4 | clean; `npm ci` exit 0 |
| P5 | `npm view wingfoil@0.2.2 version` → `E404`; `git ls-remote --tags origin v0.2.2` → empty |
| P6 | rules `[branch_policy, required_reviewers]`; deployment policy `["v*","tag"]` |
| P7 | secrets `total_count` → `0` |

### S1 — secret sweep: 26 blocking findings, all accounted for

`npm run -s build`, then the v0.2 plan §2 loop over `git ls-files` (957 files):

- `test/validation/secret-scan.test.ts` — 24: the `bug-055` fixtures.
- `test/storage/builtin-directives.test.ts` — 1 (`private-key-pem@100`): the non-vacuity fixture, a
  bare PEM header with no key material (`81cb63dc`, already public).
- `docs/05_plans/rl-v1/rel-v0.2/release-publishing-rel-v0.2-plan.md` — 1 (`private-key-pem@867`):
  that plan's own Execution Notes quoting the same header line; already on `origin/main`.

No finding outside these; nothing new is exposed by this phase.

### S2 — release commit `b1cd5db2`

- Hand edit, no `npm version`: `package.json`, `package-lock.json` (`version`, `packages[""].version`),
  `server.json` (`version`, `packages[0].version`) → `0.2.2`; CHANGELOG line 11 →
  `## [0.2.2] - 2026-09-29`. `git show --stat b1cd5db2` → those four files, 6+/6−.
- `npm ci` exit 0, the tree unchanged afterwards; both `@emnapi` entries `1.11.3`;
  `npm run -s check:lockfile` exit 0;
  `node scripts/check-release-tag.cjs v0.2.2` → "tag v0.2.2 matches package.json version 0.2.2, and so
  do server.json and its packages", exit 0.

### S3 — gates and staging rehearsal: all green, on `b1cd5db2`

| Command | Result |
|---|---|
| `npx jest --coverage` | exit 0; 160 suites / 2624 tests; 98.63 / 94.2 / 93.84 / 99.47; `bug-167` did not fire |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` | exit 0, no output |
| `npm run -s lint` | exit 0 |
| `npm run -s docs:api` | exit 0; tree clean |
| `npm run -s check:mcp` | exit 0 — pinned 0.2.1, `[prompts, resources]` (8, 2) |
| `npm run publish:staging` | exit 0 in 86 s; `--version = 0.2.2 — match`; 20 `ok` (help, version, 9 per template × Scrum/Kanban incl. clean-tree); "staged wingfoil@0.2.2 and smoke passed"; `ss -ltn` shows nothing on 4873 afterwards |

### S4 — merge and handover

Merged `--no-ff` into `main` as `a1a2850b`; on `main`: `node scripts/check-release-tag.cjs v0.2.2`
exit 0, `npm view wingfoil@0.2.2 version` → `E404`. Handed the tag to the approver.

### S5/S6 — first tag run: `gate` failed, nothing published

- The approver pushed `main` and the annotated tag `v0.2.2` (tag object `70f79f06`, peeled to
  `a1a2850b`: `git ls-remote --tags origin v0.2.2 'v0.2.2^{}'`).
- Run `36621412441`: `gate` **failure** at the `prepublishOnly` step; `stage` and `promote`
  **skipped** (`gh run view 36621412441 --json jobs`). 5 of 2624 tests failed, all in
  `test/cli/help-positional-required.integration.test.ts`:70 (`Expected: 2`, `Received: 1`), for
  `memory submit|approve|reject|deprecate` and `directive remove` without their positional.
  `npm view wingfoil@0.2.2 version` → `E404`: nothing was staged or published.
- Cause, reproduced locally with the test harness and no git identity: those verbs run the identity
  pre-flight (exit 1) before their argument check (exit 2). The `gate` runner has no git identity;
  every earlier run (dev-loop, release-submit S1, this plan's S3, `publish:staging`) had one.
- **Approver ruling, 2026-09-29:**
  - (1a) fix in the product: argument checks before the pre-flight; the test stays as it is;
  - reuse `0.2.2`: the approver deletes the tag and re-creates it on the fix;
  - file the bug.
- Filed through `bug-ingest-rel-v0.2.2-publish-gate-findings-plan`: `bug-172` (`open`, `high`,
  `release: "v0.2.2"`, `1890f473`). Fix task `task-125` (`pending`), on branch
  `task/task-125-mutating-verbs-check-their-required-arguments-before-the-git-identity-pre-flight`.
  It was added by hand, because the pinned and dev builds' `memory add` allocate `task-017` there
  (`bug-162`, `triaged`, v0.3).
- S3 gains the no-identity suite run above. After `task-125` merges: re-run S3 on the new `main`
  (the release commit `b1cd5db2` is unchanged), then the approver re-tags.

### The fix — `task-125`, and S3 again on `main` `54c18851`

- `bug-172` triaged by the approver (`f5ec8852`); `bug-ingest-rel-v0.2.2-publish-gate-findings-plan`
  `done` (`cc5a6a1a`).
- `task-125` approved to `backlog` (`d8ab932e`), then run through dev-loop: red `aae09854`, green
  `5adfee17`.
- An independent review agent, run at the approver's request, raised 6 findings; all were fixed in-task
  (`7b7cc40a`, `a422a4e3` — the latter a code addendum on `dl-064`).
- Approved (`45b576d0`), `done` (`49336314`), `bug-172` `closed` (`922f50e9`), merged `--no-ff` as
  `54c18851`.
- S3 on `54c18851` (this branch fast-forwarded to it), all exit 0:

  | Command | Result |
  |---|---|
  | `npm ci`; `node scripts/check-release-tag.cjs v0.2.2`; `npm run -s check:lockfile` | 0; "matches … and so do server.json and its packages"; 0 |
  | `npx jest --coverage` | 161 suites / 2639 tests; 98.68 / 94.29 / 93.84 / 99.47 |
  | both `tsc`, `lint`, `docs:api`, `check:mcp` | 0 |
  | **no-identity `npx jest`** (S3's new line) | 161 / 2639 |
  | `npm run publish:staging` | exit 0 in 72 s; 20 `ok`; "staged wingfoil@0.2.2 and smoke passed"; nothing left on 4873 |

- The old tag `v0.2.2` still points at `a1a2850b`. The approver deletes it and re-creates it on the
  new `main`.

### S5/S6 — second tag run: published

- **Tag.** The approver pushed `main` (`origin/main...main` → `0 0`), deleted the old tag, and pushed a
  new annotated `v0.2.2`: tag object `3b628557`, peeled to `12537b62` = `main`
  (`git ls-remote --tags origin v0.2.2 'v0.2.2^{}'`).
- **Run `36627583940`, conclusion success** (`gh run view 36627583940 --json jobs`):
  - `gate` 20:36:59→20:38:21Z. It is the first `gate` to pass without a git identity.
  - `stage` 20:38:24→20:39:06Z.
  - `promote` waited on `npm-publish`. `pending_deployments` → env `npm-publish`, reviewers
    `[robypomper]`: the environment protection held on its first real use. The approver approved it,
    and `promote` finished at 20:41Z.
- **Promote log** (`gh run view … --log --job <promote>`), the first OIDC staged publish:
  - "Staging to https://registry.npmjs.org/ with tag latest and public access";
  - "Signed provenance statement … Provenance statement published to transparency log" (sigstore
    `logIndex=3005657935`);
  - `+ wingfoil@0.2.2 (staged with id 800ec0cc-4f8f-482b-b73c-4f902a927d61)`;
  - tarball `wingfoil-0.2.2.tgz`: 339 files, 442.1 kB, shasum `5ba4a7c2215a3bae8c0e9ee10e64c5df75bac095`.

  Right after it, `npm view wingfoil@0.2.2 version` → `E404` and `dist-tags` → `latest: 0.2.1`: staged
  but not live, as `adr-011` intends.
- **Where the approval is on npmjs.com.** The runbook did not say, and the npm docs do not either
  (docs.npmjs.com/staged-publishing names only a "Staged Packages" tab). The approver found the tab. It
  first showed the version in an **"automated review"** state, which neither the docs nor the
  `publish.yml` runbook mention. Approve became available afterwards.
- **The approver approved the staged version on npmjs.com with 2FA.** It went live at
  `2026-09-29T20:47:50.934Z` (`npm view wingfoil@0.2.2 time`).

### S7 — verify the publish: all as expected

| Command | Result |
|---|---|
| `npm view wingfoil version` / `dist-tags` | `0.2.2` / `{"latest":"0.2.2"}` |
| `npm view wingfoil@0.2.2 mcpName repository.url homepage bugs.url` | `io.github.wingfoil/wingfoil`; `git+https://github.com/wingfoil/wingfoil.git`; `…#readme`; `…/issues` |
| `npm view wingfoil@0.2.2 dist` | shasum `5ba4a7c2…`, the same as the staged tarball; 339 files; `attestations.provenance.predicateType` = `https://slsa.dev/provenance/v1` |
| `npm view wingfoil@0.2.2 dependencies` | `zod`, `js-yaml`, `commander`, `@modelcontextprotocol/sdk`. No `@anthropic-ai/sdk`, no `chalk` (`task-117`) |
| isolated `npm install -g --prefix <p> --cache <c> wingfoil@0.2.2`, empty user config | exit 0; `wingfoil --version` → `0.2.2`; `--help` exit 0 |
| fresh git repo: `init --template Scrum`; `memory add --type task --title Probe`; `memory submit task-001-probe` | exit 0 each; `from draft to pending`; `git status --porcelain` empty; 3 commits |
| the same binary, fresh repo, no git identity: `memory submit`, `directive remove` | exit 2, `missing required argument: …` (the `bug-172` fix ships) |
| README on `https://www.npmjs.com/package/wingfoil` (browser) | the mark renders: npm rewrites the relative path to `raw.githubusercontent.com/wingfoil/wingfoil/HEAD/docs/assets/wingfoil-mark.svg` (`naturalWidth` 163). No bug to file |

A first probe used `memory add --set release=v0.1`, which the Scrum template's `task` type refuses
("has no token {release} in its id_pattern or path"). That is correct behaviour for that scaffold, not
a defect. The probe was re-run without it.

### S8 — after the version is live

- README roadmap row 0.2.2 → "✓ Released (`wingfoil@0.2.2` on npm)" (`39a44f7d`).
- **MCP Registry listing: refused, paused.**
  - The approver ran `mcp-publisher login github` and `mcp-publisher publish`. The registry answered
    403, "You have permission to publish: io.github.robypomper/*", and did so again after
    `logout`/`login`.
  - The membership is public (`gh api orgs/wingfoil/public_members` → `["robypomper"]`), and the
    approver is an active owner (`gh api user/memberships/orgs/wingfoil` → `admin`, `active`).
  - Suspected cause: the registry's OAuth app has no access to the organization.
  - Approver ruling, 2026-09-29: pause the listing, file the bug, go on with `mark-released`.
  - Filed through `bug-ingest-rel-v0.2.2-mcp-registry-findings-plan` as `bug-173` (`open`, medium,
    `release: ""`).
  - The listing's `service` element waits for the listing itself.
- **Runbook gap:** the `publish.yml` header does not say where the Staged Packages tab is, nor that an
  automated review precedes Approve. Changing that header is a change to a pipeline file, so it is
  proposed to the approver as its own element rather than made here.

### S9 — `mark-released`: performed on the approver's instruction

- `dl-079` is still `in-discussion` (`awk '/^status:/{print $2;exit}' docs/04_memory/design/dls/dl-079-*.md`).
  The subject therefore follows v0.2's precedent (`d2ad1f3f`).
- `34a74bd2` `wf(release): mark-released patch-v0.2.2 [releasing → released]`: `git show --stat` →
  only `docs/04_memory/planning/rl-v1/patch-v0.2.2.md`, 1+/1−.
- `npm run -s wingfoil -- memory history patch-v0.2.2`: the last entry is `34a74bd2`,
  `releasing → released`.

### Closing — approver rulings, 2026-09-29

- **The runbook gap** is `bug-174`. It was filed after a misunderstanding had first produced `bug-173`
  for the registry 403. The approver placed the Staged Packages tab in the npmjs.com **account menu**.
- **Both bugs triaged into v0.3** (`e4859473`, `78b941cb`); `bug-173` kept.
  `bug-ingest-rel-v0.2.2-mcp-registry-findings-plan` is `done`.
- **Carried forward, not delivered in v0.2.2:**
  - the MCP Registry listing of `io.github.wingfoil/wingfoil` and its `service` element (`dl-093`
    Actions), behind `bug-173`;
  - the runbook text, behind `bug-174`.
- **The approver approved closing this plan and pushing `main`.** The `finalize` commit carries the
  `Approver:` line.
- **Next:** v0.3's `release-planning` starts with `advance-pinned-build`: the pin `wingfoil-released`
  moves to `npm:wingfoil@0.2.2` (`dl-095`).
