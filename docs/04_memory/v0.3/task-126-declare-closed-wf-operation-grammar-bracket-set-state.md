---
id: "task-126-declare-closed-wf-operation-grammar-bracket-set-state"
type: task
title: "Declare the closed `wf()` operation grammar with its bracket and `set_state` rules, and make `memory history` read every declared verb"
status: in-review
release: "v0.3"
kind: "feature"
priority: "high"
tags: ["v0.3", "core", "memory", "grammar", "audit"]
ref: "dl-079"
bug: ["bug-155"]
depends_on: []
tmpl_version: 260703
---

## Description

`OPERATION_RE` (`src/memory/audit.ts:195`) accepts only `add|submit|approve|reject|deprecate`, so `memory history` reports `operation: null` for `start`/`finalize`/`sync`, which the workflow commands will emit themselves (`spec-003` verb table). `dl-079` (A) ratified a closed, declared list: the five CLI verbs plus `start`, `finalize`, `sync`, `amend`, `park`, each with its bracket rule. `BRACKET_RE` (`audit.ts:353`) splits at the first arrow, so every multi-hop `sync` bracket reads as drift (`bug-155`); the verb table now declares that `sync` may chain states, which settles `bug-155` as "read as a chain". Non-Memory scopes (`wf(directive): …`, `wf(workflow): create|remove`) are declared and ignored by `memory history`. This lands first so A's emitters and task-127's `amend` write a grammar that is already read back.

## Acceptance Criteria

- (red-first) `memory history` reports `operation` = `start`, `finalize`, `sync`, `amend`, `park` for subjects of those verbs (fixture repo, one commit each); an undeclared verb (`schedule`, `enter-releasing`) still reports `operation: null` (`dl-035`: history is not rewritten).
- (red-first) `verifyTransitionConsistency` reads `[a → b → c]` as from `a`, to `c`, and reports a finding when an intermediate hop is not a legal edge of the type's machine; the `test/memory/audit.test.ts` "multi-hop" case that pins the drift reading is rewritten, in both arrow forms (`bug-155`).
- (red-first) a `wf(workflow): create x` and a `wf(directive): …` commit touching a Memory path are not reported as Memory operations by `memory history`.
- (characterization) the five existing verbs' parsing is unchanged (existing P1.10 scenarios green).
- (characterization) `spec-008` §2 carries the verb list with each verb's bracket rule, matching the `spec-003` verb table; `spec-004` §4.3's "bracket belongs to the approver-gated verbs" sentence is amended to the table; each with a dated Revision note (`dl-047` option 1).
- (red-first) `workflow: finalize …` and `agent: record …` subjects (the non-`wf()` commits spec-017 and spec-016 emit) are not reported by `memory history` as Memory operations (from proposal A16).
- (characterization) `spec-008` §2 also declares the `set_state` verb rule of the `spec-003` verb table and settles `element.set_release`'s verb — `assign` joins the closed list, or the token is rebound — per the approver's ruling (backlog question Q6), recorded in Execution Notes and spec-008 §2; it also records `dl-061` B.1's convention that a `sync` crossing a `gates` reject edge cites the approver's reject sha.
- (characterization) The practised history is not rewritten (`dl-035`); the correction of the swapped counts in `dl-079`'s approve reason (plan Observations) is cited in Execution Notes.

## Implementation Notes

