---
id: "dl-081-dna-mutation-surface-shape"
type: decision-log
title: "`dna set` can write 7 of the DNA schema's ~38 fields — everything structured is unreachable for create, update and delete, and no spec says so"
status: in-discussion
context: "architecture"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

**P2.1** specifies `wingfoil dna set` as "Define/update project DNA" with "**Basic CRUD operations**"
at Critical priority. `spec-002` describes `dna show` / `dna set` as the pair that "display and
**mutate the DNA map**". `spec-006` §3 registers `dnaSet` with `mutates: true`. **None of the three
states a restriction**, and the DNA is the pillar every other pillar reads.

What the command actually writes is a narrow subset, and the boundary was never decided — it fell out
of an implementation. This document asks what the mutation surface for the DNA pillar should be,
before `bug-083` is fixed and its fixer decides the shape of the whole pillar as a side effect of
repairing one flow.

## Evidence

Measured on 2026-09-23 against the CLI built from `main`, on a scratch project, and read from
`src/dna/set.ts` and `src/core/index.ts`.

### E1 — the implementation writes string scalars at object paths, and nothing else

`dnaSetFn` takes `{ key: string; value: string }` and calls `setDnaValue(dna, keyPath, value)`, which
walks the dotted path treating **every segment as an object key**:

```ts
if (!isPlainObject(node[segment])) node[segment] = {};
…
node[segments[segments.length - 1]!] = value;
```

So an array index does not traverse an array — it **replaces** it with an object. Measured:

```
$ wingfoil dna set 'modules.0.description' 'updated'
error: E_VALIDATION modules (…/.wingfoil/dna.yaml): Invalid input: expected array, received object
```

Nothing is written, because the write path re-validates the serialized bytes against `DnaYaml` before
committing (a deliberate design, `bug-004`/`task-063`). The schema check is what stops the damage;
the traversal itself has no notion of arrays at all.

### E2 — the reachable surface, counted against the schema

From `src/dna/schema.ts`:

| | fields | reachable by `dna set` |
|---|---|---|
| `version` | 1 scalar | **yes** |
| `project` | 6 scalars (`name`, `description`, `license`, `repository`, `methodology`, `north_star`) | **yes** |
| `modules` | array of `{name, description?, path?}` | no — array, and 3 fields per entry |
| `stacks.technologies` | array of `{name, category, version?, notes?}` | no — 4 fields per entry |
| `stacks.methodologies` | array of `{name, phase?, notes?}` | no — 3 fields per entry |
| `team.members` | array of `{name, email?, roles[]}` | no — 3 fields per entry |
| `team.agents` | array of `{name, executes_as[]}` | no — 2 fields per entry |
| `team.roles` | array of `{name, description?}` | no — 2 fields per entry |
| `paths.{sources,tests,docs,config,governance}` | 5 arrays of strings | no |

**7 writable fields; 11 array-valued fields; 17 fields nested inside array entries.** Confirmed at the
boundary: `dna set project.license MIT` succeeds and commits; `dna set team.members '[…]'` and
`dna set team.roles '[…]'` both fail with `expected array, received string`.

### E3 — it is not only *append* that is missing

The framing that produced `bug-083` was "no way to add a role or a member". The measurement is wider:
there is no way to **update** a module's `path`, a technology's `version`, a member's `email`, or an
agent's `executes_as`; and no way to **remove** a member who has left, a deprecated module, or a stale
path entry. Every field inside every collection is unreachable in all three directions.

### E4 — two `ready` decisions now rest on this

`dl-080-which-baseline-each-command-reads` was ratified as option (B): reads resolve at `HEAD`, writes
refuse on a dirty target. Under it a role must be **committed** before a directive can be assigned to
it, and an approver before they can approve. Both are clean when a command performs the change — it
commits as it goes — and both become a hand edit plus a manual `git commit` because no command does.
`dl-080`'s own ratification defers that repair to `bug-083` rather than weakening the baseline, so the
baseline rule's ergonomics now depend on whatever this document decides.

## Decision

Open. Five shapes, and they differ in what they cost the CLI grammar rather than in what they enable.

### (A) Per-collection verbs

`dna add-member` / `dna remove-member`, `dna add-role` / `dna remove-role`, and the same for modules,
technologies, methodologies, agents and each `paths` category.
*What it buys:* each verb takes the arguments its entry actually has, so nobody hand-writes JSON, and
`--help` documents the DNA's shape. Update is the awkward one — either a third verb per collection or
add-overwrites-by-name.
*Cost:* roughly a dozen new commands for one pillar, in a CLI whose whole surface is currently
seventeen. `spec-008` pins the grammar, so this is an amendment, not an addition.

### (B) `dna set` learns structure — JSON values and indexed paths

Accept a JSON value when the schema expects a non-scalar, and make `a.b.0.c` traverse arrays.
*What it buys:* one command, one mental model, full reach including update in place. It also fixes
`dna set modules.0.path` which today silently corrupts the structure in memory before validation
catches it.
*Cost:* a user adding one member hand-writes the whole array, unless append-by-index (`team.members.-`
or similar) is also invented — at which point the grammar has grown a sublanguage. And it widens what
a single ratified verb accepts, which `spec-005`/`spec-008` pin.

