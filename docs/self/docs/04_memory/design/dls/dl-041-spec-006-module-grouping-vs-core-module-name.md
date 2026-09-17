---
id: "dl-041-spec-006-module-grouping-vs-core-module-name"
type: decision-log
title: "spec-006 §3 groupings are not CoreModule.name — reconcile, and pin where directive verbs register"
status: in-discussion
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`spec-006-core-domain-api.md:108` states that the §3 groupings **are** `CoreModule.name`. That is
false in three places today, and `task-050-directive-create`'s review is what surfaced it.

| operation | §3 heading | actual `CoreModule.name` |
|---|---|---|
| `pathsQuery` | `dna` | `paths` |
| `directivesList` | `directives` | `directives` ✓ |
| `directiveCreate` | `directives` | **`directive`** |

The first drift predates this release (`paths` is a registered module with no `src/paths` directory
behind it). The third arrived with `task-050`, and **arrived correctly**: the acceptance contracts
mandate two distinct nouns, which §3's own CLI/MCP columns already encode.

- BDD: `P3.1-directive-create.feature`, `P3.2-directive-assign.feature` and
  `P3.3-directive-remove.feature` invoke `wingfoil directive …` (singular);
  `P3.4-directives-list.feature` invokes `wingfoil directives list` (plural).
- `spec-006` §3 lists adjacent rows: `directiveCreate` → CLI `wingfoil directive create`, Tool
  `directive.create`; `directivesList` → CLI `wingfoil directives list`, Resource
  `wingfoil://directives/list`.
- `spec-008-cli-grammar.md:36` enumerates nouns as `memory, dna, directive, workflow, agent` —
  singular, and **omits `directives`** even though `directivesList` has shipped since `task-006`.
- `docs/01_vision/X_cli-cmds.md:95-98,258` spells the same split.

Registering `directiveCreate` on the existing `directives` module — which is what `task-050`'s brief
instructed — yields `deriveVerb('directives', 'directiveCreate') === 'directive-create'`, i.e. CLI
`wingfoil directives directive-create` and Tool `directives.directive-create`, failing the P3.1
acceptance contract outright.

Two consequences need settling, because an architect reading §3 today would get both wrong.

## Decision

Two questions, both open.

**A — What is §3's grouping column?** Options:

- **(a) Amend §3's preamble** so the grouping is documented as an *editorial* pillar grouping, with
  the CLI / Tool / Resource columns as the authoritative wire contract. Add `directive` and
  `directives` to `spec-008` §1's noun list. Nothing in code changes; three existing drifts stop
  being drifts.
- **(b) Add an explicit `module:` column to §3** naming the registering `CoreModule`, keeping the
  pillar heading as the human grouping. More precise, more to maintain, and makes future drift
  mechanically checkable.
- **(c) Rename modules to match §3's headings.** Rejected on sight: it re-breaks the P3.1 BDD.

Recommendation: **(b)**, because `CoreModule.name` is wire-visible — it is the CLI noun and the Tool
namespace — so a spec that claims to pin the public surface and then omits it will drift again. (a)
is the cheaper path if the maintenance cost of a fourth column is judged too high.

**B — Where do `directiveAssign` (`task-051`, P3.2) and `directiveRemove` (`task-052`, P3.3)
register?** On the **singular `directive` module**, giving `deriveVerb` → `assign` / `remove` and
Tools `directive.assign` / `directive.remove`, matching their feature files.

This answer currently exists **only** in `task-050`'s Execution Notes. `task-050` is about to become
`done`, and by this project's own rule nothing reschedules a done task's notes — which is the exact
failure mode `dl-015` was raised for, and `dl-015`'s `read_related` covers `depends_on` tasks, not
decision-logs. Whatever is decided under A, B must be recorded here.

## Rationale

The code is right and the spec is wrong, which is the unusual direction — so the correction belongs
in the document, not the implementation. `CoreModule.name` being decoupled from both the `src/`
directory and §3's heading is **established shipped behaviour**, not a `task-050` invention: `paths`
has been exactly that since `task-028`.

The collision risk was checked and is nil: `enumerateOperations` sorts by `module.name.localeCompare`,
`'directive'` and `'directives'` are distinct strings, `deriveVerb` and both registrars are unchanged,
and the parity suite asserts exhaustively that Tools are `['directive.create','dna.set','memory.add']`
with `wingfoil://directive/create` absent from Resources.

Question B is filed here rather than left in notes because it is a one-line instruction whose loss
costs two tasks a rejection each.

## Actions

- Amend `spec-006` §3 per the chosen option (in place, via a `docs(self): implement dl-041` commit —
  the `spec-001` precedent for editing an approved spec without a supersede or a state change).
- Add the missing nouns to `spec-008` §1.
- Hand question B's answer to `task-051` and `task-052` explicitly at their design step.

Related: `dl-040-spec-006-resource-uri-divergence` (same spec, **different column** — dl-040 is
scoped to the Resource-URI column only, so these do not overlap), `dl-015`, `task-050`, `task-051`,
`task-052`.
