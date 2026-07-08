---
id: adr-009-npm-publishing-pipeline
type: adr
title: "npm publishing pipeline: GitHub Actions CI/CD with ephemeral Verdaccio staging"
status: accepted
sard_ref: REQ-SYS-09
supersedes: ""
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

REQ-SYS-09 requires WingFoil to ship as an installable npm package exposing the `wingfoil` CLI
(`npm install -g wingfoil` puts `wingfoil` on PATH). `task-007` delivered *packability* only —
`package.json` has `name`, `version`, `bin.wingfoil`, `files`, `main`, `types`, `engines`, and a
`prepack → build` so `npm pack` yields a valid tarball — but not *publishability*: no publish
metadata, no publish gate, and, critically, **no chosen publishing architecture**. `dl-018`
deliberately deferred that choice, recording it as a decision-log rather than an ADR precisely
because the architecture (CI/CD vs. local, staging strategy, secret handling) was not yet settled,
and stated that once v0.2 selects the architecture it "will be recorded as an ADR citing REQ-SYS-09,
superseding the open parts of this DL." This ADR is that decision.

The forces:

- **Irreversibility.** `npm unpublish` is heavily restricted (a published version is effectively
  permanent within 72h and gone after). An ad-hoc local publish risks a bad, hard-to-retract release.
  The `determinism` directive prefers a declared pipeline over inferred/manual steps.
- **Secret hygiene.** A registry token must never be committed (`security-secrets` directive; the
  config is fully git-versioned). Where the token lives, and who provides it, is an architectural
  constraint, not an implementation afterthought.
- **Honest readiness.** v0.2 is the *first* real published release (v0.1 was a paper release per
  `dl-018`), so the pipeline must validate the tarball actually installs and runs before it reaches
  the public registry — not publish blind.
- **Bounded implementation effort, on free/OSS tooling.** The approver's constraint is a *real*
  staging step built on **free, open-source** tooling, **without a dependency on a hosted registry**
  (e.g. GitHub Packages) — and without the staging setup ballooning into significant extra work. In
  particular, iterating a GitHub Actions workflow by pushing commit-after-commit just to debug it is a
  specific cost to avoid. (Note: "no standing service to operate" is a WingFoil value for the *tool
  itself* — `adr-001`, `adr-004` — but it is **not** a property that needs defending for the
  *package-distribution* pipeline, which is inherently a CI concern; it is not used as a justification
  here.)

Alternatives considered: (a) **local `npm publish` by the approver** — simplest, no CI, but manual,
non-deterministic, and puts the token in a human's local `~/.npmrc`; (b) **CI/CD with only
`npm publish --dry-run`** (no real staging) — cheap but never proves a real install; (c) **CI/CD with
a persistent hosted staging registry** (e.g. GitHub Packages) — real, persistent staging, but adds a
standing external dependency the approver preferred to avoid. Without this decision, v0.2's
`release-publishing` phase (`agent.execute # build + npm publish`) has no defined process to run.

## Decision

WingFoil publishes to npm through a **CI/CD pipeline on GitHub Actions**, with a **real but ephemeral
open-source staging registry** in front of the public registry:

1. **Trigger.** The publish workflow runs on a `vX.Y.Z` git tag pushed to `main` (the tag is created
   on `main` after the release branch merges, per `dl-024` / `release-publishing`). No publish ever
   runs from a `design/*` phase branch.
2. **Pre-publish gate.** `prepublishOnly` runs build + test + lint; the job then runs
   `npm publish --dry-run` to surface the exact file manifest before any real publish.
