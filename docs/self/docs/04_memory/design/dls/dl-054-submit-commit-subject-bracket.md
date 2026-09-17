---
id: "dl-054-submit-commit-subject-bracket"
type: decision-log
title: "Does a `submit` commit subject carry the `[from → to]` bracket? The written form says no; most of this repository's history says yes"
status: in-discussion
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

**What is written down has no bracket on `submit` — and almost nothing pins the subject at all:**

- The only specification of the subject format is generic: `spec-004-mcp-surface-contract` §4.3 item 2
  (`:190`), "exactly one git commit in the `wf({type}): {verb} {id}` format … identical commit shape to
  the CLI path". No SARD requirement, BDD scenario or other spec states it
  (`grep -rn 'wf(' docs/02_requirements docs/01_vision docs/self/docs/04_memory/design/specs` → only
  that line and a mention of the `reject` commit body in `spec-001:257`).
- `src/memory/audit.ts` on `main` (`8a6a091`): `OPERATION_RE` (`:176`) accepts any `wf(...)` verb
  subject; `BRACKET_RE` (`:282`) and its TSDoc (`:278-290`) treat the `[old → new]` bracket as the
  operating convention for `approve`/`reject`/`deprecate` only — "a plain `add`/`submit` subject has no
  bracket and is skipped" by the consistency check. Both forms parse.
- `task-045-memory-submit` implements that reading: on `task/task-045-memory-submit` (`7bfa835`),
  `src/core/index.ts:674-677` — subject "`wf(<type>): submit <id>` with no bracket and no body
  (spec-004 §4.3)".

**The history does something else, for one kind of submit.** Counted on `main`
(`git log --format=%s main | grep -E '^wf\([a-z-]+\): submit'`): **68** submit subjects carry a bracket
and **64** do not. The split is not random:

- bracketed: `task` ×63, every one `[in-progress → in-review]` (e.g. `5aeabcb`, `896a91c`:
  `wf(task): submit task-054-project-directives [in-progress → in-review]`); `bug` ×5, four
  `[in-progress → in-review]` (e.g. `wf(bug): submit bug-003 [in-progress → in-review]`) and one
  `[draft → open]` (`bug-005`).
- unbracketed: every `adr` (2), `decision-log` (18), `plan` (3), `release` (2), `release-line` (1) and
  `tech-spec` (4) submit, plus 17 `task` and 17 `bug` submits — essentially every **content** submit
  (`draft → pending` / `draft → open`).

So hand-made history already distinguishes the two meanings of `submit` that
`docs/self/.wingfoil/workflows/custom/dev-loop.yaml` uses: the capture submit (`:51`,
`draft -> pending`, which fills content and moves to the post-submit state) and the review hand-off
(`:89`, `task: in-progress -> in-review`, a pure state move with no content step). When
`wingfoil memory submit` replaces the hand-made commits, every review hand-off loses the bracket its
63 predecessors carried.

## Decision

*Approver to choose.*

1. **Bracket on every `submit`** (recommended): `wf({type}): submit {ids} [{from} → {to}]`, for both
   meanings. Uniform with `approve`/`reject`/`deprecate`; lets `verifyTransitionConsistency` cross-check
   every state-changing commit instead of skipping `submit`. Costs a small change to `task-045` and an
   update to the agent-facing operating conventions.
2. **No bracket on `submit`, ever** — the current written form. `task-045` already conforms; the 68
   bracketed commits stay as legacy, and `memory history` derives from/to from frontmatter anyway.
3. **Bracket only on the non-initial (review hand-off) submit** — codifies the history's split exactly,
   but makes the subject depend on which state the document was in.

## Rationale

- `memory history` (P1.10) reconstructs `from`/`to` from each commit's frontmatter, so the bracket is
  never the only record — but it is the part of the audit trail a human reading `git log --oneline`
  sees, and `audit.ts`'s consistency check works only where it exists.
- A tool-emitted form that differs from 63 hand-made commits for the same operation would make history
  inconsistent at exactly the moment the tool takes over; deciding now is cheaper than a mixed log.
- Option 1 removes a special case; option 2 is cheapest if the bracket is judged redundant with
  frontmatter-derived history.

## Actions

- Owner **approver**: choose before `task-045` is `done` (it emits the subject).
- Either way: give the commit-subject format a specification home — today only `spec-004` §4.3 pins it,
  generically — e.g. a subsection there or in `spec-010`, with a dated Revision note (`dl-047`).
- If 1 or 3: update `task-045`'s subject builder, `audit.ts`'s TSDoc, and extend the consistency check to
  `submit`; update the agent-facing operating conventions to match.
- If 2: update the agent-facing operating conventions so hand-made review hand-offs stop adding the
  bracket.

Related: `task-045-memory-submit`, `spec-004` §4.3, `src/memory/audit.ts`, `dev-loop.yaml`, P1.6,
P1.10, `dl-053`.
