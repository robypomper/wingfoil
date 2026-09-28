---
id: "dl-129-trust-signals"
type: decision-log
title: "Nothing outside the code shows a visitor or an agent that WingFoil is maintained and safe to adopt — an OpenSSF Scorecard workflow, a documentation site on GitHub Pages, and an `llms.txt`"
status: in-discussion
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`), under the visibility work the approver absorbed into
it on 2026-09-28 (`retrospective-rel-v0.2-plan` §6.7, DL-E). Its rules apply here:

- **repository first**;
- **external state recorded as `service` elements**
  (`dl-088-a-memory-type-for-state-that-lives-outside-the-repository`);
- **the agent holds no credentials.**

The OpenSSF badge itself is deferred to the publication (§6.7).

**What exists.** Each fact was read on 2026-09-28, or at `a20b346c`:

- **CI.** `.github/workflows/` holds only `publish.yml`, triggered by a version tag
  (`on: push: tags`), with top-level `permissions: contents: read`. Its header records that every
  `uses:` names a full commit SHA, and that Dependabot is not configured. No workflow runs on a push
  to `main`, or on a schedule.
- **Documentation site.** None. `gh api repos/robypomper/wingfoil/pages` returns HTTP 404, and
  `gh api repos/robypomper/wingfoil --jq .homepage` returns an empty string. The user documentation
  exists as Markdown: `docs/user-guide.md`, `docs/cli-reference.md` and `docs/examples/`. The API
  documentation builds with `npm run docs:api` (TypeDoc, enforced by `dl-013`), and is published
  nowhere.
- **Agent-facing entry point.** `docs/agents.md` is the guide for an agent working in a project that
  uses WingFoil. It is in no phase's `produces:`: `git grep -n agents.md a20b346c --
  docs/self/.wingfoil/workflows` prints nothing, while the same command for `README.md` finds
  `user-docs.yaml`. No `llms.txt` exists:
  `git ls-tree --name-only a20b346c | grep -c llms` prints `0`, while the same pipe with `README`
  prints `1`.

WingFoil's users include AI agents as well as humans. `llms.txt` is a proposed convention for a
site-root index written for language models. A supply-chain score such as OpenSSF Scorecard is what
an adopter can check without reading the code.

## Decision

WingFoil adds three trust signals.

1. **An OpenSSF Scorecard workflow**, `.github/workflows/scorecard.yml`. It runs on a push to `main`
   and weekly. It uses the official action pinned by SHA, like `publish.yml`, and has only the
   permissions the action documents. Once results are published (Q1), the badge
   joins those `dl-128-user-facing-presentation` lists, at the publication §6.7 defers it to.
2. **A documentation site on GitHub Pages,** built from the Markdown already owned by `user-docs`
   and from the TypeDoc output. Its URL is set as the repository's `homepage` and as `package.json`
   `homepage`.
3. **An `llms.txt`** at the site root, and the same file at the repository root. It is a short,
   curated index of the documents an agent should read (user guide, CLI reference, examples,
   `docs/agents.md`), each with one line saying what it is for.

**Q1 — publish the Scorecard results.**

- **(a) Publish them** (`publish_results: true`), which gives the public badge.
- **(b) Private results only,** for a first release, to see the scores before exposing them.

Some checks are expected to score low for a single-maintainer project: code review, branch
protection, and dependency-update tooling (Dependabot is not configured). This is an expectation,
not a measurement; the first run settles it. A published score states those facts. It does not
change them.

**Q2 — how the site is built.**

- **(a) GitHub Pages' default build of `docs/`.** It needs no new dependency. The site layout is
  whatever the Markdown gives.
- **(b) A Pages workflow** that assembles the Markdown and the `npm run docs:api` output into one
  artefact. It needs no new dependency either, and it puts the API reference on the site.
- **(c) A static-site generator.** It gives the best presentation, at the cost of a new
  devDependency (`dl-010-minimal-dependencies`).

**Q3 — how `llms.txt` stays true.**

- **(a) Hand-written, and added to `align-user-docs` `produces:`.**
- **(b) Generated from a declared list,** with a test that every path it names exists. This is the
  same kind of parity check `test/docs/cli-reference.test.ts` runs for the CLI reference
  (`dl-116-document-parity-tests-beyond-the-cli-reference`).

**Recommendation: Q1 (b) for the first run, then (a); Q2 (b); Q3 (b).**

- **Q1:** it lets the approver see what the score says before it becomes a public claim, and turns
  each low check into a decision instead of a surprise.
- **Q2 (b)** publishes the API reference that `dl-013` already makes the project build, without
  adding a dependency.
- **Q3 (b):** an index that points at a moved file is worse than none, and a parity test is how this
  project keeps a document true.

## Rationale

- **Trust signals are claims, so they must be checkable.** A Scorecard result is measured by a third
  party from the repository itself. A site built from the checked Markdown says nothing that the
  repository does not. An `llms.txt` whose paths are tested cannot point at nothing.
- **They serve both of WingFoil's audiences.** Humans read the badge and the site. Agents read
  `llms.txt` and the site's Markdown. `docs/agents.md` already exists for agents, but nothing
  advertises it.
- **Each one is also external state.** Pages enablement and the Scorecard results publication are
  settings of a third-party service. Under the 2026-09-28 rules, each is switched on with the
  approver and recorded as a `service` element with a `verify:` command.
- **Alternatives considered:**
  - a separate documentation repository. Rejected: it would move documents out of the gate that
    keeps them current (`dl-013`);
  - Dependabot as a fourth signal. Deferred to `dl-057-publish-pipeline-hardening`'s scope, because it
    changes how pinned actions are updated, not how the project is presented.

## Actions

1. **Ratify, choosing Q1–Q3.** Owner: approver. The choice goes in the approve commit's `Reason:`.
2. **On ratification, add** `.github/workflows/scorecard.yml`, the Pages build per Q2, and
   `llms.txt` (plus its parity test under Q3 (b)). The `package.json` `homepage` field changes, so
   the change is released as a package change.
3. **Change `docs/self/.wingfoil/workflows/custom/user-docs.yaml`:** `align-user-docs` `produces:`
   gains `llms.txt` and the site sources, and its `version` is bumped.
4. **Approver, in a session:** enable Pages, set the repository `homepage`, and record each as a
   `service` element with its `verify:`. That is `gh api repos/robypomper/wingfoil/pages` for Pages
   and `gh api repos/robypomper/wingfoil --jq .homepage` for the homepage. This depends on `dl-088`.
5. Tasks are derived by v0.3 `release-planning` (`build-backlog`), not created here.

## Relations

- **Origin:** `retro-v0.2`; `retrospective-rel-v0.2-plan` §6.7 (visibility, DL-E).
- **Depends on:** `dl-088-a-memory-type-for-state-that-lives-outside-the-repository`.
- **Related:**
  - `dl-013-documentation-process-gate` (the documents and the API build);
  - `dl-057-publish-pipeline-hardening` (pinned actions, token scope);
  - `dl-116-document-parity-tests-beyond-the-cli-reference`;
  - `dl-093-package-metadata-for-discovery` (`homepage`);
  - `dl-127-community-health-files`, `dl-128-user-facing-presentation`,
    `dl-130-visibility-steps-in-the-release-flow`.
- **Traceability:** REQ-SYS-09 (distribution as an npm package).
