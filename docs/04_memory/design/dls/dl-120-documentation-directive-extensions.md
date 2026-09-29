---
id: "dl-120-documentation-directive-extensions"
type: decision-log
title: "Five documentation rules live only in decision-logs, bugs and one plan: citation form, version-bump scope, transient facts, resolvable references, and premises that carry their measurement conditions"
status: ready
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`). Its dispositions include three findings with one
remedy:

- documentation rules argued in decision-logs never reached a directive;
- statements that were true when written decayed with nothing to catch them;
- this retrospective adopted a reference rule that no directive states.

The approver ruled on 2026-09-28 that these extend the `documentation` and `doc-versioning`
directives. The retrospective's classification pass (`retrospective-rel-v0.2-plan` §4.10) added four
closed or ratified elements as precedents, and the approver ruled that no further element is filed
for them.

**The rules, and where each one lives at `a20b346c`.**

1. **Citation form** — `dl-075-no-bare-line-offsets-in-memory` (`ready`, approved at `0cf643ff`). A
   durable citation names a symbol, heading, YAML key path or verbatim quotation, plus the commit it
   was read at. A bare `path:line` is legal only in note-like sections. The rule reached one
   directive: `git grep -l dl-075 a20b346c -- docs/self/.wingfoil` lists only
   `directives/custom/claim-evidence.md`, whose section *How a claim is recorded* restates it.
   `documentation.md` does not mention citations.
2. **Version-bump scope** — `dl-047-tech-specs-carry-no-version-field` (`in-discussion`). The
   `doc-versioning` directive tells every role to bump a `version:` field that no tech-spec, ADR, DL or
   task carries. `dl-047` offers three options and recommends scoping the rule to documents that
   declare a version, with a dated *Revision* note for Memory elements.
3. **Transient facts** — `bug-040-builtin-directive-docs-stale-after-task-057` (`open`) and
   `bug-045-mutating-op-enumeration-titles-stale` (`open`). Neither is a defect in code: each records
   a sentence that became false, or was about to, when something else landed. There are two closed
   precedents of the same shape:
   - `bug-062-spec-015-note-carries-transient-findings` (`closed`): a spec note stated two defects as
     current fact, with no element id and nothing scheduled to remove it.
   - `bug-029-e2e-smoke-omits-memory-submit` (`closed`): a script said a step "is added here when it
     ships", and no task, dependency or check owned the addition.
4. **Resolvable references.** The approver ruled on 2026-09-28, for the retrospective, that a
   repository document may reference only what a reader of the repository can open: a versioned
   file, element, commit or ref, or a command that runs against them. Content from outside is
   integrated, not linked (`retrospective-rel-v0.2-plan` §2.2). The rule exists in that plan and
   nowhere else.
5. **Premises carry their measurement conditions.** Three corrections in v0.2 have one cause:
   - `dl-069-lockfile-drift-unguarded` concluded that `main` was healthy. That held only under the
     npm that ran the check, and `b44e3d8c` records it.
   - `bug-062`'s first triage graded it `low` on a premise that flipped when its fix tasks landed.
     `adb8887b` re-graded it `high`.
   - `bug-010`'s fix guidance named `isDeprecatedStatus`, a symbol already removed, and `cfa4123e`
     corrected it.

   None of these was false when written. Each stated a conclusion without the condition it was
   measured under, so nothing prompted a re-check.

**Two gate decision-logs of the same family.** `dl-034-lint-gate-in-dev-loop` (`ready`) and
`dl-044-typecheck-gate-for-test-sources` (`in-discussion`) each add a gate for a rule a directive
already states, such as "Lint clean" in `code-quality.md`. `dl-034`'s Context quotes the rule, but
the directive does not point back at its gate. A reader of the directive cannot tell the rule is
enforced, or where.

Statuses were read at `a20b346c` with
`git show a20b346c:<file> | awk '/^---$/{n++} n==1&&/^(status|release):/'`.

## Decision

The `documentation` and `doc-versioning` directives gain the following clauses. Each cites the
element that argued it. Those elements are not deprecated: `dl-075` and `dl-034` stay `ready`, and
`dl-047` and `dl-044` are ratified or not on their own.

**In `documentation.md`:**

- **D1 — Citations.** A durable citation names something the file carries, plus the commit it was
  read at when the state may move. Bare offsets appear only in Execution Notes, Steps to Reproduce
  and triage notes (`dl-075`). `claim-evidence.md` keeps its restatement and gains a pointer here.
- **D2 — Resolvable references.** A repository document references only what a reader of the
  repository can open. When it depends on something outside, it integrates the needed content and
  drops the reference (the 2026-09-28 ruling, `retrospective-rel-v0.2-plan` §2.2).
- **D3 — Transient facts name their remover.** A sentence that is true only until a known event (a
  merge, a fix, a release, a tool upgrade) names that event's element. That element's Actions or
  acceptance criteria include removing or rewriting the sentence. A deferred step ("added when X
  ships") names the element that adds it, and that element's `depends_on` or acceptance criteria
  say so (precedents: `bug-040`, `bug-045`, `bug-062`, `bug-029`).
- **D4 — Premises carry their conditions.** A triage grade, a DL conclusion or a fix guidance states
  what it was measured under: the commit, and the tool version when a tool's behaviour decides it.
  Whoever picks the element up re-checks the premise before acting on it (precedents: `dl-069`,
  `bug-062`, `bug-010`).
- **D5 — A gate names its rule, and the rule names its gate.** A decision-log that adds a gate for a
  rule a directive already states cites that directive in its Actions. The directive then points at
  the gate that enforces it (precedents: `dl-034`, `dl-044`).

**In `doc-versioning.md`:**

- **V1 — Scope of the bump rule**, as `dl-047` is ratified. This decision does not choose among
  `dl-047`'s options.

**Q1 — placement.**

- **(a) Extend `documentation.md` and `doc-versioning.md`,** as the retrospective disposed.
  `documentation.md` is a P3.8 stand-in (`ref: [P3.8]`, "until they ship, this generic rule … is
  kept as `custom`"). So D1–D5 are marked WingFoil-specific inside it, and they must survive when
  the stand-ins are reconciled with the shipped built-in templates.
- **(b) A new global custom directive for D1–D5,** leaving the stand-in generic. They cannot be lost
  in that reconciliation, at the cost of one more directive to load.

**Recommendation: (a).** One documentation directive is easier to find than two. Marking the
WingFoil-specific clauses costs one sentence, while a second file splits the same subject across two
loads.

**Q2 — order with `dl-047`.**

- **(a)** `dl-047` is ratified first, and V1 is written from its chosen option.
- **(b)** `dl-047`'s choice is recorded in this decision's approve `Reason:`, and `dl-047` is
  approved with it.

**Recommendation: (a).** `dl-047`'s options are argued in `dl-047`. Choosing them here would bury
them.

## Rationale

- **The rules were already decided; only their location is wrong.** `dl-075` is `ready` and followed
  by those who happen to read `claim-evidence`. The resolvability rule was ruled for one phase. The
  transient-fact rule exists only as four bug bodies. Each is a standing rule for every document
  author, which is what a global directive is for (`dl-118-choosing-between-decision-log-bug-and-directive`,
  rule 3).
- **D3 and D4 are one lesson seen from two sides.** D3 covers a sentence whose truth has a known end.
  D4 covers a conclusion whose truth depends on a condition. In both, nothing re-reads the statement
  when the world under it changes, and `bug-062` is an instance of both.
- **D5 closes a loop that is invisible from either end.** A directive without its gate reads as
  advice. A gate without its directive reads as an arbitrary check.
- **Bugs that describe missing rules close when the rule exists.** `bug-040` and `bug-045` have no
  code fix. Their fix is D3. The approver ruled on 2026-09-28 that they close as absorbed once this
  directive is ratified, and are not deprecated, so that they stay citable as precedents.

**Enforcement caveat.** A directive has no enforcement point today. Nothing loads one into an agent's
context, because P3.6 (auto-load by role) is not built:
`git show a20b346c:src/core/index.ts | grep -c agentExecute` prints `0`, while the same command with
`memoryApprove` prints `7`. No hook or CI job reads a commit:
`git ls-tree -r --name-only a20b346c | grep -ciE 'husky|pre-commit|lefthook|commitlint'` prints `0`,
while the same pipe with `publish.yml` prints `1`. D1 and D2 are the most mechanically checkable of
these clauses. A bare offset in a durable section, or a path outside the repository, can be found by
a scan. That enforcement point is `dl-097-claim-evidence-needs-an-enforcement-point` and
`dl-103-governance-enforced-outside-the-agent`, and it is not decided here.

## Actions

1. **Ratify, choosing Q1 and Q2.** Owner: approver. The choice goes in the approve commit's `Reason:`.
2. **On ratification, `.wingfoil/directives/custom/documentation.md` changes**, gaining
   D1–D5. **`.wingfoil/directives/custom/doc-versioning.md` changes**, gaining V1 once
   `dl-047` is ratified. Under Q1 (b), a new file under `.wingfoil/directives/custom/`
   holds D1–D5, and `roles.yaml` `global:` binds it.
3. **`claim-evidence.md`** gains a one-line pointer from *How a claim is recorded* to D1. **`code-quality.md`**
   (and `testing.md`, if `dl-044` is ratified) gains a pointer to the gate that enforces each rule
   (D5).
4. **Once the directive is ratified and written, `bug-040` and `bug-045` close as absorbed.** Each
   goes through the bug machine's existing wontfix/duplicate edge, `open → closed` (`reject`), with a
   `Reason:` citing this decision-log. They are not deprecated.
5. `dl-075` and `dl-034` are **not** transitioned: they stay `ready` and are cited.
6. Tasks are derived by v0.3 `release-planning` (`build-backlog`), not created here.

## Relations

- **Origin:** `retro-v0.2`; the classification pass in `retrospective-rel-v0.2-plan` §4.10.
- **Absorbs, by citation:** `dl-075` (D1), `dl-047` (V1), `bug-040` and `bug-045` (D3).
- **Precedents cited:** `bug-062`, `bug-029` (D3); `dl-069`, `bug-062`, `bug-010` (D4); `dl-034`,
  `dl-044` (D5).
- **Filed under:** `dl-118-choosing-between-decision-log-bug-and-directive`, rule 3.
- **Related:** `dl-121-testing-directive-extensions`, which states the same "say exactly what is true"
  rule for guards and tests; `bug-143-versioned-config-yaml-edits-skip-the-bump`, the
  `doc-versioning` compliance gap on configuration files.
- **Enforcement:** `dl-097-claim-evidence-needs-an-enforcement-point`,
  `dl-103-governance-enforced-outside-the-agent`.
- **Traceability:** P3.5, P3.8 (Documentation).
