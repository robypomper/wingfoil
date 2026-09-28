---
id: "bug-136-publish-workflow-pins-actions-that-target-node-20"
type: bug
title: "`publish.yml` pins four `actions/*` v4 releases that target Node 20, which GitHub runners removed on 2026-09-23; they only run because the runner forces them onto Node 24"
status: open
severity: "low"
release-origin: "v0.2"
release: ""
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

Every action `publish.yml` uses is pinned to a v4 release built for Node 20. GitHub deprecated Node
20 on its runners and removed it on 2026-09-23, so each job now carries a deprecation annotation and
runs those actions on Node 24, a runtime they were not released for.

## Steps to Reproduce

1. `grep -n "uses:" .github/workflows/publish.yml` lists four actions:
   - `actions/checkout` v4.4.0;
   - `actions/setup-node` v4.4.0;
   - `actions/upload-artifact` v4.6.2;
   - `actions/download-artifact` v4.3.0.

   Each is pinned by SHA, with its tag in a trailing comment.
2. The check-run annotations of run `36399049170`, read per job with
   `gh api repos/robypomper/wingfoil/check-runs/<job-id>/annotations`:
   - `gate`: checkout, setup-node, upload-artifact;
   - `stage`: checkout, download-artifact, setup-node;
   - `promote`: download-artifact, setup-node.

   Each annotation reads *"Node.js 20 is deprecated. The following actions target Node.js 20 but are
   being forced to run on Node.js 24"*.

## Expected Behavior

The pipeline runs actions released for the runtime the runner provides, with no deprecation
annotation.

## Actual Behavior

The actions work under forcing: `gate` and `stage` passed in that run, and `promote` passed its
setup and download steps. But they run on a runtime they were not released for, and GitHub's own
timeline no longer provides an opt-out. `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION` worked only until
2026-09-23 (https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/,
read 2026-09-28).

## Notes

- **Fix:** move each pin to the first release of that action that targets Node 24. Keep the full-SHA
  pin and its tag comment, as `publish.yml`'s header and `dl-057` (a) require. The exact versions
  are for the fix task to establish; this bug does not assert them.
- This is not the Node that builds and tests WingFoil: `env.NODE_VERSION` (22.12.0, `adr-010`) is
  unaffected.
- `release-publishing-rel-v0.2-plan` H9 forbids updating an action during a publishing phase, which
  is why this is not folded into `bug-135`'s fix. `dl-087` touches `publish.yml`'s `promote`
  job in v0.3, so the two changes can share a task.

## Triage & Execution Notes

- capture: found in the first real run of `publish.yml` (run `36399049170`, tag `v0.2.0`, 2026-09-28),
  during `release-publishing-rel-v0.2-plan`. Filed under `bug-ingest-rel-v0.2-publish-run-findings-plan`.
- The approver ruled on 2026-09-28 that it is scheduled for v0.3.
