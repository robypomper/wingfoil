---
id: "dl-083-dotted-entry-names-in-paths"
type: decision-log
title: "An entry named `Node.js` cannot be addressed by a dotted path, and forbidding the dot would make WingFoil's own DNA invalid"
status: ready
context: "architecture"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`dl-081` made an entry's `name` the key it is addressed by, which quietly made two properties of
`name` load-bearing: that it is **unique** within its collection, and that it is **expressible inside
a dotted path**. Only the first was noticed at the time; `task-093` implemented it as a per-collection
uniqueness refinement in `src/dna/schema.ts`.

`bug-091` records the second. A path is split on `.`, so `modules.core.v2.path` resolves `core` as the
entry name and then looks for a field `v2`; an entry actually named `core.v2` has no spelling that
reaches it.

## Evidence

### E1 — three such entries already exist, in this repository's own DNA

`bug-091` was filed asserting that none did, and carried its severity down on that basis. The claim
was never checked and is false. Measured at `c2102c87`:

```
$ grep -n '^\s*- name: .*\.' docs/self/.wingfoil/dna.yaml
73:    - name: Node.js
78:    - name: Commander.js
132:    - name: AI agent (Claude/Cursor/etc.)
```

Two in `stacks.technologies`, one in `team.agents`.

### E2 — a refinement would reject the file on read, not on write

`task-093` attaches `uniquelyNamed` to the collections **inside the schema** (`stacks.technologies`,
`stacks.methodologies`, `team.members`, `team.agents`, `team.roles`, `modules`), so it runs on every
`loadDnaYaml`. A dot constraint added the same way would make WingFoil's own `dna.yaml` fail
validation on load, taking `dna show`, `paths` and every DNA-reading command with it, until the three
entries above are renamed.

### E3 — the names it would forbid are the correct ones

`Node.js` and `Commander.js` are what those technologies are called. Past this repository the same
objection widens: `Vue.js`, `Next.js`, `Socket.io`, `ASP.NET`, `Node.js` are what a real project would
write in `stacks.technologies`. A DNA that cannot record its subject's actual name fails at the one
thing it exists to do.

## Decision

**A path segment may be quoted with double quotes, and a quoted segment is taken verbatim, dots
included.**

```
wingfoil dna update 'stacks.technologies."Node.js".version' --value 22.14+
wingfoil dna show   'stacks.technologies."Commander.js"'
```

The rules, in full:

- A segment is quoted when it **begins and ends** with `"`. The quotes are delimiters and are not part
  of the name.
- Inside a quoted segment, `.` is an ordinary character. Every other character is ordinary too.
- A quoted segment may not itself contain `"`. There is no escape sequence — a name containing a
  double quote remains unaddressable, and that is accepted: no plausible technology, module, role or
  person is named that way, whereas `Node.js` is the first thing a real project writes.
- Quoting is **optional** where it is unnecessary: `team.members.roberto.roles` is unchanged and stays
  the ordinary spelling. Quoting a segment that contains no dot is legal and means the same thing.
- An unterminated quote is a **usage error at exit 2**, not a name that happens to start with `"`.
- Quoting applies to the **path only**. `--value` carries an entry's identity directly and never needs
  it: `dna remove stacks.technologies --value "Node.js"` quotes for the shell, not for WingFoil.

The shell overlap is worth stating because it will confuse someone: the outer single quotes in the
examples above are the shell's, and the inner double quotes are WingFoil's. Both are needed.

## Rationale

Two alternatives were considered and declined.

**Forbid dots in `name`**, extending `task-093`'s uniqueness refinement. It is the cheapest change and
the most consistent — uniqueness went exactly that way — and it was the approver's first ruling, given
against `bug-091`'s false claim that no such entry existed. Once E1 corrected that, the cost became a
breaking change to WingFoil's own configuration plus the permanent loss described in E3. Declined on
E3 rather than on E1: even with a clean corpus, a schema that cannot hold `Node.js` is the wrong
schema.

**Address by index where a name is unexpressible.** Declined because index resolution is
data-dependent: if `modules.0.path` may mean either the first entry or an entry *named* `0`, then
adding an entry named `0` later silently changes what an existing, working command means. That is the
property `dl-081` rejected when it chose names over indices, and it is not improved by narrowing it to
a fallback — it is made harder to see. It also does not solve the case that motivates it: to write
`Node.js` by index a user must first read the file to find the index, which is what the CLI exists to
spare them, and that index moves when an entry is inserted above it.

The cost of quoting is a parsing rule in the grammar `spec-008` pins — one that must be written once,
tested, and documented in the CLI reference. That is a real cost and it is smaller than either
alternative's.

## Actions

1. Implement the quoted-segment rule in the path parser (`src/dna/path.ts`), with the unterminated
   quote refused at exit 2.
2. Record the grammar in `spec-008`, and in `spec-002` where the path form is described.
3. Add the three existing dotted names to the test corpus, so a future dot constraint cannot be
   reintroduced without a failing test.
4. Do **not** add a dot constraint to the schema. `uniquelyNamed` stays; nothing joins it.

## Relations

- Amends `dl-081-dna-mutation-surface-shape` (ready) — the path grammar only.
- Closes `bug-091-entry-names-containing-a-dot-are-unaddressable`.
- Interacts with `dl-082-cli-parameter-shape`, which moves the path from `--field` into a positional;
  the quoting rule is the same either way.

## Correction (2026-09-24) — the `dna show` example in the Decision block cannot run, and quoting is not why

The Decision block gives two worked examples. The second,

```
wingfoil dna show 'stacks.technologies."Commander.js"'
```

does not work, and would not work if the quoting rule were already implemented. Raised by `task-099`
and measured independently on `main`'s build at `66ef6304`:

```
$ wingfoil dna show stacks             exit 0   (the whole subtree)
$ wingfoil dna show stacks.technologies
error: no DNA key named 'stacks.technologies'                                  exit 1
$ wingfoil dna show project.license
error: no DNA key named 'project.license'                                      exit 1
```

`dnaShowFn` resolves **a single top-level key** and never splits on `.` at all. So the read surface
has no dotted-path grammar to quote *into* — a plain dotted path fails identically. The example was
written by analogy with the write verbs without being run.

**What this does and does not change.** It does not touch the decision: the quoting rule is about
`--field`'s successor, the positional `<path>` that `dna set`, `dna add`, `dna remove` and
`dna update` take, and `task-099` implemented it there. Every other example in this document is a
write verb and is sound. It changes one illustration, and it surfaces a real gap nobody had named:
`dna show` cannot address anything below a top-level key.

**That gap is not this decision's to close.** Giving `dna show` a path grammar is a new read surface
with its own questions — what it prints for a collection, what it does for an absent optional
section, what exit code an unresolvable read gets — and its own BDD scenario. It is filed separately
rather than absorbed here, because absorbing it would let a ratified decision grow a surface it never
argued for.

The example above should be read as **aspirational for `dna show` and correct for the write verbs**:
`wingfoil dna update 'stacks.technologies."Node.js".version' --value 22.14+` is the shape that works
today, and it is the first example in the block.
