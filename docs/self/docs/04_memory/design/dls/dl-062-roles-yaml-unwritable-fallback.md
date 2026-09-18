---
id: "dl-062-roles-yaml-unwritable-fallback"
type: decision-log
title: "What `directive assign` does when roles.yaml cannot be edited in place: a spec-less CONFLICT message on one branch, a silent whole-file reformat on the other"
status: in-discussion
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`task-051-directive-assign` is merged (`143e4da`; finalized at `0362845`), so all of the following is on
`main`. `updateRoleAssignments` (`src/core/directive-assign.ts:112-152`) is the one
read → edit → validate → write → commit path for `.wingfoil/roles.yaml`, and its own module doc
(`:12-16`) states that `directive remove` (P3.3, `task-052`) and multi-directive assignment
(P3.7, `task-056`, `backlog`) are meant to reuse it rather than re-derive it. **`task-052` turned out not
to be a consumer, and cannot be — see the Review addendum (2026-09-18) below, which corrects this
paragraph and adds a second question to the Decision.**

It edits through the comment-preserving `setRoleAssignmentsInText` (`src/directives/roles-edit.ts:118`).
That function returns `undefined` by design — "anything it cannot edit provably yields `undefined`,
leaving the fallback decision to the caller" (`:10-11`) — for: no block `assignments:` mapping, a
**non-empty flow list**, a non-scalar or multi-line item, tab indentation, mixed line endings, or a
re-parse that does not read back as intended (`:114-117`). **`undefined` then splits into two
behaviours that no specification describes** (`directive-assign.ts:138-147`):

```ts
let serialized = exists ? setRoleAssignmentsInText(text, role, next) : wholeFile();
if (serialized === undefined) {
  if (text.includes('#')) {
    return coreErr({
      code: 'CONFLICT',
      message: `roles.yaml cannot be updated without discarding its comments; edit assignments.${role} by hand`,
    });
  }
  serialized = wholeFile();
}
```

**Branch (a) — the file contains a `#`: fail closed, exit 1, with a message no spec defines.**

- The string `roles.yaml cannot be updated without discarding its comments; edit assignments.<role> by
  hand` occurs in exactly four places in the repository, all of them the implementation or its own
  record — never a specification:
  `grep -rn "discarding its comments" docs/ src/ test/ --include=*.md --include=*.ts --include=*.feature`
  → `src/core/directive-assign.ts:143`, `test/core/directive-assign.test.ts:326`, and
  `docs/self/docs/04_memory/v0.2/task-051-directive-assign.md:168,267`.
- `docs/02_requirements/02_bdd/features/p3-directives/P3.2-directive-assign.feature` has three scenarios
  (success, unknown role, unknown directive) and no unwritable-file scenario.
  `spec-011-storage-layout` describes `roles.yaml`'s contract (`:105`) and the `built-in`/`custom` split
  (`:118`) and says nothing about its write path. `spec-008-cli-grammar` §6 fixes the error *format*
  (`error: <reason>`) and §5 the exit code for a logic error (`1`, which `CONFLICT` maps to —
  `src/core/exit-code.ts:29`), but neither section enumerates this reason, and spec-008 carries no error
  catalogue beyond those two.

**Branch (b) — the file contains no `#` at all: rewrite the whole file with `js-yaml` `dump`.**

Reproduced on `main` by transpiling `src/directives/roles-edit.ts` with the repository's own
`typescript` and calling it directly (its only import is `js-yaml`). The input is a comment-free
`roles.yaml` whose `developer` list is a non-empty flow list — the realistic shape
`setRoleAssignmentsInText` refuses:

```
input:  "version: 1.0\n\nassignments:\n  developer: [code-quality]\nglobal: []\n"
setRoleAssignmentsInText(input, 'developer', ['code-quality','testing'])  ->  undefined
wholeFile()  ->  "version: 1\nassignments:\n  developer:\n    - code-quality\n    - testing\nglobal: []\n"
```

Four losses in that one output, each confirmed by running `dump(load(text), { lineWidth: -1 })`:

