---
id: "task-093-dna-mutation-surface-add-remove-update"
type: task
title: "Build the DNA mutation surface dl-081 ratified: `dna add|remove|update --field <full path> --value <v>`, and make the traversal refuse a path that does not resolve"
status: in-progress
release: "v0.2"
priority: "high"
tags: ["v0.2", "dna", "cli", "mcp"]
ref: "dl-081-dna-mutation-surface-shape"
bug: ["bug-084-dna-key-alias-writes-unschemad-keys", "bug-083-dna-set-cannot-write-array-valued-fields"]
depends_on: ["task-091-reads-resolve-at-head"]
tmpl_version: 260703
---

## Description

`dl-081-dna-mutation-surface-shape` is `ready`, ratified as option **(E)**. Today `dna set` reaches
**7 of roughly 38 schema fields** — `version` and the six scalars under `project` — while 11 fields are
array-valued and 17 more live inside array entries, none of them reachable for create, update or
delete. This task builds the ratified surface.

**Two bugs close under it, in this order:**

- **`bug-084`** first, because the ratification makes it a *precondition*: a path that does not resolve
  must be **refused, never created**. `setDnaValue` currently creates an object for any segment it
  cannot descend into, which is how `dna set tech_stack.cli.framework X` writes `stacks.cli.framework`
  — a key in no schema — and commits it at exit 0.
- **`bug-083`** then, which the new verbs close.

## Acceptance Criteria

- **AC1** — **`bug-084` first, and independently verifiable.** After it, a `--field` path that does
  not resolve against the schema is refused at exit `1` naming the path; no intermediate object is
  created; and `dna set tech_stack.cli.framework Commander` fails instead of committing. The DNA
  pillar still **accepts** unknown keys when *reading* a document (pass-through on read is deliberate
  and must not regress) and refuses to *write* one — pin both halves.
- **AC2** — Three verbs exist: `dna add`, `dna remove`, `dna update`, each taking `--field` and
  `--value`, following `memory add --type … --title …`'s option-bearing grammar.
- **AC3** — **`--field` is a full path.** `--field team.roles` and `--field team.members.roles` are
  different fields and both resolve. Entries inside a collection are addressed **by `name`**, not by
  index: `--field team.members.roberto.roles` reaches that member's role list. Indices are not the
  addressing form — `dl-081` records why.
- **AC4** — **Name uniqueness is a prerequisite of AC3 and must be enforced, not assumed.** Add a
  uniqueness refinement per collection to `src/dna/schema.ts`, or make the verbs refuse when a path
  segment matches more than one entry. Choose and argue it; measured today, WingFoil's own `dna.yaml`
  has 45 entries across 11 collections with zero duplicates, so either choice is non-breaking here —
  establish that it is non-breaking for the scaffold templates too.
- **AC5** — All four path shapes work, each pinned: an array of strings at depth 2
  (`paths.sources`); an array of objects at depth 1 (`modules`); an array of objects at depth 2
  (`team.members`, `stacks.technologies`); and a string array nested inside an object array
  (`team.members.<name>.roles`) — the last being the shape that only this addressing form can express,
  and the one `dl-080` made routine.
- **AC6** — `--value` carries the new entry's identity when the path ends at a **collection** and the
  new value when it ends at a **leaf**. State it in `--help` rather than leaving it to be inferred.
- **AC7** — **MCP parity**: three new core functions mean three new Tools per `spec-006` §3 —
  `dna.add`, `dna.remove`, `dna.update`. Check `spec-004`, which owns Tool names, and report whether
  the shape is awkward there; `dl-081` records that a shape awkward on MCP is the wrong shape.
- **AC8** — **Amend the specs**, per `dl-081` action 3: `spec-002` and `spec-006` at minimum, and the
  CLI grammar spec since the grammar grows. In-place dated Revision notes under `dl-047`, the route
  `task-079`/`task-084`/`task-085` used on `spec-015`. A ratified shape that no spec records is the
  defect this whole class came from.
