---
id: "retrospective-rel-v0.2-plan"
type: plan
title: "Retrospective — rel-v0.2"
status: active
version: "1.10"
workflow: "retrospective"
phase: "rel-v0.2"
element: "minor-v0.2"
release: "v0.2"
tmpl_version: 260703
---

## Context

This plan executes the **`retrospective`** sub-workflow
(`.wingfoil/workflows/custom/retrospective.yaml`, `version: 1.1`, `element: release`) for the release
`minor-v0.2` (`docs/self/docs/04_memory/planning/rl-v1/minor-v0.2.md`). It is the **last** phase of
`release-cycle` (`.wingfoil/workflows/custom/release-cycle.yaml`, `version: 1.1`): its `phases:` list
ends `… → submit → publishing → retrospective`, so this phase starts only after
`release-publishing` has taken `minor-v0.2` to `released`. Per CLAUDE.md §6 (interim — no workflow
engine) and `dl-019-plans-as-memory-element`, this `plan` element *is* the executable scaffold for
that phase.

**This plan is written for a session that did not build v0.2.** That is not a caveat, it is the
design constraint. A retrospective whose executor has to invent what happened produces fiction, so
this document deliberately contains **no findings**: it contains the **evidence map** (§4), the
**questions to put to the evidence** (§5), and the **shape of the artefact** (§6). Every number in
§4 is a *command*, not a value — the session runs it and gets its own figure. Where a figure appears
at all it is pinned to `main` at commit **`a2e3586`** ("wf(decision-log): approve
dl-074-tag-must-be-on-pushed-main"), the HEAD at which this plan was authored, and it is there as a
sanity check on the command, not as a result to reuse.

**Why the evidence map matters more here than in any other v0.2 phase.** Almost none of v0.2's
learning is in a person's head, and comparatively little of it is in the task documents. It is in the
**commit bodies** — at `a2e3586`, 128 `approve` and 26 `reject` commits since the v0.1 retrospective
(§4.2 has the commands; re-measure — at `a20b346c`, after `minor-v0.2` reached `released`, the
same commands give 181 and 29 over 1,654 commits) — each carrying a `Reason:` block that records what was verified,
by what command, and what was wrong. Those bodies are the primary source (§4.2). The task documents
are secondary: they are what the `Reason:` blocks were written *about*.

**Produces:** `docs/self/docs/04_memory/design/dls/retro-v0.2.md` — a `decision-log` element, per
`retrospective.yaml`'s `capture` phase `produces:`. The precedent for what that file looks like is
`retro-v0.1.md` in the same directory (`docs/self/docs/04_memory/design/dls/retro-v0.1.md`,
`status: ready`, approved at commit `20e8271`); read it before writing, and note that it was itself
produced by this same workflow version.

**Not in scope:** the `user-docs`, `e2e-smoke`, `release-submit` and `release-publishing` phases each
have their own plan under `docs/05_plans/rl-v1/rel-v0.2/`. This plan may find that one of them
recorded something relevant; it does not execute any of them.

**Revision 1.1 (2026-09-28) — replanned against the v0.3 notes.** Version 1.0 treated the parallel
notes (§4.8) as a single late check. Since then those notes have grown into fifteen notes, a
91-row suggestion table and an agent-error inventory. A good part of them is **method**, not
finding: ways to mine the release that v1.0 did not have. This revision imports the methods and
keeps v1.0's rule for findings. The changes are:

- §1 gains the notes' preliminary operations and the build pin (P7–P10).
- §2.5 gains two phase-local evidence rules.
- §3.1 produces a second artefact: the agent-error inventory. §3.1b is its adversarial review.
- §3.2 attaches a **target release** to every disposition.
- §4.7 grows from five to eight mining slices.
- §4.8 now separates method from finding. §4.9 names the evidence that lives outside the repository.
- §5 gains four questions (Q9–Q12).
- §6 gains a release column and two planned outputs for v0.3 (§6.3).
- §6.4 adds one decision to take before counting decision-logs.
- §6.5 records the npm token change and the resulting schedule for `dl-087`.
- §7 gains four hazards.

The v1.0 text is otherwise kept. Where its figures moved, they are re-measured at `a20b346c`.

**Revision 1.2 (2026-09-28) — the approver's first rulings on v1.1.**
- All of this phase's repository changes stay on the phase branch until close-out, with ids
  allocated across all branches (§2.4).
- The duplicate `dl-080` branch is not merged and is removed at close-out (§6.4).
- The error inventory's entries stay outside the repository, and only the summary enters (§6).

**Revision 1.3 (2026-09-28).** The release-health data behind the notes' git-tree and quality analyses
has been supplied. §4.9 (c) now states how each of its sections is admitted.

**Revision 1.4 (2026-09-28).**
- Figures are written with their definition and measurement commit.
- The two id collisions are kept apart, because their remedies differ.
- The tool signature with version and build commit is added to the v0.3 start conditions (§6.3 b).
- The git identity question stays as it is (*Handoff* 5): the approver wants it analysed as a
  note before anything is decided.

**Revision 1.5 (2026-09-28).** `dl-089` (release-health analyses) was created in this phase from the
approver's draft (§6.6).

**Revision 1.6 (2026-09-28).** This revision applies the approver's resolvability rule (§2.2): every
reference must resolve from the repository. It makes three changes:
- It removes every pointer to a file outside the repository. That covers the notes' folder and
  files, a downloaded document, the briefs folder and the unversioned experiment directory.
- It integrates what the plan needs from those sources: Appendix A, and the six binding questions
  in §6.1.
- It removes session names used as sources.

**Revision 1.7 (2026-09-28).** A new approver decision, Handoff item 5: nothing in Memory records
the Determinism Index's measurement status, so any statement about it needs an element first.

**Revision 1.8 (2026-09-28).** A correction from the `explore` run: the brief count of §3.1a
confused briefs with drafted commit messages (19 briefs, not 55).

**Revision 1.9 (2026-09-28).** `dl-088` (release-health) was renumbered to `dl-089` after an id
collision with a parallel session's pushed `dl-088`.

**Revision 1.10 (2026-09-28).** Handoff item 5, the Determinism Index, is decided. v0.2.2 and v0.3 run
in parallel on `main`, which stays trunk-based (`dl-002`): until the `v0.2.2` tag, v0.3 merges only
Memory and process documents. DL-P owns the rule (option (a), confirmed by the approver).

---

## 1. Preconditions the session verifies first

Verify each as a **condition**, by running the command, before doing anything else. Do not take this
list's own wording as evidence that a condition holds — the repository moves, and §2.5 is the rule
that governs exactly this.

| # | Condition | Command that settles it | Expected |
|---|---|---|---|
| P1 | `release-publishing` has completed — `minor-v0.2` is `released` | `awk '/^---$/{n++} n==1 && /^status:/' docs/self/docs/04_memory/planning/rl-v1/minor-v0.2.md` | `status: released` |
| P2 | The published tag exists on `main` (`dl-074-tag-must-be-on-pushed-main`) | `git tag --list 'v0.2*'` and `git branch --contains v0.2.1 --list main` | `v0.2.0` (tagged, never published — `bug-135`) and `v0.2.1`, the latter contained in `main` |
| P3 | No v0.2 task is left un-`done` | `awk 'FNR==1{n=0} /^---$/{n++} n==1 && /^status:/{print $2}' docs/self/docs/04_memory/v0.2/*.md \| sort \| uniq -c` | one line: `done` |
| P4 | No bug scheduled into v0.2 is still open | see §4.1 command B — filter `release: "v0.2"` | all `closed` |
| P5 | The suite is green on `main` and the tree is clean | `npm ci && npm test` ; `git status --short` | 0 failures; empty status |
| P6 | You are on the phase branch `design/retrospective_v0.2`, current with `main` (§2.4) | `git rev-parse --abbrev-ref HEAD` ; `git log --oneline main -1` ; `git merge-base --is-ancestor main HEAD && echo current` | branch name; `current` |
| P7 | The **preliminary re-measurements** of Appendix A.1 have been run and dated (§4.8) | the commands listed in A.1 | each step carries a date and the HEAD it measured at |
| P8 | The WingFoil build used for every reproduction is **pinned and declared** | `npm view wingfoil version` ; `wingfoil --version` from the scratch project (§4.9) — never the `wingfoil` found first on `PATH` without checking | the same version from both; write it into the inventory header |
| P9 | A scratch project exists for reproductions, **outside** this repository, with a throw-away identity passed per command | `mktemp -d` + `git init` + `wingfoil init --template <t>`; identity via `git -c user.email=… -c user.name=…` or `GIT_AUTHOR_*` env, **never** `git config` inside a worktree of this repo (§7.9) | `git -C <scratch> log -1` shows the throw-away identity; `git config user.email` here is unchanged |
| P10 | The sessions this plan queries are reachable (§4.9 d) | `ListAgents` — the notes session, and the sessions that executed v0.2 | listed; a stopped session is resumed from the app before it is relied on |

If **P1** fails, this phase has not started — stop and say so. If P3/P4 fail, the release did not
finish; that is a `release-submit`/`publishing` problem, not retrospective material to paper over.

> **P5 note.** `npm ci` is not optional here: `test/cli/types-node-floor.test.ts` asserts the
> installed `@types/node` floor and fails against a stale `node_modules`. Run `npm ci` after **any**
> merge that touches `package.json` or `package-lock.json`, including a `main` merge you did only to
> get current (§2.4).

---

## 2. Conventions a fresh session will not know

These are repository conventions, ratified in Memory, that are **not** discoverable from the code and
that a new session will otherwise violate. Read them before touching anything.

### 2.1 Every Memory state change is a git commit in the §5.1 format

CLAUDE.md §5.1 is the contract: **one commit per operation, one element type per commit**, subject
`wf({type}): {add|submit|approve|reject|deprecate} {id1}, {id2}, …`, and for the approver-gated verbs
a mandatory body:

```
wf(decision-log): approve retro-v0.2 [in-discussion → ready]

Approver: {full name} <{email}> ({role})
Reason: <why>
```

The `Reason:` block rules (`dl-067-reason-trailer-contract`, `ready`) are enforced by the shipped
code and are easy to trip: the block may span lines and paragraphs, it may **never** be blank, **no**
line of it may begin `Approver:` or `Reason:`, and it may **not end** with a paragraph made entirely
of `Key: value` lines. Violating any of these exits `2` and writes nothing.

**The CLI now ships these verbs.** Unlike during v0.1, `memorySubmit`, `memoryApprove`,
`memoryReject`, `memoryDeprecate` and `memoryHistory` are all registered in `CORE_MODULES`
(`src/core/index.ts`; `node dist/cli.js memory --help` lists `add approve deprecate history reject
search submit`). **But see the hazard in §7.1 — they cannot be pointed at this repository's own
Memory.** In practice the transitions in §3 are still made by editing frontmatter and writing the
commit by hand, in exactly the format above.

### 2.2 Citations: `dl-075-no-bare-line-offsets-in-memory` (`ready`, approved at `0cf643f`)

A **durable** citation — anything in the body of the artefact you produce — names something the file
*carries*: an exported symbol, a heading, a YAML key path, or a verbatim quotation; and it pins the
commit it was read at when the claim is about state that may legitimately move. Ratified as option
(A) composed with (B). A bare `path:line` is legal **only** in note-like sections — Execution Notes,
a bug's Steps to Reproduce, triage notes — where a stale offset is a truthful record of what somebody
read rather than an instruction to a later reader.

This bites this phase directly: a retrospective is almost entirely durable citation. Cite
`retrospective.yaml`'s `capture` phase `produces:` key, not a line of it. Pin every count to the
commit you measured at.

**Every reference must resolve from the repository.** The approver ruled this on 2026-09-28. A
repository document may reference only what a reader of the repository can open:
- a versioned file, element, commit or ref;
- a command that runs against them.

When a document depends on something outside, it **integrates the needed content** and drops the
reference. Examples of outside sources are a file in someone's downloads, a folder outside the
repository, another repository, a session or a transcript. This applies to this plan, to
`retro-v0.2`, and to every element the phase files. What this plan needs from outside sources is in
Appendix A. Where the content cannot enter, because it concerns the external project (§7.7),
describe the WingFoil defect as reproduced here, and leave the source unnamed.

### 2.3 Agents hold no approval authority

CLAUDE.md §4/§8: AI agents execute as `developer`/`reviewer`/`qa`/`architect` and **never** approve.
Two of this phase's four steps are the **approver's** (§3.2 `additional-points`, §3.4 `approve`) —
run them only on Roberto's explicit instruction, and never self-approve the artefact you wrote.

### 2.4 Git: merge `main`, never rebase (`dl-035-task-branch-sync-with-main`, `ready`)

A phase branch that has fallen behind `main` is brought current with `git merge main`. Rebasing a
branch whose commits are Memory state transitions rewrites the audit trail the whole model rests on.
Per `dl-024` the phase runs on its own branch (`design/<phase>_<version>` shape) and merges to `main`
with `--no-ff`. After any merge that moves `package-lock.json`, re-run `npm ci` (§1 P5).

**Everything this phase changes in the repository lives on `design/retrospective_v0.2` until the
single `--no-ff` merge at close-out.** The approver decided this on 2026-09-28. It covers:

- this plan's own revisions;
- `retro-v0.2` itself;
- the §6.1 and §6.2 scheduled items;
- the §6.5 `dl-087` amendment and its release stamp;
- every element spun off at §3.2.

Nothing is committed to `main` directly. There are two consequences:

- **Allocate ids across all branches, not from `main`.** A DL or bug filed here is invisible to
  every other branch until the merge, which is exactly how §6.4's duplicate `dl-080` arose.
  Before every `memory.add`, compute the next free number over every ref:

  ```sh
  for r in $(git branch -a --format='%(refname:short)'); do
    git ls-tree -r --name-only "$r" -- docs/self/docs/04_memory/design/dls/; done \
    | sed -nE 's#.*/dl-([0-9]+)-.*#\1#p' | sort -n | tail -1
  ```

  Use the same command with `bugs/` and `bug-` for bugs. This lowers the risk but does not remove
  it: a session that has not pushed is invisible. So re-run it immediately before the merge, and
  renumber on this branch if anything collided.
- **Other sessions see the changes only after the merge.** That is acceptable here. The
  retrospective is `release-cycle`'s last phase, and its consumer, v0.3 `release-planning`, starts
  after it. If something must reach another session sooner, `dl-087`'s release stamp being the only
  candidate, merge `main` into the branch as usual and ask the approver about an early partial
  merge. Do not cherry-pick onto `main`.

The one thing that does not go on this branch is the error inventory's entries (§6).

### 2.5 The evidence rule: never assert a file's state without running the command that settles it

This is the repository's own hardest-won convention and the one a fresh session breaks first. Do not
write "all v0.2 bugs are closed", "the notes say X", or "that citation still resolves" unless you
just ran the command that shows it — and **put the command in the text**, so the next reader can
re-run it rather than trust you. Where the claim is about state that may move, pin the commit.

**Two phase-local sharpenings.** These are not ratified directives. They are learned from failures
recorded in the v0.3 notes, and they are cheap enough to adopt for this phase alone:

- **An absence claim needs a command that could have found the thing.** "`grep` returns nothing"
  proves nothing unless the same pattern demonstrably matches a known positive case. The notes
  record a real instance: `grep -n "release:"` could not match `element.set_release("…")`, which has
  no colon after `release`, and the empty output was read as evidence. Before citing an empty
  result, show the pattern hitting something.
- **A declared write is followed by a presence check that can fail.** After editing an inventory,
  the plan, or the artefact, grep for the specific text you meant to add, and treat "not found" as
  an error. Counting lines is not such a check, because the count moves for other reasons. It is
  also the first entry of the error inventory (§3.1a): a replacement whose anchor text did not
  exist was reported as applied, and the only check run counted lines.

---

## 3. Steps — mapped to `retrospective.yaml`

Four steps, in the order the workflow declares them. Two are the approver's.

### 3.1 `explore` — role: **facilitator** (agent)

- **Action (`retrospective.yaml`):** `agent.mine_execution_notes`.
- **Produces:** *"retrospective friction inventory (source-cited, grouped by theme)"* — a working
  artefact, **not** a Memory element. Write it to the session's scratchpad; v0.1's lived in one too,
  as `retro-v0.1.md` §Context records. It is read-only work:
  **no commit, no state change**.
- **How:** §4 is the evidence map. The phase description says "Parallelizable (cheap-model miners +
  synthesis)" and v0.1 did exactly that — five parallel read-only miners plus a synthesis pass. v0.2
  is roughly 1.7× the size of v0.1 by task count, so plan for parallel miners with **disjoint**
  slices (§4.7) and one synthesis pass that groups raw items into themes.
