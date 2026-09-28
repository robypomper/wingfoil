---
id: "dl-128-user-facing-presentation"
type: decision-log
title: "The README carries no badge, and no demo, comparison or case study shows what WingFoil does — four presentation artefacts, delivered and kept current through `user-docs`"
status: in-discussion
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`), under the visibility work the approver absorbed into
it on 2026-09-28 (`retrospective-rel-v0.2-plan` §6.7, DL-D). Its rules apply here:

- **repository first**;
- **external state recorded as `service` elements**
  (`dl-088-a-memory-type-for-state-that-lives-outside-the-repository`);
- **the agent holds no credentials.**

**What a visitor sees today.** `wingfoil@0.2.1` is published (`npm view wingfoil version` →
`0.2.1`, read on 2026-09-28).

- **No badge.** The README at `a20b346c` has none.
  `git show a20b346c:README.md | grep -ciE 'shields\.io|badge'` prints `0`, while the same pipe with
  `WingFoil` prints `19`.
- **No demo.** Nothing shows the tool running. The closest artefacts are the five self-checking
  scripts under `docs/examples/`, and a reader has to run them to see anything.
- **No comparison.** Nothing places WingFoil beside the spec-driven development tools a reader is
  likely to know. `dl-112-positioning-as-a-governance-layer` decides how WingFoil positions itself
  against them.
- **No case study.** WingFoil develops itself: every state change in this repository is a `wf()`
  commit, and `dl-089-release-health-analyses-before-retrospective` defines the measurements of
  that history. No document presents that as evidence to a user.

`user-docs.yaml`'s `align-user-docs` phase produces `README.md`, `docs/user-guide.md`,
`docs/cli-reference.md`, `docs/examples/` and `CHANGELOG.md` (`produces:`, at `a20b346c`). So the
README is owned by a phase, and anything added to it is too. The other three artefacts would be new.

## Decision

WingFoil adds four presentation artefacts. Each is added to `align-user-docs`'s `produces:`, so every
release re-checks it (`dl-013`).

1. **README badges:** the npm version, the licence, the Node engine floor, and the status of the
   `publish.yml` workflow. Each is derived from the registry, `package.json` or the workflow run, so
   none states a fact the repository cannot check.
2. **A reproducible demo:** a versioned script that records a terminal session from a fresh
   project, rendered to an animation referenced by the README. It **drives an existing
   `docs/examples/` script** (for example `01-first-project/run.sh`), so the demo is also a
   self-check. If the tool changes, the example fails instead of the animation going stale.
3. **A comparison page, `docs/comparison.md`.** It places WingFoil beside the tools
   `dl-112-positioning-as-a-governance-layer` names, from the position `dl-112` ratifies. Every fact
   about another tool carries its source and the date it was read, and the content is integrated,
   not linked (the 2026-09-28 resolvability ruling, `retrospective-rel-v0.2-plan` §2.2).
4. **A dogfooding case study, `docs/case-study.md`.** It shows how WingFoil develops WingFoil, with
   figures taken from `dl-089`'s release-health report and each figure carrying its definition and
   measurement point.

**Q1 — the demo recorder.**

- **(a) A VHS tape** (`.tape`, a plain-text script) rendered to GIF. It is versioned and
  diff-able. The recorder is a separate binary, not an npm dependency.
- **(b) An asciinema cast.** It is text, and a viewer is needed to play it.
- **(c) A static transcript** of an example's output, in Markdown. It needs no tool at all, and it
  does not move.

**Q2 — where the rendered animation lives.**

- **(a) Committed under `docs/`.** It is a binary in git, regenerated each release.
- **(b) Attached to the GitHub Release** (`dl-130-visibility-steps-in-the-release-flow`) and
  referenced by URL. That is a reference the repository cannot open, so it is weaker under the
  resolvability rule.

**Q3 — order.**

- **(a)** Badges and demo first. Comparison page after `dl-112` is ratified. Case study after `dl-089`
  produces its first report.
- **(b)** All four at once, at the end of v0.3.

**Recommendation: Q1 (a), Q2 (a), Q3 (a).**

- **Q1 (a)** is the only option that is both a versioned text script and a moving picture. The
  recorder being a binary rather than a package keeps `dl-010-minimal-dependencies` intact.
- **Q2 (a)** keeps the README's picture resolvable from the repository.
- **Q3 (a)** does not write a comparison before its position is decided, or a case study before its
  figures exist.

## Rationale

- **A first-time reader decides in seconds.** Badges answer "is it maintained, is it published, what
  does it need". A demo answers "what does it do". Both are cheap, and without them the README is
  prose about a tool nobody has seen run.
- **Presentation must not be a second source of truth.** Each artefact is derived from something
  already checked:
  - the badges from the registry;
  - the demo from a self-checking example;
  - the comparison from a ratified position;
  - the case study from measured reports.

  A claim in any of them can then be traced and re-run, as the `claim-evidence` directive asks of
  every other sentence in the repository.
- **Owning them in `user-docs` keeps them current.** `dl-013` exists because user-facing documents
  drifted. New user-facing documents belong under the same gate.
- **Alternatives considered:** a hosted landing page. It is left to `dl-129-trust-signals`, which
  covers the documentation site and decides whether one is built.

## Actions

1. **Ratify, choosing Q1–Q3.** Owner: approver. The choice goes in the approve commit's `Reason:`.
2. **On ratification, `docs/self/.wingfoil/workflows/custom/user-docs.yaml` changes:**
   `align-user-docs` `produces:` gains the demo script and its rendering, `docs/comparison.md` and
   `docs/case-study.md`, and its `checks.post` covers them. Its `version` is bumped.
3. **Add** the badges to `README.md`, and the demo script next to the example it drives.
4. **Comparison page** after `dl-112` is ratified; **case study** after `dl-089`'s first report.
5. Tasks are derived by v0.3 `release-planning` (`build-backlog`), not created here.

## Relations

- **Origin:** `retro-v0.2`; `retrospective-rel-v0.2-plan` §6.7 (visibility, DL-D).
- **Delivered through:** `dl-013-documentation-process-gate` (`user-docs`, `align-user-docs`).
- **Depends on:** `dl-112-positioning-as-a-governance-layer` (the comparison);
  `dl-089-release-health-analyses-before-retrospective` (the case study's figures).
- **Related:** `dl-093-package-metadata-for-discovery` (what the registry shows beside the badges);
  `dl-127-community-health-files`, `dl-129-trust-signals`,
  `dl-130-visibility-steps-in-the-release-flow`; `dl-010-minimal-dependencies`.
- **Traceability:** REQ-SYS-09 (distribution as an npm package).
