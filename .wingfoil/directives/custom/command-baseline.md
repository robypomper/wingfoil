---
id: command-baseline
name: "Which baseline a command reads and writes"
type: directive
kind: custom
title: "Which baseline a command reads and writes"
tags: [custom, determinism, git, baseline]
ref: [REQ-SEC-02, REQ-STATE-02, REQ-SYS-07]
---

# Directive — Which baseline a command reads and writes

**Version:** 1.1 · **Date:** 2026-09-30

Custom WingFoil rule. Applies to anyone adding or changing a command, a `src/core` operation, or an
MCP Tool — every surface, because both surfaces run the same core function (REQ-SYS-05,
`spec-006-core-domain-api`).

Ratified as `dl-080-which-baseline-each-command-reads` (`ready`) option **(B)**. This directive is
where the ruling is met; the decision-log is where it is argued. Do not re-open the choice here — if
you believe the rule is wrong for your case, file a `decision-log`, do not deviate in a TSDoc.

## The rule — both halves, and neither alone

- **Read half.** *A read that gates an operation resolves against the repository as committed at
  `HEAD`.* A read gates when its answer can change **whether the command refuses** or **what the
  command writes** — authority (`dna.yaml`), the state machine and the type registry
  (`memory.yaml`), the role catalogue and bindings (`roles.yaml`), the element's own committed
  `status`, and the id or path a verb is about to create.
- **Write half.** *A write refuses while its target carries modifications the command does not own.*
  Not "commit only my hunk": there are two candidate baselines on disk (index and working tree) and
  partial staging does not say onto which. Refuse, name what is different, and let the author decide.

Half a rule prevents half the class. `dl-080`'s own table splits its five founding instances across
both halves — `bug-076` and `bug-078` were fixed by refusing a write, `bug-079`, `bug-081` and
`bug-082` by moving a read to `HEAD` — and of the four found since (`bug-085`, `bug-086`, `bug-087`,
`bug-088`) one, `bug-087`, is a **read** of the working tree deciding the **path a write created**,
and another, `bug-088`, is a write with no guard at all, overwriting a clean committed file. Which
half a defect lands on is not obvious from the defect; state both halves or you have stated neither.

## There is no third category of read

A read that decides anything resolves at `HEAD`, **whatever it is about** — including a read that
only resolves which file or element the argument names, when failing to resolve it is itself a
refusal. Do not introduce a sub-kind of gating read ("this one merely resolves a name") to justify
the working tree.

The ratification closes this directly. `dl-080` offered exactly one option that classified reads
rather than applying one baseline — **(C)**, which sorted them by *what a read produces*: a read
whose outcome becomes a durable attestation resolves at `HEAD`, while "a read that merely gates an
operation whose result is itself committed, visible and recoverable may read the working tree". The
approver's `Reason:` (`333a3c0f`) withdraws it, and on a ground worth reading precisely: (C) "is
foreclosed by the decision to treat `bug-082` as blocking, since (C) leaves that bug open by
design; it is withdrawn rather than reshaped". Note what follows for a `directive remove`-shaped
read: under (C) *as written* it would have been **permitted**, since what it gates is a deletion
that is itself committed and recoverable. Withdrawing (C) withdrew that permission. A classification
by what a read is *for* — "this one only resolves a name" — is not even (C); it is a further
category the ratified rule does not contain, arriving after the only classifying option on the table
was refused.

The test in (B) is mechanical — *can this read change whether the command refuses, or what it
writes?* — and that is its whole value.

**The one place the shipped code still deviates — and it has an owner.** `directiveRemoveFn`
(`src/core/index.ts`, step 3 of its TSDoc: "This read stays on the **working tree**, deliberately")
resolves the directive it is asked to delete from the working tree, on exactly the "this read only
resolves a name" argument refused above — and that read returns a domain `NOT_FOUND` at exit `1`,
which is a refusal, which is a gate. Nothing can be destroyed by it: `requireUnmodifiedTarget` still
decides whether the file may be deleted, after it. So the deviation costs a message, not data —
which is why it is a defect to be repaired under this rule rather than an exception written into it.
The measured trade runs both ways (an untracked file gets a better message today; a directive
committed at `HEAD` but deleted in the working tree gets a false `unknown directive`), and that
symmetry is the argument for deciding it once, here, instead of per command. Filed as
**`bug-108-directive-remove-resolves-its-target-on-the-working-tree`** (`open`), whose repair is the
paragraph below rather than a plain move to `HEAD`.

