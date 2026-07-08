---
id: "dl-020-contribution-model"
type: decision-log
title: "AI-mediated contribution model: contribute via Bug/DL/ADR/TechSpec, credit the contributor"
status: ready
context: "process"
release: "v0.1"
tmpl_version: 260703
---

## Context

WingFoil's own thesis is that AI-assisted development can be made deterministic and structured; the
project should be able to demonstrate that thesis on itself — including for the act of *contributing*,
not only for the act of *coding*. Today there is no such path. `README.md:382` reads "See
`CONTRIBUTING.md` for development setup (coming soon)" — that file does not exist, and there is no
`COLLABORATION.md` either. The README's `## Contributing` section (`README.md:374-382`) only invites
GitHub issues for "use cases and pain points / feature requests / bug reports"; it says nothing about
how a reported issue becomes delivered work, or who gets credit when it does.

The only attribution mechanism WingFoil has defined is git identity, per
`adr-006-git-identity-role-based-authz`: "git identity is the attribution mechanism for every state
change" (Decision point 1) — every commit's author + timestamp *is* the audit trail, with "no separate
authentication layer" (adr-006 line 41). That mechanism assumes the person acting *is* the git author.
It has no answer for the case this DL is about: an external contributor who does not (and should not
need to) commit code or run `wingfoil` themselves, but instead raises a `bug`, `decision-log`, `adr`,
or `tech-spec` through the corresponding ingest workflow (`bug-ingest.yaml`, `decision-log-ingest.yaml`,
`adr-ingest.yaml` under `docs/self/.wingfoil/workflows/custom/`, plus the tech-spec identification path
in `release-planning`), which an AI agent then turns into delivered tasks under `dev-loop`. Nothing in
the four ingested templates (`docs/self/.wingfoil/memory/templates/{bug,decision-log,adr,tech-spec}.md`)
records who originated the idea versus who (or what agent, under whose role) executed it.

This gap was surfaced explicitly in the v0.1 retrospective (`retro-v0.1`), whose friction inventory
names it as an open theme — "contribute via Memory artifacts; credit the contributor" — resolved by
spawning this DL together with a `COLLABORATION.md` deliverable (`retro-v0.1.md:76`).

## Decision

*(in-discussion — proposed, not yet ratified)* Adopt an **AI-mediated contribution model**, documented
in a new repo-root `COLLABORATION.md`:

1. **Contribution channel is Memory artifacts, not code.** An external contributor's path into the
   project is to file a `bug`, `decision-log`, or `adr` via the matching ingest workflow
   (`bug-ingest`, `decision-log-ingest`, `adr-ingest`), or to propose a `tech-spec` through the
   existing `release-planning` `identify-specs` step — never a direct code PR. This *is* the
   dogfooding demonstration: the project's own governance pipeline (draft → ratified → delivered,
   per each type's `memory.yaml` state machine) is the contribution pipeline.
2. **Credit model.** When an AI agent, executing under a role (`developer`/`architect`/etc. per
   `adr-006` point 2), turns a ratified artifact into delivered work (tasks reaching `done` under
   `dev-loop`), the original contributor is credited for that AI-generated output — the artifact's
   author is recognized as the source of the resulting change, distinct from the git author of the
   commits that implemented it.
3. **Mechanism: a frontmatter layer on top of `adr-006`, not a replacement for it.** Add a
   `contributor:` field (and an optional `credit:` note) to the four ingested templates
   (`bug.md`, `decision-log.md`, `adr.md`, `tech-spec.md` under
   `docs/self/.wingfoil/memory/templates/`), populated at `memory.add`/`memory.submit` time for
   artifacts originated by someone other than the committing git identity. This sits *above*
   `adr-006`'s attribution mechanism — git identity still records "who made this state change and
   when" for every commit; `contributor:` separately records "whose idea this was." No git history
   rewriting, no co-author trailer convention, no second identity system.
4. `COLLABORATION.md` must itself comply with the `doc-versioning` directive (carries a
   `Version:`/`Date:` header, bumped only on first edit after being committed) and the
   `documentation` + `traceability` directives (cites the ingest workflows and this DL by id). It
   replaces the "`CONTRIBUTING.md` coming soon" pointer at `README.md:382`, and the README
   `## Contributing` section (`README.md:374-390`) is updated to link it.

## Rationale

- **Dogfooding proof.** WingFoil's north star is that structured process produces reproducible
  outcomes; extending that structure to *who may propose a change and how* — rather than leaving
  contribution as an unstructured GitHub-issues inbox — is the same thesis applied to community
  input, not just to AI-agent output.
- **Lowers the contribution barrier.** A contributor supplies intent/decisions/defects (a `bug`,
  `decision-log`, `adr`, or `tech-spec`), not a working code change with tests and a passing `dev-loop`
  review gate. The AI-mediated model is what makes that barrier-lowering safe: an agent, not the
  contributor, carries the artifact through TDD/BDD and the `code-review`/`code-quality` directives.
- **Deterministic, auditable attribution.** Recording `contributor:` in frontmatter keeps credit
  machine-visible and git-versioned, consistent with `adr-006`'s existing commitment to git-backed
  single-source-of-truth (REQ-SYS-01) — no external CRM or contributor database.
- **Trade-offs considered:**
  - *Prose-only acknowledgment (e.g. a `CONTRIBUTORS.md` list) vs. a frontmatter field* — rejected;
    a free-text list is not machine-checkable and drifts out of sync with which artifact actually
    shipped. The frontmatter field keeps credit tied to the specific `bug`/`decision-log`/`adr`/
    `tech-spec` id that a task traces back to.
  - *Git co-authorship / history rewriting to credit contributors directly in commits* — rejected;
    it would mean rewriting or amending commits after the fact, which conflicts with `adr-006`'s
    model of git identity as the untouched, literal attribution record. The frontmatter layer credits
    the contributor without touching the commits an AI agent actually authored.

## Actions

- [ ] Ratify the contribution model and the `contributor:`/`credit:` field convention (owner: approver).
- [ ] On ready: author repo-root `COLLABORATION.md` (contribution channel, credit model, ingest workflow
  pointers, `doc-versioning`-compliant `Version:`/`Date:` header).
- [ ] Add `contributor:` (+ optional `credit:`) fields to the four ingested templates —
  `docs/self/.wingfoil/memory/templates/{bug,decision-log,adr,tech-spec}.md`.
- [ ] Update `README.md`'s `## Contributing` section (`README.md:374-390`) to link `COLLABORATION.md`
  and drop the "`CONTRIBUTING.md` (coming soon)" pointer at `README.md:382`.
- [ ] Cross-check `adr-006-git-identity-role-based-authz`'s Consequences section for a note that this
  DL layers contributor credit on top of, not in place of, its attribution mechanism.
