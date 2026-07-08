# Contributing to WingFoil — through Memory, not (only) code

**Version:** 1.0 · **Date:** 2026-07-08

WingFoil is a harness for **AI-assisted, deterministic software development**. It manages its own
development the same way it asks other projects to (dogfooding): every change flows through
**Project Memory** — typed, versioned, git-backed artifacts — under an explicit **Workflow** and
**Directives**. This document explains how *you* contribute to that flow.

The core idea: **you contribute intent and decisions as Memory artifacts, and an AI agent turns them
into delivered work.** You do not need to write the code, the tests, or run `wingfoil` yourself.

> This is the demonstration of WingFoil's thesis: structured, AI-mediated contribution is more
> reproducible than an unstructured pull-request inbox. Decision recorded in
> [`dl-020-contribution-model`](docs/self/docs/04_memory/design/dls/dl-020-contribution-model.md).

---

## What you can contribute

Instead of a code pull request, you file one of the four **base Memory documents**, each via its
capture (“ingest”) workflow:

| You want to… | File a… | Via workflow | Lands as |
|---|---|---|---|
| report a defect | **Bug** | `bug-ingest` | `docs/self/docs/04_memory/bugs/{id}.md` |
| propose a product/process decision | **Decision-Log (DL)** | `decision-log-ingest` | `…/design/dls/{id}.md` |
| propose an architectural decision | **ADR** | `adr-ingest` | `…/design/adrs/{id}.md` |
| define a shared format/schema/API | **Tech-Spec** | `release-planning` (`identify-specs`) | `…/design/specs/{id}.md` |

Each artifact starts at `draft`, then moves to its first working state (`open` / `in-discussion` /
`pending`) so there is content to discuss. From there it is **triaged, approved, and scheduled** into a
release during `release-planning` (see `dl-016` — `triage-bugs` + `reconcile-governance`), and an AI
agent implements it under the `dev-loop` (TDD + BDD, `code-review`/`code-quality` directives).

## How to contribute (today)

The `wingfoil` CLI is still being built, so the current path is:

1. **Open a GitHub issue** describing the bug / decision / spec you have in mind (see the README’s
   *Contributing* section).
2. A maintainer or agent **captures it as the matching Memory artifact** through the ingest workflow,
   recording you as its `contributor` (below).
3. You are kept in the loop as it is ratified and delivered.

Once the CLI ships, you (or an agent on your behalf) will run the ingest workflow directly.

## Credit — you are credited for the AI-generated work derived from your contribution

Attribution in WingFoil rides on **git identity**: every state-change commit records its author and
timestamp as the audit trail
([`adr-006-git-identity-role-based-authz`](docs/self/docs/04_memory/design/adrs/adr-006-git-identity-role-based-authz.md)).
That records *who made the change*. It does **not**, by itself, capture *whose idea it was* when an AI
agent — not the contributor — authors the commits.

So the contribution model **layers** a credit convention on top of git identity (it does not replace
it, and it never rewrites git history):

- Every ingested artifact (`bug`, `decision-log`, `adr`, `tech-spec`) carries an optional
  **`contributor:`** frontmatter field — your name/handle, set when the artifact originates from
  someone other than the committing git identity — plus an optional **`credit:`** note.
- When an agent turns your ratified artifact into delivered work (tasks reaching `done`), **you are
  credited** as the source of that AI-generated output. Because a task traces back to the artifact it
  implements, the credit stays attached to the specific `bug`/`DL`/`ADR`/`tech-spec` id.

This keeps credit **machine-visible and git-versioned**, consistent with WingFoil’s single-source-of-
truth model — no external contributor database, no commit rewriting.

## Ground rules

- **Memory artifacts, not code PRs.** Contribute the decision/defect/spec; the agent carries it through
  the review gates. (Maintainers may still make direct code changes; this document is about the
  *contribution* path.)
- **Decisions live in Memory** — `adr` for architectural, `decision-log` for product/process — not
  scattered in prose (the `documentation` directive).
- **Traceability holds** — every artifact cites the requirement/feature it serves (the `traceability`
  directive).

## Pointers

- Project overview & how it all fits together: [`CLAUDE.md`](CLAUDE.md) and
  [`docs/self/.wingfoil/README.md`](docs/self/.wingfoil/README.md).
- The decision behind this document: `dl-020-contribution-model`.
- Attribution model: `adr-006-git-identity-role-based-authz`.