- **Output shape:** every inventory item carries (a) a one-line statement of the friction, (b) its
  source — a commit sha and/or a named element id, per §2.2 — and (c) which §5 question it answers.
  Group into themes only at synthesis; do not group while mining, or the first miner's framing
  becomes everyone's.
- **Check:** every item resolves. Re-run each cited command; drop or correct anything that does not.

#### 3.1a Second artefact — the agent-error inventory (input, not authored here)

The approver decided on 2026-09-25 that `explore` also yields an **inventory of the errors agents
made** in v0.2: planning errors, development errors, and violations of directives or specs. Each
entry is **anchored to a point in git history**. The purpose is a later experiment: check out the
tree before the error, redo that piece with a newer WingFoil, and see whether the error recurs.

- **Who compiles it.** By the approver's assignment, the session that kept the v0.3 notes compiles
  it, outside the repository. This plan's executor **receives** it as input to §3.2 and does not
  author entries. Changing who compiles it is the approver's call. The shape every entry must have,
  the attribution classes, the tie-break rule and the error classes to look for are restated in
  **Appendix A.2**. That appendix, not the external file, is what the executor holds entries to.
- **What the executor does with it.** The executor cross-checks it against the slices (§4.7):
  - every reject classified in slice 1 as an agent error either has an entry or has a stated
    reason for having none;
  - every entry's anchor resolves on this repository (`git cat-file -e <sha>`).
- **Two constraints the executor enforces**, whoever writes the entries:
  - An entry with **no tree anyone can check out** is an *observation*, never an *experiment*.
    Several task branches were merged `--no-ff` after repeated merges from `main`, so often there
    is no single "commit before the error".
  - The attribution classes are: (1) the rule did not exist; (2) it was not bound to the role;
    (3) it never reached the agent's context; (4) it was in context and ignored; (5) WingFoil
    could not have prevented it. Only (1)–(3) are evidence *for* WingFoil. Where the transcript
    cannot show that the agent opened the file, (3) vs (4) is *undetermined*, and a forced choice
    defaults to (4).
- **A system-level entry, not anyone's mistake.** The hand-assembled wave briefs are the per-task
  cost of the missing context loader (`agent execute`, P5.3.1 — `grep -c agentExecute
  src/core/index.ts`). They are recorded as one class-(3) row. They are kept outside the repository
  by the orchestrating session. On 2026-09-28 that folder held 55 files, against 54 in a 2026-09-25
  snapshot. Only 19 of the 55 are agent briefs (`.md`); the other 36 are drafted commit messages
  (`.txt`), as the adversarial review found and the executor confirmed by extension count. The unit
  of that cost is therefore 19 briefs, not 55. Re-take the count, dated (A.1), and split it by kind.

#### 3.1b Adversarial review of the attributions — a dedicated agent

The approver decided on 2026-09-25 that the attributions are reviewed by a **dedicated agent whose
mandate is to reject**. It is neither the inventory's author nor this plan's executor, since a good
share of the errors are the executor's own. Start it with this criterion, verbatim in substance:
an entry stays *"the rule did not exist"* only if the reviewer cannot find the rule, **at the
error's date**, in any directive bound to the role, in any `ready` element, **or in any `approved`
tech-spec**. The last clause is not theoretical: `bug-098` was a spec (`spec-005`, exit `2` for
usage errors) that had been correct for a long time while the binary exited `1`. The review's
output is the list of entries it dropped, with a reason each. It is presented at §3.2 together
with what survived.

### 3.2 `additional-points` — role: **approver** — GATE

- **`retrospective.yaml`:** `approval: { by_role: approver }`. The phase description is explicit that
  this is *"a review checkpoint, not an approval-gated transition — no commit."*
- **What the agent does:** present the friction inventory **and** the candidate themes to Roberto,
  and ask him to add points to analyze. Present themes as *candidates with their evidence*, not as
  conclusions — the whole value of this gate is that he can widen scope or reject a framing.
- **What comes back:** additional points, and for each finding a **disposition** — already owned by
  an existing element / spin off a new `decision-log` / file a `bug` / defer. v0.1 recorded these in
  a "Dispositions (decided at the A2 gate)" table (`retro-v0.1.md`); reuse that shape.
