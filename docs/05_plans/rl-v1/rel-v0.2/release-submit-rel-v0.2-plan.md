---
id: "release-submit-rel-v0.2-plan"
type: plan
title: "Release-submit — v0.2 (assemble the release, enter `releasing`, stop at the approver gate)"
status: active
version: "1.1"
workflow: "release-submit"
phase: "rel-v0.2"
element: "minor-v0.2"
release: "v0.2"
tmpl_version: 260703
---

## Context

This plan executes the **`release-submit`** sub-workflow
(`docs/self/.wingfoil/workflows/custom/release-submit.yaml`, `version: 1.0`, `element: release`)
against the release element **`minor-v0.2`**
(`docs/self/docs/04_memory/planning/rl-v1/minor-v0.2.md`). In `release-cycle.yaml` (`version: 1.1`)
it is the `submit` phase — the one after `user-docs` and `e2e-smoke`, and before `publishing`.

Per CLAUDE.md §6 there is **no workflow engine**: `workflow list` is the only workflow operation in
`CORE_MODULES` and it is read-only. This document is therefore the coherent plan §6/§10.7 require
before the phase is executed, and it is itself a `plan` Memory element (`dl-019`).

`release-submit` has three phases and produces exactly one durable change to the repository: the
release element's `status` moving `in-development → releasing`. Everything else it does is
verification. **Nothing in this phase is irreversible** — that is the *next* phase
(`release-publishing-rel-v0.2-plan`), and this plan deliberately stops one step short of it.

### The session executing this plan is assumed to know nothing beyond `CLAUDE.md`

Read §6 (Conventions a fresh session will not know) **before** running any step. It carries the
commit-message contract, the citation rule, the branch rule, the authority rule, and the evidence
rule that caused every rejection in this release.

### What this phase is *not*

- It does **not** tag, push, build, or publish anything. A tag is the first act with public,
  irreversible consequences, and it belongs to `release-publishing`.
- It does **not** move `minor-v0.2` to `released`. That is `release-publishing`'s `mark-released`
  phase (`element.set_state(released)`). See §7 hazard H6 for why v0.1's history looks otherwise.
- It does **not** decide the release's scope. Scope was fixed by `release-planning`
  (`release-planning-rel-v0.2-plan.md`).

---

## 1. Preconditions — verify first, stop on any failure

Run all of these before Step 1. Each is a command, not a claim. **If any one fails, stop and report
to the approver rather than working around it.** Values below were read at `main` `a2e3586`
(2026-09-22) and are recorded as *what the command returned then*, not as facts this plan asserts —
re-run every one.

