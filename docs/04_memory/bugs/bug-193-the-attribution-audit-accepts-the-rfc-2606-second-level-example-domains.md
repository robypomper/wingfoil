---
id: bug-193-the-attribution-audit-accepts-the-rfc-2606-second-level-example-domains
type: bug
title: "The attribution audit accepts the RFC 2606 second-level example domains"
status: open
severity: "low"           # REQUIRED — critical | high | medium | low
release-origin: "v0.3"     # optional — release where the bug was FOUND (dl-016), e.g. "v0.1"
release: ""            # optional — fix/implementation release, stamped by release-planning/build-backlog (dl-016)
feature: "P1.2"            # optional — related feature ID, e.g. "P1.6"
contributor: ""        # optional — who originated this contribution, if not the git author (dl-020); credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note (dl-020)
tmpl_version: 260703   # Orignal template version
tags: ["v0.3"]
---

## Summary

`isValidAttribution` (`task-132`) rejects the reserved top-level domains `.invalid`, `.example`, `.test` and `.localhost`, but accepts `example.com`, `example.net` and `example.org`, which RFC 2606 also reserves.

## Steps to Reproduce

1. `node -e "console.log(require('./dist/memory').isValidAttribution('a@example.org'))"` (after `npm run build`).

## Expected Behavior

A decision whether second-level reserved domains count as placeholders, and the test fixtures moved accordingly.

## Actual Behavior

Accepted. `task-132` moved three audit fixtures to `example.org` precisely because it is accepted, so a rule change has to move them again.

## Notes

- Found by `task-132`'s developer and reviewer; outside `bug-153`'s scope, which named only top-level domains.

## Triage & Execution Notes

Captured on 2026-10-02 by `bug-ingest-rel-v0.3-w1b2-review-findings-plan`, from the independent reviews of wave 1
batch B2 (`dev-loop-rel-v0.3-plan`).
