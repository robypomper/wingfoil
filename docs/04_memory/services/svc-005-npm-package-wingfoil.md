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
  approves the staged version with 2FA (`adr-011`). The trusted publisher was configured by the
  approver on 2026-09-29, after the transfer (`svc-009-npm-trusted-publisher-for-wingfoil`), and the
  stage-only token and its `NPM_TOKEN` secret are gone (`svc-007`, `deprecated`).
- Account 2FA: enabled by the approver on 2026-09-29, the approver's report at `task-116`. It had been
  **disabled** at the earlier report of the same day (`release-planning-rel-v0.2.2-plan` §"Approver
  inputs received").
- Publishing access: "require two-factor authentication and disallow tokens", set by the approver on
  2026-09-29 (`adr-011`).

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
  revoked (`adr-011`). All three were done on 2026-09-29 (`task-116`).
- **Deprecate a version** with `npm deprecate` through the release flow; retiring the package itself
  is an `end-of-life` decision, recorded with `memory deprecate`.
