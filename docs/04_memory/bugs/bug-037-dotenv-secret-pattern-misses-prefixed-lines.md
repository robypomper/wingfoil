---
id: "bug-037-dotenv-secret-pattern-misses-prefixed-lines"
type: bug
title: "spec-007's `dotenv-style-secret-line` pattern is anchored at column 0, so indented, `export`-ed or list-item credential lines with short values go undetected"
status: open
severity: "medium"
release-origin: "v0.2"
release: ""
feature: "P3.8"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

The `dotenv-style-secret-line` secret pattern is
`(?im)^[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY)[A-Z0-9_]*\s*=\s*\S+` — the key must start
at the beginning of the line. A credential assignment preceded by indentation, `export ` or a Markdown
list marker is not matched. `src/validation/secret-scan.ts` copies the regex verbatim from
`spec-007-secret-hygiene-patterns` §2 (as spec-007 requires), so the fix is a spec change first.

## Steps to Reproduce

On `main` (`8a6a091`), against the built `dist/validation/secret-scan.js`, calling
`scanText(line, 'x.md')` for a key `NPM_TOKEN` and a short value `abc123`:

| line | `blocking` | `warnings` |
|---|---|---|
| `NPM_TOKEN=abc123` | — | `dotenv-style-secret-line` |
| `  NPM_TOKEN=abc123` (two leading spaces) | — | — |
| `- NPM_TOKEN=abc123` | — | — |
| `export NPM_TOKEN=abc123` | — | — |

With a value of **16 or more** characters, the separate, unanchored `generic-api-key-assignment`
pattern (`spec-007` §2, `…(api[_-]?key|secret|token|passwd|password)\s*[:=]\s*["']?[A-Za-z0-9_\-/+=]{16,}…`,
`block`) matches all four forms, so they are blocked; with 15 characters, the prefixed forms again
produce no finding at all (checked with a 15- and a 16-character alphanumeric value). The false
negative is therefore confined to **short values on prefixed lines**.

Supporting evidence:

- `grep -n "id: 'dotenv-style-secret-line'" -A8 src/validation/secret-scan.ts` → the regex and a
  comment quoting spec-007's string.
- `sed -n 99-102p docs/self/docs/04_memory/design/specs/spec-007-secret-hygiene-patterns.md` → the same
  pattern, `severity: block`.

## Expected Behavior

A credential assignment is detected regardless of leading whitespace, an `export` keyword or a list
marker — the ordinary shapes of shell profiles, `.envrc` files, indented YAML/Markdown code examples
and bulleted documentation.

## Actual Behavior

Only column-0 lines match; for values shorter than 16 characters the other forms pass the scan clean.

## Notes

- **Severity and the promotion.** `dl-036` (`ready`) promoted this pattern from `warn` to `block`, and
  `spec-007` §2 already says `block`. On `main` the code still says `severity: 'warn'`
  (`src/validation/secret-scan.ts:110`); the promotion lands with `task-061-publish-secrets`
  (`git show 986e613:src/validation/secret-scan.ts`, line 112: `severity: 'block'`, "promoted warn → block
  by dl-036"). Once it merges, this miss is a false negative on a **blocking** check — hence `medium`.
- **Suggested fix:** amend `spec-007` §2 to allow an optional prefix, e.g.
  `(?im)^\s*(?:export\s+|[-*]\s+)?[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY)[A-Z0-9_]*\s*=\s*\S+`,
  then mirror it in `secret-scan.ts` with a test for each prefixed form. Check the widened pattern
  against the current scan surface first: the spec-007 §3 exclusions (placeholder values, fenced
  examples) must still downgrade documentation examples.
- **A second stale line in the same section.** `spec-007` §2's "Notes on the set" (`:108-110`) still says
  "`warn` patterns are heuristic (generic high-entropy / JWT-shaped strings)", while the pattern table
  and §4 step 6 say `jwt-like` was promoted to `block` by `dl-036`. Fix both in the same amendment.
- Tech-specs carry no `version:` field (`dl-047`); record the amendment as a dated Revision note.

## Triage & Execution Notes

- capture: raised by the review of `task-061-publish-secrets` (Wave 2, 2026-09-17), reproduced on
  `main`; filed under `bug-ingest-rel-v0.2-wave2-review-findings-plan`.