3. **Staging = ephemeral Verdaccio, driven by a local-first script.** Staging uses **Verdaccio**
   (MIT-licensed OSS) as a throwaway registry: publish the packed tarball to it, then in a clean
   environment run `npm install -g wingfoil` **from the staging registry** and execute the REQ-SYS-09
   smoke assertion (`wingfoil --help` on PATH, exit 0) — reusing the `dl-023` init+CLI e2e smoke gate.
   To keep effort bounded and **avoid debugging CI by pushing throwaway commits**, this
   staging→smoke flow is implemented as a **single runnable script** (e.g. `npm run publish:staging`)
   that runs on a developer machine (`npx verdaccio` or the official Docker image) exactly as it does
   in CI; the GitHub Actions job merely invokes that script, and the workflow can be validated locally
   (e.g. with `act`) before it is pushed. **GitHub Packages** is recorded as the alternative if
   persistent staging is ever wanted, but the default avoids taking a dependency on a hosted registry.
4. **Promotion.** Only after the staging smoke passes does the job publish the *same* tarball to the
   public npm registry, with **npm provenance / OIDC** (GitHub Actions' OIDC identity — no long-lived
   publish token needed for provenance) so consumers can verify the build's origin.
5. **Secrets.** Any npm automation token (for registries that still require one) lives **only** in the
   GitHub Actions secret store, never in the repo; the human `approver` role provides/rotates it and
   authorizes the tagged release (`security-secrets`, `adr-006` role-based authority).

This decision supersedes the open architectural questions in `dl-018` (local-vs-CI/CD, staging
strategy, provenance); `dl-018` remains `ready` as the record of *why* publishing was deferred and of
the task seeds it derives.

## Consequences

- **Positive:**
  - Publishing is a declared, reproducible pipeline (determinism) rather than a manual local step;
    the same tarball is validated by a real install before it reaches npm.
  - No dependency on a hosted staging registry: staging is created and destroyed per run using only
    free/OSS tooling (Verdaccio, GitHub Actions). Making the staging→smoke flow a local-first script
    keeps setup effort bounded and lets it be developed and debugged on a dev machine rather than
    through repeated CI commits.
  - Provenance/OIDC gives verifiable build origin with no long-lived credential to leak.
  - The registry token (where needed) never leaves the CI secret store; the approver remains the sole
    human gate on a release (`adr-006`).
- **Negative:**
  - Publishing now depends on GitHub Actions as a provider; a move off GitHub would require re-homing
    the pipeline (mitigated: the stages are provider-agnostic; only the OIDC/secret wiring is GH-specific).
  - Ephemeral Verdaccio validates *install + smoke* but not multi-day soak or a true second production
    registry; teams wanting persistent staging must opt into the GitHub Packages alternative.
  - Verdaccio adds a modest one-time cost to stand the registry up in the job; this is mitigated by
    the local-first script (most iteration happens off-CI), but is real work the publishing task budgets for.
  - A tag push becomes a semi-irreversible action (it triggers a real publish once staging passes),
    so tag discipline (`dl-024`) is load-bearing.
- **Neutral:**
  - The exact CI YAML, Verdaccio config, and version/tag scheme are specified separately in the
    packaging/publishing tech-spec (`spec-015`) and implemented by the v0.2 publishing tasks; this ADR
    fixes the architecture, not the file-level contract.
  - Provenance/OIDC assumes a public package; a private-package variant would revisit the token model.

## Process Notes

Authored during v0.2 `release-planning/record-adrs` (`release-planning-rel-v0.2-plan`). The
architecture choice (CI/CD; ephemeral Verdaccio staging over local publish or dry-run-only; provenance
in scope) was made by the `approver` role (Roberto). Grounded in
`docs/02_requirements/03_sard/01_architecture.md` (REQ-SYS-09) and
`docs/02_requirements/03_sard/05_security-compliance.md` (secret hygiene). Companion artefact:
`spec-015` (packaging/publishing contract). Filed `pending` pending the `dl-022` spec-review + approver
sign-off before `accepted`.

Revised in `record-adrs` after approver feedback: (1) dropped "zero standing infra" as an
architectural justification — it is a value for the *tool*, not something to defend for the
*package-distribution* pipeline; (2) made the staging→smoke→promote flow a **local-first runnable
script** the CI job merely invokes, explicitly to bound effort and avoid debugging GitHub Actions
through repeated throwaway commits. The staging default stays ephemeral Verdaccio (approver prefers not
to depend on GitHub Packages).
