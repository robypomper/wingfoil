---
id: "retrospective-rel-v0.2-plan"
type: plan
title: "Retrospective — rel-v0.2"
status: active
version: "1.0"
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
(§4.2 has the commands; re-measure) — each carrying a `Reason:` block that records what was verified,
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

---

## 1. Preconditions the session verifies first

Verify each as a **condition**, by running the command, before doing anything else. Do not take this
list's own wording as evidence that a condition holds — the repository moves, and §2.5 is the rule
that governs exactly this.

| # | Condition | Command that settles it | Expected |
|---|---|---|---|
| P1 | `release-publishing` has completed — `minor-v0.2` is `released` | `awk '/^---$/{n++} n==1 && /^status:/' docs/self/docs/04_memory/planning/rl-v1/minor-v0.2.md` | `status: released` |
| P2 | The `v0.2` tag exists on `main` (`dl-074-tag-must-be-on-pushed-main`) | `git tag --list 'v0.2*'` and `git branch --contains v0.2 --list main` | tag present, contained in `main` |
| P3 | No v0.2 task is left un-`done` | `awk 'FNR==1{n=0} /^---$/{n++} n==1 && /^status:/{print $2}' docs/self/docs/04_memory/v0.2/*.md \| sort \| uniq -c` | one line: `done` |
| P4 | No bug scheduled into v0.2 is still open | see §4.1 command B — filter `release: "v0.2"` | all `closed` |
| P5 | The suite is green on `main` and the tree is clean | `npm ci && npm test` ; `git status --short` | 0 failures; empty status |
| P6 | You are on `main`, up to date | `git rev-parse --abbrev-ref HEAD` ; `git log --oneline -1` | `main` |

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

### 2.3 Agents hold no approval authority

CLAUDE.md §4/§8: AI agents execute as `developer`/`reviewer`/`qa`/`architect` and **never** approve.
Two of this phase's four steps are the **approver's** (§3.2 `additional-points`, §3.4 `approve`) —
run them only on Roberto's explicit instruction, and never self-approve the artefact you wrote.

### 2.4 Git: merge `main`, never rebase (`dl-035-task-branch-sync-with-main`, `ready`)

A phase branch that has fallen behind `main` is brought current with `git merge main`. Rebasing a
branch whose commits are Memory state transitions rewrites the audit trail the whole model rests on.
Per `dl-024` the phase runs on its own branch (`design/<phase>_<version>` shape) and merges to `main`
with `--no-ff`. After any merge that moves `package-lock.json`, re-run `npm ci` (§1 P5).

### 2.5 The evidence rule: never assert a file's state without running the command that settles it

This is the repository's own hardest-won convention and the one a fresh session breaks first. Do not
write "all v0.2 bugs are closed", "the notes say X", or "that citation still resolves" unless you
just ran the command that shows it — and **put the command in the text**, so the next reader can
re-run it rather than trust you. Where the claim is about state that may move, pin the commit.

---

## 3. Steps — mapped to `retrospective.yaml`

Four steps, in the order the workflow declares them. Two are the approver's.

### 3.1 `explore` — role: **facilitator** (agent)

- **Action (`retrospective.yaml`):** `agent.mine_execution_notes`.
- **Produces:** *"retrospective friction inventory (source-cited, grouped by theme)"* — a working
  artefact, **not** a Memory element. Write it to the scratchpad (v0.1's lived at
  `scratchpad/friction-inventory-v0.1.md`, cited from `retro-v0.1.md` §Context). It is read-only work:
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

### 3.2 `additional-points` — role: **approver** — GATE

- **`retrospective.yaml`:** `approval: { by_role: approver }`. The phase description is explicit that
  this is *"a review checkpoint, not an approval-gated transition — no commit."*
- **What the agent does:** present the friction inventory **and** the candidate themes to Roberto,
  and ask him to add points to analyze. Present themes as *candidates with their evidence*, not as
  conclusions — the whole value of this gate is that he can widen scope or reject a framing.
- **What comes back:** additional points, and for each finding a **disposition** — already owned by
  an existing element / spin off a new `decision-log` / file a `bug` / defer. v0.1 recorded these in
  a "Dispositions (decided at the A2 gate)" table (`retro-v0.1.md`); reuse that shape.
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

Five read-only miners, mirroring v0.1's shape, each writing a flat list of source-cited items to its
own scratchpad file; then one synthesis pass:

1. **Rejects** — every `wf(task): reject` body (§4.2). Classify each by what it was rejected on.
2. **Approves** — every `wf(*): approve` body (§4.2). Extract what was verified and *how*.
3. **Corrections** — every `docs(self)` amendment (§4.3), with its diff.
4. **Execution Notes** — all 50+ v0.2 task notes (§4.5): deferrals, AC classification, tooling friction.
5. **Unscheduled + governance** — §4.4 plus the v0.2 bugs and ratified decision-logs.

Synthesis groups raw items into themes and drops anything whose citation does not re-resolve. Give
each miner §2.2 and §2.5 verbatim, or the inventory will come back full of bare offsets and
unverified assertions — which would be a notably poor way to write *this* retrospective.

---

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
  - **Dispositions** — the table from the §3.2 gate: finding → disposition → vehicle (existing
    element / new DL / new bug / deferred). Every finding gets one; "deferred" is a disposition and
    must be written as one, with the reason.
- **`## Rationale`** — why the dispositions are what they are, and what was deliberately left out of
  scope. v0.1 used this section to bound the work; do the same.
- **`## Actions`** — checkbox list with owners. Include the audit of v0.1's own actions (Q8) and
  anything this retrospective wants carried into v0.3's `release-planning`.

**Every claim in the body carries its source** (§2.2, §2.5). If a theme cannot be cited, it is not a
theme, it is an impression — put it to the approver at §3.2 as a question instead.

---

## Handoff

| Step | Who | Gate | Completion criterion |
|---|---|---|---|
| §1 Preconditions | agent | — | P1–P6 all verified by command; P1 (`minor-v0.2` `released`) is the hard one |
| §3.1 `explore` | agent (facilitator) | — | friction inventory in the scratchpad, every item source-cited and re-resolving; no commit |
| §3.2 `additional-points` | **approver** | **GATE** | Roberto has added his points and assigned a disposition to every finding |
| §3.3 `capture` | agent (facilitator) | — | `retro-v0.2.md` exists at `in-discussion`; two commits (`add`, then `submit`) in §5.1 format |
| §3.4 `approve` | **approver** | **GATE** | `retro-v0.2` at `ready`; approve commit carries `Approver:` + `Reason:` |
| close-out | agent | — | spun-off elements filed as their own commits; this plan `active → done` |

**What the approver must decide** (collect these for the §3.2 gate rather than deciding them):

1. Whether the "unverified claims in task notes" pattern is the headline lesson, a symptom, or
   already addressed by `dl-075` — and what, if anything, carries it (§4.2).
2. The disposition of every unscheduled bug and `in-discussion` decision-log (§4.4): into v0.3, left
   unscheduled, or deprecated.
3. Whether the verbs outside CLAUDE.md §5.1's grammar are ratified or corrected (§4.6).
4. Which of this retrospective's findings become new elements versus fold into existing ones — and
   whether any need to reach v0.3 `release-planning` as scope rather than as a note.

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
