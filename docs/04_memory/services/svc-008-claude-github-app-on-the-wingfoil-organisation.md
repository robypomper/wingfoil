---
id: svc-008-claude-github-app-on-the-wingfoil-organisation
type: service
title: "Claude GitHub App on the wingfoil organisation"
status: pending
provider: "GitHub"
kind: "account"
owner_role: "approver"
verify: "gh api orgs/wingfoil/installations --jq '.installations[]|select(.app_slug==\"claude\")|{app_slug,repository_selection,permissions}'"
url: "https://github.com/apps/claude"
account: "wingfoil (organisation installation 166199613)"
renews: ""
repo_refs: []          # optional — repository paths that depend on it, e.g. [".github/workflows/publish.yml"]
decision: "release-planning-rel-v0.2.2-plan §C"
release: "v0.2.2"
tmpl_version: 260929   # Original template version
---

<!-- SECURITY RULE (dl-088, REQ-SEC-08, directive security-secrets):
     a service element NEVER holds a secret value — no token, password, recovery code or key, and no
     fragment of one. Name where the secret is held (e.g. "GitHub Actions secret <NAME>, environment
     <env>"), its type, its expiry and how it is rotated. The spec-007 scan (`scanText`,
     src/validation/secret-scan.ts) runs on this file in service-ingest's `capture` phase. -->

## Purpose

The Claude GitHub App gives Claude, through claude.ai and Claude Code sessions that work on GitHub,
access to the repository `wingfoil/wingfoil`: cloning, branches (the `claude/*` branches) and pull
requests. After the transfer of the repository to the organisation `wingfoil` (2026-09-29), an
installation on the approver's personal account no longer covers it. So the organisation needs its
own installation (`release-planning-rel-v0.2.2-plan` §C, re-check "the Claude GitHub App
installation on the `wingfoil` organisation").

## Configuration

- Installed by the approver on the organisation `wingfoil` on 2026-09-29 (`created_at:
  2026-09-29T17:34:36+02:00`), installation id `166199613`, app `claude`.
- **Repository access: all repositories** of the organisation (`repository_selection: all`). The
  organisation holds one repository today (`gh api orgs/wingfoil/repos --jq '.[].full_name'` →
  `wingfoil/wingfoil`), so the effect equals "only `wingfoil/wingfoil`". A second repository added
  to the organisation would be covered too, unless the access is narrowed to selected repositories.
- **Permissions:** actions, checks, contents, discussions, issues, pull requests, repository hooks and
  workflows `write`; members, metadata and statuses `read`.
- **Events:** check_run, check_suite, commit_comment, discussion, discussion_comment, issues,
  issue_comment, merge_queue_entry, pull_request, pull_request_review, pull_request_review_comment,
  push, release, status, sub_issues.
- No secret is involved on the repository side. The app authenticates as itself, and the project
  holds no key for it.

## Verification

`gh api orgs/wingfoil/installations --jq '.installations[]|select(.app_slug=="claude")|{app_slug,repository_selection,permissions}'`
→ `app_slug: claude`, `repository_selection: all`, and the permissions above (run read-only by
`task-116` on 2026-09-29). The approver can also check it at the organisation's Settings →
GitHub Apps.

## Management

- **Owner:** the `approver` role, as owner of the organisation.
- **Narrowing access:** Settings → GitHub Apps → Claude → Configure → "Only select repositories". Do
  it when the organisation gains a repository the app should not see.
- **Retirement:** uninstall from the same page, then `memory.deprecate` this element with the
  reason.
- **No renewal:** the installation does not expire (`renews: ""`).