**The working tree may be read to *explain* a refusal, never to decide one.** When resolving at
`HEAD` would produce a true refusal with a poor message — a file that exists on the author's screen
but in no commit — the repair is to say so in the message ("no commit of this repository contains
it; it is present in the working tree — commit it first"), not to move the decision onto the working
tree. A refusal that reads the working tree for its wording still cannot be reached by an
uncommitted state.

## Consequences already decided — do not re-derive them

- **A refusal exits `1`**, never `2`: it is a well-formed invocation failing on business logic
  (`spec-005-cli-command-contract` §1, ruled on `bug-076`). Exit `2` stays for malformed invocations.
- **Make the working-tree value unreachable rather than guarded.** `task-090`'s shape, followed by
  `task-091`: remove the parameter that could carry a working-tree document, so no later caller can
  reintroduce it. A guard that merely checks is one refactor away from being skipped.
- **A path or target that does not resolve is refused, never created** — `dl-081`, option (E),
  sub-section "`--field` holds the full path, and what that settles": "a path that does not resolve
  must be **rejected**, not created — one cannot add to a collection that does not exist"
  (`bug-084`). `dl-082` later moved the path out of `--field` into a positional; that sentence's
  semantics are unchanged, as `dl-081`'s own closing Revision records.
- **A read that gates nothing keeps reporting the working tree** — `dna show`, `paths`,
  `directives list`, the MCP Resources (`loadDnaYamlAtHead`'s own TSDoc names that list), and
  `memory search` / `memory history`, which call the working-tree `loadMemoryYaml`
  (`memorySearchFn`, `memoryHistoryFn`, `src/core/index.ts`). That is what those exist to do: a
  draft you have not committed is exactly what `memory search` should find. What they do **not** yet
  do is say which baseline they answered from; that gap is `dl-084`, `in-discussion`.

## Declared baselines — a read wider than `HEAD`, by name

A read may resolve against more than `HEAD` only where this section names it, with the baseline it
reads and why the wider read cannot be reached by an uncommitted state to the operation's harm.

| Read | Declared baseline | Why it is not `HEAD` alone | Source |
|------|-------------------|----------------------------|--------|
| `memory add`'s `{n}` sequence counter (`nextSequenceNumber`, `src/memory/add.ts`) | the trees of every local branch (`refs/heads/*`), every remote-tracking ref (`refs/remotes/*`) and `HEAD`, plus the working tree as git sees it (the index and the untracked, non-ignored files), over every folder the type's `path` can resolve to; no network | a number is taken wherever any of those holds it; the read takes the **highest** number and adds one, so a wider baseline can only raise the id, never lower it onto an occupied one or change whether the command refuses | `dl-101` §2 (a); `task-128` (`bug-087`, `bug-162`) |

The counter's read still gates what the command writes, so it follows the rest of this directive: a
git read that fails is an error of the operation, never an empty answer (an empty answer would
reissue `1`). The write half is unchanged: `requireAbsentTarget` still refuses an occupied target.

## Reach for the primitive — there is no third mechanism to write

Read at `9642ab5f` (`main`):

| Need | Primitive | Where |
|------|-----------|-------|
| `dna.yaml` as committed | `loadDnaYamlAtHead` | `src/core/loaders.ts` |
| `memory.yaml` as committed | `loadMemoryYamlAtHead` | `src/core/loaders.ts` |
| any path at a revision | `readPathAtRev` | `src/storage/commit.ts` (what both loaders above call) |
| refuse a dirty write target | `requireUnmodifiedTarget` / `requireUnmodifiedTargets` | `src/core/write-guard.ts` |
| prove the produced commit touched only its declared scope | `verifyCommittedScope` | `src/core/memory-transition.ts` |

`loadDnaYamlAtHead` and `loadMemoryYamlAtHead` return `null` when no commit contains the path —
decide explicitly what that means for your operation (for `roles.yaml`, absent at `HEAD` means "no
bindings yet", not a failure) and say so where you decide it.

## Why this is written here at all

Four tasks — `task-091`, `task-092`, `task-093`, `task-096` — each implemented this rule and each
restated it in its own TSDoc, because it lived only in a decision-log. `dl-080`'s own rationale calls
that a **determinism** finding before a security one: two agents given the same defect class produced
two different architectures. This is not a retrospective rule: two instances of the class were open
when it was written (`bug-087`, `bug-088`, both `release: v0.3`), and so is the deviation this
directive names (`bug-108`). `bug-087` is fixed by `task-128`, whose read is the first entry under
*Declared baselines*.

> Rationale: what the tool treats as authoritative must be what the repository records. A commit that
> attests something no clone can re-derive is not an audit trail (`adr-006-git-identity-role-based-authz`,
> REQ-SEC-02 / REQ-STATE-02). Source: `dl-080-which-baseline-each-command-reads` (`ready`, option (B))
> and its approve commit `333a3c0f`.

**Revision 1.1 (2026-09-30, `task-128-allocate-element-ids-highest-number-ref-across-folder`).** Adds
*Declared baselines* with its first entry, `memory add`'s sequence counter, as `dl-101` Action 3
requires, and records that `bug-087` is fixed by that task. Version 1.0 is the text `task-094` wrote,
which carried no version; this revision adds a `**Version:**` line (`doc-versioning`) in the body
rather than a `version:` frontmatter key, which the directive loader would report as an unknown field.
