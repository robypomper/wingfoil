---
id: "dl-130-visibility-steps-in-the-release-flow"
type: decision-log
title: "A release reaches npm and nowhere else: no GitHub Release, no MCP Registry entry, no metrics snapshot and no check of the external state it depends on — four steps for the release flow"
status: ready
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`), under the visibility work the approver absorbed into
it on 2026-09-28 (`retrospective-rel-v0.2-plan` §6.7, DL-F). Its rules apply here:

- **repository first**;
- **external state recorded as `service` elements**
  (`dl-088-a-memory-type-for-state-that-lives-outside-the-repository`);
- **the agent holds no credentials, and never acts inside a third-party account.**

§6.7 defers the first official MCP Registry entry to the publication itself (v0.2.2 or v0.3.0), and
asks for a read-only metrics baseline to be recorded here.

**The release flow today.** `release-publishing.yaml` (version 1.0) has three phases: `tag`,
`publish` ("Build and publish the package to npm") and `mark-released`. `publish.yml` runs on a
version tag with `permissions: contents: read` at the top level. Only `promote` adds
`id-token: write`, for provenance. Nothing else happens on a release.

**What that leaves, read on 2026-09-28:**

- **No GitHub Release.** `gh release list -R robypomper/wingfoil` prints nothing (exit 0). The same
  command on `cli/cli` lists that project's latest release, so an empty answer is real. Tags exist:
  `git tag -l` gives `v0.2.0` and `v0.2.1`. `v0.2.0` was tagged and never published
  (`bug-135-promote-publishes-a-relative-tarball-path-npm-reads-as-a-git-repo`), so
  a Release for every tag would announce a version that does not exist. v0.1 has no tag at all.
- **No MCP Registry entry.** It needs the `mcpName` / `server.json` metadata that
  `dl-093-package-metadata-for-discovery` decides, and the namespace that
  `dl-091-package-name-and-mcp-namespace` decides.
- **No metrics, anywhere.** This is the baseline §6.7 asks for, read-only:
  - `gh api repos/robypomper/wingfoil`: 0 stars, 0 watchers, 0 forks, 0 open issues, created
    2026-09-17.
  - `gh api repos/robypomper/wingfoil/traffic/views`: 15 views from 1 unique visitor. That endpoint
    covers only the last 14 days and needs push access, so a value not read in time is lost.
  - `curl -s https://api.npmjs.org/downloads/point/last-week/wingfoil` returns
    `{"error":"package wingfoil not found"}`, while `npm view wingfoil version` returns `0.2.1`. The
    same URL for `commander` returns a count, so the endpoint works: download statistics for the
    new package are not available yet.
  - *Second reading, 2026-09-29*, from the visibility session's hand-back
    (`release-planning-rel-v0.2.2-plan`, *Visibility session outcome*):
    - stars 0, forks 0, watchers 0, open issues 0 (GitHub MCP);
    - npm downloads 0, GitHub views 0, clones 0 (the approver, on npmjs.com and in *Insights →
      Traffic*);
    - one published version, `0.2.1` (2026-09-28).

    The views disagree with the first reading's 15. The first came from the `traffic/views` API and
    the second from the web page, and the hand-back does not say which window the page showed. So
    the two numbers are recorded side by side, not reconciled. This is the baseline this
    decision-log's metrics snapshot starts from, the one the visibility planning (Stage 6) meant for
    this Context.
- **No check of external state.** The publish depends on state outside git: the npm package and its
  owner, the `NPM_TOKEN` secret, the `npm-publish` environment and its reviewer, and the public
  repository. `dl-088` records each as a `service` element with a `verify:` command. Nothing in the
  release flow runs those commands. A token of the wrong type is found late: v0.2's was found just
  before the first real tag (`dl-087-publish-through-npm-staged-publishing`).

## Decision

The release flow gains four steps.

1. **A GitHub Release for every published version.** Its body is the version's `CHANGELOG.md`
   section. It is created only after npm has the version, so an unpublished tag never gets one.
2. **An MCP Registry publish,** after the npm publish. It uses the metadata of `dl-093` and the
   namespace of `dl-091`.
3. **A metrics snapshot per release:** stars, forks, watchers, the 14-day traffic, and npm
   downloads once available. Each value is recorded with the command and the date it was read.
4. **A `service` verify sweep:** each `service` element's `verify:` command is run and its result
   recorded.

**Q1 — who creates the GitHub Release.**

- **(a) A `publish.yml` job after `promote`** (`needs: promote`), with `contents: write` granted to
  that job alone. It runs `gh release create v{version}` with the CHANGELOG section as notes.
- **(b) The approver, by hand, in `release-publishing`'s `publish` phase,** after verifying the
  package on npm.

