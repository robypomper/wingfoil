---
id: "dl-080-which-baseline-each-command-reads"
type: decision-log
title: "Which state a command reads — the working tree or the committed repository — has been decided one bug at a time, twice differently, and five defects of one root cause are open"
status: ready
context: "architecture"
release: "v0.2"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Every WingFoil command reads configuration before it acts: `dna.yaml` for who may approve and what
roles exist, `memory.yaml` for the state machine, `roles.yaml` for bindings. **Nothing states whether
those reads resolve against the working tree or against the committed repository**, so each was
implemented against the working tree by default — and each has since turned out to be a way of making
a commit attest something the repository does not record.

Five defects, one root cause, found within about thirty hours of each other:

| id | what the working tree decides | outcome | state |
|---|---|---|---|
| `bug-076` | the element's own content at commit time | a commit larger than its subject declares, and an uncommitted `status` drives the declared transition | **closed** — `task-088` chose **refuse** |
| `bug-079` | who holds approval authority | `Approver:` attests a role no committed `dna.yaml` grants | `planned`, closing through `task-090`, which chose **committed baseline** |
| `bug-081` | the state machine | an **ungated** verb commits a state no committed machine defines, and strands the element in it | `open`, **critical** |
| `bug-082` | the role catalogue | a committed `roles.yaml` binds a role the committed `dna.yaml` does not define | `open`, high |
| `bug-078` | the target file of the non-transition verbs | an unrelated uncommitted edit rides into a `wf(...)` commit | `open`, medium |

Three of the five were declared release blockers for `minor-v0.2`. **The two that are fixed were fixed
by two different answers** — one refuses while the file is dirty, the other reads the committed copy —
and neither task was wrong to choose as it did, because nothing told either of them what the rule was.

## Evidence

- `bug-076` and `bug-079` were each reproduced from scratch by two agents; `bug-081` by three,
  including on this orchestration. The reproductions are in the bugs.
- `task-088`'s reasoning for **refuse**: for the element being transitioned there is no single
  well-defined committed answer to fall back to — the verb's whole job is to write that file — so the
  only safe baseline is "nothing unowned is pending".
- `task-090`'s reasoning for **committed baseline**: for authority there *is* one well-defined
  answer, and a guard would leave the read itself taking the working tree, with corroboration holding
  only as a side effect of a precondition. Its deciding citation is `adr-006`'s own consequence that
  "a fresh clone reproduces the full audit trail with zero extra infrastructure".
- **`bug-082` is the case that argues against a uniform rule.** A role catalogue is a thing an author
  legitimately extends *while* assigning directives to it. A committed-baseline read there makes an
  ordinary flow impossible, in a way it does not for authority — nobody grants themselves a role as a
  step of the work they are doing.
- **`bug-081` is the case that argues the rule cannot wait.** It is reachable through `memory submit`,
  which requires no authority at all, and the element it strands cannot be moved afterwards.

### E6 — the cost (B) appears to carry is not (B)'s: `dna set` cannot write an array

Measured on a scratch project on 2026-09-23, against the CLI built from `main`:

```
$ wingfoil dna set 'team.roles'   '[{"name":"reviewer2"}]'
error: E_VALIDATION team.roles   … Invalid input: expected array, received string
$ wingfoil dna set 'team.members' '[{"name":"X","email":"x@y.z","roles":["approver"]}]'
error: E_VALIDATION team.members … Invalid input: expected array, received string
$ wingfoil dna set 'project.name' 'Renamed'
→ exit 0, commits `wf(dna): set project.name`
```

`dna set` writes **scalars only**, and the whole command surface — `dna set|show`,
`directive create|assign|remove`, `directives list`, `memory …`, `paths`, `workflow list`, `init`,
`mcp` — contains **no command that adds a role or a team member**.

Three consequences, and they change how two of the options should be read:

1. **Extending the role catalogue is already a hand edit today.** So (B)'s cost on `bug-082` is *one
   extra step of the same kind* — commit the edit before assigning — not a new kind of step. And that
   step aligns the tool with this project's own convention that every state change is a commit;
   today the tool treats as authoritative a configuration the repository does not record.
2. **(D) does not block seeding an approver**, which was the obvious objection to it. Seeding is not a
   command at all: it is a hand edit plus `git commit`, so no WingFoil command ever runs against the
   dirty tree and (D) has nothing to refuse. (D)'s real cost is narrower and recurring — an
   **unrelated** uncommitted config edit blocks a verb, so designing a new type in `memory.yaml`
   prevents approving an element that has nothing to do with it.
3. **The awkwardness attributed to (B) is a missing verb, not a baseline rule.** With `dna set` able
   to append to an array — or a `dna add-role` — the flow under (B) is `dna add-role X`, which commits
   itself, then `directive assign --role X` against the committed catalogue. The same gap is what
   makes seeding the first approver a hand edit, so one repair settles both flows.

