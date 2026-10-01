---
id: doc-versioning
name: "Documentation versioning"
type: directive
kind: custom
title: "Documentation versioning"
tags: [custom, documentation, versioning]
scope: global
ref: []   # pure WingFoil convention (no upstream feature/REQ)
---

# Directive — Documentation versioning

Custom WingFoil rule. Applies to all roles editing versioned docs.

## Scope of the bump rule (`dl-047`, option 1)

- **The bump rule applies where a document declares a version**, as a frontmatter `version:` key or a
  `**Version:**` body line. Examples are the vision documents under `docs/01_vision/`, `plan` and
  `release` elements, and directives that carry a `**Version:**` line. A document that declares no
  version is not given one in order to satisfy this rule. Tech-specs, ADRs, decision-logs and tasks
  declare none: their templates have no `version:` key.
- **An `approved` or `accepted` Memory element edited in place** records a dated
  `**Revision (YYYY-MM-DD) — reason, per <element>.**` entry instead, in its Process Notes or the
  equivalent closing section. `<element>` is the decision-log, bug or task that required the edit.
  Git already versions every Memory element per commit (P1.2, P1.10), so the note records the human
  reason, not a number. The edit is committed with `memory amend`, which needs approver authority,
  for every type that `memory.yaml` declares `amendable: true`.

## The bump rule

- **Bump the version only on the first edit after the file has been committed to git.** Subsequent
  edits within the same uncommitted change do not bump again.
- Update the `**Date:**` to the edit date when bumping.

> Rationale: keeps version numbers meaningful (one bump per committed revision) rather than churning
> on every micro-edit. Mirrors the standing project convention.