**Q2 — where the metrics snapshot lives.**

- **(a) As `info` metrics in the `release-health` catalogue**
  (`dl-089-release-health-analyses-before-retrospective`). They are compared with the previous run
  like every other metric.
- **(b) As a `release-publishing` step** writing its own file.

**Q3 — where the verify sweep runs, and what it blocks.**

- **(a) A `checks.pre` of `release-publishing`'s `publish` phase.** It reports every service, and
  blocks nothing in its first release, as `dl-023`'s smoke gate was staged from warn to reject.
- **(b) Inside `release-health`, after publishing.** It finds a problem only after the release it
  would have broken.
- **(c) Both.**

**Q4 — backfilled Releases.** §6.7 lists "retroactive Releases for v0.1 and v0.2.1" among the
approver's external steps.

- **(a) Create one for `v0.2.1` only.** v0.1 was never published
  (`dl-018-release-publishing-strategy`) and has no tag.
- **(b) Also tag the v0.1 `released` commit, `5b16ab61` (`dl-089`'s v0.1 baseline), and release it**
  with its CHANGELOG section, marked as not published to npm.

**Recommendation: Q1 (a), Q2 (a), Q3 (a), Q4 (a).**

- **Q1 (a)** makes "a Release exists" follow mechanically from "npm has the version", which is
  exactly the property `bug-135` showed a tag alone does not have. The widened permission is scoped
  to one job and one verb, in line with `dl-057-publish-pipeline-hardening`.
- **Q2 (a):** a snapshot is only useful as a trend, and `dl-089` already owns comparing runs.
- **Q3 (a)** finds a broken dependency before the tag. Staging it from warn to reject avoids
  blocking a release on a check that has never run.
- **Q4 (a):** a Release for a version that was never distributed advertises something a user cannot
  install.

## Rationale

- **A release that only npm knows about is invisible to everyone who is not already looking for
  it.** A tag is not shown to a visitor as the latest version; a GitHub Release is.
  The MCP Registry is the index MCP clients read to find servers. Both are cheap once the metadata
  exists.
- **Each step follows from a fact, not a schedule.** The Release follows the publish, the Registry
  entry follows the metadata, and the snapshot follows the release. None of them can then announce
  something untrue, which is the failure `bug-135` came close to.
- **The sweep turns external state from an assumption into a check.** `dl-088` makes every external
  dependency a recorded element with a way to verify it. Running the verifications at release is
  what makes the record worth keeping, and the release is when the most of them are used at once.
- **Metrics without a trend are noise.** One reading of 0 stars says nothing. Recorded per release
  and compared, the readings show whether any of the visibility work moved anything. That is the
  question these four decision-logs will be judged by.

## Actions

1. **Ratify, choosing Q1–Q4.** Owner: approver. The choice goes in the approve commit's `Reason:`.
2. **On ratification, `.wingfoil/workflows/custom/release-publishing.yaml` changes:**
   - the `publish` phase gains the verify sweep as a `checks.pre` (Q3);
   - it gains the GitHub Release and MCP Registry steps as actions after the npm publish, with
     `post` checks that each exists;
   - its `version` is bumped.

   Under Q1 (a), `publish.yml` gains the release job. `spec-015-packaging-publishing` §3, which
   specifies the pipeline's stages, is amended with it.
3. **Under Q2 (a), `dl-089`'s catalogue** gains the metrics as `info` entries, through `dl-089`'s own
   rule that adding a metric requires a decision-log. This decision-log is that record.
4. **Approver, in a session:** create the backfilled Release per Q4, and the first MCP Registry entry
   at the publication §6.7 names. Record the registry listing as a `service` element (`kind:
   listing`).
5. Tasks are derived by v0.3 `release-planning` (`build-backlog`), not created here.

## Relations

- **Origin:** `retro-v0.2`; `retrospective-rel-v0.2-plan` §6.7 (visibility, DL-F).
- **Depends on:** `dl-088` (`service` elements to sweep); `dl-091` and `dl-093` (the Registry entry);
  `dl-089` (where the snapshot is compared).
- **Amends, on ratification:** `release-publishing.yaml`; `publish.yml` and `spec-015` §3 under Q1 (a).
- **Related:**
  - `bug-135` (a tag that was never published);
  - `dl-087-publish-through-npm-staged-publishing`, which changes the publish step these follow;
  - `dl-057-publish-pipeline-hardening`;
  - `dl-023-init-cli-e2e-smoke-gate` (the warn-to-reject staging);
  - `dl-127-community-health-files`, `dl-128-user-facing-presentation`, `dl-129-trust-signals`.
- **Traceability:** REQ-SYS-09 (distribution as an npm package).
