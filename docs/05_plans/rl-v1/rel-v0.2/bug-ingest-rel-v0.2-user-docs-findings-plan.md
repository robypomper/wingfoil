---
id: "bug-ingest-rel-v0.2-user-docs-findings-plan"
type: plan
title: "Bug ingest — v0.2 user-docs probe findings"
status: done
version: "1.0"
workflow: "bug-ingest"
phase: "rel-v0.2-user-docs-findings"
element: ""
release: "v0.2"
tmpl_version: 260703
---

## Context

The v0.2 `user-docs` phase (`user-docs-rel-v0.2-plan`) exercised every shipped command in a
throwaway project to take real transcripts for the user documentation. The probe surfaced six
defects in the tool, recorded under that plan's *Execution Notes → Findings*. None is a
documentation defect, so none was fixed by the phase. Left in a plan's notes they would be
unreachable, so they become `bug` elements. The approver ordered the capture on 2026-09-25.

Per the interim no-workflow-engine rule and `dl-019`, starting the `bug-ingest` main requires a
coherent plan first; this `plan` element is it. It covers **one batch run of the `capture` phase**.

**Preconditions:** the next free bug number is `bug-126`
(`ls docs/self/docs/04_memory/bugs | tail -1` → `bug-125-a-dangling-symlink-breaks-every-directive-read.md`).

**Produces:** `docs/04_memory/bugs/bug-126-*.md` .. `bug-131-*.md`, all at `status: open`.

## Phases / Steps

Mirrors `bug-ingest.yaml`. Started standalone (no active `element` context), so every bug is
top-level and inherits nothing.

### `capture` — role: developer

- `memory.add(type: bug)` — one commit, all six skeletons, frontmatter `id` + `status: draft` only.
- `memory.submit` — one commit, full body content, `draft → open`; `release-origin: "v0.2"`,
  `release: ""` (scheduling belongs to `release-planning`).
- **Checks (post):** `frontmatter.required: [title, severity]`; every file's frontmatter parses with
  `js-yaml`; every file scans clean under the `spec-007` patterns (`scanText`).

| Bug | Finding | Defect | Proposed severity |
|---|---|---|---|
| `bug-126-dna-add-of-a-new-collection-strips-dna-yaml-comments` | 1 | first entry of a collection `dna.yaml` lacks rewrites the file without comments | medium |
| `bug-127-illegal-transition-error-names-a-move-nobody-attempted` | 2 | the refused-transition error invents its target state | low |
| `bug-128-subcommand-help-describes-no-command-and-no-argument` | 3 | subcommand `--help` carries placeholder text only | low |
| `bug-129-init-error-names-a-migration-command-that-does-not-exist` | 4 | re-`init` error points to a nonexistent command | low |
| `bug-130-no-verb-unassigns-the-directive-that-remove-requires-unassigned` | 5 | no unassign verb; possibly a DL at triage | low |
| `bug-131-extra-positionals-are-silently-ignored` | 6 | unsupported positionals accepted with exit 0 | low |

Every row was re-run against `dist/` built from `docs/user-docs-v0.2` at `79a76d6e` before being
written up. Duplicate search: `grep -li` over `bugs/` and `dls/` for each defect's keywords. Only
finding 1 has a relative, `bug-019-dna-set-fallback-silently-strips-comments` (`triaged`). It is
likely the same root cause, reached by a different command, so it is filed separately and linked,
and triage may merge the two.

## Execution Notes

- `memory.add` → `3ac3491a`; `memory.submit` → the commit following this plan's own submit.
- Checks: `js-yaml` load of all six frontmatters → `open` plus the proposed severity for each;
  `scanText` → `{"blocking":[],"warnings":[],"info":[]}` for all six.