**A fifth option was sketched and is withdrawn on this evidence:** extending the catalogue *inside*
`directive assign`, via a flag such as `--create-role`. It would make an assignment command write two
configuration files under a subject that says only "assign" — a commit doing more than it declares,
which is `bug-076` and `bug-078` committed on purpose. The gap belongs in `dna`, not in `directive`.

## Decision

Open. Four positions, with what each costs.

### (A) Uniform: every configuration read resolves at `HEAD`

*What it buys:* one sentence, no classification, no per-call argument — and it closes `bug-079`,
`bug-081` and `bug-082` together.
*Cost:* it breaks the flow `bug-082` describes, where the catalogue is extended as part of the work.
It also has to answer what an unreadable or absent committed file means for every read, not just the
one `task-090` already answered.

### (B) Read at `HEAD`, refuse on dirty writes

The split the two shipped fixes already embody: a read that gates an operation resolves at `HEAD`; a
write refuses while its target carries modifications it does not own.
*What it buys:* it ratifies what is already built rather than asking for rework, and it closes
`bug-078` by the same stroke.
*Cost:* it inherits (A)'s problem with `bug-082` unchanged, and the read/write line is not where the
harm actually divides — `bug-076`'s sharpest face was a *read* of the element's `status` driving the
transition, inside a verb that writes.

### (C) Classify by what the read produces — proposed as the one that fits the evidence

A read whose outcome becomes a **durable attestation** — a fact the commit asserts about the world —
resolves at `HEAD`. A read that merely gates an operation whose result is itself committed, visible
and recoverable may read the working tree.

Under it: authority (`bug-079`) and the state machine (`bug-081`) read committed, because they produce
the `Approver:` line and the `[from → to]` bracket; the role catalogue (`bug-082`) may read the
working tree, because what it gates is a binding that is itself committed and inspectable, and
`dl-042`'s warnings channel already exists to surface a dangling one.
*Cost:* every new read needs classifying, and the classification is a judgement rather than a
mechanical test. It also leaves `bug-082` open **by design**, which must be stated as a decision
rather than discovered later as an oversight.

### (D) Refuse whenever any configuration file is dirty

*Cost:* it blocks transitions for edits that cannot affect them, which is the objection `task-090`
raised against applying (b)-style refusal to authority. Listed for completeness; nobody has argued
for it.

## Rationale

- **The pattern is not five mistakes, it is one missing sentence.** Each implementer chose reasonably
  with the information available, and two chose differently. That is the signature of an unstated
  contract, and it is a determinism finding as much as a security one: two agents given the same
  defect class produced two different architectures.
- **`adr-006` already implies an answer for part of it** — authority derives from git identity, and
  the audit trail is meant to be reproducible from a fresh clone. A read that no clone can reproduce
  cannot support a claim the trail makes. That argument reaches authority and the state machine
  cleanly; it does not obviously reach a role catalogue.
- **Fixing these one at a time is what produced the pattern.** Two are fixed, three are open, and the
  next read someone adds will be decided by whoever adds it. Whatever is chosen should be written
  where an implementer meets it — a directive, or `spec-002`/`spec-008` — not only here.
- **`bug-082` deserves its weight as a counter-example rather than being flattened.** The temptation
  is to pick (A) because it is one sentence; the reason not to is that the record already contains a
  case where it is wrong.

## Actions

1. **Choose a position.** Owner: approver; recorded in this document's approve commit `Reason:`.
2. **Before fixing `bug-081`** — which is `critical` and a blocker candidate — settle at least whether
   the state machine reads committed. That single answer unblocks it without waiting for the rest.
3. **Do not re-open `bug-076` or `bug-079`.** Both are fixed and their fixes stand under (B) and (C)
   alike; under (A), `task-088`'s refusal is stricter than required, which is not a defect.
4. **Write the ruling where it is met**, not only in this document: a `custom/` directive, or the CLI
   grammar spec, so the next read is decided before it is written.
5. **Audit the remaining reads** once the rule exists. `task-090`'s AC5 swept authority and found
   `bug-081` and `bug-082`; nothing has swept the workflow and directive layers.

## Relations

- **Derives from:** `bug-076` (`closed`), `bug-079` (`planned`), `bug-081` (`open`, critical),
  `bug-082` (`open`), `bug-078` (`open`) — the five instances.
- **Constrained by:** `adr-006-git-identity-role-based-authz` (`accepted`) and its reproducible-from-a-
  clone consequence; `spec-005-cli-command-contract` (`approved`) for the exit code any refusal uses —
  `1`, per the ruling recorded on `bug-076`.
- **Traceability:** P1.7 (approver identity), P1.13 (Memory types and machines), P3.7 (role bindings),
  REQ-SYS-08 (directives bind by role), REQ-SEC-02/REQ-STATE-02 (declared versus derived state).
