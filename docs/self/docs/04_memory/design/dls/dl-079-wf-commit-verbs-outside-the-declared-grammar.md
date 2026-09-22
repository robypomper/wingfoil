---
id: "dl-079-wf-commit-verbs-outside-the-declared-grammar"
type: decision-log
title: "A third of this repository's `wf()` commits use verbs the §5.1 grammar does not define — `sync`, `start` and `finalize` above all — and `wingfoil memory history` is specified to read that subject line back"
status: in-discussion
context: "governance"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

The commit grammar names **five** Memory operations — `add`, `submit`, `approve`, `reject`,
`deprecate` — and requires a "present-tense verb, matching the operation name exactly". It is not
decoration: **P1.10** specifies that `wingfoil memory history` reads these commits back, so the
subject line is a parsed interface, not a convention.

Measured over the whole history, **769 `wf(...)` commits**, the verbs actually in use are:

| verb | commits | in the declared five? |
|---|---|---|
| `submit` | 205 | yes |
| `approve` | 182 | yes |
| `add` | 88 | yes |
| **`sync`** | **81** | **no** |
| **`start`** | **75** | **no** |
| **`finalize`** | **74** | **no** |
| `reject` | 26 | yes |
| `start-fix`, `schedule`, `assign`, `plan`, `deferred` | 10 | no |
| *(no verb at all — `wf(task): {id} [from → to]`)* | ~26 | no |

So roughly **a third of all `wf()` commits use a subject the grammar does not define**, and the
history contains at least two distinct shapes: the early verbless form, and the current extended set.

## Evidence

- The three large offenders are not improvised. `start` and `finalize` come from the `dev-loop` phase
  plan, which assigns them to the phases that open and close a task; `sync` implements
  `bug.sync_state`, which `dl-045-absorbed-bug-back-reference` ratified as the mechanism keeping an
  absorbed bug in step with its host task. Each has a documented origin — just not in the grammar
  that says which verbs exist.
- The verbless form is confined to early v0.1 commits (`wf(task): task-001-… [backlog → in-progress]`)
  and stopped being produced long ago, so it is a legacy shape rather than a live divergence.
- `deprecate` appears **once** in 769 commits, and `plan` once. The declared grammar and the practised
  one diverge in both directions: verbs that exist and are unused, verbs that are used and undeclared.
- The bracket convention has its own settled rule — `dl-054` confines `[from → to]` to the
  approver-gated verbs — and the undeclared verbs follow it consistently (`sync` and `start` carry the
  bracket, `submit` does not). The practice is internally coherent; it is only the *declaration* that
  is short.

## Decision

Open. Three positions.

### (A) Ratify the practised grammar

Extend §5.1 to declare `start`, `finalize` and `sync`, each with its bracket rule and the phase or
mechanism that emits it, and state whether the list is closed.
*Cost:* it enlarges the interface `memory history` must parse and that the shipped verbs must one day
emit. Today `start`/`finalize`/`sync` are written by hand by whoever runs a dev-loop; ratifying them
makes them something the tool eventually owes.
*What it buys:* 230 existing commits stop being out of contract, and the next reader of the history
can parse what is actually there.

### (B) Correct the practice to the declared five

Stop emitting the undeclared verbs; express the same transitions with `submit`/`approve` and carry the
phase information in the body.
*Cost:* it makes `start` and `finalize` indistinguishable from any other `submit` in the subject line,
which is precisely the information the dev-loop plan added them to preserve. It also leaves 230
historical commits unparseable under the corrected grammar unless a rewrite is contemplated, and
rewriting them is forbidden — `dl-035` bars rewriting merged `wf` commits carrying approver identity.

### (C) Declare the grammar open and the five a minimum

Say that `wf({type}): {verb}` admits any verb a workflow defines, with the five as the operations the
CLI itself emits, and require each additional verb to be declared where its workflow is.
*Cost:* `memory history` then cannot enumerate valid verbs, only recognise the shape; whether P1.10
needs that enumeration is the question this position hinges on, and nobody has established it.

## Rationale

- **The divergence is a fact about the record, not about anyone's discipline.** Every one of those
  commits was written by an agent following a plan or a ratified decision-log; the grammar simply
  never caught up with the workflows built after it.
- **What makes it worth deciding rather than tidying** is P1.10. If `memory history` is specified to
  read these subjects, an undeclared verb is an unspecified input to a shipped feature — and this
  release has just spent two rejections on exactly that class of thing: a guarantee stated in one
  place that the code does not hold.
- The legacy verbless commits are not a third option to preserve. They predate the grammar and
  nothing produces them any more; whatever is decided, they are history to be read, not a form to
  restore.
- Note the asymmetry worth resolving in the same breath: `deprecate` is declared and used once,
  `finalize` is undeclared and used 74 times. A grammar that admits what is rare and omits what is
  routine is describing something other than the practice.

## Actions

1. **Choose a position.** Owner: approver; recorded in this document's approve commit `Reason:`.
2. **Before choosing, establish what `memory history` actually does with an unrecognised verb** —
   whether it parses, ignores, or mis-attributes the commit. That is one experiment and it decides how
   much of this is theoretical. Note `bug-075` records that the verbs cannot be pointed at this
   repository's own Memory, so the experiment needs a scratch project.
3. If (A) or (C), the amendment lands in `CLAUDE.md` §5.1 — which `dl-025` records as owned by no
   workflow gate, so say who carries it.
4. Do not rewrite history under any position (`dl-035`).

## Relations

- **Concerns:** the §5.1 commit grammar and **P1.10** (`memory history` reading these subjects back).
- **Origin of the undeclared verbs:** the `dev-loop` phase plan (`start`, `finalize`) and
  `dl-045-absorbed-bug-back-reference` (`sync`, via `bug.sync_state`).
- **Adjacent:** `dl-054` (which verbs carry the `[from → to]` bracket — already settled and followed
  by the undeclared verbs); `dl-025-claude-md-ownership` (`in-discussion`), because §5.1 lives in a
  file no gate owns; `bug-074`, the same file stale about the verbs themselves.
- **Constrained by:** `dl-035` — merged `wf` commits carrying approver identity are never rewritten,
  so no position may propose repairing the record retroactively.