- **AC9** — `dna set` keeps working for scalars and is not removed. Its relationship to the new verbs
  — whether `set` remains the scalar verb or `update` subsumes it — is a decision: make it and say so.
- **AC10** — All six gates green; the full `tsc --noEmit -p tsconfig.json` silent.

## Implementation Notes

- **This is the largest task in the release. If you judge it too large to land coherently, stop and
  report a split proposal rather than half-building it** — a partially implemented ratified grammar,
  where `add` works for members but not modules, is worse than none. `dl-081` action 2 leaves exactly
  this open: whether the whole surface lands or only the collections `dl-080`'s flows need.
- Read `dl-081` in full before designing — the collision measurements, the four shapes, the index
  argument and the two wrinkles are all there, and the ratification's `Reason:` settles three
  questions you would otherwise have to re-open.
- `task-091` runs in parallel and touches the directive role-catalogue read. Coordinate by not
  touching it: this task owns `src/dna/` and the new core functions.
- Classify every AC per `dl-014`/T1.

## Execution Notes

<!-- filled in per phase -->

### design — role: architect

**Baseline.** Worktree `/home/robypomper/Workspaces/.wf2-wt/task-093`, branch
`task/task-093-dna-mutation-surface-add-remove-update`, from `main` at `eca728e`. `npx jest` before
any change: **116 suites / 1833 tests passed**.

#### read_related (`dl-015`, HARD gate)

- **`task-091-reads-resolve-at-head`** — the one `depends_on`. It is running **in parallel** and has
  **no Execution Notes yet**: read from its own branch without entering its worktree,
  `git show task/task-091-reads-resolve-at-head:docs/self/docs/04_memory/v0.2/task-091-reads-resolve-at-head.md`
  → the `## Execution Notes` section is still the empty `<!-- filled in per phase -->` placeholder.
  Acknowledged on its **Description and Acceptance Criteria** instead, which is what exists: it lands
  `dl-080`'s **read** half for `bug-081` (state machine read from the working tree) and `bug-082`
  (`directive assign` validating `--role` against the working-tree role catalogue), following
  `task-090`'s pattern of moving the **baseline** to `HEAD` rather than adding a guard.
  **Interface with this task:** `task-091` owns the directive role-catalogue read; this task owns
  `src/dna/` and the new `src/core` functions. The overlap is `team.roles` — `task-091` changes *which
  copy of `dna.yaml`* a role read resolves against, this task changes *how a path into `dna.yaml` is
  resolved and written*. They meet only in `src/core/index.ts` (both add code) and in
  `src/dna/schema.ts` (this task adds uniqueness refinements; `task-091` reads the catalogue through
  `src/dna/roles.ts`, which is untouched here). No behavioural conflict is expected; the merge is
  textual.
- **`task-092-writes-refuse-a-dirty-target`** is not a `depends_on` but is adjacent: it makes a write
  refuse while its target is dirty. The three verbs added here are writes on `.wingfoil/dna.yaml`, so
  they will inherit that rule when `task-092` lands. Nothing here pre-empts it — this task does not
  touch the commit path.

#### verify_specs

Every artefact this task needs already exists and is `approved`/`ready`; **no new `tech-spec` is
scaffolded**, so the design gate is a pass-through (no approver gate).

- `dl-081-dna-mutation-surface-shape` — `ready`, ratified as option **(E)** in `5aaa5af`. Read in full
  plus the approve commit's `Reason:` block.
- `bug-084-dna-key-alias-writes-unschemad-keys` (`in-progress`), `bug-083-dna-set-cannot-write-array-valued-fields`
  (`in-progress`) — the two bugs closing under this task.
- `spec-002-dna-yaml-schema` (`approved`), `spec-006-core-domain-api` (`approved`),
  `spec-008-cli-grammar` (`approved`), `spec-005-cli-command-contract` (`approved`),
  `spec-004-mcp-surface-contract` — all read; three are amended by AC8 (see below).

