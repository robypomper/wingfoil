---
id: "spec-013-directive-frontmatter-schema"
type: tech-spec
title: "Directive frontmatter schema: the Directives pillar's per-file YAML frontmatter shape"
status: approved
scope: "docs/self/.wingfoil/directives/**/*.md frontmatter (the Directives pillar file shape loaded by src/directives)"
supersedes: ""
tmpl_version: 260703
---

## Context

The Directives pillar is one of the four independently-loadable config artefacts required by
**REQ-SYS-02** (`docs/02_requirements/03_sard/01_architecture.md`) — alongside `memory.yaml` (DNA
`spec-001`), `dna.yaml` (`spec-002`), and `workflows.yaml` (`spec-003`). Each pillar "owns its own
schema and its own validation pass", and `task-004-decoupled-pillars` built the per-pillar loaders
(`src/directives` → `DirectiveFrontmatter`, wired through `src/core`'s pillar loaders and the shared
two-pass pipeline of `spec-009`).

Unlike the other three pillars, the Directives pillar had **no dedicated tech-spec** when its schema
was first written: `spec-010-memory-frontmatter-schema`'s scope is explicitly
`docs/self/docs/04_memory/**/*.md` (Memory documents), **not** `.wingfoil/directives/**`. So the
`DirectiveFrontmatter` schema shipped in `task-004` as an explicit `[AUTHORING]` shape grounded in the
ten real files under `docs/self/.wingfoil/directives/custom/*.md`, with a single field (`name`)
traced to a BDD scenario. This spec closes that traceability gap: it is the authoritative definition
of the Directives-pillar file shape, retroactively blessing (and where noted, constraining) the shape
`task-004` implemented. It is deliberately **minimal** — it fixes only what the loader must enforce to
keep the pillar decoupled and to satisfy the one BDD contract that touches directive frontmatter; it
does **not** specify directive *body* content (the rule text a directive carries), which is authored
prose, not a validated schema.

Two upstream anchors bound this shape:

- **P3.5 (project directives)** — `docs/02_requirements/02_bdd/features/p3-directives/P3.5-project-directives.feature`
  has an explicit "Error — a directive file missing required header fields" scenario: a custom
  directive file that lacks its required `name` header is reported as invalid. This is the one
  hard `[SPEC]` requirement in the schema.
- **P3.8 (built-in directive templates)** — every `kind: custom` stand-in file cites `ref: [P3.8]`
  (see `CLAUDE.md` §3 / `docs/self/.wingfoil/README.md`): the official P3.8 built-in templates are
  not implemented yet, so the ten current files live under `directives/custom/` as stand-ins. The
  schema must accept both `kind` values (`custom` today; `built-in` once those ship) without change.

> **Note on the `task-004` Acceptance Criteria wording.** REQ-SYS-02's AC (and `task-004`'s copy of
> it) writes the fourth pillar as `directives/*.yaml`. The real files are **`.md` with YAML
> frontmatter**, not `.yaml`. That AC phrasing is a literal error; this spec uses the real extension.

## Specification

### File shape

A Directives-pillar file is a Markdown file under `docs/self/.wingfoil/directives/{custom,built-in}/`
whose leading YAML frontmatter block (delimited by `---` … `---`, extracted per `spec-011`'s storage
layer) validates against the schema below. The Markdown body after the frontmatter is the directive's
rule text and is **out of scope** for this spec (not schema-validated).

### Frontmatter fields

Validated structurally (`spec-009` Pass 1, Zod) with `.passthrough()` — unknown keys are preserved and
surface as a warning (`spec-009` §2), never a failure, so the shape stays forward-compatible.

