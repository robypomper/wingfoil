---
id: "adr-011-npm-staged-publishing-with-oidc"
type: adr
title: "npm promotion through staged publishing, authenticated by a stage-only OIDC trusted publisher, with no long-lived token"
status: accepted
sard_ref: "REQ-SYS-09, REQ-SEC-08, REQ-SEC-03"
supersedes: ""
release: "v0.2.2"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`adr-009-npm-publishing-pipeline` (`accepted`) fixed the publishing architecture WingFoil shipped
v0.2 with: a GitHub Actions pipeline triggered by a `vX.Y.Z` tag on `main` with four stages. First a
gate, then staging on an ephemeral Verdaccio, then an install-and-smoke check, and finally
**promotion**, which publishes the same tarball to npm with provenance. Its decision point 5 kept a
long-lived npm token "for registries that still require one" in the GitHub Actions secret store.
`spec-015` §3 stage 4 and §5 turned that into `npm publish … --provenance --access public`, run with
`NPM_TOKEN` written to a transient `.npmrc`.

Three facts, recorded in `dl-087-publish-through-npm-staged-publishing` (`ready`), make point 4 and
point 5 unworkable as written:

- **The configured credential can no longer publish.** After `wingfoil@0.2.1` the approver revoked the
  direct-publish token and set `NPM_TOKEN` to a **stage-only** token (`dl-087`, 2026-09-28). npm
  refuses a plain `npm publish` made with a stage-only token, so the next run of `promote` fails.
- **Direct publishing through tokens has an end date.** npm targets January 2027 for removing direct
  publish through bypass-2FA tokens (`dl-087`, sources listed there).
- **npm now offers a registry-side human gate.** In staged publishing, `npm stage publish` puts a
  version in a queue, and it goes live only when a maintainer approves it, in the CLI or on npmjs.com.
  **2FA on the account is a prerequisite**: approval always prompts for it (`docs.npmjs.com/staged-publishing`,
  read 2026-09-29). A **trusted publisher** is keyed on the GitHub organisation, repository, workflow
  file and environment, and it can be limited to staging. With it there is no secret at all, and a
  direct `npm publish` from the workflow is refused (`docs.npmjs.com/trusted-publishers`, read
  2026-09-29).

The approver ratified `dl-087` at the v0.2 retrospective (`7b1b1e82`) with Q1 (B) OIDC trusted
publishing limited to staging, Q2 (iii) both human gates kept for one release, and Q3 (a) the newer
Node only in the job that promotes. `dl-087` Action 3 asks for `adr-009` point 5 to be amended "by
revision or by a superseding ADR". The alternatives weighed were:

- **(a) Revise `adr-009` in place.** This loses the record of when and why the credential model
  changed. It is a change of decision, not of implementation.
- **(b) Supersede `adr-009` with a full restatement.** Points 1–3 of `adr-009` (trigger, gate,
  ephemeral Verdaccio staging) and its alternatives analysis are untouched by `dl-087`. Restating them
  would duplicate an accepted decision to change two of its five points.
- **(c) A new ADR scoped to promotion and its credential, with a dated revision note on `adr-009`
  pointing here.** This is the choice: the approver asked for a new ADR on 2026-09-29, and its
  scope, points 4–5 only, is this ADR's proposal for the gate. `adr-009` stays `accepted` for points 1–3, and this ADR is the
  record for points 4–5.

Without this decision, v0.2.2's `release-publishing` phase has no working promotion step, and the
v0.2.2 publish is blocked (`retrospective-rel-v0.2-plan` §6.8 step 3).

## Decision

Promotion to npm uses **staged publishing**, authenticated by a **trusted publisher over GitHub OIDC
limited to staging**, and **no long-lived npm token exists anywhere**.

1. **Promote stages instead of publishing.** After the Verdaccio smoke passes, `promote` submits the
   same tarball with `npm stage publish` and provenance. The version is **not live** until a maintainer
   approves it (`npm stage approve <stage-id>`, or **Approve** under *Staged Packages* on npmjs.com).
   Verification still happens first: `npm stage view` / `npm stage download` show the exact staged
   tarball.
2. **The credential is a trusted publisher, stage-only.** It is configured on npmjs.com for package
   `wingfoil` with:
   - organisation `wingfoil` and repository `wingfoil`, the repository's owner after the transfer
     `dl-091` Q3 decides;
   - workflow file `publish.yml`;
   - environment `npm-publish`;
   - permission limited to staging.

   After it is configured, the stage-only token is revoked and the `NPM_TOKEN` secret is removed.
   **Added by this ADR, beyond `dl-087` Q1 (B):** the package's publishing access is set to *require
   two-factor authentication and disallow tokens*, as `docs.npmjs.com/trusted-publishers` recommends
   after a trusted publisher is set up (read 2026-09-29), so no token of any kind can publish. `promote` keeps `id-token: write` and writes no `.npmrc`.