#### What the ratification settles, and is therefore not re-opened

Addressing by `name` (never by index); uniqueness as a prerequisite rather than an assumption; a path
that does not resolve is refused, never created; `--value` is the entry's identity at a collection and
the new value at a leaf; nothing extends `DNA_KEY_ALIASES`.

#### Design — the shape this lands

1. **`src/dna/path.ts` (new) — one schema-driven resolver, used by all four verbs.** It walks a
   dotted path against `DnaYaml` **itself** (Zod v4 exposes `def.shape` / `def.element` /
   `def.innerType`, verified to traverse `.passthrough()` and `.superRefine()` nodes alike), never
   against a hand-written table, so the mutation surface cannot drift from the schema it writes.
   Resolution classifies the target as one of: `section` (an object node), `scalar` (a string/number
   leaf), `string-list` (`z.array(z.string())`), `collection` (`z.array(z.object())`),
   `entry` (one element of a collection, addressed by `name`), or a **refusal**. A segment the schema
   does not declare is a refusal — this is `bug-084`'s repair and the precondition `dl-081` names.
   *Pass-through on read is untouched:* the resolver is on the **write** path only; `loadDnaYaml` /
   `dna show` keep returning unknown keys.
2. **`src/dna/mutate.ts` (new) — the pure `add|remove|update` semantics** over a cloned document, so a
   refused mutation leaves the input untouched. No git, no filesystem (spec-006 §1: the pillar stays a
   leaf under `core`).
3. **`src/dna/edit.ts` (new) — the comment-preserving structural edit.** `setDnaValueInText`
   (`task-063`, `bug-004`) rewrites or inserts exactly one **mapping** line and deliberately skips
   every sequence branch, so it cannot express any of the four shapes this task adds; the existing
   fallback for a shape it cannot edit is a whole-file `dump()`, which strips **every** comment
   including the `[SPEC]`/`[AUTHORING]` provenance annotations. That fallback is rare for `dna set`
   and would be the **norm** for `dna add` — on a freshly `init`-ed project every structured add would
   delete the scaffold's own guidance comments — so a sequence-aware minimal edit is part of this
   task, not a follow-up. It keeps the same safety contract as `setDnaValueInText`: return `undefined`
   when no provably-minimal edit exists, and verify every candidate by re-parsing it and comparing the
   **whole document** against the intended object before returning it.
4. **`src/core/index.ts` — three `CoreFn`s** (`dnaAdd`, `dnaRemove`, `dnaUpdate`) following `dnaSet`'s
   mutating-op template verbatim (git-identity pre-flight → argument validation → load → resolve →
   mutate → re-validate the serialized bytes → write + one scoped commit). Kept compact and
   contiguous, since parallel tasks share this file.
5. **Grammar** (AC2/AC3/AC6): `--field` carries the full path, `--value` the payload, plus one
   `--<entry-field>` option per field the entry schemas declare. Option names are the **schema field
   names verbatim** (`--executes_as`, not `--executes-as`): Commander camel-cases a dashed option
   (`--executes-as` → `executesAs`) while `CoreOption.name` is read back by its literal name in
   `buildOptionValues` (`src/cli/program.ts`), so a dashed name would silently never arrive.
   `dl-081`'s `--executes-as` spelling was illustrative of *which* options exist, not of their
   punctuation; the schema-name rule also keeps the option set derivable rather than mapped.
6. **Comma-separated values** where, and only where, the target's schema type is `z.array(z.string())`
   (`paths.*`, `team.members[].roles`, `team.agents[].executes_as`) — the precedent is
   `directive assign --directive testing,code-quality` (`task-056`).

#### Decisions this task owes an argument for

