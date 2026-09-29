---
id: "bug-004-dna-set-strips-yaml-comments"
type: bug
title: "wingfoil dna set strips YAML comments (loses [SPEC]/[AUTHORING] provenance)"
status: closed
severity: "medium"
release-origin: "v0.1"
release: "v0.2"
note: release_origin=v0.1, release_assigned=v0.2
feature: "P2.1"
tmpl_version: 260703
---

## Summary

`wingfoil dna set <key> <value>` re-serializes `.wingfoil/dna.yaml` via `js-yaml` `dump()`, which
drops all comments and reformats the file — so a single `dna set` on a comment-rich `dna.yaml` (such
as WingFoil's own dogfooding config) silently deletes every inline `[SPEC]`/`[AUTHORING]` provenance
annotation (the field-provenance convention, CLAUDE.md §9 / documented in `dna.yaml` itself).

## Steps to Reproduce

1. On a `.wingfoil/dna.yaml` that carries inline comments (e.g. `[SPEC]`/`[AUTHORING]` annotations).
2. Run `wingfoil dna set project.name "Example"` (any valid key/value).
3. Inspect the committed `dna.yaml`.

## Expected Behavior

The set value is updated in place and all unrelated content — including comments and formatting — is
preserved (a minimal, comment-preserving edit).

## Actual Behavior

The whole file is rewritten by `js-yaml` `dump(dna, { lineWidth: -1 })`: every comment is gone and
formatting is normalized. The value change is correct and deterministic, but the provenance
annotations are lost.

## Notes

- Surfaced by the independent review of **task-025** (P2.1, first mutating op) — see that task's
  Execution Notes. The AC (P2.1 / `P2.1-dna-set.feature`) does not require comment preservation, so
  task-025 was merged as-is (`686ffc7`) and this follow-up was opened to track the real gap.
- Root cause: comment loss is inherent to `js-yaml`'s object → YAML `dump` (it parses to a plain JS
  object, discarding comment tokens). A fix needs either a comment-preserving YAML round-trip
  (e.g. an AST/CST-based editor such as the `yaml` package's `Document` API) or a scoped
  line-level edit of only the target key.
- Matters most for WingFoil's **own** dogfooding config, whose determinism/traceability story leans on
  the `[SPEC]`/`[AUTHORING]` annotations; a greenfield user project without comments is unaffected.
- Determinism (REQ-SYS-07) is not regressed — the rewrite is byte-stable; only comments/formatting
  are lost.

## Triage & Execution Notes

- 2026-07-07 (open): raised from task-025 review as a `medium`-severity follow-up. Not yet triaged
  into a fix task; no `bug:`-linked task exists yet. Candidate fix approaches noted above.
- 2026-07-08 (triaged, DEFERRED): assessed **medium**. Does NOT fail any v0.1 journey — a greenfield
  project's `dna.yaml` carries no `[SPEC]`/`[AUTHORING]` comments to strip, and the hand-edit
  workaround exists (task-031 used exactly that on WingFoil's own comment-rich config). **Explicitly
  deferred by the approver from the v0.1 release** — not a release blocker; scheduled for a v0.2/patch
  (comment-preserving `dna set` via a CST/AST YAML editor). To be surfaced in v0.1 release notes as a
  known limitation.
- 2026-09-16 (in-progress → in-review): fixed by `task-063-fix-dna-set-comment-preservation` (its only
  fix task). `dna set` now writes through a minimal **in-place textual edit**
  (`setDnaValueInText`, `src/dna/set.ts`) — one line rewritten or inserted, every other byte untouched
  — instead of `dump()`-ing the whole document. Verified on this repository's own `dna.yaml`: a
  `dna set project.name` is a 1-insertion/1-deletion diff with all 44 comment lines and 23
  `[SPEC]`/`[AUTHORING]` markers intact, and an inline annotation keeps its column. **No production
  dependency added** — the CST/AST YAML editor floated above was rejected against
  `dl-010-minimal-dependencies`. Residual, deliberately out of scope: targets that are block scalars
  (`>-`, `|`), open a nested block, or sit under a sequence still fall back to the whole-file `dump()`
  and still lose comments; widening that would need the CST library and therefore a dl-010 exemption.