| # | Condition | Command | Read at `a2e3586` |
|---|---|---|---|
| P1 | The release element is `in-development` | `awk '/^status:/{print $2; exit}' docs/self/docs/04_memory/planning/rl-v1/minor-v0.2.md` | `in-development` |
| P2 | You are on `main`, and `main` is not ahead of its remote in a way that hides work | `git rev-parse --abbrev-ref HEAD; git fetch origin; git rev-list --count origin/main..main` | `main`; `0` |
| P3 | The working tree is clean | `git status --porcelain` | (empty) |
| P4 | `node_modules` matches the lockfile (see §6.5) | `npm ci` | exit 0 |
| P5 | The preceding `user-docs` phase is complete (`dl-013`: hard release blocker) | `ls -1 README.md CHANGELOG.md docs/user-guide.md docs/cli-reference.md docs/examples/ 2>&1` | **3 of 5 missing** — `CHANGELOG.md`, `docs/user-guide.md`, `docs/cli-reference.md`, `docs/examples/` absent |
| P6 | The preceding `e2e-smoke` phase is complete (`dl-023`) | `ls -1 docs/05_plans/rl-v1/rel-v0.2/e2e-smoke-rel-v0.2-plan.md` and read its `status:` | **absent** at `a2e3586` |
| P7 | The two **declared release blockers** are closed — see §2.3 | `for b in 076 077; do awk '/^status:/{print FILENAME": "$2; exit}' docs/self/docs/04_memory/bugs/bug-$b-*.md; done` | both `planned` on 2026-09-22 — **blocking** |
| P7 | The plan for this phase is `active` | `awk '/^status:/{print $2; exit}' docs/05_plans/rl-v1/rel-v0.2/release-submit-rel-v0.2-plan.md` | (set by this plan's own `submit` commit) |

**P5 and P6 are the two that were open when this plan was written.** `release-cycle.yaml` orders
`user-docs` and `e2e-smoke` *before* `submit`, and `user-docs.yaml`'s `align-user-docs` phase
declares `produces: [README.md, docs/user-guide.md, docs/cli-reference.md, docs/examples/,
CHANGELOG.md]`. Phase completion is **deduced** from the existence of those `produces:` artifacts
(CLAUDE.md §6), so at `a2e3586` `user-docs` deduces as *incomplete*. Both phases have their own
plans authored in parallel with this one; if P5/P6 still fail when you run them, **this phase has
not started yet** — say so and stop.

---

## 2. Step 1 — `pre-release-checks`

- **Workflow phase:** `pre-release-checks`
- **Role:** `qa` (agents may execute as `qa` — `dna.yaml` `team.agents[0].executes_as`)
- **Directives auto-loaded (`roles.yaml`):** `testing`; plus the global set `doc-versioning`,
  `documentation`, `security-secrets`, `claim-evidence` (the last added to `roles.yaml` v1.1 by
  `task-094`: every line of the evidence table names the command that produced it)
- **Actions:** none declared — this phase is `checks.pre` only
- **Produces:** no file change. Its output is the evidence table you paste into the report to the
  approver (§8)
- **Settled by:** the four commands below, all four exiting as stated

`release-submit.yaml`'s `checks.pre` is, quoted verbatim from the `pre-release-checks` phase:

```
- "all tasks where tags=[{release.version}] are status: done"
- "all bugs where tags=[{release.version}] are status: [resolved, closed]"
- "tests.passing"
- "tests.coverage(min: 80)"
```

### 2.1 How each check is settled by a command today

`{release.version}` is `v0.2`. There is no engine to evaluate `tags=[…]`, and Memory elements carry
the release association in a **`release:` frontmatter field** (`dl-016` stamps it on every element
`build-backlog` includes), so the checks are settled as follows.

**C1 — every v0.2 task is `done`.** Tasks for a release live in `docs/self/docs/04_memory/{release}/`
(`memory.yaml`'s `task.path`), i.e. `docs/self/docs/04_memory/v0.2/`:

```sh
for f in docs/self/docs/04_memory/v0.2/*.md; do
  s=$(awk '/^status:/{print $2; exit}' "$f")
  [ "$s" != "done" ] && echo "NOT DONE: $(basename "$f") -> $s"
done; echo "task files: $(ls -1 docs/self/docs/04_memory/v0.2/*.md | wc -l)"
```

The check passes iff the loop prints no `NOT DONE:` line. Note the `awk … exit` — it reads the
**first** `status:` line, which is the frontmatter one; a bare `grep '^status:'` also matches status
lines quoted inside a task's body and will mislead you.

**C2 — every bug scheduled into v0.2 is `resolved` or `closed`.** Bugs live in one flat directory
(`memory.yaml`'s `bug.path` → `docs/self/docs/04_memory/bugs/`) and are selected by their `release:`
field:

```sh
for f in docs/self/docs/04_memory/bugs/*.md; do
  r=$(awk -F'"' '/^release:/{print $2; exit}' "$f")
  s=$(awk '/^status:/{print $2; exit}' "$f")
  [ "$r" != "v0.2" ] && continue
  case "$s" in
    closed|resolved) ;;                                    # passes, silently
    deprecated) echo "RETIRED: $(basename "$f") -> deprecated — confirm deliberately" ;;
    *) echo "NOT RESOLVED: $(basename "$f") -> $s" ;;
  esac
done
```

**Three outcomes, not two, and the middle one is the point.** `resolved`/`closed` pass in silence;
anything else blocks. **`deprecated` is reported and does not block by itself** — the person running
the gate must look at it and decide.

The reason is `bug-094`. `deprecate` is the **only** legal way to retire a bug once it is past
`triaged` — the single `reject: closed` gate sits on `open` — so a bug ruled not-a-defect after triage
can reach no state this check accepts, and under the original two-way test it would have blocked the
release permanently.

The obvious repair, adding `deprecated` to the accepted list, was considered and **declined**: it
would let anyone clear this gate by deprecating the bug standing in front of it. A gate that can be
passed by retiring the obstacle is not a gate. Reporting keeps the escape hatch available and makes it
**visible**, which is the actual failure mode — the silence, not the possibility.

So: if this check prints a `RETIRED:` line, read that bug's `Reason:` and its ruling before you
proceed, and say in the release record that you did. If it prints `NOT RESOLVED:`, stop.

> Note this is the *executed* form. The declared check in
> `docs/self/.wingfoil/workflows/custom/release-submit.yaml` still reads
> `"all bugs where tags=[{release.version}] are status: [resolved, closed]"` and carries the same gap.
> Nothing evaluates that string today — there is no workflow engine — so it is `bug-094`'s to correct,
> not this plan's.

**C3 — `tests.passing`:** `npx jest` exits 0.

**C4 — `tests.coverage(min: 80)`:** `npx jest --coverage` exits 0 and reports ≥ 80 on statements,
branches, functions and lines. The 80 floor is enforced by `jest.config`'s
`coverageThreshold.global`, so a coverage regression fails the command itself rather than needing to
be read out of the table.

Run **C3 and C4 as one `npx jest --coverage`** — it is the same suite run once, and running the
suite twice is several minutes for no extra information.

### 2.3 Two bugs are declared release blockers — C1 and C2 already catch them, but know what you are looking at

On 2026-09-22 the approver declared **`bug-076`** and **`bug-077`** blockers for this release. They
are stamped `release: "v0.2"` and their fix tasks — **`task-088`** and **`task-089`** — live in the
v0.2 task directory, so the checks above catch them mechanically: C2 prints `NOT RESOLVED` for each
bug until it closes, C1 prints `NOT DONE` for each task until it is done. **You do not need a special
check.** What you need is to recognise the output rather than mistake it for stale scope, which is
why this subsection exists.

What they are, in one line each:

- **`bug-076`** — `approve`, `reject` and `deprecate` commit the element file as it stands on disk, so
  uncommitted body or frontmatter edits ride into a commit that declares only a state change, with the
  approver's identity attached. The postcondition compares against disk rather than `HEAD`, so it
  cannot see it.
- **`bug-077`** — `memory history` walks with `git log --follow`, which chases the element back to the
  template it was copied from, so the scaffold commit is reported as a history entry with a real sha,
  author and timestamp and `operation: null`. It fires for every element in every project created by
  `wingfoil init`.

**Why they were made blockers, recorded so it is not re-argued at the gate.** `minor-v0.2` exists to
deliver the Memory transition verbs and the audit trail they produce. This release found four distinct
ways to make that trail assert something that did not happen — `bug-042` and `bug-050` are closed,
these two were not. Shipping the feature alongside two live ways to misreport it would make the
release's headline claim the least trustworthy thing in it.

**Do not attempt to resolve this yourself, in either direction.** Closing the bugs, narrowing the
check, or reading them as out of scope are all the approver's calls and none is yours. If C1 or C2
still reports them when you run it, **stop and report** — that is the gate working, not a problem with
your run.

**One thing worth knowing if you are tempted to verify them by hand:** you cannot, not in this
repository. `bug-075` means the Memory verbs cannot be pointed at WingFoil's own Memory — the config
lives under `docs/self/` while the CLI resolves it from the git root — so both defects were reproduced
on a throwaway scaffolded project, and that is the only way to exercise either. Nothing in this
repository's own history is affected by `bug-076`, because every transition here was made by hand and
never through the verb.

### 2.2 The check `release-submit.yaml` does not make, and the approver must see anyway

C2 as written selects **only** bugs whose `release:` field reads `v0.2`. Bugs whose `release:` is
empty are invisible to it. Run this too, and put its output in the report:

```sh
for f in docs/self/docs/04_memory/bugs/*.md; do
  s=$(awk '/^status:/{print $2; exit}' "$f")
  [ "$s" != "closed" ] && echo "$(basename "$f"): $s release=$(awk -F'"' '/^release:/{print $2; exit}' "$f")"
done | sort
```

At `a2e3586` this printed **43 bugs** that are not `closed`; every one of them has `release:` empty
or `v0.3`, so C2 passed while 43 bugs stood open. That is not an error — `dl-016`'s `triage-bugs`
sweep assigns a `release:` and an unassigned bug is by construction not in this release — but the
release is being assembled, and the approver is entitled to see the list before authorising it. The
v0.1 phase did exactly this: `release-submit-rel-v0.1-plan.md` §2.1 records a **documented bug
waiver** for `bug-004`/`bug-006`, "satisfied-with-waiver, not silently skipped". Follow that
precedent: report, do not waive on your own authority.

Three of those open bugs bear directly on the *next* phase and must be named explicitly in the
report, because the publishing plan's steps are written around them: `bug-063` (a bare
`npm install` erases the lockfile entries the release gate needs), `bug-067` (an interrupt during a
blocking npm step is honoured late), `bug-055` (the secret scanner's own fixture trips GitHub push
protection).

---

## 3. Step 2 — `enter-releasing` (read §3.1 before touching anything)

- **Workflow phase:** `enter-releasing`
- **Role declared by the workflow:** `tech-lead`
- **Action declared by the workflow:** `element.set_state(releasing)` — release: `in-development →
  releasing`
- **Produces:** one commit changing exactly one line of
  `docs/self/docs/04_memory/planning/rl-v1/minor-v0.2.md`
- **Settled by:** `awk '/^status:/{print $2; exit}' docs/self/docs/04_memory/planning/rl-v1/minor-v0.2.md`
  → `releasing`, and `git show --stat HEAD` showing that one file and no other

### 3.1 What kind of transition this is — and why it is not `submit` and not `approve`

This is the subtlest thing in either of the two plans. Get it wrong and you produce a commit whose
subject names an operation the shipped engine refuses.

**The machine.** `memory.yaml`'s `release` type declares:

```yaml
    states:
      sequence: [ draft, planning, in-development, releasing, released ]
      waiting: [ planning, in-development, releasing ]
```

`in-development` is in **`waiting`**. `spec-001-memory-yaml-schema`'s `StateMachine` table defines
that column, quoted verbatim:

> States whose forward edge has **no CLI verb at all** — it fires only as a side effect of a
> Workflow step's `element.set_state(...)` action or an engine trigger (e.g. another element's
> `supersedes:` field). `submit`/`approve` on a `waiting` state is illegal.

**Verified against the shipped engine, not against that sentence.** `resolveTransitionTarget` and
`resolveStateMachine` in `src/memory/state-machine.ts`, read at `main` `a2e3586`, built with
`npm run build` and driven over this repository's own `memory.yaml`:

```sh
npm run build
cat > probe.cjs <<'EOF'
const yaml = require('js-yaml'), fs = require('fs');
const sm = require('./dist/memory/state-machine.js');
const doc = yaml.load(fs.readFileSync('docs/self/.wingfoil/memory.yaml', 'utf8'));
const machine = sm.resolveStateMachine(doc, 'release');
for (const op of ['submit', 'approve', 'reject', 'deprecate']) {
  try { console.log(op, '->', sm.resolveTransitionTarget(machine, 'in-development', op)); }
  catch (e) { console.log(op, '-> ILLEGAL:', e.message); }
}
EOF
node probe.cjs; rm probe.cjs
```

Output at `a2e3586`:

```
submit -> ILLEGAL: E_INVALID_TRANSITION status (): illegal `submit` from "in-development": a `waiting` state — its forward edge fires only via a Workflow action, not `submit`
approve -> ILLEGAL: E_INVALID_TRANSITION status (): illegal `approve` from "in-development": not a `gates` state — `approve` is only legal from a gate
reject -> ILLEGAL: E_INVALID_TRANSITION status (): illegal `reject` from "in-development": not a `gates` state — `reject` is only legal from a gate
deprecate -> deprecated
```

**So all four CLI verbs are unavailable for this edge.** Three are illegal from `in-development`;
the fourth (`deprecate`) is legal but goes somewhere else entirely. The probe must be run from a
directory where `js-yaml` resolves — the repository root after `npm ci`, not a scratch directory.

**What follows, plainly.**

1. **Nobody may reach `releasing` with a Memory verb.** Not the approver, not an agent, not the CLI.
   The only thing the specification lets drive this edge is the workflow action
   `element.set_state(releasing)` declared in `release-submit.yaml`'s `enter-releasing` phase — and
   there is no engine to run it (CLAUDE.md §6). This is not a gap in your knowledge; it is a gap in
   the tool, and the standing substitute is CLAUDE.md §5.1's "editing the frontmatter and writing the
   commit by hand is the **current** procedure".
2. **It is not an approval gate, so no `Approver:` line is owed.** `enter-releasing` declares no
   `approval:` key. The approval is the *next* phase (§4). Do not manufacture an approval record for
   a transition that has no approver — CLAUDE.md §5.1's `Reason:` block section explains precisely
   why a trailer-shaped line in the wrong commit forges an approval that never happened.
3. **But an agent still may not perform it on its own initiative.** The phase's role is `tech-lead`,
   and `dna.yaml` `team.agents` declares `executes_as: [ developer, reviewer, qa, architect ]` —
   `tech-lead` is not in that list. `tech-lead` is one of the roles Roberto holds
   (`dna.yaml` `team.members[0].roles`). So this step runs **only on Roberto's explicit instruction**,
   even though it is not an approval. An agent that performs it unbidden has acted outside its role
   set.

### 3.2 The commit

Edit **only** the `status:` field of
`docs/self/docs/04_memory/planning/rl-v1/minor-v0.2.md`, from `in-development` to `releasing`. Touch
no other frontmatter field and no body text.

Recommended subject (and the reasoning, because the word is not settled by any document):

```
wf(release): enter-releasing minor-v0.2 [in-development → releasing]
```

- **Why not `submit`.** v0.1 used `wf(release): submit minor-v0.1` for this exact edge
  (`715b327`). Do not copy it. `submit` is a reserved CLI verb (CLAUDE.md §5.1) that this repository
  also uses for the `release` type's genuine `submit` edge, `draft → planning` (`e88de04`), and the
  shipped engine refuses it from `in-development` (§3.1). One word naming two different edges, one of
  which the tool rejects, is the kind of drift `wingfoil memory history` will have to reconcile later.
- **Why a phase-named verb with an explicit bracket.** This repository's hand-made history already
  distinguishes verb-less edges by naming the *action* rather than a CLI verb, always with the
  `[old → new]` bracket: `wf(task): start … [backlog → in-progress]` (75 commits on `main`),
  `wf(task): finalize … [approved → done]` (74), `wf(bug): sync …` (81). `enter-releasing` is the
  phase name in `release-submit.yaml`, exactly as `start` is a `dev-loop.yaml` phase name. Counting
  command: `git log --format=%s main | grep -oP '^wf\([a-z-]+\): [a-z-]+' | sort | uniq -c | sort -rn`.
- **Why the bracket is mandatory here.** `src/memory/audit.ts`'s `BRACKET_RE` treats the bracket as
  the convention for state-carrying subjects and skips subjects without one; a verb-less edge carries
  no other machine-readable record of where it went.
- **This word is one of the things §8 asks the approver to confirm, and there is an open decision-log
  about the whole question.** `dl-079-wf-commit-verbs-outside-the-declared-grammar`
  (`in-discussion`) records that roughly a third of this repository's `wf()` commits use verbs §5.1
  does not define — `sync`, `start`, `finalize` — and weighs (A) ratifying the practised grammar,
  (B) correcting the practice back to the declared five, and (C) declaring the grammar open. The
  subject recommended here belongs to the same family, so **check `dl-079`'s state before you commit**
  (`awk '/^status:/{print $2; exit}' docs/self/docs/04_memory/design/dls/dl-079-*.md`): if it has been
  ratified as (B), express this edge the way (B) prescribes instead, and say so in the report.

Body: none beyond the co-author trailer. The commit contains **only** the release file.

```
wf(release): enter-releasing minor-v0.2 [in-development → releasing]

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## 4. Step 3 — `approve-release` (approver only; this plan stops here)

- **Workflow phase:** `approve-release`
- **Role:** `approver`; `approval: { by_role: approver }`; `fallback: { step: pre-release-checks }`
- **Action:** none. **`approve-release` changes no state.**
- **Produces:** the approver's explicit authorisation to begin `release-publishing`
- **Settled by:** Roberto saying so, in this conversation, in his own words

**An agent never executes this step.** CLAUDE.md §4/§8: agents hold no approval authority and never
self-approve; `dna.yaml` `team.agents[0].approval_authority: false`.

**It is a gate, not a transition.** The release stays at `releasing` throughout. The edge
`releasing → released` belongs to `release-publishing`'s `mark-released` phase, whose declared
action is `element.set_state(released)` — and, like §3, it is a `waiting` edge. Do not write a
`wf(release): approve minor-v0.2 [releasing → released]` commit here; see hazard H6 for why v0.1's
history contains one.

**On rejection:** `fallback: { step: pre-release-checks }` — the phase restarts at Step 1. If the
approver rejects, the release element stays at `releasing` (there is no reject edge out of a
`waiting` state either — §3.1's probe shows `reject` is illegal from every release state), so the
rework happens against a release that is already in `releasing`. Record what the approver asked for
and re-run §2.

---

## 5. The six gates

These are the standing quality gates this repository runs at `dev-loop`'s `refactor` step, referred
to throughout v0.2's task Execution Notes as "the six gates" (e.g. `task-087`'s `refactor` gate
table). `release-submit`'s own `checks.pre` names only the first two, but the release is being
assembled from a tree, and a tree that fails any of the six is not a tree to tag. Run all six; paste
the table into the report.

| # | Gate | Command | Passes when |
|---|---|---|---|
| G1 | Unit + integration suite | `npx jest` | exit 0 |
| G2 | Coverage ≥ 80 | `npx jest --coverage` | exit 0; statements/branches/functions/lines all ≥ 80 (`jest.config`'s `coverageThreshold.global`) |
| G3 | Build typecheck | `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| G4 | Full typecheck, test sources included (`dl-044`) | `npx tsc --noEmit -p tsconfig.json` | exit 0, **no output at all** |
| G5 | Lint (`dl-034`, hard-reject, no ramp) | `npm run lint` | exit 0 |
| G6 | API docs (`dl-013` / `task-062` closed the ramp) | `npm run docs:api` | exit 0 |

G3 and G4 are two different typechecks and both are required — `dl-044` exists because the build
config excludes test sources, which is how a type error survived on `main` until `bug-026`
(`closed`). G1 and G2 are one run, as §2.1 notes.

---

## 6. Conventions a fresh session will not know

### 6.1 Memory commit format (CLAUDE.md §5.1)

One operation, one commit, one element type, nothing else in the commit. Subject:

```
wf({type}): {add|submit|approve|reject|deprecate} {id1}, {id2}, ...
```

`approve`, `reject` and `deprecate` carry a body; `add` and `submit` do not. The `Approver:` line is
`Name <email> (role)`. The `Reason:` block runs to the end of the body (or to the trailing trailer
paragraph), may span lines and paragraphs, may **never** be blank, may never contain a line
beginning `Approver:` or `Reason:`, and may not end with a paragraph made entirely of `Key: value`
lines. Read §5.1 in full before writing any approve/reject/deprecate commit; this release shipped a
fix (`task-086`) for a defect in exactly this area.

For a `waiting` edge — which is what this phase's one state change is — see §3.2.

### 6.2 Durable citations (`dl-075`, ratified as (A) composed with (B))

A citation in a Memory document names something the file **carries** — an exported symbol, a
heading, a YAML key path, or a verbatim quotation — and pins the commit it was read at when the
claim is about something that may legitimately move. **Bare `path:line` offsets are not acceptable**
in durable prose; they remain legal in Execution Notes, bug Steps-to-Reproduce and triage notes,
where a stale offset is a truthful record of what somebody read. Disposition of existing citations
is **fix-on-touch**: a document you open for another reason gets its citations converted in that
same change. This plan follows the rule; keep it when you amend the plan.

### 6.3 Merge, never rebase (`dl-035`, `dl-014` G3, `dl-024`)

Never rebase a branch carrying `wf(*)` commits — rebasing destroys the audit records P1.2/P1.7/P1.10
depend on. To bring `main` into a working branch: `git merge --no-edit main` from inside the
worktree. Branches merge into `main` with `--no-ff` / `--ff=false`. Phase work runs on its own branch
named `design/<phase>_<version>` (`dl-024` decision 1) — for this phase, `design/release_submit_v0.2`.

### 6.4 Agents hold no approval authority

CLAUDE.md §4/§8 and `dna.yaml` `team.agents[0].approval_authority: false`. Every `memory.approve` and
`memory.reject` runs **only on Roberto's explicit instruction**. In this phase that covers Step 3
outright, and Step 2 as well for the separate reason given in §3.1 (its role is `tech-lead`, outside
the agent role set). When in doubt: present the evidence and ask.

### 6.5 `npm ci` after any dependency change — and never a bare `npm install`

After merging anything that touches `package.json` or `package-lock.json`, run **`npm ci`** before
running the gates. A stale `node_modules` fails `test/cli/types-node-floor.test.ts`, which asserts
that the **installed** `@types/node` major equals the major of `engines.node`'s floor — it reads the
tree, not the manifest, so it is exactly the test a stale tree breaks.

**Never run a bare `npm install`.** `bug-063` (`open`, medium) measured that under npm 11.x a plain
install silently deletes the hoisted `@emnapi` lockfile entries that make `npm ci` work under the npm
CI uses, reporting `up to date` while doing it. `npm ci` never rewrites a lockfile, which is why it
is the safe command. The full consequence — and the verification owed before a tag — is in the
`release-publishing` plan, §2's precondition block.

### 6.6 The evidence rule (the top rejection cause in this release)

**Never assert a file's state without running the command that settles it, and put the command in
the note.** Claims asserting that a file is done, undone, covered or unchanged without opening it
were the single largest source of review rejections in v0.2 (`task-034`, `task-054` twice,
`task-064`). Every table in this plan carries its command for that reason. When you report to the
approver, report commands and their output — not conclusions.

---

## 7. Known hazards

- **H1 — `user-docs` is incomplete (P5).** At `a2e3586`, four of `user-docs.yaml`'s five declared
  `produces:` artifacts do not exist. `dl-013` makes user-facing documentation a **hard release
  blocker**. If P5 still fails, `submit` has not started.
- **H2 — `e2e-smoke` has no plan (P6).** `dl-023`'s gate is *staged*: `e2e-smoke.yaml`'s `gate` phase
  says "warn until green for a release, then hard-reject". Whether v0.2 is the release that flips it
  is the approver's call, not this plan's.
- **H3 — 43 open bugs sit outside C2's selector.** §2.2. Report, do not waive.
- **H4 — the frontmatter grep trap.** `grep '^status:'` over a Memory file matches status lines
  quoted in the body. Use `awk '/^status:/{print $2; exit}'`.
- **H5 — `package.json` `version` is still `0.1.0`.** Read at `a2e3586`:
  `node -p "require('./package.json').version"` → `0.1.0`. This is not a `release-submit` check, and
  **do not fix it in this phase** — it is a step in the `release-publishing` plan, where it is
  sequenced against the lockfile hazard. Flag it in the report so the approver knows it is coming.
- **H6 — v0.1's history conflates Steps 2 and 3, and the next phase.** `git log --oneline --all
  --grep='^wf(release)'` shows `715b327 wf(release): submit minor-v0.1` (this phase's Step 2, under a
  verb the engine refuses) and `5b16ab6 wf(release): approve minor-v0.1 [releasing → released]` (an
  `approve` subject carrying `release-publishing`'s `mark-released` edge). v0.1 was a paper release —
  `dl-018` records that `release-publishing` was skipped entirely — so the two phases collapsed into
  one commit and nobody noticed. v0.2 is the first release where they do not collapse. Do not treat
  v0.1's subjects as the convention.
- **H7 — `main` moves under you.** This repository's `main` advances while phases run. Re-run P2 and
  the §5 gates immediately before Step 2; a green suite from an hour ago describes a tree that may no
  longer exist.

---

## 8. Handoff

**The agent does:** §1 (all preconditions), §2 (C1–C4 plus the §2.2 sweep), §5 (all six gates), and
then **stops** and reports.

**The approver (Roberto) does, personally:**

1. **Reads the evidence and decides on the open bugs** — §2.2's list, under the v0.1 waiver
   precedent. A waiver is his to grant and must be recorded, not assumed.
2. **Decides P5/P6** — whether `user-docs` and `e2e-smoke` are complete enough for `submit` to start
   at all (`dl-013` says user-docs is a hard blocker).
3. **Confirms the Step 2 commit subject** — `enter-releasing` is this plan's proposal for a verb-less
   edge no document names (§3.2), and it will be the precedent every later release copies.
4. **Instructs Step 2 explicitly.** The step's role is `tech-lead`, outside the agent role set
   (§3.1). No agent performs it unbidden.
5. **Performs Step 3 — `approve-release`.** The gate itself. Nothing downstream may begin without it.

**Completion criteria for this phase:** C1–C4 green and reported; the six gates green and reported;
`minor-v0.2` at `status: releasing` in exactly one commit; the approver's explicit authorisation to
proceed. The next document is
`docs/05_plans/rl-v1/rel-v0.2/release-publishing-rel-v0.2-plan.md` — **read its §1 before doing
anything at all**, because the first thing it asks for is a secret sweep, and the phase after this
one is the one that cannot be undone.