- **AC4 — uniqueness: a per-collection Zod refinement in `src/dna/schema.ts`, not a verb-level
  "refuse on more than one match".** The refinement is the stronger of the two because it makes the
  ambiguity *unreachable* rather than *handled*: once the load path rejects a duplicate, no verb can
  ever see a two-match resolution, so the alternative's check would be unreachable code in every path
  that can actually run — and the `testing` directive forbids adding dead code. It also protects the
  readers that are **not** verbs: `resolveRoleHolders` (`src/dna/roles.ts`), the directive bindings,
  and every future consumer that looks an entry up by name. It is consistent with the precedent
  `spec-002` already sets: `Team.superRefine` is a same-document integrity rule that makes a violating
  file fail to load, and duplicate names are the same kind of rule. The cost — a document that loads
  today would stop loading — is what AC4 asks be measured rather than assumed:
  - `docs/self/.wingfoil/dna.yaml`: **0 duplicates**, 38 object entries across 6 collections plus 8
    strings across 5 `paths` categories (measured by parsing the file, not by reading it).
  - the **scaffold templates** (`dnaYaml()`, `src/storage/templates.ts`) — the second half of AC4, and
    a different question: `modules`, `stacks.technologies`, `team.members` and every `paths` category
    scaffold **empty**, `team.roles` scaffolds 7 distinct names, and `stacks.methodologies` scaffolds
    the chosen template's list (Scrum: `Scrum`, `Specification by Example (BDD)`, `TDD`; Kanban:
    `Kanban`, + the same two) — distinct in both. Pinned by a test over the real `templateScaffold`
    output for **every** registered template, so a future template cannot introduce a duplicate
    silently.
- **AC9 — `dna set` stays, and `update` does not subsume it.** `set` keeps its positional grammar
  (`dna set <key> <value>`), which `P2.1-dna-set.feature`, `spec-002` and `spec-005`'s worked examples
  all name; removing it would break a ratified acceptance contract for no gain. What changes inside it
  is `bug-084`'s repair: it resolves its key through the same `src/dna/path.ts` and refuses a path the
  schema does not declare. `update --field <path> --value <v>` reaches the same scalar leaves *and*
  the structured ones, so `set` becomes the positional shorthand for the scalar case rather than a
  separate mechanism — one resolver, one write path, two spellings.
