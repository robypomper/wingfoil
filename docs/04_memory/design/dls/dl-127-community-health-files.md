---
id: "dl-127-community-health-files"
type: decision-log
title: "The public repository has no contributing guide GitHub recognises, no code of conduct, no security policy and no issue or PR templates — which community health files WingFoil adds, and how they route into Memory"
status: ready
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`). The approver decided on 2026-09-28 that the project's
visibility work is absorbed into the retrospective and delivered in v0.3
(`retrospective-rel-v0.2-plan` §6.7). Its rules apply here:

- **repository first:** anything expressible as a file is a Memory-tracked change;
- **external state is recorded:** what lives in a third-party service becomes a `service` element
  (`dl-088-a-memory-type-for-state-that-lives-outside-the-repository`);
- **the agent holds no credentials** and never acts inside a third-party account.

It is one of the four visibility decision-logs delivered in v0.3 (labelled DL-C to DL-F in §6.7).
This one covers the files a first-time contributor meets.

**What exists.** The repository is public, as `dl-068-publishing-requires-public-repository` requires
for publishing: `gh api repos/robypomper/wingfoil --jq .visibility` returned `public` on 2026-09-28.
At `a20b346c`, its root holds `README.md`, `LICENSE`, `CHANGELOG.md` and `COLLABORATION.md`, and
`.github/` holds only `workflows/publish.yml`. Both are shown by `git ls-tree --name-only a20b346c`
and `git ls-tree -r --name-only a20b346c .github`.

`COLLABORATION.md` (version 1.0, `dl-020-contribution-model`) is WingFoil's contribution model:
contributors file intent as Memory elements through the ingest workflows, and an agent turns them
into work. It is complete, but GitHub does not find it. On 2026-09-28,
`gh api repos/robypomper/wingfoil/community/profile` returned `health_percentage` 42 with
`contributing`, `code_of_conduct`, `issue_template` and `pull_request_template` all `null`, and only
`license` (MIT) and `readme` present. On the same day,
`gh api repos/robypomper/wingfoil/private-vulnerability-reporting` returned `{"enabled":false}`.

So a visitor who opens an issue meets a blank form, and one who finds a vulnerability finds no
channel. Nothing points either of them at the model the project is built to demonstrate.

## Decision

WingFoil adds five community health files. Each is shaped so that what a contributor submits can be
ingested as a Memory element without re-asking.

1. **`CONTRIBUTING.md`**, which GitHub recognises, pointing at `COLLABORATION.md` and `dl-020`.
2. **`CODE_OF_CONDUCT.md`.**
3. **`SECURITY.md`:** supported versions (the latest published minor), and the private reporting
   channel.
4. **Issue forms** under `.github/ISSUE_TEMPLATE/`:
   - a **bug** form whose fields are the `bug` template's: title, severity, Steps to Reproduce,
     Expected, Actual, and the WingFoil version as `release-origin`, so that `bug-ingest`'s `capture`
     can be run from it;
   - a **proposal** form shaped on `decision-log-ingest`: context, the options seen, and the one
     preferred;
   - `config.yml` sending questions away from the issue tracker.
5. **`.github/PULL_REQUEST_TEMPLATE.md`:** it points first at `COLLABORATION.md` (intent as Memory).
   For a code PR it asks for the Memory element the change implements, following the `traceability`
   directive.

**Q1 — `CONTRIBUTING.md` and `COLLABORATION.md`.**

- **(a) `CONTRIBUTING.md` is a short pointer**, and `COLLABORATION.md` stays the canonical text. No
  link to `COLLABORATION.md`, in `dl-020` or elsewhere, moves.
- **(b) Rename `COLLABORATION.md` to `CONTRIBUTING.md`.** There is one file, but every existing link
  changes.

**Q2 — the code of conduct.**

- **(a) Contributor Covenant 2.1, verbatim,** with an enforcement contact the approver chooses.
- **(b) A short project-specific text.**

**Q3 — the security reporting channel.**

- **(a) GitHub private vulnerability reporting.** It is a repository setting, off on 2026-09-28,
  switched on by the approver and recorded as a `service` element.
- **(b) An e-mail address.**

**Q4 — who maintains the files.**

- **(a) Add them to `user-docs.yaml`'s `align-user-docs` `produces:`,** so each release checks them
  (`dl-013`).
- **(b) Write them once, outside any phase.**

**Recommendation: Q1 (a), Q2 (a), Q3 (a), Q4 (a).**

- Q1 (a) costs one file and breaks no link.
- Q2 (a) is the text contributors already recognise.
- Q3 (a) keeps reports private without publishing a personal address, and its state is recorded
  like every other external setting.
- Q4 (a): a file no phase owns goes stale. `bug-008` showed that for the agent-facing document,
  and `dl-025` fixed it by giving that document a phase.

## Rationale

- **The contribution model is the product's thesis, so it should be the first thing a contributor
  meets.** `dl-020` argues that structured, AI-mediated contribution is more reproducible than a
  pull-request inbox. A blank issue form is exactly that inbox.
- **Forms that mirror the templates make ingest mechanical.** A bug report with severity, steps and
  expected/actual already has what `bug-ingest`'s `capture` checks for
  (`frontmatter.required: [title, severity]`). The ingest agent copies it, and does not interview the
  reporter.
- **Settings are external state, and are recorded.** Private vulnerability reporting, like any
  repository setting, lives in GitHub, not in git. Under the 2026-09-28 rules it is switched on in a
  session with the approver and recorded as a `service` element that says how to verify it.
- **Alternatives considered:** GitHub Discussions as the proposal channel. It is deferred to the
  repository-settings step of §6.7, because it is a setting, not a file, and the issue form covers
  the same need in the meantime.

## Actions

1. **Ratify, choosing Q1–Q4.** Owner: approver. The choice goes in the approve commit's `Reason:`.
2. **On ratification, add** `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`,
   `.github/ISSUE_TEMPLATE/` (bug form, proposal form, `config.yml`) and
   `.github/PULL_REQUEST_TEMPLATE.md`. Under Q4 (a), add them to
   `.wingfoil/workflows/custom/user-docs.yaml` `align-user-docs` `produces:` and bump its
   `version`.
3. **Approver, in a session:** switch on private vulnerability reporting (Q3 (a)), then record it as a
   `service` element (`kind: setting`) with `verify:`
   `gh api repos/robypomper/wingfoil/private-vulnerability-reporting`. This depends on `dl-088`
   providing the type.
4. **Verify after merge:** `gh api repos/robypomper/wingfoil/community/profile` reports each file as
   non-null.
5. Tasks are derived by v0.3 `release-planning` (`build-backlog`), not created here.

## Relations

- **Origin:** `retro-v0.2`; `retrospective-rel-v0.2-plan` §6.7 (visibility, DL-C).
- **Builds on:** `dl-020-contribution-model` (`COLLABORATION.md`); `dl-068` (public repository);
  `dl-013` and `dl-025` (documents owned by a phase).
- **Depends on:** `dl-088-a-memory-type-for-state-that-lives-outside-the-repository`.
- **Related:** `dl-085-how-tool-implementation-rules-reach-anyone-outside-this-repo` (rules that bind
  roles do not reach an outside contributor; `CONTRIBUTING.md` is one place they can);
  `dl-128-user-facing-presentation`, `dl-129-trust-signals` and
  `dl-130-visibility-steps-in-the-release-flow`.
- **Traceability:** REQ-SYS-09 (distribution as an npm package).
