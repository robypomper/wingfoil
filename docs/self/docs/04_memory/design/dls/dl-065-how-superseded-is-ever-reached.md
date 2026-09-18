---
id: "dl-065-how-superseded-is-ever-reached"
type: decision-log
title: "`superseded` is reachable by nothing at all, and spec-010:125 still says `deprecate` writes it"
status: in-discussion
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`task-048-memory-deprecate` had to decide what `wingfoil memory deprecate` writes for an `adr` or a
`tech-spec`, whose machines both end in `superseded`. Its design decision D1
(`docs/self/docs/04_memory/v0.2/task-048-memory-deprecate.md:136-167`) and its independent review both
landed on the same reading — the verb writes `deprecated` for every type — and the code shipped that
way. What neither could settle is the question the reading exposes: **if no verb writes `superseded`,
what does?** Verified below: nothing does, and one approved specification still says `deprecate` does.

### What `superseded` is declared to be

- **`spec-001-memory-yaml-schema:75`** defines `waiting` as "States whose forward edge has **no CLI verb
  at all** — it fires only as a side effect of a Workflow step's `element.set_state(...)` action or an
  engine trigger (e.g. another element's `supersedes:` field). `submit`/`approve` on a `waiting` state is
  illegal."
- **`spec-001:94-98`** ("**`deprecated` is implicit**"): `deprecated` is "a built-in wildcard edge from
  *any* state to a reserved `deprecated` state, always legal, invoked via `wingfoil memory deprecate`",
  "**never** declared in `sequence`/`gates`/`waiting`", and the literal string is reserved.
- **`spec-001:207` and `:226`** — the spec's own worked `adr` and `tech-spec` examples —
  `waiting: [ accepted ]  # accepted→superseded: triggered by a later ADR's supersedes:` and
  `waiting: [ approved ]  # approved→superseded: triggered by a later spec's supersedes:`. Both match
  `docs/self/.wingfoil/memory.yaml` verbatim (`adr`: `waiting: [ accepted ]`; `tech-spec`:
  `waiting: [ approved ]`).
- **`src/memory/schema.ts`** enforces the reservation as a `.superRefine()` on `StateMachine`
  (`RESERVED_STATE = 'deprecated'`, `:13`; four issues raised at `:43`, `:53`, `:66`, `:77`, plus the
  `defaults` check at `:151`), so a machine that *declared* `deprecated` fails validation. `superseded`
  carries no such reservation — it is an ordinary `sequence` member listed under `waiting`.
- **`REQ-STATE-06`** (`docs/02_requirements/03_sard/03_state-context.md:62-71`), as amended by
  `dl-028-archived-states-excluded-from-context`, treats `deprecated` and `superseded` as two *members of
  the same archived set*, not as one being the other's route: "Documents in an archived state —
  `deprecated` on any type, and `superseded` on `adr`/`tech-spec` — remain in the repo but are excluded
  from agent context and default searches."

So `superseded` is, by every authority above, a **`waiting`** edge: reachable only by a workflow action or
an engine trigger, never by a CLI verb.

### Verified: nothing reaches it

| Claim | Command (run against `main` at `b7e39f9`) | Result |
|---|---|---|
| No code implements a `supersedes:` trigger | `grep -rn "supersedes" src/` | **two hits, both TSDoc prose, no implementation**: `src/core/index.ts:936` (`memoryDeprecate`'s own doc, pointing at `SUPERSEDED_STATE`) and `src/memory/state-machine.ts:100` (the English verb — "It supersedes `task-038`'s `isDeprecatedStatus`"). No frontmatter field is read, no transition is fired. |
| No workflow fires it | `grep -rn "set_state" docs/self/.wingfoil/workflows/` | 10 hits (`releasing`, `released`, `done`, `in-progress`, `backlog`, `in-development`, `planned`, `closed`, `draft`) — **none is `superseded`** |
| No task schedules the trigger | `grep -rn "supersedes:" docs/self/docs/04_memory/ --include=*.md` (ignoring empty `supersedes: ""` frontmatter) | only `spec-001:75/207/226`, `spec-012:261` and `task-048`'s own notes — **no task, no backlog entry**; `grep -rn "supersede" docs/03_backlog/` hits only P1.9's `--reason 'superseded by decision-20'` example text |
| No document has ever been in the state | `grep -rln "^status: superseded" docs/` | **no match** (exit 1) |

> Note on the first row: `e078314`'s commit body, and the brief that produced this DL, both state that
> `grep -rn "supersedes" src/` "returns nothing". It does not — it returns the two comment lines above.
> The substantive claim (no code *implements* a `supersedes:` trigger) holds; the literal one does not,
> and is corrected here rather than repeated.

`supersedes:` exists as an optional frontmatter field in the `adr` and `tech-spec` templates
(`docs/self/.wingfoil/memory/templates/adr.md:7`, `tech-spec.md:7` — "id of the ADR this one replaces")
and in every `adr`/`tech-spec` on disk, always empty. It is the input the trigger would read; nothing
reads it.

**Net:** `superseded` is a declared terminal state of two types that **no verb, no workflow action, no
engine trigger and no scheduled task can currently produce**. It is live only in the archived-set
predicate that filters *for* it (`ARCHIVED_STATUSES`, `src/memory/state-machine.ts:93`; `isArchivedStatus`,
`:115`), whose `superseded` half can therefore never match.

### Two documents still say `deprecate` writes it — one fixed, one not

1. **`CLAUDE.md` §5.1 — already corrected on `main`.** It said "Change **only** the `status` field to
   `deprecated` (or a type-specific deprecate-adjacent state first, e.g. `accepted → superseded` for
   `adr`/`tech-spec` …)". Commit **`e078314`** ("docs: correct CLAUDE.md §5.1 — `memory.deprecate` never
   writes `superseded`", 2026-09-18) replaced it by approver decision, adding the instruction that **no
   element should be moved to `superseded` by hand at all** until the trigger exists. **This DL does not
   need to carry that edit**; it is recorded here only because the two sentences were copies of each other.
2. **`spec-010-memory-frontmatter-schema:125` — not corrected.** Its "Field-write ownership" table still
   reads:

   ```
   | `memory.deprecate`   | `status: deprecated` (or a type-specific deprecate-adjacent state first, e.g. `accepted → superseded`) |
   ```

   `spec-010` is `approved`, and amending an approved spec is not a review-gate action — which is why it
   was left for this decision-log. Read as a statement about **what the verb writes**, it is false and
   contradicts `spec-001`; `task-048`'s D1 reads it instead as a compressed description of a **human
   retirement procedure** ("before deprecating, consider moving it to `superseded` first"), which is a
   defensible reading of the sentence but not of the column it sits in — that column is headed "Fields it
   may change", and `src/core/index.ts:951-957` documents the shipped verb as `status`-only with the
   target resolved by the engine, never a literal.

### A third document is wrong in the opposite direction

`SUPERSEDED_STATE`'s TSDoc (`src/memory/state-machine.ts:75-80`) says:

> "The terminal state of the `adr` and `tech-spec` machines (`memory.yaml`): reached along the forward
> `sequence` by `approve`, **never by `memory deprecate`**."

The second half is right and is what `task-048` cited. **The first half is wrong**: `accepted` is in
`waiting`, and `spec-001:75` says "`submit`/`approve` on a `waiting` state is illegal", so `approve`
cannot fire `accepted → superseded` either. Whichever option is chosen below, this TSDoc needs the same
correction — it is currently the only place in the repository that names a verb for the edge, and it
names the wrong one.

### A separate terminology conflict, in scope because it is the same verb

`spec-004-mcp-surface-contract` calls `deprecate` **approver-gated** twice — `:197` ("The `[{from} →
{to}]` bracket belongs to the approver-gated verbs only — `approve`, `reject`, `deprecate`") and `:252`
(the `dl-054` Revision note, same list). But `dl-027-req-sec-04-deprecate-reason-scope` is `ready` and
**REQ-SEC-04** (`docs/02_requirements/03_sard/05_security-compliance.md:38-48`) already carries its
outcome: "Narrowed to the approval gates by `dl-027-req-sec-04-deprecate-reason-scope`: `memory
deprecate` is **not** an approval gate (no `Approver:` line, no authority check)". The shipped verb
agrees — `src/core/index.ts:959-960`, "Deliberately absent: no `Approver:` line and no
`requireApprovalAuthority` call." `spec-004` is describing a *commit-subject shape* (which verbs carry the
state bracket) and reached for "approver-gated" as the label for that set; the label is now false of one
of its three members.

## Decision

*Approver to choose. Three questions; recommendations marked.*

### Q1 — How is `superseded` ever reached?

1. **Build the `supersedes:` engine trigger** *(recommended)*. Schedule a task that reads a submitted
   `adr`/`tech-spec`'s `supersedes:` field and fires the named predecessor's `waiting` edge
   `accepted → superseded` / `approved → superseded` in the same operation, exactly as `spec-001:75`,
   `:207` and `:226` already describe. This is the only option under which the three specs are true as
   written, and it gives `ARCHIVED_STATUSES`' `superseded` half something to match. Cost: a new task in a
   future release (`v0.3` at the earliest — v0.2 is `in-development`, and `dl-030` establishes that a
   review gate may not widen a release mid-flight), plus a sub-decision on whether the trigger fires on
   `submit` or on `approve` of the superseding element.
2. **Give a workflow phase an `element.set_state(superseded)` action.** `element.set_state` is an
   existing, specified action (`spec-003-workflows-yaml-schema:149-150`, used ten times across
   `workflows/custom/`), and `spec-001:75` names a workflow action as a legitimate driver of a `waiting`
   edge. Cheaper than option 1 — config, not code — but it makes retirement a phase's side effect rather
   than a property of the replacing document, so an `adr` superseded outside a workflow run stays
   `accepted`, and `supersedes:` stays decorative.
3. **Drop `superseded` from the `adr` and `tech-spec` machines.** `deprecate` then retires every type
   uniformly to `deprecated`, `supersedes:` stays a documentation-only cross-reference, and
   `ARCHIVED_STATUSES` shrinks to `{deprecated}`. Honest about what is built and removes an unreachable
   state — but it discards a distinction the SARD makes deliberately (`REQ-STATE-06`'s Description names
   both), and costs amendments to `spec-001` (`:207`, `:226`), `memory.yaml`, `REQ-STATE-06`, `dl-028` and
   `src/memory/state-machine.ts`: it throws away the modelling rather than the gap in it.

### Q2 — What does `spec-010:125` say instead?

Reword the `memory.deprecate` row so it describes only what the verb writes, and move the retirement
advice out of the field-write column. Proposed wording:

```
| `memory.deprecate`   | `status: deprecated` — for every type, `adr`/`tech-spec` included (`spec-001`'s implicit wildcard edge; never `superseded`) |
```

plus a sentence under the table: retiring an `adr`/`tech-spec` that a later element replaces is
`deprecate` to `deprecated`, naming the replacement in the commit `Reason:`; `superseded` is a `waiting`
edge and is never written by hand. That is `CLAUDE.md` §5.1's post-`e078314` text, restated for the spec.
Applied as a dated Revision note in place, per the `dl-051`/`dl-054` precedent for editing an `approved`
spec — `spec-010` is `approved`, and `dl-047` records that tech-specs carry no `version:` field to bump.

### Q3 — `superseded → deprecated`, and `spec-004`'s "approver-gated"

- **Record that `superseded → deprecated` is intended and legal.** It already works and is pinned:
  `test/core/memory-deprecate.test.ts:304` deprecates `adr-502`, "an already-archived `adr` — archived is
  not 'already deprecated'", and `task-048:236-237` states the rule ("A document in `superseded` is
  **not** 'already deprecated' under this rule and can still be deprecated"). It follows from the wildcard
  edge being legal from *any* state, so it needs ratifying, not building — but it belongs in `spec-010`'s
  note above so the next reader does not treat `superseded` as terminal-terminal.
- **Fix `spec-004`'s label** *(recommended: reword, do not re-litigate)*. Replace "approver-gated verbs"
  at `:197` and `:252` with a name for the actual set — "the state-transition verbs (`approve`, `reject`,
  `deprecate`)" — since what the passage is really about is which subjects carry `[{from} → {to}]`, and
  `deprecate` does carry it. `dl-027` (`ready`) and REQ-SEC-04 already settle the substance; this is a
  stale label, not a second decision.

## Rationale

- **An unreachable state is a determinism defect, not a cosmetic one.** REQ-SYS-07 asks for explicit
  declared config over inferred behaviour. Today the config declares an edge that no mechanism fires, so
  the only way an element could ever reach `superseded` is somebody typing it — which is exactly the
  hand-vs-tool divergence `e078314` was written to stop. Leaving it declared and unreachable guarantees
  that the next agent meeting an `accepted` ADR with a successor re-derives an answer from scratch.
- **Three documents disagreed, and two of them were instructions.** `CLAUDE.md` §5.1 and `spec-010:125`
  were word-for-word copies, and agents were following them: the pattern `dl-060` and `dl-062` both flag —
  one fact, several rules — reached here through a verbatim copy rather than through independent authors.
  Fixing one copy and not the other leaves the drift alive in the document that outranks it.
- **This is not a `bug`.** Nothing in the code contradicts a specification: the shipped verb matches
  `spec-001` exactly, and `task-048` shipped the defensible reading. What is missing is a decision about
  what to build (Q1) and an amendment to an approved spec (Q2) — neither of which a task or a review gate
  may take on its own. Same reasoning `dl-030` and `dl-062` give for not filing as bugs.
- **Q1 option 1 is recommended because it is the only option under which the specs are already correct.**
  Options 2 and 3 both require rewriting `spec-001`'s worked examples, which exist in two places
  (`:207`, `:226`) and are mirrored verbatim in `memory.yaml`. Option 1 requires no spec change at all —
  only a task.
- **The three questions are one decision-log, not three.** They share one root fact (`superseded` has no
  producer) and one code path (`memoryDeprecate` → `prepareMemoryTransition` → `resolveTypeTransition`),
  and the answer to Q1 changes what Q2's wording should say about the future. Splitting them would
  schedule the spec edit ahead of the decision it depends on.

## Actions

- Owner **approver**: answer Q1, Q2 and Q3.
- If Q1 option 1: register the `supersedes:` engine trigger as an unscheduled obligation for the next
  `release-planning` run — **not** a v0.2 addition (`dl-030`: adding a task to a release already
  `in-development` is a `release-planning`/`build-backlog` action, not a review-gate one). v0.2 is
  `in-development`.
- Amend `spec-010-memory-frontmatter-schema:125` per Q2, as a dated Revision note in place
  (`dl-047`: no `version:` field to bump). Nothing else in `spec-010` is affected.
- Correct `SUPERSEDED_STATE`'s TSDoc (`src/memory/state-machine.ts:75-80`): it names `approve` as the
  driver of a `waiting` edge that by `spec-001:75` no verb may drive. Small enough to ride whichever task
  next opens that file; it needs an owner either way, since no scheduled task currently has a reason to.
- Amend `spec-004-mcp-surface-contract:197` and `:252` per Q3, as a dated Revision note — the same
  mechanism `dl-054` already used at `:245-256` of that file.
- Record `superseded → deprecated` in `spec-010`'s note (Q3), citing
  `test/core/memory-deprecate.test.ts:304` as the existing pin.
- **`CLAUDE.md` §5.1 needs no edit from this DL** — `e078314` already carries it, by approver decision
  taken outside this decision-log because the sentence was agent-facing governance being actively followed
  while wrong.

Related: `task-048-memory-deprecate` (D1, `:136-167`, `:236-237`, `:433-436`),
`dl-027-req-sec-04-deprecate-reason-scope` (`ready`), `dl-028-archived-states-excluded-from-context`,
`dl-030-req-sec-07-referenced-asset-ownership`, `dl-047-tech-specs-carry-no-version-field`,
`dl-051-dangling-directive-binding-warning`, `dl-053-illegal-transition-target-for-verbless-edges`,
`dl-054-submit-commit-subject-bracket`,
`spec-001-memory-yaml-schema` `:75`/`:94-98`/`:207`/`:226`, `spec-003-workflows-yaml-schema` `:149-150`,
`spec-004-mcp-surface-contract` `:197`/`:252`, `spec-010-memory-frontmatter-schema` `:125`,
REQ-STATE-06, REQ-SEC-04, P1.9, `src/memory/schema.ts:13`,
`src/memory/state-machine.ts:75-80`/`:93`/`:115`, `src/core/index.ts:927-962`,
`docs/self/.wingfoil/memory.yaml` (`adr`, `tech-spec`), commit `e078314`.
