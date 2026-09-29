---
id: "task-110-memory-add-keeps-version-dots-and-sources-every-id-token"
type: task
title: "`memory add` keeps version dots in the slug and gives every `id_pattern` token a declared source"
status: in-progress
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

### design (architect) — 2026-09-29

**`depends_on: []`** — no upstream task's Execution Notes to read (`dl-015` gate is vacuous). `bug: []`,
so `bug.sync_state` is a no-op for every transition of this task.

**Specs.** `grep -m1 '^status:'` on the three inputs → `spec-001-memory-yaml-schema: approved`,
`spec-008-cli-grammar: approved`, `dl-107-slug-keeps-version-dots: ready` (approve commit `35d163af`,
S1 (a), S2 (a)+(c), S3 (a)). `spec-001`'s id_pattern section is the contract as amended in `0f68c739`
and fixed in `33d89b7c` (`git log --oneline -- …/spec-001-memory-yaml-schema.md`). `dl-090` (dotted
tokens) is `ready` but unimplemented, so dotted tokens stay undefined here (AC 5).

**`spec-008` amendment (AC 4, needs the approver's sign-off at review).** New §10 plus a dated
revision note, committed on this branch as content only (status stays `approved`, no `version:` field
to bump — tech-specs carry none, `dl-047`). The option is **`--set <name>=<value>`**, repeatable:
- not `--field` (retired by `dl-082` for DNA paths; `grep -rn -- "--field" src` → nothing);
- not one option per field: the field names are the project's own, and the first one, `version`, is
  `spec-008` §2's global action flag, so `--version v0.2.3` would print the CLI version and exit `0`
  (the collision §9's `entry-` prefix exists for; measured on the built CLI in the AC 6 section);
- no other `set` option exists (`grep -rn "name: 'set'" src` → nothing).
Error cases, exit codes and messages are pinned in §10's table; exit `2` for spelling faults, exit `1`
for faults that need the committed `memory.yaml` (`dl-080` (B)).

**Design.**
- `slugifyTitle` (`src/memory/add.ts`): keep `.` only between two `[a-z0-9]`, collapse the rest.
- New pure helpers in `src/memory/add.ts`: parse the repeatable `--set` list (usage errors), list a
  pattern's tokens, materialize field/context tokens into the `id_pattern` **before** `{slug}`/`{n}`
  (so the counter regexp sees the materialized prefix — spec-001's order `{date}` → `{author}` →
  field/context → `{slug}` → `{n}`), and pick which values are written to frontmatter (context tokens
  only where the committed scaffold declares the key). `{date}`/`{author}` have no implementation
  today (`grep -rn "{date}\|{author}" src` → nothing) and stay out of scope: `--set` refuses them as
  reserved, and a pattern using them keeps failing with `missing value for token`.
- `CoreOption.repeatable` (`src/core/registry.ts`) + Commander collector in `src/cli/program.ts`; the
  option-values record widens to `string | readonly string[]`.
- `memoryAddFn` passes the values to the id, the path (`{release-line}`, `{scope}`) and the document.
- Workflow schema (`src/workflow/schema.ts`): `Phase.actions` gets a refinement that validates the
  `id_pattern:` argument of any `memory.add(...)` action with a new shared
  `idPatternIssues` (`src/validation/id.ts`) — literal characters in `[a-z0-9-.]`, tokens `n…` or
  `[a-z][a-z0-9_-]*`, a dotted token refused naming `dl-090`.

**AC classification (T1).**

| AC | Class | Why |
|---|---|---|
| 1 — slug keeps dots | red-first | `slugifyTitle('v0.2')` returns `v0-2` today (`dl-107` reproduction) |
| 2 — `{<field>}` from `--set`, written back | red-first | no such option; `memory add --help` lists `--type`, `--title`, `--tags` |
| 3 — `{workflow}`/`{phase}`/`{scope}` from the CLI | red-first | same mechanism; `{scope}` is a path token |
| 4 — spec-008 amended, cli-reference documents the option | characterization (docs) | documentation; `test/docs/cli-reference.test.ts` checks command headings only and stays green — the option's own presence is pinned by a red-first CLI test under AC 2 |
| 5 — workflow `id_pattern` argument validated, dotted token rejected | red-first | `Phase.actions` is `z.array(z.string())`, accepts anything |
| 6 — e2e `patch-v0.2.3` | characterization (manual e2e) | end-to-end run of AC 1–3 on a scratch repo, recorded below |

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