3. **Two human gates for the first staged release, then a decision.** Both gates remain:
   - the GitHub `npm-publish` environment's required reviewer, which approves the *deployment*
     (`adr-006`, `task-061`);
   - the maintainer's 2FA approval of the staged version on npm, which approves the *tarball*.

   After v0.2.2's publish, `release-publishing`'s record states which gate caught what, and a
   decision-log keeps or drops the environment reviewer (`dl-087` Q2 (iii)).
4. **Only the promote job leaves the CI Node floor.** Staged publishing requires npm ≥ 11.15.0 and Node
   ≥ 22.14.0; trusted publishing requires npm ≥ 11.5.1. **No Node 22 release bundles npm 11**: the
   latest 22.x, `v22.23.3`, bundles npm 10.9.9, and the oldest Node bundling npm ≥ 11.15 is
   `v24.18.0` (npm 11.16.0, 2026-06-23), per `https://nodejs.org/dist/index.json` read 2026-09-29.
   `dl-087` Q3 (a) assumed "a Node ≥ 22.14 (bundling npm ≥ 11.15)", which does not exist. Its intent
   still holds: `promote` alone runs **Node ≥ 24.18.0**, pinned exactly in the workflow, while `gate`
   and `stage` stay on `env.NODE_VERSION` (22.12.0, `adr-010`), so CI keeps testing the declared
   floor. The alternative, Q3 (b) — Node 22 plus a separately installed npm in `promote` — is not
   taken; the approver confirms this reading at the gate.
5. **The approver owns the registry-side setup.** It is outside the repository and needs credentials no
   agent holds: 2FA on the account, the trusted publisher, publishing access, and revoking the token.
   Each is recorded as a `service` element once `dl-088`'s type exists.

Unchanged from `adr-009`: the tag trigger on the pushed `main`, the gate, the ephemeral Verdaccio
staging and its smoke check, provenance, and the rule that a failed stage blocks promotion. This ADR
replaces only `adr-009` decision points 4 and 5. The file-level contract is `spec-015` §3 stage 4
and §5.

## Consequences

- **Positive:**
  - No publish secret exists to leak, rotate or expire. The token weakness that `dl-057` (e), `dl-068`
    H11 and `adr-009` point 5 each named is removed, not mitigated.
  - A bad tarball can be stopped *after* it exists and *before* it is public. The npm approval sits on
    the registry, behind 2FA, where nothing in CI can bypass it.
  - The pipeline no longer depends on a token type npm is retiring in January 2027.
- **Negative:**
  - A release needs a second human act after the tag: the npm approval. A tag push no longer ends
    with a live package, and `release-publishing` gains a step.
  - The trusted publisher is keyed on `wingfoil/wingfoil`. It can be configured only after the
    repository transfer, and any later rename or transfer of the repository or the workflow file must
    be mirrored on npmjs.com, or promotion fails. npm's documentation does not describe what happens
    to a trusted publisher when a repository is transferred (read 2026-09-29).
  - One fact is still unverified, and the implementing task settles it before relying on it:
    whether `npm stage publish` accepts `--access public`, or only takes it from `publishConfig`
    (`dl-087` Action 5). GitHub's changelog says `--provenance` and `--tag` behave as they do for
    `npm publish` (`dl-087`), but npm's own staged-publishing page documents none of these flags
    (read 2026-09-29).
  - `promote` runs a different Node from the other two jobs. That is a deliberate asymmetry the
    workflow header must explain.
- **Neutral:**
  - `adr-009` stays `accepted` for decision points 1–3. When this ADR is accepted, `adr-009` gains a
    dated revision note that sends points 4–5 here (not written before then). Neither ADR moves to `superseded` (no engine trigger exists for it, and the
    replacement is partial).
  - The `security-secrets` boundary is unchanged in shape: nothing that authenticates is in git.
    There is simply less that authenticates.

## Process Notes

Authored during v0.2.2 `release-planning/record-adrs` (`release-planning-rel-v0.2.2-plan` step 4),
from `dl-087` as ratified in `7b1b1e82`. The approver chose a new ADR over revising `adr-009` on
2026-09-29. The npm facts in *Context* were read on 2026-09-29 from `docs.npmjs.com/trusted-publishers`
and `docs.npmjs.com/staged-publishing`, and the rest are `dl-087`'s, read on 2026-09-28. The
configuration the approver reported on 2026-09-29 had a stage-only granular token and account 2FA
disabled. That is Q1 (A), not the ratified (B), and without 2FA no staged version can be approved.
It is recorded in the plan's *Approver inputs received*, and decision point 2 is the path from it.
Filed `pending` for the `dl-022` spec-review and approver sign-off before `accepted`. Companion
artefacts: the `spec-015` amendment of the same date; the `adr-009` revision note follows acceptance.
