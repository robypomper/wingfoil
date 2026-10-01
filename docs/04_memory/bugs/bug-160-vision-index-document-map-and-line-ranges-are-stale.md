---
id: "bug-160-vision-index-document-map-and-line-ranges-are-stale"
type: bug
title: "`docs/01_vision/00_index.md`'s document map gives stale versions, dates and line counts for five vision documents, and its line-range navigation no longer matches the files"
status: in-review
severity: "low"
release-origin: "v0.2.2"
release: "v0.3"
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`docs/01_vision/00_index.md` is the navigation index of the vision package. Its document map says
"Versions/dates/status are taken from each file's own header (the source of truth for freshness)",
and its body gives line ranges (`L217–262`, …) so a reader can open only the relevant part of a
file. The file has not changed since `0927f5df` (2026-06-29, `git log -1 -- docs/01_vision/00_index.md`).
Since then five of the documents it maps have been edited, the last three by `task-121` (merge
`3cc8fd77`), so the map and the line ranges no longer match the files.

## Steps to Reproduce

1. On `main` at `3cc8fd77` or later, read the document map in `docs/01_vision/00_index.md`
   (lines 35–43).
2. For each document, read its header (`grep -m1 '^\*\*Version'`, `grep -m1 '^\*\*Date'`) and count
   its lines (`wc -l`).

## Expected Behavior

The map shows each file's header version and date and its current line count. The line ranges point
at the sections they name. Or the index says when it was last reconciled, and a check keeps it
honest.

## Actual Behavior

Measured on 2026-09-29, index versus file:

| Document | Version | Date | Lines |
|---|---|---|---|
| `01_product-brief.md` | 1.2 vs **1.4** | 2026-06-23 vs **2026-09-29** | 306 vs **308** |
| `06_features.md` | 1.2 vs **1.4** | 2026-06-24 vs **2026-09-28** | 508 vs **515** |
| `07_sequencer.md` | 1.3 vs **1.4** | 2026-06-24 vs **2026-09-29** | 345 vs **445** |
| `08_mvp-canvas.md` | 1.1 vs **1.2** | 2026-06-24 vs **2026-09-29** | 193 vs **196** |
| `X_cli-cmds.md` | 1.1 vs **1.3** | 2026-06-24 vs **2026-09-24** | 325 vs **393** |

The other four rows match. "Last indexed" still reads 2026-06-25. The index carries 91 lines with
`L<n>` references (`grep -c "L[0-9]" docs/01_vision/00_index.md`). For the sequencer, which grew by
100 lines, the ranges are certainly wrong. For the other four they are likely wrong wherever the
edits fall before the referenced line.

## Notes

- Found at `task-121`'s review (2026-09-29). `task-121` corrected the same kind of drift in
  `08_mvp-canvas.md`'s reference table at the approver's request, and left the index. The approver
  ruled that the index should have been corrected in the same task, and had this bug filed.
- Nothing checks the index against the files, so every vision edit re-opens the gap. The fix can
  regenerate the map and the ranges. It can also add a test like `test/docs/`'s, comparing the map's
  version, date and line count with each file's header and `wc -l`.
- `08_mvp-canvas.md`'s reference table is a second copy of the same versions. The fix may point it at
  the index instead of keeping two copies.

## Triage & Execution Notes

<!-- triage (bug-ingest): severity call; fix: pointer to the fix task(s). -->
