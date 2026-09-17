---
id: "dl-047-tech-specs-carry-no-version-field"
type: decision-log
title: "The doc-versioning directive assumes a `version:` field that no tech-spec (and no ADR, DL or task) carries"
status: in-discussion
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

The global `doc-versioning` directive (`docs/self/.wingfoil/directives/custom/doc-versioning.md`,
bound to every role in `roles.yaml:31`) states: "A document carries a `**Version:**` / `version:`
field. Bump the version only on the first edit after the file has been committed to git … Update the
`**Date:**` to the edit date when bumping."

Implementing `dl-041` (`ebfb1e3`) required editing two `approved` specs and found nothing to bump:
"neither spec carries a `version:`/date field (the tech-spec template has none)". It recorded a dated
"Revision" entry in each spec's Process Notes instead, following `e85a856`.

Measured on `main` (`8a6a091`) rather than assumed:

- **Template:** `docs/self/.wingfoil/memory/templates/tech-spec.md` has no `version:` key. Across the
  Memory templates, `grep -c '^version:'` → `adr 0`, `decision-log 0`, `task 0`, `tech-spec 0`;
  only `release` and `plan` have one.
- **Specs:** frontmatter `version:` in **0 of 15** tech-specs (`spec-001`..`spec-015`), and no
  `**Version:**` body line in any. (A plain `grep '^version:'` hits `spec-001:38`, `spec-002:190`,
  `spec-003:51,174` — those are lines inside YAML **examples** of the schemas those specs define, not
  the specs' own version.)
- **Where the convention does live:** `**Version:**` lines in the vision documents under
  `docs/01_vision/` (e.g. `01_product-brief.md`, `07_sequencer.md`), and `version:` on `plan` and
  `release` elements.
- **Where it is nonetheless prescribed for specs:** seven decision-logs tell the implementer to amend a
  spec "new spec version per the doc-versioning directive" or equivalent — `dl-027`, `dl-028`,
  `dl-032`, `dl-036`, `dl-037`, `dl-039`, `dl-040`
  (`grep -rln 'doc-versioning directive' docs/self/docs/04_memory/design/dls`). None of those Actions
  can be executed as written. Five are already implemented — `dl-027` (`e3f816b`), `dl-028`
  (`cec37bd`), `dl-032` (`2cd936f`), `dl-036` (`c936bdf`), `dl-037` (`66fb960`) — and none bumped a
  spec version, because there was none to bump.
- **What has actually been done instead — inconsistently:** dated `**Revision (YYYY-MM-DD) — …**`
  paragraphs in Process Notes exist in `spec-006` ×2 and `spec-008` ×1 only
  (`grep -c '^\*\*Revision ('` over the specs); `spec-009`, amended by `dl-032`, records no revision at
  all (`grep -c -i revision` → `0`). An in-place spec amendment currently leaves either a dated note or
  no trace in the document, depending on who made it.

## Decision

*Approver to choose.*

1. **Scope the directive to documents that declare a version, and ratify the Revision note for
   Memory elements** (recommended). Amend `doc-versioning.md`: the bump rule applies where a document
   carries `version:` / `**Version:**`; an `approved`/`accepted` Memory element edited in place records
   a dated `**Revision (date) — reason, per <element>.**` entry in its Process Notes (or equivalent
   closing section) instead. Makes the `e85a856` / `ebfb1e3` practice uniform.
2. **Add `version:` to the tech-spec template and backfill `"1.0"` on all fifteen specs**, then bump on
   each amendment. Makes the seven DL Actions executable literally, at the cost of a mass edit to
   `approved` documents and a field no code reads (`spec-010`'s frontmatter field table would also
   need the row).
3. **Both** — `version:` for machine-readable history, Revision notes for the human reason.

## Rationale

- The directive is global and loaded for every role, so a rule that cannot be followed for most
  documents teaches agents to ignore it — the opposite of its purpose.
- Option 1 costs one directive edit and describes established practice; git history already provides
  per-commit versioning of every Memory element (P1.2 / P1.10), which makes a hand-maintained number
  largely redundant for Memory documents.
- Option 2 is coherent if a visible version string is wanted by readers of the published docs; it
  should then be scoped to specs only, not every Memory type.

## Actions

- Owner **approver**: choose 1, 2 or 3.
- If 1: amend `docs/self/.wingfoil/directives/custom/doc-versioning.md`; the two still-pending DLs
  (`dl-039`, `dl-040`) then follow the Revision-note form when implemented. Optionally backfill a
  Revision note in the specs the five implemented DLs amended without one (`spec-007`, `spec-009`,
  `spec-012`).
- If 2: raise a task to amend the tech-spec template, `spec-010`'s frontmatter table, and backfill.

Related: `dl-041` (where it surfaced), `e85a856` (the Revision-note precedent), `spec-010`,
`bug-028`, `bug-032`.
