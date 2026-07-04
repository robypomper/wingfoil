---
id: spec-010-memory-frontmatter-schema
type: tech-spec
title: "Memory document base frontmatter schema"
status: approved
scope: "docs/self/docs/04_memory/**/*.md frontmatter"
supersedes: ""
tmpl_version: 260703   # Orignal template version
---

## Context

`spec-001-memory-yaml-schema` defines the **type registry** — `memory.yaml`'s `types.*` map, each
type's `path` pattern, `id_pattern`, and per-type `states` machine. This spec sits one layer below
it: it defines the **document-instance contract** — the actual YAML frontmatter block that every
file matching a type's `path` pattern under `docs/self/docs/04_memory/` carries once
`wingfoil memory add`/`submit`/`approve`/`reject`/`deprecate` has touched it.

Without a single shared base-field definition, every consumer that reads Memory frontmatter
(the state-derivation logic behind REQ-STATE-01/REQ-STATE-02, `wingfoil memory show`/`search`,
the context loader in `spec-012-context-loader-relevance-filtering`, and any future Zod validator
per `spec-009-validation-strategy`) would have to re-derive which fields are common to all seven
types (`release-line, release, task, adr, decision-log, tech-spec, bug`) versus which are
type-specific, and would disagree on where audit history and version bookkeeping live.

**Ground truth, not aspiration.** The seven scaffold files under
`docs/self/.wingfoil/memory/templates/*.md` are the actual current definition of what a freshly
created document of each type looks like — this spec transcribes their common structure. It
deliberately does **not** invent a `wingfoil:` namespace block, a `state_history[]`/`review[]`
audit array, or a per-write incrementing `version` counter — none of those exist in the real
templates.

## Specification

### Zone model

A Memory document instance's frontmatter is **flat YAML** — a single top-level mapping, no nested
namespace block. Two zones, both flat:

1. **Base fields** — present on every type, defined below.
2. **Type-specific fields** — additional flat keys declared by that type's
   `template.frontmatter.required` list in `memory.yaml` (`spec-001`), scaffolded in that type's
   `.wingfoil/memory/templates/{type}.md`.

A `.md` file under a Memory `path` pattern without a `type` key matching a registered
`memory.yaml` type key is not a Memory document for state-derivation purposes.

### Base fields (all seven types)

