---
id: "task-094-write-the-baseline-rule-where-implementers-meet-it"
type: task
title: "Write dl-080's baseline rule where an implementer meets it — a directive and the specs — so the next read or write is not decided by whoever adds it"
status: in-review
release: "v0.2"
priority: "high"
tags: ["v0.2", "governance", "directives", "determinism"]
ref: "dl-080-which-baseline-each-command-reads"
bug: []
depends_on: ["task-091-reads-resolve-at-head", "task-092-writes-refuse-a-dirty-target", "task-093-dna-mutation-surface-add-remove-update"]
tmpl_version: 260703
---

## Description

`dl-080-which-baseline-each-command-reads` is `ready`, ratified as option **(B)**: a read that gates
an operation resolves against the repository as committed at `HEAD`, and a write refuses while its
target carries modifications the command does not own.

Its **Action 4** asks that the ruling be written "where an implementer meets it — a `custom/`
directive, or the CLI grammar spec — not only here". That action has no owner and is unperformed.
Two tasks reported it independently (`task-091` and `task-092`) after sweeping for further instances,
which is itself the evidence that it matters: both looked for where the rule was recorded, and both
found it recorded only in the decision-log.

**This is the loop-closing task for the whole class.** Eight instances of one root cause have been
found in this release — `bug-076`, `bug-078`, `bug-079`, `bug-081`, `bug-082`, plus three more from
`task-091`'s sweep — and every one existed because nothing told the implementer which state a command
reads. Fixing the eight without writing the rule down leaves the ninth to be decided by whoever adds
it. `dl-080`'s own rationale names this as a **determinism** finding: two agents given the same defect
class produced two different architectures.

## Acceptance Criteria

- **AC1** — **Choose the carrier and argue it**, rather than doing all of them by default. The
  candidates are a `custom/` directive, an amendment to `spec-005-cli-command-contract`, an amendment
  to `spec-008-cli-grammar`, and any combination. Weigh what each reaches: directives are **bound by
  role** (`roles.yaml`), so a directive reaches whoever executes under that role and is auto-loaded
  per P3.6; a spec is read when someone looks for the contract. Record which audience each misses.
- **AC2** — The rule as written states **both halves** — the read baseline and the write refusal —
  because the class contains both, and half a rule would have prevented only half the instances.