- **Every disposition also carries a target release** (approver, 2026-09-25). This repository has
  no "blocking" flag: the `release` field *is* the schedule, and an element without one is filed
  but unplanned. So "defer" without a release is not a disposition. It is how the unscheduled
  population in §4.4 was produced. The agent proposes a release for every row, and the approver
  decides. Where a finding is already owned by an existing element, it still gets a release: a
  `ready` element with no `release` is exactly the case that stays still for months.
- **What the agent brings to this gate, in this order:**
  1. the friction inventory with candidate themes (§3.1);
  2. the agent-error inventory and the list of entries the adversarial review dropped (§3.1a–b);
  3. the **external evidence** of §4.9, each item already reproduced on the scratch project or
     marked *not reproduced*;
  4. the divergence report between the derived findings and the notes (§4.8);
  5. the decisions listed under *Handoff*.

  The external usage feedback declares of itself that it is to be read at this gate or at
  `release-planning`. It is read here.
- **Do not proceed to `capture` without this gate.** Nothing downstream can recover a theme the
  approver would have added.

### 3.3 `capture` — role: **facilitator** (agent)

- **Actions (`retrospective.yaml`):**
  `memory.add(type: decision-log, title: "Retrospective {release.version}")` then `memory.submit`.
- **`{release.version}`** for this run is `v0.2`, so the title is **`Retrospective v0.2`** and, by the
  `produces:` path `docs/04_memory/design/dls/retro-{release.version}.md`, the id is **`retro-v0.2`**
  and the file is `docs/self/docs/04_memory/design/dls/retro-v0.2.md`. Note this id deliberately
  departs from the type's `id_pattern` (`dl-{n}-{slug}` in `.wingfoil/memory.yaml`, the
  `decision-log:` entry) — the workflow's `produces:` pins it, and `retro-v0.1` set the precedent.
- **`memory.add`** (CLAUDE.md §5.1): copy `.wingfoil/memory/templates/decision-log.md` verbatim,
  fill **only** `id`, `title` (pinned by the action), `status: draft`; leave the body as the
  template's placeholder comments. Commit, subject only:
  `wf(decision-log): add retro-v0.2`.