| Field          | Type    | Required | Set by                                    | Description / constraints                                                                                                                                                   |
|----------------|---------|----------|--------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `id`           | string  | yes      | `memory.add` (from the type's `id_pattern`) | Placeholder `"{auto}"` in the raw scaffold before `memory.add` resolves it; thereafter the generated id (e.g. `task-042-implement-cli-grammar`, `adr-004-...`, `rl-v1`). Must match the file stem (`{id}.md`) and the type's `id_pattern` in `memory.yaml`. |
| `type`         | string  | yes      | `memory.add` (fixed by the scaffold used)  | Must be a key registered in `memory.yaml` `types:` (one of `release-line, release, task, adr, decision-log, tech-spec, bug`).                                                |
| `title`        | string  | yes      | `memory.add` (if the add action sets it) or `memory.submit` | Human-readable title. Empty in the freshly added `draft` scaffold; **must** be filled before `memory.submit` moves the document past `draft` — every type lists `title` in its `template.frontmatter.required` (verified against all seven templates). |
| `status`       | string  | yes      | every state transition (`memory.add`/`submit`/`approve`/`reject`/`deprecate`) | Current lifecycle state. Set to the type's `states.initial` (`draft` for every type currently declared) at `memory.add`; thereafter must be a value in that type's `states.values` list. This is the **only** state carrier — REQ-STATE-01/02: no separate `.wingfoil/state/` index; state is recomputed by reading `status` at a given git commit. |
| `tmpl_version` | integer | yes      | `memory.add` (copied from the scaffold)    | The originating template scaffold's build stamp, `YYMMDD` as an integer (e.g. `260703`). Fixed at creation and **not** touched again by WingFoil — it identifies which revision of `.wingfoil/memory/templates/{type}.md` produced this file, for detecting documents scaffolded from a stale template. It is not a per-write counter (see "No document-version counter" below). |
| `rejection_reason` | string | no (optional) | `memory.reject` (set); `memory.submit` (cleared) | Absent until the document's first `memory.reject`. Set to the exact `--reason` text passed to `wingfoil memory reject` at the same time `status` moves to the type's `gates.<state>.reject` target (`spec-001`). The next `memory.submit` on this document clears it (removes the key from frontmatter) as part of moving `status` forward again — it reflects only the **most recent** reject, not a history. Its presence is therefore itself a signal: a document carrying `rejection_reason` was submitted at least once (had real content) and sent back, distinguishing it from a document still in its first, never-submitted `draft`. This is a convenience mirror of the `Reason:` trailer that `memory.reject`'s commit body already carries (P1.7/REQ-SEC-04) — the commit body remains the authoritative audit-trail record; see "No document-version counter" below for why this does not reopen the door to a fuller in-frontmatter audit trail. |

All type-specific required fields (e.g. `adr.sard_ref`, `task.release`, `release.version` /
`pillar` / `features` / `requirements` / `release-line`, `release-line.version`, `bug.severity`)
are out of scope here — they belong to each type's own template and, at the schema-registry level,
to `spec-001`'s `template.frontmatter.required` list per type. This spec guarantees the five required
fields above are present, in that role, on every type, plus the one optional `rejection_reason` field
whose presence/absence is itself meaningful (see its row above).

### Document template shape (what `memory.add` produces)

Every scaffold under `.wingfoil/memory/templates/*.md` follows this shape (task shown; other types
differ only in which type-specific keys appear after `status`):

```yaml
---
id: "{auto}"           # auto-generated by wingfoil
type: task
title: ""              # REQUIRED — e.g. "Implement git-backed Memory store (REQ-SYS-01)"
status: draft
release: ""            # REQUIRED — target release version, e.g. "v0.1"      <- type-specific
priority: ""           # optional — high | medium | low                     <- type-specific
tags: []               # optional — additional labels                      <- type-specific
ref: ""                # optional — backlog item ID                        <- type-specific
bug: ""                # optional — source bug id                         <- type-specific
tmpl_version: 260703   # Orignal template version
---
## <body sections, template placeholder comments>
```

`memory.add` resolves `id` from `"{auto}"`, sets `type`/`status`/`tmpl_version`, and otherwise
copies the scaffold verbatim — the body stays as template placeholder comments, with no content
written yet at this step. `memory.submit` fills `title` and all
other required fields and replaces every placeholder comment with real content, moving `status` to
the type's post-submit state.

### No document-version counter, no in-frontmatter audit array

The base schema carries **no** `version` (per-write increment), `state_history[]`, or `review[]`
field. `rejection_reason` (above) does **not** contradict this: it is a single scalar mirroring only
the *current* document state (present ⇔ "this document was rejected and has not yet been
resubmitted"), overwritten in place on every reject and cleared on every submit — it never
accumulates entries and carries no history of its own, so it is not a counter and not an audit array.
This is a deliberate departure from prior-art draft `F-04-frontmatter-schema.md`, which
proposed a nested `wingfoil:` block with exactly those three fields as the audit trail. Two
grounds for the departure:

1. **It does not match the real templates.** None of the seven `.wingfoil/memory/templates/*.md`
   scaffolds declare `version`, `state_history`, or `review`; every one uses the flat five-field
   shape above plus `tmpl_version`.
2. **It is redundant with git, and the git-based design is already normative.** REQ-STATE-02
   requires state to be recomputable purely from Memory files at a given commit, with no
   `.wingfoil/state/` artifact needed for correctness; git itself already carries the audit
   role (REQ-SEC-02) — every `memory.submit`/`approve`/`reject`/`deprecate` is exactly one commit,
   and `memory.approve`/`memory.reject` commits carry the approver identity and reason as explicit
   `Approver:` / `Reason:` trailers in the commit body (REQ-SEC-04), with the timestamp supplied by the git
   commit itself. `wingfoil memory history` (P1.10) reconstructs the same audit trail F-04 wanted
   to keep in-frontmatter by walking `git log` on the file's path, not by reading a frontmatter
   array. Keeping a parallel in-frontmatter copy would be two sources of truth for one fact.

### Field-write ownership

| Operation           | Fields it may change                                                        |
|----------------------|-------------------------------------------------------------------------------|
| `memory.add`         | `id` (from placeholder), `type`, `status: draft`, `tmpl_version`, any field the specific add action pins (e.g. `version` for a `release-line`); everything else stays at template defaults |
| `memory.submit`      | `title`, all other required type-specific fields, `status` (→ the type's post-submit state), body content, and clears `rejection_reason` if present (removes the key) |
| `memory.approve`     | `status` only (frontmatter); approver identity + reason live in the commit message, not frontmatter |
| `memory.reject`      | `status` (frontmatter) and `rejection_reason` (set to the `--reason` text); approver identity + reason also live in the commit message per P1.7 — the frontmatter copy is a convenience, not a replacement |
| `memory.deprecate`   | `status: deprecated` (or a type-specific deprecate-adjacent state first, e.g. `accepted → superseded`) |

`memory.approve` changes **only** the `status` field and no other frontmatter field. `memory.reject`
changes `status` plus `rejection_reason` — the one exception to "status only" among the transition
verbs, matching the field-write ownership table above.

### Validation rules

| Rule                                                                                   | Failure                                                    |
|------------------------------------------------------------------------------------------|-------------------------------------------------------------|
| `id` must match the file stem (`{id}.md`)                                               | id/filename mismatch                                        |
| `id` must match the owning type's `id_pattern` (`memory.yaml`, `spec-001`)              | invalid id for type                                          |
| `type` must be a key registered in `memory.yaml` `types:`                               | unknown type                                                  |
| `status` must be a value in the type's `states.values`                                  | invalid state for type                                        |
| `tmpl_version` must be present and equal to an integer the type's template has carried  | stale/unknown template version (non-fatal — informational)   |
| `title` must be non-empty once `status` is anything other than `draft`                  | missing title on submit                                      |
| Every field in the type's `template.frontmatter.required` must be non-empty once `status` is anything other than `draft` | missing required field on submit                              |

## Consequences

- Any future frontmatter validator (`spec-009-validation-strategy`) targets this flat five-field
  base plus per-type required fields — **not** a nested `wingfoil:` object. Schema code (Zod or
  otherwise) should define one base object merged with each type's specific-field object, matching
  the flat shape shown here.
- State-derivation and history tooling (`wingfoil memory history`, the workflow phase-completion
  deduction per REQ-SYS-03) reads `status` directly off frontmatter for current state, and
  walks `git log --follow <path>` for history — it must **not** expect a `state_history[]` array in
  the file.
- If a future release genuinely needs an in-file audit cache (e.g. for fast reads without a git
  walk), that is a new, explicitly-justified addition to this spec — not an assumption carried over
  from the unmerged `F-04` draft.
- Type-specific field schemas (the second zone) are each type's own contract, out of scope here;
  changing a type's required fields is a change to `memory.yaml`'s `template.frontmatter.required`
  and that type's `.wingfoil/memory/templates/{type}.md`, not to this spec.

## Process Notes

Grounded against the ground truth in `docs/self/.wingfoil/memory/templates/{adr,task,release,...}.md`,
which uses a flat schema and a static `tmpl_version` build stamp — not a nested `wingfoil:` block,
`state_history[]`/`review[]` audit arrays, or a per-write incrementing `version` counter. This spec has
no per-write counter or audit array to get wrong, since the audit trail is git commits (REQ-SEC-02,
REQ-SEC-04), not a frontmatter log.