- **Size:** M · **wave:** 0 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** dl-079 (A); spec-008 §2 (subject grammar); spec-003 verb table; spec-004 §4.3; spec-017 Consequences (`wf(workflow): create|remove` as non-Memory scopes); spec-003 verb table `set_state` rule and its `assign` open item; dl-061 B.1 (sync subject/body convention) — merged from proposal A16.
- **Features:** P1.10, P1.2, P4.10 (verbs only).
- **Planning ruling:** Approver ruling 2026-09-30 (plan R20, Q6): `element.set_release` is rebound to an existing declared verb rather than adding `assign` to the closed list; the design phase names the verb.
- **Notes:** Proposal key: C01 (merged: A16). `src/memory/audit.ts`, `test/memory/audit.test.ts`, `spec-008`, `spec-004`. The subject *emitters* for `start`/`finalize`/`sync` are A's (the task implementing `spec-017`'s Memory commits). Merged with proposal A16 (the workflow domain's proposal for the same `dl-079` change): one task, in wave 0, so every emitter written later (task-217, task-226, task-199, task-205, task-206) targets a grammar that is already read back. Its spec-008/spec-004 Revision notes are hand edits because the `amend` verb (task-127) lands after it.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

Branch `task/task-126-declare-closed-wf-operation-grammar-bracket-set-state`, worktree
`../.wf2-wt/task-126`, cut from `main` at `6a28d281`. Start `17fa2c32`; `bug-155` `[planned →
in-progress]` `529dc939`.

### design (architect)

**`depends_on`** is empty, so there are no upstream Execution Notes to read (dl-015).

**Specs and decisions cited** (`awk '/^status:/{print $2;exit}'` on each): `spec-003`, `spec-004`,
`spec-008`, `spec-016` and `spec-017` are `approved`. `dl-079`, `dl-108`, `dl-110`, `dl-061` and
`dl-054` are `ready`.

**Where the grammar goes.** `spec-003`'s verb table sends "the subject-line grammar itself, and the
parser `memory history` uses to read it back" to `spec-008` §2. §2 is "Global flags", and it had
declared only the `--reason` body. The grammar therefore goes into a new §2 subsection. The edit stays
inside §2 plus a Revision note, as the plan asks, because `task-129` edits §1 of the same file.

**`element.set_release` → `amend`** (ruling R20/Q6: rebind to a declared verb, do not add `assign`).
The verbs were weighed against `spec-003`'s table:
- `start`, `finalize` and `approve` are the three outcomes of the `set_state` rule, and each moves
  `status`. `set_release` does not move it.
- `sync` recomputes a state from linked elements. `set_release` writes a field and derives no state.
- `amend` is, by `dl-108`'s decision text, "a content change on an element in any state", with
  `status` left untouched. Its `[s → s]` bracket records the unchanged state. `dl-108`'s Context also
  counts `wf(tech-spec): assign release v0.2 to spec-015` among the unrecorded amendments the verb
  exists for.

Consequence to confirm: under `dl-108` A2 (i), an amendment carries `Approver:`. A `set_release`
commit therefore carries the approver's identity. The stamp records a scope the approver ruled at
`release-planning`, so that fits, but the `product-owner` phase cannot write it alone. Recorded in
`spec-008` §2. `spec-003`'s table named `assign`, so its `set_release` row, its `amend` row and its
Consequences item now name `amend` too, to keep the two specs consistent (`spec-003` Revision
2026-09-30).

**`dl-079`'s approve-reason counts.** The `Reason:` of `3262ad92` swaps the counts ("start 197,
finalize 130, sync 116"). The correction of record is in `release-planning-rel-v0.3-plan`
§Observations: `sync` 197 (`bug`), `finalize` 132 (112 `task` + 20 `plan`), `start` 113 (`task`).
The commit is not rewritten (`dl-035`). Re-measured on this branch with the new reader: `git log
--format=%s | node -e '…parseMemoryOperation…'` over 1774 `wf(` subjects gives sync 198, finalize
133, start 114, approve 532, submit 495, add 215, reject 36, deprecate 2, and `null` 49. The extra
units since the survey are this dev-loop's own `start`/`sync` commits and the plan's `finalize`. The
49 nulls are exactly the undeclared practice on `main`: 27 verbless `wf(task): task-…`, 7 `plan`,
4 `assign`, 3 `start-fix`, 3 `schedule`, 2 `mark-released`, 2 `enter-releasing` and 1 `deferred`
(`git log main --format=%s | grep -oE '^wf\([a-z-]+\): [a-z-]+' | sed 's/.*: //' | sort | uniq -c`).

**`submit` keeps no bracket** (`dl-054` over `dl-106` W1 (a), ruling R20). This is stated in the
`spec-008` §2 table and the `spec-004` §4.3 sentence. No code change was needed.

**Design choices.**
- The verb is the whole token after `: ` up to the first whitespace. The old reader matched a word
  boundary (`\b`), so extending its alternation would have read the practised `start-fix` as `start`.
- `wf(dna)` joins `directive` and `workflow` as a configuration scope. `dna add` writes `wf(dna): add
  <field>` (`src/core/index.ts:411`). That is a declared verb token, and the old reader already
  returned `add` for it. It is the same class as the AC's scopes, so the fix covers it.
- `verifyTransitionConsistency(root, path, machine?)`: the machine is optional because `src/memory`
  cannot load `memory.yaml` (the loader is in `src/core`, which imports `src/memory`). Without a
  machine, a chain's hops are not judged, but its endpoints still are. A single-hop bracket's edge is
  never judged here: the write-time engine refuses an illegal one, and `amend`'s `[s → s]` is a
  declared self-loop. Nothing in the product calls the function yet (`grep -rn
  verifyTransitionConsistency src` → the definition and the `src/memory/index.ts` re-export).

**AC classification (T1).**

| AC | Class | Why |
|---|---|---|
| 1 — `start`/`finalize`/`sync`/`amend`/`park` reported; undeclared → `null` | **red-first** for the five verbs; the undeclared rows are characterization | the reader knew only five verbs; `schedule`, `enter-releasing`, `start-fix`, `assign` and verbless subjects already read `null` |
| 2 — `[a → b → c]` from `a` to `c`, with an illegal hop reported; the multi-hop test rewritten in both arrow forms | **red-first** | the reader split at the first arrow (`bug-155`) |
| 3 — `wf(workflow): create x` and `wf(directive): …` are not Memory operations | characterization as the AC words it, plus **red-first** for the same-class case | `create`, `remove` and `assign` were never among the five, so they already read `null`. The red is a configuration scope whose token *is* a declared verb (`wf(dna): add …`, `wf(workflow): finalize x`, `wf(directive): sync x`), and a bracket on such a subject, which was checked as a transition |
| 4 — the five verbs unchanged | characterization | the existing P1.10 / audit tests, unchanged |
| 5 — `spec-008` §2 and `spec-004` §4.3 | characterization (documentation) | — |
| 6 — `workflow: finalize …` and `agent: record …` are not Memory operations | characterization | the AC says red-first, but the old reader required `^wf\(`, so both already read `null` (the red run shows the test passing). A red here would be fabricated |
| 7 — `set_state` rule, `set_release` verb, `dl-061` B.1 in `spec-008` §2 | characterization (documentation) | — |
| 8 — history not rewritten; count correction cited | characterization | above |

### red (developer)

`f6d3d09a`, `test/memory/audit.test.ts`. It replaces task-109's AC4 multi-hop pin with a chain block
(both arrows: endpoint agreement, endpoint mismatch, illegal hops, reject and `deprecated` hops as
legal, empty-state chains as unparseable). It adds an operation-list block (AC1, AC3, AC6, and a
bracket on a configuration scope). `npx jest test/memory/audit.test.ts` → **12 failed, 48 passed**.
The 12 failures are the 9 chain tests, AC1's five-verb test, the configuration-scope red and its
bracket case. The undeclared-verb, `workflow`/`directive` create/remove/assign, and
`workflow: finalize`/`agent: record` tests pass, as classified.

### green (developer)

`491ed8be`.
- `src/memory/audit.ts`: `MEMORY_OPERATIONS` (the ten verbs), `CONFIGURATION_SCOPES`
  (`directive`, `dna`, `workflow`) and `parseMemoryOperation` replace `OPERATION_RE`. The trailing
  bracket is split on `→`/`->` into states, and `IllegalHop` is a new finding kind.
- `src/memory/state-machine.ts`: `isMachineEdge` covers the forward edge (including out of a gate or
  waiting state), a gates reject target, and `deprecated`.
- Exports are in `src/memory/index.ts`. Tests: `test/memory/state-machine.test.ts` gains an
  `isMachineEdge` block over the real `bug` machine.
- One fixture correction: the first illegal-hop fixture listed `planned → closed` as a non-edge, but
  it is `planned`'s reject edge. The fixture now goes `in-review → draft → closed`.

`npx jest` → 161 suites / 2663 tests passed.

**On this repository's history** (`npm run build`, then a script calling
`verifyTransitionConsistency(root, p, resolveStateMachine(loadMemoryYaml(root), 'bug'))` over every
file in `docs/04_memory/bugs/`):
- The 57 multi-hop `sync` subjects that touch bug documents gave **57** chain mismatches under the
  pinned 0.2.2 reader. They now give **3**, and **0** illegal hops.
