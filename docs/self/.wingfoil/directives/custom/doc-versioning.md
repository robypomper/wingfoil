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

- A document carries a `**Version:**` / `version:` field.
- **Bump the version only on the first edit after the file has been committed to git.** Subsequent
  edits within the same uncommitted change do not bump again.
- Update the `**Date:**` to the edit date when bumping.

> Rationale: keeps version numbers meaningful (one bump per committed revision) rather than churning
> on every micro-edit. Mirrors the standing project convention.
