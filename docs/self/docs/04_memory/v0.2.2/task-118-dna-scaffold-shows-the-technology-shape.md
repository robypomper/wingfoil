---
id: "task-118-dna-scaffold-shows-the-technology-shape"
type: task
title: "The `init`-scaffolded `dna.yaml` shows the `{name, category}` shape of a technology"
status: backlog
release: "v0.2.2"
priority: "low"
tags: ["v0.2.2", "init", "dna", "first-use"]
ref: "bug-139-dna-scaffold-hides-required-category"
bug: ["bug-139-dna-scaffold-hides-required-category"]
depends_on: []
tmpl_version: 260703
---

## Description

`wingfoil init` scaffolds `stacks.technologies: []` with no example of the required
`{name, category}` shape. A first edit therefore fails schema validation on a field the author never
knew about (`bug-139`). The scaffold is generated in `src/storage/templates.ts`. This closes
`bug-139`.

## Acceptance Criteria

1. The scaffolded `dna.yaml` shows the shape, as a comment or a commented-out example entry, with
   `category` visible. *Red-first:* a test asserts it on the scaffold's text.
2. Uncommenting the example as written gives a `dna.yaml` that validates. *Red-first.*
3. A freshly scaffolded project still validates unedited. *Characterization.*
4. `npm test` green.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
