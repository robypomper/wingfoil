---
id: svc-009-npm-trusted-publisher-for-wingfoil
type: service
title: "npm trusted publisher for wingfoil"
status: active
provider: "npmjs.com"
kind: "setting"
owner_role: "approver"
verify: "https://www.npmjs.com/package/wingfoil/access (Trusted Publisher section, signed in as a maintainer); a staged publish from the v0.2.2 tag is the end-to-end proof"
url: "https://www.npmjs.com/package/wingfoil/access"
account: "GitHub Actions: wingfoil/wingfoil, workflow publish.yml, environment npm-publish"
renews: ""
repo_refs: [".github/workflows/publish.yml"]
decision: "adr-011-npm-staged-publishing-with-oidc"
set_up_in: "v0.2.2"
tmpl_version: 260929   # Original template version
---

<!-- SECURITY RULE (dl-088, REQ-SEC-08, directive security-secrets):
     a service element NEVER holds a secret value — no token, password, recovery code or key, and no
     fragment of one. Name where the secret is held (e.g. "GitHub Actions secret <NAME>, environment
     <env>"), its type, its expiry and how it is rotated. The spec-007 scan (`scanText`,
     src/validation/secret-scan.ts) runs on this file in service-ingest's `capture` phase. -->

## Purpose

The credential of WingFoil's npm publish since `adr-011` (decision point 2). npm trusts the GitHub
Actions workflow `publish.yml` of `wingfoil/wingfoil`, running in the environment `npm-publish`,
over OIDC, to **stage** a version of the package `wingfoil`. No long-lived npm token exists in the
repository or on GitHub. A staged version goes live only when a maintainer approves it on npm with
2FA (`adr-011` point 3). Without it, `publish.yml`'s `promote` job cannot stage anything.

## Configuration

- Configured by the approver on npmjs.com on 2026-09-29, after the repository transfer (`task-116`),
  on the package `wingfoil` → Settings → Trusted Publisher → GitHub Actions: organization or user
  `wingfoil`, repository `wingfoil`, workflow filename `publish.yml`, environment `npm-publish`,
  limited to staged publishing.
- Also done by the approver the same day, with this setup: account 2FA enabled; the package's
  publishing access set to "Require two-factor authentication and disallow bypass 2fa tokens
  (recommended)", the exact label on npmjs.com; the stage-only
  granular token revoked. The GitHub side of the old credential, the environment secret `NPM_TOKEN`,
  was deleted, and `svc-007-github-actions-secret-npm-token` is `deprecated`.
- The package stays the unscoped `wingfoil` owned by the maintainer account `robypomper`
  (`svc-005-npm-package-wingfoil`). The npm organisation `wingfoilhq`
  (`svc-002-npm-organisation-wingfoilhq`) is not involved (`dl-091`).
- `publish.yml`'s `promote` job holds `id-token: write`, no secret and no `.npmrc` (`task-113`).

## Verification

No public, read-only command shows a package's trusted publishers. The approver checks the Trusted
Publisher section at `https://www.npmjs.com/package/wingfoil/access`, signed in, against the four
values above. The same page shows the publishing-access setting. The end-to-end proof is the v0.2.2
tag run: `promote` stages the tarball without a token, and `npm stage view` lists it
(`release-publishing`). Repository side, run by `task-116` on 2026-09-29:
`gh api repos/wingfoil/wingfoil/environments/npm-publish/secrets --jq '{total_count}'` →
`total_count: 0`.

**Read by the approver, 2026-09-29 17:56** (screenshot of `npmjs.com/package/wingfoil/access`,
shared in the `task-116` session):
- Publisher GitHub Actions; organization or user `wingfoil`, repository `wingfoil`; workflow filename
  `publish.yml`; environment `npm-publish`.
- Allowed actions: `npm stage publish` always allowed, and "Allow npm publish" **unchecked**, so the
  trusted publisher can stage only (`adr-011` point 2).
- Publishing access: "Require two-factor authentication and disallow bypass 2fa tokens
  (recommended)".
- The sidebar's repository link still reads `github.com/robypomper/wingfoil`, from the published
  0.2.1 metadata. It changes with 0.2.2 (`svc-005`).

## Management

- **Owner:** the `approver` role (maintainer account `robypomper`).
- **Renaming** the repository, the workflow file or the environment breaks the trust. Update the
  trusted publisher on npm in the same change, and record it here.
- **Retirement:** remove the trusted publisher on npm and `memory.deprecate` this element; a new
  publish credential is a new decision (`adr-011` supersession).
