---
id: "bug-135-promote-publishes-a-relative-tarball-path-npm-reads-as-a-git-repo"
type: bug
title: "`promote` runs `npm publish dist-pack/*.tgz`, which npm 10.9 parses as a GitHub repository, so the first real publish failed and nothing was published"
status: open
severity: "high"
release-origin: "v0.2"
release: ""
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`publish.yml`'s `promote` job publishes the staged tarball with a path relative to the working
directory and without a `./` prefix. npm 10.9.0, the npm bundled with the pinned Node 22.12.0,
parses `dist-pack/wingfoil-0.2.0.tgz` as a GitHub `user/repo` shorthand, tries to
`git ls-remote` it over SSH, and fails with exit 128. No version is published.

## Steps to Reproduce

1. On GitHub: run `36399049170` (`v0.2.0`). `gate` and `stage` succeed; `promote` waits on
   `npm-publish`, is approved, and fails. From `gh run view 36399049170 --log-failed`:
   ```
   npm error code 128
   npm error command git --no-replace-objects ls-remote ssh://git@github.com/dist-pack/wingfoil-0.2.0.tgz.git
   npm error git@github.com: Permission denied (publickey).
   ```
2. Locally, with the CI npm, in a directory holding `dist-pack/wingfoil-0.2.0.tgz` from
   `npm pack --ignore-scripts`:
   - `npx -y npm@10.9.0 publish dist-pack/wingfoil-0.2.0.tgz --dry-run --ignore-scripts` → the same
     `error code 128` and `ls-remote ssh://git@github.com/dist-pack/…`;
   - `npx -y npm@10.9.0 publish ./dist-pack/wingfoil-0.2.0.tgz --dry-run --ignore-scripts` →
     `+ wingfoil@0.2.0`.
3. `grep -n "npm publish dist-pack" .github/workflows/publish.yml` shows the `promote` step
   *"Publish the staged tarball to npm with provenance"*.
4. `npm view wingfoil version` → `E404`: nothing was published.

## Expected Behavior

`promote` publishes the tarball that `stage` smoked, byte for byte, as the pipeline intends.

## Actual Behavior

The run fails at the one step that had never been executed. The tag `v0.2.0` is spent: per
`release-publishing-rel-v0.2-plan` H1 a tag CI has seen is never moved or re-pushed, so the release
ships as v0.2.1.

## Notes

- **Why no rehearsal caught it:**
  - `scripts/publish-staging.cjs` passes `resolve(tarball)`, an absolute path, to its own
    `npm publish`, so the `stage` job never exercises the relative form.
  - `promote`'s publish step is guarded by `if: ${{ !env.ACT }}`, so an `act` run never executes
    it either.

  `dl-056` named this class of risk: every registry-touching effect stays unexecuted until the first
  real run.
- **Fix:** an explicit path, `./dist-pack/*.tgz` (or an absolute one), plus two tests:
  - one that pins the `promote` command's form;
  - ideally, one that runs `npm publish --dry-run` on the same argv shape under the CI npm, so this
    class is caught before a tag.
- The environment gate is not implicated. It held: `promote` waited, and the failure came after
  approval.

## Triage & Execution Notes

- capture: found in the first real run of `publish.yml` (run `36399049170`, tag `v0.2.0`, 2026-09-28),
  during `release-publishing-rel-v0.2-plan`. Filed under `bug-ingest-rel-v0.2-publish-run-findings-plan`.
- Severity `high`: it blocks the release. The approver ruled on 2026-09-28 that it is fixed in v0.2
  and the release ships as v0.2.1.
