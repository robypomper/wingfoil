---
id: "task-110-memory-add-keeps-version-dots-and-sources-every-id-token"
type: task
title: "`memory add` keeps version dots in the slug and gives every `id_pattern` token a declared source"
status: pending
release: "v0.2.2"
priority: "high"
tags: ["v0.2.2", "memory", "id", "cli"]
ref: "dl-107-slug-keeps-version-dots"
bug: []
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here can never leave `triaged`. A single string is still accepted for documents predating dl-045.
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: []
tmpl_version: 260703
---

## Description

`memory add` cannot produce this repository's own version-shaped ids (`dl-107`, reproduced on
`wingfoil@0.2.1`):

- the slug drops dots: `slugifyTitle` (`src/memory/add.ts:26`) turns `v0.2` into `v0-2`, while the id
  validator accepts `[a-z0-9.]`;
- any token other than `{n}` and `{slug}` fails with `missing value for token`. That includes
  `release`'s `{kind}-{version}` (`dl-092`), `release-line`'s `rl-{version}` and `plan`'s
  `{workflow}-{phase}-plan`.

**Why before the root move.** Once `task-111` lands, the verbs run on this repository, and its
`release`, `release-line` and `plan` patterns must be producible. The retrospective pulled `dl-107`
into v0.2.2 for exactly this reason (row 19).

The contract is `spec-001`'s id_pattern section as amended on 2026-09-29 (`0f68c739`, fixed in
`33d89b7c`). It follows `dl-107`'s ratified options: S1 (a), S2 (a)+(c) and S3 (a).

## Acceptance Criteria

1. **S1 (a).** `slugifyTitle` keeps a `.` between two alphanumerics and collapses every other run
   outside `[a-z0-9]` to `-`, so the slugifier and the validator share one rule. `"v0.2"` gives
   `v0.2`, and `"a . b"` gives `a-b`. *Red-first.* Ids that already exist are untouched: an id is
   immutable once added.
2. **S2 (a).** A token `{<field>}` gets its value from a frontmatter field of the same name, given on
   the command line through the option `spec-008` defines. `memory add` also writes that value into
   the field, so the id and the field cannot disagree. A token with no value fails and names the
   token. *Red-first.*
3. **S2 (c).** `{workflow}`, `{phase}` and `{scope}` are accepted the same way from the CLI. Where the
   type has a field of that name (`plan`), one value fills both. *Red-first.*
4. **`spec-008-cli-grammar` amended** (`dl-107` Action 2): the option's name, its repeatable
   `name=value` shape and its error cases.
   - The name is **not** `--field`. `spec-008` retired that name for DNA paths under `dl-082`, so
     reusing it would collide.
   - The amendment is a dated revision note, as `spec-015`'s are, and the approver signs it off at
     review.
   - `docs/cli-reference.md` gets the new option, which keeps `test/docs/cli-reference.test.ts` green.
5. **S3 (a).** A `memory.add` action in a workflow file may carry an `id_pattern` argument. The
   workflow schema validates it like any other pattern. Dotted tokens such as `{release.version}`
   stay undefined until `dl-090`, and their rejection is pinned by a test. *Red-first.*
6. End to end, on a scratch repository configured like this one: `memory add --type release` with
   `kind=patch` and `version=v0.2.3` produces `patch-v0.2.3`, with both fields written.

## Implementation Notes

- The `{version}` row of `spec-001` no longer says "supplied by `--version`". There is one generic
  mechanism, not one option per token.
- Keep the expansion order `spec-001` fixes: `{date}` → `{author}` → field and context tokens →
  `{slug}` → `{n}`.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