| Field   | Type                | Req?      | Provenance    | Notes |
|---------|---------------------|-----------|---------------|-------|
| `id`    | string              | required  | `[AUTHORING]` | Stable directive identifier (e.g. `code-quality`); matches the filename stem. |
| `name`  | string              | required  | `[SPEC]` P3.5 | Human-readable directive name. **The one field whose required-ness is mandated by an upstream BDD scenario** — a file lacking it is reported invalid (P3.5 "missing required 'name' header"). |
| `type`  | literal `directive` | required  | `[AUTHORING]` | Pillar discriminator; every directive file carries exactly `type: directive`. |
| `kind`  | string              | required  | `[AUTHORING]` | `custom` (the P3.8 stand-ins today) or `built-in` (once official templates ship). Left as `string`, not an enum, so `built-in` needs no schema change (see Context, P3.8). |
| `title` | string              | required  | `[AUTHORING]` | Display title; currently identical to `name` on every file, but kept distinct to mirror the other pillars' `title`. |
| `tags`  | string[]            | optional  | `[AUTHORING]` | Free-form classification tags. |
| `ref`   | string[]            | optional  | `[AUTHORING]` | Upstream traceability references (feature IDs like `P3.8`, REQ codes, or requirement doc paths). May be empty (`[]`) for pure-WingFoil conventions (e.g. `doc-versioning`). |
| `scope` | string              | optional  | `[AUTHORING]` | Present as `scope: global` on the two directives bound to every role (`doc-versioning`, `security-secrets`; `roles.yaml` "global"). Absorbed by `.passthrough()`; documented here so it is not read as an "unknown field". |

### Reference implementation

`src/directives/schema.ts` (`task-004-decoupled-pillars`) is the shipped realization:

```ts
export const DirectiveFrontmatter = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.literal('directive'),
    kind: z.string(),
    title: z.string(),
    tags: z.array(z.string()).optional(),
    ref: z.array(z.string()).optional(),
  })
  .passthrough();
```

`scope` is intentionally **not** a declared key — it rides `.passthrough()`. A future revision may
promote it to a declared optional field once more than two files use it (removing its passthrough
warning); doing so is a pure-additive change under this spec.

### Isolation obligation (REQ-SYS-02)

The Directives loader (`loadDirectives` in `src/core`) validates each directive file independently and
must not depend on `memory.yaml`, `dna.yaml`, or `workflows.yaml` — a validation failure in any other
pillar must not block loading directives, and vice versa (exercised by `task-004`'s
`test/core/pillar-isolation.test.ts`).

## Consequences

- **Stable for:** `task-004-decoupled-pillars` (the loader already built against this shape) and any
  later Directives-pillar feature work (P3.5/P3.6/P3.8 — directive loading, role→directive binding,
  built-in templates). Those consume this shape rather than re-deriving it.
- **`[AUTHORING]` fields may tighten later.** Only `name`'s required-ness is `[SPEC]` (P3.5). The
  required-ness of `id`/`type`/`kind`/`title` is authoring-level, grounded in "every current file
  carries them". If a legitimate future directive omits one, `loadDirectives` would reject the whole
  pillar — revisit this spec (and the schema) before adding such a file, rather than loosening it
  reactively. Making any of them optional is a backward-compatible change; making a new field
  required is not.
- **`kind` stays a `string`, not an enum**, precisely so the eventual P3.8 `built-in` directives load
  without a schema/spec change. If a closed value set is ever wanted, that is a superseding revision.
- **Body content is not governed here.** A separate spec would be needed if directive *rule text*
  ever gains a required structure (e.g. mandatory sections) — this spec is frontmatter-only.

## Process Notes

Authored **reactively** as a fast-follow to `task-004-decoupled-pillars`, not proactively by
`release-planning/identify-specs`. Why identify-specs missed it: the release's spec sweep enumerated
one schema spec per *config file* it already knew needed one (`spec-001/002/003` for the three
`.yaml` pillars) but did not register the Directives pillar as needing its own file-shape spec — the
Directives pillar's files are Markdown-with-frontmatter (visually closer to Memory documents, which
`spec-010` already covered) rather than a standalone `.yaml`, so it fell between the two. `task-004`'s
`design` phase surfaced the gap but, on the approver's instruction, proceeded with an `[AUTHORING]`
schema and deferred the spec to this fast-follow rather than halting the task. Feedback for planning:
when a pillar is enumerated in a REQ (REQ-SYS-02 lists four), cross-check that each has either its own
schema spec or an explicit note that it shares another's — the Directives pillar had neither.