- **The `tech_stack` alias is removed from the write path and kept on the read path.** `bug-084`'s
  Expected Behavior offers exactly two honest outcomes ("the alias translates the old *shape* as well…
  or the alias is removed and the old path is rejected as the unknown key it is"); a shape migration
  is not a path rewrite, so the second is the only one that can be implemented. `dna show tech_stack`
  keeps resolving (a read, and `P2.2-dna-show.feature` names it); `dna set tech_stack.…` is refused
  as the unknown key it always was. `DNA_KEY_ALIASES` stays exactly one entry and is now documented as
  read-side only — `dl-081`'s "nothing extends `DNA_KEY_ALIASES`", discharged.
- **Exit codes.** A **malformed** path (an empty segment, the BDD's `..language`) stays a usage error
  at exit `2` — `P2.1-dna-set.feature` pins it. A **well-formed but unresolvable** path is a
  validation failure at exit `1`, per `spec-005` §1 and the ruling recorded in `bug-076`'s Correction
  ("a dirty working tree is not a malformed invocation"; neither is a path that names a field the
  schema does not declare). A missing `--field`/`--value` is exit `2` (`spec-008` §5).

#### A consequence AC1 forces, recorded rather than worked around

`P2.1-dna-set.feature`'s first two scenarios are written against the **pre-`stacks`** shape
(`wingfoil dna set tech_stack.language python`, then `"language: python" under "tech_stack"`). They
pass today only because the first-segment alias rewrites `tech_stack`→`stacks` and `Stacks` is
`.passthrough()`, i.e. **only because of the defect `bug-084` files**. Once an unschema'd write is
refused they cannot pass as written, and AC1 requires exactly that refusal. The BDD file is an
acceptance contract in `docs/02_requirements/`, outside this task's declared amendment scope (AC8
names `spec-002`, `spec-006` and the CLI grammar spec), so it is **not edited here** — it is reported
as a proposed element instead. The Jest tests that encode the same stale expectation *are* in scope
and are re-pointed at a schema-declared path, with the old expectation kept as `bug-084`'s refusal
pin, so the change is visible in the diff rather than deleted.

#### T1 — acceptance-criterion classification (`dl-014`, `testing` directive)

| AC | Class | Evidence | Test |
|---|---|---|---|
| AC1 (unresolvable path refused, never created) | **red-first** | today `setDnaValue` creates an object for any segment it cannot descend into and `dna set tech_stack.cli.framework X` commits at exit 0 (`bug-084` Steps to Reproduce; `src/dna/set.ts` `if (!isPlainObject(node[segment])) node[segment] = {}`) | `test/dna/path.test.ts`, `test/core/dna-set.test.ts` "bug-084" |
| AC1 (read pass-through must not regress) | **characterization** | `.passthrough()` on every node is already `spec-002`'s declared behaviour and `loadDnaYaml` already returns unknown keys | `test/dna/path.test.ts` "read accepts what write refuses" |
| AC2 (three verbs exist) | **red-first** | `CORE_MODULES.dna` today registers `dnaSet`/`dnaShow` only (`src/core/index.ts`) | `test/core/dna-mutation-surface.test.ts` |
| AC3 (`--field` is a full path; entries by `name`) | **red-first** | no path in the codebase traverses an array | `test/dna/path.test.ts` |
| AC4 (uniqueness enforced) | **red-first** | `src/dna/schema.ts` carries exactly one refinement (`Team.superRefine`, referential) and no uniqueness constraint | `test/dna/schema-uniqueness.test.ts` |
| AC4 (non-breaking, own + scaffold) | **characterization** | measured: 0 duplicates in `docs/self/.wingfoil/dna.yaml`; the scaffold's only non-empty collections are distinct | same file, "non-breaking" block |
| AC5 (all four path shapes) | **red-first** | none of the four is reachable today (`dl-081` E2) | `test/core/dna-mutation-surface.test.ts` |
| AC6 (`--value`'s two meanings stated in `--help`) | **red-first** | the option does not exist | `test/cli/dna-mutation-help.test.ts` |
| AC7 (MCP parity: three Tools) | **red-first** | `dna.add|remove|update` do not exist, so the parity enumeration cannot contain them | `test/core/dna-mutation-surface.test.ts` "MCP parity" |
| AC8 (spec amendments) | **not testable — artefact** | a dated in-place Revision note is a document edit with no runtime behaviour; the route is `dl-047` as used on `spec-015` by `task-079`/`084`/`085` | verified by the artefacts + `grep -n "Revision (2026-09-23)" docs/self/docs/04_memory/design/specs/spec-00{2,6,8}*.md` |
| AC9 (`dna set` still works) | **characterization** | it works today for the 7 reachable scalars; the change must leave that intact | `test/core/dna-set.test.ts` (existing, re-pointed at `project.license`) |
| AC10 (six gates) | **characterization** | all six are green on `main` at `eca728e` | the gate commands, pasted in `### refactor` |

#### Size — the split permission, and why it is not used

The task carries permission to stop and propose a split. Measured against the surface above the work
is one coherent piece with one seam that could be deferred, and deferring it is what would make the
landing incoherent rather than smaller: the grammar must reach **every** collection or none
(`dl-081` action 2), and that part is fixed cost — one resolver, one mutator, three functions. The
only genuinely separable seam is the comment-preserving structural edit (design point 3), and its
fallback already exists and is already the shipped contract for `dna set`, so it fails **safe**: if it
proves unaffordable the surface still lands whole and correct, with a filed bug for the comments. That
is the split this task would take, and it is a fallback inside the task rather than a reason to stop
before starting it.