### (C) `dna edit` — open the file, validate on save

One verb, no grammar growth, the user edits YAML directly and the tool validates and commits.
*Cost:* it is not automation. An agent cannot drive it, which matters for a tool whose premise is
AI-assisted development and whose MCP surface is meant to mirror the CLI (`spec-006` §3 parity). It
also does nothing for `dl-080`'s flows, which need a *command* that commits.

### (E) Three verbs, the collection as an option — `dna add|remove|update --field <f> --value <v> [--…]`

Proposed by the approver on 2026-09-23 and revised the same day to follow Memory's grammar rather than
a positional form:

```
wingfoil dna add    --field members --value roberto --email r@example.it --role approver
wingfoil dna add    --field roles   --value reviewer --description "reviews changes"
wingfoil dna add    --field sources --value "src/**"
wingfoil dna update --field members --value roberto --email new@example.it
wingfoil dna remove --field members --value roberto
```

This is exactly `memory add --type adr --title "…"`: the *kind* travels in an option, not in the verb
name, and the verb count stays constant as the schema grows. `spec-006` §3's one-Tool-per-function
rule then costs **three** Tools — `dna.add`, `dna.remove`, `dna.update` — against a dozen for (A) and
none that makes sense for (C). That is the constraint this document exists to respect, and (E) is the
only shape that satisfies it while reaching every collection.

`Team`'s `superRefine` already rejects a member whose `roles` name a role absent from `team.roles`, so
referential integrity needs no new check in the verb, and the order it forces — role before member —
is the one `dl-080`'s committed baseline requires anyway.

#### What `--field` may hold, and why the choice is not free

Two readings were proposed: the **bare field name**, or a **partial or full path** into the structure.
The schema decides between them, and the measurement is uncomfortable.

Counting every key declared in `src/dna/schema.ts`, **five names appear in more than one object**:

