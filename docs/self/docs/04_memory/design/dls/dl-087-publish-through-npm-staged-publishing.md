---
id: "dl-087-publish-through-npm-staged-publishing"
type: decision-log
title: "Migrate the publish pipeline from token `npm publish` to npm staged publishing before npm removes token direct-publish (January 2027)"
status: in-discussion
context: "release-publishing"
release: "v0.2.2"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

**What happened.** v0.2's `release-publishing` phase checked the `npm-publish` environment's
`NPM_TOKEN` just before the first real tag. npm labels it *"read and write (stage only) access to all
the packages"*. That token type was introduced on 2026-09-18 alongside npm's *staged publishing*: a
workflow submits a version to a stage queue, and a maintainer approves it with 2FA before it goes
live. The facts below come from the sources listed at the end of this section, read on 2026-09-28:

- **npm rejects a direct `npm publish` made with a stage-only token**, even one set to bypass 2FA. A
  stage-only token keeps its other write permissions, such as moving dist-tags and deprecating
  versions.
- **`npm stage publish` requires npm CLI ≥ 11.15.0 and Node.js ≥ 22.14.0.** The maintainer then uses
  `npm stage list`, `view`, `approve` and `reject`; `approve` prompts for 2FA. Approval is also
  available on npmjs.com.
- **`--provenance` and `--tag` behave as they do for `npm publish`.** GitHub recommends pairing staging
  with **trusted publishing over OIDC**, with the trusted-publisher configuration limited to stage only,
  so that a direct `npm publish` from that workflow is rejected outright.
- **Staged publishing does not support a brand-new package**: *"the package must already exist on the
  registry"*. This comes from InfoQ alone; GitHub's changelog does not address it.
- **npm is targeting January 2027 to remove direct publishing through bypass-2FA tokens.**

