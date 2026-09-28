---
id: "dl-110-parking-a-started-task"
type: decision-log
title: "No verb steps a started task back to the backlog, so a stalled task holds its work-in-progress slot until someone retires or hand-edits it; and no state declares a WIP limit at all"
status: in-discussion
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

The v0.2 retrospective (`retro-v0.2`) files this decision-log, target v0.3. Its disposition reads
"no park/hold step for a started task (WIP slot stuck)". The finding came from using WingFoil
outside this repository and was reproduced on `wingfoil@0.2.1`.

**The machines only walk forward.** This repository's `task` machine
(`docs/self/.wingfoil/memory.yaml`, `types.task.states`) is `draft → pending → backlog → in-progress
→ in-review → approved → done`. It has two gates: `pending` rejects to `draft`, and `in-review`
rejects to `in-progress`. `backlog` and `approved` are `waiting` states. `in-progress` has one verb
edge out, forward to `in-review` by `submit`. The only other exit is `deprecate`, which retires the
task instead of returning it. `spec-001-memory-yaml-schema` gives a machine `sequence`, `gates` and
`waiting`. None of the three can declare a backward edge that is not a rejection.

**Reproduction on `wingfoil@0.2.1`.** This uses a throw-away project with the same task machine.
The identity comes from the environment only. The `GIT_CONFIG_*` variables are there because the
authority check reads `git config` (`bug-149`).

```sh
T=$(mktemp -d) && npm install --silent --prefix "$T" wingfoil@0.2.1 && W="$T/node_modules/.bin/wingfoil"
export GIT_AUTHOR_NAME=Scratch GIT_AUTHOR_EMAIL=scratch@example.invalid \
  GIT_COMMITTER_NAME=Scratch GIT_COMMITTER_EMAIL=scratch@example.invalid \
  GIT_CONFIG_COUNT=2 GIT_CONFIG_KEY_0=user.name GIT_CONFIG_VALUE_0=Scratch \
  GIT_CONFIG_KEY_1=user.email GIT_CONFIG_VALUE_1=scratch@example.invalid
cd "$(mktemp -d)" && git init -q -b main && git commit -q --allow-empty -m init
"$W" init --template Kanban
"$W" dna add team.members --value Scratch --entry-email scratch@example.invalid --entry-roles approver
node -e '
const fs=require("fs"),f=".wingfoil/memory.yaml";let t=fs.readFileSync(f,"utf8");
t=t.replace(/(  task:\n(?:    .*\n)*?)(  tech-spec:)/,(m,a,b)=>a+"    states:\n      sequence: [ draft, pending, backlog, in-progress, in-review, approved, done ]\n      gates:\n        pending: { reject: draft }\n        in-review: { reject: in-progress }\n"+b);
fs.writeFileSync(f,t)'
git commit -qam "task machine with backlog and in-progress"
"$W" memory add --type task --title "Park me"
"$W" memory submit task-001-park-me
"$W" memory approve task-001-park-me --reason "planned"
"$W" memory submit task-001-park-me
grep '^status:' docs/memory/task/task-001-park-me.md
"$W" memory reject task-001-park-me --reason "park it"; echo "exit $?"
"$W" memory submit task-001-park-me
grep '^status:' docs/memory/task/task-001-park-me.md
```

Observed results:
- The task reaches `status: in-progress`.
- `reject` is refused with `error: illegal transition in-progress -> draft for type 'task'`,
  exit 1. The target it names is the `bug-127` class.
- The next `submit` moves the task forward to `status: in-review`.

No verb returns the task to `backlog`.

**This repository never parked a task, because it could not.** `git log a20b346c --format=%s | grep
-E "(in-progress|in-review) (→|->) (backlog|pending|draft)"` finds nothing. The same grep for
`pending (→|->) backlog` finds 24 subjects, so the pattern works.

