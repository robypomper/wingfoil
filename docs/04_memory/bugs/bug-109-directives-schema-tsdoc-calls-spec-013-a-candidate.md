---
id: "bug-109-directives-schema-tsdoc-calls-spec-013-a-candidate"
type: bug
title: "`src/directives/schema.ts`'s module TSDoc says no approved tech-spec exists for the Directives pillar and names `spec-013` as a candidate — `spec-013` is `approved`"
status: planned
severity: "low"
release-origin: "v0.2"
release: "v0.3"
feature: "P3.5"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

The module doc comment on `src/directives/schema.ts` states that the Directives pillar has no
approved tech-spec, and records `spec-013-directive-frontmatter-schema` as a *candidate* with a
follow-up to promote it. `spec-013` is `approved`.

So the file that implements the frontmatter schema tells a reader the schema is unspecified, and
carries a follow-up that has already happened.

## Steps to Reproduce

Read the module TSDoc, then
`awk '/^status:/{print; exit}' docs/self/docs/04_memory/design/specs/spec-013-*.md` → `approved`.

## Expected Behavior

The module cites the approved spec it implements.

## Actual Behavior

It denies that the spec exists and proposes creating it.

## Notes

**Pre-existing, and larger than one line.** The whole paragraph is written around the premise that no
spec exists — it explains what the schema is derived from *instead*. Correcting it means rewriting
the paragraph and deleting the follow-up, not swapping a word.

**Worth doing while the pillar is being read anyway.** `bug-108` and any work under the new
`command-baseline` directive both land in this area, and this is a paragraph a reader of
`src/directives/` meets first.

**Found by `task-094`, which recorded it as "a finding, not my sentence to rewrite — proposed
below" and then proposed nothing below.** Its reviewer caught the dangling pointer. Filed here so the
finding has the owner the note assumed it already had.

## Triage & Execution Notes

- triage (2026-09-24): **low**. A comment, in a file whose behaviour is correct and tested. Filed
  because it misinforms about governance — it tells a reader the pillar is unspecified, which is the
  opposite of true, and points at work already done.