**What the pipeline does today.** `publish.yml`'s `promote` job runs `npm publish dist-pack/*.tgz
--provenance --access public` with `NPM_TOKEN` written to a transient `.npmrc` (`spec-015` §5,
`task-061`). The workflow pins `env.NODE_VERSION: '22.12.0'` for all three jobs, and its header gives
the reason: it is the lowest version every production dependency accepts (`adr-010`, `bug-023`), so CI
exercises the floor. Node 22.12.0 bundles npm 10.9.0 (`dl-076`), which is below both staging
minimums.

**How v0.2.0 is handled.** The stage-only token could not have published v0.2.0, for three reasons:
`promote` runs `npm publish`, the pinned npm cannot `stage publish`, and `wingfoil` did not exist yet.
So the approver replaced it with a direct-publish "Read and write" token for the first publish
(`release-publishing-rel-v0.2-plan`, *Approver decision — 2026-09-28: the token for v0.2.0*). That
works today and stops working in January 2027.

**Why this is a decision and not a task.** The change alters:
- the publishing architecture of an `accepted` ADR (`adr-009` §5 keeps a token "for registries that
  still require one");
- the file-level contract of an `approved` spec (`spec-015` §3 stage 4 and §5);
- the human control on publishing. Today that control is the GitHub `npm-publish` environment's
  required reviewer (`adr-006`, `task-061`). Staging adds a second, 2FA-backed approval on npm itself,
  which raises the question of whether both are kept.

`dl-057-publish-pipeline-hardening` (`ready`) item (e) already weighed a long-lived `NPM_TOKEN` against
trusted publishing, and left two facts unverified: the npm version that trusted publishing needs, and
whether a first publish can use it. Staged publishing reopens that question with a deadline attached.

Sources:
- https://github.blog/changelog/2026-09-18-stage-only-npm-tokens-for-safer-automation/
- https://www.infoq.com/news/2026/08/npm-stage-available/
- https://docs.npmjs.com/about-access-tokens/

### 2026-09-28 — the direct-publish token is gone, so this decision now blocks the next publish

After `wingfoil@0.2.1` was published, the approver made two changes:

- **revoked** the all-packages read-write npm token the v0.2 publish used;
- **replaced** the `npm-publish` environment's `NPM_TOKEN` with a token of the **stage-only** type.

The revocation happened on npmjs.com, so it is the approver's statement. The secret change is
corroborated by `gh secret list --env npm-publish`, which shows `NPM_TOKEN` updated at
`2026-09-28T09:25:34Z`, after the 0.2.1 publish run.

`.github/workflows/publish.yml`'s promote job still runs `npm publish ./dist-pack/*.tgz --provenance
…`, and npm refuses `npm publish` with a stage-only token. That was the blocker
`release-publishing-rel-v0.2-plan` resolved with the direct-publish token now revoked. **So the next
publish fails under the current pipeline.** The deadline this decision was written against, npm's
January 2027 removal of token direct-publish, no longer applies. The v0.2 retrospective (`retro-v0.2`)
schedules this decision into **v0.2.2**: it must be ratified and implemented before the v0.2.2
publish.

## Decision

The publish pipeline moves to `npm stage publish` before npm's January 2027 removal of token
direct-publish, and v0.2.0's direct-publish token is the last one the project uses. The open choices
below remain for the approver.

**Q1 — the credential `promote` stages with:**
- **(A) a stage-only granular token scoped to `wingfoil`.** This is the smallest change: the token stays
  in the `npm-publish` environment, and the `.npmrc` handling in `spec-015` §5 is unchanged.
- **(B) trusted publishing over OIDC, limited to stage only.** No long-lived token exists anywhere.
  `promote` already holds `id-token: write`. The trusted publisher is configured on the `wingfoil`
  package on npmjs.com (owner: approver), which is possible only once the package exists, and after
  v0.2.0 it does.
- **(C) no change until the deadline forces one.** This option is listed for completeness: the
  pipeline would break at an unscheduled moment.

**Q2 — the human gate:**
- **(i) both gates:** the GitHub environment reviewer, and then npm 2FA on `npm stage approve`;
- **(ii) npm 2FA only:** drop the environment's required reviewer;
- **(iii) keep both for one release, then decide.** The first staged release shows where each gate
  sits in practice.

**Q3 — the Node/npm the promote job runs:**
- **(a)** bump `promote` alone to a Node ≥ 22.14 (bundling npm ≥ 11.15), keeping `gate` and `stage` on
  the 22.12.0 floor;
- **(b)** keep one `NODE_VERSION` for all three jobs and install a newer npm in `promote` only;
- **(c)** raise `NODE_VERSION` for every job, which gives up testing the floor in CI.

**Recommendation:** Q1 (B), Q2 (iii), Q3 (a).
- **Q1 (B):** it removes the long-lived secret that `dl-057` (e), `dl-068` H11 and `adr-009` §5 all
  treat as the weak point, and it is the configuration GitHub recommends. The first-publish obstacle
  that blocked it for v0.2.0 disappears once `wingfoil` exists.
- **Q2 (iii):** it does not remove a working control before its replacement has been exercised once.
- **Q3 (a):** it keeps CI testing the declared floor, which is what `NODE_VERSION`'s pin exists for,
  and confines the newer toolchain to the one job that needs it.

## Rationale

- **The deadline is external and fixed.** Waiting (C) turns a planned change into an outage at a
  moment npm chooses. v0.3 lands well before January 2027.
- **Staging makes the human control stronger, not just different.** The GitHub environment approval
  is an approval of a *deployment*. Its first real exercise is v0.2.0's run, because `act` ignores
  `environment:` (`dl-068` E6). A 2FA challenge on `npm stage approve` sits on the registry itself,
  after the tarball exists and can be inspected with `npm stage view`, and nothing in CI can bypass it.
- **OIDC over a token.** A stage-only token cannot publish directly, which bounds the damage a leak can
  do, but it can still stage and still move dist-tags. An OIDC trusted publisher has no secret to leak.
  The cost is configuration on npmjs.com, which only the approver can do.
- **Keeping CI on the floor.** `adr-010` and `dl-076` pin CI to the lowest Node the dependency tree
  accepts, so that the floor stays tested. Raising the pin globally for a publishing tool would give
  up that check to satisfy a job that tests nothing.

## Actions

1. **Ratify, choosing Q1, Q2 and Q3.** Owner: approver. The choice goes in the approve commit's
   `Reason:`.
2. **Revoke v0.2.0's direct-publish token as soon as v0.2.0 is published.** Owner: approver. Under Q1
   (A), replace it with a stage-only token scoped to `wingfoil`. Under Q1 (B), configure the trusted
   publisher on npmjs.com and leave `NPM_TOKEN` unset, or remove it.
3. **Amend `adr-009` §5**, by revision or by a superseding ADR, and **`spec-015` §3 stage 4 and §5.**
   `promote` runs `npm stage publish --provenance --access public`, and a release is live only after
   the maintainer's `npm stage approve`. `release-publishing.yaml`'s `publish` phase and the
   `publish.yml` approver runbook gain that step.
4. **Change `publish.yml` behind a task** (release-planning, v0.3): the `promote` command, its
   toolchain per Q3, and the tests that pin the current step (`test/cli/publish-secrets.test.ts`,
   `test/cli/publish-pipeline.test.ts`).
5. **Settle what stays unverified before it is relied on.** Whether a stage-only trusted-publisher
   configuration exists as described is taken from GitHub's recommendation, not from npm's
   documentation. Whether `npm stage publish` accepts `--access public` is also unconfirmed. Record the
   answers in `dl-068` Action 4, whose vendor-policy premises are of the same kind.
6. **Close `dl-057` (e)** with a pointer here once this DL is ratified.

## Relations

- **Origin:** `release-publishing-rel-v0.2-plan` (v0.2, 2026-09-28), *Approver decision — the token
  for v0.2.0*.
- **Amends, on ratification:** `adr-009-npm-publishing-pipeline` §5, `spec-015-packaging-publishing`
  §3 stage 4 / §5, `release-publishing.yaml` (`publish` phase).
- **Related:** `dl-057-publish-pipeline-hardening` (e), trusted publishing;
  `dl-068-publishing-requires-public-repository` (E6, Actions 4–5, H11);
  `adr-010-node-22-runtime-floor` and `dl-076`, the CI Node floor; `adr-006`, the human-approval
  model.
- **Traceability:** REQ-SYS-09 (distribution as an npm package).