- **`memory.submit`:** write the full body (§6), set the remaining frontmatter, move
  `status: draft → in-discussion` — the `decision-log` sequence is `[draft, in-discussion, ready]`
  (`.wingfoil/memory.yaml`, the `decision-log:` entry's `states.sequence`). Commit, subject only:
  `wf(decision-log): submit retro-v0.2`.
- **Frontmatter to set on submit:** `title` (required — `template.frontmatter.required: [title]`),
  and following `retro-v0.1`'s precedent `context: "retrospective"` and `release: "v0.2"`.
- **Body convention (from the template's own `## Decision` comment):** do **not** mark the body as
  unratified. `status:` already says whether it is `in-discussion` or `ready`, and `memory.approve`
  may change only `status`, so a body marker can never be corrected — 16 decision-logs accumulated
  that defect before the convention was adopted. Where a disposition is still open, present it as
  options and let the approve commit's `Reason:` record the choice.
- **Check (`retrospective.yaml`, `checks.post`):** `frontmatter.required: [title]`.

### 3.4 `approve` — role: **approver** — GATE

- **`retrospective.yaml`:** `approval: { by_role: approver }`.
- On Roberto's explicit instruction only, move `retro-v0.2` `in-discussion → ready` and commit in the
  §2.1 format:

```
wf(decision-log): approve retro-v0.2 [in-discussion → ready]

Approver: Roberto Pompermaier <robypomper@gmail.com> (approver)
Reason: <his decision, including the disposition of anything left open in §6>
```

- Any element **spun off** by this retrospective (new `decision-log`s, new `bug`s) is a separate
  operation in a **separate commit**, per §5.1's one-operation-one-commit rule. Do not batch them
  into the retrospective's own commits.
- After `approve`, this plan itself moves `active → done`. `plan`'s `active` is a `waiting` state
  (`.wingfoil/memory.yaml`, the `plan:` entry — `waiting: [active]`), i.e. it advances when the
  phase's `produces:`/`checks` are satisfied, not by a CLI verb; make it a `wf(plan): submit`-shaped
  hand transition only if the approver asks for the bookkeeping.

---

## 4. The evidence map — where to dig

**Run everything from the repository root on `main`.** Pin your figures to the HEAD you measure at
(`git rev-parse --short HEAD`). The reference anchor below is the commit at which the *previous*
retrospective was ratified; everything after it is the v0.2 era.

```sh
ANCHOR=20e8271      # wf(decision-log): approve retro-v0.1 [in-discussion → ready]
SCRATCH=$(mktemp -d)                          # or your session's scratchpad directory
git merge-base --is-ancestor $ANCHOR main && echo "anchor is on main"
git rev-list --count $ANCHOR..main            # total commits in the v0.2 era
```

> Verify the anchor yourself: `git log --oneline --grep="approve retro-v0.1"`. If the history has
> been rewritten (it has been before), re-derive it rather than trusting the sha above.

### 4.1 Count and shape of what was produced

The questions: **how much** did v0.2 ship, how much of it was *planned*, and how much arrived
mid-flight?

```sh
# A — v0.2 tasks by frontmatter status (frontmatter only; a body line can also start "status:")
awk 'FNR==1{n=0} /^---$/{n++} n==1 && /^status:/{print $2}' \
    docs/self/docs/04_memory/v0.2/*.md | sort | uniq -c

# A' — the task id range, and how many exist
ls docs/self/docs/04_memory/v0.2/ | sed -nE 's/^(task-[0-9]+).*/\1/p' | sort -V | sed -n '1p;$p'
ls docs/self/docs/04_memory/v0.2/*.md | wc -l

# B — every bug, by (release, status)
awk 'FNR==1{n=0;st="";rel=""} /^---$/{n++} n==1&&/^status:/{st=$2} n==1&&/^release:/{rel=$2} \
     n==2&&st!=""{print rel, st; st=""}' docs/self/docs/04_memory/bugs/*.md | sort | uniq -c

# C — every decision-log, by (release, status)
awk 'FNR==1{n=0;st="";rel=""} /^---$/{n++} n==1&&/^status:/{st=$2} n==1&&/^release:/{rel=$2} \
     n==2&&st!=""{print rel, st; st=""}' docs/self/docs/04_memory/design/dls/*.md | sort | uniq -c

# D — what release-planning actually committed to, versus A'
sed -n '/^## Scope/,/^## Pillar/p' docs/self/docs/04_memory/planning/rl-v1/minor-v0.2.md
grep -n "backlog tasks" docs/05_plans/rl-v1/rel-v0.2/release-planning-rel-v0.2-plan.md
```

Compare **A'** against **D**. The gap between the task set release-planning committed to and the task
set that actually exists is a measurement, not a verdict — ask §5 Q1 of it.

### 4.2 The approve and reject commit bodies — the primary source

**Start here, before opening a single task document.** Every `approve` records what was verified and
by what command; every `reject` records what was wrong. They are longer, more specific and more
honest than the documents they are about, because they were written by a reviewer who had just
re-measured.

```sh
# Inventory — how many, of what type, over the v0.2 era
git log --format="%s" $ANCHOR..main --grep="^wf(.*): approve " \
  | sed -E 's/^wf\(([a-z-]+)\).*/\1/' | sort | uniq -c
git log --format="%s" $ANCHOR..main --grep="^wf(.*): reject " \
  | sed -E 's/^wf\(([a-z-]+)\).*/\1/' | sort | uniq -c

# Read them. This is the corpus — expect it to be long; budget for it.
git log $ANCHOR..main --grep="^wf(task): reject " --format="%n===== %h %ad %s%n%b" --date=short \
  > "$SCRATCH/v0.2-rejects.txt"
git log $ANCHOR..main --grep="^wf(.*): approve " --format="%n===== %h %ad %s%n%b" --date=short \
  > "$SCRATCH/v0.2-approves.txt"

# Which tasks were rejected, and which more than once (a second reject is a signal in itself)
git log --format="%s" $ANCHOR..main --grep="^wf(task): reject " \
  | sed -E 's/^wf\(task\): reject ([^ ,]+).*/\1/' | sort | uniq -c | sort -rn
```

**One pattern is handed to you as material to examine, not as a finding.** The release's own review
record repeatedly names *unverified claims in task Execution Notes* — assertions about a file's, a
number's or a test's state that nobody had run the command to settle — rather than defective code, as
what rejections landed on. Two reject bodies say so in those words; find them:

```sh
git log $ANCHOR..main --grep="^wf(task): reject " --format="%h %s%n%b" \
  | grep -niE "unverified claim|claims about|this release's .*rejection" | head
```

Then decide for yourself what it is. It could be the headline lesson. It could be a **symptom** of
something else — review depth, a missing check, a task template that invites assertion without
evidence, notes written from memory at the end of a long task. It could be **already fixed**, since
`dl-075-no-bare-line-offsets-in-memory` was ratified inside this very release and attacks one
mechanism of exactly this failure. Or the corpus may not support it at all once you count. Test it:
classify each of the rejects by what it was *actually* rejected on, count the classes, and see
whether the claim survives your own count. Do not reproduce it because this plan mentioned it.

### 4.3 Corrections — where the process learned something

A correction is a change made to an element **after** it was filed: a body-only amendment, a re-grade
of a severity, a retracted number, a citation that no longer resolves. These are the highest-value
items in the corpus, because each one is a case where the repository caught itself.

```sh
# Body-only amendments: docs(self) commits carry no state change by convention
git log --oneline $ANCHOR..main --grep="^docs(self)" | wc -l
git log --oneline $ANCHOR..main --grep="^docs(self)" \
  | grep -iE "correct|re-grade|regrade|amend|qualify|retract|overclaim|stale|reconstruct|attribute|falsif"

# Read the ones that look like corrections, with their diffs — the diff is the correction
git show <sha>

# Elements whose frontmatter severity/status was changed after filing
git log -p $ANCHOR..main --grep="^docs(self)" -- docs/self/docs/04_memory/bugs/ \
  | grep -E "^[-+]severity:" | sort | uniq -c
```

For each correction ask: **what would have had to be true at filing time for this correction not to
be needed?** That question, applied across the set, is what turns corrections into process findings.

### 4.4 What v0.2 decided *not* to do

Usually the most useful output of a retrospective. Two populations:

```sh
# Open/triaged bugs carrying no release — filed, never scheduled
awk 'FNR==1{n=0;st="";rel=""} /^---$/{n++} n==1&&/^status:/{st=$2} n==1&&/^release:/{rel=$2} \
     n==2&&st!=""{if(rel=="\"\"") print FILENAME": "st; st=""}' docs/self/docs/04_memory/bugs/*.md

# in-discussion decision-logs carrying no release — proposed, never ratified or scheduled
awk 'FNR==1{n=0;st="";rel=""} /^---$/{n++} n==1&&/^status:/{st=$2} n==1&&/^release:/{rel=$2} \
     n==2&&st!=""{if(rel=="\"\"" && st=="in-discussion") print FILENAME; st=""}' \
     docs/self/docs/04_memory/design/dls/*.md

# every unscheduled decision-log with status + title — the substance is in the titles.
# This deliberately includes the `ready` ones too: see the note below.
awk 'FNR==1{n=0;st="";rel="";ti=""} /^---$/{n++} n==1&&/^status:/{st=$2} n==1&&/^release:/{rel=$2} \
     n==1&&/^title:/{ti=substr($0,8)} n==2&&st!=""{if(rel=="\"\"") printf "%-70s %-14s %s\n", FILENAME, st, ti; st=""}' \
     docs/self/docs/04_memory/design/dls/*.md
```

Note also the population of `ready` decision-logs that carry **no** `release` — ratified rules with
no scheduled carrier. `dl-016-release-planning-governance-reconcile` added a
`reconcile-governance` phase precisely to sweep these; whether it did, for v0.2, is answerable:

```sh
grep -n "reconcile-governance\|triage-bugs" docs/05_plans/rl-v1/rel-v0.2/release-planning-rel-v0.2-plan.md
```

And ask whether any of these should be scheduled into v0.3 by this retrospective's Actions — that is
a disposition for the §3.2 gate, not for the agent.

### 4.5 Execution Notes — the secondary source

`retrospective.yaml`'s `explore` phase names the `## Execution Notes` sections explicitly. Mine them
**after** §4.2, so you read them knowing what the reviewer said about them.

```sh
# Every v0.2 task's Execution Notes, one file per task
for f in docs/self/docs/04_memory/v0.2/task-*.md; do
  echo "===== $f"; sed -n '/^## Execution Notes/,$p' "$f"
done > "$SCRATCH/v0.2-execution-notes.txt"

# The AC classification the testing directive requires (dl-014 T1): red-first vs characterization
grep -ci "characteriz" "$SCRATCH/v0.2-execution-notes.txt"
grep -ci "red-first"   "$SCRATCH/v0.2-execution-notes.txt"

# Deferrals — work a task pushed to a later one
grep -niE "defer|deferred to|out of scope|follow-up|left to" "$SCRATCH/v0.2-execution-notes.txt" | head -50

# depends_on acknowledgements (dl-015's hard gate) — did they actually happen?
grep -rn "^depends_on:" docs/self/docs/04_memory/v0.2/*.md | head -40
```

Also mine the **non-task** elements the phase lists: the bugs, the decision-logs ratified in v0.2, the
`minor-v0.2` release document, and the outcomes recorded in the sibling plans:

```sh
ls docs/05_plans/rl-v1/rel-v0.2/
grep -n "^status:" docs/05_plans/rl-v1/rel-v0.2/*.md
```

### 4.6 Process drift — the commit grammar as evidence

The set of verbs actually used against Memory is measurable, and CLAUDE.md §5.1 declares only five
(`add`, `submit`, `approve`, `reject`, `deprecate`):

```sh
git log --format="%s" $ANCHOR..main --grep="^wf(" \
  | sed -E 's/^wf\(([a-z-]+)\): ([a-z-]+).*/\1 \2/' | sort | uniq -c | sort -rn
```

Verbs outside those five appear in the output. Each is either a workflow action that legitimately
needs a commit (e.g. `dev-loop.yaml`'s `bug.sync_state`, `element.set_state`) or drift. Find each
one's origin before judging it:

```sh
grep -rn "sync_state\|set_state" docs/self/.wingfoil/workflows/custom/*.yaml
git log --format="%s%n%b" $ANCHOR..main --grep="^wf(task): finalize" | head -20
```

The question for §5 is not "is this wrong" but **"is the grammar in §5.1 a complete description of
what the process actually does?"**

### 4.7 Suggested mining slices (disjoint, parallelizable)

Eight read-only miners, each writing a flat list of source-cited items to its own scratchpad file,
then one synthesis pass. Slices 1–5 are v1.0's. Slices 6–8 are methods the v0.3 notes proposed for
this plan (§4.8): directive compliance, rework, bug provenance, and per-phase git metrics. They are
fully specified here.

1. **Rejects + rework** — every `wf(task): reject` body (§4.2). Classify each by what it was
   rejected on. Add the rework metrics:
   - rejects per task;
   - tasks rejected twice or more;
   - bugs whose body names a v0.2 task as their origin.

   Each reject that is an *agent error* is a candidate for the error inventory (§3.1a).
2. **Approves** — every `wf(*): approve` body (§4.2). Extract what was verified and *how*.
3. **Corrections** — every `docs(self)` amendment (§4.3), with its diff.
4. **Execution Notes + plan vs reality** — all v0.2 task notes (§4.5): deferrals, AC classification,
   tooling friction. Also, for each of the phase plans in `docs/05_plans/rl-v1/rel-v0.2/`, compare
   what the plan foresaw with what its revision history and closing commit record. There were 15
   plans at `a20b346c` (`ls docs/05_plans/rl-v1/rel-v0.2/ | wc -l`).
5. **Unscheduled + governance** — §4.4 plus the v0.2 bugs and ratified decision-logs. Count the
   population with no `release`, by type, excluding terminal states:

   ```sh
   for d in bugs design/dls design/adrs design/specs; do
     awk -v d="$d" 'FNR==1{n=0;st="";rel=""} /^---$/{n++} n==1&&/^status:/{st=$2} n==1&&/^release:/{rel=$2}
       n==2&&st!=""{if((rel=="\"\""||rel=="") && st!~/^(closed|done|deprecated|superseded)$/) print d, st; st=""}' \
       docs/self/docs/04_memory/$d/*.md
   done | sort | uniq -c
   ```
   This is the population §6.3 plans the clean-up of. Report it with the command and the HEAD.
6. **Git-tree metrics per phase** — the commit log *as* evidence of process, measured per v0.2 phase
   window. The metrics are below. At `a20b346c` the first command gives two authors, and only one
   of them is in `team.members`. That is a sanity check on the command, not a finding.

   ```sh
   A=$ANCHOR
   git log --format='%ae' $A..main | sort | uniq -c                          # authors
   grep -A3 'members:' docs/self/.wingfoil/dna.yaml                         # who is on the team
   git log $A..main --grep='^wf(.*): approve ' --format='%H %ae' |          # approve author vs body
     while read h e; do git log -1 --format=%b $h | grep -q '^Approver:' && echo "$e"; done | sort | uniq -c
   git log --format='%(trailers:key=Co-Authored-By,valueonly)' $A..main | sed 's/ <.*//' | grep . | sort | uniq -c
   git log --format=%s $A..main | awk '{n++; s+=length($0); if(length($0)>72)o++} END{print n, s/n, o}'
   git log --format=%s $A..main | grep '^wf(' | grep -oE -- '\[[^]]*(->|→)[^]]*\]' \
     | grep -oE -- '->|→' | sort | uniq -c                                  # bracket arrow form
   grep -n 'BRACKET_RE' src/memory/audit.ts                                 # which arrow the reader accepts
   for r in $(git branch -a --format='%(refname:short)'); do                # the same id allocated twice
     git ls-tree -r --name-only "$r" -- docs/self/docs/04_memory/ 2>/dev/null; done \
     | sed -nE 's#.*/((dl|bug|task|adr|spec)-[0-9]+)-.*\.md#\1 &#p' | sort -u | awk '{print $1}' | uniq -d
   ```

   Also measure, per phase window:
   - the share of commits with a body;
   - the share that touch both `src/`/`test/` and `docs/` (Execution Notes committed with code);
   - the verb set, which is §4.6 — slice 6 owns it.

   Ask of each metric **on which day it moved**, not only how large it is. A metric that would have
   flagged a problem the day it started is a candidate check for future retrospectives (Q11).
7. **Bug provenance** — for every bug filed in the era, **how it surfaced**:
   - a named gate (which one);
   - an independent review;
   - a task finding a defect in its own finished work;
   - normal use;
   - external use (§4.9 a).

   The sources are each bug's body and the `bug-ingest-*` plans that filed it. This is the most
   direct measure of whether the gates earn their cost (Q9). Classify from the text, and mark
   *unknown* where the text does not say.
8. **Directive compliance, one directive at a time** — for each directive bound in `roles.yaml`,
   pick a mechanical proxy and count. Examples:
   - `doc-versioning`: edits to an already-committed doc with no `version:` change;
   - `claim-evidence`: from `task-094` onward, notes asserting a file's state without the command;
   - `dl-075`: bare `path:line` in durable sections;
   - `traceability`: tasks with no `ref:`.

   State each proxy's blind spot next to its count.

Synthesis groups raw items into themes and drops anything whose citation does not re-resolve. Give
each miner §2.2 and §2.5 verbatim, or the inventory will come back full of bare offsets and
unverified assertions — which would be a notably poor way to write *this* retrospective.

---

## 4.8 A second source exists — its methods are inputs, its findings are a check

> **v1.1 — the split this revision adds.** The notes carry two kinds of content, and only one of
> them can bias a derivation.
>
> - **Methods** decide *where to look*, not *what to find*, and they are imported **now**. Examples:
>   the error inventory's shape, the git metrics, bug provenance, directive compliance, a target
>   release on every disposition, and the two evidence sharpenings. They are imported as §2.5's
>   rules, §3.1a–b, §3.2's release column, and §4.7 slices 6–8.
> - **Findings** decide *what to find*, and they are still read **only after** the primary mining,
>   under the rule below. Findings are the suggestion table's rows, its cross-cutting themes, and
>   its "spunti".
>
> The rule's scope grew with the notes. v1.0 described them as derived from five documents. By
> 2026-09-28 there were fifteen notes, drawn from:
> - external usage;
> - the untracked viewer documents;
> - a competitor study;
> - a DL/bug/directive boundary triage, done on titles and not audited;
> - direct requests from the approver;
> - an analysis of this repository's git tree;
> - a quality analysis by area;
> - one unmerged branch.
>
> The completeness limit below applies to that wider set, unchanged: agreement still proves only
> that you covered what they covered. Two of those sources, the git-tree analysis and the quality
> analysis, reached the notes as chat text. Their underlying document has since been supplied: see
> §4.9 (c). Their figures are still **re-measured here or not used**.
>
> **The notes are dated, and some are already superseded.** Their full re-check is dated
> 2026-09-25, with additions on 2026-09-28. Since then `wingfoil@0.2.1` has been published and
> `minor-v0.2` has reached `released` (`d2ad1f3f`). That closes their rows about the package
> version and about npm availability. P7 exists for this reason.

A separate session was running throughout v0.2 collecting notes and
references intended for v0.3 planning. It is a **secondary** source: someone's account of what
happened, formed while it happened. Everything in §4.1–§4.7 is **primary** — commit bodies, frontmatter,
diffs, the artefacts themselves.

**The order matters and is the point of this subsection.** Form your findings from the primary
material first, and only then read the notes, for two purposes and no others:

- **Completeness, but only over what the notes cover.** Something the notes record that your mining
  did not surface is a gap in your method — go back to the primary source and establish it there, or
  discard it. A finding that exists only because the notes assert it does not belong in `retro-v0.2`.
  **Read the limit carefully, because it inverts the usual risk:** that source is not a scan of this
  repository's backlog. It is derived from five documents its author was given, so it is complete
  with respect to *those* and says nothing about anything else. Agreement between it and your own
  findings is therefore **not** evidence that you have covered the release — it is evidence that you
  covered the same five documents. Elements filed late in v0.2 in particular are outside it, and the
  notes say so themselves.
- **Divergence.** Where the notes and your findings disagree, that disagreement is itself material
  worth recording: it is a measurement of how much of this release's account depended on being
  present for it.

Reading them first would import pre-formed conclusions into a document whose value is that it was
derived. This release rejected work repeatedly for asserting what someone remembered rather than what
a command showed; a retrospective that inherits its findings from a running commentary would be the
same failure at the scale of the whole release.

**The dependency is fragile and must be made concrete before this phase runs.** That session's
content lives in its own transcript, not in this repository — a later session cannot read it, and
sessions do not persist indefinitely. So one of the following must be true before `explore` starts,
and verifying which is part of P-checks:

- the notes have been **landed somewhere durable**, outside this repository, and treated as above.
  **As of 2026-09-28 this is the case.** This repository never cites their location or their files:
  a reference a reader of this repository cannot open is not a citation. What this plan relies on
  from them is **restated in Appendix A**. Everything else in them enters only as a finding that has
  been re-derived from primary material. **Nothing else from them may be copied into this
  repository**: they contain
  material about a separate benchmark project, and by the approver's standing rule that material does
  not enter WingFoil2. A defect learned from it is described as a WingFoil defect and **reproduced on
  this repository** before it becomes an element — which is how `bug-076` and `bug-077` were filed;
  **or**
- that session is still alive and reachable, in which case request the notes explicitly and record
  what came back; **or**
- neither holds, in which case **say so in `retro-v0.2` and proceed on the primary material alone.**
  That is an acceptable outcome, not a blocker — the evidence map is sufficient without it. What is
  not acceptable is a retrospective that silently assumes a source it never read.

Note the overlap with v0.3 planning is deliberate on that session's side: the unscheduled 44 open
bugs and the `in-discussion` decision-logs are simultaneously this retrospective's "what v0.2 chose
not to do" and that session's input. Two independently derived lists are useful; two lists where one
was copied from the other are one list with extra steps.

## 4.9 Evidence that lives outside this repository

Four sources are not commits, frontmatter or diffs, and each has its own admission rule. None of
them is cited from `retro-v0.2` by path. What enters the artefact is the **WingFoil-side
reproduction** or the **re-measurement**, never the source.

- **(a) External usage feedback.** This is a numbered list, kept outside this repository, of
  defects met while using WingFoil to govern another project. It is an open list that grows: 34
  items at 2026-09-25. It is a different kind of evidence: it holds defects that v0.2's own
  gates did not catch. Two of them were release blockers, `bug-076` and `bug-077`.
  - **Admission:** each item is reproduced on the scratch project (P9), with the pinned build (P8),
    before it counts.
  - **How it is described:** as a WingFoil defect. The other project is never named or described.
  - **If it does not reproduce:** it is reported at §3.2 as *not reproduced*, with the commands
    that tried.
- **(b) Template divergence.** The same project had to modify the templates WingFoil v0.2
  generated before it could work. The method is mechanical:
  1. regenerate the templates of the version it used, with `wingfoil init --template <t>` in a
     scratch directory;
  2. diff them against that project's current configuration;
  3. read the *why* in the commits that changed them.

  This analysis runs **outside** this repository. What enters is only the list of template defects,
  each reproduced by `init` on the scratch project. It measures the entry cost on files rather than
  by impression. Its natural target is P4.18, already in `minor-v0.3`'s `features:`.
- **(c) The release-health data — git-tree and quality analysis.** This is a document the approver
  supplied on 2026-09-28, outside version control. The parts this plan uses are restated in
  **Appendix A.3**. The same analysis is carried, revised, by `dl-089` (§6.6), which is versioned.
  - **How it was measured.** The measurement was taken on a public clone at `main` `5269223d`,
    which is before `release-submit` and `release-publishing`, with Node 22.22.2 rather than the
    pinned 22.12.0. The complexity threshold was 15, the clone threshold 8 lines, and the phase
    boundaries were taken from Memory transitions.
  - **Its sections are admitted differently**, like the notes (§4.8):
    - **§§0–4, measurements.** They are a calibration target for slice 6, not figures to copy.
      Run slice 6's commands at `5269223d` first and compare. A difference is either a
      definition difference or an error, and each is named before any figure is used. One
      difference is already known. For approvals signed by the out-of-team identity, three
      figures exist:
      - the file gives 131 at `5269223d`, counting every `wf()` commit whose body names the
        approver on an `Approver:` line;
      - the notes session re-ran that definition later on 2026-09-28 and got 138, because the
        figure grows with history;
      - at `5269223d`, counting only `approve` commits whose `Approver:` line names the approver,
        the count is 112 (§4.7 slice 6's loop with `'^Approver:.*Roberto'`), which matches the
        notes.

      These are two definitions, not an error. **Every figure in the artefact is written with its
      definition and the commit it was measured at**, or the next re-check will read growth as a
      discrepancy.
    - **§2, the phase windows A–E, and §7, its corrections.** These are **method** and are
      imported now. Slice 6 uses these windows as its starting partition. The two corrections
      bind slice 6's interpretation:
      - back-merges are `dl-035` taking effect, not a regression;
      - an ASCII arrow on this repository is format drift in hand-written commits, not proof the
        tool was bypassed (`bug-075`).
    - **§5–§6, the "already tracked" map and the derived suggestion rows.** These are
      **findings**, read only after mining (§4.8). Cite neither: their row numbers refer to an
      external table, and they disagree with each other.
  - **Already superseded at `a20b346c`:** `package.json` 0.1.0, "`npm view wingfoil` not found",
    and "no tags on `origin`". `wingfoil@0.2.1` is published and tagged. This is P7's reason for
    existing, demonstrated.
  - **It names a decision-log that does not exist, under an id that is taken.** The file calls
    itself the baseline of `dl-087-release-health-analyses-before-retrospective`. No such file
    exists on any branch: the §2.4 all-refs loop, with `grep release-health`, returns nothing.
    The positive case holds: the same loop finds `dl-087-publish-through-npm-staged-publishing`.
    This is a **second collision with a different cause** from §6.4:
    - §6.4 is two *elements* created in parallel on different branches;
    - this is an id *cited by a document* whose element was never created.

    The remedies differ, so the mining keeps them as two items. The all-refs allocation of §2.4
    prevents the first. The second needs an id to be allocated only by creating the element, and a
    proposal to cite no id until then. The proposal was filed as `dl-089` (§6.6). Its substance, *release-health
    measurements as a standing input to every retrospective*, is Q11's question, and the §3.2
    gate disposes of it.
  - **The scripted run it announces does not exist yet.** The file says a script will replace it,
    but no script came with it. Until one does, slice 6's commands are the executable form.
- **(d) Chat-only corrections and session testimony.** Many approver corrections happened in
  conversation and left neither a commit nor an element, so the repository cannot show them. The
  sessions that executed v0.2 can be asked, and the transcripts can be searched. The most useful
  question is *what did the agent have in front of it*, which is what separates attribution (3)
  from (4). An answer is **testimony**. It is cited with the session that gave it and verified
  against the repository under `claim-evidence`, because a session also remembers superseded
  versions of a file.

## 5. Questions to put to the material

The inventory answers questions; it does not deliver verdicts. These are the questions — the answers
are whatever the evidence says.

- **Q1 — Scope.** How does the task set that shipped compare to the one release-planning committed
  to (§4.1 A' vs D)? What produced the difference — discovered defects, deferred work, governance
  sweeps, scope the planning phase could not have seen? Was the difference *governed* (filed as
  elements, scheduled) or absorbed silently?
- **Q2 — Rejections.** What did rejections actually land on (§4.2)? Build your own classification and
  count. Where a task was rejected twice, did the second reject find the same class of problem as the
  first? What does that say about what the first reject asked for?
- **Q3 — Corrections.** What had to be corrected after filing (§4.3), and what would have had to be
  true at filing time to make each correction unnecessary? Which of those preconditions is a *process*
  change and which is a *person having a bad afternoon*?
- **Q4 — TDD honesty.** How many acceptance criteria were classified red-first vs characterization
  (§4.5)? v0.1's retrospective recorded that most of v0.1 was verification-only (theme T1 in
  `retro-v0.1.md`) and routed it into `dl-014` + the `testing` directive. Did that change anything
  measurable in v0.2?
- **Q5 — Governance debt.** How many decision-logs and bugs are still unscheduled (§4.4)? Is the
  population growing or shrinking against v0.1? `dl-016` added `reconcile-governance` to catch exactly
  this — did it fire for v0.2?
- **Q6 — Process drift.** Is CLAUDE.md §5.1's five-verb grammar a complete description of what the
  process does (§4.6)? If not, is the answer to change the grammar or the practice?
- **Q7 — What went well.** The `retro-v0.1.md` "What went well" section is not decoration: a
  retrospective that records only friction teaches the next release to stop doing things that worked.
  What does the evidence show **held**? Approve bodies (§4.2) are the source — they record what
  verification caught, which is the strongest available evidence that a gate is earning its cost.
- **Q8 — v0.1's own dispositions.** `retro-v0.1.md` §Dispositions assigned every v0.1 finding to a
  vehicle (`dl-013/014/015/016/017/019/020/022/023/024`, `bug-004/006/007`, deferrals). Which of those
  actually landed in v0.2? Check each element's current `status`. A retrospective that never audits
  the previous retrospective's actions is a ritual.
- **Q9 — Did the gates pay?** Slice 7 gives the provenance of every bug. Measure how many bugs a
  declared gate caught, how many an independent review caught, how many a task caught against its
  own finished work, and how many were found only by using the product, here or externally. If
  most arrived from outside the gates, that is an answer about **where** the gates sit, not only
  whether they work.
- **Q10 — What reached the agent?** A rule can exist and still never be in front of the agent that
  needed it. Look at the error inventory's class-(3) entries (§3.1a) and at the briefs. How much of
  v0.2's error load traces to the missing context loader rather than to missing rules? Is the brief
  count the right unit for that cost?
- **Q11 — Is this repository's own audit trail sound?** Slice 6 measures who signed the approvals,
  which arrow the brackets use against the one the reader accepts, and whether ids were allocated
  twice across branches. If a check that would have flagged a drift on the day it began is cheap,
  is it a candidate standing check for every retrospective? Or should it be a CI check?
- **Q12 — What did the outside see that the inside did not?** Take each external-usage item that
  reproduces (§4.9 a) and each template divergence (§4.9 b). Which v0.2 gate *should* have caught
  it? Did that gate exist, but test the product only on this repository's own configuration?

---

## 6. What `retro-v0.2.md` must contain

Follow `retro-v0.1.md`'s structure — it is the precedent in this repository and it came out of this
same workflow version. Sections, in the decision-log template's order:

- **`## Context`** — what `minor-v0.2` was, that it reached `released`, and **how this retrospective
  was conducted**: the mining slices, the corpus sizes with the commands that produced them, and where
  the friction inventory lives. A reader must be able to re-derive the inventory from this paragraph.
- **`## Decision`** — what is decided *about the process*, present tense, no unratified preamble
  (§3.3). Then:
  - **What went well** — each item cited (Q7).
  - **What didn't go well** — the theme inventory, each theme citing its sources (§4, Q1–Q6).
  - **Dispositions** — the table from the §3.2 gate. Its columns are finding → disposition →
    vehicle (existing element / new DL / new bug / directive change / deferred) → **target
    release** (§3.2). Every finding gets one. "Deferred" is a disposition and must be written as
    one, with the reason **and** the release.
  - **Agent errors** — a summary of the error inventory (§3.1a) that survived the adversarial
    review: the counts per attribution class, and which entries are experiments (checkout-able)
    rather than observations. **Only this summary enters the repository.** The approver decided on
    2026-09-28 that the entries themselves stay outside version control. So
    the summary must be self-sufficient: counts, classes and the review's drop rate. It cannot
    point at a file that no reader of this repository can open (`dl-075`).
- **`## Rationale`** — why the dispositions are what they are, and what was deliberately left out of
  scope. v0.1 used this section to bound the work; do the same.
- **`## Actions`** — checkbox list with owners. Include the audit of v0.1's own actions (Q8) and
  anything this retrospective wants carried into v0.3's `release-planning`.

**Every claim in the body carries its source** (§2.2, §2.5). If a theme cannot be cited, it is not a
theme, it is an impression — put it to the approver at §3.2 as a question instead.

---

## 6.3 Two outputs this retrospective plans for v0.3 — defined here, executed there

The approver decided on 2026-09-25 that these are **outputs** of the retrospective. They are to be
executed at the start of v0.3, not during this phase. `retro-v0.2`'s `## Actions` carries both, with
a target release. Neither is a finding: both would exist whatever the mining concluded.

**(a) Clean-up of the unscheduled population.** Slice 5 counts it. At `a20b346c` its command gives
70 `open` and 5 `triaged` bugs, 41 `ready` and 27 `in-discussion` decision-logs, 7 `accepted` ADRs
and 14 `approved` tech-specs, all with no `release`. The retrospective defines five things:

- **The size.** Re-measured at execution time, because the population grows.
- **Who decides.** Assigning a release is a scope decision, so it belongs to the approver. An agent
  proposes in thematic blocks and never stamps a release alone.
- **The legal exit.** `release` schedules the way in, not the way out. For a bug judged not to be
  done, the `bug` machine has no legal path to `closed` once past `open` (`bug-094`, open). So
  either `bug-094` is scheduled first, or `deprecate` is used and declared as such.
- **The commit grammar.** None of the five declared verbs stamps a release. Decide whether it is
  one commit per thematic block or one per element, and under which subject.
- **The venue.** This is **not** a new procedure. `release-planning.yaml`'s `build-backlog` phase
  already declares `element.set_release("{release.version}")`, and the workflow's scope filter
  (`dl-016`) already re-offers every element whose `release` is empty. What is missing is that
  `element.set_release` has no implementation. Show it the absence-claim way (§2.5): `grep -rn
  "set_release" src/` returns nothing, while `grep -rn "set_release"
  docs/self/.wingfoil/workflows/custom/` does find the token. So the clean-up is `build-backlog`
  run on a population it was never given, done by hand until that token has a binding. That ties
  it to §6.1.

**(b) The preconditions for starting v0.3.** Several points are v0.3 *start conditions* rather than
retrospective findings. They are carried to v0.3 `release-planning` as scope proposals with a target
release, and nothing about them is decided here:

- **Configuration at the root.** Move `docs/self/.wingfoil/` to `.wingfoil/` at the repository
  root, together with the Memory path patterns that resolve against it. This closes `bug-075`, and
  it is what makes the verbs usable on this repository at all. Order constraint: it comes after
  the bracket-arrow question of slice 6 is settled. Otherwise, the moment the Memory becomes
  readable, `memory history` fails to reconstruct the transitions written with the other arrow.
- **Develop v0.3 with the released v0.2.** Use `wingfoil@0.2.1` from npm, the first published build,
  and register its MCP server as `dl-026` (`ready`) already decides.
- **Which build is used, and the rule for replacing it mid-release** if it proves defective.
- **Recording each agent run's token consumption.** Record tokens, not currency, together with the
  element, phase, role, model, outcome and WingFoil version.
- **A retrospective-notes record written during the release** rather than reconstructed at the
  end. It needs a declared marker, a `checks.post` that requires it, and a home for phases that
  have no task.

- **A tool signature on every commit WingFoil writes, carrying the WingFoil version *and* the git
  commit of the build.** The approver requested it on 2026-09-28.
  Today the verbs write no tool trailer: `grep -n "RESERVED_TRAILER_LINE_RE ="
  src/memory/commit-message.ts` shows only `Approver`/`Reason`. The binary does not know its own
  commit either: `--version` reads `package.json` only. This is the same datum as "the commit in
  `--version`" and as the version field of the consumption record above. It is what makes the
  error inventory's replay (§3.1a) state which build each attempt used, and it makes a hand-written
  `wf()` commit distinguishable from a tool-written one (slice 6). Two constraints are for the DL:
  the commit is stamped at build or pack time, never read from the user's working directory
  (REQ-SYS-07), and whether the trailer key is reserved like `Approver:` under `dl-067`.

The consumption record and the retrospective-notes record share their natural carrier with Q10's missing context loader, `agent execute`
(P5.3.1). That feature is in `minor-v0.3`'s `features:`, which makes it *proposed* for v0.3, not
delivered.

## 6.4 One decision before any decision-log is counted — a duplicate `dl-080`

Slice 6's id-collision command finds `dl-080` allocated twice. `main` holds
`dl-080-which-baseline-each-command-reads`. The unmerged remote branch
`claude/wingfoil-persistent-agents-0or53t` holds `dl-080-perennial-agents` (`in-discussion`,
`add` `54ff3300`, `submit` `05adefd9`, authored by an identity that is not in `team.members`).
Ids are allocated per branch, so two parallel sessions took the same number.

This is two things:

- **A finding** about id allocation. It belongs in the mining, like any other.
- **A branch disposition, decided by the approver on 2026-09-28: the proposal is not merged, and the
  branch is to be removed as part of this retrospective's close-out.**
  - The branch's content is not counted in any decision-log figure in the artefact.
  - `retro-v0.2` records its two commit shas, so the content stays identifiable.
  - The removal itself is a remote, irreversible operation. It is carried out at close-out only
    after the approver confirms it in the session.

## 6.5 A publishing fact to record — the direct-publish token is gone, and `dl-087` is now blocking

The approver stated this in this phase's session on 2026-09-28. After `wingfoil@0.2.1` was published,
the approver did two things:

- **revoked** the all-packages read-write npm token that the v0.2 publish used;
- **created a new token of the stage-only type** and set it as the `npm-publish` environment's
  `NPM_TOKEN`.

This is scheduled work, like §6.1 and §6.2. It is not a finding to be mined. Record it as work
performed.

**What the repository can and cannot confirm.** The revocation happened on npmjs.com, so from here
it is the approver's testimony and is cited as such. The secret change is corroborated:
`gh secret list --env npm-publish` shows `NPM_TOKEN` updated at `2026-09-28T09:25:34Z`. That is
after the 0.2.1 publish run. Re-run the command and quote its output rather than this sentence.

**Why it matters.** `publish.yml`'s promote job still publishes with `npm publish ./dist-pack/*.tgz
--provenance …`. This is the token direct-publish path. The release-publishing phase already
recorded that npm refuses `npm publish` with a stage-only token (`release-publishing-rel-v0.2-plan`,
the blocker it resolved with a direct-publish token). With that token revoked, **the next publish
fails under the current pipeline.** `dl-087-publish-through-npm-staged-publishing` (`in-discussion`,
`release: ""`) was written against npm's January 2027 removal of token direct-publish. Its deadline
is now earlier: **it must be ratified and implemented before the next `release-publishing`.**

**What to record, each as its own commit (§5.1 one-operation-one-commit):**

1. **`dl-087` — a dated, body-only amendment** (`docs(self)`). It goes in `## Context`, or in a dated
   note under it, and states four things:
   - the revocation;
   - the new stage-only token;
   - the `gh secret list` evidence;
   - the consequence above.

   Do not touch `status`. Ratification is the approver's `approve`.
2. **`dl-087` — `release: "v0.3"`**, the next minor. This carries out the approver's statement that
   it is mandatory before the next publish. It is a frontmatter edit, since no declared verb stamps
   a release (§6.3 a). Its subject and commit follow whatever the §3.2 gate decides for release
   stamping. Absent that, use a `docs(self)` commit naming the approver's 2026-09-28 statement.
3. **In `retro-v0.2`:**
   - the Dispositions table carries this as *work performed*, with vehicle `dl-087` and target
     release `v0.3`;
   - `## Actions` carries **"`dl-087` ratified and implemented before v0.3 `release-publishing`"**
     as a precondition for v0.3's publishing phase, next to the v0.3 start conditions of §6.3 b.

Keep the retrospective's framing honest. The *event* is operational and not a lesson. The lesson,
if any, belongs to the mining. For example, Q12's question is whether a vendor-side change could
have been anticipated. The staging token type appeared on 2026-09-18, and v0.2's first publish
attempt met it.

---

## 6.2 A vision-layer correction is scheduled into this phase — `06_features.md` and the DNA surface

Decided by the approver on 2026-09-24 while ruling on `bug-092`. This is a concrete edit with a known
target, not a finding to be mined — do it, and record it in the Dispositions table as work performed
rather than as something discovered.

**What is wrong.** `docs/01_vision/06_features.md` lists `P2.1` as `wingfoil dna set` and nothing
else; its prioritisation row calls the feature "Basic CRUD operations" at Critical priority. The DNA
surface is now **four** commands — `dna set`, `dna add`, `dna remove`, `dna update` — ratified by
`dl-081` and `dl-082` and shipped by `task-093`. The feature list has never said so.

**Why it is here and not in a fix task.** `bug-090` covers `docs/01_vision/X_cli-cmds.md`, the command
*reference*, and `task-098` corrects it — including adding rows for the three verbs it never carried.
Nothing covers the feature *list*, which is the artefact that decides what `P2.1` is understood to
be, and which the traceability chain (feature → US → BDD → REQ → task) hangs from. Correcting a
feature definition is a vision-layer conclusion about the release, which is this phase's subject.

**What the edit must say, and what it must not.** `P2.1` already authorises the four commands — the
three new verbs trace to its "Basic CRUD operations" framing, which is the reasoning recorded in
`bug-090`'s 2026-09-24 note. So this records a surface that was always within the feature, rather
than adding scope. Do not invent a `P2.6`; do not restate the grammar, which `X_cli-cmds.md` owns
after `task-098`.

**Record that `dna set` and `dna update` both stay, and why.** The approver ruled on 2026-09-24 that
the two coexist: `set` is `update` with a scalar-only pre-check, and that pre-check is a guard rail
whose refusal names the verbs that would work. A reader of the feature list should not be left to
conclude one of them is redundant — `bug-092` carries the full reasoning, including the proposal to
deprecate `update` and the two objections that declined it.

**Check the neighbours before you finish.** `06_features.md` also carries `P2.3 wingfoil dna infer`,
which is not built (`spec-006` marks `dnaInfer` *planned*), and `P2.4`'s description still names
`conventions`, which `spec-002` removed from `dna.yaml` in v1.1. Neither is in scope here. Say in the
Dispositions table which you checked and left, so the next reader knows the omission was deliberate.

---

## 6.1 A second, unrelated decision-log is created in this phase — by scheduling, not by derivation

Decided by the approver on 2026-09-22, and **confirmed directly to this plan's author** the same day:
the bindings proposal is promoted to a decision-log *during the retrospective*. It first reached this
plan second-hand, relayed by the session holding the v0.3 notes; the confirmation removes the doubt
and is recorded here so a later reader does not have to reconstruct it.

A proposal about **which command each `actions:` and `checks:` token in the workflow definitions
corresponds to** — six open questions — is to be promoted to a real decision-log **during this
phase**: `memory.add` then `memory.submit`, landing at `in-discussion`. It is not ratified here; it is
merely brought into Memory so it stops living outside it.

**Understand what it is and is not.** It is *not* a finding of this retrospective and must not be
presented as one. Nothing about it is derived from the material in §4 — it predates the mining and
would exist whatever this retrospective concluded. It is here because this phase is the next moment
someone is authoring decision-logs, which is scheduling convenience. Keep it out of `retro-v0.2.md`'s
findings entirely; if `retro-v0.2` mentions it at all, it is as an action taken, not a lesson learned.

**The constraint that decides whether it is written correctly.** Its source document belongs to an
unversioned experiment. The approver has ruled that the experiment stays that way: not committed,
and not declared in `dna.yaml`'s `paths:`. So the new decision-log **may not cite that document**. A
reader cannot resolve it, and citing it would create exactly the dangling reference `dl-075` was
ratified to stop. The six questions it poses are restated here, so this plan does not depend on it
either:

1. Are token → command bindings declared in a file of their own, or as a section of `dna.yaml`?
2. Is binding **strict**, where an unbound token is an error, or **optional**, where it is skipped
   with a note?
3. How are a token's arguments passed to its command? That is a new input surface under the
   REQ-SEC requirements.
4. What do a bound command's exit codes mean to the phase? That is the REQ-INT-04 exit-code
   contract applied to `checks`.
5. Who may declare or change a binding, and through which approval?
6. Do `agent.*` tokens bind to a command at all, or to a role prompt, the MCP server's role Prompts,
   and a future `wingfoil agent prompt`?

What that means in practice is that the substance must be **restated from versioned ground**. The six
questions are about `actions:` and `checks:` tokens, and those live in
`docs/self/.wingfoil/workflows/custom/*.yaml`, which *is* versioned — so each question can be posed
against the real token it concerns, cited by workflow name and key path per `dl-075`. The proposal
document is where the thinking came from; the workflow files are what the decision-log argues about.
This is the same discipline the v0.3 notes are under (§4.8) and the same one `bug-076` and `bug-077`
went through: learn it anywhere, ground it here.

If you cannot restate a question from versioned ground, that is a finding in itself — say so rather
than importing an unresolvable citation to fill the gap.

## 6.6 A third decision-log created in this phase — `dl-089`, release-health analyses

The approver supplied it on 2026-09-28 as a draft outside the repository, named
`dl-087-release-health-analyses-before-retrospective`. It is the decision-log the release-health
data of §4.9 (c) calls itself the baseline of. The approver asked for it to follow the notes flow:
a note in the v0.3 notes, then creation during this retrospective. `dl-089` itself is
self-contained: the draft's content is integrated into it, not referenced.

**Done on this branch, at `in-discussion`, not ratified:**
- `wf(decision-log): add dl-089-release-health-analyses-before-retrospective` (`1c586896`);
- `wf(decision-log): submit dl-089-release-health-analyses-before-retrospective` (`d4c8f220`).
- **renumbered from `dl-088`** (`5e6703e5`), because a parallel session pushed another `dl-088` first
  (`abd8a98f`, the external-state Memory type). This is the §2.4 collision rule applied: the
  unpushed element yields.

**It is not a finding of this retrospective.** Like §6.1, it would exist whatever the mining
concluded. Two things tie it to this phase:
- its catalogue (G01–G15, Q01–Q17) overlaps slice 6 and §4.9 (c), and serves as the checklist for
  the by-hand v0.2 measurement at `v0.2.1`;
- its ratification is on the §3.2 gate's list, with a proposed target release of v0.3.

The Dispositions table records it as *work performed*.

**What the revision changed from the draft, so the next reader need not diff them:**
- **Id.** `dl-087` was taken at `a567a987`, so the next number free across every ref is used (§2.4).
- **Citations.** Citations of the notes' table rows are replaced by versioned elements or by
  restated substance (`dl-075`, §4.8). Two wrong links are corrected: `dl-068` and `dl-020`.
- **Measurement point.** It is the tag of the version actually published (`v0.2.1`), not the
  unpublished `v0.2.0`.
- **Report directory.** It is left as an option, with `docs/06_health/` at the root recommended over
  the draft's `05_` path.
- **The `script.run` token** is declared unbound, pending the §6.1 decision-log.
- **The agent-docs action** is routed to `align-agent-docs` (`dl-025`) instead of an edit of the
  agent entry point.
- **The identity condition** is kept as a metric (G07) only. No cause and no remedy are decided.

## Handoff

| Step | Who | Gate | Completion criterion |
|---|---|---|---|
| §1 Preconditions | agent | — | P1–P10 all verified by command; P1 (`minor-v0.2` `released`) is the hard one |
| §3.1 `explore` | agent (facilitator) | — | friction inventory in the scratchpad, from the eight slices (§4.7), every item source-cited and re-resolving; external items reproduced or marked not reproduced (§4.9); no commit |
| §3.1a error inventory | notes session | — | entries anchored, attributed and cross-checked against slice 1 by the executor |
| §3.1b adversarial review | **dedicated agent** (neither author nor executor) | — | list of dropped entries with reasons, plus the survivors |
| §3.2 `additional-points` | **approver** | **GATE** | Roberto has added his points and assigned a disposition to every finding |
| §3.3 `capture` | agent (facilitator) | — | `retro-v0.2.md` exists at `in-discussion`; two commits (`add`, then `submit`) in §5.1 format |
| §3.4 `approve` | **approver** | **GATE** | `retro-v0.2` at `ready`; approve commit carries `Approver:` + `Reason:` |
| §6.6 `dl-089` | agent | — | **done**: `add` `1c586896`, `submit` `d4c8f220`, `in-discussion`; ratification at the approver's discretion |
| §6.1 / §6.2 / §6.5 scheduled items | agent | — | bindings DL at `in-discussion`; `06_features.md` corrected; `dl-087` amended with the token change and scheduled `release: "v0.3"` — each its own commit |
| close-out | agent | — | spun-off elements filed as their own commits; this plan `active → done` |

**What the approver must decide** (collect these for the §3.2 gate rather than deciding them):

1. Whether the "unverified claims in task notes" pattern is the headline lesson, a symptom, or
   already addressed by `dl-075` — and what, if anything, carries it (§4.2).
2. **How** the unscheduled population (§4.4, slice 5) is cleaned up at the start of v0.3 (§6.3 a).
   This means who proposes, the commit granularity, and whether `bug-094` goes first. Deciding
   each element's release is that clean-up's job, not this gate's.
3. Whether the verbs outside CLAUDE.md §5.1's grammar are ratified or corrected (§4.6), and which
   bracket arrow is canonical (slice 6).
4. Which of this retrospective's findings become new elements versus fold into existing ones, and
   **the target release of each** (§3.2). Also whether any need to reach v0.3 `release-planning` as
   scope rather than as a note, including the v0.3 start conditions of §6.3 b.
5. **Decided by the approver on 2026-09-28: the Determinism Index.** The index is the project's
   north star (`docs/01_vision/01_product-brief.md`), and no Memory element said where or how it is
   measured. It is measured in the benchmark repository, which is registered here as an
   external-state element once `dl-088-a-memory-type-for-state-that-lives-outside-the-repository` is
   ratified and implemented. It runs in every release-health `measure` as metric D01 (`dl-089`,
   amended at `7308e484`). The first value is expected from v0.3's release-health run. The approver
   ruled that the rule keeping benchmark material out of this repository covers its content, not its
   existence.
6. Whether an approval signed by an identity outside `team.members` needs remediation for the past,
   such as a `.mailmap`, which does not rewrite history, or only a rule for the future. The
   question stands only if slice 6 confirms that such approvals exist at the measured HEAD.

---

## 7. Known hazards

### 7.1 `wingfoil memory history` / `search` cannot read this repository's own Memory

Verified at `a2e3586` with the compiled CLI: from the repository root,
`node dist/cli.js memory history docs/self/docs/04_memory/v0.2/task-072-fix-reason-trailer-contract.md`
fails `ENOENT … /.wingfoil/memory.yaml`, because this project's config lives at
`docs/self/.wingfoil/` and there is **no `.wingfoil/` at the repository root** (CLAUDE.md §3); and run
from `docs/self/` it fails `E_NOT_AT_GIT_ROOT: run wingfoil from the project root`. So the tool that
was built in v0.2 to read approval history **cannot be pointed at v0.2's own approval history**. Mine
with `git log` (§4.2). Re-verify before relying on this — if a root `.wingfoil/` has since appeared,
prefer the CLI.

### 7.2 History gets rewritten

This repository's history has been rewritten mid-session before. Re-derive the `$ANCHOR` sha (§4)
rather than trusting the one written here, and re-run any measurement whose figure you intend to put
in the artefact, at the HEAD you are actually on.

### 7.3 The corpus is large

The v0.2 era is on the order of a thousand commits, and individual `Reason:` blocks run to several
paragraphs — the material is dense, not sparse. Budget for it: dump to files (§4.2), mine in parallel
slices (§4.7), and do not sample. A retrospective built on the first ten rejects you read will
faithfully reproduce whatever those ten happened to be about.

### 7.4 Frontmatter greps over-count

`grep -c "^status:"` counts body lines too — at least one v0.2 task file carries a second
line-initial `status:` inside its notes. Every count in §4 uses an `awk` frontmatter guard for this
reason; if you write your own, guard it the same way, or your first published number will be wrong in
a document about unverified numbers.

### 7.5 Do not enter another phase's worktree

`user-docs`, `e2e-smoke`, `release-submit` and `release-publishing` have their own plans and may be in
flight in their own worktrees. Read their plan files on `main`; do not work in their trees.

### 7.6 The failure mode specific to this phase

Writing the conclusions first and then hunting for citations. Every §4 command exists so that the
inventory is *derived*, and §5 is a list of questions rather than assertions for the same reason. If a
theme in your draft has no command behind it, it came from somewhere other than v0.2.

### 7.7 The external project must not enter this repository

The v0.3 notes, the external usage feedback and the template-divergence analysis all describe
another project. By the approver's standing rule, nothing about that project enters WingFoil2:

- not its name;
- not its configuration;
- not its commit messages;
- not paraphrases that identify it.

What enters is a WingFoil defect, reproduced on the scratch project (§4.9). Before every commit in
this phase, check the staged diff for the other project's name and for its paths. A match is a
blocker.

### 7.8 The notes are live, unversioned and dated

The v0.3 notes are not kept under version control, so they have no history to consult. The notes session edits
it concurrently, the brief folder grows with every task, and the external feedback list grows with
every use. Pin every figure you take from any of them to the date you read it. Treat a figure
dated before 2026-09-28 as a hypothesis until P7 has re-measured it.

### 7.9 Never set a git identity inside this repository's worktrees

`git config` run inside a worktree writes to the configuration shared by **all** worktrees of this
repository. So a throw-away identity set there for a reproduction leaks into every later commit,
approvals included. Slice 6 is where the size of that exposure is measured, not assumed. For this
phase:

- reproductions live in a `mktemp -d` project outside the repository (P9);
- identities are passed per command.

### 7.10 Some of the findings will be the executor's own

The session that executes this plan, and the ones that executed v0.2, are the authors of a good
share of the errors being inventoried. This is why §3.1b's reviewer is a separate agent with a
mandate to reject. It is also why an attribution to classes (1)–(3), the classes that count *for*
WingFoil, needs that reviewer's survival and not the author's conviction.

---

## Appendix A — Content integrated from sources outside the repository

This appendix exists because of §2.2's resolvability rule. It holds everything this plan relies on
from sources a reader of this repository cannot open. It is restated here, not referenced.
Everything below is dated. Nothing below is a finding: the appendix holds methods, definitions and
calibration values.

### A.1 Preliminary re-measurements (P7)

The v0.3 notes were last fully re-checked on 2026-09-25, with additions on 2026-09-28. Before any
figure or state derived from them is used, run these and date each result with the HEAD it was
measured at. The other preliminary steps already have their own precondition or rule: the
historical anchor (§4, §7.2), the scratch project (P9), the build pin (P8), reachable sessions (P10),
and re-reading this plan at its current version.

1. **States.** Re-read, from frontmatter, the status and `release` of every element the external
   material names before relying on any of them. Use the `awk` guard of §7.4.
2. **Unscheduled population.** Recount it with slice 5's command (§4.7), writing the command next
   to the number.
3. **External usage feedback.** Re-read the open list (§4.9 a), including dated addenda to items
   already seen. Record the item count and the date.
4. **Unversioned experiment documents.** Check whether new ones appeared since 2026-09-25. Four
   appeared between the 22nd and the 25th. They enter only as restated, versioned-ground questions
   (§6.1 shows the pattern).
5. **Briefs.** Re-count the hand-assembled wave briefs and date the count (§3.1a). The source
   folder grows with every task and review.

### A.2 The agent-error inventory — shape and rules (§3.1a, §3.1b)

These were agreed on 2026-09-25 between the notes session and the session that wrote this plan,
and approved by the approver. Every entry has these fields:

| Field | Content |
|---|---|
| Error | What was done wrong, and which rule or specification it broke |
| Date | A field of its own, separate from the anchor. The attribution test is played on the error's date, and the anchor is often a range |
| Anchor | A tree someone can actually check out: the good commit before the error, its subject and date, and the element involved. If none exists, the entry is an **observation**, not an experiment |
| How it surfaced | Gate · review · normal use · self-report. Free to record at writing time, and unrecoverable later |
| Indicated / not indicated | Whether the agent was pointed at the rule, for example by name and folder in its brief. Being pointed at a rule is not having it in context, but it is not nothing |
| Attribution | (1) the rule did not exist · (2) it existed but was not bound to the role the agent executed · (3) it was bound but never reached the agent's context · (4) it was in context and ignored · (5) not preventable by WingFoil |
| Capability and version | For (1), the new rule. For (2), the role binding. For (3), automatic context loading (P3.6 / P5.4.2, `agent execute`). For (4), an **enforcement point** that blocks, not one more rule. Plus the release that brings it, as *proposed*, until v0.3 release-planning has run |
| Expected replay outcome | What must happen in the replay for the error to count as avoided, and what would refute it |

Rules:

- **Class (3) is the starting condition of every v0.2 agent, not an exception.** Nothing loaded
  role directives automatically: `grep -c agentExecute src/core/index.ts` gives `0`, and
  `directives list` is read-only. An entry is (4) only where something overcame that condition.
- **Tie-break between (3) and (4).** It needs a transcript showing that the agent opened the file.
  Where that is not established, the entry is *undetermined*. A forced choice defaults to (4),
  because only (1)–(3) count *for* WingFoil.
- **An error class to look for on purpose: evidence unable to falsify.** An absence claim can rest
  on a real, cited command that cannot see the thing: `grep -n "release:"` cannot match
  `element.set_release("…")`. This class survives discipline rather than bypassing it (§2.5).
- **Evidence that lives in a throw-away project is not replayable.** Such an entry carries the
  commands to rebuild the project, or it is an observation.
- **The adversarial reviewer's criterion** is as §3.1b states it, including the `approved`
  tech-spec clause.

### A.3 Release-health data used by this plan (§4.9 c)

Supplied by the approver on 2026-09-28. It was measured on a public clone at `main` `5269223d`
(`Merge branch 'qa/e2e-smoke-v0.2'`) with Node 22.22.2, not the pinned 22.12.0. The complexity
threshold was 15 and the clone threshold 8 lines. Its catalogue and provisional values are carried,
revised, by `dl-089`, which is versioned. This plan uses two further things from it.

**Phase windows**, as slice 6's starting partition, by committer date:

| Window | From | To | Boundary evidence |
|---|---|---|---|
| A · Inception | 2026-06-14 | 2026-07-03 | before the first `wf(release): add minor-v0.1` |
| B · v0.1 development | 2026-07-04 | 2026-07-08 11:42 | `5b16ab61` `wf(release): approve minor-v0.1 [releasing → released]` |
| C · v0.1 retrospective + v0.2 set-up | 2026-07-08 11:43 | 2026-09-13 | `retro-v0.1`; `minor-v0.2` to `in-development` |
| D · v0.2, first half | 2026-09-14 | 2026-09-20 | |
| E · v0.2, second half | 2026-09-21 | 2026-09-28 | extended by this retrospective to the `v0.2.1` tag |

**Two interpretation corrections** bind slice 6:

- **Back-merges are not a regression.** Their rise from 0% to about half of all merges is
  `dl-035-task-branch-sync-with-main` taking effect.
- **ASCII arrows do not prove the tool was bypassed.** On this repository every `wf()` commit is
  hand-written (`bug-075`), so the drift is a format drift in hand-written commits.

**Calibration values** at `5269223d`, to check slice 6's commands against before trusting them. The
calibration counts approvals signed by the out-of-team identity whose `Approver:` line names the
approver:

- **131**, counting every `wf()` commit (the document's definition);
- **112**, counting only `approve` commits (this plan's definition).

