---
id: "bug-068-spec-015-names-a-bare-readme-offset-in-durable-prose"
type: bug
title: "spec-015 cites `README.md:115` as a bare line offset in three durable paragraphs, including the one explaining which offsets it declines to convert"
status: open
severity: "low"
release-origin: "v0.2"
release: ""
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`spec-015-packaging-publishing` names `README.md:115` as a bare `path:line` citation in three
paragraphs, all of them durable prose rather than note-like sections. `dl-075` is `ready` and says a
durable citation names something the file carries — a symbol, a heading, or a verbatim quotation —
plus the commit read at. One of the three occurrences is inside the sentence that explains which
offsets the document is deliberately leaving unconverted, so the document reproduces the practice in
the act of accounting for it.

## Steps to Reproduce

```
$ grep -c 'README.md:115' docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md
3
```

The three sit in §1's release-relevant standing bullet, in the *§1 Node floor* Revision note's *What
remains open* paragraph, and in the `dl-075` paragraph of the *§3 stage 1* Revision note. Read on
`main` at `710a824`.

## Expected Behavior

Per `dl-075`, durable prose names the §1 install bullet — or quotes it — rather than pointing at a
line number. The quotation is already available in the document: the *What remains open* paragraph
prints the sentence verbatim beside the offset, so converting it costs the offset and nothing else.

## Actual Behavior

Three bare offsets in an `approved` tech-spec, one of them in the paragraph that exists to explain the
convention's boundary.

## Notes

**The offsets are correct today**, which is the whole point of `dl-075` rather than a defence: a stale
citation and a correct one are indistinguishable to a reader, and correctness is a property of the
moment. `README.md` line 115 does currently read "This installs the `wingfoil` binary (Node.js 18+
required)." The decay is already observable *inside* `spec-015` itself — the third occurrence moved
from line 321 to line 326 when `task-085` inserted a Revision note above it — so the document has
already demonstrated, on itself, that the thing it points with does not stay put.

**Why this is filed rather than fixed in passing.** `task-084` introduced two of the three and was
approved; `task-084`'s approve commit (`225aa26`) flagged the meta-mention explicitly, judging it "a
meta-mention rather than a citation, so it is not an AC5 breach, but it will decay like any other",
and filed nothing. `task-085` then proposed it a second time in its own notes and correctly left it
alone, because it fell outside the fix-on-touch boundary written into its acceptance criteria — it is
a different paragraph from the ones that task edited. **Proposed twice, scheduled never** is the decay
`bug-062` was opened about, so the second proposal becomes an element instead of a third mention.

Note what is *not* in scope here. `README.md`'s own "Node.js 18+ required" text is stale after
`adr-010` and is a different defect; `spec-015` §1 already records it as owned by the `user-docs`
release gate (`dl-013`), and that phase has no plan yet. This bug is only about how the spec points at
that line, not about the line's content. Fixing the README will not fix this, and fixing this will not
fix the README.

The fix is one clause in each of three paragraphs, under `dl-047`'s in-place amendment rules with a
dated Revision note — the same shape `task-084` and `task-085` used. It is a natural companion to
whichever task next edits those paragraphs, or to the `user-docs` gate when it finally corrects the
README sentence itself.

## Triage & Execution Notes

- triage (2026-09-22): **low**. Nothing is wrong today and no gate is affected; the cost is a citation
  that will silently stop resolving, in a document the `release-publishing` phase reads. It is filed
  for a process reason as much as a technical one — it is the test of whether `dl-075`'s fix-on-touch
  disposition actually produces elements for what it declines to touch, or quietly accumulates them.
- No fix task filed: three clauses in one document, and the sensible carrier is the next task that
  edits those paragraphs. Named here so that carrier is not invented later.
