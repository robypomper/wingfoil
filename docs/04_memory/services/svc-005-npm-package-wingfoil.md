---
id: svc-005-npm-package-wingfoil
type: service
title: "npm package wingfoil"
status: pending
provider: "npmjs.com"
kind: "listing"
owner_role: "approver"
verify: "npm view wingfoil name version dist-tags maintainers repository.url --json"
url: "https://www.npmjs.com/package/wingfoil"
account: "wingfoil (maintainer: robypomper)"
renews: ""
repo_refs: ["package.json", ".github/workflows/publish.yml", "server.json"]
decision: "adr-009-npm-publishing-pipeline"
release: "v0.2"
tmpl_version: 260929
---

## Purpose

WingFoil's distribution: the unscoped npm package `wingfoil` is how users install the CLI and the MCP
server (`adr-009`, `spec-015`). This repository also develops itself with a pinned published build of
it (`wingfoil-released`, `dl-095`), so an unavailable package breaks both users and `npm ci` here.

## Configuration

- First published as `wingfoil@0.2.1` on 2026-09-28, with provenance, by the v0.2 `release-publishing`
  phase (`npm view wingfoil time.created` → `2026-09-28T09:18:45.331Z`; `npm view wingfoil
  dist.attestations` → a SLSA provenance v1 attestation). `v0.2.0` is tagged in the repository
  (`git tag -l 'v0.2*'`) and was never published (`npm view wingfoil versions` → `["0.2.1"]`).
- Maintainer: `robypomper` (npm account). `repository.url` in the published metadata:
  `git+https://github.com/robypomper/wingfoil.git`.
- Publishing: `.github/workflows/publish.yml` on a `vX.Y.Z` tag; since `task-113` its `promote` job
  runs `npm stage publish` as a stage-only **trusted publisher over GitHub OIDC**, and a maintainer
  approves the staged version with 2FA (`adr-011`). The trusted publisher itself is **not configured
  yet**: the approver configures it on npmjs.com against `wingfoil/wingfoil` after the transfer
  (`adr-011` point 2; `release-planning-rel-v0.2.2-plan` §C). Until then the `NPM_TOKEN` secret
  holding a stage-only token still exists (`svc-007-github-actions-secret-npm-token`).
- Account 2FA was **disabled** when the approver reported it on 2026-09-29, and staged publishing
  needs it to approve anything (`release-planning-rel-v0.2.2-plan` §"Approver inputs received").
  Whether it has been enabled since is not recorded in any document this registration read.
- `adr-011` adds, once the trusted publisher exists, the package setting "require two-factor
  authentication and disallow tokens".

## Verification

`npm view wingfoil name version dist-tags maintainers repository.url --json` → `name: wingfoil`,
`version: 0.2.1`, `dist-tags.latest: 0.2.1`, `maintainers: ["robypomper <…>"]`,
`repository.url: git+https://github.com/robypomper/wingfoil.git` (run read-only by `task-124` on
2026-09-29). The approver also checks on npmjs.com the account 2FA state and the package's publishing
access, which no read-only public command shows.

## Management

- **Owner:** the `approver` role (maintainer account `robypomper`).
- **Publish:** only through `release-publishing` and `publish.yml`; never by hand.
- **Before the v0.2.2 publish:** account 2FA on, trusted publisher configured, stage-only token
  revoked (`adr-011`); record each change here in a `docs(self)` commit.
- **Deprecate a version** with `npm deprecate` through the release flow; retiring the package itself
  is an `end-of-life` decision, recorded with `memory deprecate`.