| name | appears in |
|---|---|
| `name` | `Project`, `Module`, `TechEntry`, `MethodologyEntry`, `TeamMember`, `AgentEntry`, `RoleEntry` |
| `description` | `Project`, `Module`, `RoleEntry` |
| `version` | `DnaYaml` (root, a number), `TechEntry` |
| `notes` | `TechEntry`, `MethodologyEntry` |
| **`roles`** | **`Team`** (the catalogue) and **`TeamMember`** (one member's list) |

Of the eleven **collections**, ten have a unique leaf name — `modules`, `technologies`,
`methodologies`, `members`, `agents`, `sources`, `tests`, `docs`, `config`, `governance` — and exactly
one does not: **`roles`**. A bare `--field roles` cannot distinguish adding a role to the project's
catalogue from adding a role to a person, and that is the operation `dl-080` makes routine.

So the bare name works for ten of eleven and fails on the one that matters most. The honest options are
a full or partial path (`--field team.roles` against `--field team.members.roles`), or renaming one of
the two in the schema — which is a `[SPEC]` field change requiring `spec-002` to move first.

#### Four path shapes, and only two of them fit `--field` + `--value`

1. **Array of strings, depth 2** — `paths.sources`, `.tests`, `.docs`, `.config`, `.governance`.
   `--field sources --value "src/**"` is exact: one value, no sub-fields, nothing else to say.
2. **Array of objects, depth 1** — `modules`, whose entry is `{name, description?, path?}`.
   `--value core` names the entry; `--path src/core` and `--description …` carry the rest. Works, but
   `--value` now means "the entry's `name`" by convention rather than by anything the grammar states.
3. **Array of objects, depth 2** — `team.members`, `team.roles`, `team.agents`,
   `stacks.technologies`, `stacks.methodologies`. Same as (2), plus the `roles` collision above, plus
   per-collection options that differ: `--email`/`--role` for a member, `--category`/`--version` for a
   technology, `--phase` for a methodology, `--executes-as` for an agent.
4. **Array of strings nested inside an array of objects** — `team.members[].roles` and
   `team.agents[].executes_as`. **This shape does not fit.** Granting an *existing* member the
   `approver` role needs two identities — which member, and which value — and `--field roles --value
   approver` can express only the second. It needs either a path that carries the entry
   (`--field team.members.roberto.roles`) or a third option (`--of roberto`), and both are grammar
   this CLI does not currently have.

Shape 4 is worth dwelling on because it is not an edge case: **creating** a member with a role works
(`--field members --value roberto --role approver`, shape 3), while **amending** an existing member's
roles does not — and that is exactly the flow `dl-080` turned into an everyday operation.

#### Identity, and a constraint the schema does not have

`--value` as the entry's identity assumes names are unique within a collection. They are not:
`src/dna/schema.ts` carries **one** refinement, the referential check in `Team`, and **no uniqueness
constraint anywhere**. So `dna update --field members --value roberto` is ambiguous the moment two
members share a name. Either the verbs refuse on more than one match, or the schema gains a uniqueness
refinement — which is probably correct regardless. (E) is what makes the gap visible.

#### `DNA_KEY_ALIASES` is not a foundation — it is a trap this option would inherit

`src/dna/set.ts` holds `DNA_KEY_ALIASES = { tech_stack: 'stacks' }` — **one entry**, applied to
`segments[0]` only. It exists because `stacks` replaced the old fixed-key `tech_stack` object, which
`spec-002` records as a rename with the note that "any consumer that read `tech_stack.<key>` must now
scan" the lists.

The alias does not implement that migration; it papers over the first segment and lets the rest of an
old path land wherever it falls. Measured on 2026-09-23:

```
$ wingfoil dna set 'tech_stack.cli.framework' 'Commander'
→ exit 0, commits

$ # what is now in the file:
stacks keys: ['technologies', 'methodologies', 'cli']
stacks.cli: {'framework': 'Commander'}
```

A key that exists in no schema was written into `stacks` and **accepted**, because the object passes
unknown keys through. The old shape's path was `tech_stack.cli.framework`; the alias turned it into
`stacks.cli.framework`, which is not the same fact in a new place — it is garbage in a valid document,
at exit 0, in the pillar every other pillar reads.

Three consequences for (E):

- It cannot lean on this mechanism for singular/plural naming (`member` → `team.members`). One entry,
  first segment only: whatever aliasing (E) wants is new machinery, not an extension.
- If (E) adopts path-valued `--field`, it inherits this behaviour unless the traversal is made
  structure-aware — which is the same repair (B) needs, so the two options share a prerequisite.
- **It is a defect in its own right**, now filed as `bug-084-dna-key-alias-writes-unschemad-keys`
  (`open`, medium). That bug also separates out the wider half this measurement exposed: an unknown
  key is writable **at all**, because the pass-through that makes an unfamiliar document *load* also
  lets `dna set` *invent* a key at any depth and commit it. Pass-through on read is defensible;
  pass-through on write is a contract question this document should answer whichever shape it
  ratifies.

### (D) Keep the surface as it is and say so

Amend `spec-002` and P2.1 to state that `dna set` writes scalars, and that structured sections are
maintained by hand.
*Cost:* it contradicts "Basic CRUD operations" at Critical priority, and leaves `bug-083`'s flows as
hand edits permanently. Listed because "the tool does less than the spec claims" has two honest
resolutions and this is the other one.

## Rationale

- **(E) is the shape that fits the constraints this document was written to surface.** The MCP parity
  rule in `spec-006` §3 is what makes (A) expensive and (C) impossible, and (E) is the only option
  that reaches every collection at three Tools. It also has a precedent inside this CLI rather than
  beside it. Its two real costs — identity by a field the schema does not constrain to be unique, and
  a per-collection option set that `--help` cannot summarise in one place — are both smaller than a
  dozen new commands, and the first is arguably a schema defect worth fixing on its own.
- **The restriction was never decided, only implemented.** No spec states it, and the three that
  mention the command imply the opposite. That is the same shape as `dl-080`: an unstated contract
  filled in by whoever wrote the code first.
- **Fixing `bug-083` without deciding this is how the DNA pillar gets its surface by accident.**
  Whoever repairs the role flow will choose (A) or (B) for two collections, and the other four will
  follow that precedent or contradict it.
- **The MCP parity requirement is a real constraint on the choice**, not an afterthought: `spec-006`
  §3 pairs every core function with a Tool, so a dozen new verbs is a dozen new Tools, and `dna edit`
  has no sensible Tool at all.
- **This is not urgent in the way the baseline class was.** Nothing here corrupts a record or attests
  a falsehood; the cost is that a whole pillar is read-only in practice, and that two ratified
  decisions have rougher ergonomics than they should.

## Actions

1. **Choose a shape.** Owner: approver; recorded in this document's approve commit `Reason:`.
2. **Decide `bug-083`'s scope against it** — whether it repairs only the two collections `dl-080`
   needs, or lands the chosen shape across the pillar. They are different tasks.
3. Whatever is chosen, **amend `spec-002` and `spec-006`** so the boundary is stated rather than
   discovered, and `spec-008` if the grammar grows.
4. **Check the MCP side in the same breath** — `spec-004` owns the Tool names, and a shape that is
   awkward there is the wrong shape.

## Relations

- **Derives from:** `bug-083-dna-set-cannot-write-array-valued-fields` (`open`, high), which is the
  concrete defect this shapes the fix for.
- **Depended on by:** `dl-080-which-baseline-each-command-reads` (`ready`) — its ratified ergonomics
  assume a command exists to commit a role or a member.
- **Constrained by:** `spec-002-dna-yaml-schema` (`approved`), `spec-006-core-domain-api` (`approved`,
  CLI/MCP parity), `spec-008-cli-grammar`, `spec-005-cli-command-contract` (`approved`), and P2.1's
  "Basic CRUD operations".
- **Same pattern as:** `dl-080` — a contract nobody stated, filled in by the first implementation.