- The 3 are real drift: `6437dbc4`, `50e57a04` and `28e41379` declare `in-review → … → closed`, but
  the frontmatter was `planned` before the commit.
- The 7 single-hop mismatches and 11 unparseable brackets are unchanged by this task, and were
  already reported the same way at 0.2.2.

### refactor (developer)

`1bd44dc4`. The first coverage run lowered branches from 94.29 to 94.12. The cause was
`?? ''`/destructuring defaults on indexes that no match can leave undefined. `parseBracketHops` now
returns the hops, the unreachable fallbacks are gone (with a stated invariant, as in
`src/dna/mutate.ts`), and `isMachineEdge` gains a machine with no `gates`. Comments that named
`OPERATION_RE`/`BRACKET_RE` or called `start` unrecognised were updated:
`src/memory/commit-message.ts`, `test/core/query-latency.test.ts`, and task-109's describe header.

Gates, on `1bd44dc4`:

| Command | Result |
|---|---|
| `npx jest --coverage` | exit 0; 161 suites / 2664 tests; 98.69 / 94.45 / 93.9 / 99.47 (main `6a28d281`: 98.68 / 94.29 / 93.84 / 99.47, no regression) |
| `npm run -s lint` | exit 0 |
| `npm run -s docs:api` | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| `npx jest test/docs` | 4/4 (`docs/cli-reference.md` `memory history` paragraph updated) |

