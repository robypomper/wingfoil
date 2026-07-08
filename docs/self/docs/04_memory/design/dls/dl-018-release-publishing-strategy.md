---
id: "dl-018-release-publishing-strategy"
type: decision-log
title: "Defer release-publishing to v0.2 and define the publishing pipeline there"
status: ready
context: "release-publishing"
release: "v0.2"
tmpl_version: 260703
---

## Context

v0.1 is feature-complete — all 33 tasks (`task-001..033`) are `done`, the suite is green and
`tsc` is clean — but the release is **not publishable**, so its `release-cycle` cannot run the
`release-publishing` phase as specified (`agent.execute # build + npm publish`, `release-publishing.yaml`).

Concretely:

- **Packaging vs. publishing.** `task-007` delivered *packability* only: `package.json` has
  `name`, `version`, `bin.wingfoil`, `files:[dist, README.md]`, `main`, `types`, `engines`, and
  `prepack → build`, so `npm pack` produces a valid tarball. It does **not** deliver *publishability*.
- **Missing publish metadata.** No `repository`, `author`, `homepage`, `bugs`, or `publishConfig`
  in `package.json`, and no publish gate (`prepublishOnly`, `npm publish --dry-run`).
- **No defined publishing flow.** The real process is undecided: staging/test registry → prod
  promotion, local `npm publish` vs. a CI/CD pipeline, and registry-token/secret management (which
  must stay out of git per the `security-secrets` directive).
- **No governing tech-spec.** `spec-014` was repurposed for the MCP server entry point
  (`task-030`); nothing governs `REQ-SYS-09`'s publish surface.
- **Tool maturity.** Much of v0.1 is library-level / verification-only, and `wingfoil init` still
  scaffolds schema-invalid config in one path (`bug-005` fixed on main, `bug-006` still `open`).
  The tool is not yet mature enough for real end-user use, so a v0.1 npm release would misrepresent
  readiness.

## Decision

1. **Skip v0.1's `release-publishing` phase.** v0.1 is treated as feature-complete but is **not**
   published to npm.
2. **Define and implement the real publishing pipeline in v0.2**, so that v0.2's own
   `release-publishing` phase can actually publish.
3. On `dl-018 → ready`, v0.2 `release-planning` (build-backlog) must derive the tasks listed under
   **Actions**, together with a governing **packaging/publishing tech-spec** (`REQ-SYS-09`).
4. **Defer `bug-004`** (`dna set` strips YAML comments) **and `bug-006`** (`init` directive
   scaffolds fail the directives schema) to v0.2+, scheduled by v0.2 `release-planning`.

## Rationale

- **Irreversibility.** An ad-hoc local publish risks a bad, hard-to-retract release (`npm unpublish`
  is heavily restricted). A defined, staged, secret-safe flow must exist first — consistent with the
  `determinism` and `security-secrets` directives (prefer declared pipeline over inferred/manual steps).
- **Honest readiness.** Making v0.2 the first real published release, once the pipeline and the
  init-scaffold defects are fixed, avoids shipping a tool that is not yet usable end to end.
- **Non-blocking.** Deferring rather than blocking keeps v0.1 closable as feature-complete and lets
  v0.2 delivery begin immediately (`minor-v0.2` is already `planning`).

This is recorded as a **decision-log** rather than an ADR because the publishing *architecture*
(CI/CD vs. local, staging strategy, secret handling) is **not yet chosen** — there is nothing to mark
`accepted`. Once v0.2 selects the architecture, that choice will be recorded as an **ADR citing
`REQ-SYS-09`**, superseding the open parts of this DL.

## Actions

Task seeds for **v0.2** — `release-planning` converts these into backlog tasks when this DL reaches
`ready` (see `dl-016-release-planning-governance-reconcile` for the release/tags sweep):

- **T1 — publish metadata.** Add `repository`, `author`, `homepage`, `bugs` to `package.json`;
  decide `publishConfig`/`access`; review `files`/`.npmignore` so the published tarball is exactly
  `dist` + docs.
- **T2 — packaging/publishing tech-spec.** New tech-spec governing `REQ-SYS-09`: stages
  (test/staging registry → prod), version/tag scheme, provenance, and rollback posture.
- **T3 — publish flow implementation.** Choose **local vs. CI/CD** (recommend CI/CD); wire
  `prepublishOnly` (build + test + lint) and an `npm publish --dry-run` gate.
- **T4 — secrets management.** Registry token via CI secret store, never committed
  (`security-secrets`); document the human-provided approval/secret step (the `approver` role).
- **T5 — governance.** Schedule `bug-004` and `bug-006` into v0.2; re-run init-scaffold schema
  validation as an acceptance check.

**Open questions (to resolve while `in-discussion`):**

- **v0.1 end-state.** Leave v0.1 in `releasing` and publish it as the *first* real publish once the
  v0.2 pipeline exists, or mark it `released` now as a "paper" release (no npm)? This affects
  `plan-next-release-line`, which closes `rl-v1` only when *every* release is `released`.
- **Staging.** A real second registry (e.g. Verdaccio / GitHub Packages) vs. `npm publish --dry-run`
  + a `next` dist-tag only?
- **CI provider / provenance.** GitHub Actions assumed — is npm provenance / OIDC in scope for v0.2?

**Related:** `REQ-SYS-09` (npm distribution), `task-007` (packability delivered),
`dl-016-release-planning-governance-reconcile`, `bug-004`, `bug-006`, `spec-014` (repurposed — not a
packaging spec).