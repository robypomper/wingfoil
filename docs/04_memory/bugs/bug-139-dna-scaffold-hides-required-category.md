---
id: "bug-139-dna-scaffold-hides-required-category"
type: bug
title: "The `init`-scaffolded `dna.yaml` gives `technologies: []` with no example of the required `{name, category}` shape"
status: in-progress
severity: "low"
release-origin: "v0.2"
release: "v0.2.2"
feature: "P2.4"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`wingfoil init`'s scaffolded `dna.yaml` writes `stacks.technologies: []` with a bare one-line
comment ("technologies + methodologies in use") and no example entry, but the DNA schema requires
every technology entry to carry a `category` field — a hand-added entry that omits it fails
validation with no scaffold text to have warned the author.

## Steps to Reproduce

1. `grep -n "function dnaYaml" -A 45 src/storage/templates.ts` → the `stacks:` block it writes is:
   ```
   stacks:
     technologies: []
     methodologies:
   ${methodologies}
   ```
   — `technologies` has no example entry, unlike `methodologies`, which the same function fills from
   the chosen template.
2. `grep -n "category: z.string()" src/dna/schema.ts` → line 83: the `Technology` entry schema
   requires `category` (not `.optional()`).
3. Reproduced end to end in a scratch project (`wingfoil@0.2.1`, `wingfoil init --template Kanban`):
   hand-add `- name: TypeScript` (no `category`) under `stacks.technologies` in the scaffolded
   `.wingfoil/dna.yaml`, then run `wingfoil dna show modules` (or any `dna`/`paths` read) — the
   entry fails `DnaYaml.safeParse` because `category` is missing, and nothing in the scaffold told
   the author the field exists, let alone that it is required.

## Expected Behavior

The scaffold's `stacks.technologies` comment (or a commented-out example entry, the way
`memory/templates/*.md` use `<!-- -->` placeholders) shows the `{name, category}` shape so a first
edit succeeds instead of failing schema validation on a field the author never knew to set.

## Actual Behavior

`technologies: []` ships with no shape hint at all; the first person to add an entry by hand
following the visible pattern of a bare `- name: ...` list (the same shape the adjacent
`stacks.methodologies` example *would* suggest without its own object fields) hits a schema error
with no scaffold guidance pointing at the missing `category`.

## Notes

- Root cause: `dnaYaml()` (`src/storage/templates.ts`) interpolates a filled example for
  `methodologies` (from the chosen template's own `MethodologyEntry[]`) but leaves `technologies` as
  a bare empty array with no analogous example, even though both are `{name, category}`-shaped
  object arrays under the same schema (`src/dna/schema.ts`).
- Fix: add a commented-out example line, e.g. `# - name: TypeScript` / `#   category: language`,
  matching the density of the template's other scaffold comments, or seed one real entry per
  template default stack.

## Triage & Execution Notes

- capture: filed by the v0.2 retrospective (retro-v0.2), from the `init`-scaffold structural review
  pass.