1. the blank line between `version:` and `assignments:` is gone;
2. `version: 1.0` becomes `version: 1` — YAML `1.0` is a float and `dump` renders it without the
   fractional zero, so the file's own config-format version marker changes value;
3. explicit quoting is dropped (`- "code-quality"` → `- code-quality`);
4. CRLF becomes LF — `dump` emits `\n` unconditionally. Verified with a CRLF input:
   `"version: 1.0\r\nassignments:\r\n\r\n  developer:\r\n    - \"code-quality\"\r\n    - testing\r\nglobal: []\r\n"`
   → `"version: 1\nassignments:\n  developer:\n    - code-quality\n    - testing\nglobal: []\n"`.

This is a **milder cousin of `bug-004`** (`closed` — "`wingfoil dna set` strips YAML comments") and of
**`bug-019`** (`triaged`, `medium` — "when `dna set` falls back to the whole-file dump it strips every
comment with no warning at all"): milder because the `#` guard means no comment is ever lost here, which
is precisely `bug-019`'s lesson as `directive-assign.ts:16` records it. What is lost instead is every
other piece of hand-authoring, silently, at exit 0.

**Neither branch violates a specification today** — that is the point. There is nothing to cite either
way, so every task that writes `roles.yaml` has to invent an answer, and nothing makes two of them invent
the same one. That is the determinism risk REQ-SYS-07 exists to prevent ("prefer explicit declared config
over inferred behaviour"). *(As written this sentence named `task-052` and `task-056`; `task-052` never writes
`roles.yaml` at all — see the Review addendum (a). `task-056` remains.)*

**How reachable is branch (b)?** Less than it first looks, and worth stating so the decision is not
over-weighted. The `wingfoil init` scaffold writes a `roles.yaml` that *does* carry comments
(`src/storage/templates.ts:275-276` and `:299`, two `#` lines), and this repository's own
`docs/self/.wingfoil/roles.yaml` carries six. So branch (b) needs a hand-written comment-free
`roles.yaml`, or one a previous branch-(b) rewrite already flattened — which is the self-reinforcing
part: once a file has been dumped it has no `#` left, so every later unwritable edit takes branch (b)
too.

## Decision

*Approver to choose. Q1 below, three options, the recommendation is the third — plus **Q2**, added by the
Review addendum (2026-09-18) at the end of this document.*

### Q1 — What happens when `setRoleAssignmentsInText` cannot apply?

1. **Keep today's behaviour and specify it.** Both branches stay; the CONFLICT message and the no-`#`
   dump fallback are written into `spec-011` as the declared `roles.yaml` write contract, and the message
   is pinned in `spec-008` alongside the other fixed error strings. Cheapest, changes no code, and makes
   `task-052`/`task-056` inherit one written rule instead of reading the source. The cost is ratifying a
   silent reformat: branch (b) still exits 0 having changed `version: 1.0` to `version: 1` and dropped
   the file's blank lines and quoting.

2. **Fail closed on both branches.** The `#` test disappears; `undefined` always means `CONFLICT` with
   the same message, and the whole-file `dump` survives only for the file-does-not-exist path
   (`:120`, `:138`), where there is provably nothing to preserve. Simplest rule to state and to inherit
   — "an edit this module cannot make provably is never made" — and it removes the self-reinforcing
   flattening above. The cost: a genuinely comment-free `roles.yaml` in a shape the textual editor
   refuses becomes uneditable by the CLI, even though rewriting it would lose nothing a user would
   notice beyond its flow style.

3. **Fail closed by default, rewrite only on an explicit opt-in** *(recommended)*. `undefined` yields
   `CONFLICT` regardless of `#`; a flag on the verb authorizes the whole-file `dump`, and the CLI warns
   on stderr what the rewrite will normalize. `--rewrite` is the obvious spelling and would be the first
   such flag on the surface, so the name is part of what the approver ratifies. This keeps the property
   both `bug-004` and `bug-019` argue for — a destructive reformat is never silent and never a default —
   without making a comment-free file permanently uneditable, and it matches `dl-051`'s shape: the
   operator is told what the tool did to their file rather than left to diff it. The cost is one more
   flag plus a `spec-008` §2 entry for it, on top of the `spec-011` write-contract section that options
   1 and 2 need anyway.

**Where the ratified answer lands, on any option:** a new "`roles.yaml` write contract" subsection in
`spec-011-storage-layout` (`approved`), stating what is preserved, what `undefined` means, and which
branch runs — `spec-011` is where `roles.yaml`'s contract already lives (`:105`, `:118`). If the CONFLICT
message survives (options 1 and 3, and option 2 for every branch), its exact wording also goes into
`spec-008-cli-grammar` next to the other pinned error strings, since §6 fixes the *format* of an error
line and not its text.

**Precedent for doing it this way:** `dl-051-dangling-directive-binding-warning` (`ready`) took exactly
this route in the neighbouring pillar — `task-055` shipped a warning and a shadow-warning text no spec
defined, the decision-log ratified them, and its Action is "amend `spec-012` §5 with points 1-4, as a
dated Revision note". Note that `dl-060` (`in-discussion`) already queues a correction to the very same
`spec-011` passage (`:105`, `:118`, bind by id not name) and `bug-040` a third to the "EMPTY today / not
yet implemented" wording nearby; whichever lands last should carry all three, as `dl-060`'s own Actions
propose.

## Rationale

- **Two more consumers, no rule.** `task-052` (`directive remove`) and `task-056` (multi-assign) are both
  `backlog` and both reuse `updateRoleAssignments` by explicit design
  (`directive-assign.ts:2-4`, `:12-16`). An undeclared behaviour three tasks share is the "one
  configuration fact, two rules" failure `dl-051` rejected in another pillar — here it would be one fact
  and three rules.
- **The two branches answer the same question in opposite directions.** With a comment, the tool refuses
  to touch the file to protect its formatting; without one, it rewrites the file wholesale and discards
  formatting that has nothing to do with comments. Presence of a `#` is a proxy for "the user cares about
  this file's shape", and a poor one — blank lines, quoting and a `1.0` version marker are hand-authoring
  too.
- **`version: 1.0 → 1` is the sharpest single symptom.** It is not cosmetic: it is the file's declared
  config-format version, and it changes value inside a commit whose subject says only that a directive
  was assigned.
- **Nothing here is a bug yet.** No specification is contradicted, so filing this as a `bug` would be
  wrong: the gap is that nothing is specified, and closing it is the approver's call. That is what makes
  it a decision-log — the same reason `dl-060` gives for not filing its `spec-011` mismatch as a bug.
- **The precedent is recent and cheap to follow.** `dl-051` ratified writer behaviour into a spec section
  in this same wave; doing the same here costs one subsection.

## Actions

- Owner **approver**: on **Q1**, choose 1, 2 or 3 — and, if 3, ratify the flag's spelling. On **Q2**
  (Review addendum, 2026-09-18), ratify the `global`-binding refusal wording or name a replacement.
- Amend `spec-011-storage-layout` with the `roles.yaml` write contract, as a dated Revision note
  (`dl-047`: tech-specs carry no `version:` field). Cheapest merged with `dl-060`'s `:105`/`:118`
  correction and `bug-040`'s stale-wording fix in one edit of that file.
- If the CONFLICT message survives: pin its exact text in `spec-008-cli-grammar` alongside the other
  fixed error strings, so `task-052`/`task-056` inherit the wording instead of copying the source.
- Hand the outcome explicitly to `task-056-role-based-directive-assignment` at its design step:
  `dl-015`'s `read_related` covers `depends_on` tasks and **not** decision-logs, so it will not read this
  on its own. *(Superseded in part by the Review addendum below: `task-052-directive-remove` was named
  here too and is **not** a consumer — it read this DL at design and established that `directive remove`
  never writes `roles.yaml`. `task-056` remains the one outstanding handoff.)*
- If option 2 or 3: `test/core/directive-assign.test.ts:326` pins today's CONFLICT case and needs the
  branch-(b) case pinned beside it.

Related: `bug-004-dna-set-strips-yaml-comments`, `bug-019-dna-set-fallback-silently-strips-comments`,
`bug-040-builtin-directive-docs-stale-after-task-057`, `dl-029-role-with-no-directive-assignments`,
`dl-037-builtin-vs-custom-directive-precedence`, `dl-042-directives-list-output-contract`,
`dl-051-dangling-directive-binding-warning`, `dl-060-roles-yaml-binds-by-directive-id`,
`task-051-directive-assign`, `task-052-directive-remove`, `task-056-role-based-directive-assignment`,
`spec-008-cli-grammar` §5/§6, `spec-011-storage-layout` `:105`/`:118`,
`src/core/directive-assign.ts:138-147`, `src/directives/roles-edit.ts:114-118`, P3.2, P3.3, P3.7,
REQ-SYS-07.

## Review addendum (2026-09-18)

Recorded from the Wave 2 review of `task-052-directive-remove` (branch `task/task-052-directive-remove`,
HEAD `a624067`, `in-review`, **not merged** — read read-only with `git show`). Verified against `main` at
`b7e39f9`. **Two changes: a correction to the Context above, and a second question added to the Decision.**

### (a) Correction — `task-052` is not a second consumer, and cannot be

The Context says `updateRoleAssignments`'s module doc expects `directive remove` to reuse that writer.
The module doc does say so (`src/core/directive-assign.ts:2-4`: "built so `directive remove` (P3.3,
task-052) and multi-directive assignment (P3.7, task-056) reuse the same two pieces"), and `task-051`
wrote it in good faith. **P3.3 makes it impossible.** Scenario 2
(`docs/02_requirements/02_bdd/features/p3-directives/P3.3-directive-remove.feature:16-20`) refuses a
still-assigned directive — `cannot remove 'legacy-rule': still assigned to role 'developer'` — rather than
unbinding it, so a removal has **no `roles.yaml` write to make** and never reaches the
`setRoleAssignmentsInText` → fallback path this decision-log is about.

Verified, not inferred:

- On `main` (`b7e39f9`), `grep -rn "updateRoleAssignments\|setRoleAssignmentsInText" src/` shows exactly
  **one call site**: `src/core/index.ts:1118`, inside `directiveAssignFn` (declared `:1099`). Everything
  else is the definition, the re-export, or doc comments.
- On the `task-052` branch (`a624067`), `grep -rn "updateRoleAssignments(" src/` shows the **same single
  call site** — `src/core/index.ts:1031`, again inside `directiveAssignFn` (`:1012`). `directiveRemoveFn`
  is declared at `:1091` and does not call it. (The line numbers differ from `main` only because the
  branch forked before `task-048`/`task-049` merged.)
- `task-052` recorded the same conclusion itself and flagged it for this document
  (`docs/self/docs/04_memory/v0.2/task-052-directive-remove.md:155-164` at `a624067`): "**This task
  deliberately does not** … `directive remove` therefore never reaches the `setRoleAssignmentsInText` →
  fallback path dl-062 is about, and changes nothing in it. Flagged in the final report so dl-062's author
  knows P3.3 is not, after all, a second consumer of that decision."

**What this changes here.** The "this will spread" framing is weaker than written. The Rationale's first
bullet ("Two more consumers, no rule … one fact and three rules") should read **one** other prospective
consumer: `task-056-role-based-directive-assignment` (P3.7, still `backlog`), which does write `roles.yaml`.
So today the undeclared behaviour has **exactly one consumer**, `directive assign` itself, with one more
scheduled. That is a smaller determinism risk than the Context implies — though not zero, and it does not
touch Q1's substance: the `#`-presence branch is still an unspecified behaviour on a shipped command, and
option 3 is still the recommendation. It does mean the decision is less urgent than "before `task-052`
reaches design", which it no longer needs to.

**Also stale in the Context and Actions, corrected in place above:** `task-052` was described as
`backlog`. It is `in-review` on its branch at `a624067` (`main` still carries the `backlog` document,
since the branch is unmerged), and it passed its design step having already read this DL — so the Actions'
"this needs to reach it before its design step" is moot, not outstanding.

### (b) Second question, added on the approver's instruction

#### Q2 — How does the refusal read when a directive is bound through `roles.yaml`'s `global` list?

P3.3 pins exactly one refusal string, scenario 2's role form:
`cannot remove '<id>': still assigned to role '<role>'`. A **`global`** binding has no role to name — it
is the reference that applies to every role — so the pinned form cannot be phrased for it without naming a
role the file does not name. `task-052` ships, as `[AUTHORING]` with no spec or feature behind it
(`task-052-directive-remove.md:189-193` at `a624067`):

```
cannot remove '<id>': still assigned to every role via roles.yaml 'global'
```

pinned by its own test, and raised it as the task's first "known weak spot" for ratification
(`:347-348`).

**Reachable on a plain `wingfoil init`, verified end to end** (throwaway project, branch build):

```
$ node <clone>/dist/cli.js init --template Scrum
$ cat .wingfoil/roles.yaml | tail -5
global:
  - doc-versioning
  - documentation
  - security-secrets
$ ls .wingfoil/directives/custom
determinism.md  doc-versioning.md  security-secrets.md  traceability.md

$ node <clone>/dist/cli.js directive remove doc-versioning
error: cannot remove 'doc-versioning': still assigned to every role via roles.yaml 'global'   # exit 1
$ node <clone>/dist/cli.js directive remove traceability
error: cannot remove 'traceability': still assigned to role 'architect'                        # exit 1
```

So this is not a corner case: the scaffold puts three directives in `global:`, two of them custom
(`doc-versioning`, `security-secrets`), and the very first `directive remove` a new user tries on one of
them hits the unspecified string. **Refusing rather than warning is judged right** and is not in question
here — a `global` binding is the strongest reference there is, and refusing matches REQ-SEC-07 clause (b)
("removal of a still-referenced custom asset is rejected naming the referrer"). This is a **wording
ratification**.

Options:

1. **Ratify `task-052`'s wording as shipped** *(recommended)*:
   `cannot remove '<id>': still assigned to every role via roles.yaml 'global'`. It names the referrer
   REQ-SEC-07 asks for (the `global` list, which is what the referrer actually is), it parallels the role
   form closely enough to read as one family, and it is already implemented and pinned by a test, so
   ratifying costs a spec line and no code. Cost: one more `[AUTHORING]` string that only a spec entry
   keeps stable.
2. **Reuse the role form with a pseudo-role**, e.g.
   `cannot remove '<id>': still assigned to role 'global'`. One message shape for both cases, and the
   simplest thing for a caller to parse. But `global` is not a role — it is a sibling key of
   `assignments:` in `roles.yaml` and is not in `dna.yaml`'s role list — so the message would name
   something the file does not contain, which is exactly what the role form was avoiding.
3. **Name the roles it expands to**, e.g.
   `cannot remove '<id>': still assigned to every role (architect, developer, product-owner, qa,
   reviewer, tech-lead)`. Most informative and closest to "naming the referrer" literally. But it reads
   the role set out of `dna.yaml` rather than `roles.yaml`, grows without bound, and needs a fixed order
   to stay deterministic (REQ-SYS-07) — cost out of proportion to the gain.

**Where the ratified answer lands:** alongside Q1's, in `spec-008-cli-grammar` next to the other pinned
error strings (the same destination Q1's CONFLICT message has), and/or in the `roles.yaml` write-contract
subsection of `spec-011-storage-layout` that Q1 requires anyway. Whichever option wins, `task-052`'s test
pin needs to match it before that task is approved — which makes Q2, unlike Q1, **blocking on
`task-052`'s approval**.

**Related for this addendum:** `task-052-directive-remove` (`a624067`: `:155-164`, `:189-193`,
`:347-348`), `task-056-role-based-directive-assignment`, P3.3 `:16-20`, REQ-SEC-07,
`dl-030-req-sec-07-referenced-asset-ownership`, `dl-066-p3-3-workflow-step-precondition-vacuous`
(the other half of P3.3's referrer question), `src/core/index.ts:1099-1120`,
`src/core/directive-assign.ts:2-4`.
