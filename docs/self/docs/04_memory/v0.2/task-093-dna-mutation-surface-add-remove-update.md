---
id: "task-093-dna-mutation-surface-add-remove-update"
type: task
title: "Build the DNA mutation surface dl-081 ratified: `dna add|remove|update --field <full path> --value <v>`, and make the traversal refuse a path that does not resolve"
status: in-review
rejection_reason: ""
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
| AC6 (`--value`'s two meanings stated in `--help`) | **red-first** | the option does not exist | `test/core/dna-mutation-surface.test.ts` ("states --value's two meanings") + `test/cli/program.integration.test.ts` (`dna add --help`) |
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

### red — role: developer (commit `bfcd90f`)

Seven new or rewritten suites; `npx jest test/dna test/core/dna` before any implementation:
**8 failed suites, 42 failed tests, 78 passed** (three of the failures are "Cannot find module
`../../src/dna/{path,mutate,edit}`" — the modules did not exist yet).

- `test/dna/path.test.ts` — the resolver: the four `dl-081` path shapes, entry addressing by name,
  the `team.roles` / `team.members.<name>.roles` collision, and every `bug-084` refusal (unknown root
  key, unknown key under a declared section, descending through a value or a list, an index where a
  name belongs, an absent entry, a duplicate name). Plus the AC1 pair asserted together: the SAME
  document that `DnaYaml` parses with its unknown keys intact is refused by the resolver when written.
- `test/dna/schema-uniqueness.test.ts` — AC4, one case per collection, plus the two non-breakage
  measurements (this repository's `dna.yaml`, and every registered `init` template's scaffold).
- `test/dna/mutate.test.ts` — the semantics, per verb and per target kind, including every refusal
  and the purity property.
- `test/dna/edit.test.ts` — the comment-preserving edit, including a table-driven round trip over
  **this repository's own `dna.yaml`** asserting that every comment line survives each of six real
  mutations.
- `test/core/dna-mutation-surface.test.ts` — the registered operations end-to-end in throwaway repos:
  registration, derived CLI verb and MCP Tool name, the four shapes, the commit subject and its
  scope, exit codes, the git-identity pre-flight.
- Re-pointed, rather than deleted, the existing expectations that encoded `bug-084`: `dna set
  tech_stack.language python` became `dna set project.license MIT` in `test/core/dna-set.test.ts`,
  and the old expectation is now the refusal pin. Same in `test/cli/program.integration.test.ts`, and
  in `test/dna/set-in-text.test.ts` where the alias test became a *no-aliasing* test.
- `test/core/dna-set-comment-preservation.test.ts`'s "a key absent from the file is inserted" case
  used `project.owner` — a key `Project` does not declare, so under AC1 it must now be refused. It
  moved to `stacks.technologies.Zod.version`, which the schema declares and the file omits; that also
  makes it the first assertion that an insertion works *inside a sequence entry*.

### green — role: developer (commit `a1615a9`)

Four pieces, the smallest that make the ratified grammar work end to end.

- **`src/dna/path.ts`** — `resolveDnaPath` walks a dotted path against `DnaYaml` itself. Zod v4's
  introspection (`def.shape` / `def.element` / `def.innerType`) traverses `.passthrough()` and
  `.superRefine()` nodes unchanged — verified before designing on this, not assumed:
  `node -e "const {z}=require('zod'); …"` printed `obj type object`, `refined has shape true`,
  `members type array`, `opt of array → optional → array → string`. So there is **no hand-written
  field table**: a collection added to `spec-002` becomes addressable without editing this module.
  The traversal classifies the target (`section | scalar | string-list | collection | entry`) and
  refuses anything the schema does not declare — `bug-084`'s repair.
- **`src/dna/mutate.ts`** — `applyDnaMutation` over a `structuredClone`, so a refusal cannot leave a
  half-applied document behind. Entry keys are written in schema order (REQ-SYS-07: the same call
  always renders the same bytes).
- **`src/dna/edit.ts`** — the sequence-aware, comment-preserving text edit (see `### design` point 3
  for why it is in scope). Verified per edit by re-parsing and comparing the **whole document**
  against the intended one, structurally rather than byte-wise, because key ORDER is a rendering
  detail; anything it cannot do provably-minimally returns `undefined` and the caller falls back to
  `dump()`, exactly as `dna set` has always done.
- **`src/core/index.ts`** — `runDnaMutation`, the shared mutating-op template, plus `dnaAdd`,
  `dnaRemove`, `dnaUpdate` and their `CoreOption` declarations. `CoreOption` gained an optional
  `description`, which `src/cli/program.ts` renders instead of the generic `"{name} value"` — that is
  AC6's mechanism.

**What was removed, and why that is not scope creep.** `setDnaValue` is gone: it *was* `bug-084`'s
mechanism (`if (!isPlainObject(node[segment])) node[segment] = {}`), and its semantics are now
`applyDnaMutation`'s. The write path also stopped applying `DNA_KEY_ALIASES`; `dna show` still
applies it, and the constant's doc comment now says which side it is for.

### refactor — role: developer (commit `63bb3c0`)

- `edit.ts` imported `set.ts`'s `inlineCommentIndex`/`valueOf` instead of carrying a second copy —
  two scanners that must agree about where a value ends and a comment begins are two chances to
  disagree.
- `dna set` stopped loading `dna.yaml` a second time to check its target is a scalar; the shared
  pipeline does it on the document it already holds, and both use `DNA_YAML_PATH` rather than a
  literal.
- `resolveDnaPath` and `applyDnaMutation` took the schema as a parameter (defaulting to `DnaYaml`).
  This was a **coverage finding turned into a design one**: the "which shapes are addressable" and
  "how is an option value coerced" rules had branches no test could reach, because `DnaYaml` happens
  to declare only objects, scalars, string arrays and object arrays. Rather than delete the rules or
  leave them as untested claims, they are now exercised against schemas `spec-002` does not declare
  (`test/dna/path.test.ts` "what counts as an addressable shape", `test/dna/mutate.test.ts` "a
  numeric field takes a number").
- Removed two unreachable `default:` arms over closed unions and one double-guard in `listAt`; added
  the decline-path table in `test/dna/edit.test.ts` — thirteen shapes the editor must refuse rather
  than guess at, one per entry of its documented refusal list.

**Spec amendments (AC8)** — in-place dated Revision notes, the `dl-047` route `task-079`/`084`/`085`
used on `spec-015`. None of the three specs carries a `version:` field, so the doc-versioning
directive's bump rule does not apply to them; the Revision note is the record.

- `spec-002-dna-yaml-schema` — the six object collections in the pinned Zod definition now read
  `uniquelyNamed(...)`, and a new section, *Unknown keys: accepted on read, refused on write*, states
  what `.passthrough()` does and does not govern. It also records that `tech_stack` is not an alias
  on the write path.
- `spec-006-core-domain-api` §3 — three rows in the DNA table, and the Revision note explains why the
  restriction was never stated and why three Tools rather than a dozen.
- `spec-008-cli-grammar` — new §9 pins the `--field`/`--value` grammar, `--value`'s two meanings,
  entry addressing by name and the refuse-rather-than-create rule; §1 names the DNA verbs; §5 gains
  the sentence separating a malformed path (exit `2`) from an unresolvable one (exit `1`).

### merge with `main` (commit `3413cf6`) and the `task-092` hand-off

`git merge main` (dl-035 — merge, never rebase) at `3c3d666`. **One conflict, in
`src/core/index.ts`'s `dnaSetFn`**, where both sides rewrote the same body: `task-092` added
`dl-080`(B)'s dirty-target guard to it, and this task replaced it with a delegation to
`runDnaMutation`. Resolved by taking **both** sides rather than regenerating the block — `dna set`
keeps its delegation, and `task-092`'s `requireUnmodifiedTarget` pre-flight and `committedScopeError`
post-condition moved **into `runDnaMutation`**, where all four DNA write verbs inherit them instead of
only the one that had them.

**Which rule applies, checked rather than assumed (the hand-off asked for this explicitly).** The
plain `requireUnmodifiedTarget` rule, unaltered. `task-092` argued two exceptions and neither fits:
`requireAbsentTarget` is for a verb whose target must be NEW (`memory add`), while all four DNA verbs
edit an existing `dna.yaml` in place; and `wingfoil init`'s exemption rests on `detectInitState`
refusing an already-initialized project before a guard could run, whereas these verbs *require* an
initialized project and load `dna.yaml` as their input. The guard sits before the load, so no refusal
and no written byte can depend on a value the dirty copy contributed — which is also what makes
`loadDnaYaml`'s working-tree read equivalent to `HEAD`'s here, and keeps these verbs out of the
worktree-baseline class `bug-085`/`bug-086`/`bug-087` name.

Regression guard added to `task-092`'s own suite rather than a parallel one
(`test/core/write-guard-dirty-target.test.ts`, commit `858412d`): each of the three verbs refuses a
dirty `dna.yaml` at exit `1` naming the file, writes nothing, and on a clean tree still commits
exactly `.wingfoil/dna.yaml`. Without it `bug-078` — a declared release blocker — would reopen for
three new callers on the day it closed for the six old ones.

Re-read after the merge, as the brief requires: `dl-081` (unchanged, still `ready` at `5aaa5af`),
`bug-083`/`bug-084` (unchanged), and the four bugs `task-092`'s review filed (`bug-085`..`bug-088`) —
none touches the DNA write path; `bug-088` is about `initWingfoilStorage`, not these verbs. No
sentence in these notes needed correcting.

### AC7 — the MCP side, checked rather than assumed

`dl-081` records that "a shape awkward on MCP is the wrong shape", so this is a design check.

- **Naming (`spec-004` §4.1, which owns it).** Nothing is special-cased: `deriveVerb('dna', 'dnaAdd')`
  → `add` → `deriveMcpToolName` → `dna.add`, and likewise `dna.remove` / `dna.update`. Asserted
  against the real registry in `test/core/dna-mutation-surface.test.ts`, and the REQ-SYS-05 parity
  diff in `test/core/parity.test.ts` now enumerates **twelve** mutating operations with 0 unmatched on
  either side.
- **Is the shape awkward there? No — it is the shape MCP wants.** A Tool call's arguments are a JSON
  object, so `{ "field": "team.members", "value": "roberto", "email": "…" }` is the natural rendering
  of `--field`/`--value`/`--<entry-field>`; a per-collection verb set would have been a dozen Tools
  for one pillar, and `dna edit` none at all. Option (E) is also *better* on MCP than on the CLI in one
  respect: `--field`'s legal values are a closed set derived from the schema (`dnaCollectionPaths`),
  which a Tool's input schema can express as an enum, where `--help` can only describe it.
- **`--value`'s two meanings** are the one wrinkle, and they land in a property description in the
  input schema — the same place `--help` carries them. Nothing about it is MCP-specific.
- **What is awkward is pre-existing and already scheduled, not introduced here.**
  `src/mcp/registrar.ts` registers every `mutates: true` operation as a Tool with a description and a
  **zero-argument** handler (`buildParams` receives only `root`), so `dna.add` over MCP would throw the
  same `UsageError` that `dna.set`, `memory.add` and the four Memory transition verbs already would,
  and `createMcpServer` deliberately registers no Tools at all — Tools are **P5.2.3 (v0.4)** scope
  (`src/mcp/server.ts`'s own module doc says so). `spec-004` §4.3's "each Tool's input schema mirrors
  its CLI's required flags one-to-one" is therefore unimplemented for **all twelve** mutating
  operations, not for these three; `task-051` recorded the same boundary ("MCP `inputSchema` details
  beyond what the registrar derives" — out of scope). No element is proposed for it: it is scheduled
  work, not a finding.
- **`spec-004` was read and not amended.** §4.1's list is illustrative and §4.2 states the bijection
  the three new Tools satisfy by construction; the enumeration source `spec-004` defers to is
  `spec-006` §3, which this task amended.

### AC9 — `dna set` stays, and why

`update` does **not** subsume `set`. `dna set <key> <value>` keeps its positional grammar, which
`P2.1-dna-set.feature` pins ("Set a DNA field", "Error - invalid dotted key path") and which
`spec-002` and `spec-005` §4 both name; removing it would break a ratified acceptance contract to
save one line of registry. What changed is underneath: it is now `update` restricted to a single
value, over the same resolver and the same write path, so there is one mechanism with two spellings
rather than two mechanisms. The restriction is enforced where the pipeline already holds the loaded
document, and a `<key>` naming a collection or a list is refused by **naming the verb that reaches
it** — `bug-083`'s headline symptom was that this failure used to read `expected array, received
string`, which says nothing about how to write the field.

### A consequence AC1 forces on the BDD, reported rather than silently fixed

`P2.1-dna-set.feature`'s first two scenarios are written against the **pre-`stacks`** shape:

```
When I run "wingfoil dna set tech_stack.language python"
Then ".wingfoil/dna.yaml" contains "language: python" under "tech_stack"
```

They pass today only because the first-segment alias rewrites `tech_stack`→`stacks` and `Stacks` is
`.passthrough()` — that is, **only because of the defect `bug-084` files**. AC1 requires that write to
be refused, so those two scenarios cannot both be satisfied and AC1 met. The feature file is an
acceptance contract under `docs/02_requirements/`, outside this task's declared amendment scope (AC8
names `spec-002`, `spec-006` and the CLI grammar spec), so it is **not edited here** and is reported
as a proposed element instead. The Jest expectations that encoded the same stale shape *are* in scope
and were re-pointed (see `### red`), with the old expectation kept as the refusal pin.

### second merge with `main`, and the gate record (AC10)

An account-level rate limit interrupted this task after its first gate run. Nothing was lost — the
branch was intact at `858412d` with the `renderInline` simplification and its tests uncommitted, which
were finished work (committed as `b5dfd1a`), not a half-applied edit. **Every gate below was then
re-run from scratch on the merged tree; no result is carried over from before the interruption.**

`git merge main` again at **`b82356e`**, which had since taken `task-091` (reads resolve at `HEAD`)
and filed `bug-085`/`bug-086` with `task-095`/`task-096`. **Clean this time** — `task-091` touched
`src/core/loaders.ts`, `src/core/directive-assign.ts` and `src/core/memory-transition.ts`, none of
which this task edits. The semantic-conflict route the orchestrator warned about (a clean textual
merge that does not compile, surfacing inside jest's `globalSetup`) was checked explicitly with
`npx tsc -p tsconfig.build.json` — the emitting build, not just `--noEmit` — which exits `0`.

Worth recording, because it is the class `task-091` was closing: `loadDnaYaml` still reads the
**working tree**, and these verbs still use it. That is correct here and not `bug-085`/`bug-086`'s
defect — those are *gating* reads (which state machine governs, which role exists, which directive
exists) resolved from a copy nobody committed. `dna.yaml` here is not a gate, it is the **file about
to be rewritten**, and `requireUnmodifiedTarget` has already established that the working tree, the
index and `HEAD` agree about it before the load happens. A `HEAD` read would answer the same question
and then write bytes derived from it over a file it had not looked at. Neither `bug-085` (`memory
add`'s type registry) nor `bug-086` (the directive inventory) touches any code this task changes.

| Gate | Command | Result at `991ba06` |
|---|---|---|
| tests | `npx jest` | **127 suites / 2089 tests passed**, 0 failed |
| coverage | `npx jest --coverage` | `All files 98.49 % stmts · 93.65 % branch · 99.07 % funcs · 99.34 % lines` |
| build typecheck | `npx tsc -p tsconfig.build.json --noEmit` | exit `0` |
| full typecheck | `npx tsc --noEmit -p tsconfig.json` | exit `0` — silent, no exception (`bug-026` stays closed) |
| lint | `npm run lint` | exit `0`, 0 errors |
| API docs | `npm run docs:api` | exit `0` |

**Coverage against the right baseline.** `main` at `b82356e`, measured the same way in the same
session (`npx jest --coverage`, 122 suites / 1909 tests): `98.71 / 93.52 / 98.90 / 99.24`. This branch:
`98.49 / 93.65 / 99.07 / 99.34`. **Branch +0.13, functions +0.17, lines +0.10, statements −0.22.**

**CORRECTED 2026-09-24 — the paragraph that stood here was false, and the reject caught it.** It
attributed the statement delta "entirely" to `path.ts` and `mutate.ts` fallback arms over Zod's untyped
`def`. That characterisation is accurate for the uncovered **branches** and wrong for the
**statements**, which it was written about: read out of `coverage/coverage-final.json`, most of the
uncovered statements in the new modules are in `edit.ts`. Writing it from the summary table's per-file
*percentages* rather than from the statement map is the claims-about-file-state class this release has
rejected on repeatedly. The measurement below is read from the file, by counting `s` entries with a
zero hit count in `coverage/coverage-final.json`:

```
47 uncovered statements of 3135 across src/, of which, in this task's modules:
   7  src/dna/edit.ts      2  src/dna/mutate.ts     1  src/dna/path.ts
   1  src/dna/schema.ts    1  src/cli/program.ts
```

So `edit.ts` is the **largest single contributor**, at 7 of the 11 uncovered statements in the modules
this task adds, and all seven are `return undefined` **decline guards** — `valueAtPath`'s two shape
checks, `renderItems` returning nothing for an unrenderable item, `locate` landing on something that is
not a mapping key (twice), and `rewriteFlow`'s non-array check. They are the module's refusal contract,
one line each, reachable only from a caller that hands the editor an edit its own resolver would never
produce. The `??`/`?:`-over-Zod arms in `path.ts`/`mutate.ts` are real, and they are **3** statements
rather than the whole delta.

The **re-parse `catch`** was in that list at submission — the last line of the safety contract these
notes ask a reviewer to trust — and is now covered: `test/dna/edit.test.ts` "declines when its own
candidate does not parse" drives the one route that reaches it. A key inserted under a parent that
already holds a scalar produces `a: 1` followed by an indented `b: x`, which is not a YAML document at
all; the test asserts both that the candidate is unparseable and that the editor declines rather than
writing it.

### review-ready summary

**What landed.** `dl-081`'s ratified option (E), whole: `dna add|remove|update --field <full path>
--value <v>`, over one schema-driven, non-creating traversal shared with `dna set`. The pillar went
from **7 of ~38 schema fields writable** to every field of every collection reachable for create,
update and delete. Both bugs close under it — `bug-084` first, as its precondition (an unresolvable
path is refused at exit `1`, never created; `dna set tech_stack.cli.framework Commander` no longer
commits), then `bug-083` (a role, a member, a module, a technology, a path entry, and one member's
roles are all writable by a command).

**The split permission was not used, and the measurement behind that.** The grammar had to reach every
collection or none (`dl-081` action 2), and that part is fixed cost — one resolver, one mutator, three
functions. The one separable seam was the comment-preserving structural edit, and it fails **safe**:
its fallback (`dump()`) is already `dna set`'s shipped contract, so had it proven unaffordable the
surface would still have landed whole and correct with a filed bug for the comments. It did not prove
unaffordable: `src/dna/edit.ts` is 476 lines, 96.9 % statements / 95.1 % branches covered, and the
suite asserts that **this repository's own comment-rich `dna.yaml` survives six different mutations
with every comment line byte-identical**.

**Where a reviewer should look hardest.**

1. `src/dna/edit.ts` is the largest new surface and the one doing textual surgery on a user's file.
   Its defence is that every candidate is re-parsed and compared against the intended document in full
   before it is returned, so a mis-located edit costs the comments (the `dump()` fallback), never the
   content. The decline list is tested twelve ways.
2. The **uniqueness refinement** (AC4) is the one change here that can make a document that loads
   today stop loading. Non-breakage was measured, not assumed, for both populations AC4 names — this
   repository's `dna.yaml` and every registered `init` template — and both are pinned by tests over
   the real artefacts rather than copies.
3. `P2.1-dna-set.feature`'s first two scenarios contradict AC1 and are **reported, not edited** (see
   the section above). That is the one place where this task's acceptance criteria and an existing
   acceptance contract disagree, and the approver should settle it.
4. The `task-092` hand-off is carried: all four DNA write verbs take `requireUnmodifiedTarget` and
   `committedScopeError`, under the plain "refuse a dirty target" rule, argued against both of that
   task's exceptions rather than assumed.

### second pass — the reject (`ab5e752d`), and what it changed

Rejected `in-review → in-progress` on 2026-09-23 for two narrow things, with the substance explicitly
settled and not reworked: `bug-084`'s repair, the uniqueness refinement, the comment-preserving
editor, the `task-092` hand-off, the three spec Revision notes, and the decision not to split all
stand as approved. Nothing below touches any of them.

#### 1. The derived `--version` option was shadowed, and the surface silently did nothing

**Reproduced first, on a real project, before any fix** — `npx tsc -p tsconfig.build.json`, then a
throwaway `git init` + `wingfoil init --template Scrum`:

```
$ node dist/cli.js dna add --field stacks.technologies --value Zod --category validation --version "4.0"
0.1.0
exit=0
$ # .wingfoil/dna.yaml:  technologies: []      — nothing written, nothing committed
$ node dist/cli.js dna add --field stacks.technologies --value Zod --category validation
{ "key": "stacks.technologies", "value": "Zod" }   → technologies: [{name: Zod, category: validation}]
```

`TechEntry` declares `version`, `dnaEntryOptionNames()` derives the option set from the schema, so
`--version <value>` was registered on `dna add`/`dna update` and Commander's program-level `-V,
--version` won. `--help` advertised it as a working option throughout. This is the class `bug-084`
files — a silent success in the pillar every other pillar reads — delivered inside the surface that
closes it.

**It is not a `version` problem, and the measurement says so.** Driving a synthetic Commander tree
with one subcommand option per global flag (`node`, a 10-line script, deleted after) gives three
outcomes, two of them silent:

| invocation | outcome |
|---|---|
| `--version 4.0` | the program's own action fires: prints the version, exits `0`, the value is lost |
| `--format json` | **swallowed** by the program-level option — never appears in the subcommand's parsed options |
| `--verbose x` | **swallowed**, same way |
| `--color blue` | survives (the program's is a negated boolean; the subcommand's value option wins) |
| `--notes n` | survives (no global of that name) |

So the failure mode is "the value vanishes", and every present and future global flag
(`spec-008` §2 is amendable) is a live collision for every present and future entry field.

**Fix: namespace, not refusal — argued rather than assumed.** Every schema-derived entry option is
registered as `--entry-<field>`, spelled with the schema's own field name. The reject offered refusing
to register a shadowing name as the alternative; it is the wrong half of the trade:

- `version` is a field `spec-002` **declares** on `TechEntry`. Refusing it would make a
  schema-declared field permanently unwritable, in a surface `dl-081` ratified as reaching every
  collection — a loud hole in place of a silent one.
- Refusal is unstable in the wrong direction: the global set can grow, and a new global flag would
  then retroactively disable an entry field that had been writable, with no code change nearby.
- A **conditional** prefix (only the colliding names) would be worse than either: an option's spelling
  would depend on a table declared elsewhere, so adding a global flag later would silently *rename* an
  existing option. The prefix is uniform, which makes the two namespaces disjoint **by construction**
  and the spelling predictable from the schema alone.

Two defects of the same class, found while fixing it and fixed with it:

- **`buildOptionValues` read Commander's options by the declared name.** That works only while every
  name is a single word: Commander camel-cases across `-`, so `--entry-version` is stored as
  `entryVersion` and the declared-name lookup would have returned `undefined` and dropped the value —
  the same silent-drop one layer further in, introduced by the fix itself. It now resolves Commander's
  key (`commanderKey`, `src/cli/program.ts`).
- **`dnaMutationRequest` accepted a bare field name as well as a namespaced one.** It no longer does:
  anything that is not `--field`, `--value` or `--entry-<field>` is a `UsageError` at exit `2` naming
  the namespace. Accepting both would have left the core layer speaking a vocabulary the CLI cannot
  produce — which is precisely how a green test at that layer coexisted with a command line that did
  nothing. The MCP surface, whose Tool arguments are arbitrary JSON, is the caller that can actually
  reach the refusal, and it gets a named one.

#### 2. The test that could not have caught it, repaired at the layer where it can

`test/cli/derived-option-namespace.test.ts`, two halves:

- **The invariant** (in-process, real `buildProgram` over the real `CORE_MODULES`): no option of any
  derived command may share a long name with a global flag. **Both sides are read off the built
  program** — the globals from `program.options` plus `--version`/`--help`, which Commander registers
  outside that list and which are exactly the two that take an action and exit — so a new global flag
  or a new schema field is checked against what is actually registered, never against a hand-copied
  transcription of `spec-008` §2 that can go stale.
- **The drive** (out-of-process, the compiled `dist/cli.js`): every entry-field option the registry
  declares, passed on a real command line, asserted on **what reached `dna.yaml`** rather than on the
  exit code — the defect exited `0`. A completeness check compares the driven set against the
  registry's declared set, so a field added to `spec-002` cannot slip in undriven, and the `--help`
  case asserts that the advertised names are exactly the ones that work.

**Verified to fail on the unfixed build**, which is the only way to know a regression test regresses:
`git checkout -- src/`, rebuild, run → 11 of 11 fail, and the invariant names the defect precisely —
`Array ["add --version", "update --version"]`. Restored, rebuilt, 11 of 11 pass.

The CoreFn-layer pins were re-pointed to the namespaced spelling at the same time, so that layer now
speaks the CLI's vocabulary rather than a superset of it.

#### 3. The coverage attribution

Corrected in place, above, from the statement map rather than the summary table — see
*CORRECTED 2026-09-24*. The re-parse `catch` it named is now covered by a test.

#### Gate record — second pass (all six re-run at `HEAD`, plus the emitting build)

| Gate | Command | Result |
|---|---|---|
| tests | `npx jest` | **128 suites / 2103 tests passed** |
| coverage | `npx jest --coverage` | `98.50 stmts · 93.65 branch · 98.89 funcs · 99.38 lines` |
| build typecheck | `npx tsc -p tsconfig.build.json --noEmit` | exit `0` |
| **emitting build** | `npx tsc -p tsconfig.build.json` | exit `0` |
| full typecheck | `npx tsc --noEmit -p tsconfig.json` | exit `0` |
| lint | `npm run lint` | exit `0` |
| API docs | `npm run docs:api` | exit `0` |

Baseline for the coverage comparison, `main` at `c2102c87`, measured the same way in the same session:
`98.71 / 93.52 / 98.90 / 99.24` (122 suites / 1909 tests). Branch **+0.13**, lines **+0.14**,
statements **−0.21**, functions **−0.01**.

**The full typecheck earned its place in this list.** Its first run on the second pass **failed** —
`TS2352` on the new test file's cast of a Commander `Command` — while `npx jest` on the same tree was
green, because `test/**` is not type-checked by jest (`isolatedModules`). The cast is gone: the walk
is typed as `Awaited<ReturnType<typeof buildProgram>>`, which is Commander's own `Command`, so the
traversal is checked against the real shape instead of an assertion about it. Re-run: exit `0`.

#### Merge

`git merge main` at `c2102c87`, clean — it carried only `bug-089`, `bug-090` and `bug-091`, the three
governance findings this task reported and the approver filed as their own elements. All three are
left alone, as instructed: `bug-089` (the two `P2.1-dna-set` scenarios), `bug-090` (`dna set`'s
grammar differing across three artefacts), `bug-091` (an entry name containing a dot).

### review-ready summary — second pass

The ratified surface is unchanged and still whole; what changed is that it now works from a command
line as well as from a `CoreFn` call. The defect the reject caught was mine in the sharpest possible
place — the failure mode this task exists to eliminate, inside the code that eliminates it — and the
repair is the general one: the derived and declared option namespaces are disjoint by construction,
and the invariant that keeps them so is asserted against the built program rather than against a
description of it.

**Where a reviewer should look, in order.**

1. `test/cli/derived-option-namespace.test.ts` — the answer to "why did no test catch it". Worth
   reading before the fix itself, because it is the part that has to hold for the next schema field.
2. `DNA_ENTRY_OPTION_PREFIX`'s doc comment (`src/core/index.ts`) — the argument for namespacing over
   refusal, and the measured table of what each global flag does to a colliding subcommand option.
3. `commanderKey` (`src/cli/program.ts`) — the one-line seam that would have re-introduced the same
   silent drop, and the reason the first half of the fix was not sufficient on its own.
4. The corrected coverage paragraph — what it says now is read from `coverage-final.json`'s statement
   map, and the command that reads it is in the notes.
