---
id: "bug-147-submit-reads-an-empty-list-as-missing"
type: bug
title: "`memory submit`'s required-field check treats a present-but-empty required list as \"missing\", indistinguishable from an absent field"
status: in-progress
severity: "low"
release-origin: "v0.2"
release: "v0.3"
feature: "P1.6"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`src/memory/submit.ts`'s `isEmptyValue` returns `true` for any array with `length === 0`, and
`missingRequiredFields` filters on it — so a required frontmatter field declared as a list (e.g. a
type-level `required: [features]` in `memory.yaml`) that an author has legitimately, explicitly set
to `features: []` is refused by `submit` exactly as if the key were absent altogether.

## Steps to Reproduce

1. `sed -n '18,34p' src/memory/submit.ts`:
   ```ts
   function isEmptyValue(value: unknown): boolean {
     if (value === undefined || value === null) return true;
     if (typeof value === 'string') return value.trim().length === 0;
     if (Array.isArray(value)) return value.length === 0;
     return false;
   }

   export function missingRequiredFields(frontmatter: Readonly<Record<string, unknown>>, required: readonly string[]): string[] {
     const fields = [...new Set(['title', ...required])];
     return fields.filter((field) => isEmptyValue(frontmatter[field]));
   }
   ```
   Line 22 treats an empty array the same as `undefined`/`null`/a blank string.
2. Reproduced end to end (`wingfoil@0.2.1`, fresh project): add `features` to a type's
   `template.frontmatter.required` list in `.wingfoil/memory.yaml`; `wingfoil memory add --type task
   --title "repro empty list"`; hand-set `features: []` explicitly in the body and commit;
   `wingfoil memory submit <id>` → `error: missing required field on submit: features`, exit `1`,
   even though the key is present with an explicit, deliberate empty value.

## Expected Behavior

A required field that is present with an explicit, well-formed empty list is treated as filled in —
"required" should mean "the key must be declared," not "the list must be non-empty," unless
`memory.yaml` separately declares a minimum length for that field.

## Actual Behavior

`missingRequiredFields` cannot distinguish "the author never set this" from "the author set this to
legitimately nothing," so an element that has nothing to declare in a required list field can never
be submitted without either fabricating a value or removing the field from `required` for everyone.

## Notes

- Root cause: `isEmptyValue`'s array branch conflates absence with a legitimate empty collection;
  the function has no way to know whether the type's schema intends "non-empty list required" or
  merely "list key must be present."
- Gate: `dev-loop`'s own required-field tests exercise WingFoil's built-in required sets
  (`id, type, title, status`), none of which is ever meaningfully a list, so an empty-but-required
  list field was never in the test matrix that would have caught this.
- Fix: either drop the array branch from `isEmptyValue` (a present key, even `[]`, counts as filled)
  and let `memory.yaml` express a separate `min_length` constraint for types that truly need a
  non-empty list, or make the distinction configurable per field.

## Triage & Execution Notes

- capture: filed by the v0.2 retrospective (retro-v0.2); reproduced end to end against a custom
  required list field, not merely read from source.
