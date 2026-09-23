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

Open. Four shapes, and they differ in what they cost the CLI grammar rather than in what they enable.

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

### (D) Keep the surface as it is and say so

Amend `spec-002` and P2.1 to state that `dna set` writes scalars, and that structured sections are
maintained by hand.
*Cost:* it contradicts "Basic CRUD operations" at Critical priority, and leaves `bug-083`'s flows as
hand edits permanently. Listed because "the tool does less than the spec claims" has two honest
resolutions and this is the other one.

## Rationale

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