**The WIP limit the Kanban template promises is declared nowhere.** The `KANBAN` template definition
in `src/storage/templates.ts` describes "Continuous-flow delivery with work-in-progress limits", and
its cadence sentence, "under explicit WIP limits", is written into every Kanban project's delivery
workflow. `grep -rniE "\bwip\b|work.in.progress" docs/self/.wingfoil/ src/` finds only those two
template strings. No schema has a field for a limit.

## Decision

A started task can be returned to the backlog by a recorded, reasoned operation, and a state can
declare a WIP limit. The open points follow, each with a recommendation.

**P1 — The mechanism.**
- **(a) A declared return edge and a verb for it.** A new machine key such as `returns: {
  in-progress: backlog }` sits next to `gates` and `waiting`. It is taken by a new verb, `memory park
  <id> --reason`, which writes `wf(<type>): park <id> [in-progress → backlog]` with a `Reason:` block
  (`dl-067`).
- **(b) A side state** `on-hold`, entered from and returning to `in-progress`, which keeps the task
  visibly started but not counted.
- **(c) A reject edge on `in-progress`.** This would make `in-progress` a gate, so moving forward
  would then need `approve`, which is wrong.

*Recommendation: (a).* It keeps the machine's meaning intact: a parked task is back in the backlog
and can be picked up again. It is also generic, so any type can declare a return edge.

**P2 — What parking does to the surrounding work.** Under `dev-loop`:
- the branch `task/{task.id}` is kept, and its worktree is removed (`dl-014` G1 and G2);
- the park reason goes into the task's Execution Notes as well as the commit;
- `bug.sync_state` returns each linked bug from `in-progress` to `planned` (`dl-045`).

*Recommendation:* adopt as stated, as an amendment to `dev-loop.yaml`.

**P3 — WIP limits.**
- **(a)** An optional per-state limit in `memory.yaml`, e.g. `limits: { in-progress: 3 }`, enforced
  by the verb that enters the state. The verb refuses with exit 1 and names the elements holding the
  slots.
- **(b)** A concurrency limit on the workflow's `iterate_over` in `release-cycle.yaml`, enforced by
  the engine only.
- **(c)** Advisory only, reported by `workflow status`.

*Recommendation: (a).* It holds whether the engine or a person drives the transition. It is the
same mechanism `dl-100` needs for its WIP limit on `in-discussion` decision-logs.

## Rationale

- **A WIP limit without a way out is a trap.** Once a limit exists, as P3 proposes and the Kanban
  template already promises, a stalled task blocks new work. The only ways to free the slot today
  are `deprecate`, which is a governance decision about the task's existence rather than its
  schedule, or a hand edit that the audit trail does not record as an operation.
- **Returning is not rejecting.** A reject says the work was wrong. A park says the work is not
  being done now. Recording them differently keeps `memory history` truthful about why a task left
  `in-progress`.

## Actions

On ratification, with P1–P3 chosen in the approve commit's `Reason:`:
1. Amend `spec-001-memory-yaml-schema` (`returns`, `limits`) and `spec-008-cli-grammar` (the
   verb), and `docs/self/.wingfoil/memory.yaml`'s `task` machine.
2. Amend `dev-loop.yaml` for P2.
3. Make the Kanban template's WIP sentence true, or reword it (the `KANBAN` definition in
   `src/storage/templates.ts`).

v0.3 `release-planning` (`build-backlog`) derives the tasks. None are created here.

## Relations

- **Filed by:** `retro-v0.2` (external-use finding "no park/hold step for a started task",
  reproduced on `wingfoil@0.2.1`).
- **Related:** `dl-100` (WIP limit on open decision-logs), `dl-079` (verbs outside the grammar),
  `dl-067` (the `Reason:` block), `dl-014` (task branches and worktrees), `dl-045` (`bug.sync_state`
  over a list), `bug-127` (illegal-transition wording), `bug-149` (authority identity), `dl-108`
  (another state-preserving verb).
- **Traceability:** P1.13, P4.13; REQ-STATE-01, REQ-SEC-02.