- **AC3** — It states the **consequences already decided**, so they are not re-derived: refusals exit
  `1` per `spec-005` §1 (ruled on `bug-076`); the read must be made **unreachable** rather than
  guarded where possible (`task-090`'s shape, followed by `task-091`); and a path or target that does
  not resolve is refused, never created (`dl-081`, `bug-084`).
- **AC4** — If a directive is the carrier, it is **bound in `roles.yaml`** to the roles that write
  code — at minimum `developer`, and consider `architect`. An unbound directive reaches nobody
  (`bug-059`'s sibling problem in `dl-042`: a directive bound to no role is invisible). Verify the
  binding loads: `wingfoil directives list --role developer` must show it.
- **AC5** — **Cite what exists rather than restating it.** By the time this runs, the rule will be
  implemented in `task-090`, `task-091`, `task-092` and `task-093`; the document should point at the
  primitives those built (`loadDnaYamlAtHead`, `loadMemoryYamlAtHead`, `requireUnmodifiedTarget`,
  `verifyCommittedScope`) so an implementer reaches for them instead of writing a third mechanism.
  Cite by symbol plus the commit read at, per `dl-075`.
- **AC6** — Any spec amendment is an in-place dated Revision note under `dl-047`, the route
  `task-079`, `task-084` and `task-085` used on `spec-015`. Frontmatter untouched, `status: approved`
  preserved.
- **AC7** — Confirm at execution time that `dl-080` is still `ready` and that its Action 4 is still
  unperformed — **do not trust this description**. If `task-093` has already amended a spec with the
  rule, say so and narrow this task rather than duplicating it.
- **AC8** — All six gates green; the full `tsc --noEmit -p tsconfig.json` silent. The diff is expected
  to be documentation and configuration only; if it touches `src/`, explain why.

## Implementation Notes

- **Run this AFTER the three implementation tasks land**, which is why they are `depends_on`. The
  document describes what they built, and `task-093`'s AC8 already amends `spec-002`, `spec-006` and
  the grammar spec — overlapping edits to the same documents from two directions is how a merge
  conflict becomes a contradiction.
- Read `dl-080` in full, including its approve commit's `Reason:`, before writing a word. The
  ratification settles which option was chosen and why the other four were not, and a directive that
  re-opens that is worse than none.
- `docs/self/.wingfoil/directives/custom/` holds ten directives today; `determinism.md` is the closest
  neighbour and is already bound to `developer` and `architect`. Whether this rule belongs inside it
  or beside it is part of AC1.
- Classify every AC per `dl-014`/T1. This is a documentation and configuration task: expect
  characterization throughout, and do not fabricate a red.

## Execution Notes

### Design gate (2026-09-24) — per-AC `dl-014`/T1 classification

No AC is red-first. This task writes governance prose and two `roles.yaml` bindings; the only
executable behaviour it touches is the directive **inventory**, which already exists. Fabricating a
red would have meant writing a test for a rule no code consults. The substitute, per the `testing`
directive, is running the thing being asserted and pasting the command.

| AC | Classification | How it is settled |
|----|----------------|-------------------|
| AC1 | characterization (argued, not tested) | carrier choice recorded below with what each candidate misses |
| AC2 | characterization | both halves stated in one section of `command-baseline.md` |
| AC3 | characterization | each already-decided consequence cited to its ruling element |
| AC4 | **characterization, with a live run** | `directives list --role developer` executed against a scratch project (output below); two existing live-config tests updated, because they pinned the old binding list |
| AC5 | characterization | four primitives located by `grep`, cited by symbol + `9642ab5f` |
| AC6 | characterization | dated Revision note appended to `spec-006`; frontmatter and `status: approved` untouched |
| AC7 | **verification** | searches below, run before a word was written |
| AC8 | verification | six gates run in this worktree, numbers below |

### AC7 — is the rule already written anywhere? (run first, not assumed)

```
$ grep -rn "dl-080" docs/self/.wingfoil/                                   → (no output)
$ grep -rln "dl-080" docs/self/docs/04_memory/design/specs/                → (no output)
$ grep -rn "dl-080\|resolves at \`HEAD\`\|at HEAD\b" \
      docs/self/.wingfoil/ docs/self/docs/04_memory/design/specs/ \
      docs/01_vision/X_cli-cmds.md                                         → (no output)
$ grep -rn "working tree\|HEAD\|committed\|dirty" \
      docs/self/.wingfoil/directives/custom/*.md
  doc-versioning.md:17,18,21 (git commits and version bumps), security.md:20 (secrets)   → unrelated
$ grep -n "working tree\|HEAD\|committed" .../specs/spec-008-cli-grammar.md
  164: one sentence about `bug-076`'s dirty-working-tree ruling, inside §5's exit-code prose
$ grep -n "working tree\|HEAD\|committed\|dirty" .../specs/spec-005-cli-command-contract.md → (no output)
```

So: `dl-080` is cited by **no** directive and **no** spec; `task-093` amended `spec-002`, `spec-006`
and `spec-008` without carrying the rule into any of them — `spec-006`'s two `task-093`-era
Revision notes (2026-09-23, 2026-09-24) are about the DNA mutation surface and its grammar, and
neither mentions a baseline. Action 4 was unperformed. `dl-080` itself re-read at
execution: `status: ready` (`grep -m1 '^status:'`), approve commit `333a3c0f`, whose `Reason:` was
read in full before drafting.

### AC1 — the carrier, and what each candidate misses

**Chosen: a new `custom/` directive as the normative home, plus one new section in `spec-006`.**

- **`command-baseline` directive** (`docs/self/.wingfoil/directives/custom/command-baseline.md`) —
  bound by role, auto-loaded on execution (P3.6), so it reaches the implementer at the moment of
  writing. That is the population that re-derived this rule four times. *Misses:* anyone not
  executing under a bound role, and any consumer of the published package — this file is WingFoil's
  own dogfood config, not a shipped asset (`directives/built-in/` holds only a `.gitkeep`).
- **`spec-006-core-domain-api` §6** — chosen over the two candidates the description names.
  `spec-005`'s scope is the exit-code / output-format / error-message layer and `spec-008`'s is the
  invocation grammar; the baseline is neither. The reads happen in `src/core`, the four primitives
  live in `src/core`, and REQ-SYS-05 means an MCP Tool inherits the rule from the same function the
  CLI calls — a rule in either CLI spec would have bound one surface and said nothing about the
  other. §6.3 is the one clause `spec-005` owns (exit `1`), and it cites `spec-005` §1 rather than
  restating it. *Misses:* the implementer who never opens a spec — which is exactly why the
  directive, not the spec, is the normative home.
- **Rejected: folding it into `determinism.md`.** That file is a four-bullet north-star statement;
  a two-half operational contract with a primitive table inside it changes its character and buries
  both. Beside it, not inside it.
- **Rejected: `spec-008`.** Also the highest-conflict surface in this wave (`task-098` rewrote §9
  two days ago; `task-099` is in flight on `dl-083`).

### The resolution-read exception — decided: **there is no exception**

`task-096` left `directive remove`'s step-3 inventory read on the working tree, on a "resolution
read, not a gate read" distinction. Decision: the rule as written contains **no such category**, and
the deviation is recorded as a defect to be repaired under the rule rather than as an exception
written into it (§ *There is no third category of read* in the directive; `directiveRemoveFn`'s own
TSDoc, `src/core/index.ts`, read at `9642ab5f`).

Reasoning, in the order it decided:

1. **The read gates.** It returns a domain `NOT_FOUND` at exit `1`. `dl-080` (B) says *a read that
   gates an operation* resolves at `HEAD`. Sub-classifying gating reads by what they are *for* is
   option **(C)** — which the approver withdrew "rather than reshaped", and withdrew on a reason
   that applies here verbatim: "every new read needs classifying, and the classification is a
   judgement rather than a mechanical test".
2. **The cost of holding the line is bounded and symmetric.** The trade is message quality in both
   directions (an untracked directive gets a better message today; a directive committed at `HEAD`
   but deleted in the working tree gets a false `unknown directive`), and nothing can be destroyed
   either way because `requireUnmodifiedTarget` decides the deletion after both. A symmetric,
   non-destructive trade is precisely the kind that should be decided once, centrally.
3. **The message is repairable without moving the decision.** The rule therefore adds one clause
   that neither branch of the trade had: *the working tree may be read to explain a refusal, never
   to decide one.* That gets the untracked-file message right while the gate stays at `HEAD` — a
   strictly better outcome than either the exception or the plain HEAD-only reading, and it is the
   shape the follow-up bug should take.
4. **Determinism.** The whole finding is that two implementers produced two architectures. An
   exception living in one TSDoc reproduces it exactly.

### The twin rule — a **separate** directive, and the reason is mechanical

The task file argues `bug-096`'s rule shares a shape with `dl-080`'s. It does, in cause. It does not
share an **audience**, and `roles.yaml` binds whole files, not sections:

- `command-baseline` must reach whoever writes or gates a command → `developer`, `architect`,
  `reviewer`.
- `claim-evidence` must reach whoever writes durable prose — and the measured instances include
  acceptance criteria, bug `Summary`/`Expected` fields and spec clauses written by orchestration and
  review, not only implementer TSDoc. Bound to the coding roles it would miss most of them, so it is
  `scope: global`, alongside `doc-versioning`, `documentation` and `security-secrets`.

One directive would have had to be bound at the wider of the two levels, which would put a
command-implementation contract in front of `qa` and `product-owner` and dilute both. Two files, two
bindings.

Instances cited in `claim-evidence`, each verified rather than counted from the task description:
`bug-096` (three residues + a mis-cited `spec-008` section; `task-093` rejected twice — `ab5e752d`,
`3570de87`), `bug-097` item 3 (`readStatusAt` TSDoc), `task-096`'s "git C-quotes a path containing a
space" claim — introduced at `3e2506c4`, corrected at `ee689b31` inside the same task
(`git log -S "a space" -- src/storage/commit.ts`) — and `bug-099` (`--dry-run` in the CLI reference).

### AC4 — the binding loads (run, not assumed)

`bug-075` means this repository's own CLI cannot see `docs/self/.wingfoil/`, so the check ran in a
scratch project built from this branch's config:

```
$ cp -r docs/self/.wingfoil <scratch>/.wingfoil && cd <scratch> && git init && git commit -am config
$ node <worktree>/dist/cli.js directives list --role developer
  … "path": "directives/custom/command-baseline.md",
    "roles": ["architect","developer","reviewer"], "assignment": "architect, developer, reviewer"
  … "path": "directives/custom/claim-evidence.md",
    "global": true, "assignment": "global (all roles)"
  exit=0
```

Two pre-existing warnings also print (`unknown field(s) ignored: scope`) for `claim-evidence`,
`doc-versioning` and `security-secrets` — `scope` rides `.passthrough()` by design
(`spec-013` frontmatter table), so the new file behaves exactly like the two globals it joins.

### What changed, and the two test edits

- **New:** `directives/custom/command-baseline.md`, `directives/custom/claim-evidence.md`.
- **`roles.yaml` → v1.1:** `command-baseline` on `developer`/`reviewer`/`architect`,
  `claim-evidence` in `global`. `reviewer` is beyond AC4's ask: a rule the gate does not load cannot
  be checked at the gate, and every instance that shipped passed a review that did not have it.
  `tech-lead` deliberately left alone — it duplicates `reviewer`'s function and binds no
  code-writing directive of its own.
- **`spec-006` §6 + dated Revision note** (AC6). Frontmatter untouched, `status: approved` preserved,
  no supersede.
- **Two live-config tests updated** — `test/directives/schema.test.ts:139` and
  `test/core/loaders.test.ts:196` both assert `assignments.developer` **by exact array** against the
  real `roles.yaml`. They failed on the config change (`Received +1: "command-baseline"`) and were
  updated to the new expected content, plus `toContain` assertions for the reviewer/architect/global
  additions. This is characterization: the tests pinned a configuration that legitimately changed.
  No `src/` file is touched (AC8).
- **Sentences this pass made stale, fixed here:** `CLAUDE.md` §2 and §7 (the directive list and the
  role→directive table), `dev-loop-rel-v0.2-plan.md` v1.1 → v1.2 and
  `user-docs-rel-v0.2-plan.md` v1.0 → v1.1 (both carry a "directives auto-loaded" table derived from
  `roles.yaml`; both are `status: active`, so both would otherwise tell the next implementer to load
  the old set). `docs/self/.wingfoil/README.md` was checked and is **not** stale — it enumerates
  only the six P3.8 stand-ins, which are unchanged.

### Gates (run in this worktree, `npm ci` first — the worktree had no `node_modules`)

| Gate | Result |
|---|---|
| `npx jest` | **135 suites, 2202 tests, all passing** (first run: 2 failures, the live-config assertions above) |
| `npx jest --coverage` | **98.57 stmts / 93.87 branch / 98.92 funcs / 99.39 lines** — no `src/` change, so this is `main`'s figure; ≥80 and non-regressing |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| `npx tsc -p tsconfig.build.json` (emitting) | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` (full) | exit 0, silent |
| `npm run lint` | exit 0 |
| `npm run docs:api` | exit 0 |

`git merge main` → `Already up to date` (the branch was cut from `9642ab5f`, the current `main`).

### The one `src/` line, and why (AC8)

`src/directives/schema.ts`'s module TSDoc grounds the schema in "the fields every one of the **ten**
real files … carries (… and — on **two** files — `scope`)". Adding two directives, one of them
`scope: global`, made both counts false — a sentence this pass made stale, and the first thing the
`claim-evidence` directive asks anyone to fix. Corrected to twelve and three, measured rather than
incremented:

```
$ ls docs/self/.wingfoil/directives/custom/*.md | wc -l            → 12
$ grep -l '^scope:' docs/self/.wingfoil/directives/custom/*.md
  claim-evidence.md, security-secrets.md, doc-versioning.md        → 3
```

TSDoc only — no schema, no behaviour, no exported signature changes; `npm run docs:api` and the full
typecheck re-run green after it. The **rest** of that TSDoc is stale independently of this task
(it says no approved tech-spec exists for the Directives pillar, and `spec-013` has been `approved`
since), which is a finding, not my sentence to rewrite — proposed below.

### Merge surface for the orchestrator

No `src/` file and no barrel is touched, so this branch cannot produce the semantic conflict the wave
brief warns about. The files a sibling might also touch are `spec-006` (tail: a Revision note —
`task-099` may append one too) and the two `05_plans` files. `test/directives/schema.test.ts` and
`test/core/loaders.test.ts` are touched in one hunk each, both in the live-config `describe` blocks.

## Material gathered while this task waited (2026-09-24)

This task was deliberately held at `backlog` after its dependencies cleared, because each week of
delivery adds evidence for exactly the rule it exists to write. Three items accumulated; all three
are inputs, not scope changes.

**1. A "resolution read" versus "gate read" distinction now exists in a TSDoc and nowhere else.**
`task-096` deliberately left `directive remove`'s resolution read on the working tree, and its
reviewer verified the reasoning in both directions: the exception buys an accurate refusal for an
untracked file (`requireUnmodifiedTarget` names it) and loses one for a file committed at `HEAD` but
deleted in the working tree (which gets `unknown directive` instead). Neither choice can destroy
anything — `task-092`'s guard decides that after both — so it is a message-quality trade, not a
safety one.

The problem is the classification itself. `dl-080` option (B) says *a read that gates an operation*
resolves at `HEAD`; step 3 of `directive remove` **is** a read that gates, since it returns
`NOT_FOUND` at exit 1. Calling it a "resolution read" is a category `dl-080` does not contain, and it
sits close to the option (C) the approver explicitly withdrew rather than reshaped. Today that
distinction lives only in `directiveRemoveFn`'s TSDoc and `task-096`'s Execution Notes, which is
precisely the placement this task exists to fix. **Either write the exception into the rule, or write
that there is no exception and let `bug` handle the message quality.** Do not leave it where an
implementer meets it by accident.

**2. Four tasks have now re-derived the rule from prose.** `task-091`, `task-092`, `task-093` and
`task-096` each implemented `dl-080` and each wrote its own set of TSDoc comments restating it.
`task-096`'s implementer raised this itself as a proposed element. That is the cost `dl-080`'s
Action 4 was written to stop, and it now has a number rather than an intuition.

**3. A twin rule belongs beside it, and `bug-096` carries the evidence.** `task-093` was rejected
twice and approved over a third finding, all three for the same habit: a sentence asserting a fact
about the code, written without running the command that settles it — a coverage attribution, a
`spec-008` §9 clause, then a comment about `program.options`. `task-096` produced a fourth in the same
week: a TSDoc claiming git C-quotes paths containing spaces, which it does not, next to a test whose
fixture was chosen so that the claim could not be checked.

The rule is one sentence — *a comment or note that asserts a fact about the code names the command
that establishes it* — and the release has four measured instances arguing for it. It belongs in the
same directive as `dl-080`'s rule because it has the same shape: something everybody was expected to
know, that nothing wrote down, rediscovered once per task at review cost.

**How to treat this section.** It is evidence for the rule's *placement and wording*, not an
instruction to widen scope. If any of the three turns out to belong elsewhere, say so in the Execution
Notes and name where — do not carry it silently.