BDD: `P1.10-memory-history.feature` and `P1.2-versioning-audit-trail.feature` state no verb or
bracket clause (`grep -n -i "bracket\|operation\|sync\|finalize"` → nothing). Their scenarios run in
`test/core/memory-history.test.ts` and `test/memory/versioning-audit-trail.test.ts` and are green
unchanged (AC4).

Docs (`4f172b92`):
- `spec-008` §2 gains the subsection "The Memory commit subject — the closed `wf()` operation
  list", with a Revision note.
- `spec-004` §4.3's bracket sentence now follows the verb table, with a Revision note.
- `spec-003`'s `set_release` row, its `amend` row and its Consequences item name `amend`, with a
  Revision note.

### review (reviewer)

Evidence per AC:
- AC1: `audit.test.ts` "the declared operation list".
- AC2: `audit.test.ts` "a multi-hop bracket is a chain", in both arrows.
- AC3: the `workflow`/`directive` rows and the configuration-scope red.
- AC4: the existing suites, unchanged and green.
- AC5 and AC7: `spec-008` §2, `spec-004` §4.3, `spec-003`.
- AC6: the non-`wf()` test.
- AC8: design, above.

Same-class search in the files touched: `grep -rnoE "[A-Z_]*(OPERATION_RE|BRACKET_RE)" src test` →
only `TRAILING_BRACKET_RE` and `WF_SUBJECT_WITH_BRACKET_RE`, both current. No stale reference to the
old readers is left.
Outside this task's files: `CLAUDE.md` §5.1 still calls `dl-079` "`in-discussion`" and lists five
verbs. It is owned by `align-agent-docs` (`dl-025`), so it was left for the coordinator.
